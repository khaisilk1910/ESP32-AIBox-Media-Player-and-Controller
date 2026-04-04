import { EQ_BAND_LABELS } from './constants.js';

export const CoreLogicMixin = {
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