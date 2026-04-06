import { EQ_BAND_LABELS } from './constants.js';

export const CoreLogicMixin = {
  // === CÁC HÀM QUẢN LÝ TRẠNG THÁI THIẾT BỊ ===
  _khoiTaoTrangThaiThietBi() {
    this._volumeLevel = 0;
    this._preMuteVolumeLevel = null;
    this._lastVolumeChangeAt = 0;
    this._wakeSensitivity = 0.9;
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
    this._pendingSwitches = {};
  },

  _dongBoTrangThaiThietBi(attrs) {
    const wake = attrs.wake_word || {};
    const ai = attrs.custom_ai || {};
    const volumeLevel = attrs.volume_level;

    // FIX LỖI GIẬT ÂM LƯỢNG (Volume Jitter): Khóa đồng bộ trong 3 giây sau khi người dùng kéo thanh trượt
    if (typeof volumeLevel === "number") {
      if (!this._lastVolumeChangeAt || Date.now() - this._lastVolumeChangeAt > 3000) {
        this._volumeLevel = Math.max(0, Math.min(1, volumeLevel));
      }
    }
    
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
  },

  // === CÁC HÀM CORE VÀ TIỆN ÍCH THIẾT BỊ ===
  _gioiHanEqLevel(value, fallback = 0) {
    const numeric = this._epKieuSo(value, fallback);
    return Math.max(-1500, Math.min(1500, Math.round(numeric)));
  },

  _dinhDangEqLevel(level) {
    const numeric = this._gioiHanEqLevel(level, 0);
    return numeric > 0 ? `+${numeric}` : `${numeric}`;
  },

  _batDauCanhGacDongBoEq(durationMs = 1200) {
    this._eqSyncGuardUntil = Date.now() + Math.max(0, Number(durationMs) || 0);
  },

  _layNhanEqBand(band = this._eqBand) {
    const index = Math.max(0, Math.round(Number(band) || 0));
    return EQ_BAND_LABELS[index] || `Band ${index + 1}`;
  },

  _layEqLevelTheoBand(band, fallback = this._eqLevel) {
    if (!Array.isArray(this._eqBands) || this._eqBands.length === 0) return this._gioiHanEqLevel(fallback, 0);
    const index = Math.max(0, Math.round(Number(band) || 0));
    if (index >= this._eqBands.length) return this._gioiHanEqLevel(fallback, 0);
    return this._gioiHanEqLevel(this._eqBands[index], fallback);
  },

  _capNhatEqGiaoDien(root = this.shadowRoot) {
    if (!root) return;
    const eqToggle = root.getElementById("eq-enabled");
    if (eqToggle) eqToggle.checked = Boolean(this._eqEnabled);
    root.querySelectorAll("[data-eq-band]").forEach((slider) => {
      const band = Math.max(0, Math.round(Number(slider.dataset.eqBand || 0)));
      const value = this._layEqLevelTheoBand(band, 0);
      slider.value = String(value);
      const valueEl = root.querySelector(`[data-eq-value="${band}"]`);
      if (valueEl) valueEl.textContent = this._dinhDangEqLevel(value);
      const labelEl = root.querySelector(`[data-eq-name="${band}"]`);
      if (labelEl) labelEl.classList.toggle("is-active", band === this._eqBand);
    });
  },

  async _apDungEqMau(name) {
    const presets = {
      flat: [0, 0, 0, 0, 0], bass: [1200, 700, 0, -200, -100], vocal: [-300, 400, 900, 500, 200],
      rock: [500, 300, 100, 400, 600], jazz: [200, 200, 200, 400, 600],
    };
    const presetLevels = presets[name];
    if (!presetLevels) return;
    const targetCount = Math.max(1, this._eqBandCount || presetLevels.length);
    const levels = Array.from({ length: targetCount }, (_, index) => this._gioiHanEqLevel(presetLevels[index] ?? 0, 0));
    this._batDauCanhGacDongBoEq(1800);
    await this._goiDichVu("media_player", "set_eq_enable", { enabled: true });
    this._eqEnabled = true; this._eqBands = levels.slice(); this._eqBandCount = levels.length;
    this._eqBand = Math.max(0, Math.min(this._eqBandCount - 1, this._eqBand));
    this._eqLevel = this._layEqLevelTheoBand(this._eqBand);
    this._capNhatEqGiaoDien(this.shadowRoot);
    for (let band = 0; band < levels.length; band += 1) {
      await this._goiDichVu("media_player", "set_eq_bandlevel", { band, level: levels[band] });
    }
    await this._lamMoiEntity(350);
  },

  _laBluetoothDangBat(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number" && Number.isFinite(value)) return value === 3;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    if (Number.isFinite(Number(normalized))) return Number(normalized) === 3;
    if (normalized.includes("bluetooth")) return !(normalized.includes("off") || normalized.includes("disable") || normalized.includes("disconnect") || normalized.includes("idle"));
    return this._epKieuBoolean(normalized, fallback);
  },

  _datCongTacCho(key, desired, ttlMs = 5000) {
    this._pendingSwitches[key] = { value: Boolean(desired), expiresAt: Date.now() + ttlMs };
  },

  _xoaCongTacCho(key) {
    delete this._pendingSwitches[key];
  },

  _layTrangThaiCongTac(key, deviceValue) {
    const resolvedDevice = Boolean(deviceValue);
    const pending = this._pendingSwitches[key];
    if (!pending) return resolvedDevice;
    if (Date.now() > pending.expiresAt || resolvedDevice === pending.value) {
      this._xoaCongTacCho(key);
      return resolvedDevice;
    }
    return pending.value;
  },

  _laCongTacDangCho(key) {
    const pending = this._pendingSwitches[key];
    if (!pending) return false;
    if (Date.now() > pending.expiresAt) { this._xoaCongTacCho(key); return false; }
    return true;
  },

  async _goiDichVu(domain, service, data = {}) {
    if (!this._hass || !this._config) return;
    const payload = { entity_id: this._config.entity, ...data };
    const candidateDomains = [domain];
    if (domain === "esp32_aibox_media_controller") candidateDomains.push("media_player");
    else if (domain === "media_player") candidateDomains.push("esp32_aibox_media_controller");

    const seen = new Set();
    for (const candidate of candidateDomains) {
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      if (this._hass.services?.[candidate]?.[service]) {
        await this._hass.callService(candidate, service, payload);
        return;
      }
    }
    await this._hass.callService(domain, service, payload);
  },

  async _lamMoiEntity(delayMs = 250, attempts = 1) {
    if (!this._hass || !this._config) return;
    const totalAttempts = Math.max(1, Number(attempts) || 1);
    for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
      let refreshed = false;
      try {
        await this._goiDichVu("esp32_aibox_media_controller", "refresh_state");
        refreshed = true;
      } catch (err) { refreshed = false; }
      if (!refreshed) {
        await this._hass.callService("homeassistant", "update_entity", { entity_id: this._config.entity });
      }
    }
  },

  _laPhatDangHoatDong(value) {
    if (value === true || value === 1 || value === 3) return true;
    if (typeof value === "number" && value > 0) return value === 1 || value === 3;
    if (typeof value === "string") return ["true", "1", "3", "playing", "play", "on"].includes(value.trim().toLowerCase());
    return false;
  },

  _laPhatKhongHoatDong(value) {
    if (value === false || value === 0 || value === 2) return true;
    if (typeof value === "number") return value === 0 || value === 2;
    if (typeof value === "string") return ["false", "0", "2", "paused", "pause", "stopped", "stop", "idle", "off"].includes(value.trim().toLowerCase());
    return false;
  }
};