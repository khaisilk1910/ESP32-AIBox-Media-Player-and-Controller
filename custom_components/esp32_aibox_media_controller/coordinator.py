"""Coordinator for ESP32 AIBox integration."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import timedelta
import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import Esp32AiboxApiClient, Esp32AiboxApiError
from .const import PROTOCOL_WS_NATIVE

_LOGGER = logging.getLogger(__name__)

_CHAT_BUTTON_ENABLED_STATES = {
    "ready",
    "online",
    "active",
    "available",
    "idle",
    "standby",
    "connecting",
    "listening",
    "thinking",
    "speaking",
}
_CHAT_BUTTON_DISABLED_STATES = {
    "unavailable",
    "offline",
    "error",
    "failed",
    "disabled",
    "disconnected",
}


def _suy_ra_chat_button_enabled(state_value: Any) -> bool | None:
    """Infer chat button availability from normalized chat state."""
    if state_value is None:
        return None

    normalized = str(state_value).strip().lower()
    if not normalized:
        return None

    if normalized in _CHAT_BUTTON_ENABLED_STATES:
        return True
    if normalized in _CHAT_BUTTON_DISABLED_STATES:
        return False
    return None


@dataclass(slots=True)
class Esp32AiboxStatus:
    """Aggregated speaker status."""

    model: str | None = None
    playback_state: str | None = None
    volume_current: int | None = None
    volume_min: int | None = None
    volume_max: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)
    aibox_playback: dict[str, Any] = field(default_factory=dict)
    wake_word: dict[str, Any] = field(default_factory=dict)
    custom_ai: dict[str, Any] = field(default_factory=dict)
    chat_state: dict[str, Any] = field(default_factory=dict)
    led_state: dict[str, Any] = field(default_factory=dict)
    audio_state: dict[str, Any] = field(default_factory=dict)

    @property
    def volume_level(self) -> float | None:
        """Volume normalized to 0..1."""
        if self.volume_current is None or self.volume_min is None or self.volume_max is None:
            return None
        spread = self.volume_max - self.volume_min
        if spread <= 0:
            return 0.0
        return max(0.0, min(1.0, (self.volume_current - self.volume_min) / spread))

    @property
    def is_muted(self) -> bool | None:
        """Best-effort mute state from volume."""
        if self.volume_current is None:
            return None
        return self.volume_current <= 0


class Esp32AiboxCoordinator(DataUpdateCoordinator[Esp32AiboxStatus]):
    """Coordinates periodic state updates from API with throttling."""

    def __init__(
        self,
        hass: HomeAssistant,
        client: Esp32AiboxApiClient,
        scan_interval: timedelta,
        use_media_dispatch: bool,
    ) -> None:
        super().__init__(
            hass,
            logger=_LOGGER,
            name="ESP32 AIBox",
            update_interval=scan_interval,
        )
        self.client = client
        self._use_media_dispatch = use_media_dispatch
        self._section_intervals: dict[str, float] = {
            "audio": 30.0,
            "aibox_playback": 5.0,
            "wake": 90.0,
            "custom_ai": 90.0,
            "chat": 20.0,
            "led": 30.0,
        }
        self._section_last_polled: dict[str, float] = {}
        self._dirty_sections: set[str] = set(self._section_intervals)
        self._pending_refresh_task: asyncio.Task | None = None
        self._coalesced_refresh_task: asyncio.Task | None = None
        self._last_debounced_refresh_at = 0.0

    def mark_sections_dirty(self, *sections: str) -> None:
        """Mark one or more sections for the next refresh."""
        if not sections:
            self._dirty_sections.update(self._section_intervals)
            return
        for section in sections:
            if section in self._section_intervals:
                self._dirty_sections.add(section)

    def _nen_poll(self, section: str) -> bool:
        """Return True if a section should be refreshed now."""
        if section in self._dirty_sections:
            return True
        interval = self._section_intervals.get(section, 0.0)
        last_polled = self._section_last_polled.get(section, 0.0)
        return (time.monotonic() - last_polled) >= interval

    async def async_request_refresh(self) -> None:
        """Coalesce immediate refresh requests so multiple service calls do not flood the device."""
        task = self._coalesced_refresh_task
        if task and not task.done():
            await asyncio.shield(task)
            return

        async def _runner() -> None:
            try:
                wait_for = max(
                    0.0,
                    1.2 - (time.monotonic() - self._last_debounced_refresh_at),
                )
                if wait_for > 0:
                    await asyncio.sleep(wait_for)
                self._last_debounced_refresh_at = time.monotonic()
                await super(Esp32AiboxCoordinator, self).async_request_refresh()
            finally:
                self._coalesced_refresh_task = None

        self._coalesced_refresh_task = self.hass.async_create_task(_runner())
        await asyncio.shield(self._coalesced_refresh_task)

    async def async_force_refresh(self, *, force_sections: tuple[str, ...] | None = None) -> None:
        """Force a true refresh now, bypassing debounce."""
        if force_sections:
            self.mark_sections_dirty(*force_sections)
        self._last_debounced_refresh_at = time.monotonic()
        await super().async_request_refresh()

    async def async_handle_aibox_push(self, payload: dict[str, Any], msg_kind: str | None = None) -> None:
        """Merge live AiboxPlus websocket pushes without polling the device again."""
        current = self.data if isinstance(self.data, Esp32AiboxStatus) else None
        if current is None:
            return

        kind = str(msg_kind or payload.get('type') or payload.get('action') or '').strip().lower()
        updated = Esp32AiboxStatus(
            model=current.model,
            playback_state=current.playback_state,
            volume_current=current.volume_current,
            volume_min=current.volume_min,
            volume_max=current.volume_max,
            raw=dict(current.raw),
            aibox_playback=dict(current.aibox_playback),
            wake_word=dict(current.wake_word),
            custom_ai=dict(current.custom_ai),
            chat_state=dict(current.chat_state),
            led_state=dict(current.led_state),
            audio_state=dict(current.audio_state),
        )
        changed = False

        if updated_payload := self.client.get_last_aibox_playback():
            if updated_payload != updated.aibox_playback:
                updated.aibox_playback = dict(updated_payload)
                changed = True
            playing_hint = self.client._aibox_phan_tich_co_dang_phat(
                updated_payload.get('is_playing', updated_payload.get('play_state', updated_payload.get('state')))
            )
            if playing_hint is True:
                updated.playback_state = 'playing'
                updated.raw['playback_state'] = 'playing'
                changed = True
            elif playing_hint is False and updated.playback_state != 'playing':
                state_text = str(updated_payload.get('state') or '').strip().lower()
                updated.playback_state = 'stopped' if state_text in {'stopped', 'stop', 'idle', 'off'} else 'paused'
                updated.raw['playback_state'] = updated.playback_state
                changed = True
            self._section_last_polled['aibox_playback'] = time.monotonic()
            self._dirty_sections.discard('aibox_playback')

        if 'wake_word' in kind:
            updated.wake_word.update(payload)
            self._section_last_polled['wake'] = time.monotonic()
            self._dirty_sections.discard('wake')
            changed = True
        elif 'custom_ai' in kind or 'anti_deaf_ai' in kind:
            updated.custom_ai.update(payload)
            self._section_last_polled['custom_ai'] = time.monotonic()
            self._dirty_sections.discard('custom_ai')
            changed = True
        elif kind.startswith('led_'):
            updated.led_state.update(payload)
            self._section_last_polled['led'] = time.monotonic()
            self._dirty_sections.discard('led')
            changed = True
        elif kind.startswith('chat_') or any(
            key in payload for key in ('state', 'chat_state', 'status', 'button_text', 'buttonText', 'button_enabled', 'buttonEnabled', 'test_mic_state')
        ):
            updated.chat_state.update(payload)
            parsed_enabled = None
            if any(key in payload for key in ('button_enabled', 'buttonEnabled', 'enabled')):
                parsed_enabled = self.client._aibox_phan_tich_bool(
                    payload.get('button_enabled', payload.get('buttonEnabled', payload.get('enabled')))
                )
            if parsed_enabled is None:
                inferred_enabled = _suy_ra_chat_button_enabled(
                    payload.get('state', payload.get('chat_state', payload.get('status')))
                )
                if inferred_enabled is not None:
                    updated.chat_state['button_enabled'] = inferred_enabled
            self._section_last_polled['chat'] = time.monotonic()
            self._dirty_sections.discard('chat')
            changed = True

        if changed:
            self.async_set_updated_data(updated)

    async def async_request_refresh_debounced(
        self,
        *,
        delay: float = 0.6,
        min_interval: float = 2.0,
        force_sections: tuple[str, ...] | None = None,
    ) -> None:
        """Schedule one refresh soon instead of hammering the device immediately."""
        if force_sections:
            self.mark_sections_dirty(*force_sections)

        if self._pending_refresh_task and not self._pending_refresh_task.done():
            return

        async def _runner() -> None:
            try:
                if delay > 0:
                    await asyncio.sleep(delay)
                wait_for = max(
                    0.0,
                    min_interval - (time.monotonic() - self._last_debounced_refresh_at),
                )
                if wait_for > 0:
                    await asyncio.sleep(wait_for)
                self._last_debounced_refresh_at = time.monotonic()
                await self.async_request_refresh()
            finally:
                self._pending_refresh_task = None

        self._pending_refresh_task = self.hass.async_create_task(_runner())

    async def _async_update_data(self) -> Esp32AiboxStatus:
        """Fetch state from device with staged, lower-impact polling."""
        try:
            snapshot = await self.client.async_get_status_snapshot()
        except Esp32AiboxApiError as err:
            raise UpdateFailed(str(err)) from err

        previous = self.data if isinstance(self.data, Esp32AiboxStatus) else None
        previous_raw = dict(previous.raw) if previous else {}

        model = snapshot.get("model")
        playback_state = snapshot.get("playback_state")
        if not self._use_media_dispatch and self.client.protocol != PROTOCOL_WS_NATIVE:
            playback_state = None

        status = Esp32AiboxStatus(
            model=model or (previous.model if previous else None),
            playback_state=playback_state or (previous.playback_state if previous else None),
            raw=previous_raw,
            aibox_playback=dict(previous.aibox_playback) if previous else {},
            wake_word=dict(previous.wake_word) if previous else {},
            custom_ai=dict(previous.custom_ai) if previous else {},
            chat_state=dict(previous.chat_state) if previous else {},
            led_state=dict(previous.led_state) if previous else {},
            audio_state=dict(previous.audio_state) if previous else {},
        )
        status.raw.update(dict(snapshot.get("raw") or {}))
        status.raw["model"] = status.model
        status.raw["playback_state"] = status.playback_state
        status.volume_current = snapshot.get("volume_current")
        status.volume_min = snapshot.get("volume_min")
        status.volume_max = snapshot.get("volume_max")

        if self._nen_poll("audio"):
            try:
                audio_resp = await self.client.async_get_eq_config()
                if audio_resp:
                    status.audio_state = audio_resp
                    if "music_light_mode" in audio_resp and "music_light_mode" not in status.raw:
                        status.raw["music_light_mode"] = audio_resp.get("music_light_mode")
            except (Esp32AiboxApiError, Exception):
                pass
            self._section_last_polled["audio"] = time.monotonic()
            self._dirty_sections.discard("audio")

        if self._nen_poll("aibox_playback"):
            try:
                aibox_pb = await self.client.async_aibox_get_playback_state()
                if aibox_pb:
                    status.aibox_playback = aibox_pb
                    aibox_playing = self.client._aibox_phan_tich_co_dang_phat(
                        aibox_pb.get("is_playing", aibox_pb.get("play_state", aibox_pb.get("state")))
                    )
                    if aibox_playing is True:
                        status.playback_state = "playing"
                        status.raw["playback_state"] = "playing"
                    elif aibox_playing is False and status.playback_state != "playing":
                        status.playback_state = "paused"
                        status.raw["playback_state"] = "paused"
            except (Esp32AiboxApiError, Exception):
                cached_playback = self.client.get_last_aibox_playback()
                if cached_playback:
                    status.aibox_playback = cached_playback
            self._section_last_polled["aibox_playback"] = time.monotonic()
            self._dirty_sections.discard("aibox_playback")
        else:
            cached_playback = self.client.get_last_aibox_playback()
            if cached_playback:
                status.aibox_playback = cached_playback

        if self._nen_poll("wake"):
            try:
                wake_resp = await self.client.async_wake_word_get_enabled()
                if wake_resp and ("enabled" in wake_resp or "enable" in wake_resp or "state" in wake_resp):
                    enabled_val = wake_resp.get("enabled", wake_resp.get("enable", wake_resp.get("state")))
                    parsed = self.client._aibox_phan_tich_bool(enabled_val)
                    if parsed is not None:
                        status.wake_word["enabled"] = parsed
                sens_resp = await self.client.async_wake_word_get_sensitivity()
                if sens_resp and ("sensitivity" in sens_resp or "value" in sens_resp):
                    status.wake_word["sensitivity"] = float(
                        sens_resp.get("sensitivity", sens_resp.get("value", 0.9))
                    )
            except (Esp32AiboxApiError, Exception):
                pass
            self._section_last_polled["wake"] = time.monotonic()
            self._dirty_sections.discard("wake")

        if self._nen_poll("custom_ai"):
            try:
                ai_resp = await self.client.async_custom_ai_get_enabled()
                if ai_resp and ("enabled" in ai_resp or "enable" in ai_resp or "state" in ai_resp):
                    enabled_val = ai_resp.get("enabled", ai_resp.get("enable", ai_resp.get("state")))
                    parsed = self.client._aibox_phan_tich_bool(enabled_val)
                    if parsed is not None:
                        status.custom_ai["enabled"] = parsed
            except (Esp32AiboxApiError, Exception):
                pass
            self._section_last_polled["custom_ai"] = time.monotonic()
            self._dirty_sections.discard("custom_ai")

        if self._nen_poll("chat"):
            try:
                chat_resp = await self.client.async_chat_get_state()
                if chat_resp:
                    state_value = chat_resp.get(
                        "state",
                        chat_resp.get("chat_state", chat_resp.get("status")),
                    )
                    if state_value is None:
                        if any(
                            key in chat_resp
                            for key in ("button_text", "buttonText", "button_enabled", "buttonEnabled")
                        ):
                            state_value = "ready"
                        elif "success" in chat_resp:
                            parsed_success = self.client._aibox_phan_tich_bool(chat_resp.get("success"))
                            if parsed_success is not None:
                                state_value = "ready" if parsed_success else "unavailable"

                    if state_value is not None:
                        state_text = str(state_value).strip()
                        if state_text:
                            status.chat_state["state"] = state_text

                    if "button_text" in chat_resp or "buttonText" in chat_resp or "text" in chat_resp:
                        button_text = chat_resp.get(
                            "button_text",
                            chat_resp.get("buttonText", chat_resp.get("text")),
                        )
                        status.chat_state["button_text"] = "" if button_text is None else str(button_text)

                    parsed_enabled = None
                    if (
                        "button_enabled" in chat_resp
                        or "buttonEnabled" in chat_resp
                        or "enabled" in chat_resp
                    ):
                        parsed_enabled = self.client._aibox_phan_tich_bool(
                            chat_resp.get(
                                "button_enabled",
                                chat_resp.get("buttonEnabled", chat_resp.get("enabled")),
                            )
                        )
                        if parsed_enabled is not None:
                            status.chat_state["button_enabled"] = parsed_enabled

                    if parsed_enabled is None:
                        inferred_enabled = _suy_ra_chat_button_enabled(status.chat_state.get("state"))
                        if inferred_enabled is not None:
                            status.chat_state["button_enabled"] = inferred_enabled

                    resp_type = chat_resp.get("type")
                    if resp_type is not None:
                        status.chat_state["last_response_type"] = str(resp_type)
            except (Esp32AiboxApiError, Exception):
                pass
            self._section_last_polled["chat"] = time.monotonic()
            self._dirty_sections.discard("chat")

        if self._nen_poll("led"):
            try:
                led_resp = await self.client.async_led_get_state()
                if led_resp:
                    status.led_state = led_resp
            except (Esp32AiboxApiError, Exception):
                pass
            self._section_last_polled["led"] = time.monotonic()
            self._dirty_sections.discard("led")

        return status
