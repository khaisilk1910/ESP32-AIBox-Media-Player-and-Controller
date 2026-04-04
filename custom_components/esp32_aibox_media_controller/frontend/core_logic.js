import { CHAT_ENABLED_STATES, CHAT_DISABLED_STATES, CHAT_SESSION_STATES, EQ_BAND_LABELS } from './constants.js';

export const CoreLogicMixin = {
  _chuanHoaNhanTrangThaiChat(value) {
    return String(value || "").trim().toLowerCase();
  },

  _suyRaNutChatTuTrangThai(value) {
    const normalized = this._chuanHoaNhanTrangThaiChat(value);
    if (!normalized) return null;
    if (CHAT_ENABLED_STATES.has(normalized)) return true;
    if (CHAT_DISABLED_STATES.has(normalized)) return false;
    return null;
  },

  _layMoTaNutChat(chatState, statusLabel) {
    const explicitText = String(chatState.button_text ?? chatState.buttonText ?? chatState.text ?? "").trim();
    if (explicitText) return explicitText;
    const normalized = this._chuanHoaNhanTrangThaiChat(statusLabel);
    if (CHAT_SESSION_STATES.has(normalized)) return "Phiên chat đang hoạt động";
    if (CHAT_ENABLED_STATES.has(normalized)) return "Sẵn sàng nhận lệnh hoặc tin nhắn";
    if (CHAT_DISABLED_STATES.has(normalized)) return "Chat hiện chưa khả dụng";
    return "Đang chờ đồng bộ trạng thái chat";
  },

  _layMoTaTrangThaiNutChat(buttonEnabled) {
    if (buttonEnabled === null) return "Đang chờ cập nhật";
    return buttonEnabled ? "Nút đang sẵn sàng" : "Nút đang tắt";
  },

  _layNhanTrangThaiChatHienThi(value) {
    const normalized = this._chuanHoaNhanTrangThaiChat(value);
    const labels = {
      ready: "Sẵn sàng", online: "Trực tuyến", active: "Đang hoạt động", available: "Khả dụng",
      idle: "Đang chờ", standby: "Chờ kích hoạt", connecting: "Đang kết nối", listening: "Đang nghe",
      thinking: "Đang xử lý", speaking: "Đang phản hồi", unavailable: "Không khả dụng", offline: "Ngoại tuyến",
      error: "Lỗi", failed: "Thất bại", disabled: "Đã tắt", disconnected: "Mất kết nối", unknown: "Không rõ trạng thái",
    };
    if (labels[normalized]) return labels[normalized];
    return String(value || "Không rõ trạng thái");
  },

  _layNhanTrangThaiPhat(state) {
    const normalized = String(state || "").trim().toLowerCase();
    if (normalized === "playing") return "Đang phát";
    if (normalized === "paused") return "Tạm dừng";
    if (normalized === "idle" || normalized === "off" || normalized === "stopped") return "Chờ phát";
    if (normalized === "unavailable") return "Không khả dụng";
    return normalized ? normalized : "Không rõ";
  },

  _gioiHanEqLevel(value, fallback = 0) {
    const numeric = this._epKieuSo(value, fallback);
    return Math.max(-1500, Math.min(1500, Math.round(numeric)));
  },

  _dinhDangEqLevel(level) {
    const numeric = this._gioiHanEqLevel(level, 0);
    return numeric > 0 ? `+${numeric}` : `${numeric}`;
  },

  _batDauCanhGacDongBoEq(durationMs = 1200) {
    const duration = Math.max(0, Number(durationMs) || 0);
    this._eqSyncGuardUntil = Date.now() + duration;
  },

  _layNhanEqBand(band = this._eqBand) {
    const index = Math.max(0, Math.round(Number(band) || 0));
    return EQ_BAND_LABELS[index] || `Band ${index + 1}`;
  },

  _layEqLevelTheoBand(band, fallback = this._eqLevel) {
    if (!Array.isArray(this._eqBands) || this._eqBands.length === 0) {
      return this._gioiHanEqLevel(fallback, 0);
    }
    const index = Math.max(0, Math.round(Number(band) || 0));
    if (index >= this._eqBands.length) return this._gioiHanEqLevel(fallback, 0);
    return this._gioiHanEqLevel(this._eqBands[index], fallback);
  },

  _capNhatEqGiaoDien(root = this.shadowRoot) {
    if (!root) return;
    const eqToggle = root.getElementById("eq-enabled");
    if (eqToggle) eqToggle.checked = Boolean(this._eqEnabled);
    const eqStatus = root.getElementById("eq-status-chip");
    if (eqStatus) {
      eqStatus.textContent = this._eqEnabled ? "EQ bật" : "EQ tắt";
      eqStatus.classList.toggle("is-off", !this._eqEnabled);
    }
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

  _chuanHoaChatMuc(item, fallbackRole = "server") {
    const source = item && typeof item === "object" ? item : {};
    const content = this._chuoiKhongRongDauTien(source.content, source.message, source.text, source.msg);
    if (!content) return null;
    const roleRaw = this._chuoiKhongRongDauTien(source.message_type, source.role, source.sender, fallbackRole).toLowerCase();
    const role = ["user", "human", "client", "me"].includes(roleRaw) ? "user" : "server";
    const timestamp = source.ts ?? source.timestamp ?? source.time ?? source.created_at ?? source.createdAt;
    const normalized = { ...source, content, message_type: role, role, sender: role };
    if (timestamp !== undefined && timestamp !== null && String(timestamp).trim() !== "") {
      normalized.ts = timestamp;
    }
    return normalized;
  },

  _laChatMucTrung(current, incoming) {
    const currentId = this._chuoiKhongRongDauTien(current?.id, current?.message_id, current?._local_echo_id);
    const incomingId = this._chuoiKhongRongDauTien(incoming?.id, incoming?.message_id, incoming?._local_echo_id);
    if (currentId && incomingId && currentId === incomingId) return true;
    if (current?.ts !== undefined && current?.ts !== null && incoming?.ts !== undefined && incoming?.ts !== null && current.ts === incoming.ts) return true;
    const sameRole = current?.message_type === incoming?.message_type;
    const sameContent = current?.content === incoming?.content;
    const currentLocal = this._epKieuBoolean(current?._local_echo, false);
    const incomingLocal = this._epKieuBoolean(incoming?._local_echo, false);
    return sameRole && sameContent && currentLocal !== incomingLocal && (currentLocal || incomingLocal);
  },

  _hopNhatLichSuChat(...groups) {
    const merged = [];
    groups.forEach((group) => {
      if (!Array.isArray(group)) return;
      group.forEach((rawItem) => {
        const item = this._chuanHoaChatMuc(rawItem);
        if (!item) return;
        const previous = merged[merged.length - 1];
        if (previous && this._laChatMucTrung(previous, item)) {
          const nextItem = { ...previous, ...item };
          if (!this._epKieuBoolean(item._local_echo, false)) {
            delete nextItem._local_echo;
            delete nextItem._local_echo_id;
          }
          merged[merged.length - 1] = nextItem;
          return;
        }
        merged.push(item);
      });
    });
    return merged.slice(-60);
  },

  _dongBoLichSuChatTuEntity(items) {
    if (!Array.isArray(items)) return;
    const hasLocalEcho = this._chatHistory.some((item) => this._epKieuBoolean(item?._local_echo, false));
    this._chatHistory = hasLocalEcho ? this._hopNhatLichSuChat(this._chatHistory, items) : this._hopNhatLichSuChat(items);
    this._chatHistoryLoaded = true;
  },

  _themTinNhanChatTam(content, role = "user") {
    const item = this._chuanHoaChatMuc({
      content, message_type: role, ts: Date.now(),
      _local_echo: true, _local_echo_id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    }, role);
    if (!item) return;
    this._chatHistory = this._hopNhatLichSuChat(this._chatHistory, [item]);
    this._chatHistoryLoaded = true;
  },

  _laBluetoothDangBat(value, fallback = false) {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "number" && Number.isFinite(value)) return value === 3;
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) return fallback;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return numeric === 3;
    if (normalized.includes("bluetooth")) {
      if (normalized.includes("off") || normalized.includes("disable") || normalized.includes("disconnect") || normalized.includes("idle")) return false;
      return true;
    }
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
    if (Date.now() > pending.expiresAt) {
      this._xoaCongTacCho(key);
      return resolvedDevice;
    }
    if (resolvedDevice === pending.value) {
      this._xoaCongTacCho(key);
      return resolvedDevice;
    }
    return pending.value;
  },

  _laCongTacDangCho(key) {
    const pending = this._pendingSwitches[key];
    if (!pending) return false;
    if (Date.now() > pending.expiresAt) {
      this._xoaCongTacCho(key);
      return false;
    }
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
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return ["true", "1", "3", "playing", "play", "on"].includes(normalized);
    }
    return false;
  },

  _laPhatKhongHoatDong(value) {
    if (value === false || value === 0 || value === 2) return true;
    if (typeof value === "number") return value === 0 || value === 2;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      return ["false", "0", "2", "paused", "pause", "stopped", "stop", "idle", "off"].includes(normalized);
    }
    return false;
  },

  _xoaHenGioTienDo() {
    if (this._progressTimerId === null) return;
    clearInterval(this._progressTimerId);
    this._progressTimerId = null;
  },

  _batDauHenGioTienDo() {
    if (this._progressTimerId !== null) return;
    this._progressTimerId = window.setInterval(() => { this._xuLyNhipHenGioTienDo(); }, 1000);
  },

  _capNhatHenGioTienDo() {
    const shouldRun = this._activeTab === "media" && this._livePlaying;
    if (shouldRun) this._batDauHenGioTienDo();
    else this._xoaHenGioTienDo();
  },

  _dongBoTienDoTrucTiep(trackKey, positionSeconds, durationSeconds, isPlaying) {
    const now = Date.now();
    let posRaw = Number.isFinite(Number(positionSeconds)) ? Math.max(0, Number(positionSeconds)) : 0;
    
    if (this._ignorePositionUntil && now < this._ignorePositionUntil) {
      posRaw = 0;
    } else if (this._ignorePositionUntil && now >= this._ignorePositionUntil) {
      this._ignorePositionUntil = 0;
    }

    const dur = Number.isFinite(Number(durationSeconds)) ? Math.max(0, Number(durationSeconds)) : 0;
    const pos = dur > 0 ? Math.min(posRaw, dur) : posRaw;
    const sameTrack = Boolean(trackKey) && trackKey === this._liveTrackKey;

    if (!trackKey && !isPlaying && pos <= 0 && dur <= 0) {
      this._liveTrackKey = ""; this._livePositionSeconds = 0; this._liveDurationSeconds = 0;
      this._livePlaying = false; this._liveTickAt = now; return;
    }

    if (!sameTrack) {
      this._liveTrackKey = trackKey; this._livePositionSeconds = pos;
    } else if (!isPlaying || Math.abs(pos - this._livePositionSeconds) > 2) {
      this._livePositionSeconds = pos;
    } else if (pos > this._livePositionSeconds) {
      this._livePositionSeconds = pos;
    }
    this._liveDurationSeconds = dur;
    this._livePlaying = Boolean(isPlaying);
    this._liveTickAt = now;
  },

  _xuLyNhipHenGioTienDo() {
    if (!this._livePlaying) {
      this._dongBoTienDoDom(); return;
    }
    const now = Date.now();
    const elapsed = Math.max(0, (now - this._liveTickAt) / 1000);
    this._liveTickAt = now;
    if (elapsed <= 0) return;

    if (this._liveDurationSeconds > 0) {
      this._livePositionSeconds = Math.min(this._liveDurationSeconds, this._livePositionSeconds + elapsed);
      if (this._livePositionSeconds >= this._liveDurationSeconds - 0.2) {
        this._livePlaying = false;
        this._xuLyHetBai();
      }
    } else {
      this._livePositionSeconds += elapsed;
    }
    this._dongBoTienDoDom();
    this._capNhatHenGioTienDo();
  },

  async _xuLyHetBai() {
    this._livePositionSeconds = 0;
    this._ignorePositionUntil = Date.now() + 4000;
    this._optimisticTrackUntil = 0;
    this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
    this._dongBoTienDoDom();

    if (this._repeatMode === "one") {
      const trackId = this._thongTinPhat()?.track_id;
      const source = this._thongTinPhat()?.source || "";
      if (trackId) {
        if (source.toLowerCase().includes("zing")) {
          await this._goiDichVu("media_player", "play_zing", { song_id: trackId });
        } else {
          await this._goiDichVu("media_player", "play_youtube", { video_id: trackId });
        }
      } else {
        await this._goiDichVu("media_player", "media_play");
      }
    } else if (this._repeatMode === "all") {
      await this._goiDichVu("media_player", "media_next_track");
    }
  },

  _dongBoTienDoDom() {
    const root = this.shadowRoot;
    if (!root) return;
    const positionEl = root.getElementById("playback-position");
    const durationEl = root.getElementById("playback-duration");
    const progressEl = root.getElementById("playback-progress");
    const progressTrackEl = root.getElementById("playback-progress-track");
    const progressThumbEl = root.getElementById("playback-progress-thumb");

    if (positionEl) positionEl.textContent = this._dinhDangDongHo(this._livePositionSeconds, "0:00");
    if (durationEl) durationEl.textContent = this._liveDurationSeconds > 0 ? this._dinhDangThoiLuong(this._liveDurationSeconds) : "--:--";
    if (progressEl) {
      const progressPercent = this._liveDurationSeconds > 0 ? Math.max(0, Math.min(100, (this._livePositionSeconds / this._liveDurationSeconds) * 100)) : 0;
      progressEl.style.width = `${progressPercent.toFixed(2)}%`;
      if (progressThumbEl) progressThumbEl.style.left = `${progressPercent.toFixed(2)}%`;
      if (progressTrackEl) {
        progressTrackEl.setAttribute("aria-valuenow", String(Math.round(this._livePositionSeconds)));
        progressTrackEl.setAttribute("aria-valuemax", String(Math.max(0, Math.round(this._liveDurationSeconds))));
      }
    }
  },

  _thongTinPhat() {
    const attrs = this._thuocTinh();
    const search = attrs.last_music_search || {};
    const play = attrs.last_music_play || {};
    const aibox = attrs.aibox_playback || {};
    const items = Array.isArray(search.items) ? search.items : [];

    if (this._optimisticTrackUntil && Date.now() < this._optimisticTrackUntil && this._nowPlayingCache && this._nowPlayingCache.trackKey) {
       return {
           title: this._nowPlayingCache.title,
           artist: this._nowPlayingCache.artist,
           duration: this._nowPlayingCache.duration,
           position: this._livePositionSeconds,
           source: this._nowPlayingCache.source,
           thumbnail_url: this._nowPlayingCache.thumbnail_url,
           track_key: this._nowPlayingCache.trackKey,
           track_id: this._nowPlayingCache.trackId,
           play, search, items, aibox
       };
    }

    const stateObj = this._doiTuongTrangThai();
    const aiboxTrackId = this._chuoiKhongRongDauTien(aibox.id, aibox.video_id, aibox.song_id, aibox.track_id);
    const playId = this._chuoiKhongRongDauTien(play.id, play.video_id, play.song_id, play.track_id, aiboxTrackId);

    let byId = items.find((item) => {
      const itemId = this._layIdMucMedia(item);
      return itemId && (itemId === playId || itemId === aiboxTrackId);
    });

    if (!byId && !playId) {
      const isLikelyPlaying = String(stateObj?.state || "").toLowerCase() === "playing" ||
        this._laPhatDangHoatDong(aibox.is_playing) || this._laPhatDangHoatDong(aibox.play_state) ||
        this._laPhatDangHoatDong(aibox.state) || String(aibox.state || "").toLowerCase() === "playing";
      if (isLikelyPlaying && items.length > 0) byId = items[0];
    }

    const rawTitle = this._chuoiKhongRongDauTien(aibox.title, attrs.media_title, byId?.title, play.title);
    let title = this._laTieuDeNghi(rawTitle) ? "" : rawTitle;
    let artist = this._chuoiKhongRongDauTien(aibox.artist, aibox.channel, attrs.media_artist, byId?.artist, byId?.channel, play.artist);
    let duration = this._epKieuGiayPhat(aibox.duration ?? attrs.media_duration ?? byId?.duration_seconds, 0);
    let position = this._epKieuGiayPhat(aibox.position ?? attrs.media_position, 0);
    if (duration > 0 && position > duration) position = duration;
    let source = this._chuoiKhongRongDauTien(aibox.source, play.source, search.source);
    let thumbnailUrl = this._chuoiKhongRongDauTien(aibox.thumbnail_url, attrs.entity_picture, byId?.thumbnail_url, items.find((item) => item && item.thumbnail_url)?.thumbnail_url);

    const aiboxPlaying = this._laPhatDangHoatDong(aibox.is_playing) || this._laPhatDangHoatDong(aibox.play_state) || this._laPhatDangHoatDong(aibox.state);
    const aiboxPaused = this._laPhatKhongHoatDong(aibox.is_playing) || this._laPhatKhongHoatDong(aibox.play_state) || this._laPhatKhongHoatDong(aibox.state);

    const rawTrackKey = this._chuoiKhongRongDauTien(playId, aiboxTrackId, source && title ? `${source}|${title}|${artist}|${duration}` : "");
    const hardStopRaw = !aiboxPlaying && !aiboxPaused && !title && !playId && !aiboxTrackId && position <= 0 && duration <= 0;

    if (hardStopRaw) {
      this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
    } else {
      const hasFreshTrack = Boolean(rawTrackKey) && Boolean(title);
      if (hasFreshTrack) {
        this._nowPlayingCache = { trackKey: rawTrackKey, title, artist, source, thumbnail_url: thumbnailUrl, duration, trackId: playId || aiboxTrackId };
      } else {
        const cached = this._nowPlayingCache;
        const canUseCache = Boolean(cached.trackKey) && (aiboxPlaying || aiboxPaused || position > 0 || duration > 0 || Boolean(this._chuoiKhongRongDauTien(source, playId, aiboxTrackId)));
        if (canUseCache) {
          title = title || cached.title; artist = artist || cached.artist; source = source || cached.source;
          thumbnailUrl = thumbnailUrl || cached.thumbnail_url;
          if (duration <= 0 && cached.duration > 0) duration = cached.duration;
        }
      }
    }
    if (!title) title = "Chưa có bài đang phát";
    const trackKey = this._chuoiKhongRongDauTien(rawTrackKey, this._nowPlayingCache.trackKey, source && title ? `${source}|${title}|${artist}|${duration}` : "");

    return { title, artist, duration, position, source, thumbnail_url: thumbnailUrl, track_key: trackKey, track_id: playId || aiboxTrackId, play, search, items, aibox };
  },

  _layTrangThaiHienThiPhat(playback, stateObj = this._doiTuongTrangThai()) {
    const entityState = String(stateObj?.state || "idle").toLowerCase();
    const rawPlaybackState = String(stateObj?.attributes?.playback_state_raw || "").toLowerCase();
    const aiboxPlaying = this._laPhatDangHoatDong(playback.aibox?.is_playing) || this._laPhatDangHoatDong(playback.aibox?.play_state) || this._laPhatDangHoatDong(playback.aibox?.state) || String(playback.aibox?.state || "").toLowerCase() === "playing";
    const aiboxPaused = this._laPhatKhongHoatDong(playback.aibox?.is_playing) || this._laPhatKhongHoatDong(playback.aibox?.play_state) || this._laPhatKhongHoatDong(playback.aibox?.state);
    const hasAiboxState = ["is_playing", "play_state", "state"].some((key) => {
      const value = playback.aibox?.[key];
      if (value === undefined || value === null) return false;
      return typeof value === "string" ? value.trim() !== "" : true;
    });
    const entityPlaying = entityState === "playing" || rawPlaybackState === "playing";
    const entityPaused = entityState === "paused" || entityState === "idle" || entityState === "off" || rawPlaybackState === "paused" || rawPlaybackState === "stopped" || rawPlaybackState === "idle" || rawPlaybackState === "off";
    
    const forcedPaused = Date.now() < this._forcePauseUntil;
    const optimisticPlaying = Date.now() < this._optimisticPlayUntil && this._lastPlayPauseSent === "play";
    
    let isPlaying = false;
    if (forcedPaused) {
        isPlaying = false;
    } else if (optimisticPlaying) {
        isPlaying = true;
    } else {
        const hasExplicitAiboxState = hasAiboxState && (aiboxPlaying || aiboxPaused);
        isPlaying = !aiboxPaused && (hasExplicitAiboxState ? aiboxPlaying : entityPlaying);
    }
    
    const currentState = isPlaying ? "playing" : (forcedPaused || aiboxPaused || entityPaused || this._lastPlayPauseSent === "pause") ? "paused" : "idle";

    return { isPlaying, currentState, entityState, rawPlaybackState, aiboxPlaying, aiboxPaused, entityPlaying, entityPaused };
  },

  _timDichVuTheoTab(tab) {
    if (tab === "zing") return "search_zing";
    if (tab === "playlist" || tab === "playlists") return "search_playlist";
    return "search_youtube";
  },

  _nguonKetQuaTheoTab(tab) {
    if (tab === "zing") return "zingmp3";
    if (tab === "playlist" || tab === "playlists") return "youtube_playlist";
    return "youtube";
  },

  _mocCapNhatTimKiem(search) {
    const raw = search?.updated_at_ms ?? search?.updatedAtMs ?? search?.updated_at ?? search?.updatedAt;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  },

  _dauVetKetQuaTimKiem(search) {
    if (!search || typeof search !== "object") return "";
    const items = Array.isArray(search.items) ? search.items : [];
    const compactItems = items.slice(0, 5).map((item) => ({
      id: String(item?.id ?? ""), title: String(item?.title ?? ""), artist: String(item?.artist ?? ""),
    }));
    return JSON.stringify({ query: String(search.query || "").trim().toLowerCase(), source: String(search.source || "").trim().toLowerCase(), total: Number(search.total || 0), success: Boolean(search.success), items: compactItems });
  },

  _khoaTrangThaiTimKiem(search) {
    if (!search || typeof search !== "object") return "";
    return `${this._mocCapNhatTimKiem(search)}|${this._dauVetKetQuaTimKiem(search)}`;
  },

  _ketQuaTimKiemKhopYeuCau(search, query, source) {
    if (!search || typeof search !== "object") return false;
    const q = String(search.query || "").trim().toLowerCase();
    const s = String(search.source || "").trim().toLowerCase();
    const targetQuery = String(query || "").trim().toLowerCase();
    const targetSource = String(source || "").trim().toLowerCase();
    return Boolean(targetQuery) && q === targetQuery && (!targetSource || !s || s === targetSource);
  },

  _laKetQuaTimKiemMoi(search, query, source, mocTruoc, dauVetTruoc = "") {
    if (!search || typeof search !== "object") return false;
    if (!this._ketQuaTimKiemKhopYeuCau(search, query, source)) return false;
    const mocHienTai = this._mocCapNhatTimKiem(search);
    if (mocHienTai > 0 || mocTruoc > 0) return mocTruoc > 0 ? mocHienTai > mocTruoc : mocHienTai > 0;
    const dauVetHienTai = this._dauVetKetQuaTimKiem(search);
    if (!dauVetHienTai) return false;
    if (!dauVetTruoc) return true;
    return dauVetHienTai !== dauVetTruoc;
  },

  async _choKetQuaTimKiemMoi(query, source, mocTruoc, dauVetTruoc = "", timeoutMs = 15000) {
    const batDau = Date.now();
    let lastRefreshAt = 0;
    while (Date.now() - batDau < timeoutMs) {
      const search = this._thuocTinh().last_music_search || {};
      if (this._laKetQuaTimKiemMoi(search, query, source, mocTruoc, dauVetTruoc)) return true;
      const elapsed = Date.now() - batDau;
      if (elapsed - lastRefreshAt >= 1200) {
        lastRefreshAt = elapsed;
        try { await this._hass.callService("homeassistant", "update_entity", { entity_id: this._config.entity }); } catch (_) {}
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return false;
  },

  async _xuLyTimKiem(queryOverride = null) {
    const query = String(queryOverride ?? this._query).trim();
    if (!query) return;
    this._query = query;
    const service = this._timDichVuTheoTab(this._mediaSearchTab);
    const source = this._nguonKetQuaTheoTab(this._mediaSearchTab);
    const searchHienTai = this._thuocTinh().last_music_search || {};
    const mocTruoc = this._mocCapNhatTimKiem(searchHienTai);
    const dauVetTruoc = this._dauVetKetQuaTimKiem(searchHienTai);

    this._dangChoKetQuaTimKiem = true;
    this._timKiemDangCho = { query, source, mocTruoc, dauVetTruoc };
    let daCoKetQuaMoi = false;
    try {
      await this._goiDichVu("media_player", service, { query });
      daCoKetQuaMoi = await this._choKetQuaTimKiemMoi(query, source, mocTruoc, dauVetTruoc, 5000);
      if (!daCoKetQuaMoi) {
        try { await this._hass.callService("homeassistant", "update_entity", { entity_id: this._config.entity }); } catch (_) {}
        daCoKetQuaMoi = await this._choKetQuaTimKiemMoi(query, source, mocTruoc, dauVetTruoc, 4000);
      }
      if (!daCoKetQuaMoi) {
        daCoKetQuaMoi = this._ketQuaTimKiemKhopYeuCau(this._thuocTinh().last_music_search || {}, query, source);
      }
    } finally {
      this._dangChoKetQuaTimKiem = false;
      this._timKiemDangCho = null;
      const searchSauCung = this._thuocTinh().last_music_search || {};
      const coKetQuaPhuHop = this._ketQuaTimKiemKhopYeuCau(searchSauCung, query, source);
      const coKetQuaMoi = coKetQuaPhuHop && this._laKetQuaTimKiemMoi(searchSauCung, query, source, mocTruoc, dauVetTruoc);
      if (daCoKetQuaMoi || coKetQuaMoi || coKetQuaPhuHop) {
        this._veGiaoDienGiuFocusTimKiem();
      } else {
        this._pendingRender = true;
        this._giuFocusTimKiemKhongRender();
      }
    }
  },

  async _xuLyPhatMuc(item, source) {
    const resolvedId = this._layIdMucMedia(item);
    if (!resolvedId) return;
    const normalizedSource = String(source || "").toLowerCase();

    this._livePositionSeconds = 0;
    this._ignorePositionUntil = Date.now() + 4000;
    this._dongBoTienDoDom();

    const itemTitle = item.title || "Đang tải...";
    const itemArtist = item.artist || item.channel || "Chưa rõ nghệ sĩ";
    const itemDuration = item.duration_seconds || 0;
    const itemThumb = item.thumbnail_url || "";
    
    this._nowPlayingCache = {
        trackKey: `${normalizedSource}|${itemTitle}|${itemArtist}|${itemDuration}`,
        trackId: resolvedId, 
        title: itemTitle,
        artist: itemArtist,
        source: normalizedSource,
        thumbnail_url: itemThumb,
        duration: itemDuration
    };
    this._optimisticTrackUntil = Date.now() + 6000;

    this._lastPlayPauseSent = "play";
    this._forcePauseUntil = 0;
    this._optimisticPlayUntil = Date.now() + 5000;
    this._livePlaying = true;
    this._liveTickAt = Date.now();
    this._veGiaoDien(); 

    if (normalizedSource.includes("zing")) {
      await this._goiDichVu("media_player", "play_zing", { song_id: resolvedId });
    } else {
      await this._goiDichVu("media_player", "play_youtube", { video_id: resolvedId });
    }
    
    await this._lamMoiEntity(300, 2);
  },

  async _xuLyPhatTamDung() {
    const stateObj = this._doiTuongTrangThai();
    const playback = this._thongTinPhat();
    const playbackState = this._layTrangThaiHienThiPhat(playback, stateObj);
    const nextAction = playbackState.isPlaying ? "pause" : "play";

    this._lastPlayPauseSent = nextAction;
    if (nextAction === "pause") {
      this._forcePauseUntil = Date.now() + 5000; this._optimisticPlayUntil = 0;
      this._livePlaying = false; this._dongBoTienDoDom(); this._capNhatHenGioTienDo();
    } else {
      this._forcePauseUntil = 0; this._optimisticPlayUntil = Date.now() + 5000;
      if (this._liveDurationSeconds > 0 && this._livePositionSeconds < this._liveDurationSeconds) {
        this._livePlaying = true; this._liveTickAt = Date.now();
        this._dongBoTienDoDom(); this._capNhatHenGioTienDo();
      }
    }
    
    this._veGiaoDien();

    try {
      await this._goiDichVu("media_player", nextAction === "pause" ? "media_pause" : "media_play");
    } catch (err) {
      console.warn("Fallback to media_play_pause", err);
      await this._goiDichVu("media_player", "media_play_pause");
    }
    
    await this._lamMoiEntity(300);
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

  async _damBaoTrangThaiChat() {
    const attrs = this._thuocTinh();
    const chat = attrs.chat_state || {};
    const hasData = ["state", "chat_state", "status", "button_text", "button_enabled"].some((key) => key in chat) && Object.keys(chat).length > 0;
    const now = Date.now();
    const shouldFetchState = !hasData && now - this._lastChatStateRequestAt >= 7000;
    const shouldFetchHistory = !this._chatHistoryLoaded && now - this._lastChatHistoryRequestAt >= 7000;
    if (!shouldFetchState && !shouldFetchHistory) return;
    if (shouldFetchState) this._lastChatStateRequestAt = now;
    if (shouldFetchHistory) this._lastChatHistoryRequestAt = now;
    try {
      if (shouldFetchState) await this._goiDichVu("esp32_aibox_media_controller", "chat_get_state");
      if (shouldFetchHistory) await this._goiDichVu("esp32_aibox_media_controller", "chat_get_history");
      await this._lamMoiEntity(220);
    } catch (err) { console.warn("chat bootstrap failed", err); }
  },

  async _guiTinNhanChat() {
    const text = (this._chatInput || "").trim();
    if (!text) return;
    this._themTinNhanChatTam(text, "user");
    this._chatInput = ""; 
    this._lastChatHistoryRequestAt = 0;
    this._veGiaoDienGiuFocusChat(); 
    this._cuonCuoiKhungChat();
    try {
      await this._goiDichVu("esp32_aibox_media_controller", "chat_send_text", { text: text });
      await this._goiDichVu("esp32_aibox_media_controller", "chat_get_history");
      await this._lamMoiEntity(220, 2);
      this._cuonCuoiKhungChat();
    } catch (err) { console.warn("chat_send_text failed", err); }
  },

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
    } catch (err) { console.warn("control bootstrap refresh failed", err); }
  },

  async _damBaoTrangThaiHeThong() {
    const now = Date.now();
    if (now - this._lastSystemStateRequestAt < 7000) return;
    this._lastSystemStateRequestAt = now;
    try {
      await this._goiDichVu("esp32_aibox_media_controller", "refresh_state");
      await this._lamMoiEntity(250, 2);
    } catch (err) { console.warn("system bootstrap refresh failed", err); }
  }
};