"""API client for ESP32 AIBox (HTTP bridge + native WebSocket)."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from dataclasses import dataclass
import json
import logging
import math
import re
import time
from typing import Any, Awaitable, Callable, Mapping

from aiohttp import (
    ClientError,
    ClientResponseError,
    ClientSession,
    WSMsgType,
)

from .const import (
    DEFAULT_AIBOX_WS_PORT,
    CONF_ENDPOINT_ADB_CMD,
    CONF_ENDPOINT_DO_CMD,
    CONF_ENDPOINT_KEYEVENT,
    CONF_ENDPOINT_MEDIA_DISPATCH,
    CONF_PARAM_COMMAND,
    CONF_PARAM_KEYCODE,
    CONF_PARAM_MEDIA_KEY,
    CONF_RESPONSE_CODE_KEY,
    CONF_RESPONSE_MESSAGE_KEY,
    CONF_RESPONSE_RESULT_KEY,
    CONF_RESPONSE_SUCCESS_CODE,
    DEFAULT_ENDPOINT_ADB_CMD,
    DEFAULT_ENDPOINT_DO_CMD,
    DEFAULT_ENDPOINT_KEYEVENT,
    DEFAULT_ENDPOINT_MEDIA_DISPATCH,
    DEFAULT_PARAM_COMMAND,
    DEFAULT_PARAM_KEYCODE,
    DEFAULT_PARAM_MEDIA_KEY,
    DEFAULT_PROTOCOL,
    DEFAULT_RESPONSE_CODE_KEY,
    DEFAULT_RESPONSE_MESSAGE_KEY,
    DEFAULT_RESPONSE_RESULT_KEY,
    DEFAULT_RESPONSE_SUCCESS_CODE,
    KEYCODE_MEDIA_NEXT,
    KEYCODE_MEDIA_PLAY_PAUSE,
    KEYCODE_MEDIA_PREVIOUS,
    KEYCODE_MEDIA_STOP,
    KEYCODE_MUTE,
    KEYCODE_VOLUME_DOWN,
    KEYCODE_VOLUME_UP,
    PROTOCOL_HTTP_BRIDGE,
    PROTOCOL_WS_NATIVE,
)


class Esp32AiboxApiError(Exception):
    """Base API error."""


class Esp32AiboxApiConnectionError(Esp32AiboxApiError):
    """Raised when connection to API fails."""


class Esp32AiboxApiResponseError(Esp32AiboxApiError):
    """Raised when API returns invalid payload."""


_VOLUME_RE = re.compile(r"volume is\s+(?P<current>\d+)\s+in range\s+\[(?P<min>\d+)\.\.(?P<max>\d+)\]")
_PLAYBACK_STATE_RE = re.compile(r"state=(?P<state>\d+)")
_RAW_RESPONSE_KEY = "_raw"
_LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class VolumeInfo:
    """Represents parsed media volume information."""

    current: int
    minimum: int
    maximum: int

    @property
    def level(self) -> float:
        """Return volume in Home Assistant 0..1 format."""
        spread = self.maximum - self.minimum
        if spread <= 0:
            return 0.0
        return max(0.0, min(1.0, (self.current - self.minimum) / spread))


@dataclass(slots=True)
class ApiMapping:
    """API mapping descriptor for HTTP bridge variants."""

    endpoint_do_cmd: str = DEFAULT_ENDPOINT_DO_CMD
    endpoint_adb_cmd: str = DEFAULT_ENDPOINT_ADB_CMD
    endpoint_keyevent: str = DEFAULT_ENDPOINT_KEYEVENT
    endpoint_media_dispatch: str = DEFAULT_ENDPOINT_MEDIA_DISPATCH
    param_command: str = DEFAULT_PARAM_COMMAND
    param_keycode: str = DEFAULT_PARAM_KEYCODE
    param_media_key: str = DEFAULT_PARAM_MEDIA_KEY
    response_code_key: str = DEFAULT_RESPONSE_CODE_KEY
    response_message_key: str = DEFAULT_RESPONSE_MESSAGE_KEY
    response_result_key: str = DEFAULT_RESPONSE_RESULT_KEY
    response_success_code: str = DEFAULT_RESPONSE_SUCCESS_CODE

    @staticmethod
    def _chuan_hoa_endpoint(path: str) -> str:
        path = (path or "").strip()
        if not path:
            raise ValueError("Endpoint path cannot be empty")
        if not path.startswith("/"):
            path = f"/{path}"
        return path

    @staticmethod
    def _chuan_hoa_van_ban(value: str, fallback: str) -> str:
        cleaned = (value or "").strip()
        return cleaned if cleaned else fallback

    @classmethod
    def from_config(cls, data: Mapping[str, Any]) -> "ApiMapping":
        """Build mapping from config entry data/options."""
        response_code_key = (
            str(data[CONF_RESPONSE_CODE_KEY]).strip()
            if CONF_RESPONSE_CODE_KEY in data
            else DEFAULT_RESPONSE_CODE_KEY
        )
        response_message_key = (
            str(data[CONF_RESPONSE_MESSAGE_KEY]).strip()
            if CONF_RESPONSE_MESSAGE_KEY in data
            else DEFAULT_RESPONSE_MESSAGE_KEY
        )
        response_result_key = (
            str(data[CONF_RESPONSE_RESULT_KEY]).strip()
            if CONF_RESPONSE_RESULT_KEY in data
            else DEFAULT_RESPONSE_RESULT_KEY
        )
        response_success_code = (
            str(data[CONF_RESPONSE_SUCCESS_CODE]).strip()
            if CONF_RESPONSE_SUCCESS_CODE in data
            else DEFAULT_RESPONSE_SUCCESS_CODE
        )

        return cls(
            endpoint_do_cmd=cls._chuan_hoa_endpoint(
                str(data.get(CONF_ENDPOINT_DO_CMD, DEFAULT_ENDPOINT_DO_CMD))
            ),
            endpoint_adb_cmd=cls._chuan_hoa_endpoint(
                str(data.get(CONF_ENDPOINT_ADB_CMD, DEFAULT_ENDPOINT_ADB_CMD))
            ),
            endpoint_keyevent=cls._chuan_hoa_endpoint(
                str(data.get(CONF_ENDPOINT_KEYEVENT, DEFAULT_ENDPOINT_KEYEVENT))
            ),
            endpoint_media_dispatch=cls._chuan_hoa_endpoint(
                str(data.get(CONF_ENDPOINT_MEDIA_DISPATCH, DEFAULT_ENDPOINT_MEDIA_DISPATCH))
            ),
            param_command=cls._chuan_hoa_van_ban(
                str(data.get(CONF_PARAM_COMMAND, DEFAULT_PARAM_COMMAND)),
                DEFAULT_PARAM_COMMAND,
            ),
            param_keycode=cls._chuan_hoa_van_ban(
                str(data.get(CONF_PARAM_KEYCODE, DEFAULT_PARAM_KEYCODE)),
                DEFAULT_PARAM_KEYCODE,
            ),
            param_media_key=cls._chuan_hoa_van_ban(
                str(data.get(CONF_PARAM_MEDIA_KEY, DEFAULT_PARAM_MEDIA_KEY)),
                DEFAULT_PARAM_MEDIA_KEY,
            ),
            response_code_key=response_code_key,
            response_message_key=response_message_key,
            response_result_key=response_result_key,
            response_success_code=response_success_code,
        )


class Esp32AiboxApiClient:
    """Async client for both API modes:

    - `http_bridge`: endpoints like `/do-cmd`, `/input-keyevent`
    - `ws_native`: native AIBox websocket at `ws://<ip>:8080`
    """

    def __init__(
        self,
        session: ClientSession,
        host: str,
        port: int,
        mapping: ApiMapping,
        protocol: str = DEFAULT_PROTOCOL,
        aibox_ws_port: int = DEFAULT_AIBOX_WS_PORT,
        timeout: int = 10,
    ) -> None:
        self._session = session
        self._host = host
        self._port = port
        self._base_url = f"http://{host}:{port}"
        self._ws_url = f"ws://{host}:{port}"
        self._aibox_ws_url = f"ws://{host}:{int(aibox_ws_port)}"
        self._mapping = mapping
        self._protocol = protocol
        self._timeout = timeout
        self._last_aibox_playback: dict[str, Any] = {}
        self._system_monitor_last_cpu: tuple[int, int] | None = None
        self._ws_info_cache: dict[str, Any] | None = None
        self._ws_info_cache_at = 0.0
        self._ws_eq_cache: dict[str, Any] | None = None
        self._ws_eq_cache_at = 0.0
        self._aibox_cache: dict[str, dict[str, Any]] = {}
        self._aibox_cache_at: dict[str, float] = {}
        self._aibox_live_task: asyncio.Task | None = None
        self._aibox_live_ws = None
        self._aibox_live_running = False
        self._aibox_live_lock = asyncio.Lock()
        self._aibox_live_connected = asyncio.Event()
        self._push_update_callback: Callable[[dict[str, Any], str | None], Awaitable[None] | None] | None = None

    @property
    def protocol(self) -> str:
        """Return configured protocol."""
        return self._protocol

    def set_push_update_callback(
        self,
        callback: Callable[[dict[str, Any], str | None], Awaitable[None] | None] | None,
    ) -> None:
        """Register callback invoked when live AiboxPlus WS receives state pushes."""
        self._push_update_callback = callback

    async def async_start(self) -> None:
        """Start background AiboxPlus listener used to mirror original web app logic."""
        if self._aibox_live_running:
            return
        self._aibox_live_running = True
        self._aibox_live_task = asyncio.create_task(self._aibox_live_loop())

    async def async_close(self) -> None:
        """Close background websocket tasks and release resources."""
        self._aibox_live_running = False
        task = self._aibox_live_task
        self._aibox_live_task = None
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        async with self._aibox_live_lock:
            ws = self._aibox_live_ws
            self._aibox_live_ws = None
            self._aibox_live_connected.clear()
            if ws is not None and not ws.closed:
                await ws.close()

    def _aibox_lay_cache(self, section: str, max_age: float | None = None) -> dict[str, Any] | None:
        """Return copy of cached live section if not stale."""
        payload = self._aibox_cache.get(section)
        if not isinstance(payload, dict):
            return None
        if max_age is not None:
            age = time.monotonic() - self._aibox_cache_at.get(section, 0.0)
            if age > max_age:
                return None
        return dict(payload)

    def _aibox_luu_cache(self, section: str, payload: dict[str, Any]) -> None:
        """Persist one live AiboxPlus section."""
        normalized = dict(payload)
        normalized.setdefault('updated_at_ms', int(time.time() * 1000))
        self._aibox_cache[section] = normalized
        self._aibox_cache_at[section] = time.monotonic()

    def _aibox_cap_nhat_wifi_cache(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Merge WiFi events into one stable cache payload."""
        current = dict(self._aibox_cache.get('wifi_status') or {})
        normalized = dict(payload or {})
        msg_type = str(normalized.get('type') or normalized.get('action') or '').strip().lower()

        networks = normalized.get('networks') if isinstance(normalized.get('networks'), list) else None
        if msg_type == 'wifi_scan_result':
            current['scanned_networks'] = networks or []
        elif msg_type == 'wifi_saved_result':
            current['saved_networks'] = networks or []
        else:
            current.update({key: value for key, value in normalized.items() if value is not None})
            if isinstance(normalized.get('scanned_networks'), list):
                current['scanned_networks'] = list(normalized.get('scanned_networks') or [])
            elif networks is not None and 'scan' in msg_type:
                current['scanned_networks'] = networks
            if isinstance(normalized.get('saved_networks'), list):
                current['saved_networks'] = list(normalized.get('saved_networks') or [])
            elif networks is not None and ('saved' in msg_type or 'delete' in msg_type):
                current['saved_networks'] = networks

        current.setdefault('type', normalized.get('type') or 'wifi_status')
        current['last_wifi_event_type'] = msg_type or current.get('last_wifi_event_type') or 'wifi_status'
        current['updated_at_ms'] = int(time.time() * 1000)
        self._aibox_luu_cache('wifi_status', current)
        return current

    async def _aibox_cho_cache_section(
        self,
        section: str,
        *,
        predicate: Callable[[dict[str, Any]], bool],
        timeout: float = 8.0,
        interval: float = 0.12,
        max_age: float | None = None,
    ) -> dict[str, Any]:
        """Wait until one cached live section satisfies a predicate."""
        end = asyncio.get_running_loop().time() + max(0.1, timeout)
        last_payload: dict[str, Any] = {}
        while asyncio.get_running_loop().time() < end:
            cached = self._aibox_lay_cache(section, max_age=max_age)
            if isinstance(cached, dict):
                last_payload = cached
                if predicate(cached):
                    return cached
            await asyncio.sleep(max(0.05, interval))
        raise Esp32AiboxApiConnectionError(f'Timeout waiting for cached section: {section} ({last_payload})')

    async def _aibox_wifi_live_action(
        self,
        payload: dict[str, Any],
        *,
        predicate: Callable[[dict[str, Any], int], bool],
        timeout: float,
    ) -> dict[str, Any] | None:
        """Send one WiFi command through the persistent WS and wait for merged cache."""
        before = int((self._aibox_lay_cache('wifi_status') or {}).get('updated_at_ms') or 0)
        sent = await self._aibox_gui_qua_live(payload)
        if not sent:
            return None
        return await self._aibox_cho_cache_section(
            'wifi_status',
            predicate=lambda cached: predicate(cached, before),
            timeout=timeout,
            interval=0.12,
            max_age=max(timeout + 2.0, 10.0),
        )

    async def _aibox_gui_qua_live(self, payload: dict[str, Any]) -> bool:
        """Send payload through persistent live websocket when connected."""
        if not self._aibox_live_running:
            return False
        try:
            await asyncio.wait_for(self._aibox_live_connected.wait(), timeout=0.8)
        except asyncio.TimeoutError:
            return False
        async with self._aibox_live_lock:
            ws = self._aibox_live_ws
            if ws is None or ws.closed:
                return False
            await ws.send_str(json.dumps(payload, ensure_ascii=False))
        return True

    async def _aibox_bootstrap_live(self) -> None:
        """Seed important live state once connection is established."""
        bootstrap_payloads = [
            {'action': 'get_playback_state'},
            {'action': 'chat_get_state'},
            {'action': 'led_get_state'},
            {'action': 'wake_word_get_enabled'},
            {'action': 'wake_word_get_sensitivity'},
            {'action': 'custom_ai_get_enabled'},
            {'action': 'wifi_get_status'},
            {'action': 'wifi_get_saved'},
            {'action': 'stereo_get_state'},
        ]
        for payload in bootstrap_payloads:
            with suppress(Exception):
                await self._aibox_gui_qua_live(payload)
                await asyncio.sleep(0.05)

    async def _aibox_xu_ly_goi_tin_live(self, payload: dict[str, Any]) -> None:
        """Normalize and cache pushed AiboxPlus state packets."""
        normalized = self._aibox_chuan_hoa_payload(payload)
        msg_kind = self._aibox_loai_tin_nhan(normalized)
        self._aibox_cap_nhat_bo_nho_phat(normalized, msg_kind)

        msg_kind_norm = str(msg_kind or '').strip().lower()
        if self._aibox_la_payload_tin_nhan_chat(normalized):
            if any(key in normalized for key in ('button_text', 'buttonText', 'button_enabled', 'buttonEnabled', 'state', 'chat_state', 'status', 'test_mic_state')):
                self._aibox_luu_cache('chat_state', normalized)
        elif msg_kind_norm.startswith('chat_'):
            self._aibox_luu_cache('chat_state', normalized)
        elif 'wake_word' in msg_kind_norm:
            self._aibox_luu_cache('wake_word', normalized)
        elif 'custom_ai' in msg_kind_norm or 'anti_deaf_ai' in msg_kind_norm:
            self._aibox_luu_cache('custom_ai', normalized)
        elif msg_kind_norm.startswith('led_'):
            self._aibox_luu_cache('led_state', normalized)
        elif msg_kind_norm.startswith('wifi_'):
            self._aibox_cap_nhat_wifi_cache(normalized)
        elif msg_kind_norm.startswith('stereo_'):
            self._aibox_luu_cache('stereo_state', normalized)

        playback_cache = self.get_last_aibox_playback()
        if playback_cache:
            self._aibox_luu_cache('aibox_playback', playback_cache)

        callback = self._push_update_callback
        if callback is not None:
            try:
                result = callback(normalized, msg_kind)
                if asyncio.iscoroutine(result):
                    asyncio.create_task(result)
            except Exception:
                _LOGGER.debug('Aibox push callback failed', exc_info=True)

    async def _aibox_live_loop(self) -> None:
        """Maintain long-lived AiboxPlus websocket similar to the original web app."""
        reconnect_attempt = 0
        while self._aibox_live_running:
            try:
                async with self._session.ws_connect(
                    self._aibox_ws_url,
                    timeout=self._timeout,
                    heartbeat=30.0,
                    autoping=True,
                ) as ws:
                    reconnect_attempt = 0
                    async with self._aibox_live_lock:
                        self._aibox_live_ws = ws
                        self._aibox_live_connected.set()
                    await self._aibox_bootstrap_live()
                    while self._aibox_live_running:
                        msg = await ws.receive(timeout=60.0)
                        if msg.type is WSMsgType.TEXT:
                            try:
                                data = json.loads(msg.data)
                            except json.JSONDecodeError:
                                continue
                            if isinstance(data, dict):
                                await self._aibox_xu_ly_goi_tin_live(data)
                        elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                            break
            except asyncio.CancelledError:
                raise
            except Exception:
                _LOGGER.debug('AiboxPlus live websocket disconnected', exc_info=True)
            finally:
                async with self._aibox_live_lock:
                    ws = self._aibox_live_ws
                    self._aibox_live_ws = None
                    self._aibox_live_connected.clear()
                    if ws is not None and not ws.closed:
                        with suppress(Exception):
                            await ws.close()
            if not self._aibox_live_running:
                break
            reconnect_attempt += 1
            await asyncio.sleep(min(12.0, max(1.0, reconnect_attempt * 2.0)))

    # ---------------------------
    # HTTP bridge implementation
    # ---------------------------
    async def _goi_get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        """Perform GET call and validate common response format."""
        url = f"{self._base_url}{path}"
        try:
            async with self._session.get(url, params=params, timeout=self._timeout) as response:
                response.raise_for_status()
                payload = await self._giai_ma_payload(response)
        except (ClientError, ClientResponseError) as err:
            raise Esp32AiboxApiConnectionError(str(err)) from err

        if not isinstance(payload, dict):
            raise Esp32AiboxApiResponseError("Payload must be a JSON object")

        code_key = self._mapping.response_code_key
        if code_key and self._mapping.response_success_code:
            code = payload.get(code_key)
            if str(code) != self._mapping.response_success_code:
                message = payload.get(self._mapping.response_message_key) or "Unknown API error"
                raise Esp32AiboxApiResponseError(str(message))

        return payload

    async def _giai_ma_payload(self, response) -> dict[str, Any]:
        """Decode API payload, supporting JSON and raw text fallbacks."""
        text = await response.text()
        if not text:
            return {}

        try:
            payload = json.loads(text)
        except ValueError:
            return {_RAW_RESPONSE_KEY: text}

        if isinstance(payload, dict):
            return payload
        return {_RAW_RESPONSE_KEY: str(payload)}

    def _lay_ket_qua(self, payload: dict[str, Any]) -> str:
        """Extract output from configured result key with raw fallback."""
        result_key = self._mapping.response_result_key
        if result_key and result_key in payload:
            return str(payload.get(result_key, "")).strip()
        return str(payload.get(_RAW_RESPONSE_KEY, "")).strip()

    # ---------------------------
    # Native WebSocket API
    # ---------------------------
    async def _ws_gui_va_cho(
        self,
        payload: dict[str, Any],
        expect_type: str | set[str] | None = None,
        timeout: float = 5.0,
    ) -> dict[str, Any]:
        """Send a WS message and wait for matching response type."""
        try:
            async with self._session.ws_connect(self._ws_url, timeout=self._timeout) as ws:
                await ws.send_str(json.dumps(payload, ensure_ascii=False))
                while True:
                    msg = await ws.receive(timeout=timeout)
                    if msg.type is WSMsgType.TEXT:
                        try:
                            data = json.loads(msg.data)
                        except json.JSONDecodeError:
                            continue
                        if not isinstance(data, dict):
                            continue
                        if expect_type is None:
                            return data
                        msg_type = data.get("type")
                        if isinstance(expect_type, set):
                            if msg_type in expect_type:
                                return data
                        elif msg_type == expect_type:
                            return data
                    elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                        raise Esp32AiboxApiConnectionError("WebSocket connection closed unexpectedly")
        except asyncio.TimeoutError as err:
            raise Esp32AiboxApiConnectionError("WebSocket response timeout") from err
        except ClientError as err:
            raise Esp32AiboxApiConnectionError(str(err)) from err

    async def _ws_chi_gui(self, payload: dict[str, Any]) -> None:
        """Send WS message without waiting for ack."""
        try:
            async with self._session.ws_connect(self._ws_url, timeout=self._timeout) as ws:
                await ws.send_str(json.dumps(payload, ensure_ascii=False))
                await asyncio.sleep(0.05)
        except (ClientError, asyncio.TimeoutError) as err:
            raise Esp32AiboxApiConnectionError(str(err)) from err

    @staticmethod
    def _aibox_loai_tin_nhan(payload: dict[str, Any]) -> str | None:
        """Return message kind from common Aibox keys."""
        for key in ("type", "action", "event", "cmd", "command"):
            value = payload.get(key)
            if isinstance(value, str):
                normalized = value.strip()
                if normalized:
                    return normalized
        return None

    @staticmethod
    def _aibox_loai_khop(actual: str | None, expected: str) -> bool:
        """Match Aibox message kinds with relaxed suffix compatibility."""
        if not actual or not expected:
            return False
        actual_norm = actual.strip().lower()
        expected_norm = expected.strip().lower()
        if actual_norm == expected_norm:
            return True

        for suffix in ("_result", "_state"):
            if actual_norm.endswith(suffix) and actual_norm[: -len(suffix)] == expected_norm:
                return True
            if expected_norm.endswith(suffix) and expected_norm[: -len(suffix)] == actual_norm:
                return True
        return False

    @staticmethod
    def _aibox_phan_tich_bool(value: Any) -> bool | None:
        """Normalize mixed boolean representations from Aibox payloads."""
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            if not math.isfinite(value):
                return None
            return value != 0
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "on", "enable", "enabled", "yes", "y"}:
                return True
            if normalized in {"0", "false", "off", "disable", "disabled", "no", "n"}:
                return False
            try:
                numeric = float(normalized)
            except ValueError:
                return None
            if math.isfinite(numeric):
                return numeric != 0
        return None

    @staticmethod
    def _aibox_chuan_hoa_payload(payload: dict[str, Any]) -> dict[str, Any]:
        """Flatten common wrappers and normalize core state fields."""
        normalized = dict(payload)

        for container_key in ("data", "result", "payload"):
            container = normalized.get(container_key)
            if isinstance(container, dict):
                for key, value in container.items():
                    normalized.setdefault(key, value)

        if "enabled" not in normalized and "enable" in normalized:
            parsed_enabled = Esp32AiboxApiClient._aibox_phan_tich_bool(normalized.get("enable"))
            if parsed_enabled is not None:
                normalized["enabled"] = parsed_enabled

        msg_kind = Esp32AiboxApiClient._aibox_loai_tin_nhan(normalized)
        if msg_kind and "type" not in normalized:
            normalized["type"] = msg_kind
        return normalized

    def _aibox_khop_ky_vong(
        self,
        msg_kind: str | None,
        expected: str | set[str] | None,
    ) -> bool:
        """Check whether message kind matches expected value(s)."""
        if expected is None:
            return True
        if isinstance(expected, set):
            return any(self._aibox_loai_khop(msg_kind, item) for item in expected)
        return self._aibox_loai_khop(msg_kind, expected)

    def _aibox_cap_nhat_bo_nho_phat(
        self,
        payload: dict[str, Any],
        msg_kind: str | None = None,
    ) -> None:
        """Capture latest playback metadata broadcast by AiboxPlus."""
        kind = (msg_kind or self._aibox_loai_tin_nhan(payload) or "").strip().lower()
        if not payload:
            return

        is_playback_payload = kind in {
            "playback_state",
            "music_state",
            "player_state",
            "play_state",
        } or any(
            key in payload
            for key in (
                "is_playing",
                "play_state",
                "state",
                "title",
                "artist",
                "duration",
                "position",
                "thumbnail_url",
            )
        )
        if not is_playback_payload:
            return

        merged = dict(self._last_aibox_playback)
        for key in (
            "is_playing",
            "play_state",
            "state",
            "position",
            "duration",
            "title",
            "artist",
            "thumbnail_url",
            "source",
            "auto_next_enabled",
            "repeat_enabled",
        ):
            if key in payload:
                merged[key] = payload.get(key)

        playing_hint: bool | None = None
        for key in ("is_playing", "play_state", "state"):
            if key in payload:
                parsed = self._aibox_phan_tich_co_dang_phat(payload.get(key))
                if parsed is not None:
                    playing_hint = parsed
                    break
        if playing_hint is None:
            for key in ("is_playing", "play_state", "state"):
                if key in merged:
                    parsed = self._aibox_phan_tich_co_dang_phat(merged.get(key))
                    if parsed is not None:
                        playing_hint = parsed
                        break
        if playing_hint is not None:
            merged["is_playing"] = playing_hint

        merged["type"] = kind or payload.get("type") or "playback_state"
        self._last_aibox_playback = merged

    @staticmethod
    def _aibox_phan_tich_co_dang_phat(value: Any) -> bool | None:
        """Normalize mixed playback state representations into bool."""
        if value in (True, 1, 3):
            return True
        if value in (False, 0, 2):
            return False
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "3", "playing", "play", "on"}:
                return True
            if normalized in {"false", "0", "2", "paused", "pause", "stopped", "stop", "idle", "off"}:
                return False
        return None

    def get_last_aibox_playback(self) -> dict[str, Any]:
        """Return latest observed Aibox playback metadata."""
        return dict(self._last_aibox_playback)

    @staticmethod
    def _aibox_la_payload_tin_nhan_chat(payload: dict[str, Any]) -> bool:
        """Heuristic for chat message frame variants."""
        return any(
            key in payload
            for key in ("content", "message", "text", "message_type", "role", "sender")
        )

    async def _aibox_yeu_cau_trang_thai_bool(
        self,
        *,
        fetch_state: Callable[[], Awaitable[dict[str, Any]]],
        expected: bool,
        field_names: tuple[str, ...] = ("enabled", "enable"),
        timeout: float = 5.0,
        interval: float = 0.25,
        error_label: str,
    ) -> dict[str, Any]:
        """Poll Aibox getter until bool field matches expected value."""
        end = asyncio.get_running_loop().time() + max(0.1, timeout)
        last_response: dict[str, Any] = {}
        while asyncio.get_running_loop().time() < end:
            with suppress(Esp32AiboxApiError, Exception):
                response = await fetch_state()
                if isinstance(response, dict):
                    for field_name in field_names:
                        if field_name not in response:
                            continue
                        last_response = response
                        parsed = self._aibox_phan_tich_bool(response.get(field_name))
                        if parsed is expected:
                            return response
            await asyncio.sleep(max(0.05, interval))
        raise Esp32AiboxApiResponseError(
            f"{error_label} state confirmation failed: {last_response}"
        )

    # --------------------------------
    # AiboxPlus WebSocket API (8082)
    # --------------------------------
    async def _aibox_gui_va_cho(
        self,
        payload: dict[str, Any],
        expect_type: str | set[str] | None = None,
        timeout: float = 25.0,
    ) -> dict[str, Any]:
        """Send message to AiboxPlus WS and wait for matching response."""
        try:
            async with self._session.ws_connect(self._aibox_ws_url, timeout=self._timeout) as ws:
                await ws.send_str(json.dumps(payload, ensure_ascii=False))
                while True:
                    msg = await ws.receive(timeout=timeout)
                    if msg.type is WSMsgType.TEXT:
                        try:
                            data = json.loads(msg.data)
                        except json.JSONDecodeError:
                            continue
                        if not isinstance(data, dict):
                            continue
                        normalized = self._aibox_chuan_hoa_payload(data)
                        msg_kind = self._aibox_loai_tin_nhan(normalized)
                        self._aibox_cap_nhat_bo_nho_phat(normalized, msg_kind)
                        _LOGGER.debug(
                            "Aibox recv action=%s kind=%s payload=%s",
                            payload.get("action"),
                            msg_kind,
                            normalized,
                        )
                        if self._aibox_loai_khop(msg_kind, "connected"):
                            continue

                        if self._aibox_khop_ky_vong(msg_kind, expect_type):
                            return normalized

                        if "songs" in normalized or "error" in normalized:
                            return normalized

                        request_action = str(payload.get("action", "")).strip().lower()
                        msg_kind_norm = str(msg_kind or "").strip().lower()
                        if request_action.startswith("wake_word_") and "wake_word" in msg_kind_norm:
                            expects_sensitivity = "sensitivity" in request_action
                            if expects_sensitivity and any(
                                key in normalized for key in ("sensitivity", "value")
                            ):
                                return normalized
                            if not expects_sensitivity and any(
                                key in normalized for key in ("enabled", "enable", "state")
                            ):
                                return normalized
                        if request_action.startswith("custom_ai_") and "custom_ai" in msg_kind_norm and any(
                            key in normalized for key in ("enabled", "enable")
                        ):
                            return normalized
                        if request_action.startswith("chat_") and (
                            "chat" in msg_kind_norm
                            or "test_mic" in msg_kind_norm
                        ) and any(
                            key in normalized
                            for key in ("state", "chat_state", "button_text", "button_enabled")
                        ):
                            return normalized
                    elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                        raise Esp32AiboxApiConnectionError(
                            "AiboxPlus WebSocket connection closed unexpectedly"
                        )
        except asyncio.TimeoutError as err:
            _LOGGER.debug("AiboxPlus timeout for payload %s", payload)
            raise Esp32AiboxApiConnectionError("AiboxPlus WebSocket response timeout") from err
        except ClientError as err:
            raise Esp32AiboxApiConnectionError(str(err)) from err

    async def _aibox_chi_gui(self, payload: dict[str, Any]) -> None:
        """Send message to AiboxPlus WS without waiting for response."""
        with suppress(Exception):
            if await self._aibox_gui_qua_live(payload):
                return
        try:
            async with self._session.ws_connect(self._aibox_ws_url, timeout=self._timeout) as ws:
                await ws.send_str(json.dumps(payload, ensure_ascii=False))
                await asyncio.sleep(0.05)
        except (ClientError, asyncio.TimeoutError) as err:
            raise Esp32AiboxApiConnectionError(str(err)) from err

    async def _aibox_gui_va_thu_thap(
        self,
        payload: dict[str, Any],
        collect_types: set[str],
        first_timeout: float = 10.0,
        collect_window: float = 1.2,
        max_items: int = 50,
    ) -> list[dict[str, Any]]:
        """Send payload and collect matching WS messages for a short window."""
        if not collect_types:
            return []

        items: list[dict[str, Any]] = []
        try:
            async with self._session.ws_connect(self._aibox_ws_url, timeout=self._timeout) as ws:
                await ws.send_str(json.dumps(payload, ensure_ascii=False))

                while True:
                    msg = await ws.receive(timeout=first_timeout)
                    if msg.type is WSMsgType.TEXT:
                        try:
                            data = json.loads(msg.data)
                        except json.JSONDecodeError:
                            continue
                        if not isinstance(data, dict):
                            continue
                        normalized = self._aibox_chuan_hoa_payload(data)
                        msg_kind = self._aibox_loai_tin_nhan(normalized)
                        self._aibox_cap_nhat_bo_nho_phat(normalized, msg_kind)
                        _LOGGER.debug(
                            "Aibox collect(first) action=%s kind=%s payload=%s",
                            payload.get("action"),
                            msg_kind,
                            normalized,
                        )
                        if self._aibox_loai_khop(msg_kind, "connected"):
                            continue
                        if self._aibox_khop_ky_vong(msg_kind, collect_types):
                            items.append(normalized)
                            break
                        request_action = str(payload.get("action", "")).strip().lower()
                        if request_action.startswith("chat_") and self._aibox_la_payload_tin_nhan_chat(
                            normalized
                        ):
                            normalized.setdefault("type", "chat_message")
                            items.append(normalized)
                            break
                    elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                        raise Esp32AiboxApiConnectionError(
                            "AiboxPlus WebSocket connection closed unexpectedly"
                        )

                end_time = asyncio.get_running_loop().time() + collect_window
                while len(items) < max_items:
                    remain = end_time - asyncio.get_running_loop().time()
                    if remain <= 0:
                        break
                    try:
                        msg = await ws.receive(timeout=remain)
                    except asyncio.TimeoutError:
                        break

                    if msg.type is WSMsgType.TEXT:
                        try:
                            data = json.loads(msg.data)
                        except json.JSONDecodeError:
                            continue
                        if not isinstance(data, dict):
                            continue
                        normalized = self._aibox_chuan_hoa_payload(data)
                        msg_kind = self._aibox_loai_tin_nhan(normalized)
                        self._aibox_cap_nhat_bo_nho_phat(normalized, msg_kind)
                        _LOGGER.debug(
                            "Aibox collect(next) action=%s kind=%s payload=%s",
                            payload.get("action"),
                            msg_kind,
                            normalized,
                        )
                        if self._aibox_loai_khop(msg_kind, "connected"):
                            continue
                        if self._aibox_khop_ky_vong(msg_kind, collect_types):
                            items.append(normalized)
                            continue
                        request_action = str(payload.get("action", "")).strip().lower()
                        if request_action.startswith("chat_") and self._aibox_la_payload_tin_nhan_chat(
                            normalized
                        ):
                            normalized.setdefault("type", "chat_message")
                            items.append(normalized)
                    elif msg.type in (WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR):
                        break
        except asyncio.TimeoutError as err:
            raise Esp32AiboxApiConnectionError("AiboxPlus collection timeout") from err
        except ClientError as err:
            raise Esp32AiboxApiConnectionError(str(err)) from err
        return items

    def _ws_kiem_tra_ma(self, response: dict[str, Any]) -> None:
        """Validate optional code field in WS response."""
        code = response.get("code")
        if code is None:
            return
        if str(code) not in {"0", "200"}:
            raise Esp32AiboxApiResponseError(str(response.get("msg") or response))

    async def _ws_lay_thong_tin(self) -> dict[str, Any]:
        """Get speaker state from native WS API with a short-lived cache."""
        if self._ws_info_cache is not None and (time.monotonic() - self._ws_info_cache_at) <= 0.8:
            return dict(self._ws_info_cache)
        response = await self._ws_gui_va_cho({"type": "get_info"}, expect_type="get_info")
        self._ws_kiem_tra_ma(response)
        data = response.get("data")
        parsed: dict[str, Any] | None = None
        if isinstance(data, str):
            try:
                candidate = json.loads(data)
                if isinstance(candidate, dict):
                    parsed = candidate
            except json.JSONDecodeError as err:
                raise Esp32AiboxApiResponseError("Invalid get_info payload") from err
        elif isinstance(data, dict):
            parsed = data
        if parsed is None:
            raise Esp32AiboxApiResponseError("Missing get_info data")
        self._ws_info_cache = dict(parsed)
        self._ws_info_cache_at = time.monotonic()
        return dict(parsed)

    async def _ws_lay_am_luong_toi_da(self) -> int | None:
        """Get max volume if supported."""
        try:
            response = await self._ws_gui_va_cho({"type": "max_vol"}, expect_type="max_vol")
            self._ws_kiem_tra_ma(response)
            return int(response.get("data"))
        except (Esp32AiboxApiError, ValueError, TypeError):
            return None

    async def async_get_eq_config(self) -> dict[str, Any]:
        """Get EQ/Bass/Loudness configuration from native WS API."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("EQ config is only available in ws_native mode")
        if self._ws_eq_cache is not None and (time.monotonic() - self._ws_eq_cache_at) <= 6.0:
            return dict(self._ws_eq_cache)

        response = await self._ws_gui_va_cho({"type": "get_eq_config"}, expect_type="get_eq_config")
        self._ws_kiem_tra_ma(response)

        data = response.get("data")
        parsed: dict[str, Any] | None = None
        if isinstance(data, str):
            try:
                candidate = json.loads(data)
            except json.JSONDecodeError as err:
                raise Esp32AiboxApiResponseError("Invalid get_eq_config payload") from err
            if isinstance(candidate, dict):
                parsed = candidate
        elif isinstance(data, dict):
            parsed = data

        if parsed is None:
            fallback = {
                key: response.get(key)
                for key in ("eq", "bass", "loudness", "Mixer", "music_light_mode")
                if key in response
            }
            parsed = fallback or None

        if not isinstance(parsed, dict):
            raise Esp32AiboxApiResponseError("Missing get_eq_config data")
        self._ws_eq_cache = dict(parsed)
        self._ws_eq_cache_at = time.monotonic()
        return dict(parsed)

    async def _ws_hanh_dong_media(self, action: str) -> None:
        """Send media action to native WS API."""
        if action == "next":
            await self.async_shell("input keyevent 87", type_id="myshell")
            await self._ws_chi_gui(
                {"type": "send_message", "what": 65536, "arg1": 0, "arg2": 1, "obj": "web_next"}
            )
            await self._ws_chi_gui({"type": "next"})
            return
        if action == "previous":
            await self.async_shell("input keyevent 88", type_id="myshell")
            await self._ws_chi_gui(
                {"type": "send_message", "what": 65536, "arg1": 0, "arg2": 1, "obj": "web_prev"}
            )
            await self._ws_chi_gui({"type": "prev"})
            return
        if action in {"pause", "stop"}:
            await self._ws_chi_gui(
                {"type": "send_message", "what": 4, "arg1": 2, "arg2": -1, "obj": True}
            )
            return
        if action == "play":
            await self._ws_chi_gui(
                {"type": "send_message", "what": 4, "arg1": 3, "arg2": -1, "obj": True}
            )
            return
        raise Esp32AiboxApiResponseError(f"Unsupported media action: {action}")

    async def _ws_dat_am_luong(self, target: int) -> None:
        """Set volume via native WS API."""
        await self._ws_chi_gui({"type": "set_vol", "vol": int(target)})

    async def _ws_cho_dieu_kien(
        self,
        predicate: Any,
        timeout: float = 4.0,
        interval: float = 0.25,
    ) -> dict[str, Any] | None:
        """Poll get_info until predicate matches or timeout expires."""
        end = asyncio.get_running_loop().time() + max(0.1, timeout)
        last_info: dict[str, Any] | None = None
        while asyncio.get_running_loop().time() < end:
            with suppress(Esp32AiboxApiError):
                info = await self._ws_lay_thong_tin()
                last_info = info
                try:
                    if predicate(info):
                        return info
                except Exception:  # noqa: BLE001
                    pass
            await asyncio.sleep(max(0.05, interval))
        return last_info

    async def _ws_yeu_cau_dieu_kien(
        self,
        predicate: Any,
        *,
        timeout: float,
        interval: float,
        error_label: str,
    ) -> dict[str, Any]:
        """Require predicate match from get_info and raise if not confirmed."""
        info = await self._ws_cho_dieu_kien(
            predicate=predicate,
            timeout=timeout,
            interval=interval,
        )
        with suppress(Esp32AiboxApiError):
            latest = await self._ws_lay_thong_tin()
            info = latest or info

        matched = False
        if info is not None:
            with suppress(Exception):  # noqa: BLE001
                matched = bool(predicate(info))

        if not matched:
            raise Esp32AiboxApiResponseError(
                f"{error_label} state confirmation failed: {info}"
            )

        return info

    @staticmethod
    def _ws_la_bluetooth_bat(device_state: Any) -> bool | None:
        """Parse bluetooth state from `device_state` variants."""
        if device_state is None:
            return None
        if isinstance(device_state, (int, float)):
            if not math.isfinite(device_state):
                return None
            return int(device_state) == 3
        normalized = str(device_state).strip().lower()
        if not normalized:
            return None
        with suppress(ValueError):
            return int(float(normalized)) == 3
        if "bluetooth" in normalized:
            if any(token in normalized for token in ("off", "disable", "disconnect", "idle")):
                return False
            return True
        parsed = Esp32AiboxApiClient._aibox_phan_tich_bool(normalized)
        return parsed

    # ---------------------------
    # Public API used by entities
    # ---------------------------
    async def async_do_cmd(self, command: str) -> str:
        """Run shell command."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            return await self.async_shell(command, type_id="myshell")

        payload = await self._goi_get(
            self._mapping.endpoint_do_cmd,
            {self._mapping.param_command: command},
        )
        return self._lay_ket_qua(payload)

    async def async_do_adb_cmd(self, command: str) -> str:
        """Run adb command (bridge mode) or fallback to shell (ws mode)."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            return await self.async_do_cmd(command)

        payload = await self._goi_get(
            self._mapping.endpoint_adb_cmd,
            {self._mapping.param_command: command},
        )
        return self._lay_ket_qua(payload)

    async def async_send_keycode(self, keycode: int) -> str:
        """Send Android key event."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            if keycode == KEYCODE_VOLUME_UP:
                volume = await self.async_get_volume()
                if volume is None:
                    raise Esp32AiboxApiResponseError("Unable to read current volume")
                await self._ws_dat_am_luong(min(volume.maximum, volume.current + 1))
                return "ok"
            if keycode == KEYCODE_VOLUME_DOWN:
                volume = await self.async_get_volume()
                if volume is None:
                    raise Esp32AiboxApiResponseError("Unable to read current volume")
                await self._ws_dat_am_luong(max(volume.minimum, volume.current - 1))
                return "ok"
            if keycode in (KEYCODE_MEDIA_PLAY_PAUSE,):
                state = await self.async_get_playback_state()
                await self._ws_hanh_dong_media("pause" if state == "playing" else "play")
                return "ok"
            if keycode == KEYCODE_MEDIA_NEXT:
                await self._ws_hanh_dong_media("next")
                return "ok"
            if keycode == KEYCODE_MEDIA_PREVIOUS:
                await self._ws_hanh_dong_media("previous")
                return "ok"
            if keycode == KEYCODE_MEDIA_STOP:
                await self._ws_hanh_dong_media("stop")
                return "ok"
            if keycode == KEYCODE_MUTE:
                await self._ws_dat_am_luong(0)
                return "ok"
            raise Esp32AiboxApiResponseError(f"Keycode {keycode} not supported in ws_native mode")

        payload = await self._goi_get(
            self._mapping.endpoint_keyevent,
            {self._mapping.param_keycode: keycode},
        )
        return self._lay_ket_qua(payload)

    async def async_media_dispatch(self, key: str) -> str:
        """Dispatch media command."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            await self._ws_hanh_dong_media(key)
            return "ok"

        payload = await self._goi_get(
            self._mapping.endpoint_media_dispatch,
            {self._mapping.param_media_key: key},
        )
        return self._lay_ket_qua(payload)

    async def async_get_model(self) -> str:
        """Get device model."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            info = await self._ws_lay_thong_tin()
            return str(info.get("device_name") or info.get("dev_name") or "ESP32 AIBox")
        return await self.async_do_cmd("getprop ro.product.model")

    async def async_get_volume(self) -> VolumeInfo | None:
        """Query current media volume."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            info = await self._ws_lay_thong_tin()
            try:
                current = int(info.get("vol"))
            except (TypeError, ValueError):
                return None
            maximum = await self._ws_lay_am_luong_toi_da()
            if maximum is None:
                maximum = 100
            return VolumeInfo(current=current, minimum=0, maximum=maximum)

        output = await self.async_do_cmd("media volume --stream 3 --get")
        match = _VOLUME_RE.search(output)
        if not match:
            return None
        return VolumeInfo(
            current=int(match.group("current")),
            minimum=int(match.group("min")),
            maximum=int(match.group("max")),
        )

    async def async_get_playback_state(self) -> str | None:
        """Get playback state."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            info = await self._ws_lay_thong_tin()
            state_text = str(info.get("state") or "").strip().lower()
            playing_hint: bool | None = None
            for key in ("is_playing", "play_state", "state"):
                if key in info:
                    parsed = self._aibox_phan_tich_co_dang_phat(info.get(key))
                    if parsed is not None:
                        playing_hint = parsed
                        break
            if playing_hint is True:
                return "playing"
            if playing_hint is False:
                if state_text in {"stopped", "stop", "idle", "off"}:
                    return "stopped"
                return "paused"
            return None

        output = await self.async_do_cmd("dumpsys media_session")
        match = _PLAYBACK_STATE_RE.search(output)
        if not match:
            return None

        code = int(match.group("state"))
        if code == 3:
            return "playing"
        if code == 2:
            return "paused"
        if code == 1:
            return "stopped"
        return None

    async def async_set_absolute_volume(self, target: int) -> None:
        """Set absolute volume index."""
        target = int(target)
        if self._protocol == PROTOCOL_WS_NATIVE:
            await self._ws_dat_am_luong(target)
            return
        await self.async_do_cmd(f"media volume --stream 3 --set {target}")

    async def async_get_status_snapshot(self) -> dict[str, Any]:
        """Get unified status snapshot for coordinator update."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            info = await self._ws_lay_thong_tin()
            max_vol = await self._ws_lay_am_luong_toi_da()
            if max_vol is None:
                max_vol = 100

            state_text = str(info.get("state") or "").strip().lower()
            playing_hint: bool | None = None
            for key in ("is_playing", "play_state", "state"):
                if key in info:
                    parsed = self._aibox_phan_tich_co_dang_phat(info.get(key))
                    if parsed is not None:
                        playing_hint = parsed
                        break

            if playing_hint is True:
                playback_state = "playing"
            elif playing_hint is False:
                playback_state = (
                    "stopped" if state_text in {"stopped", "stop", "idle", "off"} else "paused"
                )
            else:
                playback_state = None

            volume_current = None
            try:
                volume_current = int(info.get("vol"))
            except (TypeError, ValueError):
                volume_current = None

            return {
                "model": str(info.get("device_name") or info.get("dev_name") or "ESP32 AIBox"),
                "playback_state": playback_state,
                "volume_current": volume_current,
                "volume_min": 0,
                "volume_max": int(max_vol),
                "raw": info,
            }

        model = await self.async_get_model()
        volume = await self.async_get_volume()
        playback_state = await self.async_get_playback_state()
        return {
            "model": model,
            "playback_state": playback_state,
            "volume_current": volume.current if volume else None,
            "volume_min": volume.minimum if volume else None,
            "volume_max": volume.maximum if volume else None,
            "raw": {
                "model": model,
                "playback_state": playback_state,
            },
        }

    async def async_ws_send_payload(
        self,
        payload: dict[str, Any],
        expect_type: str | None = None,
    ) -> dict[str, Any]:
        """Send generic payload in ws_native mode."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Generic WS payload is only available in ws_native mode")
        if expect_type:
            response = await self._ws_gui_va_cho(payload, expect_type=expect_type)
            self._ws_kiem_tra_ma(response)
            return response
        await self._ws_chi_gui(payload)
        return {"status": "sent"}

    async def async_send_message(
        self,
        what: int,
        arg1: int,
        arg2: int = -1,
        obj: Any = True,
        type_id: str | None = None,
    ) -> None:
        """Send native WS `send_message` payload."""
        payload: dict[str, Any] = {
            "type": "send_message",
            "what": int(what),
            "arg1": int(arg1),
            "arg2": int(arg2),
            "obj": obj,
        }
        if type_id:
            payload["type_id"] = type_id
        if self._protocol == PROTOCOL_WS_NATIVE:
            await self._ws_chi_gui(payload)
            return
        raise Esp32AiboxApiResponseError("send_message is only available in ws_native mode")

    async def async_shell(self, command: str, type_id: str = "myshell") -> str:
        """Run shell command using ws_native shell message."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            response = await self._ws_gui_va_cho(
                {"type": "shell", "type_id": type_id, "shell": command},
                expect_type="shell",
            )
            self._ws_kiem_tra_ma(response)
            return str(response.get("data", "")).strip()
        return await self.async_do_cmd(command)

    async def async_set_dlna(self, enabled: bool) -> dict[str, Any]:
        """Enable/disable DLNA autostart."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("DLNA control is only available in ws_native mode")
        desired = bool(enabled)
        await self._ws_chi_gui(
            {
                "type": "Set_DLNA_Open",
                "open": 1 if desired else 0,
                "type_id": (
                    "Allow DLNA service to start"
                    if desired
                    else "Prohibit DLNA service from starting"
                ),
            }
        )
        return await self._ws_yeu_cau_dieu_kien(
            predicate=lambda info: self._aibox_phan_tich_bool(info.get("dlna_open")) == desired,
            timeout=5.0,
            interval=0.25,
            error_label="DLNA",
        )

    async def async_set_airplay(self, enabled: bool) -> dict[str, Any]:
        """Enable/disable AirPlay autostart."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("AirPlay control is only available in ws_native mode")
        desired = bool(enabled)
        await self._ws_chi_gui(
            {
                "type": "Set_AirPlay_Open",
                "open": 1 if desired else 0,
                "type_id": (
                    "Allow AirPlay service to start"
                    if desired
                    else "Prohibit AirPlay service from starting"
                ),
            }
        )
        return await self._ws_yeu_cau_dieu_kien(
            predicate=lambda info: self._aibox_phan_tich_bool(info.get("airplay_open")) == desired,
            timeout=5.0,
            interval=0.25,
            error_label="AirPlay",
        )

    async def async_set_bluetooth(self, enabled: bool) -> dict[str, Any]:
        """Enable/disable bluetooth."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Bluetooth control is only available in ws_native mode")
        desired = bool(enabled)
        await self.async_send_message(
            what=64,
            arg1=1 if desired else 2,
            arg2=-1,
            obj=True,
            type_id="Open Bluetooth" if desired else "Close Bluetooth",
        )
        return await self._ws_yeu_cau_dieu_kien(
            predicate=lambda info: self._ws_la_bluetooth_bat(info.get("device_state")) == desired,
            timeout=9.0,
            interval=0.3,
            error_label="Bluetooth",
        )

    async def async_set_main_light(self, enabled: bool) -> dict[str, Any]:
        """Enable/disable ambient main light."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Light control is only available in ws_native mode")
        desired = bool(enabled)
        await self.async_send_message(what=4, arg1=64, arg2=1 if desired else 0, obj=True)
        return await self._ws_yeu_cau_dieu_kien(
            predicate=lambda info: self._aibox_phan_tich_bool(info.get("music_light_enable")) == desired,
            timeout=6.0,
            interval=0.25,
            error_label="Main light",
        )

    async def async_set_light_mode(self, mode: int) -> None:
        """Set light effect mode."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Light control is only available in ws_native mode")
        await self.async_send_message(what=4, arg1=68, arg2=int(mode), obj=True)

    async def async_set_light_speed(self, speed: int) -> None:
        """Set light speed in range 1..100."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Light control is only available in ws_native mode")
        await self.async_send_message(what=4, arg1=66, arg2=int(speed), obj=True)

    async def async_set_light_brightness(self, brightness: int) -> None:
        """Set light brightness in range 1..200."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Light control is only available in ws_native mode")
        await self.async_send_message(what=4, arg1=65, arg2=int(brightness), obj=True)

    async def async_set_edge_light(self, enabled: bool, intensity: int | None = None) -> None:
        """Set edge white light via shell command."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Edge light control is only available in ws_native mode")
        if not enabled:
            await self.async_shell("lights_test set 7fffff8000 0", type_id="Turn on light")
            return
        if intensity is None:
            await self.async_shell("lights_test set 7fffff8000 ffffff", type_id="Turn on light")
            return
        val = max(0, min(255, int(round(intensity * 255 / 100))))
        hex_pair = f"{val:02x}"
        await self.async_shell(
            f"lights_test set 7fffff8000 {hex_pair}{hex_pair}{hex_pair}",
            type_id="Turn on light",
        )

    async def async_set_bass_enable(self, enabled: bool) -> None:
        """Toggle bass enhancement."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Bass control is only available in ws_native mode")
        await self._ws_chi_gui({"type": "set_bass_enable", "enable": bool(enabled)})

    async def async_set_bass_strength(self, strength: int) -> None:
        """Set bass strength."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Bass control is only available in ws_native mode")
        await self._ws_chi_gui({"type": "set_bass_strength", "strength": int(strength)})

    async def async_set_loudness_enable(self, enabled: bool) -> None:
        """Toggle loudness."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Loudness control is only available in ws_native mode")
        await self._ws_chi_gui({"type": "set_loudness_enable", "enable": bool(enabled)})

    async def async_set_loudness_gain(self, gain: int) -> None:
        """Set loudness gain."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Loudness control is only available in ws_native mode")
        await self._ws_chi_gui({"type": "set_loudness_gain", "gain": int(gain)})

    async def async_set_eq_enable(self, enabled: bool) -> None:
        """Toggle EQ."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("EQ control is only available in ws_native mode")
        await self._ws_chi_gui({"type": "set_eq_enable", "enable": bool(enabled)})

    async def async_set_eq_bandlevel(self, band: int, level: int) -> None:
        """Set EQ band level."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("EQ control is only available in ws_native mode")
        await self._ws_chi_gui({"type": "set_eq_bandlevel", "band": int(band), "level": int(level)})

    async def async_set_mixer_value(self, control_name: str, value: int) -> None:
        """Set mixer value."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Mixer control is only available in ws_native mode")
        await self._ws_chi_gui(
            {
                "type": "sends",
                "list": [
                    {"type": "setMixerValue", "controlName": control_name, "value": str(int(value))},
                    {"type": "get_eq_config"},
                ],
            }
        )

    async def async_set_play_mode(self, mode: int) -> None:
        """Set player mode (e.g. repeat/shuffle)."""
        if self._protocol != PROTOCOL_WS_NATIVE:
            raise Esp32AiboxApiResponseError("Play mode is only available in ws_native mode")
        await self._ws_chi_gui({"type": "set_play_mode", "mode": int(mode)})

    @staticmethod
    def _dam_bao_khong_rong(value: str, field_name: str) -> str:
        """Validate and normalize required text fields."""
        normalized = (value or "").strip()
        if not normalized:
            raise Esp32AiboxApiResponseError(f"{field_name} cannot be empty")
        return normalized

    async def async_search_youtube(self, query: str) -> dict[str, Any]:
        """Search songs on YouTube via AiboxPlus WS API."""
        normalized_query = self._dam_bao_khong_rong(query, "query")
        request = {"action": "search_songs", "query": normalized_query}
        last_err: Exception | None = None
        for _ in range(2):
            try:
                return await self._aibox_gui_va_cho(request, expect_type="search_result")
            except Esp32AiboxApiConnectionError as err:
                last_err = err
                await asyncio.sleep(0.35)
                continue
        _LOGGER.debug("YouTube search fallback after retries: %s", last_err)
        with suppress(Esp32AiboxApiConnectionError):
            await self._aibox_chi_gui(request)
        return {"success": False, "type": "search_result", "songs": []}

    async def async_search_playlist(self, query: str) -> dict[str, Any]:
        """Search playlists on YouTube via AiboxPlus WS API."""
        normalized_query = self._dam_bao_khong_rong(query, "query")
        request = {"action": "search_playlist", "query": normalized_query}
        last_err: Exception | None = None
        for _ in range(2):
            try:
                return await self._aibox_gui_va_cho(request, expect_type="playlist_result")
            except Esp32AiboxApiConnectionError as err:
                last_err = err
                await asyncio.sleep(0.35)
                continue
        _LOGGER.debug("Playlist search fallback after retries: %s", last_err)
        with suppress(Esp32AiboxApiConnectionError):
            await self._aibox_chi_gui(request)
        return {"success": False, "type": "playlist_result", "songs": []}

    async def async_search_zing(self, query: str) -> dict[str, Any]:
        """Search songs on Zing MP3 via AiboxPlus WS API."""
        normalized_query = self._dam_bao_khong_rong(query, "query")
        request = {"action": "search_zing", "query": normalized_query}
        last_err: Exception | None = None
        for _ in range(2):
            try:
                return await self._aibox_gui_va_cho(request, expect_type="zing_result")
            except Esp32AiboxApiConnectionError as err:
                last_err = err
                await asyncio.sleep(0.35)
                continue
        _LOGGER.debug("Zing search fallback after retries: %s", last_err)
        with suppress(Esp32AiboxApiConnectionError):
            await self._aibox_chi_gui(request)
        return {"success": False, "type": "zing_result", "songs": []}

    async def async_play_youtube(self, video_id: str) -> None:
        """Play YouTube media by video id via AiboxPlus WS API."""
        normalized_video_id = self._dam_bao_khong_rong(video_id, "video_id")
        await self._aibox_chi_gui({"action": "play_song", "video_id": normalized_video_id})
        self._aibox_cap_nhat_bo_nho_phat(
            {
                "is_playing": True,
                "play_state": 1,
                "state": "playing",
                "position": 0,
                "source": "youtube",
                "type": "playback_state",
            },
            "playback_state",
        )

    async def async_play_zing(self, song_id: str) -> None:
        """Play Zing MP3 song by song id via AiboxPlus WS API."""
        normalized_song_id = self._dam_bao_khong_rong(song_id, "song_id")
        await self._aibox_chi_gui({"action": "play_zing", "song_id": normalized_song_id})
        self._aibox_cap_nhat_bo_nho_phat(
            {
                "is_playing": True,
                "play_state": 1,
                "state": "playing",
                "position": 0,
                "source": "zingmp3",
                "type": "playback_state",
            },
            "playback_state",
        )

    async def async_aibox_media_action(self, action: str) -> None:
        """Control AiboxPlus playback channel (YouTube/Zing)."""
        action_aliases: dict[str, list[str]] = {
            "play": ["resume", "play"],
            "pause": ["pause"],
            "toggle": ["play_pause"],
            "stop": ["stop", "stop_song"],
            "next": ["next", "next_song"],
            "previous": ["previous", "prev_song"],
        }
        aliases = action_aliases.get(action)
        if not aliases:
            raise Esp32AiboxApiResponseError(f"Unsupported AiboxPlus media action: {action}")
        last_err: Exception | None = None
        sent_ok = False
        for alias in aliases:
            payload_options = (
                {"action": alias},
                {"type": alias},
            )
            for payload in payload_options:
                try:
                    await self._aibox_chi_gui(payload)
                    _LOGGER.debug("Aibox media action sent: %s via payload %s", action, payload)
                    sent_ok = True
                except Esp32AiboxApiConnectionError as err:
                    last_err = err
                    _LOGGER.debug("Aibox media action send failed: %s via payload %s", action, payload)
                    continue

        if sent_ok:
            if action == "play":
                self._aibox_cap_nhat_bo_nho_phat(
                    {"is_playing": True, "play_state": 1, "state": "playing", "type": "playback_state"},
                    "playback_state",
                )
            elif action == "pause":
                self._aibox_cap_nhat_bo_nho_phat(
                    {"is_playing": False, "play_state": 0, "state": "paused", "type": "playback_state"},
                    "playback_state",
                )
            elif action == "stop":
                self._aibox_cap_nhat_bo_nho_phat(
                    {"is_playing": False, "play_state": 0, "state": "stopped", "type": "playback_state"},
                    "playback_state",
                )
            return

        if last_err is not None:
            raise last_err

    async def async_wake_word_set_enabled(self, enabled: bool) -> dict[str, Any]:
        """Enable/disable wake word detection."""
        desired = bool(enabled)
        request = {"action": "wake_word_set_enabled", "enabled": desired}
        response: dict[str, Any] = {}
        try:
            response = await self._aibox_gui_va_cho(
                request,
                expect_type={"wake_word_set_enabled_result", "wake_word_enabled_state"},
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
        try:
            verify = await self._aibox_yeu_cau_trang_thai_bool(
                fetch_state=self.async_wake_word_get_enabled,
                expected=desired,
                field_names=("enabled", "enable", "state"),
                timeout=5.0,
                interval=0.25,
                error_label="Wake word",
            )
            if "type" not in verify and "type" in response:
                verify["type"] = response.get("type")
            return verify
        except Esp32AiboxApiResponseError as err:
            _LOGGER.debug("Wake word confirmation timeout; fallback to optimistic state: %s", err)
            return {
                "type": "wake_word_set_enabled_result",
                "enabled": desired,
                "success": True,
                "unverified": True,
            }

    async def async_wake_word_get_enabled(self) -> dict[str, Any]:
        """Query wake word enabled state."""
        cached = self._aibox_lay_cache('wake_word', max_age=12.0)
        if cached and any(key in cached for key in ('enabled', 'enable', 'state')):
            return cached
        request = {"action": "wake_word_get_enabled"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"wake_word_get_enabled_result", "wake_word_enabled_state"},
            )
            self._aibox_luu_cache('wake_word', result)
            return result
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "wake_word_enabled_state", "success": False}

    async def async_wake_word_set_sensitivity(self, sensitivity: float) -> dict[str, Any]:
        """Set wake word sensitivity (0..1)."""
        request = {"action": "wake_word_set_sensitivity", "sensitivity": float(sensitivity)}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"wake_word_set_sensitivity_result", "wake_word_sensitivity_state"},
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {
                "type": "wake_word_set_sensitivity_result",
                "sensitivity": float(sensitivity),
                "success": True,
            }

    async def async_wake_word_get_sensitivity(self) -> dict[str, Any]:
        """Query wake word sensitivity."""
        cached = self._aibox_lay_cache('wake_word', max_age=12.0)
        if cached and any(key in cached for key in ('sensitivity', 'value')):
            return cached
        request = {"action": "wake_word_get_sensitivity"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"wake_word_get_sensitivity_result", "wake_word_sensitivity_state"},
            )
            merged = self._aibox_lay_cache('wake_word') or {}
            merged.update(result)
            self._aibox_luu_cache('wake_word', merged)
            return result
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "wake_word_sensitivity_state", "success": False}

    async def async_custom_ai_set_enabled(self, enabled: bool) -> dict[str, Any]:
        """Enable/disable custom AI (chống điếc AI)."""
        desired = bool(enabled)
        request = {"action": "custom_ai_set_enabled", "enabled": desired}
        response: dict[str, Any] = {}
        try:
            response = await self._aibox_gui_va_cho(
                request,
                expect_type={"custom_ai_set_enabled_result", "custom_ai_enabled_state"},
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
        try:
            verify = await self._aibox_yeu_cau_trang_thai_bool(
                fetch_state=self.async_custom_ai_get_enabled,
                expected=desired,
                field_names=("enabled", "enable", "state"),
                timeout=5.0,
                interval=0.25,
                error_label="Custom AI",
            )
            if "type" not in verify and "type" in response:
                verify["type"] = response.get("type")
            return verify
        except Esp32AiboxApiResponseError as err:
            _LOGGER.debug("Custom AI confirmation timeout; fallback to optimistic state: %s", err)
            return {
                "type": "custom_ai_set_enabled_result",
                "enabled": desired,
                "success": True,
                "unverified": True,
            }

    async def async_custom_ai_get_enabled(self) -> dict[str, Any]:
        """Query custom AI enabled state."""
        cached = self._aibox_lay_cache('custom_ai', max_age=12.0)
        if cached and any(key in cached for key in ('enabled', 'enable', 'state')):
            return cached
        request = {"action": "custom_ai_get_enabled"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"custom_ai_get_enabled_result", "custom_ai_enabled_state"},
            )
            self._aibox_luu_cache('custom_ai', result)
            return result
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "custom_ai_enabled_state", "success": False}

    async def async_chat_wake_up(self) -> dict[str, Any]:
        """Trigger chat wake up."""
        request = {"action": "chat_wake_up"}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"chat_state", "chat_send_result", "chat_wake_up_result"},
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "chat_state", "success": False}

    async def async_chat_test_mic(self) -> dict[str, Any]:
        """Trigger microphone test."""
        request = {"action": "chat_test_mic"}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"test_mic_state", "chat_state", "chat_test_mic_result"},
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "test_mic_state", "success": False}

    async def async_chat_get_state(self) -> dict[str, Any]:
        """Get current chat/wake-up state."""
        cached = self._aibox_lay_cache('chat_state', max_age=8.0)
        if cached and any(key in cached for key in ('state', 'chat_state', 'status', 'button_text', 'buttonText', 'button_enabled', 'buttonEnabled')):
            return cached
        request = {"action": "chat_get_state"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"chat_state", "chat_get_state_result"},
            )
            self._aibox_luu_cache('chat_state', result)
            return result
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "chat_state", "success": False}

    async def async_chat_send_text(self, text: str) -> dict[str, Any]:
        """Send text message to chat pipeline and wait for ack/first message."""
        normalized_text = self._dam_bao_khong_rong(text, "text")
        request = {"action": "chat_send_text", "text": normalized_text}
        try:
            messages = await self._aibox_gui_va_thu_thap(
                request,
                collect_types={"chat_send_result", "chat_message", "chat_text_result"},
                first_timeout=20.0,
                collect_window=1.2,
                max_items=20,
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"items": []}
        return {"items": messages}

    async def async_chat_get_history(self) -> dict[str, Any]:
        """Load recent chat history from server."""
        request = {"action": "chat_get_history"}
        try:
            messages = await self._aibox_gui_va_thu_thap(
                request,
                collect_types={"chat_message", "chat_history_result", "chat_history_item"},
                first_timeout=12.0,
                collect_window=1.5,
                max_items=100,
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"items": []}
        return {"items": messages}


    async def async_tiktok_reply_toggle(self, enabled: bool) -> dict[str, Any]:
        """Enable/disable TikTok auto reply."""
        request = {"action": "tiktok_reply_toggle", "enabled": bool(enabled)}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"tiktok_reply_toggle_result", "tiktok_reply_state"},
                timeout=8.0,
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "tiktok_reply_toggle_result", "enabled": bool(enabled), "success": False}

    async def async_upload_chat_background(self, image: str) -> dict[str, Any]:
        """Upload chat background image as base64."""
        normalized_image = self._dam_bao_khong_rong(image, "image")
        request = {"action": "upload_chat_background", "image": normalized_image}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"upload_chat_background_result"},
                timeout=20.0,
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "upload_chat_background_result", "success": False}

    async def async_get_chat_background(self) -> dict[str, Any]:
        """Get current chat background image from device."""
        request = {"action": "get_chat_background"}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"get_chat_background_result"},
                timeout=15.0,
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "get_chat_background_result", "success": False, "image": ""}

    async def async_remove_chat_background(self) -> dict[str, Any]:
        """Remove chat background image from device."""
        request = {"action": "remove_chat_background"}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"remove_chat_background_result"},
                timeout=10.0,
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return {"type": "remove_chat_background_result", "success": False}

    # --------------------------------
    # New feature methods (AiboxPlus)
    # --------------------------------

    async def async_aibox_get_playback_state(self) -> dict[str, Any]:
        """Poll current playback state from AiboxPlus."""
        cached = self._aibox_lay_cache('aibox_playback', max_age=4.0)
        if cached:
            return cached
        request = {"action": "get_playback_state"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"playback_state", "music_state", "player_state", "play_state"},
                timeout=5.0,
            )
            self._aibox_cap_nhat_bo_nho_phat(result, self._aibox_loai_tin_nhan(result))
            self._aibox_luu_cache('aibox_playback', self.get_last_aibox_playback() or result)
            return result
        except Esp32AiboxApiConnectionError:
            return dict(self._last_aibox_playback)

    async def async_aibox_seek(self, position: int) -> None:
        """Seek to position (seconds) in current AiboxPlus playback."""
        await self._aibox_chi_gui({"action": "seek", "position": int(position)})
        if self._last_aibox_playback:
            self._last_aibox_playback["position"] = int(position)

    async def async_aibox_toggle_repeat(self) -> dict[str, Any]:
        """Toggle repeat mode on AiboxPlus."""
        request = {"action": "toggle_repeat"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"repeat_state", "toggle_repeat_result", "playback_state"},
                timeout=5.0,
            )
            if "repeat_enabled" in result:
                self._last_aibox_playback["repeat_enabled"] = result["repeat_enabled"]
            return result
        except Esp32AiboxApiConnectionError:
            await self._aibox_chi_gui(request)
            current = self._last_aibox_playback.get("repeat_enabled", False)
            self._last_aibox_playback["repeat_enabled"] = not current
            return {"repeat_enabled": not current}

    async def async_aibox_toggle_auto_next(self) -> dict[str, Any]:
        """Toggle auto-next mode on AiboxPlus."""
        request = {"action": "toggle_auto_next"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"auto_next_state", "toggle_auto_next_result", "playback_state"},
                timeout=5.0,
            )
            if "auto_next_enabled" in result:
                self._last_aibox_playback["auto_next_enabled"] = result["auto_next_enabled"]
            return result
        except Esp32AiboxApiConnectionError:
            await self._aibox_chi_gui(request)
            current = self._last_aibox_playback.get("auto_next_enabled", True)
            self._last_aibox_playback["auto_next_enabled"] = not current
            return {"auto_next_enabled": not current}

    async def async_led_toggle(self) -> dict[str, Any]:
        """Toggle LED on/off via AiboxPlus."""
        request = {"action": "led_toggle"}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"led_state", "led_toggle_result"},
                timeout=5.0,
            )
        except Esp32AiboxApiConnectionError:
            await self._aibox_chi_gui(request)
            return {"type": "led_toggle_result", "success": True}

    async def async_led_get_state(self) -> dict[str, Any]:
        """Get LED state from AiboxPlus."""
        cached = self._aibox_lay_cache('led_state', max_age=10.0)
        if cached and 'enabled' in cached:
            return cached
        request = {"action": "led_get_state"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"led_state", "led_get_state_result"},
                timeout=5.0,
            )
            self._aibox_luu_cache('led_state', result)
            return result
        except Esp32AiboxApiConnectionError:
            return {"type": "led_state", "success": False}

    async def async_stereo_get_state(self) -> dict[str, Any]:
        """Get stereo pairing state from AiboxPlus."""
        request = {"action": "stereo_get_state"}
        try:
            result = await self._aibox_gui_va_cho(
                request,
                expect_type={"stereo_state", "stereo_get_state_result"},
                timeout=5.0,
            )
            self._aibox_luu_cache('stereo_state', result)
            return result
        except Esp32AiboxApiConnectionError:
            return {"type": "stereo_state", "success": False}

    async def async_stereo_enable(self) -> dict[str, Any]:
        """Enable stereo pairing mode."""
        request = {"action": "stereo_enable"}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"stereo_state", "stereo_enable_result"},
                timeout=8.0,
            )
        except Esp32AiboxApiConnectionError:
            await self._aibox_chi_gui(request)
            return {"type": "stereo_enable_result", "success": True}

    async def async_stereo_disable(self) -> dict[str, Any]:
        """Disable stereo pairing mode."""
        request = {"action": "stereo_disable"}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"stereo_state", "stereo_disable_result"},
                timeout=5.0,
            )
        except Esp32AiboxApiConnectionError:
            await self._aibox_chi_gui(request)
            return {"type": "stereo_disable_result", "success": True}

    async def async_stereo_set_channel(self, channel: str) -> dict[str, Any]:
        """Set stereo channel (left/right)."""
        request = {"action": "stereo_set_channel", "channel": channel}
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type={"stereo_state", "stereo_set_channel_result"},
                timeout=5.0,
            )
        except Esp32AiboxApiConnectionError:
            await self._aibox_chi_gui(request)
            return {"type": "stereo_set_channel_result", "channel": channel, "success": True}

    async def async_stereo_enable_receiver(self) -> dict[str, Any]:
        """Enable stereo receiver/slave mode."""
        return await self._aibox_request_action(
            "stereo_enable_receiver",
            expect_type={"stereo_state", "stereo_receiver_enable_result", "stereo_enable_receiver_result"},
            fallback={"type": "stereo_receiver_enable_result", "receiver_enabled": True, "success": True},
        )

    async def async_stereo_disable_receiver(self) -> dict[str, Any]:
        """Disable stereo receiver/slave mode."""
        return await self._aibox_request_action(
            "stereo_disable_receiver",
            expect_type={"stereo_state", "stereo_receiver_disable_result", "stereo_disable_receiver_result"},
            fallback={"type": "stereo_receiver_disable_result", "receiver_enabled": False, "success": True},
        )

    async def async_stereo_set_sync_delay(self, sync_delay_ms: int) -> dict[str, Any]:
        """Set stereo synchronization delay in milliseconds."""
        return await self._aibox_request_action(
            "stereo_set_sync_delay",
            payload={"sync_delay_ms": int(sync_delay_ms)},
            expect_type={"stereo_state", "stereo_set_sync_delay_result"},
            fallback={"type": "stereo_set_sync_delay_result", "sync_delay_ms": int(sync_delay_ms), "success": True},
        )

    async def _aibox_request_action(
        self,
        action: str,
        *,
        payload: dict[str, Any] | None = None,
        expect_type: str | set[str] | None = None,
        timeout: float = 8.0,
        fallback: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Send an AiboxPlus action and return a normalized response."""
        request: dict[str, Any] = {"action": action}
        if payload:
            request.update({key: value for key, value in payload.items() if value is not None})
        try:
            return await self._aibox_gui_va_cho(
                request,
                expect_type=expect_type,
                timeout=timeout,
            )
        except Esp32AiboxApiConnectionError:
            with suppress(Esp32AiboxApiConnectionError):
                await self._aibox_chi_gui(request)
            return dict(fallback or {"type": f"{action}_result", "success": False})

    async def async_alarm_list(self) -> dict[str, Any]:
        """Get configured alarms from AiboxPlus."""
        return await self._aibox_request_action(
            "alarm_list",
            expect_type={"alarm_list"},
            timeout=8.0,
            fallback={"type": "alarm_list", "success": False, "alarms": []},
        )

    async def async_alarm_stop(self) -> dict[str, Any]:
        """Stop the active alarm."""
        return await self._aibox_request_action(
            "alarm_stop",
            expect_type={"alarm_stopped"},
            timeout=5.0,
            fallback={"type": "alarm_stopped", "success": True, "active": False, "unverified": True},
        )

    async def async_alarm_add(
        self,
        *,
        hour: int,
        minute: int,
        repeat: str = "none",
        label: str = "",
        volume: int = 100,
        custom_sound_path: str | None = None,
        youtube_song_name: str | None = None,
        selected_days: list[str] | None = None,
    ) -> dict[str, Any]:
        """Add a new alarm on AiboxPlus."""
        payload: dict[str, Any] = {
            "hour": int(hour),
            "minute": int(minute),
            "repeat": str(repeat or "none"),
            "label": str(label or ""),
            "volume": int(volume),
        }
        if custom_sound_path is not None:
            payload["custom_sound_path"] = str(custom_sound_path)
        if youtube_song_name is not None:
            payload["youtube_song_name"] = str(youtube_song_name)
        if selected_days is not None:
            payload["selected_days"] = list(selected_days)
        return await self._aibox_request_action(
            "alarm_add",
            payload=payload,
            expect_type={"alarm_added", "alarm_add_result"},
            timeout=10.0,
            fallback={"type": "alarm_added", "success": True, "unverified": True, **payload},
        )

    async def async_alarm_edit(
        self,
        *,
        alarm_id: str,
        hour: int,
        minute: int,
        repeat: str = "none",
        label: str = "",
        volume: int = 100,
        custom_sound_path: str | None = None,
        youtube_song_name: str | None = None,
        selected_days: list[str] | None = None,
    ) -> dict[str, Any]:
        """Edit an existing alarm on AiboxPlus."""
        payload: dict[str, Any] = {
            "alarm_id": str(alarm_id),
            "hour": int(hour),
            "minute": int(minute),
            "repeat": str(repeat or "none"),
            "label": str(label or ""),
            "volume": int(volume),
        }
        if custom_sound_path is not None:
            payload["custom_sound_path"] = str(custom_sound_path)
        if youtube_song_name is not None:
            payload["youtube_song_name"] = str(youtube_song_name)
        if selected_days is not None:
            normalized_days = list(selected_days)
            payload["selected_days"] = None if len(normalized_days) == 0 or normalized_days == ["__CLEAR__"] else normalized_days
        return await self._aibox_request_action(
            "alarm_edit",
            payload=payload,
            expect_type={"alarm_edited", "alarm_edit_result"},
            timeout=10.0,
            fallback={"type": "alarm_edited", "success": True, "unverified": True, **payload},
        )

    async def async_alarm_delete(self, alarm_id: str) -> dict[str, Any]:
        """Delete one alarm from AiboxPlus."""
        normalized_alarm_id = self._dam_bao_khong_rong(str(alarm_id), "alarm_id")
        return await self._aibox_request_action(
            "alarm_delete",
            payload={"alarm_id": normalized_alarm_id},
            expect_type={"alarm_deleted", "alarm_delete_result"},
            timeout=8.0,
            fallback={"type": "alarm_deleted", "success": True, "alarm_id": normalized_alarm_id, "unverified": True},
        )

    async def async_alarm_toggle(self, alarm_id: str) -> dict[str, Any]:
        """Toggle one alarm from AiboxPlus."""
        normalized_alarm_id = self._dam_bao_khong_rong(str(alarm_id), "alarm_id")
        return await self._aibox_request_action(
            "alarm_toggle",
            payload={"alarm_id": normalized_alarm_id},
            expect_type={"alarm_toggled", "alarm_toggle_result"},
            timeout=8.0,
            fallback={"type": "alarm_toggled", "success": True, "alarm_id": normalized_alarm_id, "unverified": True},
        )

    async def async_alarm_upload_sound(
        self,
        *,
        file_name: str,
        file_data: str,
        alarm_id: int = -1,
    ) -> dict[str, Any]:
        """Upload a custom alarm sound to AiboxPlus."""
        normalized_file_name = self._dam_bao_khong_rong(file_name, "file_name")
        normalized_file_data = self._dam_bao_khong_rong(file_data, "file_data")
        return await self._aibox_request_action(
            "alarm_upload_sound",
            payload={
                "alarm_id": int(alarm_id),
                "file_name": normalized_file_name,
                "file_data": normalized_file_data,
            },
            expect_type={"alarm_sound_uploaded"},
            timeout=30.0,
            fallback={
                "type": "alarm_sound_uploaded",
                "success": True,
                "file_path": normalized_file_name,
                "unverified": True,
            },
        )

    async def async_ota_get(self) -> dict[str, Any]:
        """Get OTA configuration from AiboxPlus."""
        return await self._aibox_request_action(
            "ota_get",
            expect_type={"ota_config", "ota_get_result"},
            timeout=6.0,
            fallback={"type": "ota_get_result", "success": False},
        )

    async def async_ota_set(self, ota_url: str) -> dict[str, Any]:
        """Set OTA URL on AiboxPlus."""
        return await self._aibox_request_action(
            "ota_set",
            payload={"ota_url": str(ota_url or "").strip()},
            expect_type={"ota_set_result", "ota_config"},
            timeout=6.0,
            fallback={"type": "ota_set_result", "success": True, "ota_url": str(ota_url or "").strip(), "unverified": True},
        )

    async def async_mac_get(self) -> dict[str, Any]:
        """Get MAC information from AiboxPlus."""
        return await self._aibox_request_action(
            "mac_get",
            expect_type={"mac_get"},
            timeout=6.0,
            fallback={"type": "mac_get", "success": False},
        )

    async def async_mac_random(self) -> dict[str, Any]:
        """Generate and store a random MAC on AiboxPlus."""
        return await self._aibox_request_action(
            "mac_random",
            expect_type={"mac_random"},
            timeout=8.0,
            fallback={"type": "mac_random", "success": True, "unverified": True},
        )

    async def async_mac_clear(self) -> dict[str, Any]:
        """Clear custom MAC and restore hardware MAC on AiboxPlus."""
        return await self._aibox_request_action(
            "mac_clear",
            expect_type={"mac_clear"},
            timeout=6.0,
            fallback={"type": "mac_clear", "success": True, "unverified": True},
        )

    async def async_hass_get(self) -> dict[str, Any]:
        """Get Home Assistant bridge configuration from AiboxPlus."""
        return await self._aibox_request_action(
            "hass_get",
            expect_type={"hass_config", "hass_get_result"},
            timeout=6.0,
            fallback={"type": "hass_get_result", "success": False},
        )

    async def async_hass_set(self, *, url: str = "", api_key: str | None = None, agent_id: str = "") -> dict[str, Any]:
        """Set Home Assistant bridge configuration on AiboxPlus."""
        payload: dict[str, Any] = {"url": str(url or "").strip(), "agent_id": str(agent_id or "").strip()}
        if api_key is not None:
            payload["api_key"] = str(api_key)
        return await self._aibox_request_action(
            "hass_set",
            payload=payload,
            expect_type={"hass_set_result", "hass_config"},
            timeout=8.0,
            fallback={"type": "hass_set_result", "success": True, "configured": bool(payload.get("url") and (payload.get("api_key") or "")), "unverified": True, **payload},
        )

    async def async_weather_province_get(self) -> dict[str, Any]:
        """Get stored weather province from AiboxPlus."""
        return await self._aibox_request_action(
            "weather_province_get",
            expect_type={"weather_province_state", "weather_province_get_result"},
            timeout=6.0,
            fallback={"type": "weather_province_get_result", "success": False},
        )

    async def async_weather_province_set(self, *, name: str = "", lat: float = 0, lon: float = 0) -> dict[str, Any]:
        """Store weather province on AiboxPlus."""
        payload = {"name": str(name or "").strip(), "lat": float(lat), "lon": float(lon)}
        return await self._aibox_request_action(
            "weather_province_set",
            payload=payload,
            expect_type={"weather_province_set_result", "weather_province_state"},
            timeout=8.0,
            fallback={"type": "weather_province_set_result", "success": True, "unverified": True, **payload},
        )

    async def async_wifi_scan(self) -> dict[str, Any]:
        """Scan nearby WiFi networks on AiboxPlus."""
        payload = {"action": "wifi_scan"}
        with suppress(Esp32AiboxApiConnectionError):
            live_result = await self._aibox_wifi_live_action(
                payload,
                predicate=lambda cached, before: int(cached.get("updated_at_ms") or 0) > before and isinstance(cached.get("scanned_networks"), list),
                timeout=14.0,
            )
            if live_result is not None:
                return {
                    "type": "wifi_scan_result",
                    "success": True,
                    "networks": list(live_result.get("scanned_networks") or []),
                    "updated_at_ms": live_result.get("updated_at_ms"),
                    "from_live_cache": True,
                }
        return await self._aibox_request_action(
            "wifi_scan",
            expect_type={"wifi_scan_result"},
            timeout=14.0,
            fallback={"type": "wifi_scan_result", "success": False, "networks": []},
        )

    async def async_wifi_connect(
        self,
        *,
        ssid: str | None = None,
        password: str | None = None,
        security_type: str | None = None,
        network_id: int | None = None,
    ) -> dict[str, Any]:
        """Connect to WiFi on AiboxPlus."""
        normalized_ssid = str(ssid or "").strip()
        if not normalized_ssid and network_id is None:
            raise Esp32AiboxApiResponseError("ssid or network_id is required")
        payload: dict[str, Any] = {
            "action": "wifi_connect",
            "ssid": normalized_ssid,
            "password": "" if password is None else str(password),
            "security_type": str(security_type or "wpa"),
        }
        if network_id is not None:
            payload["network_id"] = int(network_id)
        with suppress(Esp32AiboxApiConnectionError):
            live_result = await self._aibox_wifi_live_action(
                payload,
                predicate=lambda cached, before: int(cached.get("updated_at_ms") or 0) > before and str(cached.get("last_wifi_event_type") or "") in {"wifi_connect_result", "wifi_status", "wifi_ap_status"},
                timeout=16.0,
            )
            if live_result is not None:
                return dict(live_result)
        return await self._aibox_request_action(
            "wifi_connect",
            payload={key: value for key, value in payload.items() if key != "action"},
            expect_type={"wifi_connect_result", "wifi_status"},
            timeout=16.0,
            fallback={"type": "wifi_connect_result", "success": True, "ssid": normalized_ssid, "network_id": network_id, "unverified": True},
        )

    async def async_wifi_get_status(self) -> dict[str, Any]:
        """Get WiFi status from AiboxPlus."""
        cached = self._aibox_lay_cache('wifi_status', max_age=3.0)
        if cached and any(key in cached for key in ('current_ssid', 'is_connected', 'ap_mode_active', 'ip_address')):
            return cached
        payload = {"action": "wifi_get_status"}
        with suppress(Esp32AiboxApiConnectionError):
            live_result = await self._aibox_wifi_live_action(
                payload,
                predicate=lambda cached, before: int(cached.get("updated_at_ms") or 0) > before and any(key in cached for key in ("current_ssid", "is_connected", "ap_mode_active", "ip_address")),
                timeout=8.0,
            )
            if live_result is not None:
                return dict(live_result)
        return await self._aibox_request_action(
            "wifi_get_status",
            expect_type={"wifi_status", "wifi_ap_status"},
            timeout=8.0,
            fallback={"type": "wifi_status", "success": False},
        )

    async def async_wifi_get_saved(self) -> dict[str, Any]:
        """Get saved WiFi networks from AiboxPlus."""
        cached = self._aibox_lay_cache('wifi_status', max_age=6.0)
        if cached and isinstance(cached.get('saved_networks'), list):
            return {"type": "wifi_saved_result", "success": True, "networks": list(cached.get('saved_networks') or []), "updated_at_ms": cached.get('updated_at_ms'), "from_live_cache": True}
        payload = {"action": "wifi_get_saved"}
        with suppress(Esp32AiboxApiConnectionError):
            live_result = await self._aibox_wifi_live_action(
                payload,
                predicate=lambda cached, before: int(cached.get("updated_at_ms") or 0) > before and isinstance(cached.get("saved_networks"), list),
                timeout=10.0,
            )
            if live_result is not None:
                return {"type": "wifi_saved_result", "success": True, "networks": list(live_result.get("saved_networks") or []), "updated_at_ms": live_result.get("updated_at_ms"), "from_live_cache": True}
        return await self._aibox_request_action(
            "wifi_get_saved",
            expect_type={"wifi_saved_result"},
            timeout=10.0,
            fallback={"type": "wifi_saved_result", "success": False, "networks": []},
        )

    async def async_wifi_delete_saved(self, *, ssid: str | None = None, network_id: int | None = None) -> dict[str, Any]:
        """Delete one saved WiFi network on AiboxPlus."""
        payload: dict[str, Any] = {"action": "wifi_delete_saved"}
        if ssid is not None:
            payload["ssid"] = str(ssid)
        if network_id is not None:
            payload["network_id"] = int(network_id)
        with suppress(Esp32AiboxApiConnectionError):
            live_result = await self._aibox_wifi_live_action(
                payload,
                predicate=lambda cached, before: int(cached.get("updated_at_ms") or 0) > before and str(cached.get("last_wifi_event_type") or "") in {"wifi_delete_result", "wifi_saved_result"},
                timeout=10.0,
            )
            if live_result is not None:
                return dict(live_result)
        return await self._aibox_request_action(
            "wifi_delete_saved",
            payload={key: value for key, value in payload.items() if key != "action"},
            expect_type={"wifi_delete_result", "wifi_saved_result"},
            timeout=10.0,
            fallback={"type": "wifi_delete_result", "success": True, "ssid": payload.get("ssid"), "network_id": payload.get("network_id"), "unverified": True},
        )

    async def async_wifi_start_ap(self) -> dict[str, Any]:
        """Enable AP mode on AiboxPlus."""
        payload = {"action": "wifi_start_ap"}
        with suppress(Esp32AiboxApiConnectionError):
            live_result = await self._aibox_wifi_live_action(
                payload,
                predicate=lambda cached, before: int(cached.get("updated_at_ms") or 0) > before and (
                    str(cached.get("last_wifi_event_type") or "") in {"wifi_ap_result", "wifi_ap_status", "wifi_status"}
                    or cached.get("ap_mode_active") is True
                ),
                timeout=12.0,
            )
            if live_result is not None:
                return dict(live_result)
        return await self._aibox_request_action(
            "wifi_start_ap",
            expect_type={"wifi_ap_result", "wifi_ap_status", "wifi_status"},
            timeout=12.0,
            fallback={"type": "wifi_ap_result", "success": True, "ap_mode_active": True, "unverified": True},
        )

    async def async_wifi_stop_ap(self) -> dict[str, Any]:
        """Disable AP mode on AiboxPlus."""
        payload = {"action": "wifi_stop_ap"}
        with suppress(Esp32AiboxApiConnectionError):
            live_result = await self._aibox_wifi_live_action(
                payload,
                predicate=lambda cached, before: int(cached.get("updated_at_ms") or 0) > before and (
                    str(cached.get("last_wifi_event_type") or "") in {"wifi_ap_result", "wifi_ap_status", "wifi_status"}
                    or cached.get("ap_mode_active") is False
                ),
                timeout=12.0,
            )
            if live_result is not None:
                return dict(live_result)
        return await self._aibox_request_action(
            "wifi_stop_ap",
            expect_type={"wifi_ap_result", "wifi_ap_status", "wifi_status"},
            timeout=12.0,
            fallback={"type": "wifi_ap_result", "success": True, "ap_mode_active": False, "unverified": True},
        )


    @staticmethod
    def _system_monitor_mem_value(raw_text: str, key: str) -> int:
        match = re.search(rf"^{re.escape(key)}:\s+(\d+)", raw_text, flags=re.MULTILINE)
        return int(match.group(1)) if match else 0

    @staticmethod
    def _system_monitor_cpu_tuple(raw_text: str) -> tuple[int, int] | None:
        match = re.search(r"^cpu\s+(.+)$", raw_text, flags=re.MULTILINE)
        if not match:
            return None
        parts: list[int] = []
        for item in match.group(1).strip().split():
            with suppress(ValueError):
                parts.append(int(float(item)))
        if len(parts) < 4:
            return None
        total = sum(parts)
        idle = parts[3]
        return idle, total

    async def async_get_system_monitor(self) -> dict[str, Any]:
        """Collect RAM and CPU usage in the same style as the original web UI."""
        raw_text = await self.async_do_cmd("cat /proc/meminfo&&cat /proc/stat")
        mem_total = self._system_monitor_mem_value(raw_text, "MemTotal")
        mem_free = self._system_monitor_mem_value(raw_text, "MemFree")
        mem_buffers = self._system_monitor_mem_value(raw_text, "Buffers")
        mem_cached = self._system_monitor_mem_value(raw_text, "Cached")
        used_ram = max(0, mem_total - (mem_free + mem_buffers + mem_cached)) if mem_total > 0 else 0
        ram_percent = round((used_ram / mem_total) * 100) if mem_total > 0 else 0

        cpu_percent = 0
        cpu_tuple = self._system_monitor_cpu_tuple(raw_text)
        if cpu_tuple and self._system_monitor_last_cpu:
            prev_idle, prev_total = self._system_monitor_last_cpu
            idle, total = cpu_tuple
            delta_idle = idle - prev_idle
            delta_total = total - prev_total
            if delta_total > 0:
                cpu_percent = max(0, min(100, round(100 - (delta_idle / delta_total * 100))))

        if cpu_tuple and cpu_percent == 0 and self._system_monitor_last_cpu is None:
            await asyncio.sleep(0.35)
            raw_text_retry = await self.async_do_cmd("cat /proc/meminfo&&cat /proc/stat")
            retry_tuple = self._system_monitor_cpu_tuple(raw_text_retry)
            if retry_tuple:
                idle_1, total_1 = cpu_tuple
                idle_2, total_2 = retry_tuple
                delta_idle = idle_2 - idle_1
                delta_total = total_2 - total_1
                if delta_total > 0:
                    cpu_percent = max(0, min(100, round(100 - (delta_idle / delta_total * 100))))
                    raw_text = raw_text_retry
                    cpu_tuple = retry_tuple

        if cpu_tuple:
            self._system_monitor_last_cpu = cpu_tuple

        return {
            "type": "system_monitor",
            "success": True,
            "connected": True,
            "status": "online",
            "ram_percent": ram_percent,
            "cpu_percent": cpu_percent,
            "mem_total_kb": mem_total,
            "mem_used_kb": used_ram,
            "raw_text": raw_text.strip(),
            "updated_at_ms": int(time.time() * 1000),
        }

    async def async_set_led_state(self, enabled: bool) -> dict[str, Any]:
        """Best-effort set LED state on devices that only expose toggle semantics."""
        desired = bool(enabled)
        current = await self.async_led_get_state()
        current_enabled = self._aibox_phan_tich_bool(current.get("enabled"))
        if current_enabled == desired:
            current.setdefault("type", "led_set_state_result")
            current.setdefault("success", True)
            return current

        response = await self.async_led_toggle()
        updated = await self.async_led_get_state()
        updated_enabled = self._aibox_phan_tich_bool(updated.get("enabled"))
        if updated_enabled == desired:
            updated.setdefault("type", "led_set_state_result")
            updated.setdefault("success", True)
            return updated

        if updated_enabled is not None and updated_enabled != desired:
            await self.async_led_toggle()
            updated = await self.async_led_get_state()
            updated_enabled = self._aibox_phan_tich_bool(updated.get("enabled"))
            if updated_enabled == desired:
                updated.setdefault("type", "led_set_state_result")
                updated.setdefault("success", True)
                return updated

        return {
            "type": "led_set_state_result",
            "enabled": desired,
            "success": True,
            "unverified": True,
        }

    async def async_reboot(self) -> None:
        """Reboot speaker."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            await self._ws_chi_gui({"type": "reboot"})
            return
        await self.async_do_cmd("stop adbd&&start adbd&&adb reboot")

    async def async_ping(self) -> None:
        """Validate API reachability."""
        if self._protocol == PROTOCOL_WS_NATIVE:
            await self._ws_lay_thong_tin()
            return
        await self.async_get_model()