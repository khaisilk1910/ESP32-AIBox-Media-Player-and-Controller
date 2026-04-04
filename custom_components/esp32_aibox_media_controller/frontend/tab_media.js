export const TabMediaMixin = {
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
    if (this._ignorePositionUntil && now < this._ignorePositionUntil) posRaw = 0;
    else if (this._ignorePositionUntil && now >= this._ignorePositionUntil) this._ignorePositionUntil = 0;

    const dur = Number.isFinite(Number(durationSeconds)) ? Math.max(0, Number(durationSeconds)) : 0;
    const pos = dur > 0 ? Math.min(posRaw, dur) : posRaw;
    const sameTrack = Boolean(trackKey) && trackKey === this._liveTrackKey;

    if (!trackKey && !isPlaying && pos <= 0 && dur <= 0) {
      this._liveTrackKey = ""; this._livePositionSeconds = 0; this._liveDurationSeconds = 0;
      this._livePlaying = false; this._liveTickAt = now; return;
    }

    if (!sameTrack) {
      this._liveTrackKey = trackKey; this._livePositionSeconds = pos;
    } else if (!isPlaying || Math.abs(pos - this._livePositionSeconds) > 2 || pos > this._livePositionSeconds) {
      this._livePositionSeconds = pos;
    }
    this._liveDurationSeconds = dur;
    this._livePlaying = Boolean(isPlaying);
    this._liveTickAt = now;
  },

  _xuLyNhipHenGioTienDo() {
    if (!this._livePlaying) { this._dongBoTienDoDom(); return; }
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
        if (source.toLowerCase().includes("zing")) await this._goiDichVu("media_player", "play_zing", { song_id: trackId });
        else await this._goiDichVu("media_player", "play_youtube", { video_id: trackId });
      } else {
        await this._goiDichVu("media_player", "media_play");
      }
    } else if (this._repeatMode === "all") {
      await this._goiDichVu("media_player", "media_next_track");
    }
  },

  _dongBoTienDoDom() {
    if (this._activeTab !== "media") return;
    const root = this.shadowRoot;
    if (!root) return;
    const positionEl = root.getElementById("playback-position");
    const durationEl = root.getElementById("playback-duration");
    const progressEl = root.getElementById("playback-progress");
    const progressTrackEl = root.getElementById("playback-progress-track");

    if (positionEl) positionEl.textContent = this._dinhDangDongHo(this._livePositionSeconds, "0:00");
    if (durationEl) durationEl.textContent = this._liveDurationSeconds > 0 ? this._dinhDangThoiLuong(this._liveDurationSeconds) : "--:--";
    if (progressEl) {
      const progressPercent = this._liveDurationSeconds > 0 ? Math.max(0, Math.min(100, (this._livePositionSeconds / this._liveDurationSeconds) * 100)) : 0;
      progressEl.style.width = `${progressPercent.toFixed(2)}%`;
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

    if (this._optimisticTrackUntil && Date.now() < this._optimisticTrackUntil && this._nowPlayingCache?.trackKey) {
       return { ...this._nowPlayingCache, position: this._livePositionSeconds, play, search, items, aibox };
    }

    const stateObj = this._doiTuongTrangThai();
    const aiboxTrackId = this._chuoiKhongRongDauTien(aibox.id, aibox.video_id, aibox.song_id, aibox.track_id);
    const playId = this._chuoiKhongRongDauTien(play.id, play.video_id, play.song_id, play.track_id, aiboxTrackId);

    let byId = items.find((item) => {
      const itemId = this._layIdMucMedia(item);
      return itemId && (itemId === playId || itemId === aiboxTrackId);
    });

    if (!byId && !playId) {
      const isLikelyPlaying = String(stateObj?.state || "").toLowerCase() === "playing" || this._laPhatDangHoatDong(aibox.is_playing) || this._laPhatDangHoatDong(aibox.play_state) || this._laPhatDangHoatDong(aibox.state) || String(aibox.state || "").toLowerCase() === "playing";
      if (isLikelyPlaying && items.length > 0) byId = items[0];
    }

    const rawTitle = this._chuoiKhongRongDauTien(aibox.title, attrs.media_title, byId?.title, play.title);
    let title = this._laTieuDeNghi(rawTitle) ? "" : rawTitle;
    let artist = this._chuoiKhongRongDauTien(aibox.artist, aibox.channel, attrs.media_artist, byId?.artist, byId?.channel, play.artist);
    let duration = this._epKieuGiayPhat(aibox.duration ?? attrs.media_duration ?? byId?.duration_seconds, 0);
    let position = this._epKieuGiayPhat(aibox.position ?? attrs.media_position, 0);
    if (duration > 0 && position > duration) position = duration;
    let source = this._chuoiKhongRongDauTien(aibox.source, play.source, search.source);
    let thumbnailUrl = this._chuoiKhongRongDauTien(aibox.thumbnail_url, attrs.entity_picture, byId?.thumbnail_url, items.find((item) => item?.thumbnail_url)?.thumbnail_url);

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
      } else if (this._nowPlayingCache?.trackKey && (aiboxPlaying || aiboxPaused || position > 0 || duration > 0 || this._chuoiKhongRongDauTien(source, playId, aiboxTrackId))) {
        title = title || this._nowPlayingCache.title; artist = artist || this._nowPlayingCache.artist; source = source || this._nowPlayingCache.source; thumbnailUrl = thumbnailUrl || this._nowPlayingCache.thumbnail_url;
        if (duration <= 0 && this._nowPlayingCache.duration > 0) duration = this._nowPlayingCache.duration;
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
    const hasAiboxState = ["is_playing", "play_state", "state"].some((key) => playback.aibox?.[key] !== undefined && playback.aibox?.[key] !== null && (typeof playback.aibox?.[key] === "string" ? playback.aibox?.[key].trim() !== "" : true));
    const entityPlaying = entityState === "playing" || rawPlaybackState === "playing";
    const entityPaused = entityState === "paused" || entityState === "idle" || entityState === "off" || rawPlaybackState === "paused" || rawPlaybackState === "stopped" || rawPlaybackState === "idle" || rawPlaybackState === "off";
    
    let isPlaying = false;
    if (Date.now() < this._forcePauseUntil) isPlaying = false;
    else if (Date.now() < this._optimisticPlayUntil && this._lastPlayPauseSent === "play") isPlaying = true;
    else isPlaying = !aiboxPaused && (hasAiboxState && (aiboxPlaying || aiboxPaused) ? aiboxPlaying : entityPlaying);
    
    const currentState = isPlaying ? "playing" : (Date.now() < this._forcePauseUntil || aiboxPaused || entityPaused || this._lastPlayPauseSent === "pause") ? "paused" : "idle";
    return { isPlaying, currentState, entityState, rawPlaybackState, aiboxPlaying, aiboxPaused, entityPlaying, entityPaused };
  },

  _timDichVuTheoTab(tab) { return tab === "zing" ? "search_zing" : (tab === "playlist" || tab === "playlists" ? "search_playlist" : "search_youtube"); },
  _nguonKetQuaTheoTab(tab) { return tab === "zing" ? "zingmp3" : (tab === "playlist" || tab === "playlists" ? "youtube_playlist" : "youtube"); },
  _mocCapNhatTimKiem(search) { return Number.isFinite(Number(search?.updated_at_ms ?? search?.updatedAtMs ?? search?.updated_at ?? search?.updatedAt)) ? Number(search?.updated_at_ms ?? search?.updatedAtMs ?? search?.updated_at ?? search?.updatedAt) : 0; },
  _dauVetKetQuaTimKiem(search) {
    if (!search || typeof search !== "object") return "";
    return JSON.stringify({ query: String(search.query || "").trim().toLowerCase(), source: String(search.source || "").trim().toLowerCase(), total: Number(search.total || 0), success: Boolean(search.success), items: (Array.isArray(search.items) ? search.items : []).slice(0, 5).map((item) => ({ id: String(item?.id ?? ""), title: String(item?.title ?? ""), artist: String(item?.artist ?? "") })) });
  },
  _khoaTrangThaiTimKiem(search) { return search && typeof search === "object" ? `${this._mocCapNhatTimKiem(search)}|${this._dauVetKetQuaTimKiem(search)}` : ""; },
  _ketQuaTimKiemKhopYeuCau(search, query, source) {
    if (!search || typeof search !== "object") return false;
    const q = String(search.query || "").trim().toLowerCase(), s = String(search.source || "").trim().toLowerCase(), targetQ = String(query || "").trim().toLowerCase(), targetS = String(source || "").trim().toLowerCase();
    return Boolean(targetQ) && q === targetQ && (!targetS || !s || s === targetS);
  },
  _laKetQuaTimKiemMoi(search, query, source, mocTruoc, dauVetTruoc = "") {
    if (!this._ketQuaTimKiemKhopYeuCau(search, query, source)) return false;
    const mocHienTai = this._mocCapNhatTimKiem(search);
    if (mocHienTai > 0 || mocTruoc > 0) return mocTruoc > 0 ? mocHienTai > mocTruoc : mocHienTai > 0;
    const dauVetHienTai = this._dauVetKetQuaTimKiem(search);
    return dauVetHienTai && (!dauVetTruoc || dauVetHienTai !== dauVetTruoc);
  },

  async _choKetQuaTimKiemMoi(query, source, mocTruoc, dauVetTruoc = "", timeoutMs = 15000) {
    const batDau = Date.now();
    let lastRefreshAt = 0;
    while (Date.now() - batDau < timeoutMs) {
      if (this._laKetQuaTimKiemMoi(this._thuocTinh().last_music_search || {}, query, source, mocTruoc, dauVetTruoc)) return true;
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
    const searchHienTai = this._thuocTinh().last_music_search || {};
    const source = this._nguonKetQuaTheoTab(this._mediaSearchTab);
    const mocTruoc = this._mocCapNhatTimKiem(searchHienTai);
    const dauVetTruoc = this._dauVetKetQuaTimKiem(searchHienTai);

    this._dangChoKetQuaTimKiem = true;
    this._timKiemDangCho = { query, source, mocTruoc, dauVetTruoc };
    let daCoKetQuaMoi = false;
    try {
      await this._goiDichVu("media_player", this._timDichVuTheoTab(this._mediaSearchTab), { query });
      daCoKetQuaMoi = await this._choKetQuaTimKiemMoi(query, source, mocTruoc, dauVetTruoc, 5000);
      if (!daCoKetQuaMoi) {
        try { await this._hass.callService("homeassistant", "update_entity", { entity_id: this._config.entity }); } catch (_) {}
        daCoKetQuaMoi = await this._choKetQuaTimKiemMoi(query, source, mocTruoc, dauVetTruoc, 4000);
      }
      if (!daCoKetQuaMoi) daCoKetQuaMoi = this._ketQuaTimKiemKhopYeuCau(this._thuocTinh().last_music_search || {}, query, source);
    } finally {
      this._dangChoKetQuaTimKiem = false;
      this._timKiemDangCho = null;
      const searchSauCung = this._thuocTinh().last_music_search || {};
      if (daCoKetQuaMoi || (this._ketQuaTimKiemKhopYeuCau(searchSauCung, query, source) && this._laKetQuaTimKiemMoi(searchSauCung, query, source, mocTruoc, dauVetTruoc)) || this._ketQuaTimKiemKhopYeuCau(searchSauCung, query, source)) {
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
    
    this._nowPlayingCache = { trackKey: `${normalizedSource}|${itemTitle}|${itemArtist}|${itemDuration}`, trackId: resolvedId, title: itemTitle, artist: itemArtist, source: normalizedSource, thumbnail_url: item.thumbnail_url || "", duration: itemDuration };
    this._optimisticTrackUntil = Date.now() + 6000;
    this._lastPlayPauseSent = "play";
    this._forcePauseUntil = 0;
    this._optimisticPlayUntil = Date.now() + 5000;
    this._livePlaying = true;
    this._liveTickAt = Date.now();
    this._veGiaoDien(); 

    if (normalizedSource.includes("zing")) await this._goiDichVu("media_player", "play_zing", { song_id: resolvedId });
    else await this._goiDichVu("media_player", "play_youtube", { video_id: resolvedId });
    await this._lamMoiEntity(300, 2);
  },

  async _xuLyPhatTamDung() {
    const playbackState = this._layTrangThaiHienThiPhat(this._thongTinPhat());
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
    try { await this._goiDichVu("media_player", nextAction === "pause" ? "media_pause" : "media_play"); } 
    catch (err) { await this._goiDichVu("media_player", "media_play_pause"); }
    await this._lamMoiEntity(300);
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
    inputMoi.setSelectionRange(Math.max(0, Math.min(inputMoi.value.length, Number(viTriBatDau))), Math.max(0, Math.min(inputMoi.value.length, Number(viTriKetThuc))));
  },

  _giuFocusTimKiemKhongRender() {
    if (!this._dangFocusTimKiem()) return;
    const input = this.shadowRoot?.getElementById("media-query");
    if (!input) return;
    const viTriBatDau = input.selectionStart ?? input.value.length;
    const viTriKetThuc = input.selectionEnd ?? input.value.length;
    requestAnimationFrame(() => {
      const inputMoi = this.shadowRoot?.getElementById("media-query");
      if (inputMoi) {
        inputMoi.focus();
        inputMoi.setSelectionRange(Math.max(0, Math.min(inputMoi.value.length, Number(viTriBatDau))), Math.max(0, Math.min(inputMoi.value.length, Number(viTriKetThuc))));
      }
    });
  },

  _veCotSong() {
    const seeds = [18, 36, 14, 48, 26, 40, 22, 52, 30, 44, 20, 38, 50, 10, 25, 45, 15, 35, 42, 28, 55, 32];
    return Array.from({ length: 50 }, (_, idx) => `<span class="wave-bar" style="--i:${idx};--h:${seeds[idx % seeds.length]}px"></span>`).join("");
  },

  _veTabMedia(stateObj) {
    const playback = this._thongTinPhat();
    const playbackState = this._layTrangThaiHienThiPhat(playback, stateObj);
    const isPlaying = playbackState.isPlaying;
    const source = playbackState.currentState === "idle" && this._laTieuDeNghi(playback.title) ? "CHỜ PHÁT" : this._nhanNguon(playback.source);
    const volumePercent = Math.round(this._volumeLevel * 100);
    const listSource = playback.search?.source || playback.play?.source || "youtube";
    
    this._dongBoTienDoTrucTiep(playback.track_key || "", this._epKieuGiayPhat(playback.position, 0), this._epKieuGiayPhat(playback.duration, 0), isPlaying);
    const liveDurationSeconds = this._liveDurationSeconds > 0 ? this._liveDurationSeconds : this._epKieuGiayPhat(playback.duration, 0);

    const progressPercent = liveDurationSeconds > 0 ? Math.max(0, Math.min(100, (this._livePositionSeconds / liveDurationSeconds) * 100)) : 0;
    const coverUrl = this._maHoaHtml(playback.thumbnail_url || "");
    const repeatIcon = this._repeatMode === "one" ? "mdi:repeat-once" : (this._repeatMode === "all" ? "mdi:repeat" : "mdi:repeat-off");
    const volIcon = volumePercent === 0 ? "mdi:volume-mute" : (volumePercent < 40 ? "mdi:volume-low" : (volumePercent < 80 ? "mdi:volume-medium" : "mdi:volume-high"));
    
    let hasHighlightedCurrent = false;

    return `
      <section class="panel panel-media">
        <div class="hero ${isPlaying ? "is-playing" : "is-paused"} wave-effect-${this._waveEffect}">
          ${coverUrl ? `<img class="hero-bg-img" src="${coverUrl}" alt="" />` : ""}
          <div class="hero-overlay"></div>
          <div class="hero-bg-text">${this._maHoaHtml(playback.title)}</div>

          <div class="hero-content">
            <div class="hero-top">
              <div class="hero-titles">
                <h2 class="song-title">${this._maHoaHtml(playback.title)}</h2>
                <div class="song-sub">${this._maHoaHtml(playback.artist || "Chưa rõ nghệ sĩ")}</div>
              </div>
              <div class="hero-top-right">
                <span class="pill">${this._maHoaHtml(source)}</span>
                <div class="hero-actions">
                   <button id="btn-repeat" class="icon-btn-transparent hover-scale" title="Chế độ lặp lại" style="color: ${this._repeatMode === "off" ? "rgba(255,255,255,0.4)" : "#fff"}"><ha-icon icon="${repeatIcon}"></ha-icon></button>
                   <button id="btn-wave-toggle" class="icon-btn-transparent hover-scale" title="Đổi kiểu sóng âm"><ha-icon icon="mdi:waveform"></ha-icon></button>
                </div>
              </div>
            </div>

            <div class="player-stage-new">
              <div class="cover-disc ${isPlaying ? "spinning" : ""}">
                ${coverUrl ? `<img src="${coverUrl}" alt="" />` : `<ha-icon icon="mdi:music-note"></ha-icon>`}
              </div>
            </div>

            <div class="hero-bottom">
              <div class="controls-overlay">
                <button id="btn-prev" class="icon-btn-transparent hover-scale"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
                <button id="btn-playpause" class="icon-btn-transparent btn-large hover-scale"><ha-icon icon="${isPlaying ? 'mdi:pause' : 'mdi:play'}"></ha-icon></button>
                <button id="btn-stop" class="icon-btn-transparent hover-scale"><ha-icon icon="mdi:stop"></ha-icon></button>
                <button id="btn-next" class="icon-btn-transparent hover-scale"><ha-icon icon="mdi:skip-next"></ha-icon></button>
              </div>
              
              <div class="waveform-full">${this._veCotSong()}</div>
              
              <div class="progress-row">
                <span id="playback-position" class="time-text">${this._dinhDangDongHo(this._livePositionSeconds, "0:00")}</span>
                <div id="playback-progress-track" class="progress-track-new" role="slider" aria-valuemin="0" aria-valuemax="${Math.max(0, Math.round(liveDurationSeconds))}" aria-valuenow="${Math.max(0, Math.round(this._livePositionSeconds))}">
                  <div id="playback-progress" class="progress-fill-new" style="width:${progressPercent.toFixed(2)}%"></div>
                </div>
                <span id="playback-duration" class="time-text">${liveDurationSeconds > 0 ? this._dinhDangThoiLuong(liveDurationSeconds) : "--:--"}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="modern-volume-container">
          <div class="vol-side vol-side-left">
            <ha-icon id="btn-mute-toggle" class="${volumePercent === 0 ? 'is-muted' : ''}" icon="${volIcon}" style="cursor: pointer;"></ha-icon>
            <button id="btn-vol-down" class="vol-btn"><ha-icon icon="mdi:minus"></ha-icon></button>
          </div>
          <div class="modern-volume-track-wrap">
            <input id="media-volume" class="modern-volume-slider" type="range" min="0" max="100" step="1" value="${volumePercent}" />
            <div class="modern-volume-fill" style="width: ${volumePercent}%"></div>
          </div>
          <div class="vol-side vol-side-right">
            <button id="btn-vol-up" class="vol-btn"><ha-icon icon="mdi:plus"></ha-icon></button>
            <span class="modern-volume-text">${volumePercent}%</span>
          </div>
        </div>

        <div class="subtabs">
          <button class="subtab ${this._mediaSearchTab === "songs" ? "active" : ""}" data-media-tab="songs">Songs</button>
          <button class="subtab ${this._mediaSearchTab === "playlist" ? "active" : ""}" data-media-tab="playlist">Playlist</button>
          <button class="subtab ${this._mediaSearchTab === "zing" ? "active" : ""}" data-media-tab="zing">Zing MP3</button>
          <button class="subtab ${this._mediaSearchTab === "playlists" ? "active" : ""}" data-media-tab="playlists">Playlists</button>
        </div>

        <div class="search-row">
          <input id="media-query" class="text-input" type="text" placeholder="Tìm bài hát..." value="${this._maHoaHtml(this._query)}" />
          <button id="btn-search" class="icon-btn icon-btn-primary search-btn-hover"><ha-icon icon="mdi:magnify"></ha-icon></button>
        </div>

        <div class="results">
          ${playback.items.length === 0 ? `<div class="empty">Chưa có kết quả tìm kiếm. Nhập từ khóa và bấm Tìm kiếm.</div>` : playback.items.map((item, idx) => {
            const itemId = this._layIdMucMedia(item);
            const itemTitle = item.title || `Bản nhạc ${idx + 1}`;
            let isPlayingItem = false;
            
            if (!hasHighlightedCurrent) {
              if (String(playback.track_id).trim() && itemId && String(playback.track_id).trim() === itemId) { isPlayingItem = true; hasHighlightedCurrent = true; } 
              else if (String(playback.title).trim().toLowerCase() === String(itemTitle).trim().toLowerCase()) { isPlayingItem = true; hasHighlightedCurrent = true; }
            }

            return `
            <div class="result-item ${itemId ? "playable" : ""} ${isPlayingItem ? "is-playing-item" : ""}" data-id="${this._maHoaHtml(itemId)}" data-source="${this._maHoaHtml(listSource)}">
              <div class="thumb-wrap">${item.thumbnail_url ? `<img class="thumb" src="${this._maHoaHtml(item.thumbnail_url)}" alt="" />` : `<div class="thumb fallback"><ha-icon icon="mdi:music-note"></ha-icon></div>`}</div>
              <div class="result-meta">
                <div class="result-title">${this._maHoaHtml(itemTitle)}</div>
                <div class="result-artist">${this._maHoaHtml(item.artist || item.channel || "Chưa rõ nghệ sĩ")}</div>
                <div class="result-duration">${this._dinhDangThoiLuong(item.duration_seconds)}</div>
              </div>
              <div class="result-actions">
                <button class="mini-btn mini-btn-accent add-btn" data-add-title="${this._maHoaHtml(itemTitle)}"><ha-icon icon="mdi:plus"></ha-icon></button>
                <button class="mini-btn mini-btn-danger play-btn" data-id="${this._maHoaHtml(itemId)}" data-source="${this._maHoaHtml(listSource)}"><ha-icon icon="mdi:play"></ha-icon><span>Phát</span></button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </section>
    `;
  },

  _ganSuKienTabMedia(root) {
    root.querySelectorAll("[data-media-tab]").forEach((el) => {
      el.addEventListener("click", () => { this._mediaSearchTab = el.dataset.mediaTab || "songs"; this._veGiaoDien(); });
    });

    root.getElementById("btn-repeat")?.addEventListener("click", () => {
      this._repeatMode = this._repeatMode === "all" ? "one" : (this._repeatMode === "one" ? "off" : "all");
      this._veGiaoDien();
    });

    root.getElementById("btn-wave-toggle")?.addEventListener("click", () => {
      this._waveEffect = (this._waveEffect + 1) % 3;
      this._veGiaoDien();
    });

    const mediaQuery = root.getElementById("media-query");
    if (mediaQuery) {
      mediaQuery.addEventListener("focus", () => { this._mediaQueryFocused = true; });
      mediaQuery.addEventListener("input", (ev) => { this._query = ev.target.value; });
      mediaQuery.addEventListener("compositionstart", () => { this._mediaDangCompose = true; });
      mediaQuery.addEventListener("compositionend", async (ev) => {
        this._mediaDangCompose = false; this._query = ev.target.value;
        if (this._mediaTimKiemSauCompose) { this._mediaTimKiemSauCompose = false; await this._xuLyTimKiem(ev.target.value); }
      });
      mediaQuery.addEventListener("keydown", async (ev) => {
        if (ev.key !== "Enter") return; ev.preventDefault(); ev.stopPropagation();
        if (ev.isComposing || this._mediaDangCompose) { this._mediaTimKiemSauCompose = true; return; }
        this._query = mediaQuery.value; await this._xuLyTimKiem(mediaQuery.value);
      });
      mediaQuery.addEventListener("blur", () => { this._mediaQueryFocused = false; setTimeout(() => this._xuLyRenderCho(), 0); });
    }

    const btnSearch = root.getElementById("btn-search");
    if (btnSearch) {
      btnSearch.addEventListener("mousedown", (ev) => ev.preventDefault());
      btnSearch.addEventListener("click", async () => await this._xuLyTimKiem(mediaQuery ? mediaQuery.value : this._query));
    }

    const progressTrack = root.getElementById("playback-progress-track");
    if (progressTrack) {
      const seekToClientX = async (clientX) => {
        const duration = this._liveDurationSeconds > 0 ? this._liveDurationSeconds : this._epKieuGiayPhat(this._thongTinPhat().duration, 0);
        if (duration <= 0) return;
        const rect = progressTrack.getBoundingClientRect(); if (!rect.width) return;
        const target = Math.floor(duration * Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
        this._livePositionSeconds = target; this._liveDurationSeconds = duration; this._liveTickAt = Date.now();
        this._dongBoTienDoDom(); await this._goiDichVu("media_player", "seek", { position: target }); await this._lamMoiEntity(180);
      };
      progressTrack.addEventListener("click", async (ev) => await seekToClientX(ev.clientX));
      progressTrack.addEventListener("touchend", async (ev) => {
        const touch = ev.changedTouches?.[0]; if (touch) { ev.preventDefault(); await seekToClientX(touch.clientX); }
      }, { passive: false });
    }

    root.getElementById("btn-prev")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._livePositionSeconds = 0; this._ignorePositionUntil = Date.now() + 4000; this._lastPlayPauseSent = "play"; this._forcePauseUntil = 0; this._optimisticPlayUntil = Date.now() + 5000;
      this._optimisticTrackUntil = 0; this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
      this._livePlaying = true; this._dongBoTienDoDom(); this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "media_previous_track"); await this._lamMoiEntity(300, 2); } catch(e){}
    });

    root.getElementById("btn-playpause")?.addEventListener("click", async (ev) => { ev.preventDefault(); ev.stopPropagation(); await this._xuLyPhatTamDung(); });

    root.getElementById("btn-stop")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._forcePauseUntil = Date.now() + 5000; this._optimisticPlayUntil = 0; this._liveTrackKey = ""; this._livePositionSeconds = 0; this._ignorePositionUntil = Date.now() + 4000;
      this._liveDurationSeconds = 0; this._livePlaying = false; this._optimisticTrackUntil = 0; this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
      this._lastPlayPauseSent = "pause"; this._dongBoTienDoDom(); this._capNhatHenGioTienDo(); this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "media_stop"); } catch (e) { await this._goiDichVu("media_player", "media_pause"); }
      await this._lamMoiEntity(300);
    });

    root.getElementById("btn-next")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._livePositionSeconds = 0; this._ignorePositionUntil = Date.now() + 4000; this._lastPlayPauseSent = "play"; this._forcePauseUntil = 0; this._optimisticPlayUntil = Date.now() + 5000;
      this._optimisticTrackUntil = 0; this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
      this._livePlaying = true; this._dongBoTienDoDom(); this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "media_next_track"); await this._lamMoiEntity(300, 2); } catch(e){}
    });

    root.getElementById("btn-mute-toggle")?.addEventListener("click", async () => {
      if (this._volumeLevel > 0) { this._preMuteVolumeLevel = this._volumeLevel; this._volumeLevel = 0; }
      else { this._volumeLevel = this._preMuteVolumeLevel || 0.5; this._preMuteVolumeLevel = null; }
      this._veGiaoDien(); await this._goiDichVu("media_player", "volume_set", { volume_level: this._volumeLevel });
    });

    const volumeSlider = root.getElementById("media-volume");
    if (volumeSlider) {
      volumeSlider.addEventListener("input", (ev) => { this._volumeLevel = Number(ev.target.value) / 100; if (this._volumeLevel > 0) this._preMuteVolumeLevel = null; });
      volumeSlider.addEventListener("change", async (ev) => { this._volumeLevel = Number(ev.target.value) / 100; if (this._volumeLevel > 0) this._preMuteVolumeLevel = null; await this._goiDichVu("media_player", "volume_set", { volume_level: this._volumeLevel }); });
    }

    root.getElementById("btn-vol-down")?.addEventListener("click", async () => {
      this._volumeLevel = Math.max(0, Math.round(this._volumeLevel * 100) - 5) / 100; if (this._volumeLevel > 0) this._preMuteVolumeLevel = null;
      this._veGiaoDien(); await this._goiDichVu("media_player", "volume_set", { volume_level: this._volumeLevel });
    });

    root.getElementById("btn-vol-up")?.addEventListener("click", async () => {
      this._volumeLevel = Math.min(100, Math.round(this._volumeLevel * 100) + 5) / 100; if (this._volumeLevel > 0) this._preMuteVolumeLevel = null;
      this._veGiaoDien(); await this._goiDichVu("media_player", "volume_set", { volume_level: this._volumeLevel });
    });

    const playFromDataset = async (dataset) => { if (dataset?.id) await this._xuLyPhatMuc({ id: dataset.id }, dataset.source || ""); };

    root.querySelectorAll(".play-btn").forEach(el => el.addEventListener("click", async (ev) => { ev.stopPropagation(); await playFromDataset(el.dataset); }));
    root.querySelectorAll(".add-btn").forEach(el => el.addEventListener("click", (ev) => {
      ev.stopPropagation(); const title = el.dataset.addTitle; if (!title) return;
      this._query = title; const searchInput = root.getElementById("media-query");
      if (searchInput) { searchInput.value = title; searchInput.focus(); searchInput.setSelectionRange(title.length, title.length); }
    }));
    root.querySelectorAll(".result-item.playable").forEach(el => {
      el.addEventListener("click", async (ev) => { if (!ev.target.closest(".play-btn") && !ev.target.closest(".add-btn")) await playFromDataset(el.dataset); });
      el.addEventListener("keydown", async (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); await playFromDataset(el.dataset); } });
    });
  }
};