"""Media player platform for ESP32 AIBox."""

from __future__ import annotations

import asyncio
import json
from contextlib import suppress
import logging
from math import ceil
import time
from typing import Any

import voluptuous as vol

import homeassistant.helpers.config_validation as cv
from homeassistant.helpers import entity_platform

from homeassistant.components.media_player import (
    MediaPlayerEntity,
    MediaPlayerEntityFeature,
    MediaPlayerState,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.const import CONF_NAME
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.helpers.storage import Store # Thêm thư viện lưu trữ của HA

from .api import Esp32AiboxApiClient, Esp32AiboxApiError
from .const import (
    CONF_USE_MEDIA_DISPATCH,
    DEFAULT_NAME,
    DOMAIN,
    KEYCODE_MEDIA_NEXT,
    KEYCODE_MEDIA_PLAY_PAUSE,
    KEYCODE_MEDIA_PREVIOUS,
    KEYCODE_MEDIA_STOP,
    KEYCODE_MUTE,
    KEYCODE_POWER,
    KEYCODE_VOLUME_DOWN,
    KEYCODE_VOLUME_UP,
    PROTOCOL_WS_NATIVE,
)
from .coordinator import Esp32AiboxCoordinator, _suy_ra_chat_button_enabled

SERVICE_SEND_KEYCODE = "send_keycode"
SERVICE_RUN_COMMAND = "run_command"
SERVICE_SEND_MESSAGE = "send_message"
SERVICE_WS_SEND_PAYLOAD = "ws_send_payload"
SERVICE_SEARCH_YOUTUBE = "search_youtube"
SERVICE_SEARCH_PLAYLIST = "search_playlist"
SERVICE_SEARCH_ZING = "search_zing"
SERVICE_PLAY_YOUTUBE = "play_youtube"
SERVICE_PLAY_ZING = "play_zing"
SERVICE_WAKE_WORD_SET_ENABLED = "wake_word_set_enabled"
SERVICE_WAKE_WORD_GET_ENABLED = "wake_word_get_enabled"
SERVICE_WAKE_WORD_SET_SENSITIVITY = "wake_word_set_sensitivity"
SERVICE_WAKE_WORD_GET_SENSITIVITY = "wake_word_get_sensitivity"
SERVICE_CUSTOM_AI_SET_ENABLED = "custom_ai_set_enabled"
SERVICE_CUSTOM_AI_GET_ENABLED = "custom_ai_get_enabled"
SERVICE_ANTI_DEAF_AI_SET_ENABLED = "anti_deaf_ai_set_enabled"
SERVICE_ANTI_DEAF_AI_GET_ENABLED = "anti_deaf_ai_get_enabled"
SERVICE_CHAT_WAKE_UP = "chat_wake_up"
SERVICE_CHAT_TEST_MIC = "chat_test_mic"
SERVICE_CHAT_GET_STATE = "chat_get_state"
SERVICE_CHAT_SEND_TEXT = "chat_send_text"
SERVICE_CHAT_GET_HISTORY = "chat_get_history"
SERVICE_TIKTOK_REPLY_TOGGLE = "tiktok_reply_toggle"
SERVICE_UPLOAD_CHAT_BACKGROUND = "upload_chat_background"
SERVICE_GET_CHAT_BACKGROUND = "get_chat_background"
SERVICE_REMOVE_CHAT_BACKGROUND = "remove_chat_background"
SERVICE_SET_DLNA = "set_dlna"
SERVICE_SET_AIRPLAY = "set_airplay"
SERVICE_SET_BLUETOOTH = "set_bluetooth"
SERVICE_SET_MAIN_LIGHT = "set_main_light"
SERVICE_SET_LIGHT_MODE = "set_light_mode"
SERVICE_SET_LIGHT_SPEED = "set_light_speed"
SERVICE_SET_LIGHT_BRIGHTNESS = "set_light_brightness"
SERVICE_SET_EDGE_LIGHT = "set_edge_light"
SERVICE_SET_BASS_ENABLE = "set_bass_enable"
SERVICE_SET_BASS_STRENGTH = "set_bass_strength"
SERVICE_SET_LOUDNESS_ENABLE = "set_loudness_enable"
SERVICE_SET_LOUDNESS_GAIN = "set_loudness_gain"
SERVICE_SET_EQ_ENABLE = "set_eq_enable"
SERVICE_SET_EQ_BANDLEVEL = "set_eq_bandlevel"
SERVICE_SET_MIXER_VALUE = "set_mixer_value"
SERVICE_SET_PLAY_MODE = "set_play_mode"
SERVICE_REBOOT = "reboot"
SERVICE_SEEK = "seek"
SERVICE_TOGGLE_REPEAT = "toggle_repeat"
SERVICE_TOGGLE_AUTO_NEXT = "toggle_auto_next"
SERVICE_LED_TOGGLE = "led_toggle"
SERVICE_LED_GET_STATE = "led_get_state"
SERVICE_STEREO_ENABLE = "stereo_enable"
SERVICE_STEREO_DISABLE = "stereo_disable"
SERVICE_STEREO_SET_CHANNEL = "stereo_set_channel"
SERVICE_STEREO_GET_STATE = "stereo_get_state"
SERVICE_REFRESH_STATE = "refresh_state"
SERVICE_ALARM_LIST = "alarm_list"
SERVICE_ALARM_STOP = "alarm_stop"
SERVICE_ALARM_ADD = "alarm_add"
SERVICE_ALARM_EDIT = "alarm_edit"
SERVICE_ALARM_DELETE = "alarm_delete"
SERVICE_ALARM_TOGGLE = "alarm_toggle"
SERVICE_ALARM_UPLOAD_SOUND = "alarm_upload_sound"
SERVICE_OTA_GET = "ota_get"
SERVICE_OTA_SET = "ota_set"
SERVICE_MAC_GET = "mac_get"
SERVICE_MAC_RANDOM = "mac_random"
SERVICE_MAC_CLEAR = "mac_clear"
SERVICE_HASS_GET = "hass_get"
SERVICE_HASS_SET = "hass_set"
SERVICE_WEATHER_PROVINCE_GET = "weather_province_get"
SERVICE_WEATHER_PROVINCE_SET = "weather_province_set"
SERVICE_WIFI_SCAN = "wifi_scan"
SERVICE_WIFI_CONNECT = "wifi_connect"
SERVICE_WIFI_GET_STATUS = "wifi_get_status"
SERVICE_WIFI_GET_SAVED = "wifi_get_saved"
SERVICE_WIFI_DELETE_SAVED = "wifi_delete_saved"
SERVICE_WIFI_START_AP = "wifi_start_ap"
SERVICE_WIFI_STOP_AP = "wifi_stop_ap"
SERVICE_SET_LED_STATE = "set_led_state"

ATTR_KEYCODE = "keycode"
ATTR_COMMAND = "command"
ATTR_TYPE_ID = "type_id"
ATTR_WHAT = "what"
ATTR_ARG1 = "arg1"
ATTR_ARG2 = "arg2"
ATTR_OBJ = "obj"
ATTR_PAYLOAD = "payload"
ATTR_EXPECT_TYPE = "expect_type"
ATTR_QUERY = "query"
ATTR_VIDEO_ID = "video_id"
ATTR_SONG_ID = "song_id"
ATTR_SPEAKER_ENTITIES = "speaker_entities"
ATTR_SENSITIVITY = "sensitivity"
ATTR_TEXT = "text"
ATTR_IMAGE = "image"
ATTR_ENABLED = "enabled"
ATTR_MODE = "mode"
ATTR_SPEED = "speed"
ATTR_BRIGHTNESS = "brightness"
ATTR_INTENSITY = "intensity"
ATTR_STRENGTH = "strength"
ATTR_GAIN = "gain"
ATTR_BAND = "band"
ATTR_LEVEL = "level"
ATTR_CONTROL_NAME = "control_name"
ATTR_VALUE = "value"
ATTR_POSITION = "position"
ATTR_CHANNEL = "channel"
ATTR_ALARM_ID = "alarm_id"
ATTR_HOUR = "hour"
ATTR_MINUTE = "minute"
ATTR_REPEAT = "repeat"
ATTR_LABEL = "label"
ATTR_VOLUME = "volume"
ATTR_CUSTOM_SOUND_PATH = "custom_sound_path"
ATTR_YOUTUBE_SONG_NAME = "youtube_song_name"
ATTR_SELECTED_DAYS = "selected_days"
ATTR_FILE_NAME = "file_name"
ATTR_FILE_DATA = "file_data"
ATTR_OTA_URL = "ota_url"
ATTR_URL = "url"
ATTR_AGENT_ID = "agent_id"
ATTR_API_KEY = "api_key"
ATTR_NAME = "name"
ATTR_LAT = "lat"
ATTR_LON = "lon"
ATTR_SSID = "ssid"
ATTR_PASSWORD = "password"
ATTR_SECURITY_TYPE = "security_type"
ATTR_NETWORK_ID = "network_id"

MEDIA_ACTION_TO_KEYCODE: dict[str, int] = {
    "play": KEYCODE_MEDIA_PLAY_PAUSE,
    "pause": KEYCODE_MEDIA_PLAY_PAUSE,
    "toggle": KEYCODE_MEDIA_PLAY_PAUSE,
    "next": KEYCODE_MEDIA_NEXT,
    "previous": KEYCODE_MEDIA_PREVIOUS,
    "stop": KEYCODE_MEDIA_STOP,
}

_LOGGER = logging.getLogger(__name__)

# Cấu hình lưu trữ
STORAGE_VERSION = 1
STORAGE_KEY_PREFIX = "esp32_aibox_playlists"

def _tinh_nang_dau_tien(*names: str) -> MediaPlayerEntityFeature:
    """Return first available media player feature flag from names."""
    for name in names:
        flag = getattr(MediaPlayerEntityFeature, name, None)
        if flag is not None:
            return flag
    return MediaPlayerEntityFeature(0)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up ESP32 AIBox media player from config entry."""
    coordinator: Esp32AiboxCoordinator = hass.data[DOMAIN][entry.entry_id]["coordinator"]
    client: Esp32AiboxApiClient = hass.data[DOMAIN][entry.entry_id]["client"]

    async_add_entities([Esp32AiboxMediaPlayer(entry, coordinator, client)])

    platform = entity_platform.async_get_current_platform()
    platform.async_register_entity_service(
        SERVICE_SEND_KEYCODE,
        {vol.Required(ATTR_KEYCODE): vol.Coerce(int)},
        "async_send_keycode",
    )
    platform.async_register_entity_service(
        SERVICE_RUN_COMMAND,
        {
            vol.Required(ATTR_COMMAND): cv.string,
            vol.Optional(ATTR_TYPE_ID, default="myshell"): cv.string,
        },
        "async_run_command",
    )
    platform.async_register_entity_service(
        SERVICE_SEND_MESSAGE,
        {
            vol.Required(ATTR_WHAT): vol.Coerce(int),
            vol.Required(ATTR_ARG1): vol.Coerce(int),
            vol.Optional(ATTR_ARG2, default=-1): vol.Coerce(int),
            vol.Optional(ATTR_OBJ, default=True): vol.Any(bool, vol.Coerce(int), cv.string),
            vol.Optional(ATTR_TYPE_ID): cv.string,
        },
        "async_send_message",
    )
    platform.async_register_entity_service(
        SERVICE_WS_SEND_PAYLOAD,
        {
            vol.Required(ATTR_PAYLOAD): cv.string,
            vol.Optional(ATTR_EXPECT_TYPE): cv.string,
        },
        "async_ws_send_payload",
    )
    platform.async_register_entity_service(
        SERVICE_SEARCH_YOUTUBE,
        {vol.Required(ATTR_QUERY): cv.string},
        "async_search_youtube",
    )
    platform.async_register_entity_service(
        SERVICE_SEARCH_PLAYLIST,
        {vol.Required(ATTR_QUERY): cv.string},
        "async_search_playlist",
    )
    platform.async_register_entity_service(
        SERVICE_SEARCH_ZING,
        {vol.Required(ATTR_QUERY): cv.string},
        "async_search_zing",
    )
    platform.async_register_entity_service(
        SERVICE_PLAY_YOUTUBE,
        {
            vol.Required(ATTR_VIDEO_ID): cv.string,
            vol.Optional(ATTR_SPEAKER_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id]),
        },
        "async_play_youtube",
    )
    platform.async_register_entity_service(
        SERVICE_PLAY_ZING,
        {
            vol.Required(ATTR_SONG_ID): cv.string,
            vol.Optional(ATTR_SPEAKER_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id]),
        },
        "async_play_zing",
    )
    platform.async_register_entity_service(
        SERVICE_WAKE_WORD_SET_ENABLED,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_wake_word_set_enabled",
    )
    platform.async_register_entity_service(
        SERVICE_WAKE_WORD_GET_ENABLED,
        {},
        "async_wake_word_get_enabled",
    )
    platform.async_register_entity_service(
        SERVICE_WAKE_WORD_SET_SENSITIVITY,
        {vol.Required(ATTR_SENSITIVITY): vol.All(vol.Coerce(float), vol.Range(min=0.0, max=1.0))},
        "async_wake_word_set_sensitivity",
    )
    platform.async_register_entity_service(
        SERVICE_WAKE_WORD_GET_SENSITIVITY,
        {},
        "async_wake_word_get_sensitivity",
    )
    platform.async_register_entity_service(
        SERVICE_CUSTOM_AI_SET_ENABLED,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_custom_ai_set_enabled",
    )
    platform.async_register_entity_service(
        SERVICE_CUSTOM_AI_GET_ENABLED,
        {},
        "async_custom_ai_get_enabled",
    )
    platform.async_register_entity_service(
        SERVICE_ANTI_DEAF_AI_SET_ENABLED,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_anti_deaf_ai_set_enabled",
    )
    platform.async_register_entity_service(
        SERVICE_ANTI_DEAF_AI_GET_ENABLED,
        {},
        "async_anti_deaf_ai_get_enabled",
    )
    platform.async_register_entity_service(
        SERVICE_CHAT_WAKE_UP,
        {},
        "async_chat_wake_up",
    )
    platform.async_register_entity_service(
        SERVICE_CHAT_TEST_MIC,
        {},
        "async_chat_test_mic",
    )
    platform.async_register_entity_service(
        SERVICE_CHAT_GET_STATE,
        {},
        "async_chat_get_state",
    )
    platform.async_register_entity_service(
        SERVICE_CHAT_SEND_TEXT,
        {vol.Required(ATTR_TEXT): cv.string},
        "async_chat_send_text",
    )
    platform.async_register_entity_service(
        SERVICE_CHAT_GET_HISTORY,
        {},
        "async_chat_get_history",
    )
    platform.async_register_entity_service(
        SERVICE_TIKTOK_REPLY_TOGGLE,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_tiktok_reply_toggle",
    )
    platform.async_register_entity_service(
        SERVICE_UPLOAD_CHAT_BACKGROUND,
        {vol.Required(ATTR_IMAGE): cv.string},
        "async_upload_chat_background",
    )
    platform.async_register_entity_service(
        SERVICE_GET_CHAT_BACKGROUND,
        {},
        "async_get_chat_background",
    )
    platform.async_register_entity_service(
        SERVICE_REMOVE_CHAT_BACKGROUND,
        {},
        "async_remove_chat_background",
    )
    platform.async_register_entity_service(
        SERVICE_SET_DLNA,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_set_dlna",
    )
    platform.async_register_entity_service(
        SERVICE_SET_AIRPLAY,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_set_airplay",
    )
    platform.async_register_entity_service(
        SERVICE_SET_BLUETOOTH,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_set_bluetooth",
    )
    platform.async_register_entity_service(
        SERVICE_SET_MAIN_LIGHT,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_set_main_light",
    )
    platform.async_register_entity_service(
        SERVICE_SET_LIGHT_MODE,
        {vol.Required(ATTR_MODE): vol.Coerce(int)},
        "async_set_light_mode",
    )
    platform.async_register_entity_service(
        SERVICE_SET_LIGHT_SPEED,
        {vol.Required(ATTR_SPEED): vol.All(vol.Coerce(int), vol.Range(min=1, max=100))},
        "async_set_light_speed",
    )
    platform.async_register_entity_service(
        SERVICE_SET_LIGHT_BRIGHTNESS,
        {vol.Required(ATTR_BRIGHTNESS): vol.All(vol.Coerce(int), vol.Range(min=1, max=200))},
        "async_set_light_brightness",
    )
    platform.async_register_entity_service(
        SERVICE_SET_EDGE_LIGHT,
        {
            vol.Required(ATTR_ENABLED): cv.boolean,
            vol.Optional(ATTR_INTENSITY): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
        },
        "async_set_edge_light",
    )
    platform.async_register_entity_service(
        SERVICE_SET_BASS_ENABLE,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_set_bass_enable",
    )
    platform.async_register_entity_service(
        SERVICE_SET_BASS_STRENGTH,
        {vol.Required(ATTR_STRENGTH): vol.Coerce(int)},
        "async_set_bass_strength",
    )
    platform.async_register_entity_service(
        SERVICE_SET_LOUDNESS_ENABLE,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_set_loudness_enable",
    )
    platform.async_register_entity_service(
        SERVICE_SET_LOUDNESS_GAIN,
        {vol.Required(ATTR_GAIN): vol.Coerce(int)},
        "async_set_loudness_gain",
    )
    platform.async_register_entity_service(
        SERVICE_SET_EQ_ENABLE,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_set_eq_enable",
    )
    platform.async_register_entity_service(
        SERVICE_SET_EQ_BANDLEVEL,
        {
            vol.Required(ATTR_BAND): vol.Coerce(int),
            vol.Required(ATTR_LEVEL): vol.All(vol.Coerce(int), vol.Range(min=-1500, max=1500)),
        },
        "async_set_eq_bandlevel",
    )
    platform.async_register_entity_service(
        SERVICE_SET_MIXER_VALUE,
        {
            vol.Required(ATTR_CONTROL_NAME): cv.string,
            vol.Required(ATTR_VALUE): vol.Coerce(int),
        },
        "async_set_mixer_value",
    )
    platform.async_register_entity_service(
        SERVICE_SET_PLAY_MODE,
        {vol.Required(ATTR_MODE): vol.Coerce(int)},
        "async_set_play_mode",
    )
    platform.async_register_entity_service(
        SERVICE_REBOOT,
        {},
        "async_reboot",
    )
    platform.async_register_entity_service(
        SERVICE_SEEK,
        {vol.Required(ATTR_POSITION): vol.Coerce(int)},
        "async_seek",
    )
    platform.async_register_entity_service(
        SERVICE_TOGGLE_REPEAT,
        {},
        "async_toggle_repeat",
    )
    platform.async_register_entity_service(
        SERVICE_TOGGLE_AUTO_NEXT,
        {},
        "async_toggle_auto_next",
    )
    platform.async_register_entity_service(
        SERVICE_LED_TOGGLE,
        {},
        "async_led_toggle",
    )
    platform.async_register_entity_service(
        SERVICE_LED_GET_STATE,
        {},
        "async_led_get_state",
    )
    platform.async_register_entity_service(
        SERVICE_STEREO_ENABLE,
        {},
        "async_stereo_enable",
    )
    platform.async_register_entity_service(
        SERVICE_STEREO_DISABLE,
        {},
        "async_stereo_disable",
    )
    platform.async_register_entity_service(
        SERVICE_STEREO_SET_CHANNEL,
        {vol.Required(ATTR_CHANNEL): cv.string},
        "async_stereo_set_channel",
    )
    platform.async_register_entity_service(
        SERVICE_STEREO_GET_STATE,
        {},
        "async_stereo_get_state",
    )
    platform.async_register_entity_service(
        SERVICE_REFRESH_STATE,
        {},
        "async_refresh_state",
    )


    platform.async_register_entity_service(
        SERVICE_ALARM_LIST,
        {},
        "async_alarm_list",
    )
    platform.async_register_entity_service(
        SERVICE_ALARM_STOP,
        {},
        "async_alarm_stop",
    )
    platform.async_register_entity_service(
        SERVICE_ALARM_ADD,
        {
            vol.Required(ATTR_HOUR): vol.All(vol.Coerce(int), vol.Range(min=0, max=23)),
            vol.Required(ATTR_MINUTE): vol.All(vol.Coerce(int), vol.Range(min=0, max=59)),
            vol.Optional(ATTR_REPEAT, default="none"): cv.string,
            vol.Optional(ATTR_LABEL, default=""): cv.string,
            vol.Optional(ATTR_VOLUME, default=100): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
            vol.Optional(ATTR_CUSTOM_SOUND_PATH): cv.string,
            vol.Optional(ATTR_YOUTUBE_SONG_NAME): cv.string,
            vol.Optional(ATTR_SELECTED_DAYS): [cv.string],
        },
        "async_alarm_add",
    )
    platform.async_register_entity_service(
        SERVICE_ALARM_EDIT,
        {
            vol.Required(ATTR_ALARM_ID): cv.string,
            vol.Required(ATTR_HOUR): vol.All(vol.Coerce(int), vol.Range(min=0, max=23)),
            vol.Required(ATTR_MINUTE): vol.All(vol.Coerce(int), vol.Range(min=0, max=59)),
            vol.Optional(ATTR_REPEAT, default="none"): cv.string,
            vol.Optional(ATTR_LABEL, default=""): cv.string,
            vol.Optional(ATTR_VOLUME, default=100): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
            vol.Optional(ATTR_CUSTOM_SOUND_PATH): vol.Any(None, cv.string),
            vol.Optional(ATTR_YOUTUBE_SONG_NAME): vol.Any(None, cv.string),
            vol.Optional(ATTR_SELECTED_DAYS): vol.Any(None, [cv.string]),
        },
        "async_alarm_edit",
    )
    platform.async_register_entity_service(
        SERVICE_ALARM_DELETE,
        {vol.Required(ATTR_ALARM_ID): cv.string},
        "async_alarm_delete",
    )
    platform.async_register_entity_service(
        SERVICE_ALARM_TOGGLE,
        {vol.Required(ATTR_ALARM_ID): cv.string},
        "async_alarm_toggle",
    )
    platform.async_register_entity_service(
        SERVICE_ALARM_UPLOAD_SOUND,
        {
            vol.Required(ATTR_FILE_NAME): cv.string,
            vol.Required(ATTR_FILE_DATA): cv.string,
            vol.Optional(ATTR_ALARM_ID, default=-1): vol.Coerce(int),
        },
        "async_alarm_upload_sound",
    )
    platform.async_register_entity_service(
        SERVICE_OTA_GET,
        {},
        "async_ota_get",
    )
    platform.async_register_entity_service(
        SERVICE_OTA_SET,
        {vol.Required(ATTR_OTA_URL): cv.string},
        "async_ota_set",
    )
    platform.async_register_entity_service(
        SERVICE_MAC_GET,
        {},
        "async_mac_get",
    )
    platform.async_register_entity_service(
        SERVICE_MAC_RANDOM,
        {},
        "async_mac_random",
    )
    platform.async_register_entity_service(
        SERVICE_MAC_CLEAR,
        {},
        "async_mac_clear",
    )
    platform.async_register_entity_service(
        SERVICE_HASS_GET,
        {},
        "async_hass_get",
    )
    platform.async_register_entity_service(
        SERVICE_HASS_SET,
        {
            vol.Optional(ATTR_URL, default=""): cv.string,
            vol.Optional(ATTR_API_KEY): cv.string,
            vol.Optional(ATTR_AGENT_ID, default=""): cv.string,
        },
        "async_hass_set",
    )
    platform.async_register_entity_service(
        SERVICE_WEATHER_PROVINCE_GET,
        {},
        "async_weather_province_get",
    )
    platform.async_register_entity_service(
        SERVICE_WEATHER_PROVINCE_SET,
        {
            vol.Optional(ATTR_NAME, default=""): cv.string,
            vol.Optional(ATTR_LAT, default=0): vol.Coerce(float),
            vol.Optional(ATTR_LON, default=0): vol.Coerce(float),
        },
        "async_weather_province_set",
    )
    platform.async_register_entity_service(
        SERVICE_WIFI_SCAN,
        {},
        "async_wifi_scan",
    )
    platform.async_register_entity_service(
        SERVICE_WIFI_CONNECT,
        {
            vol.Optional(ATTR_SSID): cv.string,
            vol.Optional(ATTR_PASSWORD, default=""): cv.string,
            vol.Optional(ATTR_SECURITY_TYPE, default="wpa"): cv.string,
            vol.Optional(ATTR_NETWORK_ID): vol.Coerce(int),
        },
        "async_wifi_connect",
    )
    platform.async_register_entity_service(
        SERVICE_WIFI_GET_STATUS,
        {},
        "async_wifi_get_status",
    )
    platform.async_register_entity_service(
        SERVICE_WIFI_GET_SAVED,
        {},
        "async_wifi_get_saved",
    )
    platform.async_register_entity_service(
        SERVICE_WIFI_DELETE_SAVED,
        {
            vol.Optional(ATTR_SSID): cv.string,
            vol.Optional(ATTR_NETWORK_ID): vol.Coerce(int),
        },
        "async_wifi_delete_saved",
    )
    platform.async_register_entity_service(
        SERVICE_WIFI_START_AP,
        {},
        "async_wifi_start_ap",
    )
    platform.async_register_entity_service(
        SERVICE_WIFI_STOP_AP,
        {},
        "async_wifi_stop_ap",
    )
    platform.async_register_entity_service(
        SERVICE_SET_LED_STATE,
        {vol.Required(ATTR_ENABLED): cv.boolean},
        "async_set_led_state",
    )
    platform.async_register_entity_service("playlist_list", {}, "async_playlist_list")
    platform.async_register_entity_service("playlist_get_songs", {"playlist_id": cv.string}, "async_playlist_get_songs")
    platform.async_register_entity_service("playlist_create", {"name": cv.string}, "async_playlist_create")
    platform.async_register_entity_service("playlist_delete", {"playlist_id": cv.string}, "async_playlist_delete")
    
    platform.async_register_entity_service("playlist_add_song", {
        "playlist_id": cv.string,
        "source": cv.string,
        "id": cv.string,
        vol.Optional("title"): cv.string,
        vol.Optional("artist"): cv.string,
        vol.Optional("thumbnail_url"): cv.string,
        vol.Optional("duration_seconds"): vol.Coerce(int)
    }, "async_playlist_add_song")
    
    platform.async_register_entity_service("playlist_remove_song", {
        "playlist_id": cv.string,
        "song_index": vol.Coerce(int)
    }, "async_playlist_remove_song")
    
    platform.async_register_entity_service(
        "playlist_play",
        {
            "playlist_id": cv.string,
            vol.Optional(ATTR_SPEAKER_ENTITIES): vol.All(cv.ensure_list, [cv.entity_id]),
        },
        "async_playlist_play",
    )


class Esp32AiboxMediaPlayer(CoordinatorEntity[Esp32AiboxCoordinator], MediaPlayerEntity):
    """Representation of ESP32 AIBox as media player."""

    _attr_has_entity_name = True
    _attr_name = None
    _attr_icon = "mdi:speaker"
    _attr_should_poll = False
    _base_supported_features = (
        _tinh_nang_dau_tien("PAUSE")
        | _tinh_nang_dau_tien("PLAY")
        | _tinh_nang_dau_tien("STOP")
        | _tinh_nang_dau_tien("NEXT_TRACK")
        | _tinh_nang_dau_tien("PREVIOUS_TRACK")
        | _tinh_nang_dau_tien("VOLUME_STEP", "VOLUME_UP")
        | _tinh_nang_dau_tien("VOLUME_SET")
        | _tinh_nang_dau_tien("VOLUME_MUTE")
    )

    def __init__(
        self,
        entry: ConfigEntry,
        coordinator: Esp32AiboxCoordinator,
        client: Esp32AiboxApiClient,
    ) -> None:
        """Initialize media player."""
        super().__init__(coordinator)
        self._entry = entry
        self._client = client
        self._is_ws_native = self._client.protocol == PROTOCOL_WS_NATIVE
        self._use_media_dispatch = bool(
            entry.options.get(
                CONF_USE_MEDIA_DISPATCH,
                entry.data.get(CONF_USE_MEDIA_DISPATCH, True),
            )
        )
        self._attr_supported_features = self._base_supported_features
        if not self._is_ws_native:
            self._attr_supported_features |= (
                _tinh_nang_dau_tien("TURN_ON") | _tinh_nang_dau_tien("TURN_OFF")
            )

        self._attr_unique_id = f"{entry.entry_id}_media_player"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            manufacturer="ESP32",
            model="AIBox",
            name=entry.options.get(CONF_NAME, entry.data.get(CONF_NAME, DEFAULT_NAME)),
        )
        self._last_search: dict[str, Any] = {}
        self._last_play: dict[str, Any] = {}
        self._wake_word: dict[str, Any] = {}
        self._custom_ai: dict[str, Any] = {}
        self._chat_state: dict[str, Any] = {}
        self._last_chat_items: list[dict[str, Any]] = []
        self._chat_background: str = ""
        self._last_play_pause_sent: str | None = None
        self._led_state: dict[str, Any] = {}
        self._stereo_state: dict[str, Any] = {}
        self._system_state: dict[str, Any] = {}
        
        # Biến quản lý trạng thái hiển thị Playlist
        self._playlist_library: dict[str, Any] = {}
        self._playlist_detail: dict[str, Any] = {}
        self._last_playlist_event: dict[str, Any] = {}

        # Dữ liệu vật lý cho Storage
        self._stored_playlists: list[dict[str, Any]] = []
        self._stored_items: dict[str, list[dict[str, Any]]] = {}
        self._store = None

    async def async_added_to_hass(self) -> None:
        """Load data from storage when entity is added."""
        await super().async_added_to_hass()
        self._store = Store(
            self.hass, 
            STORAGE_VERSION, 
            f"{STORAGE_KEY_PREFIX}_{self._entry.entry_id}"
        )
        
        data = await self._store.async_load()
        if data:
            self._stored_playlists = data.get("playlists", [])
            self._stored_items = data.get("items", {})
        else:
            self._stored_playlists = []
            self._stored_items = {}
            
        await self.async_playlist_list()

    async def _async_save_playlists(self) -> None:
        """Save playlist data to storage."""
        if self._store:
            await self._store.async_save({
                "playlists": self._stored_playlists,
                "items": self._stored_items
            })

    @property
    def available(self) -> bool:
        """Return if entity is available."""
        return self.coordinator.last_update_success

    @property
    def state(self) -> MediaPlayerState:
        """Return playback state."""
        status = self.coordinator.data
        if status.playback_state == "playing":
            return MediaPlayerState.PLAYING
        if status.playback_state == "paused":
            return MediaPlayerState.PAUSED
        if status.playback_state == "stopped":
            return MediaPlayerState.IDLE
        return MediaPlayerState.IDLE

    @property
    def volume_level(self) -> float | None:
        """Return volume level in range 0..1."""
        return self.coordinator.data.volume_level

    @property
    def is_volume_muted(self) -> bool | None:
        """Return true if volume is muted."""
        return self.coordinator.data.is_muted

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional state attributes."""
        status = self.coordinator.data
        attrs: dict[str, Any] = {
            "model": status.model,
            "volume_current": status.volume_current,
            "volume_min": status.volume_min,
            "volume_max": status.volume_max,
            "playback_state_raw": status.playback_state,
        }
        for key in (
            "dlna_open",
            "airplay_open",
            "device_state",
            "music_light_enable",
            "music_light_luma",
            "music_light_chroma",
            "music_light_mode",
        ):
            if key in status.raw:
                attrs[key] = status.raw[key]
            elif key in self._system_state:
                attrs[key] = self._system_state[key]
        if self._last_search:
            attrs["last_music_search"] = self._last_search
        if self._last_play:
            attrs["last_music_play"] = self._last_play

        merged_wake = dict(self._wake_word) if self._wake_word else {}
        if status.wake_word:
            merged_wake.update(status.wake_word)
        if merged_wake:
            attrs["wake_word"] = merged_wake

        merged_ai = dict(self._custom_ai) if self._custom_ai else {}
        if status.custom_ai:
            merged_ai.update(status.custom_ai)
        if merged_ai:
            attrs["custom_ai"] = merged_ai

        merged_chat_state = dict(status.chat_state) if status.chat_state else {}
        if self._chat_state:
            merged_chat_state.update(self._chat_state)
        if merged_chat_state:
            attrs["chat_state"] = merged_chat_state
        if self._last_chat_items:
            attrs["last_chat_items"] = self._last_chat_items
        attrs["chat_background"] = self._chat_background or ""

        aibox_playback = status.aibox_playback if status.aibox_playback else self._client.get_last_aibox_playback()
        if aibox_playback:
            attrs["aibox_playback"] = aibox_playback

        merged_led_state = {}
        if isinstance(status.led_state, dict):
            merged_led_state.update(status.led_state)
        if self._led_state:
            merged_led_state.update(self._led_state)
        if merged_led_state:
            attrs["led_state"] = merged_led_state

        system_aliases = {
            "ota_config": ("ota", "ota_state", "system_ota"),
            "mac_info": ("mac_state", "mac", "system_mac"),
            "weather_province": ("weather_province_state", "weather_location", "system_weather"),
            "hass_config": ("hass", "home_assistant", "system_hass"),
            "wifi_status": ("wifi", "network", "system_wifi"),
            "alarm_list": ("alarms", "alarm_state", "system_alarms"),
            "alarm_banner": ("active_alarm", "alarm_triggered"),
            "system_monitor": ("system_stats", "system_monitor_state"),
        }
        for canonical_key, aliases in system_aliases.items():
            value = self._system_state.get(canonical_key)
            if value is None or value == {} or value == []:
                continue
            attrs[canonical_key] = value
            for alias in aliases:
                attrs[alias] = value

        merged_audio = dict(self._system_state.get("audio_config") or {})
        if status.audio_state:
            merged_audio.update(status.audio_state)
        if merged_audio:
            attrs["audio_config"] = merged_audio

        edge_light = self._system_state.get("edge_light")
        if isinstance(edge_light, dict) and edge_light:
            attrs["edge_light"] = dict(edge_light)

        if self._playlist_library:
            attrs["playlist_library"] = self._playlist_library
        if self._playlist_detail:
            attrs["playlist_detail"] = self._playlist_detail
        if self._last_playlist_event:
            attrs["last_playlist_event"] = self._last_playlist_event

        return attrs

    @staticmethod
    def _chu_dau_tien(item: dict[str, Any], keys: tuple[str, ...]) -> str | None:
        """Return first non-empty text value from provided keys."""
        for key in keys:
            value = item.get(key)
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return None

    @staticmethod
    def _ep_kieu_bool(value: Any, fallback: bool = False) -> bool:
        """Normalize boolean-like values returned by device services."""
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"1", "true", "on", "enable", "enabled", "yes", "y"}:
                return True
            if normalized in {"0", "false", "off", "disable", "disabled", "no", "n"}:
                return False
            with suppress(ValueError):
                return float(normalized) != 0
        return fallback

    @staticmethod
    def _chuan_hoa_chat_role(value: Any, fallback: str = "server") -> str:
        """Normalize chat role names into the user/server variants used by the card."""
        normalized = str(value or "").strip().lower()
        if normalized in {"user", "human", "client", "me"}:
            return "user"
        if normalized in {"assistant", "ai", "bot", "server", "system"}:
            return "server"
        return fallback

    @staticmethod
    def _chuan_hoa_chat_timestamp(value: Any) -> Any:
        """Keep chat timestamps in a stable, non-empty format when available."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return value
        text = str(value).strip()
        return text or None

    def _chuan_hoa_chat_item(
        self,
        item: Any,
        *,
        fallback_role: str = "server",
        fallback_content: str | None = None,
    ) -> dict[str, Any] | None:
        """Normalize chat payload variants into a single message shape."""
        source = dict(item) if isinstance(item, dict) else {}
        content = self._chu_dau_tien(source, ("content", "message", "text", "msg"))
        if content is None:
            content = fallback_content.strip() if isinstance(fallback_content, str) else None
        if not content:
            return None

        role = self._chuan_hoa_chat_role(
            source.get("message_type", source.get("role", source.get("sender"))),
            fallback=fallback_role,
        )
        normalized = dict(source)
        normalized["content"] = content
        normalized["message_type"] = role
        normalized["role"] = role
        normalized["sender"] = role

        timestamp = self._chuan_hoa_chat_timestamp(
            source.get(
                "ts",
                source.get(
                    "timestamp",
                    source.get("time", source.get("created_at", source.get("createdAt"))),
                ),
            )
        )
        if timestamp is not None:
            normalized["ts"] = timestamp

        return normalized

    @staticmethod
    def _la_chat_item_trung(current: dict[str, Any], incoming: dict[str, Any]) -> bool:
        """Detect when an optimistic local echo should be replaced by the real payload."""
        current_id = str(
            current.get("id", current.get("message_id", current.get("_local_echo_id"))) or ""
        ).strip()
        incoming_id = str(
            incoming.get("id", incoming.get("message_id", incoming.get("_local_echo_id"))) or ""
        ).strip()
        if current_id and incoming_id and current_id == incoming_id:
            return True

        current_ts = current.get("ts")
        incoming_ts = incoming.get("ts")
        if current_ts is not None and incoming_ts is not None and current_ts == incoming_ts:
            return True

        same_role = current.get("message_type") == incoming.get("message_type")
        same_content = current.get("content") == incoming.get("content")
        current_local = Esp32AiboxMediaPlayer._ep_kieu_bool(current.get("_local_echo"), False)
        incoming_local = Esp32AiboxMediaPlayer._ep_kieu_bool(incoming.get("_local_echo"), False)
        return same_role and same_content and current_local != incoming_local and (
            current_local or incoming_local
        )

    def _hop_nhat_chat_items(self, *groups: Any, limit: int = 50) -> list[dict[str, Any]]:
        """Merge chat messages while preserving order and replacing optimistic echoes."""
        merged: list[dict[str, Any]] = []
        for group in groups:
            if not isinstance(group, list):
                continue
            for raw_item in group:
                normalized = self._chuan_hoa_chat_item(raw_item)
                if normalized is None:
                    continue
                if merged and self._la_chat_item_trung(merged[-1], normalized):
                    merged_item = dict(merged[-1])
                    merged_item.update(normalized)
                    if not self._ep_kieu_bool(normalized.get("_local_echo"), False):
                        merged_item.pop("_local_echo", None)
                        merged_item.pop("_local_echo_id", None)
                    merged[-1] = merged_item
                else:
                    merged.append(normalized)
        return merged[-max(1, limit) :]

    def _cap_nhat_trang_thai_chat_tu_phan_hoi(self, response: dict[str, Any]) -> None:
        """Normalize chat state payload variants into entity attributes."""
        state_value = response.get("state", response.get("chat_state", response.get("status")))
        if state_value is None:
            if any(
                key in response
                for key in ("button_text", "buttonText", "button_enabled", "buttonEnabled")
            ):
                state_value = "ready"
            elif "success" in response:
                state_value = "ready" if self._ep_kieu_bool(response.get("success"), False) else "unavailable"

        if state_value is not None:
            state_text = str(state_value).strip()
            if state_text:
                self._chat_state["state"] = state_text

        if "button_text" in response or "buttonText" in response or "text" in response:
            button_text = response.get("button_text", response.get("buttonText", response.get("text")))
            self._chat_state["button_text"] = "" if button_text is None else str(button_text)

        parsed_enabled = None
        if "button_enabled" in response or "buttonEnabled" in response or "enabled" in response:
            current_enabled = self._ep_kieu_bool(self._chat_state.get("button_enabled"), False)
            button_enabled = response.get(
                "button_enabled",
                response.get("buttonEnabled", response.get("enabled")),
            )
            parsed_enabled = self._ep_kieu_bool(button_enabled, current_enabled)
            self._chat_state["button_enabled"] = parsed_enabled

        if parsed_enabled is None:
            inferred_enabled = _suy_ra_chat_button_enabled(self._chat_state.get("state"))
            if inferred_enabled is not None:
                self._chat_state["button_enabled"] = inferred_enabled

        if "type" in response:
            self._chat_state["last_response_type"] = response.get("type")

    def _tao_ket_qua_tim_kiem_rut_gon(
        self,
        source: str,
        query: str,
        response: dict[str, Any],
    ) -> dict[str, Any]:
        """Compress search payload so it fits comfortably in entity attributes."""
        songs = response.get("songs")
        compact_items: list[dict[str, Any]] = []
        if isinstance(songs, list):
            for song in songs[:10]:
                if not isinstance(song, dict):
                    continue
                compact_items.append(
                    {
                        "title": self._chu_dau_tien(song, ("title", "name")) or "Unknown",
                        "id": self._chu_dau_tien(
                            song,
                            ("song_id", "video_id", "playlist_id", "id"),
                        ),
                        "artist": self._chu_dau_tien(song, ("artist", "channel", "author")),
                        "duration_seconds": song.get("duration_seconds"),
                        "thumbnail_url": self._chu_dau_tien(song, ("thumbnail_url", "thumbnail")),
                    }
                )

        return {
            "source": source,
            "query": query,
            "success": bool(response.get("success", False)),
            "total": len(songs) if isinstance(songs, list) else 0,
            "updated_at_ms": int(time.time() * 1000),
            "items": compact_items,
        }


    def _lay_audio_config_hien_tai(self) -> dict[str, Any]:
        """Return merged audio config with optimistic fallback."""
        current = dict(self._system_state.get("audio_config") or {})
        status_audio = self.coordinator.data.audio_state
        if status_audio:
            current.update(status_audio)
        return current

    def _luu_audio_config_cuc_bo(self, audio_config: dict[str, Any]) -> None:
        """Persist optimistic audio config until coordinator polls fresh data."""
        self._system_state["audio_config"] = audio_config
        self.coordinator.data.audio_state = audio_config

    def _cap_nhat_audio_section_cuc_bo(self, section_name: str, values: dict[str, Any]) -> None:
        """Update one audio section in optimistic state."""
        audio_config = self._lay_audio_config_hien_tai()
        section = dict(audio_config.get(section_name) or {})
        section.update(values)
        audio_config[section_name] = section
        self._luu_audio_config_cuc_bo(audio_config)

    def _cap_nhat_eq_band_cuc_bo(self, band: int, level: int) -> None:
        """Update one EQ band level in optimistic state."""
        audio_config = self._lay_audio_config_hien_tai()
        eq_state = dict(audio_config.get("eq") or {})
        bands = dict(eq_state.get("Bands") or {})
        existing_list = bands.get("list")
        band_list: list[dict[str, Any]] = []
        if isinstance(existing_list, list):
            for item in existing_list:
                band_list.append(dict(item) if isinstance(item, dict) else {})
        while len(band_list) <= int(band):
            band_list.append({})
        band_list[int(band)]["BandLevel"] = int(level)
        bands["list"] = band_list
        eq_state["Bands"] = bands
        audio_config["eq"] = eq_state
        self._luu_audio_config_cuc_bo(audio_config)

    def _luu_system_payload(self, key: str, payload: Any) -> None:
        """Store one system payload for Lovelace rendering."""
        if isinstance(payload, dict):
            self._system_state[key] = dict(payload)
        elif isinstance(payload, list):
            self._system_state[key] = list(payload)
        else:
            self._system_state[key] = payload

    def _cap_nhat_system_monitor_cuc_bo(self, response: dict[str, Any]) -> None:
        if isinstance(response, dict):
            response = dict(response)
            response.setdefault("type", "system_monitor")
            response.setdefault("updated_at_ms", int(time.time() * 1000))
            self._system_state["system_monitor"] = response

    def _cap_nhat_wifi_state_cuc_bo(self, response: dict[str, Any]) -> None:
        """Merge WiFi responses from scan/status/saved calls."""
        current = dict(self._system_state.get("wifi_status") or {})
        response = dict(response or {})
        msg_type = str(response.get("type") or "").strip().lower()
        if msg_type == "wifi_scan_result":
            current["scanned_networks"] = response.get("networks") if isinstance(response.get("networks"), list) else []
        elif msg_type == "wifi_saved_result":
            current["saved_networks"] = response.get("networks") if isinstance(response.get("networks"), list) else []
        else:
            current.update(response)
        current["updated_at_ms"] = int(time.time() * 1000)
        self._system_state["wifi_status"] = current

    def _cap_nhat_alarm_state_cuc_bo(self, response: dict[str, Any]) -> None:
        """Merge alarm related responses for Lovelace rendering."""
        if not isinstance(response, dict):
            return
        msg_type = str(response.get("type") or "").strip().lower()
        if msg_type == "alarm_list":
            self._system_state["alarm_list"] = dict(response)
            return
        if msg_type == "alarm_triggered":
            banner = dict(response)
            banner["active"] = True
            self._system_state["alarm_banner"] = banner
            return
        if msg_type == "alarm_stopped":
            banner = dict(response)
            banner["active"] = False
            self._system_state["alarm_banner"] = banner
            return
        self._system_state["last_alarm_event"] = dict(response)

    def _clear_alarm_banner(self) -> None:
        """Hide the active alarm banner in local state."""
        self._system_state["alarm_banner"] = {"active": False}

    async def async_send_keycode(self, keycode: int) -> None:
        """Entity service: send Android keycode."""
        await self._client.async_send_keycode(keycode)
        await self.coordinator.async_request_refresh()

    async def async_run_command(self, command: str, type_id: str = "myshell") -> None:
        """Entity service: execute shell command through /do-cmd."""
        if self._is_ws_native:
            await self._client.async_shell(command, type_id=type_id)
        else:
            await self._client.async_do_cmd(command)
        await self.coordinator.async_request_refresh()

    async def async_send_message(
        self,
        what: int,
        arg1: int,
        arg2: int = -1,
        obj: Any = True,
        type_id: str | None = None,
    ) -> None:
        """Entity service: send native `send_message` payload."""
        await self._client.async_send_message(
            what=what,
            arg1=arg1,
            arg2=arg2,
            obj=obj,
            type_id=type_id,
        )
        await self.coordinator.async_request_refresh()

    async def async_ws_send_payload(self, payload: str, expect_type: str | None = None) -> None:
        """Entity service: send generic WS payload as JSON string."""
        parsed = json.loads(payload)
        if not isinstance(parsed, dict):
            raise ValueError("payload must be a JSON object")
        await self._client.async_ws_send_payload(parsed, expect_type=expect_type)
        await self.coordinator.async_request_refresh()

    async def async_search_youtube(self, query: str) -> None:
        """Entity service: search YouTube songs."""
        response = await self._client.async_search_youtube(query)
        self._last_search = self._tao_ket_qua_tim_kiem_rut_gon(
            source="youtube",
            query=query.strip(),
            response=response,
        )
        self.async_write_ha_state()

    async def async_search_playlist(self, query: str) -> None:
        """Entity service: search YouTube playlists."""
        response = await self._client.async_search_playlist(query)
        self._last_search = self._tao_ket_qua_tim_kiem_rut_gon(
            source="youtube_playlist",
            query=query.strip(),
            response=response,
        )
        self.async_write_ha_state()

    async def async_search_zing(self, query: str) -> None:
        """Entity service: search Zing MP3 songs."""
        response = await self._client.async_search_zing(query)
        self._last_search = self._tao_ket_qua_tim_kiem_rut_gon(
            source="zingmp3",
            query=query.strip(),
            response=response,
        )
        self.async_write_ha_state()

    def _chuan_hoa_danh_sach_loa_multiroom(self, speaker_entities: list[str] | None) -> list[str]:
        """Normalize multiroom speaker entity ids and remove duplicates."""
        if not speaker_entities:
            return []

        normalized: list[str] = []
        seen: set[str] = set()
        for entity_id in speaker_entities:
            candidate = str(entity_id or "").strip()
            if not candidate or not candidate.startswith("media_player.") or candidate in seen:
                continue
            seen.add(candidate)
            normalized.append(candidate)
        return normalized

    async def _async_play_youtube_local(self, video_id: str) -> None:
        """Play YouTube locally on the current entity."""
        await self._client.async_play_youtube(video_id)
        self._last_play = {"source": "youtube", "id": video_id}
        self._last_play_pause_sent = "play"
        await self.coordinator.async_request_refresh()

    async def _async_play_zing_local(self, song_id: str) -> None:
        """Play Zing locally on the current entity."""
        await self._client.async_play_zing(song_id)
        self._last_play = {"source": "zingmp3", "id": song_id}
        self._last_play_pause_sent = "play"
        await self.coordinator.async_request_refresh()

    async def _async_goi_service_multiroom_target(
        self,
        service_name: str,
        entity_id: str,
        service_data: dict[str, Any],
    ) -> None:
        """Call the custom play service on a target speaker with domain fallback."""
        payload = {"entity_id": entity_id, **service_data}
        candidate_domains = [
            "esp32_aibox_media_controller",
            "media_player",
        ]
        last_error: Exception | None = None

        for domain in candidate_domains:
            try:
                if self.hass.services.has_service(domain, service_name):
                    await self.hass.services.async_call(
                        domain,
                        service_name,
                        payload,
                        blocking=True,
                    )
                    return
            except Exception as err:
                last_error = err

        if last_error is not None:
            raise last_error

        raise HomeAssistantError(
            f"Service not found for multiroom target {entity_id}: {service_name}"
        )

    async def _async_dispatch_multiroom_play(
        self,
        *,
        service_name: str,
        service_data: dict[str, Any],
        speaker_entities: list[str],
        local_coro_factory,
    ) -> None:
        """Dispatch the same play command to multiple speakers in parallel."""
        tasks: list[asyncio.Future] = []

        for entity_id in speaker_entities:
            if entity_id == self.entity_id:
                tasks.append(asyncio.create_task(local_coro_factory()))
                continue

            tasks.append(
                asyncio.create_task(
                    self._async_goi_service_multiroom_target(
                        service_name,
                        entity_id,
                        service_data,
                    )
                )
            )

        if not tasks:
            return

        results = await asyncio.gather(*tasks, return_exceptions=True)
        errors: list[str] = []
        for entity_id, result in zip(speaker_entities, results):
            if isinstance(result, Exception):
                errors.append(f"{entity_id}: {result}")

        if errors:
            raise HomeAssistantError("Multiroom play failed for: " + "; ".join(errors))

    async def async_play_youtube(
        self,
        video_id: str,
        speaker_entities: list[str] | None = None,
    ) -> None:
        """Entity service: play YouTube song by video id, optionally on many speakers."""
        normalized_video_id = video_id.strip()
        targets = self._chuan_hoa_danh_sach_loa_multiroom(speaker_entities)

        if targets and not (len(targets) == 1 and targets[0] == self.entity_id):
            await self._async_dispatch_multiroom_play(
                service_name=SERVICE_PLAY_YOUTUBE,
                service_data={ATTR_VIDEO_ID: normalized_video_id},
                speaker_entities=targets,
                local_coro_factory=lambda: self._async_play_youtube_local(normalized_video_id),
            )
            return

        await self._async_play_youtube_local(normalized_video_id)

    async def async_play_zing(
        self,
        song_id: str,
        speaker_entities: list[str] | None = None,
    ) -> None:
        """Entity service: play Zing MP3 song by song id, optionally on many speakers."""
        normalized_song_id = song_id.strip()
        targets = self._chuan_hoa_danh_sach_loa_multiroom(speaker_entities)

        if targets and not (len(targets) == 1 and targets[0] == self.entity_id):
            await self._async_dispatch_multiroom_play(
                service_name=SERVICE_PLAY_ZING,
                service_data={ATTR_SONG_ID: normalized_song_id},
                speaker_entities=targets,
                local_coro_factory=lambda: self._async_play_zing_local(normalized_song_id),
            )
            return

        await self._async_play_zing_local(normalized_song_id)

    async def async_wake_word_set_enabled(self, enabled: bool) -> None:
        """Entity service: enable/disable wake word."""
        response = await self._client.async_wake_word_set_enabled(enabled)
        enabled_value = response.get("enabled", response.get("enable", response.get("state", enabled)))
        self._wake_word["enabled"] = self._ep_kieu_bool(enabled_value, bool(enabled))
        self._wake_word["last_response_type"] = response.get("type")
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_wake_word_get_enabled(self) -> None:
        """Entity service: get wake word enabled state."""
        response = await self._client.async_wake_word_get_enabled()
        if "enabled" in response or "enable" in response or "state" in response:
            self._wake_word["enabled"] = self._ep_kieu_bool(
                response.get("enabled", response.get("enable", response.get("state"))),
                self._wake_word.get("enabled", False),
            )
        self._wake_word["last_response_type"] = response.get("type")
        self.async_write_ha_state()

    async def async_wake_word_set_sensitivity(self, sensitivity: float) -> None:
        """Entity service: set wake word sensitivity (0..1)."""
        response = await self._client.async_wake_word_set_sensitivity(sensitivity)
        sensitivity_value = response.get("sensitivity", response.get("value", sensitivity))
        with suppress(TypeError, ValueError):
            self._wake_word["sensitivity"] = float(sensitivity_value)
        self._wake_word["last_response_type"] = response.get("type")
        self.async_write_ha_state()

    async def async_wake_word_get_sensitivity(self) -> None:
        """Entity service: get wake word sensitivity."""
        response = await self._client.async_wake_word_get_sensitivity()
        if "sensitivity" in response or "value" in response:
            with suppress(TypeError, ValueError):
                self._wake_word["sensitivity"] = float(
                    response.get("sensitivity", response.get("value"))
                )
        self._wake_word["last_response_type"] = response.get("type")
        self.async_write_ha_state()

    async def async_custom_ai_set_enabled(self, enabled: bool) -> None:
        """Entity service: enable/disable Custom AI (chống điếc AI)."""
        response = await self._client.async_custom_ai_set_enabled(enabled)
        enabled_value = response.get("enabled", response.get("enable", response.get("state", enabled)))
        self._custom_ai["enabled"] = self._ep_kieu_bool(enabled_value, bool(enabled))
        self._custom_ai["last_response_type"] = response.get("type")
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_custom_ai_get_enabled(self) -> None:
        """Entity service: query Custom AI state."""
        response = await self._client.async_custom_ai_get_enabled()
        if "enabled" in response or "enable" in response or "state" in response:
            self._custom_ai["enabled"] = self._ep_kieu_bool(
                response.get("enabled", response.get("enable", response.get("state"))),
                self._custom_ai.get("enabled", False),
            )
        self._custom_ai["last_response_type"] = response.get("type")
        self.async_write_ha_state()

    async def async_anti_deaf_ai_set_enabled(self, enabled: bool) -> None:
        """Alias service for custom_ai_set_enabled."""
        await self.async_custom_ai_set_enabled(enabled)

    async def async_anti_deaf_ai_get_enabled(self) -> None:
        """Alias service for custom_ai_get_enabled."""
        await self.async_custom_ai_get_enabled()

    async def async_chat_wake_up(self) -> None:
        """Entity service: trigger chat wake-up."""
        response = await self._client.async_chat_wake_up()
        self._cap_nhat_trang_thai_chat_tu_phan_hoi(response)
        self.async_write_ha_state()

    async def async_chat_test_mic(self) -> None:
        """Entity service: trigger chat mic test."""
        response = await self._client.async_chat_test_mic()
        self._chat_state["test_mic_state"] = response.get(
            "state",
            response.get("chat_state", response.get("status")),
        )
        self._chat_state["test_mic_button_text"] = response.get(
            "button_text",
            response.get("buttonText", response.get("text")),
        )
        self._cap_nhat_trang_thai_chat_tu_phan_hoi(response)
        self.async_write_ha_state()

    async def async_chat_get_state(self) -> None:
        """Entity service: query chat state."""
        response = await self._client.async_chat_get_state()
        self._cap_nhat_trang_thai_chat_tu_phan_hoi(response)
        self.async_write_ha_state()

    async def async_chat_send_text(self, text: str) -> None:
        """Entity service: send chat text."""
        local_item = self._chuan_hoa_chat_item(
            {
                "content": text,
                "message_type": "user",
                "ts": int(time.time() * 1000),
                "_local_echo": True,
                "_local_echo_id": f"local-{time.time_ns()}",
            }
        )
        if local_item is not None:
            self._last_chat_items = self._hop_nhat_chat_items(
                self._last_chat_items,
                [local_item],
                limit=50,
            )
            self.async_write_ha_state()

        response = await self._client.async_chat_send_text(text)
        items = response.get("items") or []
        if isinstance(items, list):
            self._last_chat_items = self._hop_nhat_chat_items(
                self._last_chat_items,
                items,
                limit=50,
            )
        self.async_write_ha_state()

    async def async_chat_get_history(self) -> None:
        """Entity service: load recent chat history."""
        response = await self._client.async_chat_get_history()
        items = response.get("items") or []
        merged = self._hop_nhat_chat_items(items, limit=50)
        if merged:
            self._last_chat_items = merged
        self.async_write_ha_state()

    async def async_tiktok_reply_toggle(self, enabled: bool) -> None:
        """Entity service: toggle TikTok auto reply."""
        response = await self._client.async_tiktok_reply_toggle(enabled)
        self._chat_state["tiktok_reply_enabled"] = self._ep_kieu_bool(
            response.get("enabled", enabled),
            bool(enabled),
        )
        self._chat_state["last_response_type"] = response.get("type")
        self.async_write_ha_state()

    async def async_upload_chat_background(self, image: str) -> None:
        """Entity service: upload chat background image."""
        response = await self._client.async_upload_chat_background(image)
        if self._ep_kieu_bool(response.get("success", True), True):
            self._chat_background = str(image or "")
        self.async_write_ha_state()

    async def async_get_chat_background(self) -> None:
        """Entity service: fetch current chat background image."""
        response = await self._client.async_get_chat_background()
        image = response.get("image")
        self._chat_background = "" if image is None else str(image)
        self.async_write_ha_state()

    async def async_remove_chat_background(self) -> None:
        """Entity service: remove current chat background image."""
        response = await self._client.async_remove_chat_background()
        if self._ep_kieu_bool(response.get("success", True), True):
            self._chat_background = ""
        self.async_write_ha_state()

    async def async_set_dlna(self, enabled: bool) -> None:
        """Entity service: toggle DLNA autostart."""
        info = await self._client.async_set_dlna(enabled)
        observed = self._client._aibox_phan_tich_bool(info.get("dlna_open"))
        self.coordinator.data.raw["dlna_open"] = bool(enabled) if observed is None else observed
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_airplay(self, enabled: bool) -> None:
        """Entity service: toggle AirPlay autostart."""
        info = await self._client.async_set_airplay(enabled)
        observed = self._client._aibox_phan_tich_bool(info.get("airplay_open"))
        self.coordinator.data.raw["airplay_open"] = bool(enabled) if observed is None else observed
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_bluetooth(self, enabled: bool) -> None:
        """Entity service: toggle bluetooth."""
        info = await self._client.async_set_bluetooth(enabled)
        observed = self._client._ws_la_bluetooth_bat(info.get("device_state"))
        if "device_state" in info:
            self.coordinator.data.raw["device_state"] = info.get("device_state")
        else:
            self.coordinator.data.raw["device_state"] = 3 if (bool(enabled) if observed is None else observed) else 0
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_main_light(self, enabled: bool) -> None:
        """Entity service: toggle ambient main light."""
        info = await self._client.async_set_main_light(enabled)
        observed = self._client._aibox_phan_tich_bool(info.get("music_light_enable"))
        resolved = bool(enabled) if observed is None else observed
        self._system_state["music_light_enable"] = resolved
        self.coordinator.data.raw["music_light_enable"] = resolved
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_light_mode(self, mode: int) -> None:
        """Entity service: set light effect mode."""
        await self._client.async_set_light_mode(mode)
        self._system_state["music_light_mode"] = int(mode)
        self.coordinator.data.raw["music_light_mode"] = int(mode)
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_light_speed(self, speed: int) -> None:
        """Entity service: set light speed."""
        await self._client.async_set_light_speed(speed)
        self._system_state["music_light_chroma"] = int(speed)
        self.coordinator.data.raw["music_light_chroma"] = int(speed)
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_light_brightness(self, brightness: int) -> None:
        """Entity service: set light brightness."""
        await self._client.async_set_light_brightness(brightness)
        self._system_state["music_light_luma"] = int(brightness)
        self.coordinator.data.raw["music_light_luma"] = int(brightness)
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_edge_light(self, enabled: bool, intensity: int | None = None) -> None:
        """Entity service: set edge white light state/intensity."""
        await self._client.async_set_edge_light(enabled=enabled, intensity=intensity)
        edge_state = dict(self._system_state.get("edge_light") or {})
        edge_state["enabled"] = bool(enabled)
        if intensity is not None:
            edge_state["intensity"] = int(intensity)
        elif "intensity" not in edge_state:
            edge_state["intensity"] = 100 if enabled else 0
        self._system_state["edge_light"] = edge_state
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_bass_enable(self, enabled: bool) -> None:
        """Entity service: toggle bass enhancement."""
        await self._client.async_set_bass_enable(enabled)
        self._cap_nhat_audio_section_cuc_bo(
            "bass",
            {
                "Bass_Enable": bool(enabled),
                "sound_effects_bass_enable": bool(enabled),
            },
        )
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_bass_strength(self, strength: int) -> None:
        """Entity service: set bass strength."""
        await self._client.async_set_bass_strength(strength)
        self._cap_nhat_audio_section_cuc_bo("bass", {"Current_Strength": int(strength)})
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_loudness_enable(self, enabled: bool) -> None:
        """Entity service: toggle loudness."""
        await self._client.async_set_loudness_enable(enabled)
        self._cap_nhat_audio_section_cuc_bo(
            "loudness",
            {
                "Loudness_Enable": bool(enabled),
                "sound_effects_loudness_enable": bool(enabled),
            },
        )
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_loudness_gain(self, gain: int) -> None:
        """Entity service: set loudness gain."""
        await self._client.async_set_loudness_gain(gain)
        self._cap_nhat_audio_section_cuc_bo("loudness", {"Current_Gain": int(gain)})
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_eq_enable(self, enabled: bool) -> None:
        """Entity service: toggle EQ."""
        await self._client.async_set_eq_enable(enabled)
        self._cap_nhat_audio_section_cuc_bo(
            "eq",
            {
                "Eq_Enable": bool(enabled),
                "sound_effects_eq_enable": bool(enabled),
            },
        )
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_eq_bandlevel(self, band: int, level: int) -> None:
        """Entity service: set EQ band level."""
        await self._client.async_set_eq_bandlevel(band=band, level=level)
        self._cap_nhat_eq_band_cuc_bo(band=band, level=level)
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_set_mixer_value(self, control_name: str, value: int) -> None:
        """Entity service: set mixer control value."""
        await self._client.async_set_mixer_value(control_name=control_name, value=value)
        await self.coordinator.async_request_refresh()

    async def async_set_play_mode(self, mode: int) -> None:
        """Entity service: set play mode."""
        await self._client.async_set_play_mode(mode)
        await self.coordinator.async_request_refresh()

    async def async_reboot(self) -> None:
        """Entity service: reboot speaker."""
        await self._client.async_reboot()
        await self.coordinator.async_request_refresh()

    async def async_seek(self, position: int) -> None:
        """Entity service: seek to position in seconds."""
        await self._client.async_aibox_seek(position)
        self.async_write_ha_state()

    async def async_toggle_repeat(self) -> None:
        """Entity service: toggle repeat mode."""
        await self._client.async_aibox_toggle_repeat()
        await self.coordinator.async_request_refresh()

    async def async_toggle_auto_next(self) -> None:
        """Entity service: toggle auto-next mode."""
        await self._client.async_aibox_toggle_auto_next()
        await self.coordinator.async_request_refresh()

    async def async_led_toggle(self) -> None:
        """Entity service: toggle LED on/off."""
        response = await self._client.async_led_toggle()
        self._led_state = response
        self.async_write_ha_state()
        await self.coordinator.async_request_refresh()

    async def async_led_get_state(self) -> None:
        """Entity service: get LED state."""
        response = await self._client.async_led_get_state()
        self._led_state = response
        self.async_write_ha_state()

    async def async_stereo_enable(self) -> None:
        """Entity service: enable stereo pairing."""
        response = await self._client.async_stereo_enable()
        self._stereo_state = response
        self.async_write_ha_state()

    async def async_stereo_disable(self) -> None:
        """Entity service: disable stereo pairing."""
        response = await self._client.async_stereo_disable()
        self._stereo_state = response
        self.async_write_ha_state()

    async def async_stereo_set_channel(self, channel: str) -> None:
        """Entity service: set stereo channel (left/right)."""
        response = await self._client.async_stereo_set_channel(channel)
        self._stereo_state = response
        self.async_write_ha_state()

    async def async_stereo_get_state(self) -> None:
        """Entity service: get stereo pairing state."""
        response = await self._client.async_stereo_get_state()
        self._stereo_state = response
        self.async_write_ha_state()


    async def async_alarm_list(self) -> None:
        """Entity service: fetch configured alarms."""
        response = await self._client.async_alarm_list()
        self._cap_nhat_alarm_state_cuc_bo(response)
        self.async_write_ha_state()

    async def async_alarm_stop(self) -> None:
        """Entity service: stop active alarm."""
        response = await self._client.async_alarm_stop()
        self._cap_nhat_alarm_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_alarm_list()
            self._cap_nhat_alarm_state_cuc_bo(follow_up)
        self.async_write_ha_state()

    async def async_alarm_add(
        self,
        hour: int,
        minute: int,
        repeat: str = "none",
        label: str = "",
        volume: int = 100,
        custom_sound_path: str | None = None,
        youtube_song_name: str | None = None,
        selected_days: list[str] | None = None,
    ) -> None:
        """Entity service: add a new alarm."""
        response = await self._client.async_alarm_add(
            hour=hour,
            minute=minute,
            repeat=repeat,
            label=label,
            volume=volume,
            custom_sound_path=custom_sound_path,
            youtube_song_name=youtube_song_name,
            selected_days=selected_days,
        )
        self._cap_nhat_alarm_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_alarm_list()
            self._cap_nhat_alarm_state_cuc_bo(follow_up)
        self.async_write_ha_state()

    async def async_alarm_edit(
        self,
        alarm_id: str,
        hour: int,
        minute: int,
        repeat: str = "none",
        label: str = "",
        volume: int = 100,
        custom_sound_path: str | None = None,
        youtube_song_name: str | None = None,
        selected_days: list[str] | None = None,
    ) -> None:
        """Entity service: edit an existing alarm."""
        response = await self._client.async_alarm_edit(
            alarm_id=alarm_id,
            hour=hour,
            minute=minute,
            repeat=repeat,
            label=label,
            volume=volume,
            custom_sound_path=custom_sound_path,
            youtube_song_name=youtube_song_name,
            selected_days=selected_days,
        )
        self._cap_nhat_alarm_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_alarm_list()
            self._cap_nhat_alarm_state_cuc_bo(follow_up)
        self.async_write_ha_state()

    async def async_alarm_delete(self, alarm_id: str) -> None:
        """Entity service: delete one alarm."""
        response = await self._client.async_alarm_delete(alarm_id)
        self._cap_nhat_alarm_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_alarm_list()
            self._cap_nhat_alarm_state_cuc_bo(follow_up)
        self.async_write_ha_state()

    async def async_alarm_toggle(self, alarm_id: str) -> None:
        """Entity service: toggle one alarm on/off."""
        response = await self._client.async_alarm_toggle(alarm_id)
        self._cap_nhat_alarm_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_alarm_list()
            self._cap_nhat_alarm_state_cuc_bo(follow_up)
        self.async_write_ha_state()

    async def async_alarm_upload_sound(self, file_name: str, file_data: str, alarm_id: int = -1) -> None:
        """Entity service: upload custom alarm sound."""
        response = await self._client.async_alarm_upload_sound(
            file_name=file_name,
            file_data=file_data,
            alarm_id=alarm_id,
        )
        self._cap_nhat_alarm_state_cuc_bo(response)
        self.async_write_ha_state()

    async def async_ota_get(self) -> None:
        """Entity service: fetch OTA configuration."""
        response = await self._client.async_ota_get()
        self._luu_system_payload("ota_config", response)
        self.async_write_ha_state()

    async def async_ota_set(self, ota_url: str) -> None:
        """Entity service: update OTA configuration."""
        response = await self._client.async_ota_set(ota_url)
        self._luu_system_payload("ota_config", response)
        self.async_write_ha_state()

    async def async_mac_get(self) -> None:
        """Entity service: fetch MAC information."""
        response = await self._client.async_mac_get()
        self._luu_system_payload("mac_info", response)
        self.async_write_ha_state()

    async def async_mac_random(self) -> None:
        """Entity service: randomize MAC address."""
        response = await self._client.async_mac_random()
        self._luu_system_payload("mac_info", response)
        self.async_write_ha_state()

    async def async_mac_clear(self) -> None:
        """Entity service: restore hardware MAC address."""
        response = await self._client.async_mac_clear()
        self._luu_system_payload("mac_info", response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_mac_get()
            self._luu_system_payload("mac_info", follow_up)
        self.async_write_ha_state()

    async def async_hass_get(self) -> None:
        """Entity service: fetch Home Assistant bridge config."""
        response = await self._client.async_hass_get()
        self._luu_system_payload("hass_config", response)
        self.async_write_ha_state()

    async def async_hass_set(self, url: str = "", api_key: str | None = None, agent_id: str = "") -> None:
        """Entity service: save Home Assistant bridge config."""
        response = await self._client.async_hass_set(url=url, api_key=api_key, agent_id=agent_id)
        self._luu_system_payload("hass_config", response)
        self.async_write_ha_state()

    async def async_weather_province_get(self) -> None:
        """Entity service: fetch weather province."""
        response = await self._client.async_weather_province_get()
        self._luu_system_payload("weather_province", response)
        self.async_write_ha_state()

    async def async_weather_province_set(self, name: str = "", lat: float = 0, lon: float = 0) -> None:
        """Entity service: save weather province."""
        response = await self._client.async_weather_province_set(name=name, lat=lat, lon=lon)
        self._luu_system_payload("weather_province", response)
        self.async_write_ha_state()

    async def async_wifi_scan(self) -> None:
        """Entity service: scan nearby WiFi networks."""
        response = await self._client.async_wifi_scan()
        self._cap_nhat_wifi_state_cuc_bo(response)
        self.async_write_ha_state()

    async def async_wifi_connect(
        self,
        ssid: str | None = None,
        password: str = "",
        security_type: str = "wpa",
        network_id: int | None = None,
    ) -> None:
        """Entity service: connect to WiFi."""
        response = await self._client.async_wifi_connect(
            ssid=ssid,
            password=password,
            security_type=security_type,
            network_id=network_id,
        )
        self._cap_nhat_wifi_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_wifi_get_status()
            self._cap_nhat_wifi_state_cuc_bo(follow_up)
        with suppress(Esp32AiboxApiError):
            saved = await self._client.async_wifi_get_saved()
            self._cap_nhat_wifi_state_cuc_bo(saved)
        self.async_write_ha_state()

    async def async_wifi_get_status(self) -> None:
        """Entity service: fetch WiFi status."""
        response = await self._client.async_wifi_get_status()
        self._cap_nhat_wifi_state_cuc_bo(response)
        self.async_write_ha_state()

    async def async_wifi_get_saved(self) -> None:
        """Entity service: fetch saved WiFi networks."""
        response = await self._client.async_wifi_get_saved()
        self._cap_nhat_wifi_state_cuc_bo(response)
        self.async_write_ha_state()

    async def async_wifi_delete_saved(self, ssid: str | None = None, network_id: int | None = None) -> None:
        """Entity service: delete one saved WiFi network."""
        response = await self._client.async_wifi_delete_saved(ssid=ssid, network_id=network_id)
        self._cap_nhat_wifi_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            saved = await self._client.async_wifi_get_saved()
            self._cap_nhat_wifi_state_cuc_bo(saved)
        self.async_write_ha_state()

    async def async_wifi_start_ap(self) -> None:
        """Entity service: enable AP mode."""
        response = await self._client.async_wifi_start_ap()
        self._cap_nhat_wifi_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_wifi_get_status()
            self._cap_nhat_wifi_state_cuc_bo(follow_up)
        self.async_write_ha_state()

    async def async_wifi_stop_ap(self) -> None:
        """Entity service: disable AP mode."""
        response = await self._client.async_wifi_stop_ap()
        self._cap_nhat_wifi_state_cuc_bo(response)
        with suppress(Esp32AiboxApiError):
            follow_up = await self._client.async_wifi_get_status()
            self._cap_nhat_wifi_state_cuc_bo(follow_up)
        self.async_write_ha_state()

    async def async_led_get_state(self) -> None:
        """Entity service: get LED state."""
        response = await self._client.async_led_get_state()
        self._led_state = response
        self.async_write_ha_state()

    async def async_stereo_enable(self) -> None:
        """Entity service: enable stereo pairing."""
        response = await self._client.async_stereo_enable()
        self._stereo_state = response
        self.async_write_ha_state()

    async def async_stereo_disable(self) -> None:
        """Entity service: disable stereo pairing."""
        response = await self._client.async_stereo_disable()
        self._stereo_state = response
        self.async_write_ha_state()

    async def async_stereo_set_channel(self, channel: str) -> None:
        """Entity service: set stereo channel (left/right)."""
        response = await self._client.async_stereo_set_channel(channel)
        self._stereo_state = response
        self.async_write_ha_state()

    async def async_stereo_get_state(self) -> None:
        """Entity service: get stereo pairing state."""
        response = await self._client.async_stereo_get_state()
        self._stereo_state = response
        self.async_write_ha_state()

    async def async_refresh_state(self) -> None:
        """Entity service: force coordinator refresh and poll System tab data."""
        with suppress(Esp32AiboxApiError):
            system_monitor = await self._client.async_get_system_monitor()
            self._cap_nhat_system_monitor_cuc_bo(system_monitor)
        with suppress(Esp32AiboxApiError):
            led_state = await self._client.async_led_get_state()
            self._led_state = led_state
        with suppress(Esp32AiboxApiError):
            alarm_list = await self._client.async_alarm_list()
            self._cap_nhat_alarm_state_cuc_bo(alarm_list)
        with suppress(Esp32AiboxApiError):
            ota = await self._client.async_ota_get()
            self._luu_system_payload("ota_config", ota)
        with suppress(Esp32AiboxApiError):
            mac_info = await self._client.async_mac_get()
            self._luu_system_payload("mac_info", mac_info)
        with suppress(Esp32AiboxApiError):
            hass_cfg = await self._client.async_hass_get()
            self._luu_system_payload("hass_config", hass_cfg)
        with suppress(Esp32AiboxApiError):
            weather = await self._client.async_weather_province_get()
            self._luu_system_payload("weather_province", weather)
        with suppress(Esp32AiboxApiError):
            wifi_status = await self._client.async_wifi_get_status()
            self._cap_nhat_wifi_state_cuc_bo(wifi_status)
        with suppress(Esp32AiboxApiError):
            wifi_saved = await self._client.async_wifi_get_saved()
            self._cap_nhat_wifi_state_cuc_bo(wifi_saved)
        await self.coordinator.async_request_refresh()
        self.async_write_ha_state()

    async def async_turn_on(self) -> None:
        """Turn the speaker on (power toggle)."""
        if self._is_ws_native:
            return
        await self._client.async_send_keycode(KEYCODE_POWER)
        await self.coordinator.async_request_refresh()

    async def async_turn_off(self) -> None:
        """Turn the speaker off (power toggle)."""
        if self._is_ws_native:
            return
        await self._client.async_send_keycode(KEYCODE_POWER)
        await self.coordinator.async_request_refresh()

    async def async_mute_volume(self, mute: bool) -> None:
        """Mute/unmute."""
        if self._is_ws_native:
            if mute:
                await self._client.async_set_absolute_volume(0)
            else:
                status = self.coordinator.data
                restore = max(1, int((status.volume_max or 100) * 0.2))
                await self._client.async_set_absolute_volume(restore)
            await self.coordinator.async_request_refresh()
            return
        current = self.coordinator.data.is_muted
        if current is None or current != mute:
            await self._client.async_send_keycode(KEYCODE_MUTE)
            await self.coordinator.async_request_refresh()

    async def async_volume_up(self) -> None:
        """Volume up."""
        await self._client.async_send_keycode(KEYCODE_VOLUME_UP)
        await self.coordinator.async_request_refresh()

    async def async_volume_down(self) -> None:
        """Volume down."""
        await self._client.async_send_keycode(KEYCODE_VOLUME_DOWN)
        await self.coordinator.async_request_refresh()

    async def async_set_volume_level(self, volume: float) -> None:
        """Set volume level."""
        status = self.coordinator.data
        if status.volume_min is not None and status.volume_max is not None:
            target = status.volume_min + ceil(
                max(0.0, min(1.0, volume)) * (status.volume_max - status.volume_min)
            )
            await self._client.async_set_absolute_volume(target)
            await self.coordinator.async_request_refresh()
            return

        current = status.volume_level
        if current is None:
            return
        diff = volume - current
        if abs(diff) < 0.01:
            return

        steps = max(1, min(15, ceil(abs(diff) * 15)))
        keycode = KEYCODE_VOLUME_UP if diff > 0 else KEYCODE_VOLUME_DOWN
        for _ in range(steps):
            await self._client.async_send_keycode(keycode)
        await self.coordinator.async_request_refresh()

    async def async_media_play(self) -> None:
        """Play media."""
        await self._thuc_hien_hanh_dong_media("play")

    async def async_media_pause(self) -> None:
        """Pause media."""
        await self._thuc_hien_hanh_dong_media("pause")

    async def async_media_play_pause(self) -> None:
        """Toggle play/pause (Aibox uses command-history toggle)."""
        prefer_aibox = self._uu_tien_dieu_khien_media_aibox()
        if prefer_aibox:
            desired = "play" if self._last_play_pause_sent == "pause" else "pause"
            _LOGGER.debug(
                "media_play_pause called: ws_native=%s prefer_aibox=%s last_play_pause_sent=%s desired=%s",
                self._is_ws_native,
                prefer_aibox,
                self._last_play_pause_sent,
                desired,
            )
            await self._thuc_hien_hanh_dong_media(desired)
            return

        coordinator_state = self.coordinator.data.playback_state
        live_state: str | None = None
        with suppress(Esp32AiboxApiError):
            live_state = await self._client.async_get_playback_state()

        effective_state = live_state or coordinator_state
        if effective_state == "playing":
            desired = "pause"
        elif effective_state in {"paused", "stopped"}:
            desired = "play"
        else:
            desired = "play" if self._last_play_pause_sent == "pause" else "pause"
        _LOGGER.debug(
            "media_play_pause called: ws_native=%s prefer_aibox=%s coordinator_state=%s live_state=%s effective_state=%s desired=%s",
            self._is_ws_native,
            prefer_aibox,
            coordinator_state,
            live_state,
            effective_state,
            desired,
        )
        await self._thuc_hien_hanh_dong_media(desired)

    async def async_media_stop(self) -> None:
        """Stop media."""
        await self._thuc_hien_hanh_dong_media("stop")

    async def async_media_next_track(self) -> None:
        """Next track."""
        await self._thuc_hien_hanh_dong_media("next")

    async def async_media_previous_track(self) -> None:
        """Previous track."""
        await self._thuc_hien_hanh_dong_media("previous")

    async def _thuc_hien_hanh_dong_media(self, action: str) -> None:
        """Send media action through selected API strategy."""
        prefer_aibox = self._uu_tien_dieu_khien_media_aibox()
        _LOGGER.debug(
            "media_action=%s ws_native=%s prefer_aibox=%s last_play=%s",
            action,
            self._is_ws_native,
            prefer_aibox,
            self._last_play,
        )
        if action in {"play", "pause"}:
            self._last_play_pause_sent = action
        if action == "toggle":
            if prefer_aibox:
                try:
                    await self._client.async_aibox_media_action("toggle")
                    await self.coordinator.async_request_refresh()
                    return
                except Esp32AiboxApiError:
                    _LOGGER.debug("Aibox toggle failed, fallback to keyevent play/pause")
            await self._client.async_send_keycode(KEYCODE_MEDIA_PLAY_PAUSE)
            await self.coordinator.async_request_refresh()
            return

        if self._is_ws_native:
            if prefer_aibox:
                try:
                    await self._client.async_aibox_media_action(action)
                    if action == "stop":
                        with suppress(Esp32AiboxApiError):
                            await self._client.async_send_keycode(KEYCODE_MEDIA_STOP)
                    await self.coordinator.async_request_refresh()
                    return
                except Esp32AiboxApiError:
                    _LOGGER.debug("Aibox media action failed in ws_native, fallback to native path")

            try:
                await self._client.async_media_dispatch(action)
            except Esp32AiboxApiError:
                await self._client.async_send_keycode(MEDIA_ACTION_TO_KEYCODE[action])
            await self.coordinator.async_request_refresh()
            return

        try:
            await self._client.async_aibox_media_action(action)
        except Esp32AiboxApiError:
            if self._use_media_dispatch:
                await self._client.async_media_dispatch(action)
            else:
                await self._client.async_send_keycode(MEDIA_ACTION_TO_KEYCODE[action])

        if action == "stop":
            with suppress(Esp32AiboxApiError):
                await self._client.async_send_keycode(KEYCODE_MEDIA_STOP)
        await self.coordinator.async_request_refresh()

    def _uu_tien_dieu_khien_media_aibox(self) -> bool:
        """Return true when current playback likely comes from Aibox (YouTube/Zing)."""
        source = str(self._last_play.get("source", "")).strip().lower()
        if source in {"youtube", "youtube_playlist", "zingmp3"}:
            return True
        last_search = self._last_search or {}
        search_source = str(last_search.get("source", "")).strip().lower()
        return search_source in {"youtube", "youtube_playlist", "zingmp3"}

    # ==========================================
    # LƯU TRỮ VÀ QUẢN LÝ PLAYLIST
    # ==========================================
    async def async_playlist_list(self):
        # Cập nhật số lượng bài hát
        for pl in self._stored_playlists:
            pl["song_count"] = len(self._stored_items.get(str(pl["id"]), []))
            
        self._playlist_library = {
            "updated_at_ms": int(time.time() * 1000),
            "success": True,
            "playlists": self._stored_playlists
        }
        self.async_write_ha_state()

    async def async_playlist_get_songs(self, playlist_id):
        pid = str(playlist_id)
        name = "Playlist"
        for pl in self._stored_playlists:
            if str(pl["id"]) == pid:
                name = pl.get("name", "Playlist")
                break
                
        self._playlist_detail = {
            "updated_at_ms": int(time.time() * 1000),
            "success": True,
            "playlist_id": pid,
            "playlist_name": name,
            "items": self._stored_items.get(pid, [])
        }
        self.async_write_ha_state()

    async def async_playlist_create(self, name):
        new_id = str(int(time.time()))
        self._stored_playlists.append({
            "id": new_id, 
            "name": name, 
            "song_count": 0
        })
        self._stored_items[new_id] = []
        await self._async_save_playlists()
        
        self._last_playlist_event = {
            "updated_at_ms": int(time.time() * 1000),
            "type": "playlist_created",
            "playlist_id": new_id,
            "success": True
        }
        self.async_write_ha_state()

    async def async_playlist_delete(self, playlist_id):
        pid = str(playlist_id)
        self._stored_playlists = [pl for pl in self._stored_playlists if str(pl["id"]) != pid]
        if pid in self._stored_items:
            del self._stored_items[pid]
        await self._async_save_playlists()
        
        self._last_playlist_event = {
            "updated_at_ms": int(time.time() * 1000),
            "type": "playlist_deleted",
            "playlist_id": pid,
            "success": True
        }
        self.async_write_ha_state()

    async def async_playlist_add_song(self, playlist_id, source, id, title="", artist="", thumbnail_url="", duration_seconds=0):
        pid = str(playlist_id)
        if pid not in self._stored_items:
            self._stored_items[pid] = []
            
        song_data = {
            "source": source,
            "id": id,
            "title": title,
            "artist": artist,
            "thumbnail_url": thumbnail_url,
            "duration_seconds": duration_seconds,
            "index": len(self._stored_items[pid]),
            "kind": "track"
        }
        
        self._stored_items[pid].append(song_data)
        await self._async_save_playlists()
        
        self._last_playlist_event = {
            "updated_at_ms": int(time.time() * 1000),
            "type": "playlist_song_added",
            "playlist_id": pid,
            "success": True
        }
        self.async_write_ha_state()

    async def async_playlist_remove_song(self, playlist_id, song_index):
        pid = str(playlist_id)
        idx = int(song_index)
        
        if pid in self._stored_items:
            items = self._stored_items[pid]
            if 0 <= idx < len(items):
                items.pop(idx)
                # Đánh lại index
                for i, it in enumerate(items):
                    it["index"] = i
                await self._async_save_playlists()
                
        self._last_playlist_event = {
            "updated_at_ms": int(time.time() * 1000),
            "type": "playlist_song_removed",
            "playlist_id": pid,
            "success": True
        }
        self.async_write_ha_state()

    async def async_playlist_play(self, playlist_id, speaker_entities=None):
        pid = str(playlist_id)
        items = self._stored_items.get(pid, [])
        if items:
            first_song = items[0]
            source = str(first_song.get("source")).lower()
            song_id = first_song.get("id")
            
            if source in ("zing", "zingmp3"):
                await self.async_play_zing(song_id, speaker_entities=speaker_entities)
            else:
                await self.async_play_youtube(song_id, speaker_entities=speaker_entities)