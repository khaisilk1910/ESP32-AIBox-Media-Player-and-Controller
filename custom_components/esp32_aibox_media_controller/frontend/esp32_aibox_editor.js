export class ESP32AIBoxMediaPlayerControllerEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    this._config = config || {};
    if (this._rendered) this.updateUI();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) {
      this.render();
      this._rendered = true;
    }
  }

  render() {
    if (!this._hass) return;

    this.innerHTML = `
      <style>
        .editor-container { padding: 12px 0; font-family: var(--paper-font-body1_-_font-family, sans-serif); }
        .row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; width: 100%;}
        .row-col { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; width: 100%;}
        .label { font-weight: 500; color: var(--primary-text-color); font-size: 14px; }
        .input-group { display: flex; align-items: center; gap: 12px; }
        input[type=color] { cursor: pointer; border: 1px solid var(--divider-color, #e0e0e0); border-radius: 6px; padding: 2px; width: 40px; height: 32px; background: transparent; }
        input[type=range] { flex-grow: 1; cursor: pointer; }
        input[type=text], select.custom-input { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color, #ccc); background: var(--card-background-color, transparent); color: var(--primary-text-color); box-sizing: border-box; font-size: 14px;}
        .val-badge { background: var(--primary-color); color: var(--text-primary-color, white); padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; min-width: 58px; text-align: center; }
        select.ha-select { background: var(--card-background-color, transparent); color: var(--primary-text-color); border: 1px solid var(--divider-color, #e0e0e0); padding: 6px 8px; border-radius: 6px; font-size: 14px; flex-grow: 1; max-width: 250px; cursor: pointer; }
        
        .section { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 12px; padding: 16px; margin-bottom: 16px; background: var(--card-background-color, transparent); box-shadow: 0 2px 4px rgba(0,0,0,0.05); transition: padding 0.3s ease; }
        .section.collapsed { padding-bottom: 16px; }
        .section-title { font-weight: 600; display: flex; align-items: center; justify-content: space-between; font-size: 16px; color: var(--primary-text-color); border-bottom: 1px solid var(--divider-color, #e0e0e0); padding-bottom: 8px; margin-bottom: 16px; cursor: pointer; user-select: none; }
        .section-title.no-collapse { cursor: default; }
        .section.collapsed .section-title { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
        .section-content { display: block; overflow: hidden; animation: slideDown 0.3s ease-out forwards; }
        .section.collapsed .section-content { display: none; }
        .section-icon { font-size: 12px; opacity: 0.6; transition: transform 0.3s ease; }
        .section.collapsed .section-icon { transform: rotate(-90deg); }
        .title-left { display: flex; align-items: center; gap: 8px; pointer-events: none; }
        .title-right { display: flex; align-items: center; gap: 12px; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      </style>

      <div class="editor-container">
        
        <div class="section">
          <div class="section-title no-collapse">
            <div class="title-left">⚙️ Cài đặt chung</div>
          </div>
          <div class="section-content">
            <div class="row-col" style="margin-bottom: 0;">
              <span class="label">Sensor mặc định (Tự động quét AI Box)</span>
              <select id="entity-select" class="custom-input config-trigger">
                <option value="">Đang tải danh sách...</option>
              </select>
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">
            <div class="title-left">🎨 Nền (Background)</div>
            <span class="section-icon">▼</span>
          </div>
          <div class="section-content">
            <div class="row">
              <span class="label" style="min-width: 120px;">Loại nền</span>
              <select id="bg_type" class="ha-select config-trigger">
                <option value="solid">Màu đơn sắc (Solid)</option>
                <option value="gradient">Màu dải (Gradient)</option>
              </select>
            </div>
            <div class="row" id="bg_opacity_row">
              <span class="label" style="min-width: 120px;">Độ trong suốt (%)</span>
              <input type="range" id="bg_opacity" class="config-trigger" min="0" max="100">
              <span class="val-badge" id="bg_opacity_val"></span>
            </div>

            <div id="solid_settings" style="display:none;">
              <div class="row" style="margin-top: 16px; border-top: 1px dashed var(--divider-color, #e0e0e0); padding-top: 16px;">
                <span class="label">Màu nền</span>
                <div class="input-group"><input type="color" id="bg_color" class="config-trigger"><span class="val-badge" id="bg_color_val"></span></div>
              </div>
            </div>

            <div id="gradient_settings" style="display:none;">
              <div class="row" style="margin-top: 16px; border-top: 1px dashed var(--divider-color, #e0e0e0); padding-top: 16px;">
                <span class="label" style="min-width: 120px;">Mẫu Gradient</span>
                <select id="bg_gradient_preset" class="ha-select config-trigger">
                  <option value="linear-gradient(135deg, #1e293b, #0f172a)">🌙 Tối mặc định</option>
                  <option value="linear-gradient(135deg, #f0f4f8, #d9e2ec)">☀️ Sáng mặc định</option>
                  <option value="linear-gradient(135deg, #141e30, #243b55)">🌌 Royal Night</option>
                  <option value="linear-gradient(135deg, #0f2027, #203a43, #2c5364)">🌊 Deep Ocean</option>
                  <option value="linear-gradient(135deg, #232526, #414345)">🏙️ Midnight City</option>
                  <option value="linear-gradient(135deg, #1a1a1a, #000000)">⚫ Dark Elegance</option>
                  <option value="linear-gradient(135deg, #ff0099, #493240)">🔮 Cosmic Fusion</option>
                  <option value="linear-gradient(135deg, #ff512f, #dd2476)">🌅 Sunset Vibes</option>
                  <option value="linear-gradient(135deg, #134e5e, #71b280)">🌲 Forest Mist</option>
                  <option value="linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))">🪟 Glassmorphism</option>
                  <option value="linear-gradient(135deg, #0f0c29, #302b63, #24243e)">🚀 Deep Space</option>
                  <option value="linear-gradient(135deg, #667eea, #764ba2)">💜 Plum Plate</option>
                  <option value="linear-gradient(135deg, #ff9a9e, #fecfef)">🌸 Cherry Blossom</option>
                  <option value="linear-gradient(135deg, #f12711, #f5af19)">🔥 Fire Glow</option>
                  <option value="linear-gradient(135deg, #11998e, #38ef7d)">🌿 Neon Life</option>
                  <option value="linear-gradient(135deg, #00c6ff, #0072ff)">❄️ Winter Sky</option>
                  <option value="linear-gradient(135deg, #f6d365, #fda085)">🍑 Sunrise Peach</option>
                  <option value="linear-gradient(135deg, #9D50BB, #6E48AA)">💎 Amethyst</option>
                  <option value="linear-gradient(135deg, #2b5876, #4e4376)">🌠 Starry Night</option>
                  <option value="linear-gradient(135deg, #ff758c, #ff7eb3)">🍉 Sweet Pink</option>
                  <option value="linear-gradient(135deg, #4facfe, #00f2fe)">🏝️ Tropical Blue</option>
                  <option value="linear-gradient(135deg, #870000, #190a05)">🍷 Blood Moon</option>
                  <option value="custom">✍️ Tùy chỉnh (Custom)</option>
                </select>
              </div>

              <div id="custom_gradient_row" style="display:none; flex-direction: column; gap: 12px; margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--divider-color, #e0e0e0);">
                <div class="row" style="width: 100%;">
                  <span class="label">Màu 1</span>
                  <div class="input-group"><input type="color" id="bg_gradient_color1" class="config-trigger"><span class="val-badge" id="bg_gradient_color1_val"></span></div>
                </div>
                <div class="row" style="width: 100%;">
                  <span class="label">Màu 2</span>
                  <div class="input-group"><input type="color" id="bg_gradient_color2" class="config-trigger"><span class="val-badge" id="bg_gradient_color2_val"></span></div>
                </div>
                <div class="row" style="width: 100%;">
                  <span class="label" style="min-width: 120px;">Góc độ (°)</span>
                  <input type="range" id="bg_gradient_angle" class="config-trigger" min="0" max="360" step="1">
                  <span class="val-badge" id="bg_gradient_angle_val"></span>
                </div>
              </div>
            </div>
          </div>

          <div class="section collapsed">
            <div class="section-title">
              <div class="title-left">🖋️ Màu sắc & Tương phản</div>
              <div class="title-right">
                <input type="checkbox" id="auto_contrast" class="config-trigger" style="transform: scale(1.2); cursor: pointer;" title="Tự động tương phản màu theo Nền">
                <span class="section-icon">▼</span>
              </div>
            </div>
            <div class="section-content">
              <div id="custom_colors_settings">
                <div class="row"><span class="label">Màu Chữ Chính</span><div class="input-group"><input type="color" id="textColor" class="config-trigger"><span class="val-badge" id="textColor_val"></span></div></div>
                <div class="row"><span class="label">Màu Chữ Phụ (Muted)</span><div class="input-group"><input type="color" id="mutedColor" class="config-trigger"><span class="val-badge" id="mutedColor_val"></span></div></div>
                <div class="row"><span class="label">Màu Nền Khối (Tiles)</span><div class="input-group"><input type="text" id="tileBg" class="custom-input config-trigger" style="width:140px;"></div></div>
                <div class="row"><span class="label">Màu Đường Kẻ (Lines)</span><div class="input-group"><input type="text" id="lineColor" class="custom-input config-trigger" style="width:140px;"></div></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    `;

    this.updateUI();
    this.addListeners();
  }

  get _bg_type() { return this._config?.bg_type || 'gradient'; }
  get _bg_color() { return this._config?.bg_color || '#0f172a'; }
  get _bg_opacity() { return this._config?.bg_opacity !== undefined ? this._config.bg_opacity : 100; }
  get _bg_gradient_preset() { return this._config?.bg_gradient_preset || 'linear-gradient(135deg, #1e293b, #0f172a)'; }
  get _bg_gradient_color1() { return this._config?.bg_gradient_color1 || '#1e293b'; }
  get _bg_gradient_color2() { return this._config?.bg_gradient_color2 || '#0f172a'; }
  get _bg_gradient_angle() { return this._config?.bg_gradient_angle !== undefined ? this._config.bg_gradient_angle : 135; }

  get _auto_contrast() { return this._config?.auto_contrast !== undefined ? this._config.auto_contrast : true; }
  get _textColor() { return this._config?.textColor || '#ffffff'; }
  get _mutedColor() { return this._config?.mutedColor || '#a7b5d4'; }
  get _tileBg() { return this._config?.tileBg || 'rgba(255, 255, 255, 0.02)'; }
  get _lineColor() { return this._config?.lineColor || 'rgba(70, 106, 233, 0.25)'; }

  updateUI() {
    if (!this.querySelector('#bg_type')) return;

    // Scan entities for AI Box
    const entitySelect = this.querySelector('#entity-select');
    if (entitySelect && this._hass) {
        const currentVal = this._config.entity || "";
        let selectHtml = `<option value="">-- Tự động chọn AI Box đầu tiên --</option>`;
        
        const states = this._hass.states || {};
        const validEntities = Object.keys(states).filter(eid => {
          if (!eid.startsWith("media_player.")) return false;
          const attrs = states[eid].attributes;
          return attrs && ("aibox_playback" in attrs || "chat_state" in attrs || "wake_word" in attrs || "audio_config" in attrs);
        });
        
        if (currentVal && !validEntities.includes(currentVal)) {
            validEntities.unshift(currentVal);
        }

        validEntities.forEach(e => {
            const state = states[e];
            let name = state ? (state.attributes.friendly_name || e) : e;
            selectHtml += `<option value="${e}">${name}</option>`;
        });

        entitySelect.innerHTML = selectHtml;
        entitySelect.value = currentVal;
    }
    
    // Background
    this.querySelector('#bg_type').value = this._bg_type;
    this.querySelector('#bg_opacity').value = this._bg_opacity;
    this.querySelector('#bg_opacity_val').textContent = this._bg_opacity + '%';

    if (this._bg_type === 'gradient') {
      this.querySelector('#solid_settings').style.display = 'none';
      this.querySelector('#gradient_settings').style.display = 'block';
    } else {
      this.querySelector('#solid_settings').style.display = 'block';
      this.querySelector('#gradient_settings').style.display = 'none';
    }

    this.querySelector('#bg_color').value = this._bg_color;
    this.querySelector('#bg_color_val').textContent = this._bg_color.toUpperCase();
    this.querySelector('#bg_gradient_preset').value = this._bg_gradient_preset;
    
    if (this._bg_gradient_preset === 'custom') {
      this.querySelector('#custom_gradient_row').style.display = 'flex';
    } else {
      this.querySelector('#custom_gradient_row').style.display = 'none';
    }
    
    this.querySelector('#bg_gradient_color1').value = this._bg_gradient_color1;
    this.querySelector('#bg_gradient_color1_val').textContent = this._bg_gradient_color1.toUpperCase();
    this.querySelector('#bg_gradient_color2').value = this._bg_gradient_color2;
    this.querySelector('#bg_gradient_color2_val').textContent = this._bg_gradient_color2.toUpperCase();
    this.querySelector('#bg_gradient_angle').value = this._bg_gradient_angle;
    this.querySelector('#bg_gradient_angle_val').textContent = this._bg_gradient_angle + '°';

    // Auto contrast & Manual Colors
    this.querySelector('#auto_contrast').checked = this._auto_contrast;
    if (this._auto_contrast) {
        this.querySelector('#custom_colors_settings').style.opacity = '0.4';
        this.querySelector('#custom_colors_settings').style.pointerEvents = 'none';
    } else {
        this.querySelector('#custom_colors_settings').style.opacity = '1';
        this.querySelector('#custom_colors_settings').style.pointerEvents = 'auto';
    }

    this.querySelector('#textColor').value = this._textColor;
    if(this.querySelector('#textColor_val')) this.querySelector('#textColor_val').textContent = this._textColor.toUpperCase();
    
    this.querySelector('#mutedColor').value = this._mutedColor;
    if(this.querySelector('#mutedColor_val')) this.querySelector('#mutedColor_val').textContent = this._mutedColor.toUpperCase();
    
    this.querySelector('#tileBg').value = this._tileBg;
    this.querySelector('#lineColor').value = this._lineColor;
  }

  addListeners() {
    const dispatchUpdate = () => {
      let newConfig = { 
          ...this._config,
          entity: this.querySelector('#entity-select').value,

          bg_type: this.querySelector('#bg_type').value,
          bg_color: this.querySelector('#bg_color').value,
          bg_opacity: parseInt(this.querySelector('#bg_opacity').value, 10),
          bg_gradient_preset: this.querySelector('#bg_gradient_preset').value,
          bg_gradient_color1: this.querySelector('#bg_gradient_color1').value,
          bg_gradient_color2: this.querySelector('#bg_gradient_color2').value,
          bg_gradient_angle: parseInt(this.querySelector('#bg_gradient_angle').value, 10),

          auto_contrast: this.querySelector('#auto_contrast').checked,
          textColor: this.querySelector('#textColor').value,
          mutedColor: this.querySelector('#mutedColor').value,
          tileBg: this.querySelector('#tileBg').value,
          lineColor: this.querySelector('#lineColor').value
      };
      
      const event = new CustomEvent("config-changed", { detail: { config: newConfig }, bubbles: true, composed: true });
      this.dispatchEvent(event);
    };

    this.querySelectorAll('.config-trigger').forEach(el => {
      if (el.tagName === 'SELECT') {
          el.addEventListener('change', dispatchUpdate);
      } else {
          el.addEventListener('input', dispatchUpdate);
          el.addEventListener('change', dispatchUpdate); 
      }
    });

    this.querySelectorAll('.section-title:not(.no-collapse)').forEach(titleEl => {
      const inputs = titleEl.querySelectorAll('input, select, button');
      inputs.forEach(input => {
        input.addEventListener('click', (e) => e.stopPropagation());
      });

      titleEl.addEventListener('click', () => {
        const section = titleEl.closest('.section');
        section.classList.toggle('collapsed');
      });
    });
  }
}

if (!customElements.get("esp32-aibox-media-controller-editor")) {
  customElements.define("esp32-aibox-media-controller-editor", ESP32AIBoxMediaPlayerControllerEditor);
}