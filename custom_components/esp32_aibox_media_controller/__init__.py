"""ESP32 AIBox integration entrypoint."""

from __future__ import annotations

import os
from datetime import timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_PORT, EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import HomeAssistant, CoreState
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from homeassistant.components.http import StaticPathConfig
from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.loader import async_get_integration

from .api import ApiMapping, Esp32AiboxApiClient, Esp32AiboxApiError
from .const import (
    CONF_AIBOX_WS_PORT,
    CONF_PROTOCOL,
    CONF_SCAN_INTERVAL,
    CONF_USE_MEDIA_DISPATCH,
    DEFAULT_AIBOX_WS_PORT,
    DEFAULT_PROTOCOL,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_TIMEOUT,
    DOMAIN,
    PLATFORMS,
    PROTOCOL_AUTO,
    PROTOCOL_HTTP_BRIDGE,
    PROTOCOL_WS_NATIVE,
)
from .coordinator import Esp32AiboxCoordinator

Esp32AiboxConfigEntry = ConfigEntry[dict[str, Any]]
_LOGGER = logging.getLogger(__name__)

UI_URL_BASE = "/esp32_aibox_ui"
UI_DIR_PATH = "frontend"

async def init_resource(hass: HomeAssistant, url: str, ver: str) -> None:
    """Tự động thêm thẻ UI vào Lovelace resources."""
    url_with_version = f"{url}?hacstag={ver}"

    add_extra_js_url(hass, url_with_version)

    async def _register_resource(*args):
        lovelace = hass.data.get("lovelace")
        if not lovelace:
            return

        resources = getattr(lovelace, "resources", None) or lovelace.get("resources")
        if not isinstance(resources, ResourceStorageCollection):
            return

        if not resources.loaded:
            await resources.async_load()

        for item in resources.async_items():
            item_url = item.get("url", "")
            base_url = item_url.split("?")[0]
            
            if base_url == url:
                if item_url != url_with_version:
                    await resources.async_update_item(item["id"], {"res_type": "module", "url": url_with_version})
                return

        await resources.async_create_item({"res_type": "module", "url": url_with_version})

    if hass.state == CoreState.running:
        await _register_resource()
    else:
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, _register_resource)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Thiết lập component ESP32 AIBox và đường dẫn tĩnh cho UI."""
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            UI_URL_BASE,
            hass.config.path("custom_components", DOMAIN, UI_DIR_PATH),
            False
        )
    ])
    return True


async def async_setup_entry(hass: HomeAssistant, entry: Esp32AiboxConfigEntry) -> bool:
    """Set up ESP32 AIBox from a config entry."""
    
    # ---------------------------------------------------------
    # Đăng ký tự động Lovelace Custom Card
    # ---------------------------------------------------------
    integration = await async_get_integration(hass, DOMAIN)
    fallback_version = integration.version if integration and integration.version else "1.0"
    
    def get_file_version(file_name, fallback):
        try:
            file_path = hass.config.path("custom_components", DOMAIN, UI_DIR_PATH, file_name)
            return str(int(os.path.getmtime(file_path)))
        except Exception:
            return fallback

    ver_card = await hass.async_add_executor_job(
        get_file_version, "esp32-aibox-controller.js", fallback_version
    )

    await init_resource(hass, f"{UI_URL_BASE}/esp32-aibox-controller.js", ver_card)
    # ---------------------------------------------------------

    merged = {**entry.data, **entry.options}
    session = async_get_clientsession(hass)
    host = merged.get(CONF_HOST, entry.data[CONF_HOST])
    port = int(merged.get(CONF_PORT, entry.data[CONF_PORT]))
    aibox_ws_port = int(merged.get(CONF_AIBOX_WS_PORT, DEFAULT_AIBOX_WS_PORT))
    mapping = ApiMapping.from_config(merged)
    protocol = str(merged.get(CONF_PROTOCOL, DEFAULT_PROTOCOL))
    if protocol == PROTOCOL_AUTO:
        protocol, port = await _phat_hien_giao_thuc(session, host, port, mapping)

    client = Esp32AiboxApiClient(
        session=session,
        host=host,
        port=port,
        mapping=mapping,
        protocol=protocol,
        aibox_ws_port=aibox_ws_port,
        timeout=DEFAULT_TIMEOUT,
    )

    coordinator = Esp32AiboxCoordinator(
        hass=hass,
        client=client,
        scan_interval=timedelta(
            seconds=int(
                entry.options.get(
                    CONF_SCAN_INTERVAL,
                    entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
                )
            )
        ),
        use_media_dispatch=bool(
            entry.options.get(
                CONF_USE_MEDIA_DISPATCH,
                entry.data.get(CONF_USE_MEDIA_DISPATCH, True),
            )
        ),
    )
    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning(
            "Initial refresh failed for ESP32 AIBox (%s:%s, protocol=%s): %s. Integration will "
            "start as unavailable and retry.",
            host,
            port,
            protocol,
            err,
        )
        await coordinator.async_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {
        "client": client,
        "coordinator": coordinator,
    }

    entry.async_on_unload(entry.add_update_listener(_cap_nhat_tuy_chon))
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: Esp32AiboxConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id, None)
        if not hass.data[DOMAIN]:
            hass.data.pop(DOMAIN, None)
    return unload_ok


async def _cap_nhat_tuy_chon(hass: HomeAssistant, entry: Esp32AiboxConfigEntry) -> None:
    """Reload integration when options are updated."""
    await hass.config_entries.async_reload(entry.entry_id)


async def _phat_hien_giao_thuc(
    session,
    host: str,
    port: int,
    mapping: ApiMapping,
) -> tuple[str, int]:
    """Auto-detect protocol/port for old entries or 'auto' mode."""
    candidate_ports = [port]
    for fallback_port in (8080, 8081, 80): # Giả định DEFAULT_PORT là 80
        if fallback_port not in candidate_ports:
            candidate_ports.append(fallback_port)

    for candidate_port in candidate_ports:
        for mode in (PROTOCOL_HTTP_BRIDGE, PROTOCOL_WS_NATIVE):
            client = Esp32AiboxApiClient(
                session=session,
                host=host,
                port=candidate_port,
                mapping=mapping,
                protocol=mode,
                aibox_ws_port=DEFAULT_AIBOX_WS_PORT,
                timeout=DEFAULT_TIMEOUT,
            )
            try:
                await client.async_ping()
                return mode, candidate_port
            except Esp32AiboxApiError:
                continue
    return PROTOCOL_HTTP_BRIDGE, port