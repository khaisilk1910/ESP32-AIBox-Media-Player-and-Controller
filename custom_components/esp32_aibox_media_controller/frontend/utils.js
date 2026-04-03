export const UtilsMixin = {
  _doiTuongTrangThai() {
    if (!this._hass || !this._config) return undefined;
    return this._hass.states[this._config.entity];
  },

  _thuocTinh() {
    return this._doiTuongTrangThai()?.attributes || {};
  },

  // --- TÍNH NĂNG MỚI: Tự động quét và tìm các AIBox Entities ---
  _timCacEntityAibox() {
    if (!this._hass) return [];
    return Object.keys(this._hass.states).filter(entityId => {
      if (!entityId.startsWith("media_player.")) return false;
      const attrs = this._hass.states[entityId].attributes;
      // Nhận diện qua các thuộc tính đặc trưng do integration đẩy lên
      return attrs && ("aibox_playback" in attrs || "chat_state" in attrs || "wake_word" in attrs || "audio_config" in attrs);
    }).sort(); // Sắp xếp theo tên để tab luôn cố định vị trí
  },

  // --- TÍNH NĂNG MỚI: Xử lý chuyển đổi Entity và dọn dẹp rác ---
  _chuyenEntity(newEntityId) {
    if (!this._config) this._config = {};
    if (this._config.entity === newEntityId) return;
    
    this._config.entity = newEntityId;

    // Reset toàn bộ state nội bộ để tránh dính dữ liệu từ loa cũ sang loa mới
    this._lastEntityRef = null;
    this._pendingRender = false;
    this._xoaHenGioTienDo();
    this._liveTrackKey = "";
    this._livePositionSeconds = 0;
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

    this._dongBoTuEntity(); // Lấy dữ liệu entity mới ngay lập tức
    this._veGiaoDien(); // Vẽ lại toàn bộ thẻ
  },

  _dangFocusTimKiem() {
    const active = this.shadowRoot?.activeElement;
    return this._mediaQueryFocused || active?.id === "media-query";
  },

  _dangSuaOInputVanBan() {
    const active = this.shadowRoot?.activeElement;
    if (this._mediaQueryFocused) return true;
    if (!active) return false;
    return active.id === "media-query" || active.id === "chat-input";
  },

  _dangTuongTacEq() {
    const active = this.shadowRoot?.activeElement;
    return Boolean(active?.dataset?.eqBand !== undefined);
  },

  _xuLyRenderCho() {
    if (!this._pendingRender) return;
    if (this._dangSuaOInputVanBan()) return;
    this._pendingRender = false;
    this._veGiaoDien();
  },

  _veGiaoDienGiuFocusTimKiem() {
    const root = this.shadowRoot;
    const input = root?.getElementById("media-query");
    const dangFocus = this._dangFocusTimKiem() && Boolean(input);
    const viTriBatDau = dangFocus ? input.selectionStart ?? input.value.length : 0;
    const viTriKetThuc = dangFocus ? input.selectionEnd ?? input.value.length : viTriBatDau;

    this._pendingRender = false;
    this._veGiaoDien();

    if (!dangFocus) return;
    const inputMoi = this.shadowRoot?.getElementById("media-query");
    if (!inputMoi) return;
    inputMoi.focus();
    const doDai = inputMoi.value.length;
    const batDau = Math.max(0, Math.min(doDai, Number(viTriBatDau)));
    const ketThuc = Math.max(batDau, Math.min(doDai, Number(viTriKetThuc)));
    inputMoi.setSelectionRange(batDau, ketThuc);
  },

  _giuFocusTimKiemKhongRender() {
    if (!this._dangFocusTimKiem()) return;
    const input = this.shadowRoot?.getElementById("media-query");
    if (!input) return;
    const viTriBatDau = input.selectionStart ?? input.value.length;
    const viTriKetThuc = input.selectionEnd ?? input.value.length;
    requestAnimationFrame(() => {
      const inputMoi = this.shadowRoot?.getElementById("media-query");
      if (!inputMoi) return;
      inputMoi.focus();
      const doDai = inputMoi.value.length;
      const batDau = Math.max(0, Math.min(doDai, Number(viTriBatDau)));
      const ketThuc = Math.max(batDau, Math.min(doDai, Number(viTriKetThuc)));
      inputMoi.setSelectionRange(batDau, ketThuc);
    });
  },

  _veGiaoDienGiuFocusChat() {
    const root = this.shadowRoot;
    const input = root?.getElementById("chat-input");
    const dangFocus = Boolean(input && root.activeElement === input);
    const viTriBatDau = dangFocus ? input.selectionStart ?? input.value.length : 0;
    const viTriKetThuc = dangFocus ? input.selectionEnd ?? input.value.length : viTriBatDau;

    this._pendingRender = false;
    this._veGiaoDien();

    const inputMoi = this.shadowRoot?.getElementById("chat-input");
    if (!inputMoi) return;
    inputMoi.focus();
    const doDai = inputMoi.value.length;
    const batDau = Math.max(0, Math.min(doDai, Number(viTriBatDau)));
    const ketThuc = Math.max(batDau, Math.min(doDai, Number(viTriKetThuc)));
    inputMoi.setSelectionRange(batDau, ketThuc);
  },

  _layGiaTriChatInput() {
    const domValue = this.shadowRoot?.getElementById("chat-input")?.value;
    if (domValue !== undefined && domValue !== null) {
      return String(domValue);
    }
    return String(this._chatInput || "");
  },

  _cuonCuoiKhungChat() {
    requestAnimationFrame(() => {
      const historyEl = this.shadowRoot?.querySelector(".chat-shell-history");
      if (!historyEl) return;
      historyEl.scrollTop = historyEl.scrollHeight;
    });
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
    if (normalized.includes("playlist")) return "DANH SACH PHAT";
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
    return (
      normalized === "chua co bai dang phat" ||
      normalized === "chưa có bài đang phát" ||
      normalized === "khong co nhac" ||
      normalized === "không có nhạc"
    );
  },

  _layIdMucMedia(item) {
    if (!item || typeof item !== "object") return "";
    const resolved =
      item.id || item.video_id || item.videoId || item.song_id ||
      item.songId || item.track_id || item.trackId || item.playlist_id || item.playlistId || "";
    return String(resolved || "").trim();
  },

  _epKieuBoolean(value, fallback = false) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return fallback;
      return value !== 0;
    }
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    if (["1", "true", "on", "enable", "enabled", "yes", "y"].includes(normalized)) return true;
    if (["0", "false", "off", "disable", "disabled", "no", "n"].includes(normalized)) return false;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return numeric !== 0;
    return fallback;
  },

  _epKieuSo(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
};