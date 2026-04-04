import { EQ_BAND_LABELS } from './constants.js';

export const TabControlMixin = {
  async _damBaoTrangThaiDieuKhien() {
    const now = Date.now();
    if (now - this._lastControlStateRequestAt < 7000) return;
    this._lastControlStateRequestAt = now;
    try {
      await this._lamMoiEntity(180);
      await this._goiDichVu("esp32_aibox_media_controller", "wake_word_get_enabled");
      await this._goiDichVu("esp32_aibox_media_controller", "wake_word_get_sensitivity");
      await this._goiDichVu("esp32_aibox_media_controller", "custom_ai_get_enabled");
      await this._lamMoiEntity(220);
    } catch (err) {}
  },

  _veTabDieuKhien() {
    const wVal = this._surroundW ?? 40; const pVal = this._surroundP ?? 30; const sVal = this._surroundS ?? 10;
    const dacLVal = this._dacVolL ?? 231; const dacRVal = this._dacVolR ?? 231;
    const bassStrengthVal = this._bassStrength ?? 0; const loudnessGainVal = this._loudnessGain ?? 0;
    const mainBrightVal = this._mainLightBrightness ?? 100; const mainSpeedVal = this._mainLightSpeed ?? 50; const edgeIntVal = this._edgeLightIntensity ?? 50;
    const wakeSensVal = this._wakeSensitivity ?? 0.95;

    const renderSwitch = (id, label, isChecked, sublabel = "") => `
      <div class="neo-row">
        <div><div class="neo-label">${label}</div>${sublabel ? `<div class="neo-sublabel">${sublabel}</div>` : ''}</div>
        <label class="switch"><input id="${id}" type="checkbox" ${isChecked ? "checked" : ""} /><span class="slider"></span></label>
      </div>`;
    
    const renderSlider = (id, min, max, step, val, displayVal, label, unit = "") => `
      <div class="neo-slider-group">
        <span class="neo-label" style="min-width: 85px;">${label}</span>
        <input id="${id}" class="neo-slider styled-slider" type="range" min="${min}" max="${max}" step="${step}" value="${val}" style="background: ${this._getSliderBackgroundStyle(val, min, max)};" oninput="this.style.background = 'linear-gradient(to right, var(--accent) ' + ((this.value - this.min) / (this.max - this.min)) * 100 + '%, rgba(0,0,0,0.3) ' + ((this.value - this.min) / (this.max - this.min)) * 100 + '%)'" />
        <span id="val-${id}" class="neo-value">${displayVal}${unit}</span>
      </div>`;

    const eqBandsHtml = (this._eqBands || [0,0,0,0,0]).map((val, idx) => `
      <div class="eq-col">
        <span id="val-eq-${idx}" class="eq-val">${val ?? 0}</span>
        <input type="range" id="eq-band-ctrl-${idx}" data-idx="${idx}" min="-1500" max="1500" step="10" value="${val ?? 0}" class="eq-slider-vert styled-slider" orient="vertical" style="background: ${this._getSliderBackgroundStyle(val ?? 0, -1500, 1500, true)};" oninput="this.style.background = 'linear-gradient(to top, var(--accent) ' + ((this.value - this.min) / (this.max - this.min)) * 100 + '%, rgba(0,0,0,0.3) ' + ((this.value - this.min) / (this.max - this.min)) * 100 + '%)'">
        <span class="eq-label">${EQ_BAND_LABELS[idx]}</span>
      </div>`).join("");

    return `
      <section class="panel" style="padding-top: 4px;">
        <style>
            .neo-card { background: rgba(30, 41, 59, 0.4); border: 1px solid var(--line); border-radius: 16px; padding: 16px; margin-bottom: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .neo-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 16px; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
            .neo-title ha-icon { color: var(--accent); }
            .neo-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
            .neo-label { font-size: 13px; color: var(--text); font-weight: 600; }
            .neo-sublabel { font-size: 11px; color: var(--muted); margin-top: 4px; }
            .neo-slider-group { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
            .styled-slider { -webkit-appearance: none; appearance: none; flex: 1; height: 6px; border-radius: 3px; outline: none; cursor: pointer; }
            .styled-slider::-webkit-slider-thumb, .styled-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 2px solid var(--accent); cursor: pointer; -webkit-appearance: none; appearance: none; }
            .neo-value { font-size: 11px; color: var(--accent); font-weight: 700; min-width: 54px; text-align: center; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 6px; font-family: monospace; }
            .neo-btn-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(55px, 1fr)); gap: 8px; }
            .neo-btn { background: rgba(255,255,255,0.05); border: 1px solid var(--line); border-radius: 8px; color: var(--text); font-size: 11px; font-weight: 600; padding: 8px 4px; cursor: pointer; display: flex; justify-content: center; align-items: center; }
            .neo-btn:hover { background: rgba(255,255,255,0.1); }
            .neo-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
            .neo-subtabs { display: flex; background: rgba(0,0,0,0.25); padding: 4px; border-radius: 12px; margin-bottom: 16px; border: 1px solid var(--line); }
            .neo-subtab { flex: 1; padding: 8px 0; text-align: center; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--muted); border: none; background: transparent; }
            .neo-subtab:hover { color: var(--text); }
            .neo-subtab.active { background: var(--bg-card); color: var(--text); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
            .divider { height: 1px; background: var(--line); margin: 16px 0; border: none; }
            .eq-container { display: flex; justify-content: space-around; align-items: flex-end; height: 140px; margin-bottom: 20px; background: rgba(0,0,0,0.15); padding: 12px; border-radius: 12px; border: 1px inset var(--line); }
            .eq-col { display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; }
            .eq-val { font-size: 10px; color: var(--accent); font-weight: 700; font-family: monospace; min-height: 12px;}
            .eq-slider-vert { -webkit-appearance: none; appearance: none; width: 6px; height: 80px; border-radius: 3px; outline: none; cursor: pointer; }
            .eq-slider-vert::-webkit-slider-thumb, .eq-slider-vert::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid var(--accent); cursor: pointer; -webkit-appearance: none; appearance: none; }
            .eq-slider-vert[orient="vertical"] { writing-mode: bt-lr; -webkit-appearance: slider-vertical; }
            .eq-label { font-size: 10px; color: var(--muted); font-weight: 600;}
            .delay-input-group { display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2); padding: 6px 12px; border-radius: 8px; border: 1px solid var(--line); }
            .delay-input { background: transparent; border: none; color: var(--accent); font-weight: 700; width: 50px; text-align: center; font-family: monospace; outline: none; }
            .delay-btn { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 4px 12px; font-size: 11px; font-weight: 700; cursor: pointer; }
        </style>

        <div class="neo-card">
            <div class="neo-title"><ha-icon icon="mdi:microphone-outline"></ha-icon> Trợ lý & Đánh thức</div>
            ${renderSwitch('sw-wake-word', 'Từ khóa đánh thức', this._wakeEnabled, 'Độ nhạy đề xuất: 0.95 - 0.99')}
            <div style="margin-top: 12px;"></div>
            ${renderSlider('wake-sensitivity', 0, 1, 0.01, wakeSensVal, wakeSensVal.toFixed(2), 'Độ nhạy')}
            <hr class="divider">
            ${renderSwitch('ai-enabled', 'Chống điếc AI (Anti-deaf)', this._antiDeafEnabled)}
        </div>

        <div class="neo-card">
            <div class="neo-title"><ha-icon icon="mdi:cast-variant"></ha-icon> Kết Nối Không Dây</div>
            ${renderSwitch('sw-dlna', 'DLNA', this._dlnaEnabled)}
            ${renderSwitch('sw-airplay', 'AirPlay', this._airplayEnabled)}
            ${renderSwitch('sw-bluetooth', 'Bluetooth', this._bluetoothEnabled)}
        </div>

        <div class="neo-card">
            <div class="neo-title"><ha-icon icon="mdi:speaker-multiple"></ha-icon> Stereo Mode</div>
            ${renderSwitch('sw-stereo-main', 'Loa Mẹ (Master)', this._stereoEnabled)}
            ${renderSwitch('sw-stereo-sub', 'Loa Con (Slave)', this._stereoReceiver)}
            <div class="neo-row" style="margin-top: 12px;">
                <span class="neo-label">Độ trễ đồng bộ (Sync Delay)</span>
                <div class="delay-input-group">
                    <input type="number" id="stereo-delay-input" class="delay-input" value="${this._stereoDelay || 0}">
                    <span class="neo-sublabel" style="margin-top: 0;">ms</span>
                    <button id="btn-save-delay" class="delay-btn">LƯU</button>
                </div>
            </div>
        </div>

        <div class="neo-card">
            <div class="neo-title"><ha-icon icon="mdi:equalizer"></ha-icon> Audio Engine</div>
            <div class="neo-subtabs">
                <button id="btn-tab-eq" class="neo-subtab ${this._audioEngineTab === 'eq' ? 'active' : ''}"><ha-icon icon="mdi:tune" style="--mdc-icon-size: 16px;"></ha-icon> Equalizer</button>
                <button id="btn-tab-surround" class="neo-subtab ${this._audioEngineTab === 'surround' ? 'active' : ''}"><ha-icon icon="mdi:surround-sound" style="--mdc-icon-size: 16px;"></ha-icon> Surround</button>
            </div>

            <div id="content-eq" style="display: ${this._audioEngineTab === 'eq' ? 'block' : 'none'};">
                <div class="eq-container">${eqBandsHtml}</div>
                <div class="neo-btn-group" style="margin-bottom: 20px;">
                    <button class="neo-btn ctrl-eq-preset" data-preset="flat">Phẳng</button>
                    <button class="neo-btn ctrl-eq-preset" data-preset="bass">Bass</button>
                    <button class="neo-btn ctrl-eq-preset" data-preset="vocal">Vocal</button>
                    <button class="neo-btn ctrl-eq-preset" data-preset="rock">Rock</button>
                    <button class="neo-btn ctrl-eq-preset" data-preset="jazz">Jazz</button>
                </div>
                ${renderSwitch('sw-bass', 'Tăng cường Bass', this._bassEnabled)}
                <div style="margin: 12px 0 20px;">${renderSlider('slider-bass-strength', 0, 1000, 10, bassStrengthVal, bassStrengthVal / 10, 'Sức mạnh', '%')}</div>
                ${renderSwitch('sw-loudness', 'Độ lớn âm thanh (Loudness)', this._loudnessEnabled)}
                <div style="margin: 12px 0 20px;">${renderSlider('slider-loudness-gain', -3000, 3000, 10, loudnessGainVal, (loudnessGainVal / 100).toFixed(1), 'Khuếch đại', ' dB')}</div>
                <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: 12px; border: 1px solid var(--line);">
                    <div class="neo-label" style="margin-bottom: 12px; color: var(--muted);"><ha-icon icon="mdi:chart-bell-curve" style="--mdc-icon-size: 16px; vertical-align: text-bottom; margin-right: 4px;"></ha-icon> Dải Trung - Cao (DAC)</div>
                    ${renderSlider('slider-dac-l', 211, 251, 1, dacLVal, (dacLVal - 231 > 0 ? '+' : '') + (dacLVal - 231), 'Âm trầm', ' dB')}
                    <div style="margin-top: 12px;">${renderSlider('slider-dac-r', 211, 251, 1, dacRVal, (dacRVal - 231 > 0 ? '+' : '') + (dacRVal - 231), 'Âm cao', ' dB')}</div>
                </div>
            </div>

            <div id="content-surround" style="display: ${this._audioEngineTab === 'surround' ? 'block' : 'none'};">
                <div style="background: rgba(0,0,0,0.15); padding: 16px; border-radius: 12px; border: 1px solid var(--line); margin-bottom: 16px;">
                    ${renderSlider('sur-w', 0, 100, 1, wVal, wVal, 'Chiều rộng (W)')}
                    <div style="margin: 16px 0;">${renderSlider('sur-p', 0, 100, 1, pVal, pVal, 'Hiện diện (P)')}</div>
                    ${renderSlider('sur-s', 0, 100, 1, sVal, sVal, 'Không gian (S)')}
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <button class="neo-btn" id="btn-sur-cinema" style="padding: 12px;"><ha-icon icon="mdi:movie-open" style="--mdc-icon-size: 16px; margin-right: 6px;"></ha-icon> Cinema</button>
                    <button class="neo-btn" id="btn-sur-wide" style="padding: 12px;"><ha-icon icon="mdi:panorama" style="--mdc-icon-size: 16px; margin-right: 6px;"></ha-icon> Wide Space</button>
                </div>
            </div>
        </div>

        <div class="neo-card">
            <div class="neo-title"><ha-icon icon="mdi:led-strip-variant"></ha-icon> Điều Khiển Đèn</div>
            ${renderSwitch('sw-led-cho', 'Đèn LED chờ (Nháy theo nhạc)', this._ledChoEnabled)}
            <hr class="divider">
            <div class="neo-subtabs">
                <button id="btn-tab-light-main" class="neo-subtab ${this._lightingTab === 'main' ? 'active' : ''}"><ha-icon icon="mdi:lightbulb-on" style="--mdc-icon-size: 16px;"></ha-icon> Đèn Chính</button>
                <button id="btn-tab-light-edge" class="neo-subtab ${this._lightingTab === 'edge' ? 'active' : ''}"><ha-icon icon="mdi:border-outside" style="--mdc-icon-size: 16px;"></ha-icon> Đèn Viền</button>
            </div>
            <div id="content-light-main" style="display: ${this._lightingTab === 'main' ? 'block' : 'none'};">
                ${renderSwitch('sw-light-main', 'Trạng thái Đèn Chính', this._mainLightEnabled)}
                <div style="margin: 16px 0;">${renderSlider('slider-light-bright', 1, 200, 1, mainBrightVal, mainBrightVal, 'Độ sáng')}</div>
                <div style="margin-bottom: 20px;">${renderSlider('slider-light-speed', 1, 100, 1, mainSpeedVal, mainSpeedVal, 'Tốc độ')}</div>
                <div class="neo-label" style="margin-bottom: 10px; color: var(--muted);">Chế độ hiệu ứng</div>
                <div class="neo-btn-group">
                    ${[[0, "Mặc định"], [1, "Xoay vòng"], [2, "Nháy 1"], [3, "Đơn sắc"], [4, "Nháy 2"], [7, "Hơi thở"]].map(([m, l]) => `<button class="neo-btn light-mode-btn ${this._mainLightMode === m ? 'active' : ''}" data-mode="${m}">${l}</button>`).join("")}
                </div>
            </div>
            <div id="content-light-edge" style="display: ${this._lightingTab === 'edge' ? 'block' : 'none'};">
                ${renderSwitch('sw-light-edge', 'Trạng thái Đèn Viền', this._edgeLightEnabled)}
                <div style="margin-top: 16px;">${renderSlider('slider-edge-intensity', 0, 100, 1, edgeIntVal, edgeIntVal, 'Cường độ', '%')}</div>
            </div>
        </div>
      </section>`;
  },

  _ganSuKienTabControl(root) {
    const bindSwitch = (id, propertyKey, setService, serviceArgKey = "enabled", flipOnFail = true) => {
      root.getElementById(id)?.addEventListener("change", async (ev) => {
        const desired = Boolean(ev.target.checked);
        this[propertyKey] = desired; this._datCongTacCho(propertyKey, desired);
        try { await this._goiDichVu("esp32_aibox_media_controller", setService, { [serviceArgKey]: desired }); await this._lamMoiEntity(250, 2); }
        catch (err) { if (flipOnFail) { this._xoaCongTacCho(propertyKey); this[propertyKey] = !desired; ev.target.checked = this[propertyKey]; } }
      });
    };

    bindSwitch("sw-wake-word", "_wakeEnabled", "wake_word_set_enabled");
    bindSwitch("ai-enabled", "_antiDeafEnabled", "anti_deaf_ai_set_enabled");
    bindSwitch("sw-dlna", "_dlnaEnabled", "set_dlna");
    bindSwitch("sw-airplay", "_airplayEnabled", "set_airplay");
    bindSwitch("sw-bluetooth", "_bluetoothEnabled", "set_bluetooth");

    const wakeSens = root.getElementById("wake-sensitivity");
    if (wakeSens) {
      wakeSens.addEventListener("input", (ev) => { this._wakeSensitivity = parseFloat(ev.target.value) || 0.95; root.getElementById("val-wake-sensitivity").innerText = this._wakeSensitivity.toFixed(2); });
      wakeSens.addEventListener("change", async (ev) => { await this._goiDichVu("esp32_aibox_media_controller", "wake_word_set_sensitivity", { sensitivity: this._wakeSensitivity }); await this._lamMoiEntity(300); });
    }

    // EQ bindings inside Control
    root.querySelectorAll("[id^='eq-band-ctrl-']").forEach((slider) => {
      const docBand = Math.max(0, Math.round(Number(slider.dataset.idx || 0)));
      slider.addEventListener("input", (ev) => {
        const band = Math.max(0, Math.min(this._eqBandCount - 1, docBand));
        const level = this._gioiHanEqLevel(ev.target.value, this._layEqLevelTheoBand(band, 0));
        if (!Array.isArray(this._eqBands) || this._eqBands.length < this._eqBandCount) this._eqBands = Array.from({ length: this._eqBandCount }, (_, index) => this._layEqLevelTheoBand(index, 0));
        this._eqBand = band; this._eqLevel = level; this._eqBands[band] = level;
        this._batDauCanhGacDongBoEq(1000); this._capNhatEqGiaoDien(root);
        const valEl = root.getElementById(`val-eq-${band}`); if (valEl) valEl.innerText = level;
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
    root.querySelectorAll(".ctrl-eq-preset").forEach(el => el.addEventListener("click", async () => await this._apDungEqMau(el.dataset.preset || "")));

    // Audio Engine bindings inside Control
    bindSwitch("sw-bass", "_bassEnabled", "set_bass_enable", "enabled", false);
    const bassStrength = root.getElementById("slider-bass-strength");
    if (bassStrength) {
      bassStrength.addEventListener("input", (ev) => { this._bassStrength = parseInt(ev.target.value) || 0; root.getElementById("val-slider-bass-strength").innerText = (this._bassStrength / 10) + "%"; });
      bassStrength.addEventListener("change", async (ev) => { await this._goiDichVu("esp32_aibox_media_controller", "set_bass_strength", { strength: this._bassStrength }); await this._lamMoiEntity(250, 2); });
    }

    bindSwitch("sw-loudness", "_loudnessEnabled", "set_loudness_enable", "enabled", false);
    const loudGain = root.getElementById("slider-loudness-gain");
    if (loudGain) {
      loudGain.addEventListener("input", (ev) => { this._loudnessGain = parseInt(ev.target.value) || 0; root.getElementById("val-slider-loudness-gain").innerText = (this._loudnessGain / 100).toFixed(1) + " dB"; });
      loudGain.addEventListener("change", async (ev) => { await this._goiDichVu("esp32_aibox_media_controller", "set_loudness_gain", { gain: this._loudnessGain }); await this._lamMoiEntity(250, 2); });
    }

    root.getElementById("sw-led-cho")?.addEventListener("change", async (ev) => { this._ledChoEnabled = ev.target.checked; try { await this._goiDichVu("esp32_aibox_media_controller", "led_toggle"); await this._lamMoiEntity(250, 2); } catch (err) {} });
    root.getElementById("sw-stereo-main")?.addEventListener("change", async (ev) => { this._stereoEnabled = ev.target.checked; try { await this._goiDichVu("esp32_aibox_media_controller", this._stereoEnabled ? "stereo_enable" : "stereo_disable"); await this._lamMoiEntity(250, 2); } catch (err) {} });
    root.getElementById("sw-stereo-sub")?.addEventListener("change", async (ev) => { this._stereoReceiver = ev.target.checked; try { await this._goiDichVu("esp32_aibox_media_controller", this._stereoReceiver ? "stereo_enable_receiver" : "stereo_disable_receiver"); await this._lamMoiEntity(250, 2); } catch (err) {} });
    root.getElementById("btn-save-delay")?.addEventListener("click", async () => { this._stereoDelay = parseInt(root.getElementById("stereo-delay-input").value) || 0; try { await this._goiDichVu("esp32_aibox_media_controller", "stereo_set_sync_delay", { sync_delay_ms: this._stereoDelay }); await this._lamMoiEntity(250, 2); } catch (err) {} });

    // Surround bindings
    const updateSurroundParams = async () => {
      const w = this._surroundW ?? 40; const p = this._surroundP ?? 30; const s = this._surroundS ?? 10;
      const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
      const bands = [-Math.round(s * 8), -Math.round(w * 7), -Math.round(w * 9), Math.round(w * 5 + p * 6), Math.round(w * 6 + p * 8)];
      const gain = clamp(Math.round(s * 6 + w * 2), 0, 3000);
      if (!Array.isArray(this._eqBands) || this._eqBands.length < 5) this._eqBands = [0,0,0,0,0];
      bands.forEach((lvl, i) => this._eqBands[i] = clamp(lvl, -1500, 1500));
      this._loudnessGain = gain; this._eqEnabled = true; this._loudnessEnabled = true; this._veGiaoDien();
      try {
          await this._goiDichVu("media_player", "set_eq_enable", { enabled: true });
          for (let i = 0; i < 5; i++) await this._goiDichVu("media_player", "set_eq_bandlevel", { band: i, level: this._eqBands[i] });
          await this._goiDichVu("esp32_aibox_media_controller", "set_loudness_enable", { enabled: true });
          await this._goiDichVu("esp32_aibox_media_controller", "set_loudness_gain", { gain: gain });
          await this._lamMoiEntity(250, 2);
      } catch (err) {}
    };

    root.getElementById("sur-w")?.addEventListener("input", (e) => { this._surroundW = parseInt(e.target.value) || 0; root.getElementById("val-sur-w").innerText = this._surroundW; });
    root.getElementById("sur-w")?.addEventListener("change", updateSurroundParams);
    root.getElementById("sur-p")?.addEventListener("input", (e) => { this._surroundP = parseInt(e.target.value) || 0; root.getElementById("val-sur-p").innerText = this._surroundP; });
    root.getElementById("sur-p")?.addEventListener("change", updateSurroundParams);
    root.getElementById("sur-s")?.addEventListener("input", (e) => { this._surroundS = parseInt(e.target.value) || 0; root.getElementById("val-sur-s").innerText = this._surroundS; });
    root.getElementById("sur-s")?.addEventListener("change", updateSurroundParams);
    root.getElementById("btn-sur-cinema")?.addEventListener("click", () => { this._surroundW = 60; this._surroundP = 40; this._surroundS = 15; updateSurroundParams(); this._veGiaoDien(); });
    root.getElementById("btn-sur-wide")?.addEventListener("click", () => { this._surroundW = 80; this._surroundP = 50; this._surroundS = 10; updateSurroundParams(); this._veGiaoDien(); });

    // DAC bindings
    const bindDac = (id, prop, controlName, valId) => {
        const el = root.getElementById(id);
        if(!el) return;
        el.addEventListener("input", (e) => { this[prop] = parseInt(e.target.value) || 231; root.getElementById(valId).innerText = (this[prop] - 231 > 0 ? '+' : '') + (this[prop] - 231) + ' dB'; });
        el.addEventListener("change", async (e) => {
            this[prop] = parseInt(e.target.value) || 231;
            try { await this._goiDichVu("media_player", "set_mixer_value", { control_name: controlName, value: this[prop].toString() }); await this._lamMoiEntity(250, 2); } 
            catch (err) { try { await this._goiDichVu("esp32_aibox_media_controller", "send_command", { type: 'sends', list: [{type: 'setMixerValue', controlName: controlName, value: this[prop].toString()}, {type: 'get_eq_config'}] }); } catch (e2) {} }
        });
    };
    bindDac("slider-dac-l", "_dacVolL", "DAC Digital Volume L", "val-slider-dac-l");
    bindDac("slider-dac-r", "_dacVolR", "DAC Digital Volume R", "val-slider-dac-r");

    // Light bindings inside Control
    bindSwitch("sw-light-main", "_mainLightEnabled", "set_main_light");
    const mBright = root.getElementById("slider-light-bright");
    if (mBright) {
      mBright.addEventListener("input", (ev) => { this._mainLightBrightness = parseInt(ev.target.value) || 100; root.getElementById("val-slider-light-bright").innerText = this._mainLightBrightness; });
      mBright.addEventListener("change", async (ev) => { await this._goiDichVu("esp32_aibox_media_controller", "set_light_brightness", { brightness: this._mainLightBrightness }); await this._lamMoiEntity(250, 2); });
    }
    const mSpeed = root.getElementById("slider-light-speed");
    if (mSpeed) {
      mSpeed.addEventListener("input", (ev) => { this._mainLightSpeed = parseInt(ev.target.value) || 50; root.getElementById("val-slider-light-speed").innerText = this._mainLightSpeed; });
      mSpeed.addEventListener("change", async (ev) => { await this._goiDichVu("esp32_aibox_media_controller", "set_light_speed", { speed: this._mainLightSpeed }); await this._lamMoiEntity(250, 2); });
    }
    root.querySelectorAll(".light-mode-btn").forEach(el => el.addEventListener("click", async () => {
      this._mainLightMode = Number(el.dataset.mode || "0"); await this._goiDichVu("esp32_aibox_media_controller", "set_light_mode", { mode: this._mainLightMode }); await this._lamMoiEntity(250, 2);
    }));
    bindSwitch("sw-light-edge", "_edgeLightEnabled", "set_edge_light", "enabled", false); // Different signature
    const eInt = root.getElementById("slider-edge-intensity");
    if (eInt) {
      eInt.addEventListener("input", (ev) => { this._edgeLightIntensity = parseInt(ev.target.value) || 50; root.getElementById("val-slider-edge-intensity").innerText = this._edgeLightIntensity + "%"; });
      eInt.addEventListener("change", async (ev) => { await this._goiDichVu("esp32_aibox_media_controller", "set_edge_light", { enabled: this._edgeLightEnabled, intensity: this._edgeLightIntensity }); await this._lamMoiEntity(250, 2); });
    }

    // Tab sub-navigation inside Control
    root.getElementById("btn-tab-eq")?.addEventListener("click", () => { this._audioEngineTab = "eq"; this._veGiaoDien(); });
    root.getElementById("btn-tab-surround")?.addEventListener("click", () => { this._audioEngineTab = "surround"; this._veGiaoDien(); });
    root.getElementById("btn-tab-light-main")?.addEventListener("click", () => { this._lightingTab = "main"; this._veGiaoDien(); });
    root.getElementById("btn-tab-light-edge")?.addEventListener("click", () => { this._lightingTab = "edge"; this._veGiaoDien(); });
  }
};