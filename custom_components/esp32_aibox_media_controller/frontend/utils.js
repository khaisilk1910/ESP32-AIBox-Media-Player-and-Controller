export const UtilsMixin = {
  _doiTuongTrangThai() {
    if (!this._hass || !this._config) return undefined;
    return this._hass.states[this._config.entity];
  },

  _thuocTinh() {
    return this._doiTuongTrangThai()?.attributes || {};
  },

  _timCacEntityAibox() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states).filter(entityId => {
      if (!entityId.startsWith("media_player.")) return false;
      const attrs = this._hass.states[entityId].attributes;
      return attrs && ("aibox_playback" in attrs || "chat_state" in attrs || "wake_word" in attrs || "audio_config" in attrs);
    }).sort();
  },

  _chuyenEntity(newEntityId) {
    if (!this._config) this._config = {};
    if (this._config.entity === newEntityId) return;
    
    this._config.entity = newEntityId;
    this._lastEntityRef = null;
    this._pendingRender = false;
    this._userIsScrolling = false; // FIX: Reset trạng thái cuộn
    this._xoaHenGioTienDo?.();
    this._liveTrackKey = "";
    this._livePositionSeconds = 0;
    this._ignorePositionUntil = 0;
    this._liveDurationSeconds = 0;
    this._livePlaying = false;
    this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
    this._chatHistory = [];
    this._chatHistoryLoaded = false;
    this._forcePauseUntil = 0;
    this._optimisticPlayUntil = 0;
    this._pendingSwitches = {};
    this._lastChatStateRequestAt = 0;
    this._lastChatHistoryRequestAt = 0;
    this._lastControlStateRequestAt = 0;
    this._lastSystemStateRequestAt = 0;
    this._dangChoKetQuaTimKiem = false;
    this._timKiemDangCho = null;
    if (this._refreshScheduleTimer) clearTimeout(this._refreshScheduleTimer);
    this._refreshScheduleTimer = null;
    this._refreshSchedulePromise = null;
    this._refreshScheduleResolve = null;
    this._refreshScheduledAt = 0;
    this._pendingRefreshOptions = null;
    this._tabBootstrapState = {};
    this._forceEnsureForActiveTab = true;

    this._dongBoTuEntity();
    this._veGiaoDien();
  },

  _dangFocusTimKiem() {
    const active = this.shadowRoot?.activeElement;
    return this._mediaQueryFocused || active?.id === "media-query";
  },

  _dangSuaOInputVanBan() {
    const active = this.shadowRoot?.activeElement;
    if (this._mediaQueryFocused) return true;
    if (!active) return false;
    return active.id === "media-query" || active.id === "chatInput";
  },

  _dangTuongTacEq() {
    const active = this.shadowRoot?.activeElement;
    return Boolean(active?.dataset?.eqBand !== undefined);
  },

  _datTrangThaiNapTab(tab, patch = {}) {
    if (!tab) return {};
    if (!this._tabBootstrapState || typeof this._tabBootstrapState !== "object") this._tabBootstrapState = {};
    const current = this._tabBootstrapState[tab] || { lastAt: 0, inFlight: false };
    const next = { ...current, ...patch };
    this._tabBootstrapState[tab] = next;
    return next;
  },

  _danhDauCanNapLaiTab(tab = this._activeTab) {
    if (!tab) return;
    this._datTrangThaiNapTab(tab, { lastAt: 0 });
    if (tab === this._activeTab) this._forceEnsureForActiveTab = true;
  },

  _layChuKyNapTab(tab = this._activeTab) {
    if (tab === "chat") return 30000;
    if (tab === "control" || tab === "system") return 45000;
    return 60000;
  },

  _nenNapTab(tab = this._activeTab, force = false) {
    if (!tab) return false;
    const state = this._datTrangThaiNapTab(tab);
    if (state.inFlight) return false;
    if (force) return true;
    const now = Date.now();
    const cycleMs = this._layChuKyNapTab(tab);
    return !state.lastAt || now - state.lastAt >= cycleMs;
  },

  _batDauNapTab(tab = this._activeTab) {
    return this._datTrangThaiNapTab(tab, { inFlight: true, lastAt: Date.now() });
  },

  _ketThucNapTab(tab = this._activeTab) {
    return this._datTrangThaiNapTab(tab, { inFlight: false, lastAt: Date.now() });
  },

  _xuLyRenderCho() {
    if (!this._pendingRender) return;
    if (this._dangSuaOInputVanBan()) return;
    if (this._userIsScrolling) return; // FIX: Chặn hàm render chờ nếu đang cuộn
    
    this._pendingRender = false;
    this._veGiaoDien();
  },

  _maHoaHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  },

  _dinhDangThoiLuong(totalSeconds) {
    const seconds = Number(totalSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  },

  _dinhDangDongHo(totalSeconds, fallback = "0:00") {
    const seconds = Number(totalSeconds);
    if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
    return this._dinhDangThoiLuong(seconds);
  },

  _nhanNguon(source) {
    const normalized = String(source || "").toLowerCase();
    if (normalized.includes("zing")) return "ZING MP3";
    if (normalized.includes("playlist")) return "DANH SÁCH PHÁT";
    if (normalized.includes("youtube")) return "YOUTUBE";
    return normalized ? normalized.toUpperCase() : "AI BOX";
  },

  _chuoiKhongRongDauTien(...values) {
    for (const value of values) {
      if (value === undefined || value === null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return "";
  },

  _epKieuGiayPhat(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, numeric);
  },

  _laTieuDeNghi(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return (normalized === "chua co bai dang phat" || normalized === "chưa có bài đang phát" || normalized === "khong co nhac" || normalized === "không có nhạc");
  },

  _layIdMucMedia(item) {
    if (!item || typeof item !== "object") return "";
    const resolved = item.id || item.video_id || item.videoId || item.song_id || item.songId || item.track_id || item.trackId || item.playlist_id || item.playlistId || "";
    return String(resolved || "").trim();
  },

  _epKieuBoolean(value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value) ? value !== 0 : fallback;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    if (["1", "true", "on", "enable", "enabled", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "off", "disable", "disabled", "no", "n"].includes(normalized)) return false;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric !== 0 : fallback;
  },

  _epKieuSo(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  },

  _hexToRgba(hex, opacity) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
      c= hex.substring(1).split('');
      if(c.length === 3) c= [c[0], c[0], c[1], c[1], c[2], c[2]];
      c= '0x'+c.join('');
      return 'rgba('+[(c>>16)&255, (c>>8)&255, c&255].join(',')+','+(opacity/100)+')';
    }
    return hex;
  },

  _applyOpacityToGradientStr(str, opacity) {
    return str.replace(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/gi, (match) => this._hexToRgba(match, opacity));
  },

  _getAverageColor(str) {
    const hexRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/gi;
    let match;
    let colors = [];
    while ((match = hexRegex.exec(str)) !== null) {
      let hex = match[1];
      if (hex.length === 3) hex = hex.split('').map(x => x+x).join('');
      colors.push({ r: parseInt(hex.substring(0,2), 16), g: parseInt(hex.substring(2,4), 16), b: parseInt(hex.substring(4,6), 16) });
    }
    const rgbRegex = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/gi;
    while ((match = rgbRegex.exec(str)) !== null) {
      colors.push({ r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) });
    }
    if (colors.length === 0) return { r: 15, g: 23, b: 42 }; 
    let r = 0, g = 0, b = 0;
    colors.forEach(c => { r += c.r; g += c.g; b += c.b; });
    return { r: Math.round(r / colors.length), g: Math.round(g / colors.length), b: Math.round(b / colors.length) };
  },

  _getSliderBackgroundStyle(val, min, max, isVertical = false) {
    const percentage = Math.max(0, Math.min(100, ((Number(val) || 0) - (Number(min) || 0)) / ((Number(max) || 100) - (Number(min) || 0)) * 100));
    return isVertical ? `linear-gradient(to top, var(--accent) ${percentage}%, rgba(0,0,0,0.3) ${percentage}%)` : `linear-gradient(to right, var(--accent) ${percentage}%, rgba(0,0,0,0.3) ${percentage}%)`;
  }
};