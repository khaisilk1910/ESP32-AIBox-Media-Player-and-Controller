import { EQ_BAND_LABELS } from './constants.js';
import { UtilsMixin } from './utils.js';
import { CoreLogicMixin } from './core_logic.js';
import { TabMediaMixin } from './tab_media.js';
import { TabControlMixin } from './tab_control.js';
import { TabChatMixin } from './tab_chat.js';
import { TabSystemMixin } from './tab_system.js';
import './esp32_aibox_editor.js';

class ESP32AIBoxMediaPlayerControllerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._config = undefined;

    this._activeTab = "media";
    this._mediaSearchTab = "songs";
    this._lightingTab = "main";
    this._audioEngineTab = "eq";

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

    this._chatBgBase64 = "";
    this._tiktokReplyEnabled = false;

    this._volumeLevel = 0;
    this._preMuteVolumeLevel = null;
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

    this._ledChoEnabled = false;
    this._stereoEnabled = false;
    this._stereoReceiver = false;
    this._stereoDelay = 0;
    this._surroundW = 40;
    this._surroundP = 30;
    this._surroundS = 10;
    this._dacVolL = 231;
    this._dacVolR = 231;

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
    this._ignorePositionUntil = 0;
    this._liveDurationSeconds = 0;
    this._livePlaying = false;
    this._liveTickAt = 0;
    this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
    this._optimisticTrackUntil = 0; 
    this._forcePauseUntil = 0;
    this._optimisticPlayUntil = 0;
    this._pendingSwitches = {};
    this._lastChatStateRequestAt = 0;
    this._lastChatHistoryRequestAt = 0;
    this._lastControlStateRequestAt = 0;
    this._lastSystemStateRequestAt = 0;
    this._dangChoKetQuaTimKiem = false;
    this._timKiemDangCho = null;

    this._live2dManager = null;
  }

  static getConfigElement() { return document.createElement("esp32-aibox-media-controller-editor"); }

  static getStubConfig(hass) {
    let entity = "media_player.esp32_aibox_media_controller";
    if (hass && hass.states) {
      const entities = Object.keys(hass.states).filter(eid => {
        if (!eid.startsWith("media_player.")) return false;
        const attrs = hass.states[eid].attributes;
        return attrs && ("aibox_playback" in attrs || "chat_state" in attrs || "wake_word" in attrs || "audio_config" in attrs);
      });
      if (entities.length > 0) entity = entities[0];
    }
    return { entity: entity };
  }

  getCardSize() { return 12; }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("ESP32 AIBox Card: 'entity' is required");
    this._config = { ...config };
    this._lastEntityRef = null;
    this._pendingRender = false;
    this._xoaHenGioTienDo?.();
    
    this._repeatMode = "all"; 
    this._waveEffect = 0;

    this._preMuteVolumeLevel = null;
    this._liveTrackKey = "";
    this._livePositionSeconds = 0;
    this._ignorePositionUntil = 0;
    this._liveDurationSeconds = 0;
    this._livePlaying = false;
    this._liveTickAt = 0;
    this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
    this._optimisticTrackUntil = 0; 
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
    const currentSearchStateKey = this._khoaTrangThaiTimKiem(entityRef?.attributes?.last_music_search || {});
    const searchChanged = currentSearchStateKey !== this._lastSearchStateKey;
    this._lastEntityRef = entityRef;
    this._lastSearchStateKey = currentSearchStateKey;
    this._dongBoTuEntity();

    if (!changed && !searchChanged && !this._pendingRender) return;
    if (this._activeTab === "system" && this._dangTuongTacEq()) { this._pendingRender = true; this._capNhatEqGiaoDien(this.shadowRoot); return; }
    if (this._dangSuaOInputVanBan()) {
      const activeId = this.shadowRoot?.activeElement?.id || "";
      if (activeId === "media-query" && this._activeTab === "media") {
        if (this._dangChoKetQuaTimKiem) {
          const cho = this._timKiemDangCho;
          const daCoKetQuaMoi = cho ? this._laKetQuaTimKiemMoi(this._thuocTinh().last_music_search || {}, cho.query, cho.source, cho.mocTruoc, cho.dauVetTruoc) : false;
          if (daCoKetQuaMoi) { this._pendingRender = false; this._veGiaoDienGiuFocusTimKiem(); } else { this._pendingRender = true; }
          return;
        }
        if (changed || searchChanged) { this._pendingRender = false; this._veGiaoDienGiuFocusTimKiem(); return; }
      }
      if (activeId === "chatInput" && this._activeTab === "chat") { this._pendingRender = false; this._veGiaoDienGiuFocusChat(); return; }
      this._pendingRender = true; return;
    }

    this._pendingRender = false;
    this._veGiaoDien();
  }

  connectedCallback() { this._veGiaoDien(); this._initLive2D(); }
  disconnectedCallback() { this._xoaHenGioTienDo?.(); }

  async _initLive2D() {
    if (!this._live2dManager) {
      try {
        const baseUrl = new URL('.', import.meta.url).href;
        const loadScript = (src) => new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${baseUrl + src}"]`)) { resolve(); return; }
          const script = document.createElement('script'); script.src = baseUrl + src; script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
        });
        if (!window.PIXI) await loadScript('pixi.js');
        if (!window.Live2DCubismCore) await loadScript('live2dcubismcore.min.js');
        if (!window.PIXI || !window.PIXI.live2d) await loadScript('cubism4.min.js');
        if (!window.Live2DManager) await loadScript('live2d.js');
        if (window.Live2DManager) { this._live2dManager = new window.Live2DManager(); if (this._activeTab === "chat") this._veGiaoDien(); }
      } catch (e) { console.error("ESP32 AIBox: Lỗi tải thư viện Live2D", e); }
    }
  }

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

    this._wakeEnabled = this._layTrangThaiCongTac("wake_enabled", wakeEnabled);
    this._antiDeafEnabled = this._layTrangThaiCongTac("anti_deaf_enabled", antiDeafEnabled);
    this._dlnaEnabled = this._layTrangThaiCongTac("dlna_enabled", this._epKieuBoolean(dlnaRaw, this._dlnaEnabled));
    this._airplayEnabled = this._layTrangThaiCongTac("airplay_enabled", this._epKieuBoolean(airplayRaw, this._airplayEnabled));
    this._bluetoothEnabled = this._layTrangThaiCongTac("bluetooth_enabled", this._laBluetoothDangBat(bluetoothRaw, this._bluetoothEnabled));
    this._mainLightEnabled = this._layTrangThaiCongTac("main_light_enabled", this._epKieuBoolean(mainLightRaw, this._mainLightEnabled));

    if (typeof attrs.music_light_luma === "number") this._mainLightBrightness = Math.max(1, Math.min(200, attrs.music_light_luma));
    if (typeof attrs.music_light_chroma === "number") this._mainLightSpeed = Math.max(1, Math.min(100, attrs.music_light_chroma));

    const mainLightMode = this._epKieuSo(attrs.music_light_mode ?? attrs.musicLightMode, this._mainLightMode);
    if (Number.isFinite(mainLightMode)) this._mainLightMode = Math.max(0, Math.round(mainLightMode));

    const audioConfig = attrs.audio_config || attrs.audioConfig || {};
    const eqConfig = attrs.eq_state || attrs.eqState || audioConfig.eq || {};
    const bassConfig = attrs.bass_state || attrs.bassState || audioConfig.bass || {};
    const loudnessConfig = attrs.loudness_state || attrs.loudnessState || audioConfig.loudness || {};
    const edgeLight = attrs.edge_light || attrs.edgeLight || {};
    
    if (Date.now() >= this._eqSyncGuardUntil) {
      this._eqEnabled = this._epKieuBoolean(eqConfig.Eq_Enable ?? eqConfig.sound_effects_eq_enable ?? eqConfig.eq_enable ?? eqConfig.enabled, this._eqEnabled);
      const eqBands = Array.isArray(eqConfig.Bands?.list) ? eqConfig.Bands.list : [];
      if (eqBands.length > 0) {
        this._eqBandCount = eqBands.length;
        this._eqBands = eqBands.map((b) => this._gioiHanEqLevel(b?.BandLevel ?? b?.band_level ?? b?.level, 0));
      }
    }
    this._eqBandCount = Math.max(1, this._eqBands.length || this._eqBandCount || EQ_BAND_LABELS.length);
    this._eqBand = Math.max(0, Math.min(this._eqBandCount - 1, Math.round(this._eqBand)));
    this._eqLevel = this._layEqLevelTheoBand(this._eqBand);

    this._bassEnabled = this._epKieuBoolean(bassConfig.Bass_Enable ?? bassConfig.sound_effects_bass_enable ?? bassConfig.bass_enable ?? bassConfig.enabled, this._bassEnabled);
    const bassStrength = this._epKieuSo(bassConfig.Current_Strength ?? bassConfig.current_strength ?? bassConfig.strength, this._bassStrength);
    if (Number.isFinite(bassStrength)) this._bassStrength = Math.max(0, Math.min(1000, Math.round(bassStrength)));

    this._loudnessEnabled = this._epKieuBoolean(loudnessConfig.Loudness_Enable ?? loudnessConfig.sound_effects_loudness_enable ?? loudnessConfig.loudness_enable ?? loudnessConfig.enabled, this._loudnessEnabled);
    const loudnessGain = this._epKieuSo(loudnessConfig.Current_Gain ?? loudnessConfig.current_gain ?? loudnessConfig.gain, this._loudnessGain);
    if (Number.isFinite(loudnessGain)) this._loudnessGain = Math.max(-3000, Math.min(3000, Math.round(loudnessGain)));

    this._edgeLightEnabled = this._epKieuBoolean(edgeLight.enabled ?? edgeLight.enable ?? edgeLight.state, this._edgeLightEnabled);
    const edgeIntensity = this._epKieuSo(edgeLight.intensity ?? edgeLight.value, this._edgeLightIntensity);
    if (Number.isFinite(edgeIntensity)) this._edgeLightIntensity = Math.max(0, Math.min(100, Math.round(edgeIntensity)));

    this._dongBoLichSuChatTuEntity?.(attrs.last_chat_items);
  }

  _ganSuKien() {
    const root = this.shadowRoot;
    if (!root) return;

    // --- Global Events (Device & Tabs) ---
    root.getElementById("device-selector")?.addEventListener("change", (ev) => { if (ev.target.value) this._chuyenEntity(ev.target.value); });
    const btnPrevDevice = root.getElementById("btn-prev-device");
    const btnNextDevice = root.getElementById("btn-next-device");
    if (btnPrevDevice || btnNextDevice) {
      const aiboxEntities = this._timCacEntityAibox();
      const currentIndex = aiboxEntities.indexOf(this._config?.entity);
      btnPrevDevice?.addEventListener("click", () => { if (aiboxEntities.length > 1) this._chuyenEntity(aiboxEntities[currentIndex - 1 < 0 ? aiboxEntities.length - 1 : currentIndex - 1]); });
      btnNextDevice?.addEventListener("click", () => { if (aiboxEntities.length > 1) this._chuyenEntity(aiboxEntities[currentIndex + 1 >= aiboxEntities.length ? 0 : currentIndex + 1]); });
    }

    root.querySelectorAll("[data-tab]").forEach((el) => {
      el.addEventListener("click", () => { this._activeTab = el.dataset.tab || "media"; this._veGiaoDien(); });
    });

    // --- Tab Specific Events ---
    if (this._activeTab === "media") this._ganSuKienTabMedia(root);
    if (this._activeTab === "control") this._ganSuKienTabControl(root);
    if (this._activeTab === "chat") this._ganSuKienTabChat(root);
    if (this._activeTab === "system") this._ganSuKienTabSystem(root);
  }

  _veGiaoDien() {
    if (!this.shadowRoot || !this._hass) return;
    const aiboxEntities = this._timCacEntityAibox();
    if (aiboxEntities.length > 0 && (!this._config || !this._config.entity || !aiboxEntities.includes(this._config.entity))) { this._chuyenEntity(aiboxEntities[0]); return; }
    if (!this._config || !this._config.entity) { this._xoaHenGioTienDo?.(); this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px;">Không tìm thấy entity ESP32 AIBox.</div></ha-card>`; return; }
    const stateObj = this._doiTuongTrangThai();
    if (!stateObj) { this._xoaHenGioTienDo?.(); this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px;">Không tìm thấy entity <strong>${this._maHoaHtml(this._config.entity)}</strong>. Đang đợi đồng bộ...</div></ha-card>`; return; }

    const conf = this._config || {};
    let bgStr = ''; let stringForContrastCalc = '';
    if ((conf.bg_type || 'gradient') === 'gradient') {
      const preset = conf.bg_gradient_preset || 'linear-gradient(135deg, #1e293b, #0f172a)';
      if (preset === 'custom') { bgStr = `linear-gradient(${conf.bg_gradient_angle ?? 135}deg, ${this._hexToRgba(conf.bg_gradient_color1 || '#1e293b', conf.bg_opacity ?? 100)}, ${this._hexToRgba(conf.bg_gradient_color2 || '#0f172a', conf.bg_opacity ?? 100)})`; stringForContrastCalc = `${conf.bg_gradient_color1 || '#1e293b'} ${conf.bg_gradient_color2 || '#0f172a'}`; }
      else { bgStr = this._applyOpacityToGradientStr(preset, conf.bg_opacity ?? 100); stringForContrastCalc = preset; }
    } else { bgStr = this._hexToRgba(conf.bg_color || '#0f172a', conf.bg_opacity ?? 100); stringForContrastCalc = conf.bg_color || '#0f172a'; }

    let c_text = conf.textColor || '#f9fafb'; let c_muted = conf.mutedColor || '#9ca3af'; let c_tile_bg = conf.tileBg || 'rgba(255, 255, 255, 0.04)'; let c_line = conf.lineColor || 'rgba(255, 255, 255, 0.15)'; let c_card_bg_var = '#0f172a'; let c_accent = '#818cf8'; let c_input_bg = 'rgba(0, 0, 0, 0.2)';
    if (conf.auto_contrast !== false) {
       const avgColor = this._getAverageColor(stringForContrastCalc); const op = (conf.bg_opacity ?? 100) / 100;
       const isDarkTheme = this._hass?.themes?.darkMode !== undefined ? this._hass.themes.darkMode : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
       const baseBg = isDarkTheme ? 30 : 245; 
       const isLightBackground = (((Math.round(avgColor.r * op + baseBg * (1 - op)) * 299) + (Math.round(avgColor.g * op + baseBg * (1 - op)) * 587) + (Math.round(avgColor.b * op + baseBg * (1 - op)) * 114)) / 1000) >= 135;
       if (isLightBackground) { c_text = '#111827'; c_muted = '#4b5563'; c_tile_bg = `rgba(0, 0, 0, ${Math.max(0.04, op * 0.08)})`; c_line = `rgba(0, 0, 0, ${Math.max(0.12, op * 0.15)})`; c_card_bg_var = '#ffffff'; c_input_bg = `rgba(0, 0, 0, ${Math.max(0.05, op * 0.08)})`; c_accent = '#2563eb'; } 
       else { c_text = '#f9fafb'; c_muted = '#9ca3af'; c_tile_bg = `rgba(255, 255, 255, ${Math.max(0.04, op * 0.08)})`; c_line = `rgba(255, 255, 255, ${Math.max(0.15, op * 0.2)})`; c_card_bg_var = '#0f172a'; c_input_bg = `rgba(0, 0, 0, ${Math.max(0.2, op * 0.3)})`; c_accent = '#a78bfa'; }
    }

    let body = "";
    if (this._activeTab === "media") body = this._veTabMedia(stateObj);
    if (this._activeTab === "control") body = this._veTabDieuKhien();
    if (this._activeTab === "chat") body = this._veTabChat();
    if (this._activeTab === "system") body = this._veTabHeThong();

    const deviceSelectorHtml = aiboxEntities.length > 1 ? `
      <div class="device-selector-container">
        <button id="btn-prev-device" class="device-nav-btn"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
        <div class="device-select-wrapper">
          <ha-icon icon="mdi:speaker-wireless" class="device-icon"></ha-icon>
          <select id="device-selector" class="device-dropdown">${aiboxEntities.map(ent => `<option value="${ent}" ${this._config.entity === ent ? 'selected' : ''}>${this._maHoaHtml(this._hass.states[ent]?.attributes?.friendly_name || ent.replace("media_player.", ""))}</option>`).join('')}</select>
        </div>
        <button id="btn-next-device" class="device-nav-btn"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
      </div>` : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host { --bg-card: ${c_card_bg_var}; --bg-soft: ${c_tile_bg}; --bg-tile: ${c_tile_bg}; --line: ${c_line}; --text: ${c_text}; --muted: ${c_muted}; --accent: ${c_accent}; --input-bg: ${c_input_bg}; display: block; width: 100%; max-width: none; }
        * { box-sizing: border-box; transition: background 0.25s, border-color 0.25s, box-shadow 0.25s, transform 0.25s; }
        ha-card { width: 100%; max-width: none; margin: 0; border-radius: 24px; overflow: hidden; border: none; background: ${bgStr}; color: var(--text); box-shadow: none; padding: 0; }
        .device-selector-container { display: flex; align-items: center; gap: 8px; padding: 12px 10px 0; width: 100%; }
        .device-nav-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-tile); color: var(--muted); cursor: pointer; flex-shrink: 0; transition: all 0.2s ease; }
        .device-nav-btn:hover { background: var(--line); color: var(--text); }
        .device-select-wrapper { position: relative; flex: 1; display: flex; align-items: center; background: var(--bg-tile); border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; height: 36px; overflow: hidden; }
        .device-icon { color: var(--accent); --mdc-icon-size: 18px; margin-right: 8px; pointer-events: none; }
        .device-dropdown { flex: 1; width: 100%; height: 100%; background: transparent; border: none; color: var(--text); font-weight: 700; font-size: 13px; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; text-align-last: center; }
        .device-dropdown option { background: var(--bg-card); color: var(--text); }
        .device-select-wrapper::after { content: '▼'; position: absolute; right: 12px; color: var(--accent); font-size: 10px; pointer-events: none; }
        .top-tabs { display: flex; flex-wrap: nowrap; gap: 6px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 16px; background: var(--bg-tile); margin: 10px 10px 12px; }
        .tab-btn { border: 0; background: transparent; color: var(--muted); border-radius: 12px; padding: 8px 10px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; flex: 1 1 0; min-width: 0; }
        .tab-btn span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        .tab-btn:hover { background: var(--line); transform: translateY(-2px); color: var(--text); }
        .tab-btn.active { color: #fff; background: var(--accent); box-shadow: 0 4px 10px rgba(0,0,0,0.2); transform: translateY(0); }
        .panel { border: 0; padding: 0 10px 12px; background: transparent; }
        .panel-media { padding: 0; overflow: hidden; }
        .hero { position: relative; display: flex; flex-direction: column; border-bottom: 1px solid var(--line); overflow: hidden; background: #060e22; padding-bottom: 14px; }
        .hero-bg-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: saturate(1.1) brightness(0.65); transform: scale(1.05); pointer-events: none; }
        .hero-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6, 15, 36, 0.2) 0%, rgba(6, 15, 36, 0.8) 100%); pointer-events: none; }
        .hero-bg-text { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); font-size: 72px; font-weight: 900; color: rgba(255, 255, 255, 0.04); white-space: nowrap; pointer-events: none; z-index: 0; letter-spacing: -1px; }
        .hero-content { position: relative; z-index: 1; padding: 12px 14px 0; }
        .hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .hero-titles { flex: 1; min-width: 0; }
        .song-title { margin: 0; font-size: 16px; font-weight: 800; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5); }
        .song-sub { margin-top: 4px; color: #d3dffa; font-size: 12px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hero-top-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .pill { display: inline-flex; align-items: center; justify-content: center; min-width: 80px; height: 30px; padding: 0 10px; border-radius: 9px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; background: rgba(7, 16, 40, 0.7); border: 1px solid rgba(255,255,255,0.2); color: #fff; backdrop-filter: blur(4px); flex-shrink: 0; }
        .hero-actions { display: flex; gap: 4px; align-items: center; margin-top: 4px; }
        .player-stage-new { margin-top: 14px; display: flex; align-items: center; }
        .cover-disc { width: 80px; height: 80px; flex: 0 0 80px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255, 0.3); box-shadow: 0 6px 20px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 30% 25%, rgba(255,255,255, 0.1), rgba(0,0,0, 0.6)); }
        .cover-disc img { width: 100%; height: 100%; object-fit: cover; }
        .cover-disc ha-icon { color: #fff; --mdc-icon-size: 28px; }
        .hero.is-playing .cover-disc.spinning { animation: discSpin 8s linear infinite; }
        .hero-bottom { position: relative; width: 100%; z-index: 1; margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
        .controls-overlay { display: flex; align-items: center; justify-content: center; gap: 28px; padding: 0; background: transparent; border: none; box-shadow: none; backdrop-filter: none; }
        .icon-btn-transparent { background: transparent; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 8px; border-radius: 50%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; display: inline-flex; align-items: center; justify-content: center; }
        .icon-btn-transparent:hover { color: #fff; transform: scale(1.3) translateY(-2px); filter: drop-shadow(0 4px 10px rgba(255, 255, 255, 0.6)); }
        .btn-large ha-icon { --mdc-icon-size: 46px; }
        .icon-btn-transparent ha-icon { --mdc-icon-size: 28px; }
        .waveform-full { height: 42px; display: flex; align-items: flex-end; justify-content: center; gap: 4px; overflow: hidden; padding: 0 14px; }
        .wave-bar { flex: 1; max-width: 6px; height: var(--h); border-radius: 4px; background: var(--accent); transform-origin: bottom; opacity: 0.6; box-shadow: 0 0 6px var(--accent); }
        .hero.is-playing.wave-effect-0 .wave-bar { animation: waveDance calc(300ms + (var(--i) * 12ms)) ease-in-out infinite alternate; opacity: 1; }
        .hero.is-playing.wave-effect-1 .wave-bar { animation: wavePulse calc(250ms + (var(--i) * 10ms)) cubic-bezier(0.4, 0, 0.2, 1) infinite alternate; opacity: 1; }
        .hero.is-playing.wave-effect-2 .wave-bar { animation: waveSweep 0.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-delay: calc(var(--i) * 0.03s); opacity: 1; }
        @keyframes waveDance { 0% { transform: scaleY(0.2); } 100% { transform: scaleY(1.3); } }
        @keyframes wavePulse { 0% { transform: scaleY(0.1); filter: hue-rotate(45deg); box-shadow: 0 0 10px var(--accent); } 100% { transform: scaleY(1.2); filter: hue-rotate(0deg); box-shadow: 0 0 10px var(--accent); } }
        @keyframes waveSweep { 0%, 100% { transform: scaleY(0.15); } 50% { transform: scaleY(1.4); } }
        @keyframes discSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .progress-row { display: flex; align-items: center; gap: 10px; padding: 4px 0 12px; }
        .time-text { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); width: 55px; }
        #playback-position { text-align: left; }
        #playback-duration { text-align: right; }
        .progress-track-new { flex: 1; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; cursor: pointer; position: relative; }
        .progress-fill-new { height: 100%; background: var(--accent); border-radius: 2px; box-shadow: 0 0 8px var(--accent); pointer-events: none;}
        .icon-btn-primary { background: var(--accent); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
        .icon-btn-primary:hover { filter: brightness(1.15); }
        .modern-volume-container { display: flex; align-items: center; gap: 10px; padding: 16px 14px 4px; }
        .vol-side { display: flex; align-items: center; gap: 6px; width: 55px; }
        .vol-side-left { justify-content: flex-start; }
        .vol-side-right { justify-content: flex-end; }
        .vol-side ha-icon { color: var(--muted); --mdc-icon-size: 18px; transition: color 0.2s; }
        .vol-side ha-icon#btn-mute-toggle.is-muted { color: #ef4444; }
        .vol-side ha-icon#btn-mute-toggle:hover { color: var(--text); }
        .vol-btn { background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; transition: all 0.2s; }
        .vol-btn:hover { background: var(--line); color: var(--text); transform: scale(1.1); }
        .vol-btn ha-icon { --mdc-icon-size: 16px; margin: 0; }
        .modern-volume-track-wrap { position: relative; flex: 1; height: 6px; display: flex; align-items: center; }
        .modern-volume-slider { position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2; margin: 0; }
        .modern-volume-fill { position: absolute; height: 4px; background: var(--accent); border-radius: 2px; z-index: 1; pointer-events: none; }
        .modern-volume-track-wrap::before { content: ''; position: absolute; width: 100%; height: 4px; background: var(--line); border-radius: 2px; }
        .modern-volume-text { color: var(--muted); font-size: 11px; font-weight: 700; width: 25px; text-align: right; }
        .subtabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 12px 10px 6px; }
        .subtab { border: 1px solid var(--line); border-radius: 10px; padding: 8px 6px; background: var(--bg-tile); color: var(--muted); font-weight: 600; font-size: 12px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; transition: all 0.2s; }
        .subtab:hover { background: var(--line); color: var(--text); transform: translateY(-1px); }
        .subtab.active { background: var(--accent); color: #fff; border-color: transparent; }
        .search-row { display: flex; gap: 10px; padding: 8px 10px; }
        .search-row .icon-btn { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 12px; border: 0; color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
        .search-row .icon-btn ha-icon { --mdc-icon-size: 20px; }
        .text-input { flex: 1; min-width: 0; height: 40px; border-radius: 12px; border: 1px solid var(--line); background: var(--input-bg); color: var(--text); padding: 8px 12px; font-size: 14px; outline: none; transition: border-color 0.3s, box-shadow 0.3s, background 0.3s; }
        .text-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--line); }
        .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 10px; padding: 0 10px 12px; max-height: 380px; overflow: auto; overflow-x: hidden; scroll-behavior: smooth; }
        .empty { border: 1px dashed var(--line); border-radius: 12px; padding: 14px; color: var(--muted); text-align: center; font-size: 13px; grid-column: 1 / -1; }
        .result-item { display: grid; grid-template-columns: 50px minmax(0, 1fr) auto; gap: 10px; align-items: center; border: 1px solid var(--line); border-radius: 14px; padding: 8px 10px; background: var(--bg-tile); width: 100%; box-sizing: border-box; min-height: 66px; }
        .result-meta { grid-column: 2; min-width: 0; max-width: 100%; overflow: hidden; }
        .result-item.playable { cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
        .result-item.playable:hover, .result-item.is-playing-item { border-color: var(--accent); background: var(--line); transform: translateY(-2px); }
        .result-item.is-playing-item { border-width: 2px; }
        .result-item.is-playing-item .result-title { color: var(--accent); }
        .result-item.playable:active { transform: translateY(0); }
        .thumb-wrap { width: 50px; height: 50px; border-radius: 10px; overflow: hidden; background: var(--line); }
        .thumb { width: 50px; height: 50px; object-fit: cover; display: block; }
        .thumb.fallback { display: flex; align-items: center; justify-content: center; color: var(--muted); }
        .result-title { display: -webkit-box; width: 100%; max-width: 100%; font-size: 12.5px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .result-artist { margin-top: 2px; font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .result-duration { margin-top: 1px; font-size: 13px; font-weight: 600; color: var(--muted); }
        .result-actions { grid-column: 3; grid-row: 1; display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-shrink: 0; }
        .result-actions ha-icon { --mdc-icon-size: 16px; }
        .mini-btn { border: 1px solid var(--line); border-radius: 10px; background: var(--bg-tile); color: var(--text); font-weight: 700; padding: 6px 10px; font-size: 11px; cursor: pointer; white-space: nowrap; }
        .hover-pop:hover { transform: translateY(-2px); background: var(--line); }
        .hover-scale:hover { transform: scale(1.05); filter: brightness(1.1); }
        .hover-lift:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .mini-btn.active { background: var(--accent); color: #fff; }
        .mini-btn-accent { min-width: 28px; min-height: 28px; border-radius: 8px; padding: 0; background: var(--accent); border-color: transparent; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
        .mini-btn-danger { min-width: 58px; min-height: 28px; border-radius: 8px; padding: 0 8px; background: #ef4444; border-color: transparent; color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
        .result-actions .play-btn { font-size: 11px; }
        .actions-inline { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
        .tile { border: 1px solid var(--line); border-radius: 16px; background: var(--bg-tile); padding: 12px; margin-bottom: 10px; }
        .section-title { margin: 0 0 12px 10px; font-size: 24px; font-weight: 800; display: flex; align-items: center; gap: 8px; color: var(--text); }
        .switch { position: relative; width: 44px; height: 24px; display: inline-block; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; inset: 0; background: var(--line); border-radius: 999px; transition: 0.3s; cursor: pointer; }
        .slider::before { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; border-radius: 50%; background: #fff; transition: 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .switch input:checked + .slider { background: var(--accent); }
        .switch input:checked + .slider::before { transform: translateX(20px); }
        .danger-btn { width: 100%; min-height: 40px; border-radius: 12px; border: 1px solid #ef4444; background: transparent; color: #ef4444; font-size: 14px; font-weight: 800; display: inline-flex; gap: 8px; align-items: center; justify-content: center; cursor: pointer; }
        .danger-btn:hover { background: #ef4444; color: #fff; }
        .chat-container-ui { position: relative; display: flex; flex-direction: column; height: calc(100vh - 160px); min-height: 450px; max-height: 600px; border-radius: 12px; overflow: hidden; margin: 0 10px 10px; border: 1px solid var(--line); background: rgba(30, 41, 59, 0.4); }
        .chat-bg-img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; pointer-events: none; }
        .live2d-stage { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; opacity: 0.85; }
        .chat-ui-header { position: relative; z-index: 20; background: rgba(30, 41, 59, 0.8); border-bottom: 1px solid var(--line); padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; backdrop-filter: blur(4px); }
        .chat-header-btn { background: transparent; border: none; color: #64748b; cursor: pointer; padding: 4px; transition: color 0.2s; display: flex; align-items: center; justify-content: center; }
        .chat-header-btn:hover { color: #fff; }
        .chat-header-btn ha-icon { --mdc-icon-size: 16px; }
        .live2d-select { background: transparent; color: #94a3b8; border: 1px solid var(--line); border-radius: 6px; padding: 2px 6px; font-size: 11px; outline: none; cursor: pointer; }
        .live2d-select option { background: #1e293b; color: #fff; }
        .chat-ui-messages { flex: 1; padding: 12px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; position: relative; z-index: 10; background: rgba(15, 23, 42, 0.5); }
        .chat-msg-row { display: flex; width: 100%; }
        .chat-msg-row.user { justify-content: flex-end; }
        .chat-msg-row.ai { justify-content: flex-start; }
        .chat-bubble { max-width: 80%; padding: 8px 12px; font-size: 12px; border-radius: 12px; color: #fff; word-wrap: break-word; }
        .user-bubble { background: #2563eb; }
        .ai-bubble { background: #16a34a; }
        .user-bubble-transparent { background: rgba(0,0,0,0.4); border: 2px solid #3b82f6; backdrop-filter: blur(2px); }
        .ai-bubble-transparent { background: rgba(0,0,0,0.4); border: 2px solid #22c55e; backdrop-filter: blur(2px); }
        .chat-ui-footer { position: relative; z-index: 20; background: rgba(30, 41, 59, 0.5); border-top: 1px solid var(--line); padding: 8px; display: flex; flex-direction: column; gap: 8px; backdrop-filter: blur(4px); }
        .chat-ui-input { flex: 1; background: rgba(51, 65, 85, 0.5); border: 1px solid rgba(99, 102, 241, 0.2); color: #fff; border-radius: 8px; padding: 8px 12px; font-size: 12px; outline: none; transition: border 0.2s; }
        .chat-ui-input:focus { border-color: #6366f1; }
        .chat-ui-send-btn { background: #16a34a; color: #fff; border: none; border-radius: 8px; width: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; }
        .chat-ui-send-btn:hover { background: #15803d; }
        .chat-ui-action-btn { font-size: 12px; font-weight: 700; color: #fff; border: none; border-radius: 8px; padding: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .chat-ui-action-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .accent-gradient { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
        .bg-purple { background: #9333ea; }
        .bg-green { background: rgba(22, 163, 74, 0.8); }
        .bg-slate { background: rgba(51, 65, 85, 0.5); }
        .border-green { border: 1px solid rgba(34, 197, 94, 0.3); }
        .border-slate { border: 1px solid rgba(99, 102, 241, 0.2); }
        .shadow-green { box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3); }
        .shadow-indigo { box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
        .shadow-purple { box-shadow: 0 4px 12px rgba(147, 51, 234, 0.3); }
        @media (max-width: 450px) {
          .top-tabs { gap: 6px; padding: 6px; margin: 8px 8px 10px; }
          .tab-btn { padding: 10px 0; }
          .tab-btn span { display: none; }
          .tab-btn ha-icon { margin: 0; --mdc-icon-size: 22px; }
          .cover-disc { width: 60px; height: 60px; flex: 0 0 60px; border-width: 1px; }
          .subtabs { grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 8px 8px 4px; }
          .search-row { padding: 6px 8px; gap: 8px; }
          .result-item { grid-template-columns: 44px minmax(0, 1fr) auto; padding: 6px 8px; gap: 8px; }
          .thumb, .thumb-wrap { width: 44px; height: 44px; }
          .result-title { font-size: 12px; }
        }
      </style>
      <ha-card>
        ${deviceSelectorHtml}
        <div class="top-tabs">
          ${[{ key: "media", icon: "mdi:music-note", label: "Media" }, { key: "control", icon: "mdi:tune-variant", label: "Control" }, { key: "chat", icon: "mdi:chat-processing", label: "Trò chuyện" }, { key: "system", icon: "mdi:cog", label: "System" }].map((tab) => `<button class="tab-btn ${this._activeTab === tab.key ? "active" : ""}" data-tab="${tab.key}"><ha-icon icon="${tab.icon}"></ha-icon><span>${tab.label}</span></button>`).join("")}
        </div>
        ${body}
      </ha-card>
    `;

    if (this._activeTab === "chat") this._damBaoTrangThaiChat?.();
    if (this._activeTab === "control") this._damBaoTrangThaiDieuKhien?.();
    if (this._activeTab === "system") this._damBaoTrangThaiHeThong?.();

    this._ganSuKien();
    this._dongBoTienDoDom?.();
    this._capNhatHenGioTienDo?.();

    if (this._activeTab === "chat") {
      setTimeout(() => {
        if (this._live2dManager && this._live2dManager.live2dApp) {
           const live2dWrapper = this.shadowRoot.getElementById('live2d-wrapper');
           if (live2dWrapper && this._live2dManager.live2dApp.view) { live2dWrapper.innerHTML = ''; live2dWrapper.appendChild(this._live2dManager.live2dApp.view); }
        }
      }, 100);
    }
    if (this._activeTab === "media") {
      const p = this._thongTinPhat?.();
      const currentTrackIdent = p?.track_id || p?.title;
      if (currentTrackIdent && this._lastScrolledTrackIdent !== currentTrackIdent) {
        this._lastScrolledTrackIdent = currentTrackIdent;
        setTimeout(() => { this.shadowRoot?.querySelector('.is-playing-item')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 150);
      }
    }
  }
}

Object.assign(
  ESP32AIBoxMediaPlayerControllerCard.prototype,
  UtilsMixin,
  CoreLogicMixin,
  TabMediaMixin,
  TabControlMixin,
  TabChatMixin,
  TabSystemMixin
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