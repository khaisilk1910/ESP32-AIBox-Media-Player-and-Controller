import { EQ_BAND_LABELS } from './constants.js';
import { UtilsMixin } from './utils.js';
import { CoreLogicMixin } from './core_logic.js';
import { UIRenderMixin } from './ui_render.js';
import { UIEventsMixin } from './ui_events.js';

class ESP32AIBoxMediaPlayerControllerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._config = undefined;

    this._activeTab = "media";
    this._mediaSearchTab = "songs";
    this._lightingTab = "main";

    this._repeatMode = "all"; 
    this._waveEffect = 0;     
    
    this._query = "";
    this._chatInput = "";
    this._chatHistory = [];
    this._chatHistoryLoaded = false;
    this._chatDangCompose = false;
    this._mediaDangCompose = false;
    this._mediaTimKiemSauCompose = false;
    this._mediaQueryFocused = false;

    this._volumeLevel = 0;
    this._wakeSensitivity = 0.9;
    this._lastPlayPauseSent = null;

    this._wakeEnabled = false;
    this._antiDeafEnabled = false;
    this._dlnaEnabled = false;
    this._airplayEnabled = false;
    this._bluetoothEnabled = false;
    this._mainLightEnabled = false;
    this._edgeLightEnabled = false;
    this._mainLightMode = 0;

    this._mainLightBrightness = 100;
    this._mainLightSpeed = 50;
    this._edgeLightIntensity = 50;

    this._eqEnabled = false;
    this._eqBandCount = EQ_BAND_LABELS.length;
    this._eqBands = [0, 0, 0, 0, 0];
    this._eqBand = 0;
    this._eqLevel = 0;
    this._eqSyncGuardUntil = 0;
    this._bassEnabled = false;
    this._bassStrength = 0;
    this._loudnessEnabled = false;
    this._loudnessGain = 0;

    this._lastEntityRef = null;
    this._lastSearchStateKey = "";
    this._pendingRender = false;

    this._progressTimerId = null;
    this._liveTrackKey = "";
    this._livePositionSeconds = 0;
    this._ignorePositionUntil = 0; // THÊM MỚI
    this._liveDurationSeconds = 0;
    this._livePlaying = false;
    this._liveTickAt = 0;
    this._nowPlayingCache = {
      trackKey: "",
      title: "",
      artist: "",
      source: "",
      thumbnail_url: "",
      duration: 0,
    };
    this._forcePauseUntil = 0;
    this._optimisticPlayUntil = 0;
    this._pendingSwitches = {};
    this._lastChatStateRequestAt = 0;
    this._lastChatHistoryRequestAt = 0;
    this._lastControlStateRequestAt = 0;
    this._lastSystemStateRequestAt = 0;
    this._dangChoKetQuaTimKiem = false;
    this._timKiemDangCho = null;
  }

  static getStubConfig() {
    return {
      entity: "media_player.esp32_aibox_media_controller",
      title: "ESP32 AIBox",
    };
  }

  getCardSize() {
    return 12;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("ESP32 AIBox Card: 'entity' is required");
    }
    this._config = {
      title: "ESP32 AIBox",
      ...config,
    };
    this._lastEntityRef = null;
    this._pendingRender = false;
    this._xoaHenGioTienDo();
    
    this._repeatMode = "all"; 
    this._waveEffect = 0;

    this._liveTrackKey = "";
    this._livePositionSeconds = 0;
    this._ignorePositionUntil = 0; // THÊM MỚI
    this._liveDurationSeconds = 0;
    this._livePlaying = false;
    this._liveTickAt = 0;
    this._nowPlayingCache = {
      trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0,
    };
    this._forcePauseUntil = 0;
    this._optimisticPlayUntil = 0;
    this._pendingSwitches = {};
    this._lastChatStateRequestAt = 0;
    this._lastChatHistoryRequestAt = 0;
    this._lastControlStateRequestAt = 0;
    this._lastSystemStateRequestAt = 0;
    this._chatHistory = [];
    this._chatHistoryLoaded = false;
    this._chatDangCompose = false;
    this._mediaDangCompose = false;
    this._mediaTimKiemSauCompose = false;
    this._mediaQueryFocused = false;
    this._eqBandCount = EQ_BAND_LABELS.length;
    this._eqBands = [0, 0, 0, 0, 0];
    this._eqBand = 0;
    this._eqLevel = 0;
    this._eqSyncGuardUntil = 0;
    this._lastSearchStateKey = "";
    this._dangChoKetQuaTimKiem = false;
    this._timKiemDangCho = null;
    this._veGiaoDien();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    const entityRef = this._doiTuongTrangThai();
    const changed = entityRef !== this._lastEntityRef;
    const currentSearchStateKey = this._khoaTrangThaiTimKiem(
      entityRef?.attributes?.last_music_search || {}
    );
    const searchChanged = currentSearchStateKey !== this._lastSearchStateKey;
    this._lastEntityRef = entityRef;
    this._lastSearchStateKey = currentSearchStateKey;
    this._dongBoTuEntity();

    if (!changed && !searchChanged && !this._pendingRender) return;
    if (this._activeTab === "system" && this._dangTuongTacEq()) {
      this._pendingRender = true;
      this._capNhatEqGiaoDien(this.shadowRoot);
      return;
    }
    if (this._dangSuaOInputVanBan()) {
      const activeId = this.shadowRoot?.activeElement?.id || "";
      if (activeId === "media-query" && this._activeTab === "media") {
        if (this._dangChoKetQuaTimKiem) {
          const cho = this._timKiemDangCho;
          const daCoKetQuaMoi = cho ? this._laKetQuaTimKiemMoi(this._thuocTinh().last_music_search || {}, cho.query, cho.source, cho.mocTruoc, cho.dauVetTruoc) : false;
          if (daCoKetQuaMoi) {
            this._pendingRender = false;
            this._veGiaoDienGiuFocusTimKiem();
          } else {
            this._pendingRender = true;
          }
          return;
        }
        if (changed || searchChanged) {
          this._pendingRender = false;
          this._veGiaoDienGiuFocusTimKiem();
          return;
        }
      }
      if (activeId === "chat-input" && this._activeTab === "chat") {
        this._pendingRender = false;
        this._veGiaoDienGiuFocusChat();
        return;
      }
      this._pendingRender = true;
      return;
    }

    this._pendingRender = false;
    this._veGiaoDien();
  }

  connectedCallback() { this._veGiaoDien(); }
  disconnectedCallback() { this._xoaHenGioTienDo(); }

  _dongBoTuEntity() {
    const stateObj = this._doiTuongTrangThai();
    if (!stateObj) return;

    const attrs = stateObj.attributes || {};
    const wake = attrs.wake_word || {};
    const ai = attrs.custom_ai || {};
    const volumeLevel = attrs.volume_level;

    if (typeof volumeLevel === "number") this._volumeLevel = Math.max(0, Math.min(1, volumeLevel));
    
    const sensitivity = this._epKieuSo(wake.sensitivity ?? wake.value, this._wakeSensitivity);
    if (Number.isFinite(sensitivity)) this._wakeSensitivity = Math.max(0, Math.min(1, sensitivity));

    const wakeEnabled = this._epKieuBoolean(wake.enabled ?? wake.enable ?? wake.state, this._wakeEnabled);
    const antiDeafEnabled = this._epKieuBoolean(ai.enabled ?? ai.enable ?? ai.state, this._antiDeafEnabled);
    const dlnaRaw = attrs.dlna_open ?? attrs.dlnaOpen ?? attrs.dlna ?? attrs.dlna_enabled ?? attrs.dlnaEnabled;
    const airplayRaw = attrs.airplay_open ?? attrs.airplayOpen ?? attrs.airplay ?? attrs.airplay_enabled ?? attrs.airplayEnabled;
    const bluetoothRaw = attrs.device_state ?? attrs.deviceState ?? attrs.bluetooth_state ?? attrs.bluetoothState;
    const mainLightRaw = attrs.music_light_enable ?? attrs.musicLightEnable ?? attrs.main_light_enabled ?? attrs.mainLightEnabled;

    const dlnaEnabled = this._epKieuBoolean(dlnaRaw, this._dlnaEnabled);
    const airplayEnabled = this._epKieuBoolean(airplayRaw, this._airplayEnabled);
    const bluetoothEnabled = this._laBluetoothDangBat(bluetoothRaw, this._bluetoothEnabled);
    const mainLightEnabled = this._epKieuBoolean(mainLightRaw, this._mainLightEnabled);

    this._wakeEnabled = this._layTrangThaiCongTac("wake_enabled", wakeEnabled);
    this._antiDeafEnabled = this._layTrangThaiCongTac("anti_deaf_enabled", antiDeafEnabled);
    this._dlnaEnabled = this._layTrangThaiCongTac("dlna_enabled", dlnaEnabled);
    this._airplayEnabled = this._layTrangThaiCongTac("airplay_enabled", airplayEnabled);
    this._bluetoothEnabled = this._layTrangThaiCongTac("bluetooth_enabled", bluetoothEnabled);
    this._mainLightEnabled = this._layTrangThaiCongTac("main_light_enabled", mainLightEnabled);

    if (typeof attrs.music_light_luma === "number") this._mainLightBrightness = Math.max(1, Math.min(200, attrs.music_light_luma));
    if (typeof attrs.music_light_chroma === "number") this._mainLightSpeed = Math.max(1, Math.min(100, attrs.music_light_chroma));

    const mainLightMode = this._epKieuSo(attrs.music_light_mode ?? attrs.musicLightMode, this._mainLightMode);
    if (Number.isFinite(mainLightMode)) this._mainLightMode = Math.max(0, Math.round(mainLightMode));

    const audioConfig = attrs.audio_config || attrs.audioConfig || {};
    const eqConfig = attrs.eq_state || attrs.eqState || audioConfig.eq || {};
    const bassConfig = attrs.bass_state || attrs.bassState || audioConfig.bass || {};
    const loudnessConfig = attrs.loudness_state || attrs.loudnessState || audioConfig.loudness || {};
    const edgeLight = attrs.edge_light || attrs.edgeLight || {};
    const dangGiuEqCucBo = Date.now() < this._eqSyncGuardUntil;
    
    if (!dangGiuEqCucBo) {
      this._eqEnabled = this._epKieuBoolean(eqConfig.Eq_Enable ?? eqConfig.sound_effects_eq_enable ?? eqConfig.eq_enable ?? eqConfig.enabled, this._eqEnabled);
      const eqBands = Array.isArray(eqConfig.Bands?.list) ? eqConfig.Bands.list : [];
      if (eqBands.length > 0) {
        this._eqBandCount = eqBands.length;
        this._eqBands = eqBands.map((bandItem) => this._gioiHanEqLevel(bandItem?.BandLevel ?? bandItem?.band_level ?? bandItem?.level, 0));
        this._eqBand = Math.max(0, Math.min(this._eqBandCount - 1, Math.round(this._eqBand)));
        this._eqLevel = this._layEqLevelTheoBand(this._eqBand);
      } else {
        this._eqBandCount = Math.max(1, this._eqBands.length || this._eqBandCount || EQ_BAND_LABELS.length);
        this._eqBand = Math.max(0, Math.min(this._eqBandCount - 1, Math.round(this._eqBand)));
        this._eqLevel = this._layEqLevelTheoBand(this._eqBand);
      }
    } else {
      this._eqBandCount = Math.max(1, this._eqBands.length || this._eqBandCount || EQ_BAND_LABELS.length);
      this._eqBand = Math.max(0, Math.min(this._eqBandCount - 1, Math.round(this._eqBand)));
      this._eqLevel = this._layEqLevelTheoBand(this._eqBand);
    }

    this._bassEnabled = this._epKieuBoolean(bassConfig.Bass_Enable ?? bassConfig.sound_effects_bass_enable ?? bassConfig.bass_enable ?? bassConfig.enabled, this._bassEnabled);
    const bassStrength = this._epKieuSo(bassConfig.Current_Strength ?? bassConfig.current_strength ?? bassConfig.strength, this._bassStrength);
    if (Number.isFinite(bassStrength)) this._bassStrength = Math.max(0, Math.min(1000, Math.round(bassStrength)));

    this._loudnessEnabled = this._epKieuBoolean(loudnessConfig.Loudness_Enable ?? loudnessConfig.sound_effects_loudness_enable ?? loudnessConfig.loudness_enable ?? loudnessConfig.enabled, this._loudnessEnabled);
    const loudnessGain = this._epKieuSo(loudnessConfig.Current_Gain ?? loudnessConfig.current_gain ?? loudnessConfig.gain, this._loudnessGain);
    if (Number.isFinite(loudnessGain)) this._loudnessGain = Math.max(-3000, Math.min(3000, Math.round(loudnessGain)));

    this._edgeLightEnabled = this._epKieuBoolean(edgeLight.enabled ?? edgeLight.enable ?? edgeLight.state, this._edgeLightEnabled);
    const edgeIntensity = this._epKieuSo(edgeLight.intensity ?? edgeLight.value, this._edgeLightIntensity);
    if (Number.isFinite(edgeIntensity)) this._edgeLightIntensity = Math.max(0, Math.min(100, Math.round(edgeIntensity)));

    this._dongBoLichSuChatTuEntity(attrs.last_chat_items);
  }
}

Object.assign(
  ESP32AIBoxMediaPlayerControllerCard.prototype,
  UtilsMixin,
  CoreLogicMixin,
  UIRenderMixin,
  UIEventsMixin
);

if (!customElements.get("esp32-aibox-media-controller")) {
  customElements.define("esp32-aibox-media-controller", ESP32AIBoxMediaPlayerControllerCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.find((card) => card.type === "esp32-aibox-media-controller")) {
  window.customCards.push({
    type: "esp32-aibox-media-controller",
    name: "ESP32 AIBox Media Player and Controller",
    description: "ESP32 AIBox Media Player and Controller",
    preview: true,
  });
}