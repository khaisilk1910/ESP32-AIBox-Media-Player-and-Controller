import { EQ_BAND_LABELS } from './constants.js';

export const TabSystemMixin = {
  async _damBaoTrangThaiHeThong() {
    const now = Date.now();
    if (now - this._lastSystemStateRequestAt < 7000) return;
    this._lastSystemStateRequestAt = now;
    try {
      await this._goiDichVu("esp32_aibox_media_controller", "refresh_state");
      await this._lamMoiEntity(250, 2);
    } catch (err) {}
  },

  _veTabHeThong() { 
    const eqBandColumns = Math.max(1, this._eqBandCount || EQ_BAND_LABELS.length);
    const lightModes = [[0, "Mặc định"], [1, "Xoay vòng"], [2, "Nhảy 1"], [3, "Đơn sắc"], [4, "Nhảy 2"], [7, "Hơi thở"]];
    return `
      <section class="panel">
        <h3 class="section-title"><ha-icon icon="mdi:cog"></ha-icon> System</h3>
        <div class="tile">
          <div class="audio-engine-shell">
            <div class="audio-engine-head">
              <div class="audio-engine-title-wrap"><div class="audio-engine-icon hover-scale"><ha-icon icon="mdi:tune-vertical-variant"></ha-icon></div><div class="audio-engine-copy"><strong>Bộ âm thanh</strong></div></div>
              <div class="audio-engine-actions"><label class="switch"><input id="eq-enabled" type="checkbox" ${this._eqEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
            </div>
            <div class="eq-vertical-shell">
              ${Array.from({ length: eqBandColumns }, (_, index) => {
                const value = this._layEqLevelTheoBand(index, 0);
                return `
                  <div class="eq-band-column hover-lift">
                    <div class="eq-band-level" data-eq-value="${index}">${this._dinhDangEqLevel(value)}</div>
                    <div class="eq-band-slider-wrap"><input id="eq-slider-${index}" class="eq-vertical-slider" data-eq-band="${index}" type="range" min="-1500" max="1500" step="100" value="${value}" orient="vertical" /></div>
                    <div class="eq-band-name ${index === this._eqBand ? "is-active" : ""}" data-eq-name="${index}">${this._maHoaHtml(this._layNhanEqBand(index))}</div>
                  </div>
                `;
              }).join("")}
            </div>
            <div class="actions-inline eq-presets">
              <button class="mini-btn eq-preset hover-pop" data-preset="flat">Phẳng</button>
              <button class="mini-btn eq-preset hover-pop" data-preset="bass">Bass Boost</button>
              <button class="mini-btn eq-preset hover-pop" data-preset="vocal">Giọng hát</button>
              <button class="mini-btn eq-preset hover-pop" data-preset="rock">Nhạc rock</button>
              <button class="mini-btn eq-preset hover-pop" data-preset="jazz">Nhạc jazz</button>
            </div>
          </div>
        </div>
        <div class="tile">
          <div class="label-line"><strong>Tăng cường bass</strong><label class="switch"><input id="bass-enabled" type="checkbox" ${this._bassEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
          <div class="label-line"><span>Strength</span><strong>${Math.round(this._bassStrength / 10)}%</strong></div>
          <input id="bass-strength" type="range" min="0" max="1000" step="10" value="${this._bassStrength}" />
        </div>
        <div class="tile">
          <div class="label-line"><strong>Độ lớn âm thanh (Loudness)</strong><label class="switch"><input id="loudness-enabled" type="checkbox" ${this._loudnessEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
          <div class="label-line"><span>Gain</span><strong>${(this._loudnessGain / 100).toFixed(1)} dB</strong></div>
          <input id="loudness-gain" type="range" min="-3000" max="3000" step="1" value="${this._loudnessGain}" />
        </div>
        <div class="tile">
          <h4 class="sub-section-title"><ha-icon icon="mdi:lightbulb"></ha-icon> Điều khiển đèn</h4>
          <div class="subtabs">
            <button class="subtab hover-pop ${this._lightingTab === "main" ? "active" : ""}" data-lighting-tab="main">Đèn Chính (RGB)</button>
            <button class="subtab hover-pop ${this._lightingTab === "edge" ? "active" : ""}" data-lighting-tab="edge">Đèn viền</button>
          </div>
          ${this._lightingTab === "main" ? `
            <div class="tile in-tile">
              <div class="label-line"><strong>Trạng thái đèn chính</strong><label class="switch"><input id="main-light-enabled" type="checkbox" ${this._mainLightEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
              <div class="label-line"><span>Độ sáng</span><strong>${this._mainLightBrightness}</strong></div>
              <input id="main-light-brightness" type="range" min="1" max="200" step="1" value="${this._mainLightBrightness}" />
              <div class="label-line"><span>Tốc độ</span><strong>${this._mainLightSpeed}</strong></div>
              <input id="main-light-speed" type="range" min="1" max="100" step="1" value="${this._mainLightSpeed}" />
              <div class="actions-inline modes">
                ${lightModes.map(([mode, label]) => `<button class="mini-btn light-mode hover-pop ${this._mainLightMode === mode ? "active" : ""}" data-mode="${mode}">${label}</button>`).join("")}
              </div>
            </div>
          ` : `
            <div class="tile in-tile">
              <div class="label-line"><strong>Trạng thái đèn viền</strong><label class="switch"><input id="edge-light-enabled" type="checkbox" ${this._edgeLightEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
              <div class="label-line"><span>Cường độ</span><strong>${this._edgeLightIntensity}</strong></div>
              <input id="edge-light-intensity" type="range" min="0" max="100" step="1" value="${this._edgeLightIntensity}" />
            </div>
          `}
        </div>
        <div class="tile"><button id="system-reboot" class="danger-btn hover-scale"><ha-icon icon="mdi:restart"></ha-icon> Reboot Speaker</button></div>
      </section>
    `;
  },

  _ganSuKienTabSystem(root) {
    root.getElementById("eq-enabled")?.addEventListener("change", async (ev) => {
      this._eqEnabled = Boolean(ev.target.checked);
      this._batDauCanhGacDongBoEq(1400); this._capNhatEqGiaoDien(root);
      await this._goiDichVu("media_player", "set_eq_enable", { enabled: this._eqEnabled });
      await this._lamMoiEntity(250, 2);
    });

    root.querySelectorAll("[data-eq-band]").forEach((slider) => {
      const docBand = Math.max(0, Math.round(Number(slider.dataset.eqBand || 0)));
      slider.addEventListener("input", (ev) => {
        const band = Math.max(0, Math.min(this._eqBandCount - 1, docBand));
        const level = this._gioiHanEqLevel(ev.target.value, this._layEqLevelTheoBand(band, 0));
        if (!Array.isArray(this._eqBands) || this._eqBands.length < this._eqBandCount) this._eqBands = Array.from({ length: this._eqBandCount }, (_, index) => this._layEqLevelTheoBand(index, 0));
        this._eqBand = band; this._eqLevel = level; this._eqBands[band] = level;
        this._batDauCanhGacDongBoEq(1000); this._capNhatEqGiaoDien(root);
      });
      slider.addEventListener("change", async (ev) => {
        const band = Math.max(0, Math.min(this._eqBandCount - 1, docBand));
        const level = this._gioiHanEqLevel(ev.target.value, this._layEqLevelTheoBand(band, 0));
        this._eqBands[band] = level; this._batDauCanhGacDongBoEq(1600);
        if (!this._eqEnabled) { this._eqEnabled = true; this._capNhatEqGiaoDien(root); await this._goiDichVu("media_player", "set_eq_enable", { enabled: true }); }
        await this._goiDichVu("media_player", "set_eq_bandlevel", { band, level }); await this._lamMoiEntity(220, 2); this._xuLyRenderCho();
      });
      slider.addEventListener("blur", () => { setTimeout(() => this._xuLyRenderCho(), 0); });
    });
    root.querySelectorAll(".eq-preset").forEach(el => el.addEventListener("click", async () => await this._apDungEqMau(el.dataset.preset || "")));

    root.getElementById("bass-enabled")?.addEventListener("change", async (ev) => { this._bassEnabled = Boolean(ev.target.checked); await this._goiDichVu("esp32_aibox_media_controller", "set_bass_enable", { enabled: this._bassEnabled }); await this._lamMoiEntity(250, 2); });
    root.getElementById("bass-strength")?.addEventListener("change", async (ev) => { this._bassStrength = parseInt(ev.target.value) || 0; await this._goiDichVu("esp32_aibox_media_controller", "set_bass_strength", { strength: this._bassStrength }); await this._lamMoiEntity(250, 2); });
    root.getElementById("loudness-enabled")?.addEventListener("change", async (ev) => { this._loudnessEnabled = Boolean(ev.target.checked); await this._goiDichVu("esp32_aibox_media_controller", "set_loudness_enable", { enabled: this._loudnessEnabled }); await this._lamMoiEntity(250, 2); });
    root.getElementById("loudness-gain")?.addEventListener("change", async (ev) => { this._loudnessGain = parseInt(ev.target.value) || 0; await this._goiDichVu("esp32_aibox_media_controller", "set_loudness_gain", { gain: this._loudnessGain }); await this._lamMoiEntity(250, 2); });

    root.querySelectorAll("[data-lighting-tab]").forEach((el) => { el.addEventListener("click", () => { this._lightingTab = el.dataset.lightingTab || "main"; this._veGiaoDien(); }); });
    root.getElementById("main-light-enabled")?.addEventListener("change", async (ev) => { const desired = Boolean(ev.target.checked); this._mainLightEnabled = desired; this._datCongTacCho("main_light_enabled", desired); try { await this._goiDichVu("esp32_aibox_media_controller", "set_main_light", { enabled: desired }); await this._lamMoiEntity(250, 2); } catch (err) { this._xoaCongTacCho("main_light_enabled"); this._mainLightEnabled = !desired; ev.target.checked = this._mainLightEnabled; } });
    root.getElementById("main-light-brightness")?.addEventListener("change", async (ev) => { this._mainLightBrightness = parseInt(ev.target.value) || 100; await this._goiDichVu("esp32_aibox_media_controller", "set_light_brightness", { brightness: this._mainLightBrightness }); await this._lamMoiEntity(250, 2); });
    root.getElementById("main-light-speed")?.addEventListener("change", async (ev) => { this._mainLightSpeed = parseInt(ev.target.value) || 50; await this._goiDichVu("esp32_aibox_media_controller", "set_light_speed", { speed: this._mainLightSpeed }); await this._lamMoiEntity(250, 2); });
    root.querySelectorAll(".light-mode").forEach(el => el.addEventListener("click", async () => { this._mainLightMode = Number(el.dataset.mode || "0"); await this._goiDichVu("esp32_aibox_media_controller", "set_light_mode", { mode: this._mainLightMode }); await this._lamMoiEntity(250, 2); }));
    
    root.getElementById("edge-light-enabled")?.addEventListener("change", async (ev) => { this._edgeLightEnabled = Boolean(ev.target.checked); await this._goiDichVu("esp32_aibox_media_controller", "set_edge_light", { enabled: this._edgeLightEnabled, intensity: this._edgeLightIntensity }); await this._lamMoiEntity(250, 2); });
    root.getElementById("edge-light-intensity")?.addEventListener("change", async (ev) => { this._edgeLightIntensity = parseInt(ev.target.value) || 50; await this._goiDichVu("esp32_aibox_media_controller", "set_edge_light", { enabled: this._edgeLightEnabled, intensity: this._edgeLightIntensity }); await this._lamMoiEntity(250, 2); });

    root.getElementById("system-reboot")?.addEventListener("click", async () => { await this._goiDichVu("esp32_aibox_media_controller", "reboot"); });
  }
};