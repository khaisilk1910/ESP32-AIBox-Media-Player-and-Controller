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
    this._lastEntityRef = null;
    this._pendingRender = false;
    this._userIsScrolling = false;

    // --- Ủy quyền Khởi tạo Trạng thái cho các module ---
    this._khoiTaoTrangThaiMedia?.();
    this._khoiTaoTrangThaiThietBi?.();
    this._khoiTaoTrangThaiControl?.();
    this._khoiTaoTrangThaiSystem?.();
    this._khoiTaoTrangThaiChat?.();
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

    // --- Reset trạng thái khi đổi Config ---
    this._khoiTaoTrangThaiMedia?.();
    this._khoiTaoTrangThaiThietBi?.();
    this._khoiTaoTrangThaiControl?.();
    this._khoiTaoTrangThaiSystem?.();
    this._khoiTaoTrangThaiChat?.();
    this._veGiaoDien();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    const entityRef = this._doiTuongTrangThai();
    const changed = entityRef !== this._lastEntityRef;
    this._lastEntityRef = entityRef;

    // --- Kiểm tra thay đổi của Media (Uỷ quyền) ---
    const mediaChanged = this._kiemTraThayDoiTrangThaiMedia?.(entityRef) || false;

    this._dongBoTuEntity();

    if (!changed && !mediaChanged && !this._pendingRender) return;
    if (this._activeTab === "system" && this._dangTuongTacEq?.()) { this._pendingRender = true; this._capNhatEqGiaoDien?.(this.shadowRoot); return; }
    
    // ĐIỂM SỬA CHỮA CHÍNH CỐT LÕI: Tôn trọng người dùng khi đang cuộn tay/chuột, không được render lại DOM
    if (this._userIsScrolling) {
        this._pendingRender = true; 
        return; 
    }
    
    const activeElement = this.shadowRoot?.activeElement;
    const isInputFocus = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
    const dangSuaText = this._mediaQueryFocused || isInputFocus || this._chatDangCompose || this._mediaDangCompose || this._dangSuaOInputVanBan?.();

    if (dangSuaText) {
      const activeId = activeElement?.id || "";
      
      // Xử lý Focus Tim kiem
      if (activeId === "media-query" && this._activeTab === "media") {
        const handled = this._xuLyFocusTimKiemMedia?.(changed, mediaChanged);
        if (handled) return;
      }
      
      // Xử lý Focus Chat
      if (activeId === "chatInput" && this._activeTab === "chat") { this._pendingRender = false; this._veGiaoDienGiuFocusChat?.(); return; }
      this._pendingRender = true; return;
    }

    this._pendingRender = false;
    this._veGiaoDien();
  }

  connectedCallback() { 
    this._veGiaoDien(); 
    this._initLive2D?.(); 
  }
  
  disconnectedCallback() { 
    this._xoaHenGioTienDo?.(); 
  }

  _dongBoTuEntity() {
    const stateObj = this._doiTuongTrangThai();
    if (!stateObj) return;

    const attrs = stateObj.attributes || {};
    
    // --- Uỷ quyền đồng bộ dữ liệu ---
    this._dongBoTrangThaiThietBi?.(attrs);
    this._dongBoTrangThaiChat?.(attrs);
  }

  _ganSuKien() {
    const root = this.shadowRoot;
    if (!root) return;

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

    if (this._activeTab === "media") this._ganSuKienTabMedia?.(root);
    if (this._activeTab === "control") this._ganSuKienTabControl?.(root);
    if (this._activeTab === "chat") this._ganSuKienTabChat?.(root);
    if (this._activeTab === "system") this._ganSuKienTabSystem?.(root);
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
    if (this._activeTab === "media") body = this._veTabMedia?.(stateObj) || "";
    if (this._activeTab === "control") body = this._veTabDieuKhien?.() || "";
    if (this._activeTab === "chat") body = this._veTabChat?.() || "";
    if (this._activeTab === "system") body = this._veTabHeThong?.() || "";

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
        
        /* CSS Khung sườn chung cho các nút và switch */
        ${this._renderCommonCss()}
      </style>
      <ha-card>
        ${deviceSelectorHtml}
        <div class="top-tabs">
          ${[{ key: "media", icon: "mdi:music-note", label: "Media" }, { key: "control", icon: "mdi:tune-variant", label: "Control" }, { key: "chat", icon: "mdi:chat-processing", label: "Chat" }, { key: "system", icon: "mdi:cog", label: "System" }].map((tab) => `<button class="tab-btn ${this._activeTab === tab.key ? "active" : ""}" data-tab="${tab.key}"><ha-icon icon="${tab.icon}"></ha-icon><span>${tab.label}</span></button>`).join("")}
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

    if (this._activeTab === "chat") this._veLive2DChoChat?.();
    if (this._activeTab === "media") this._cuonToiBaiDangPhat?.();
  }

  _renderCommonCss() {
    return `
      .mini-btn { border: 1px solid var(--line); border-radius: 10px; background: var(--bg-tile); color: var(--text); font-weight: 700; padding: 6px 10px; font-size: 11px; cursor: pointer; white-space: nowrap; }
      .hover-pop:hover { transform: translateY(-2px); background: var(--line); }
      .hover-scale:hover { transform: scale(1.05); filter: brightness(1.1); }
      .hover-lift:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      .mini-btn.active { background: var(--accent); color: #fff; }
      .mini-btn-accent { min-width: 28px; min-height: 28px; border-radius: 8px; padding: 0; background: var(--accent); border-color: transparent; color: #fff; display: inline-flex; align-items: center; justify-content: center; }
      .mini-btn-danger { min-width: 58px; min-height: 28px; border-radius: 8px; padding: 0 8px; background: #ef4444; border-color: transparent; color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
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
    `;
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