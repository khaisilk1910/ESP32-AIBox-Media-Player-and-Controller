export const TabMediaMixin = {
  // === CÁC HÀM QUẢN LÝ TRẠNG THÁI MEDIA ===
  _khoiTaoTrangThaiMedia() {
    this._mediaSearchTab = "songs";
    this._repeatMode = "all";
    this._autoNextEnabled = true;
    this._waveEffect = 0;
    this._mediaDangCompose = false;
    this._mediaTimKiemSauCompose = false;
    this._mediaQueryFocused = false;
    this._progressTimerId = null;
    this._liveTrackKey = "";
    this._livePositionSeconds = 0;
    this._ignorePositionUntil = 0;
    this._liveDurationSeconds = 0;
    this._livePlaying = false;
    this._liveTickAt = 0;
    this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
    this._optimisticTrackUntil = 0;
    this._forcePauseUntil = 0;
    this._optimisticPlayUntil = 0;
    this._lastPlayPauseSent = null;
    this._lastSearchStateKey = "";
    this._dangChoKetQuaTimKiem = false;
    this._timKiemDangCho = null;
    this._lastScrolledTrackIdent = null;
    this._savedScrollPosition = 0;
    this._userIsScrolling = false;

    // --- State Playlist ---
    this._lastPlaylistLibraryKey = "";
    this._lastPlaylistDetailKey = "";
    this._lastPlaylistEventKey = "";
    this._playlistLibraryLoading = false;
    this._playlistDetailLoading = false;
    this._playlistDetailVisibleId = "";

    this._danhSachPlaylist = []; 
    this._dangXemPlaylistId = null;
    this._dangXemPlaylistTen = "";
    this._danhSachBaiHatTrongPlaylist = [];
    
    this._modalThemVaoPlaylist = { show: false, song: null, source: null };
    this._modalTaoPlaylist = { show: false };
    this._modalXoaPlaylist = { show: false, id: null };
  },

  // Hàm Helper bóc tách JSON từ Home Assistant Attributes
  _parseJSONSafe(data) {
    if (!data) return {};
    if (typeof data === 'string') {
        try { return JSON.parse(data); } catch(e) { return {}; }
    }
    if (typeof data === 'object') return data;
    return {};
  },

  _kiemTraThayDoiTrangThaiMedia(entityRef) {
    const currentSearchStateKey = this._khoaTrangThaiTimKiem(entityRef?.attributes?.last_music_search || {});
    const searchChanged = currentSearchStateKey !== this._lastSearchStateKey;
    this._lastSearchStateKey = currentSearchStateKey;

    const currentPlaylistLibraryKey = this._khoaTrangThaiPayload(entityRef?.attributes?.playlist_library);
    const playlistLibraryChanged = currentPlaylistLibraryKey !== this._lastPlaylistLibraryKey;
    
    const currentPlaylistDetailKey = this._khoaTrangThaiPayload(entityRef?.attributes?.playlist_detail);
    const playlistDetailChanged = currentPlaylistDetailKey !== this._lastPlaylistDetailKey;

    const currentPlaylistEventKey = this._khoaTrangThaiPayload(entityRef?.attributes?.last_playlist_event);
    const playlistEventChanged = currentPlaylistEventKey !== this._lastPlaylistEventKey;

    this._lastPlaylistLibraryKey = currentPlaylistLibraryKey;
    this._lastPlaylistDetailKey = currentPlaylistDetailKey;
    this._lastPlaylistEventKey = currentPlaylistEventKey;

    const library = this._parseJSONSafe(entityRef?.attributes?.playlist_library);
    this._danhSachPlaylist = Array.isArray(library.playlists) ? library.playlists : [];

    const detail = this._parseJSONSafe(entityRef?.attributes?.playlist_detail);
    if (this._playlistDetailVisibleId && String(detail.playlist_id) === String(this._playlistDetailVisibleId)) {
        this._danhSachBaiHatTrongPlaylist = Array.isArray(detail.items) ? detail.items : [];
        this._dangXemPlaylistTen = detail.playlist_name || this._dangXemPlaylistTen;
        this._dangXemPlaylistId = String(detail.playlist_id);
    } else if (!this._playlistDetailVisibleId) {
        this._danhSachBaiHatTrongPlaylist = [];
        this._dangXemPlaylistId = null;
    }

    return searchChanged || playlistLibraryChanged || playlistDetailChanged || playlistEventChanged;
  },

  _xuLyFocusTimKiemMedia(changed, mediaChanged) {
    if (this._dangChoKetQuaTimKiem) {
      const cho = this._timKiemDangCho;
      const daCoKetQuaMoi = cho ? this._laKetQuaTimKiemMoi(this._thuocTinh().last_music_search || {}, cho.query, cho.source, cho.mocTruoc, cho.dauVetTruoc) : false;
      if (daCoKetQuaMoi) { this._pendingRender = false; this._veGiaoDienGiuFocusTimKiem(); } 
      else { this._pendingRender = true; }
      return true;
    }
    if (changed || mediaChanged) { 
       this._pendingRender = false; 
       this._veGiaoDienGiuFocusTimKiem(); 
       return true; 
    }
    return false;
  },

  // === CÁC HÀM UI & LOGIC MEDIA CHUNG ===
  _cuonToiBaiDangPhat() {
    if (this._activeTab !== "media") return;
    if (this._userIsScrolling) return; 
    
    const p = this._thongTinPhat?.();
    const currentTrackIdent = p?.track_id || p?.title;
    
    if (currentTrackIdent && this._lastScrolledTrackIdent !== currentTrackIdent) {
      this._lastScrolledTrackIdent = currentTrackIdent;
      setTimeout(() => {
        if (this._userIsScrolling) return; 
        const root = this.shadowRoot || this;
        if (!root) return;
        const container = root.querySelector('.results');
        const activeItem = container?.querySelector('.is-playing-item');
        if (container && activeItem) {
          container.scrollTo({ top: activeItem.offsetTop - 10, behavior: 'smooth' });
          setTimeout(() => { 
             if (!this._userIsScrolling) this._savedScrollPosition = container.scrollTop; 
          }, 500);
        }
      }, 300);
    }
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
    } else if (this._repeatMode === "all" || this._autoNextEnabled) {
      await this._goiDichVu("media_player", "media_next_track");
    }
  },

  _dongBoTienDoDom() {
    if (this._activeTab !== "media") return;
    const root = this.shadowRoot || this;
    if (!root) return;
    const positionEl = root.querySelector("#playback-position");
    const durationEl = root.querySelector("#playback-duration");
    const progressEl = root.querySelector("#playback-progress");
    const progressTrackEl = root.querySelector("#playback-progress-track");

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
    const playId = this._chuoiKhongRongDauTien(aiboxTrackId, play.id, play.video_id, play.song_id, play.track_id);

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

    const itemTitle = item.title || item.name || "Đang tải...";
    const itemArtist = item.artist || item.channel || item.singer || "Chưa rõ nghệ sĩ";
    const itemDuration = item.duration_seconds || item.duration || 0;
    
    this._nowPlayingCache = { trackKey: `${normalizedSource}|${itemTitle}|${itemArtist}|${itemDuration}`, trackId: resolvedId, title: itemTitle, artist: itemArtist, source: normalizedSource, thumbnail_url: item.thumbnail_url || item.thumbnail || "", duration: itemDuration };
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

  // === CÁC HÀM QUẢN LÝ PLAYLIST ===
  
  _mocCapNhatPayload(payload) {
    const raw = payload?.updated_at_ms ?? payload?.updatedAtMs ?? payload?.updated_at ?? payload?.updatedAt;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  },

  _khoaTrangThaiPayload(payload) {
    if (!payload) return "";
    let obj = payload;
    if (typeof payload === 'string') {
        try { obj = JSON.parse(payload); } catch(e) {}
    }
    return `${this._mocCapNhatPayload(obj)}|${typeof payload === 'string' ? payload : JSON.stringify(obj)}`;
  },

  async _choSuKienPlaylistMoi(previousKey, predicate, timeoutMs = 6000) {
    if (!this._hass || !this._config) return null;
    const startedAt = Date.now();
    let lastRefreshAt = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const event = this._parseJSONSafe(this._thuocTinh().last_playlist_event);
      const currentKey = this._khoaTrangThaiPayload(event);
      if (currentKey && currentKey !== previousKey && predicate(event)) {
        return event;
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed - lastRefreshAt >= 1200) {
        lastRefreshAt = elapsed;
        try { await this._hass.callService("homeassistant", "update_entity", { entity_id: this._config.entity }); } catch (_) {}
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return null;
  },

  async _choPayloadPlaylistMoi(previousKey, payloadFactory, timeoutMs = 4500) {
    if (!this._hass || !this._config) return null;
    const startedAt = Date.now();
    let lastRefreshAt = 0;
    while (Date.now() - startedAt < timeoutMs) {
      const payload = payloadFactory();
      const currentKey = this._khoaTrangThaiPayload(payload);
      if (currentKey && currentKey !== previousKey) {
        return payload;
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed - lastRefreshAt >= 1200) {
        lastRefreshAt = elapsed;
        try { await this._hass.callService("homeassistant", "update_entity", { entity_id: this._config.entity }); } catch (_) {}
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    return payloadFactory();
  },

  async _taiDanhSachPlaylist(reRender = true) {
    const previousKey = this._khoaTrangThaiPayload(this._thuocTinh().playlist_library);
    this._playlistLibraryLoading = true;
    if (reRender) this._veGiaoDien();
    try {
      await this._goiDichVu("media_player", "playlist_list", {});
      await this._choPayloadPlaylistMoi(previousKey, () => this._thuocTinh().playlist_library, 4500);
    } catch (e) {
      console.error("Lỗi _taiDanhSachPlaylist", e);
    } finally {
      this._playlistLibraryLoading = false;
      const libObj = this._parseJSONSafe(this._thuocTinh().playlist_library);
      this._danhSachPlaylist = Array.isArray(libObj.playlists) ? libObj.playlists : [];
      if (reRender) this._veGiaoDien();
    }
  },
  
  async _taiBaiHatTrongPlaylist(playlistId, playlistName, reRender = true) {
    const normalizedPlaylistId = String(playlistId || "").trim();
    if (!normalizedPlaylistId) return;
    this._playlistDetailVisibleId = normalizedPlaylistId;
    this._dangXemPlaylistTen = playlistName; 
    this._dangXemPlaylistId = normalizedPlaylistId;
    this._playlistDetailLoading = true;
    if (reRender) this._veGiaoDien();
    try {
      await this._goiDichVu("media_player", "playlist_get_songs", { playlist_id: normalizedPlaylistId });
      const previousKey = this._khoaTrangThaiPayload(this._thuocTinh().playlist_detail);
      await this._choPayloadPlaylistMoi(previousKey, () => this._thuocTinh().playlist_detail, 4500);
    } catch (e) {
      console.error("Lỗi _taiBaiHatTrongPlaylist", e);
    } finally {
      this._playlistDetailLoading = false;
      const detObj = this._parseJSONSafe(this._thuocTinh().playlist_detail);
      if (detObj && String(detObj.playlist_id) === String(normalizedPlaylistId)) {
          this._danhSachBaiHatTrongPlaylist = Array.isArray(detObj.items) ? detObj.items : [];
          this._dangXemPlaylistTen = detObj.playlist_name || this._dangXemPlaylistTen;
      }
      if (reRender) this._veGiaoDien();
    }
  },

  async _taoPlaylist(name) {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) throw new Error("Vui lòng nhập tên playlist");
    const previousKey = this._khoaTrangThaiPayload(this._thuocTinh().last_playlist_event);
    await this._goiDichVu("media_player", "playlist_create", { name: normalizedName });
    const event = await this._choSuKienPlaylistMoi(
      previousKey,
      (payload) => String(payload?.type || "").toLowerCase().includes("playlist_created"),
      6000
    );
    if (!event) throw new Error("Không nhận được xác nhận tạo playlist");
    return event;
  },

  async _xacNhanXoaPlaylist() {
    const playlistId = this._modalXoaPlaylist.id;
    this._modalXoaPlaylist = { show: false, id: null };
    this._playlistLibraryLoading = true;
    this._veGiaoDien();
    if (playlistId !== null && playlistId !== undefined) {
      try {
        await this._goiDichVu("media_player", "playlist_delete", { playlist_id: String(playlistId) });
        if (String(this._playlistDetailVisibleId) === String(playlistId)) {
            this._playlistDetailVisibleId = "";
            this._dangXemPlaylistId = null;
        }
        await this._taiDanhSachPlaylist(false);
      } catch (e) {
        console.error("Lỗi _xacNhanXoaPlaylist", e);
      } finally {
        this._playlistLibraryLoading = false;
        this._veGiaoDien();
      }
    }
  },

  async _phatPlaylist(playlistId) {
    try {
      await this._goiDichVu("media_player", "playlist_play", { playlist_id: String(playlistId) });
      await this._lamMoiEntity(300);
    } catch (e) {
      console.error("Lỗi _phatPlaylist", e);
    }
  },

  async _xoaBaiHatKhoiPlaylist(playlistId, songIndex) {
    this._playlistDetailLoading = true;
    this._veGiaoDien();
    try {
      await this._goiDichVu("media_player", "playlist_remove_song", { 
          playlist_id: String(playlistId), 
          song_index: Number(songIndex) 
      });
      await this._taiBaiHatTrongPlaylist(playlistId, this._dangXemPlaylistTen, false);
      await this._taiDanhSachPlaylist(false);
    } catch (e) {
      console.error("Lỗi _xoaBaiHatKhoiPlaylist", e);
    } finally {
      this._playlistDetailLoading = false;
      this._veGiaoDien();
    }
  },

  async _themVaoPlaylist(playlistId, song, source) {
    const sId = song?.id || song?.video_id || song?.song_id || song?.track_id || '';
    const sTitle = song?.title || song?.name || song?.song_name || '';
    const sArtist = song?.artist || song?.channel || song?.singer || '';
    const sThumb = song?.thumbnail_url || song?.thumbnail || '';
    const sDuration = Number(song?.duration_seconds || song?.duration || 0);
    const sSource = String(source || 'youtube');

    if (!sId) {
        console.error("Lỗi: Không tìm thấy ID bài hát hợp lệ để thêm vào playlist.");
        return;
    }
    
    const previousKey = this._khoaTrangThaiPayload(this._thuocTinh().last_playlist_event);
    try {
      // ĐÃ SỬA LỖI Ở ĐÂY: Xóa video_id và song_id do backend không cho phép
      await this._goiDichVu("media_player", "playlist_add_song", {
          playlist_id: String(playlistId),
          source: sSource,
          id: String(sId),
          title: String(sTitle),
          artist: String(sArtist),
          thumbnail_url: String(sThumb),
          duration_seconds: sDuration
      });
      const event = await this._choSuKienPlaylistMoi(
        previousKey,
        (payload) => String(payload?.type || "").toLowerCase().includes("playlist_song_added"),
        6000
      );
      if (!event) throw new Error("Không nhận được xác nhận thêm bài vào playlist");
      return event;
    } catch (e) {
      console.error("Lỗi _themVaoPlaylist", e);
      throw e;
    }
  },

  _veGiaoDienGiuFocusTimKiem() {
    const root = this.shadowRoot || this;
    const input = root?.querySelector("#media-query");
    const dangFocus = this._dangFocusTimKiem() && Boolean(input);
    const viTriBatDau = dangFocus ? input.selectionStart ?? input.value.length : 0;
    const viTriKetThuc = dangFocus ? input.selectionEnd ?? input.value.length : viTriBatDau;

    this._pendingRender = false;
    this._veGiaoDien();

    if (!dangFocus) return;
    const inputMoi = (this.shadowRoot || this)?.querySelector("#media-query");
    if (!inputMoi) return;
    inputMoi.focus({ preventScroll: true });
    inputMoi.setSelectionRange(Math.max(0, Math.min(inputMoi.value.length, Number(viTriBatDau))), Math.max(0, Math.min(inputMoi.value.length, Number(viTriKetThuc))));
  },

  _giuFocusTimKiemKhongRender() {
    if (!this._dangFocusTimKiem()) return;
    const input = (this.shadowRoot || this)?.querySelector("#media-query");
    if (!input) return;
    const viTriBatDau = input.selectionStart ?? input.value.length;
    const viTriKetThuc = input.selectionEnd ?? input.value.length;
    requestAnimationFrame(() => {
      const inputMoi = (this.shadowRoot || this)?.querySelector("#media-query");
      if (inputMoi) {
        inputMoi.focus({ preventScroll: true }); 
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

    const safePlaylists = Array.isArray(this._danhSachPlaylist) ? this._danhSachPlaylist : [];
    const safePlaylistSongs = Array.isArray(this._danhSachBaiHatTrongPlaylist) ? this._danhSachBaiHatTrongPlaylist : [];
    const safeItems = Array.isArray(playback.items) ? playback.items : [];

    let resultsHtml = '';
    
    if (this._mediaSearchTab === "playlists") {
        if (this._dangXemPlaylistId) {
            resultsHtml = `
              <div class="playlist-header">
                  <button type="button" id="btn-back-playlists" class="mini-btn"><ha-icon icon="mdi:arrow-left"></ha-icon> Quay lại</button>
                  <span class="playlist-title">Playlist: ${this._maHoaHtml(this._dangXemPlaylistTen)}</span>
              </div>
              ${this._playlistDetailLoading && safePlaylistSongs.length === 0 ? `<div class="empty">Đang tải chi tiết playlist...</div>` :
                safePlaylistSongs.length === 0 ? `<div class="empty">Playlist trống.</div>` : 
                safePlaylistSongs.map((itemObj, idx) => {
                  
                  let song = itemObj;
                  if (typeof song === 'string') {
                      try { song = JSON.parse(song); } catch(e){}
                  }
                  if (!song || typeof song !== 'object') song = {};

                  const sSource = (song.source || '').toLowerCase().includes('zing') ? 'zing' : 'youtube';
                  const sId = song.id || song.video_id || song.song_id || song.track_id || '';
                  const sTitle = song.title || song.name || song.song_name || 'Không rõ tên bài';
                  const sArtist = song.artist || song.channel || song.singer || song.author || 'Chưa rõ nghệ sĩ';
                  const sDuration = parseInt(song.duration_seconds || song.duration || song.time || 0, 10);
                  const sThumb = song.thumbnail_url || song.thumbnail || song.thumb || song.image || '';
                  const sIndex = song.index !== undefined ? song.index : idx;

                  return `
                  <div class="result-item playable" data-id="${this._maHoaHtml(sId)}" data-source="${this._maHoaHtml(sSource)}">
                      <div class="thumb-wrap">${sThumb ? `<img class="thumb" src="${this._maHoaHtml(sThumb)}" alt="" />` : `<div class="thumb fallback"><ha-icon icon="mdi:music-note"></ha-icon></div>`}</div>
                      <div class="result-meta">
                          <div class="result-title">${this._maHoaHtml(sTitle)}</div>
                          <div class="result-artist">${this._maHoaHtml(sArtist)}</div>
                          <div class="result-duration">${this._dinhDangThoiLuong(sDuration)} <span class="source-badge">${sSource.toUpperCase()}</span></div>
                      </div>
                      <div class="result-actions">
                          <button type="button" class="mini-btn mini-btn-danger play-btn" data-id="${this._maHoaHtml(sId)}" data-source="${this._maHoaHtml(sSource)}"><ha-icon icon="mdi:play"></ha-icon><span>Phát</span></button>
                          <button type="button" class="mini-btn delete-song-btn" data-playlist-id="${this._dangXemPlaylistId}" data-index="${Number(sIndex)}"><ha-icon icon="mdi:trash-can"></ha-icon></button>
                      </div>
                  </div>`;
                }).join("")}
            `;
        } else {
            resultsHtml = `
              <div class="playlist-header">
                  <button type="button" id="btn-show-create-playlist" class="btn-create-playlist"><ha-icon icon="mdi:plus"></ha-icon> Tạo playlist mới</button>
                  <button type="button" id="btn-refresh-playlists" class="mini-btn"><ha-icon icon="mdi:refresh"></ha-icon></button>
              </div>
              ${this._playlistLibraryLoading && safePlaylists.length === 0 ? `<div class="empty">Đang tải thư viện playlist...</div>` : 
                safePlaylists.length === 0 ? `<div class="empty">Chưa có playlist nào.</div>` : 
                safePlaylists.map((plObj) => {
                  let pl = plObj;
                  if (typeof pl === 'string') { try { pl = JSON.parse(pl); } catch(e){} }
                  
                  const count = pl?.song_count || pl?.count || pl?.items?.length || 0;
                  const plId = pl?.id || pl?.playlist_id || '';
                  const plName = this._maHoaHtml(pl?.name || pl?.playlist_name || 'Playlist không tên');
                  return `
                  <div class="playlist-item">
                      <div class="pl-meta">
                          <div class="pl-name">${plName}</div>
                          <div class="pl-count">${count} bài hát</div>
                      </div>
                      <div class="pl-actions">
                          <button type="button" class="mini-btn view-pl-btn" data-id="${plId}" data-name="${plName}"><ha-icon icon="mdi:format-list-bulleted"></ha-icon></button>
                          <button type="button" class="mini-btn mini-btn-accent play-pl-btn" data-id="${plId}"><ha-icon icon="mdi:play"></ha-icon></button>
                          <button type="button" class="mini-btn delete-pl-btn" data-id="${plId}"><ha-icon icon="mdi:trash-can"></ha-icon></button>
                      </div>
                  </div>`;
                }).join("")}
            `;
        }
    } else {
        resultsHtml = safeItems.length === 0 ? `<div class="empty">Chưa có kết quả tìm kiếm. Nhập từ khóa và bấm Tìm kiếm.</div>` : 
          safeItems.map((item, idx) => {
            const itemId = this._layIdMucMedia(item);
            const itemTitle = item?.title || item?.name || `Bản nhạc ${idx + 1}`;
            const itemArtist = item?.artist || item?.channel || item?.singer || "";
            const itemDuration = parseInt(item?.duration_seconds || item?.duration || 0, 10);
            const itemThumb = item?.thumbnail_url || item?.thumbnail || "";

            let isPlayingItem = false;
            if (!hasHighlightedCurrent) {
              if (String(playback.track_id).trim() && itemId && String(playback.track_id).trim() === itemId) { 
                 isPlayingItem = true; hasHighlightedCurrent = true; 
              } else if (String(playback.title).trim() && String(playback.title).trim().toLowerCase() !== "chưa có bài đang phát" && String(playback.title).trim().toLowerCase() === String(itemTitle).trim().toLowerCase()) { 
                 isPlayingItem = true; hasHighlightedCurrent = true; 
              }
            }
            
            const safeSongData = encodeURIComponent(JSON.stringify({
                id: itemId, video_id: itemId, song_id: itemId, 
                title: itemTitle, artist: itemArtist, 
                thumbnail_url: itemThumb, duration_seconds: itemDuration
            }));

            return `
            <div class="result-item ${itemId ? "playable" : ""} ${isPlayingItem ? "is-playing-item" : ""}" data-id="${this._maHoaHtml(itemId)}" data-source="${this._maHoaHtml(listSource)}">
              <div class="thumb-wrap">${itemThumb ? `<img class="thumb" src="${this._maHoaHtml(itemThumb)}" alt="" />` : `<div class="thumb fallback"><ha-icon icon="mdi:music-note"></ha-icon></div>`}</div>
              <div class="result-meta">
                <div class="result-title">${this._maHoaHtml(itemTitle)}</div>
                <div class="result-artist">${this._maHoaHtml(itemArtist || "Chưa rõ nghệ sĩ")}</div>
                <div class="result-duration">${this._dinhDangThoiLuong(itemDuration)}</div>
              </div>
              <div class="result-actions">
                <button type="button" class="mini-btn mini-btn-accent add-pl-btn" data-song="${safeSongData}" data-source="${this._maHoaHtml(listSource)}" title="Thêm vào Playlist"><ha-icon icon="mdi:plus"></ha-icon></button>
                <button type="button" class="mini-btn mini-btn-danger play-btn" data-id="${this._maHoaHtml(itemId)}" data-source="${this._maHoaHtml(listSource)}"><ha-icon icon="mdi:play"></ha-icon><span>Phát</span></button>
              </div>
            </div>`;
        }).join("");
    }

    return `
      <section class="panel panel-media">
        <style>
          .panel-media { padding: 0; overflow: hidden; position: relative; }
          .hero { position: relative; display: flex; flex-direction: column; border-bottom: 1px solid var(--line); overflow: hidden; background: #060e22; padding-bottom: 14px; }
          .hero-bg-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: saturate(1.1) brightness(0.65); transform: scale(1.05); pointer-events: none; }
          .hero-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6, 15, 36, 0.2) 0%, rgba(6, 15, 36, 0.8) 100%); pointer-events: none; }
          .hero-bg-text { position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%); font-size: 72px; font-weight: 900; color: rgba(255, 255, 255, 0.04); white-space: nowrap; pointer-events: none; z-index: 0; letter-spacing: -1px; }
          .hero-content { position: relative; z-index: 1; padding: 12px 14px 0; }
          .hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
          .hero-titles { flex: 1; min-width: 0; }
          .song-title { margin: 0; font-size: 16px; font-weight: 800; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5); }
          .song-sub { margin-top: 4px; color: #d3dffa; font-size: 12px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .hero-top-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
          .pill { display: inline-flex; align-items: center; justify-content: center; min-width: 80px; height: 30px; padding: 0 10px; border-radius: 9px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; background: rgba(7, 16, 40, 0.7); border: 1px solid rgba(255,255,255,0.2); color: #fff; backdrop-filter: blur(4px); flex-shrink: 0; }
          .hero-actions { display: flex; gap: 4px; align-items: center; margin-top: 4px; }
          .player-stage-new { margin-top: 14px; display: flex; align-items: center; }
          .cover-disc { width: 80px; height: 80px; flex: 0 0 80px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(255,255,255, 0.3); box-shadow: 0 6px 20px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 30% 25%, rgba(255,255,255, 0.1), rgba(0,0,0, 0.6)); }
          .cover-disc img { width: 100%; height: 100%; object-fit: cover; }
          .cover-disc ha-icon { color: #fff; --mdc-icon-size: 28px; }
          .hero.is-playing .cover-disc.spinning { animation: discSpin 8s linear infinite; }
          .hero-bottom { position: relative; width: 100%; z-index: 1; margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
          .controls-overlay { display: flex; align-items: center; justify-content: center; gap: 28px; padding: 0; background: transparent; border: none; box-shadow: none; backdrop-filter: none; }
          .icon-btn-transparent { background: transparent; border: none; color: rgba(255,255,255,0.7); cursor: pointer; padding: 8px; border-radius: 50%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; display: inline-flex; align-items: center; justify-content: center; }
          .icon-btn-transparent:hover { color: #fff; transform: scale(1.3) translateY(-2px); filter: drop-shadow(0 4px 10px rgba(255, 255, 255, 0.6)); }
          .btn-large ha-icon { --mdc-icon-size: 46px; }
          .icon-btn-transparent ha-icon { --mdc-icon-size: 28px; }
          
          .waveform-full { height: 75px; display: flex; align-items: flex-end; justify-content: center; gap: 4px; overflow: visible !important; padding: 0 14px; margin-top: -15px; }
          .wave-bar { flex: 1; max-width: 6px; height: var(--h); border-radius: 4px; background: var(--accent); transform-origin: bottom; opacity: 0.6; box-shadow: 0 0 6px var(--accent); }
          .hero.is-playing.wave-effect-0 .wave-bar { animation: waveDance calc(300ms + (var(--i) * 12ms)) ease-in-out infinite alternate; opacity: 1; }
          .hero.is-playing.wave-effect-1 .wave-bar { animation: wavePulse calc(250ms + (var(--i) * 10ms)) cubic-bezier(0.4, 0, 0.2, 1) infinite alternate; opacity: 1; }
          .hero.is-playing.wave-effect-2 .wave-bar { animation: waveSweep 0.5s cubic-bezier(0.4, 0, 0.2, 1) infinite; animation-delay: calc(var(--i) * 0.03s); opacity: 1; }
          @keyframes waveDance { 0% { transform: scaleY(0.2); } 100% { transform: scaleY(1.3); } }
          @keyframes wavePulse { 0% { transform: scaleY(0.1); filter: hue-rotate(45deg); box-shadow: 0 0 10px var(--accent); } 100% { transform: scaleY(1.2); filter: hue-rotate(0deg); box-shadow: 0 0 10px var(--accent); } }
          @keyframes waveSweep { 0%, 100% { transform: scaleY(0.15); } 50% { transform: scaleY(1.4); } }
          @keyframes discSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          
          .progress-row { display: flex; align-items: center; gap: 10px; padding: 4px 0 12px; }
          .time-text { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7); width: 55px; }
          #playback-position { text-align: left; }
          #playback-duration { text-align: right; }
          .progress-track-new { flex: 1; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; cursor: pointer; position: relative; }
          .progress-fill-new { height: 100%; background: var(--accent); border-radius: 2px; box-shadow: 0 0 8px var(--accent); pointer-events: none;}
          .icon-btn-primary { background: var(--accent); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
          .icon-btn-primary:hover { filter: brightness(1.15); }
          .modern-volume-container { display: flex; align-items: center; gap: 10px; padding: 16px 14px 4px; }
          .vol-side { display: flex; align-items: center; gap: 6px; width: 55px; }
          .vol-side-left { justify-content: flex-start; }
          .vol-side-right { justify-content: flex-end; }
          .vol-side ha-icon { color: var(--muted); --mdc-icon-size: 18px; transition: color 0.2s; }
          .vol-side ha-icon#btn-mute-toggle.is-muted { color: #ef4444; }
          .vol-side ha-icon#btn-mute-toggle:hover { color: var(--text); }
          .vol-btn { background: transparent; border: 1px solid var(--line); border-radius: 6px; color: var(--muted); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; transition: all 0.2s; }
          .vol-btn:hover { background: var(--line); color: var(--text); transform: scale(1.1); }
          .vol-btn ha-icon { --mdc-icon-size: 16px; margin: 0; }
          .modern-volume-track-wrap { position: relative; flex: 1; height: 6px; display: flex; align-items: center; }
          .modern-volume-slider { position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer; z-index: 2; margin: 0; }
          .modern-volume-fill { position: absolute; height: 4px; background: var(--accent); border-radius: 2px; z-index: 1; pointer-events: none; }
          .modern-volume-track-wrap::before { content: ''; position: absolute; width: 100%; height: 4px; background: var(--line); border-radius: 2px; }
          .modern-volume-text { color: var(--muted); font-size: 11px; font-weight: 700; width: 25px; text-align: right; }
          .subtabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 12px 10px 6px; }
          .subtab { border: 1px solid var(--line); border-radius: 10px; padding: 8px 6px; background: var(--bg-tile); color: var(--muted); font-weight: 600; font-size: 12px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; transition: all 0.2s; }
          .subtab:hover { background: var(--line); color: var(--text); transform: translateY(-1px); }
          .subtab.active { background: var(--accent); color: #fff; border-color: transparent; }
          .search-row { display: flex; gap: 10px; padding: 8px 10px; }
          .search-row.hidden { display: none; }
          .search-row .icon-btn { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 12px; border: 0; color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
          .search-row .icon-btn ha-icon { --mdc-icon-size: 20px; }
          .text-input { flex: 1; min-width: 0; height: 40px; border-radius: 12px; border: 1px solid var(--line); background: var(--input-bg); color: var(--text); padding: 8px 12px; font-size: 14px; outline: none; transition: border-color 0.3s, box-shadow 0.3s, background 0.3s; }
          .text-input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px var(--line); }
          
          .results { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 10px; padding: 0 10px 12px; max-height: 380px; overflow: auto; overflow-x: hidden; scroll-behavior: smooth; }
          .empty { border: 1px dashed var(--line); border-radius: 12px; padding: 14px; color: var(--muted); text-align: center; font-size: 13px; grid-column: 1 / -1; }
          .result-item { display: grid; grid-template-columns: 50px minmax(0, 1fr) auto; gap: 10px; align-items: center; border: 1px solid var(--line); border-radius: 14px; padding: 8px 10px; background: var(--bg-tile); width: 100%; box-sizing: border-box; min-height: 66px; }
          .result-meta { grid-column: 2; min-width: 0; max-width: 100%; overflow: hidden; }
          .result-item.playable { cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
          .result-item.playable:hover, .result-item.is-playing-item { border-color: var(--accent); background: var(--line); transform: translateY(-2px); }
          .result-item.is-playing-item { border-width: 2px; }
          .result-item.is-playing-item .result-title { color: var(--accent); }
          .result-item.playable:active { transform: translateY(0); }
          .thumb-wrap { width: 50px; height: 50px; border-radius: 10px; overflow: hidden; background: var(--line); }
          .thumb { width: 50px; height: 50px; object-fit: cover; display: block; }
          .thumb.fallback { display: flex; align-items: center; justify-content: center; color: var(--muted); }
          .result-title { display: -webkit-box; width: 100%; max-width: 100%; font-size: 12.5px; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
          .result-artist { margin-top: 2px; font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .result-duration { margin-top: 1px; font-size: 13px; font-weight: 600; color: var(--muted); }
          .result-actions { grid-column: 3; grid-row: 1; display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-shrink: 0; }
          .result-actions ha-icon { --mdc-icon-size: 16px; }
          
          .playlist-header { display: flex; justify-content: space-between; align-items: center; grid-column: 1 / -1; margin-bottom: 5px; }
          .btn-create-playlist { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background: var(--accent); color: #fff; padding: 10px; border-radius: 10px; border: none; font-weight: bold; cursor: pointer; margin-right: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
          .btn-create-playlist:hover { filter: brightness(1.1); }
          .playlist-item { display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--line); border-radius: 12px; padding: 12px; background: var(--bg-tile); grid-column: 1 / -1; }
          .pl-name { font-weight: bold; font-size: 14px; color: var(--text); }
          .pl-count { font-size: 11px; color: var(--muted); margin-top: 4px; }
          .pl-actions { display: flex; gap: 6px; }
          .source-badge { display: inline-block; background: rgba(96, 165, 250, 0.2); color: #60a5fa; font-size: 9px; padding: 2px 4px; border-radius: 4px; margin-left: 5px; vertical-align: middle; }
          .playlist-title { font-weight: bold; color: var(--text); font-size: 14px; }

          .modal-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 100; display: none; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; border-radius: inherit; }
          .modal-overlay.active { display: flex; opacity: 1; }
          .modal-card { background: #0f172a; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 20px; width: 90%; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-height: 90%; overflow-y: auto; }
          .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
          .modal-title { font-size: 16px; font-weight: bold; color: #fff; margin: 0; }
          .modal-close { background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 4px; border-radius: 50%; }
          .modal-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
          .modal-field { margin-bottom: 16px; }
          .modal-label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }
          .modal-select, .modal-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 10px; font-size: 14px; outline: none; }
          .modal-select:focus, .modal-input:focus { border-color: var(--accent); }
          .modal-song-info { background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 16px; }
          .modal-song-title { font-weight: bold; font-size: 14px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .modal-actions { display: flex; gap: 10px; margin-top: 20px; }
          .modal-btn { flex: 1; padding: 10px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; transition: all 0.2s; }
          .modal-btn-cancel { background: rgba(255,255,255,0.1); color: #fff; }
          .modal-btn-cancel:hover { background: rgba(255,255,255,0.2); }
          .modal-btn-submit { background: var(--accent); color: #fff; }
          .modal-btn-submit:hover { filter: brightness(1.1); }
          .modal-btn-danger { background: #ef4444; color: #fff; }
          .modal-btn-danger:hover { filter: brightness(1.1); }
          .modal-btn:disabled { opacity: 0.5; cursor: not-allowed; }

          @media (max-width: 450px) {
            .cover-disc { width: 60px; height: 60px; flex: 0 0 60px; border-width: 1px; }
            .subtabs { grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 8px 8px 4px; }
            .search-row { padding: 6px 8px; gap: 8px; }
            .result-item { grid-template-columns: 44px minmax(0, 1fr) auto; padding: 6px 8px; gap: 8px; }
            .thumb, .thumb-wrap { width: 44px; height: 44px; }
            .result-title { font-size: 12px; }
          }
        </style>

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
                   <button type="button" id="btn-repeat" class="icon-btn-transparent hover-scale" title="Chế độ lặp lại" style="color: ${this._repeatMode === "off" ? "rgba(255,255,255,0.4)" : (this._repeatMode === "one" ? "#34d399" : "#fff")}"><ha-icon icon="${repeatIcon}"></ha-icon></button>
                   <button type="button" id="btn-autonext" class="icon-btn-transparent hover-scale" title="Tự động phát tiếp" style="color: ${this._autoNextEnabled ? '#60a5fa' : 'rgba(255,255,255,0.4)'}"><ha-icon icon="mdi:shuffle"></ha-icon></button>
                   <button type="button" id="btn-wave-toggle" class="icon-btn-transparent hover-scale" title="Đổi kiểu sóng âm"><ha-icon icon="mdi:waveform"></ha-icon></button>
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
                <button type="button" id="btn-prev" class="icon-btn-transparent hover-scale"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
                <button type="button" id="btn-playpause" class="icon-btn-transparent btn-large hover-scale"><ha-icon icon="${isPlaying ? 'mdi:pause' : 'mdi:play'}"></ha-icon></button>
                <button type="button" id="btn-stop" class="icon-btn-transparent hover-scale"><ha-icon icon="mdi:stop"></ha-icon></button>
                <button type="button" id="btn-next" class="icon-btn-transparent hover-scale"><ha-icon icon="mdi:skip-next"></ha-icon></button>
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
            <button type="button" id="btn-vol-down" class="vol-btn"><ha-icon icon="mdi:minus"></ha-icon></button>
          </div>
          <div class="modern-volume-track-wrap">
            <input id="media-volume" class="modern-volume-slider" type="range" min="0" max="100" step="1" value="${volumePercent}" />
            <div class="modern-volume-fill" style="width: ${volumePercent}%"></div>
          </div>
          <div class="vol-side vol-side-right">
            <button type="button" id="btn-vol-up" class="vol-btn"><ha-icon icon="mdi:plus"></ha-icon></button>
            <span class="modern-volume-text">${volumePercent}%</span>
          </div>
        </div>

        <div class="subtabs">
          <button type="button" class="subtab ${this._mediaSearchTab === "songs" ? "active" : ""}" data-media-tab="songs">Songs</button>
          <button type="button" class="subtab ${this._mediaSearchTab === "playlist" ? "active" : ""}" data-media-tab="playlist">Playlist</button>
          <button type="button" class="subtab ${this._mediaSearchTab === "zing" ? "active" : ""}" data-media-tab="zing">Zing MP3</button>
          <button type="button" class="subtab ${this._mediaSearchTab === "playlists" ? "active" : ""}" data-media-tab="playlists"><ha-icon icon="mdi:format-list-bulleted" style="--mdc-icon-size: 14px; margin-right: 2px;"></ha-icon>Playlists</button>
        </div>

        <div class="search-row ${this._mediaSearchTab === "playlists" ? "hidden" : ""}">
          <input id="media-query" class="text-input" type="text" placeholder="${this._mediaSearchTab === 'playlist' ? 'Tìm playlist...' : 'Tìm bài hát...'}" value="${this._maHoaHtml(this._query)}" />
          <button type="button" id="btn-search" class="icon-btn icon-btn-primary search-btn-hover"><ha-icon icon="mdi:magnify"></ha-icon></button>
        </div>

        <div class="results">
          ${resultsHtml}
        </div>

        <div class="modal-overlay ${this._modalThemVaoPlaylist.show ? 'active' : ''}" id="modal-add-to-playlist">
            <div class="modal-card">
                <div class="modal-header">
                    <h3 class="modal-title">Thêm vào Playlist</h3>
                    <button type="button" class="modal-close" id="btn-close-add-modal"><ha-icon icon="mdi:close"></ha-icon></button>
                </div>
                <div class="modal-song-info">
                    <div class="modal-label">Bài hát:</div>
                    <div class="modal-song-title">${this._maHoaHtml(this._modalThemVaoPlaylist.song?.title || '--')}</div>
                </div>
                <div class="modal-field">
                    <label class="modal-label">Chọn playlist có sẵn</label>
                    <select id="select-playlist" class="modal-select">
                        <option value="">-- Chọn playlist --</option>
                        ${safePlaylists.map(pl => `<option value="${pl?.id || pl?.playlist_id || ''}">${this._maHoaHtml(pl?.name || pl?.playlist_name || 'Playlist')}</option>`).join('')}
                    </select>
                </div>
                <div class="modal-field" style="text-align: center; color: var(--muted); font-size: 12px;">hoặc</div>
                <div class="modal-field">
                    <label class="modal-label">Tạo playlist mới</label>
                    <input type="text" id="input-new-playlist-add" class="modal-input" placeholder="Tên playlist mới..." />
                </div>
                <div class="modal-actions">
                    <button type="button" class="modal-btn modal-btn-cancel" id="btn-cancel-add-modal">Hủy</button>
                    <button type="button" class="modal-btn modal-btn-submit" id="btn-submit-add-modal">Thêm</button>
                </div>
            </div>
        </div>

        <div class="modal-overlay ${this._modalTaoPlaylist.show ? 'active' : ''}" id="modal-create-playlist">
            <div class="modal-card">
                <div class="modal-header">
                    <h3 class="modal-title">Tạo Playlist mới</h3>
                    <button type="button" class="modal-close" id="btn-close-create-modal"><ha-icon icon="mdi:close"></ha-icon></button>
                </div>
                <div class="modal-field">
                    <label class="modal-label">Tên playlist</label>
                    <input type="text" id="input-create-playlist" class="modal-input" placeholder="Nhập tên playlist..." />
                </div>
                <div class="modal-actions">
                    <button type="button" class="modal-btn modal-btn-cancel" id="btn-cancel-create-modal">Hủy</button>
                    <button type="button" class="modal-btn modal-btn-submit" id="btn-submit-create-modal">Tạo</button>
                </div>
            </div>
        </div>

        <div class="modal-overlay ${this._modalXoaPlaylist.show ? 'active' : ''}" id="modal-delete-playlist">
            <div class="modal-card">
                <div class="modal-header">
                    <h3 class="modal-title">Xóa Playlist</h3>
                    <button type="button" class="modal-close" id="btn-close-delete-modal"><ha-icon icon="mdi:close"></ha-icon></button>
                </div>
                <div class="modal-field">
                    <p style="color: #fff; font-size: 14px; text-align: center; margin: 10px 0;">Bạn có chắc chắn muốn xóa playlist này?</p>
                </div>
                <div class="modal-actions">
                    <button type="button" class="modal-btn modal-btn-cancel" id="btn-cancel-delete-modal">Hủy</button>
                    <button type="button" class="modal-btn modal-btn-danger" id="btn-submit-delete-modal">Xóa</button>
                </div>
            </div>
        </div>

      </section>
    `;
  },

  _ganSuKienTabMedia(root) {
    const resultsContainer = root.querySelector('.results');
    if (resultsContainer) {
        if (this._savedScrollPosition > 0) {
            resultsContainer.scrollTop = this._savedScrollPosition;
        }

        let scrollTimeout;
        const lockRender = () => {
            this._userIsScrolling = true; 
            this._pendingRender = true;
        };
        const unlockRender = () => {
            this._userIsScrolling = false; 
            if (this._pendingRender) {
                this._xuLyRenderCho?.();
            }
        };

        resultsContainer.addEventListener('scroll', () => {
            this._savedScrollPosition = resultsContainer.scrollTop;
            lockRender();
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(unlockRender, 1200); 
        }, { passive: true });

        resultsContainer.addEventListener('touchstart', lockRender, { passive: true });
        resultsContainer.addEventListener('touchend', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(unlockRender, 1200);
        }, { passive: true });

        resultsContainer.addEventListener('mousedown', lockRender, { passive: true });
        resultsContainer.addEventListener('mouseup', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(unlockRender, 1200);
        }, { passive: true });
        
        resultsContainer.addEventListener('mouseleave', () => {
            if (this._userIsScrolling) {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(unlockRender, 1200);
            }
        });
    }

    root.querySelectorAll("[data-media-tab]").forEach((el) => {
      el.addEventListener("click", async (ev) => { 
          ev.preventDefault(); ev.stopPropagation();
          this._savedScrollPosition = 0; 
          this._mediaSearchTab = el.dataset.mediaTab || "songs"; 
          if(this._mediaSearchTab === "playlists") {
              await this._taiDanhSachPlaylist();
          } else {
              this._dangXemPlaylistId = null;
          }
          this._veGiaoDien(); 
      });
    });

    root.querySelector("#btn-repeat")?.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._repeatMode = this._repeatMode === "all" ? "one" : (this._repeatMode === "one" ? "off" : "all");
      this._veGiaoDien();
    });

    root.querySelector("#btn-autonext")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._autoNextEnabled = !this._autoNextEnabled;
      this._veGiaoDien();
      try { await this._goiDichVu("media_player", "toggle_auto_next", {}); } catch(e){}
    });

    root.querySelector("#btn-wave-toggle")?.addEventListener("click", (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._waveEffect = (this._waveEffect + 1) % 3;
      this._veGiaoDien();
    });

    const mediaQuery = root.querySelector("#media-query");
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
      mediaQuery.addEventListener("blur", () => { this._mediaQueryFocused = false; setTimeout(() => this._xuLyRenderCho?.(), 0); });
    }

    const btnSearch = root.querySelector("#btn-search");
    if (btnSearch) {
      btnSearch.addEventListener("mousedown", (ev) => ev.preventDefault());
      btnSearch.addEventListener("click", async (ev) => {
          ev.preventDefault(); ev.stopPropagation();
          await this._xuLyTimKiem(mediaQuery ? mediaQuery.value : this._query);
      });
    }

    const progressTrack = root.querySelector("#playback-progress-track");
    if (progressTrack) {
      const seekToClientX = async (clientX) => {
        const duration = this._liveDurationSeconds > 0 ? this._liveDurationSeconds : this._epKieuGiayPhat(this._thongTinPhat().duration, 0);
        if (duration <= 0) return;
        const rect = progressTrack.getBoundingClientRect(); if (!rect.width) return;
        const target = Math.floor(duration * Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
        this._livePositionSeconds = target; this._liveDurationSeconds = duration; this._liveTickAt = Date.now();
        this._dongBoTienDoDom(); 
        try { await this._goiDichVu("media_player", "seek", { position: target }); await this._lamMoiEntity(180); } catch(e){}
      };
      progressTrack.addEventListener("click", async (ev) => { ev.preventDefault(); ev.stopPropagation(); await seekToClientX(ev.clientX); });
      progressTrack.addEventListener("touchend", async (ev) => {
        const touch = ev.changedTouches?.[0]; if (touch) { ev.preventDefault(); ev.stopPropagation(); await seekToClientX(touch.clientX); }
      }, { passive: false });
    }

    root.querySelector("#btn-prev")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._livePositionSeconds = 0; this._ignorePositionUntil = Date.now() + 4000; this._lastPlayPauseSent = "play"; this._forcePauseUntil = 0; this._optimisticPlayUntil = Date.now() + 5000;
      this._optimisticTrackUntil = 0; this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
      this._livePlaying = true; this._dongBoTienDoDom(); this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "media_previous_track"); await this._lamMoiEntity(300, 2); } catch(e){}
    });

    root.querySelector("#btn-playpause")?.addEventListener("click", async (ev) => { ev.preventDefault(); ev.stopPropagation(); await this._xuLyPhatTamDung(); });

    root.querySelector("#btn-stop")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._forcePauseUntil = Date.now() + 5000; this._optimisticPlayUntil = 0; this._liveTrackKey = ""; this._livePositionSeconds = 0; this._ignorePositionUntil = Date.now() + 4000;
      this._liveDurationSeconds = 0; this._livePlaying = false; this._optimisticTrackUntil = 0; this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
      this._lastPlayPauseSent = "pause"; this._dongBoTienDoDom(); this._capNhatHenGioTienDo(); this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "media_stop"); } catch (e) { await this._goiDichVu("media_player", "media_pause"); }
      await this._lamMoiEntity(300);
    });

    root.querySelector("#btn-next")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._livePositionSeconds = 0; this._ignorePositionUntil = Date.now() + 4000; this._lastPlayPauseSent = "play"; this._forcePauseUntil = 0; this._optimisticPlayUntil = Date.now() + 5000;
      this._optimisticTrackUntil = 0; this._nowPlayingCache = { trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0 };
      this._livePlaying = true; this._dongBoTienDoDom(); this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "media_next_track"); await this._lamMoiEntity(300, 2); } catch(e){}
    });

    root.querySelector("#btn-mute-toggle")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._lastVolumeChangeAt = Date.now();
      if (this._volumeLevel > 0) { this._preMuteVolumeLevel = this._volumeLevel; this._volumeLevel = 0; }
      else { this._volumeLevel = this._preMuteVolumeLevel || 0.5; this._preMuteVolumeLevel = null; }
      this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "volume_set", { volume_level: this._volumeLevel }); } catch(e){}
    });

    const volumeSlider = root.querySelector("#media-volume");
    if (volumeSlider) {
      volumeSlider.addEventListener("input", (ev) => { 
        this._lastVolumeChangeAt = Date.now();
        this._volumeLevel = Number(ev.target.value) / 100; 
        if (this._volumeLevel > 0) this._preMuteVolumeLevel = null; 
        
        const text = root.querySelector(".modern-volume-text");
        if(text) text.innerText = `${ev.target.value}%`;
      });
      volumeSlider.addEventListener("change", async (ev) => { 
        this._lastVolumeChangeAt = Date.now() + 500;
        this._volumeLevel = Number(ev.target.value) / 100; 
        if (this._volumeLevel > 0) this._preMuteVolumeLevel = null; 
        this._veGiaoDien(); 
        try { await this._goiDichVu("media_player", "volume_set", { volume_level: this._volumeLevel }); } catch(e){}
      });
    }

    root.querySelector("#btn-vol-down")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._lastVolumeChangeAt = Date.now() + 500;
      this._volumeLevel = Math.max(0, Math.round(this._volumeLevel * 100) - 5) / 100; if (this._volumeLevel > 0) this._preMuteVolumeLevel = null;
      this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "volume_set", { volume_level: this._volumeLevel }); } catch(e){}
    });

    root.querySelector("#btn-vol-up")?.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      this._lastVolumeChangeAt = Date.now() + 500;
      this._volumeLevel = Math.min(100, Math.round(this._volumeLevel * 100) + 5) / 100; if (this._volumeLevel > 0) this._preMuteVolumeLevel = null;
      this._veGiaoDien(); 
      try { await this._goiDichVu("media_player", "volume_set", { volume_level: this._volumeLevel }); } catch(e){}
    });

    const playFromDataset = async (dataset) => { if (dataset?.id) await this._xuLyPhatMuc({ id: dataset.id }, dataset.source || ""); };

    root.querySelectorAll(".play-btn").forEach(el => el.addEventListener("click", async (ev) => { ev.preventDefault(); ev.stopPropagation(); await playFromDataset(el.dataset); }));
    
    root.querySelectorAll(".add-pl-btn").forEach(el => el.addEventListener("click", async (ev) => {
      ev.preventDefault(); ev.stopPropagation(); 
      try {
          const songData = JSON.parse(decodeURIComponent(el.dataset.song));
          const source = el.dataset.source;
          
          this._modalThemVaoPlaylist = { show: true, song: songData, source: source };
          await this._taiDanhSachPlaylist(false);
          this._veGiaoDien();
      } catch (e) {
          console.error("Lỗi khi mở modal thêm bài hát:", e);
      }
    }));

    root.querySelectorAll(".result-item.playable").forEach(el => {
      el.addEventListener("click", async (ev) => { if (!ev.target.closest(".play-btn") && !ev.target.closest(".add-pl-btn") && !ev.target.closest(".delete-song-btn")) { ev.preventDefault(); await playFromDataset(el.dataset); }});
      el.addEventListener("keydown", async (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); await playFromDataset(el.dataset); } });
    });

    root.querySelectorAll(".view-pl-btn").forEach(el => el.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this._savedScrollPosition = 0; 
        await this._taiBaiHatTrongPlaylist(el.dataset.id, el.dataset.name);
    }));
    
    root.querySelectorAll(".play-pl-btn").forEach(el => el.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        await this._phatPlaylist(el.dataset.id);
    }));
    
    root.querySelectorAll(".delete-pl-btn").forEach(el => el.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this._modalXoaPlaylist = { show: true, id: el.dataset.id };
        this._veGiaoDien();
    }));
    
    root.querySelectorAll(".delete-song-btn").forEach(el => el.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        await this._xoaBaiHatKhoiPlaylist(el.dataset.playlistId, el.dataset.index);
    }));
    
    root.querySelector("#btn-back-playlists")?.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this._savedScrollPosition = 0; 
        this._dangXemPlaylistId = null;
        this._playlistDetailVisibleId = "";
        this._veGiaoDien();
    });
    
    root.querySelector("#btn-refresh-playlists")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        await this._taiDanhSachPlaylist();
    });
    
    root.querySelector("#btn-show-create-playlist")?.addEventListener("click", (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this._modalTaoPlaylist.show = true;
        this._veGiaoDien();
        setTimeout(() => {
            const rootNode = this.shadowRoot || this;
            rootNode.querySelector('#input-create-playlist')?.focus({ preventScroll: true }); 
        }, 100);
    });

    const closeCreateModal = (ev) => {
        if(ev) { ev.preventDefault(); ev.stopPropagation(); }
        this._modalTaoPlaylist.show = false; 
        this._veGiaoDien(); 
    };
    root.querySelector("#btn-close-create-modal")?.addEventListener("click", closeCreateModal);
    root.querySelector("#btn-cancel-create-modal")?.addEventListener("click", closeCreateModal);
    
    root.querySelector("#btn-submit-create-modal")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const input = root.querySelector("#input-create-playlist");
        if (input && input.value.trim()) {
            const btnSubmit = root.querySelector("#btn-submit-create-modal");
            btnSubmit.innerText = "Đang tạo...";
            btnSubmit.disabled = true;
            try {
                await this._taoPlaylist(input.value.trim());
                await this._taiDanhSachPlaylist(false);
            } catch (err) {
                console.error("Lỗi tạo playlist:", err);
            } finally {
                btnSubmit.innerText = "Tạo";
                btnSubmit.disabled = false;
                this._modalTaoPlaylist.show = false;
                this._veGiaoDien();
            }
        }
    });

    const closeAddModal = (ev) => {
        if(ev) { ev.preventDefault(); ev.stopPropagation(); } 
        this._modalThemVaoPlaylist.show = false; 
        this._veGiaoDien(); 
    };
    root.querySelector("#btn-close-add-modal")?.addEventListener("click", closeAddModal);
    root.querySelector("#btn-cancel-add-modal")?.addEventListener("click", closeAddModal);
    
    root.querySelector("#btn-submit-add-modal")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const select = root.querySelector("#select-playlist");
        const inputNew = root.querySelector("#input-new-playlist-add");
        const song = this._modalThemVaoPlaylist.song;
        const source = this._modalThemVaoPlaylist.source;
        
        const newName = inputNew?.value.trim();
        let targetPlaylistId = select?.value;

        const btnSubmit = root.querySelector("#btn-submit-add-modal");
        const originalText = btnSubmit.innerText;
        btnSubmit.innerText = "Đang xử lý...";
        btnSubmit.disabled = true;

        try {
            if (newName) {
                const event = await this._taoPlaylist(newName);
                targetPlaylistId = event?.playlist_id;
                
                if (!targetPlaylistId) {
                    await this._taiDanhSachPlaylist(false);
                    const matched = this._danhSachPlaylist.find(p => p.name === newName || p.playlist_name === newName);
                    targetPlaylistId = matched?.id || matched?.playlist_id;
                }
                
                if (!targetPlaylistId) {
                    throw new Error("Không thể xác định ID playlist vừa tạo.");
                }
            }

            if (targetPlaylistId) {
                await this._themVaoPlaylist(targetPlaylistId, song, source);
                if (String(this._dangXemPlaylistId) === String(targetPlaylistId)) {
                    await this._taiBaiHatTrongPlaylist(targetPlaylistId, this._dangXemPlaylistTen, false);
                }
            }
        } catch (err) {
            console.error("Lỗi khi thêm bài hát vào playlist:", err);
        } finally {
            btnSubmit.innerText = originalText;
            btnSubmit.disabled = false;
            this._modalThemVaoPlaylist.show = false;
            this._veGiaoDien();
        }
    });

    const closeDeleteModal = (ev) => {
        if(ev) { ev.preventDefault(); ev.stopPropagation(); } 
        this._modalXoaPlaylist.show = false; 
        this._veGiaoDien(); 
    };
    root.querySelector("#btn-close-delete-modal")?.addEventListener("click", closeDeleteModal);
    root.querySelector("#btn-cancel-delete-modal")?.addEventListener("click", closeDeleteModal);
    
    root.querySelector("#btn-submit-delete-modal")?.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        const btnSubmit = root.querySelector("#btn-submit-delete-modal");
        btnSubmit.innerText = "Đang xóa...";
        btnSubmit.disabled = true;
        try {
            await this._xacNhanXoaPlaylist();
        } finally {
            btnSubmit.innerText = "Xóa";
            btnSubmit.disabled = false;
        }
    });

    this._cuonToiBaiDangPhat();
  }
};