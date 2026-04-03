import { CHAT_ENABLED_STATES, CHAT_DISABLED_STATES, EQ_BAND_LABELS } from './constants.js';

export const UIRenderMixin = {
  _veCotSong() {
    const seeds = [18, 36, 14, 48, 26, 40, 22, 52, 30, 44, 20, 38, 50, 10, 25, 45, 15, 35, 42, 28, 55, 32];
    return Array.from({ length: 50 }, (_, idx) => {
      const h = seeds[idx % seeds.length];
      return `<span class="wave-bar" style="--i:${idx};--h:${h}px"></span>`;
    }).join("");
  },

  _veTabMedia(stateObj) {
    const playback = this._thongTinPhat();
    const playbackState = this._layTrangThaiHienThiPhat(playback, stateObj);
    const isPlaying = playbackState.isPlaying;
    const currentState = playbackState.currentState;
    const source = currentState === "idle" && this._laTieuDeNghi(playback.title) ? "CHỜ PHÁT" : this._nhanNguon(playback.source);
    const volumePercent = Math.round(this._volumeLevel * 100);
    const listSource = playback.search?.source || playback.play?.source || "youtube";
    const positionSeconds = this._epKieuGiayPhat(playback.position, 0);
    const durationSeconds = this._epKieuGiayPhat(playback.duration, 0);

    this._dongBoTienDoTrucTiep(playback.track_key || "", positionSeconds, durationSeconds, isPlaying);
    const livePositionSeconds = this._livePositionSeconds;
    const liveDurationSeconds = this._liveDurationSeconds > 0 ? this._liveDurationSeconds : durationSeconds;

    const progressPercent = liveDurationSeconds > 0 ? Math.max(0, Math.min(100, (livePositionSeconds / liveDurationSeconds) * 100)) : 0;
    const positionLabel = this._dinhDangDongHo(livePositionSeconds, "0:00");
    const durationLabel = liveDurationSeconds > 0 ? this._dinhDangThoiLuong(liveDurationSeconds) : "--:--";
    const coverUrl = this._maHoaHtml(playback.thumbnail_url || "");
    const waveBars = this._veCotSong();

    const repeatIcon = this._repeatMode === "one" ? "mdi:repeat-once" : (this._repeatMode === "all" ? "mdi:repeat" : "mdi:repeat-off");
    const repeatColor = this._repeatMode === "off" ? "rgba(255,255,255,0.4)" : "#fff";

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
                   <button id="btn-repeat" class="icon-btn-transparent hover-scale" title="Chế độ lặp lại" style="color: ${repeatColor}">
                      <ha-icon icon="${repeatIcon}"></ha-icon>
                   </button>
                   <button id="btn-wave-toggle" class="icon-btn-transparent hover-scale" title="Đổi kiểu sóng âm">
                      <ha-icon icon="mdi:waveform"></ha-icon>
                   </button>
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
                <button id="btn-prev" class="icon-btn-transparent hover-scale" title="Bài trước"><ha-icon icon="mdi:skip-previous"></ha-icon></button>
                <button id="btn-playpause" class="icon-btn-transparent btn-large hover-scale" title="Phát hoặc tạm dừng"><ha-icon icon="${isPlaying ? 'mdi:pause' : 'mdi:play'}"></ha-icon></button>
                <button id="btn-stop" class="icon-btn-transparent hover-scale" title="Dừng"><ha-icon icon="mdi:stop"></ha-icon></button>
                <button id="btn-next" class="icon-btn-transparent hover-scale" title="Bài tiếp theo"><ha-icon icon="mdi:skip-next"></ha-icon></button>
              </div>
              
              <div class="waveform-full">
                ${waveBars}
              </div>
              
              <div class="progress-row">
                <span id="playback-position" class="time-text">${positionLabel}</span>
                <div
                  id="playback-progress-track"
                  class="progress-track-new"
                  role="slider"
                  aria-label="Thanh tua phát nhạc"
                  aria-valuemin="0"
                  aria-valuemax="${Math.max(0, Math.round(liveDurationSeconds))}"
                  aria-valuenow="${Math.max(0, Math.round(livePositionSeconds))}"
                >
                  <div id="playback-progress" class="progress-fill-new" style="width:${progressPercent.toFixed(2)}%"></div>
                </div>
                <span id="playback-duration" class="time-text">${durationLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="subtabs" style="margin-top: 10px;">
          <button class="subtab ${this._mediaSearchTab === "songs" ? "active" : ""}" data-media-tab="songs">Songs</button>
          <button class="subtab ${this._mediaSearchTab === "playlist" ? "active" : ""}" data-media-tab="playlist">Playlist</button>
          <button class="subtab ${this._mediaSearchTab === "zing" ? "active" : ""}" data-media-tab="zing">Zing MP3</button>
          <button class="subtab ${this._mediaSearchTab === "playlists" ? "active" : ""}" data-media-tab="playlists">Playlists</button>
        </div>

        <div class="search-row">
          <input id="media-query" class="text-input" type="text" placeholder="Tìm bài hát..." value="${this._maHoaHtml(this._query)}" />
          <button id="btn-search" class="icon-btn icon-btn-primary search-btn-hover" title="Tìm kiếm"><ha-icon icon="mdi:magnify"></ha-icon></button>
        </div>

        <div class="volume-wrap">
          <div class="label-line">
            <span><ha-icon icon="mdi:volume-high"></ha-icon> Âm lượng</span>
            <strong>${volumePercent}%</strong>
          </div>
          <input id="media-volume" type="range" min="0" max="100" step="1" value="${volumePercent}" />
        </div>

        <div class="results">
          ${playback.items.length === 0 ? `
            <div class="empty">Chưa có kết quả tìm kiếm. Nhập từ khóa và bấm Tìm kiếm.</div>
          ` : playback.items.map((item, idx) => {
            const itemId = this._layIdMucMedia(item);
            const itemTitle = item.title || `Bản nhạc ${idx + 1}`;
            const itemArtist = item.artist || item.channel || "Chưa rõ nghệ sĩ";
            return `
            <div class="result-item ${itemId ? "playable" : ""}" data-id="${this._maHoaHtml(itemId)}" data-source="${this._maHoaHtml(listSource)}" role="${itemId ? "button" : ""}" tabindex="${itemId ? "0" : "-1"}">
              <div class="thumb-wrap">
                ${item.thumbnail_url ? `<img class="thumb" src="${this._maHoaHtml(item.thumbnail_url)}" alt="" />` : `<div class="thumb fallback"><ha-icon icon="mdi:music-note"></ha-icon></div>`}
              </div>
              <div class="result-meta">
                <div class="result-title">${this._maHoaHtml(itemTitle)}</div>
                <div class="result-artist">${this._maHoaHtml(itemArtist)}</div>
                <div class="result-duration">${this._dinhDangThoiLuong(item.duration_seconds)}</div>
              </div>
              <div class="result-actions">
                <button class="mini-btn mini-btn-accent add-btn" data-add-title="${this._maHoaHtml(itemTitle)}" title="Thêm vào ô tìm kiếm"><ha-icon icon="mdi:plus"></ha-icon></button>
                <button class="mini-btn mini-btn-danger play-btn" data-id="${this._maHoaHtml(itemId)}" data-source="${this._maHoaHtml(listSource)}"><ha-icon icon="mdi:play"></ha-icon><span>Phát</span></button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </section>
    `;
  },

  _veTabDieuKhien() { /* Giữ nguyên hàm gốc */
    return `
      <section class="panel">
        <h3 class="section-title"><ha-icon icon="mdi:tune-variant"></ha-icon> Control</h3>
        <div class="tile">
          <div class="label-line">
            <strong>Từ khóa đánh thức</strong>
            <label class="switch"><input id="wake-enabled" type="checkbox" ${this._wakeEnabled ? "checked" : ""} /><span class="slider"></span></label>
          </div>
          <div class="small">Độ nhạy đề xuất 0.95-0.99</div>
          <div class="label-line">
            <span>${this._wakeSensitivity.toFixed(2)}</span>
            <button id="wake-refresh" class="mini-btn hover-pop">Refresh</button>
          </div>
          <input id="wake-sensitivity" type="range" min="0" max="1" step="0.01" value="${this._wakeSensitivity}" ${!this._wakeEnabled ? "disabled" : ""} />
        </div>
        <div class="tile">
          <div class="label-line"><strong>Chống Điếc AI</strong><label class="switch"><input id="ai-enabled" type="checkbox" ${this._antiDeafEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
        </div>
        <div class="tile">
          <div class="label-line"><strong>DLNA</strong><label class="switch"><input id="dlna-enabled" type="checkbox" ${this._dlnaEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
          <div class="label-line"><strong>AirPlay</strong><label class="switch"><input id="airplay-enabled" type="checkbox" ${this._airplayEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
          <div class="label-line"><strong>Bluetooth</strong><label class="switch"><input id="bluetooth-enabled" type="checkbox" ${this._bluetoothEnabled ? "checked" : ""} /><span class="slider"></span></label></div>
        </div>
      </section>
    `;
  },

  _veTabChat() { /* Giữ nguyên hàm gốc */
    const historyMarkup = this._chatHistory.length === 0 ? `<div class="chat-empty"><strong>Chưa có lịch sử chat</strong></div>` : this._chatHistory.map(item => `<div class="chat-row ${["user", "human", "client"].includes(String(item.message_type || item.role).toLowerCase()) ? "user" : "server"}"><div class="chat-item ${["user", "human", "client"].includes(String(item.message_type || item.role).toLowerCase()) ? "user" : "server"} hover-lift"><div class="chat-head">${["user", "human", "client"].includes(String(item.message_type || item.role).toLowerCase()) ? "Bạn" : "AI"}</div><div class="chat-content">${this._maHoaHtml(item.content || item.message || "")}</div></div></div>`).join("");
    return `
      <section class="panel panel-chat">
        <div class="chat-shell">
          <div class="chat-shell-header">
            <div class="chat-shell-title-wrap">
              <div class="chat-shell-icon"><ha-icon icon="mdi:chat-processing"></ha-icon></div>
              <div class="chat-shell-title-stack"><h3 class="chat-shell-title">Trò chuyện</h3><div class="chat-shell-subtitle">Sẵn sàng</div></div>
            </div>
            <div class="chat-shell-tools"><button id="chat-refresh" class="chat-tool-btn"><ha-icon icon="mdi:refresh"></ha-icon></button></div>
          </div>
          <div class="results chat-results chat-shell-history">${historyMarkup}</div>
          <div class="chat-shell-footer">
            <div class="chat-quick-actions">
              <button id="chat-wakeup" class="chat-quick-btn chat-quick-btn-primary"><ha-icon icon="mdi:microphone"></ha-icon><span>Đánh thức</span></button>
              <button id="chat-testmic" class="chat-quick-btn hover-pop"><ha-icon icon="mdi:waveform"></ha-icon><span>Thử mic</span></button>
            </div>
            <div class="chat-composer">
              <input id="chat-input" class="text-input chat-composer-input" type="text" placeholder="Nhập tin nhắn..." value="${this._maHoaHtml(this._chatInput)}" />
              <button id="chat-send" class="chat-send-btn hover-scale"><ha-icon icon="mdi:send"></ha-icon></button>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  _veTabHeThong() { /* Giữ nguyên hàm gốc */
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

  _veGiaoDien() {
    if (!this.shadowRoot) return;
    if (!this._hass) return;

    const aiboxEntities = this._timCacEntityAibox();

    if (aiboxEntities.length > 0 && (!this._config || !this._config.entity || !aiboxEntities.includes(this._config.entity))) {
      if (!this._config) this._config = {};
      this._config.entity = aiboxEntities[0];
    }

    if (!this._config || !this._config.entity) {
      this._xoaHenGioTienDo();
      this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px;">Không tìm thấy entity ESP32 AIBox nào trong hệ thống. Hãy chắc chắn bạn đã setup kết nối trong mục Integrations.</div></ha-card>`;
      return;
    }

    const stateObj = this._doiTuongTrangThai();
    if (!stateObj) {
      this._xoaHenGioTienDo();
      this.shadowRoot.innerHTML = `
        <ha-card>
          <div style="padding:16px;">Không tìm thấy entity <strong>${this._maHoaHtml(this._config.entity)}</strong>. Đang đợi đồng bộ...</div>
        </ha-card>
      `;
      return;
    }

    const deviceSelectorHtml = aiboxEntities.length > 1 ? `
      <div class="device-selector-container">
        <button id="btn-prev-device" class="device-nav-btn" title="Thiết bị trước"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
        <div class="device-select-wrapper">
          <ha-icon icon="mdi:speaker-wireless" class="device-icon"></ha-icon>
          <select id="device-selector" class="device-dropdown">
            ${aiboxEntities.map(ent => {
              const friendlyName = this._hass.states[ent]?.attributes?.friendly_name || ent.replace("media_player.", "");
              const isSelected = this._config.entity === ent ? 'selected' : '';
              return `<option value="${ent}" ${isSelected}>${this._maHoaHtml(friendlyName)}</option>`;
            }).join('')}
          </select>
        </div>
        <button id="btn-next-device" class="device-nav-btn" title="Thiết bị tiếp theo"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
      </div>
    ` : '';

    const tabs = [
      { key: "media", icon: "mdi:music-note", label: "Media" },
      { key: "control", icon: "mdi:tune-variant", label: "Control" },
      { key: "chat", icon: "mdi:chat-processing", label: "Trò chuyện" },
      { key: "system", icon: "mdi:cog", label: "System" },
    ];

    let body = "";
    if (this._activeTab === "media") body = this._veTabMedia(stateObj);
    if (this._activeTab === "control") body = this._veTabDieuKhien();
    if (this._activeTab === "chat") body = this._veTabChat();
    if (this._activeTab === "system") body = this._veTabHeThong();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --bg-card: #071430; --bg-soft: #0d2048; --bg-tile: #14274c;
          --line: #29418f; --text: #f2f5ff; --muted: #a7b5d4;
          --accent: #7a63ff; --accent-2: #4f8dff; --danger: #ef4444;
          display: block; width: 100%; max-width: none;
        }

        * {
          box-sizing: border-box;
          transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        ha-card {
          width: 100%; max-width: none; margin: 0; border-radius: 24px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.06);
          background: radial-gradient(1400px 400px at 0% -20%, rgba(84, 81, 255, 0.18), transparent 52%), radial-gradient(1000px 380px at 100% -10%, rgba(66, 167, 255, 0.16), transparent 58%), linear-gradient(180deg, #040b1d 0%, var(--bg-card) 100%);
          color: var(--text); box-shadow: 0 16px 32px rgba(0, 0, 0, 0.3); padding: 0;
        }

        .device-selector-container { display: flex; align-items: center; gap: 8px; padding: 12px 10px 0; width: 100%; }
        .device-nav-btn { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid rgba(101, 125, 255, 0.35); background: rgba(10, 22, 48, 0.75); color: var(--muted); cursor: pointer; flex-shrink: 0; transition: all 0.2s ease; }
        .device-nav-btn:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
        .device-nav-btn:active { transform: scale(0.95); }
        .device-select-wrapper { position: relative; flex: 1; display: flex; align-items: center; background: linear-gradient(120deg, rgba(100, 102, 241, 0.15), rgba(139, 92, 246, 0.15)); border: 1px solid rgba(100, 102, 241, 0.4); border-radius: 10px; padding: 0 10px; height: 36px; overflow: hidden; }
        .device-icon { color: #8b5cf6; --mdc-icon-size: 18px; margin-right: 8px; pointer-events: none; }
        .device-dropdown { flex: 1; width: 100%; height: 100%; background: transparent; border: none; color: #fff; font-weight: 700; font-size: 13px; outline: none; cursor: pointer; appearance: none; -webkit-appearance: none; padding-right: 20px; }
        .device-dropdown option { background: var(--bg-card); color: #fff; }
        .device-select-wrapper::after { content: '▼'; position: absolute; right: 12px; color: #8b5cf6; font-size: 10px; pointer-events: none; }

        .top-tabs { display: flex; flex-wrap: nowrap; gap: 6px; padding: 6px 8px; border: 1px solid rgba(101, 125, 255, 0.35); border-radius: 16px; background: rgba(10, 22, 48, 0.75); margin: 10px 10px 12px; }
        .tab-btn { border: 0; background: rgba(255, 255, 255, 0.03); color: var(--muted); border-radius: 12px; padding: 8px 10px; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; flex: 1 1 0; min-width: 0; }
        .tab-btn span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
        .tab-btn:hover { background: rgba(255, 255, 255, 0.08); transform: translateY(-2px); color: #fff; }
        .tab-btn.active { color: #fff; background: linear-gradient(120deg, #6466f1, #8b5cf6); box-shadow: 0 6px 14px rgba(122, 99, 255, 0.35); transform: translateY(0); }

        .panel { border: 0; padding: 0 10px 12px; background: transparent; }
        .panel-media { padding: 0; overflow: hidden; }

        /* Giao diện Nhạc hoàn toàn mới - Tối ưu diện tích */
        .hero {
          position: relative;
          display: flex; flex-direction: column;
          border-bottom: 1px solid rgba(70, 106, 233, 0.25); overflow: hidden;
          background: #060e22; padding-bottom: 14px;
        }

        /* Hình nền làm rõ nét hơn như yêu cầu */
        .hero-bg-img {
          position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
          filter: saturate(1.2) brightness(0.4) blur(3px); transform: scale(1.05); pointer-events: none;
        }

        .hero-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, rgba(10, 20, 45, 0.3) 0%, rgba(6, 15, 36, 0.8) 100%);
          pointer-events: none;
        }

        .hero-bg-text {
          position: absolute; top: 45%; left: 50%; transform: translate(-50%, -50%);
          font-size: 72px; font-weight: 900; color: rgba(255, 255, 255, 0.04);
          white-space: nowrap; pointer-events: none; z-index: 0; letter-spacing: -1px;
        }

        .hero-content { position: relative; z-index: 1; padding: 12px 14px 0; }

        .hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .hero-titles { flex: 1; min-width: 0; }
        .song-title { margin: 0; font-size: 16px; font-weight: 800; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-shadow: 0 2px 4px rgba(0,0,0,0.6); }
        .song-sub { margin-top: 4px; color: #d3dffa; font-size: 12px; font-weight: 600; opacity: 0.8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .hero-top-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .pill { display: inline-flex; align-items: center; justify-content: center; min-width: 80px; height: 30px; padding: 0 10px; border-radius: 9px; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; background: rgba(7, 16, 40, 0.7); border: 1px solid rgba(79, 141, 255, 0.3); backdrop-filter: blur(4px); flex-shrink: 0; }
        .hero-actions { display: flex; gap: 4px; align-items: center; margin-top: 4px; }
        
        .player-stage-new { margin-top: 14px; display: flex; align-items: center; }
        .cover-disc { width: 80px; height: 80px; flex: 0 0 80px; border-radius: 50%; overflow: hidden; border: 2px solid rgba(118, 159, 255, 0.4); box-shadow: 0 6px 20px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 30% 25%, rgba(100, 105, 245, 0.46), rgba(13, 24, 52, 0.95)); }
        .cover-disc img { width: 100%; height: 100%; object-fit: cover; }
        .cover-disc ha-icon { color: #d8e4ff; --mdc-icon-size: 28px; }
        .hero.is-playing .cover-disc.spinning { animation: discSpin 8s linear infinite; }

        /* Khối Waveform và Điều khiển được kéo lên - Relative Layout */
        .hero-bottom {
          position: relative; width: 100%; z-index: 1;
          margin-top: 20px; display: flex; flex-direction: column; gap: 8px;
        }

        /* Gỡ nền và viền, thay đổi hiệu ứng hover */
        .controls-overlay {
          display: flex; align-items: center; justify-content: center; gap: 28px;
          padding: 0; background: transparent; border: none; box-shadow: none; backdrop-filter: none;
        }
        
        .icon-btn-transparent {
          background: transparent; border: none; color: rgba(255, 255, 255, 0.75); cursor: pointer; padding: 8px;
          border-radius: 50%; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .icon-btn-transparent:hover {
          color: #fff; transform: scale(1.3) translateY(-2px);
          filter: drop-shadow(0 4px 10px rgba(255, 255, 255, 0.6));
        }
        .btn-large ha-icon { --mdc-icon-size: 46px; }
        .icon-btn-transparent ha-icon { --mdc-icon-size: 28px; }

        .waveform-full {
          height: 42px; display: flex; align-items: flex-end; justify-content: center; gap: 4px; overflow: hidden; padding: 0 14px;
        }
        
        .wave-bar {
          flex: 1; max-width: 6px; height: var(--h); border-radius: 4px;
          background: linear-gradient(180deg, #a259ff, #6366f1); transform-origin: bottom; opacity: 0.6;
          box-shadow: 0 0 6px rgba(162, 89, 255, 0.4);
        }

        /* 3 HIỆU ỨNG NHẠC MỚI MƯỢT MÀ HƠN */
        .hero.is-playing.wave-effect-0 .wave-bar { animation: waveDance calc(600ms + (var(--i) * 20ms)) ease-in-out infinite alternate; opacity: 1; }
        .hero.is-playing.wave-effect-1 .wave-bar { animation: wavePulse calc(400ms + (var(--i) * 15ms)) cubic-bezier(0.4, 0, 0.2, 1) infinite alternate; opacity: 1; }
        .hero.is-playing.wave-effect-2 .wave-bar { animation: waveBounce 1s cubic-bezier(0.68, -0.55, 0.26, 1.55) infinite; animation-delay: calc(var(--i) * 0.04s); opacity: 1; }

        @keyframes waveDance { 0% { transform: scaleY(0.3); } 100% { transform: scaleY(1.1); } }
        @keyframes wavePulse { 0% { transform: scaleY(0.1); opacity: 0.4; } 100% { transform: scaleY(1.3); opacity: 1; filter: brightness(1.3); } }
        @keyframes waveBounce { 0%, 100% { transform: scaleY(0.2); } 50% { transform: scaleY(1); } }
        @keyframes discSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .progress-row { display: flex; align-items: center; gap: 10px; padding: 4px 14px 12px; }
        .time-text { font-size: 11px; font-weight: 700; color: #c4d4f2; }
        .progress-track-new { flex: 1; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; cursor: pointer; position: relative; }
        .progress-fill-new { height: 100%; background: linear-gradient(90deg, #764dff, #8b5cf6); border-radius: 2px; box-shadow: 0 0 8px rgba(120, 94, 255, 0.5); pointer-events: none;}

        .icon-btn-primary { background: linear-gradient(135deg, #4f8dff, #7a63ff); box-shadow: 0 6px 18px rgba(79, 141, 255, 0.35); }
        .icon-btn-primary:hover { box-shadow: 0 10px 24px rgba(79, 141, 255, 0.5); filter: brightness(1.15); }

        .subtabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; padding: 12px 10px 6px; }
        .subtab { border: 1px solid rgba(70, 106, 233, 0.3); border-radius: 10px; padding: 8px 6px; background: rgba(255, 255, 255, 0.02); color: var(--muted); font-weight: 600; font-size: 12px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; }
        .subtab:hover { background: rgba(255, 255, 255, 0.08); color: #fff; transform: translateY(-1px); }
        .subtab.active { background: linear-gradient(120deg, rgba(100, 102, 241, 0.9), rgba(139, 92, 246, 0.88)); color: #fff; border-color: transparent; box-shadow: 0 4px 10px rgba(100, 102, 241, 0.3); }

        .search-row { display: flex; gap: 10px; padding: 8px 10px; }
        .search-row .icon-btn { width: 40px; height: 40px; flex: 0 0 40px; border-radius: 12px; border: 0; color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
        .search-row .icon-btn ha-icon { --mdc-icon-size: 20px; }
        .text-input { flex: 1; min-width: 0; height: 40px; border-radius: 12px; border: 1px solid rgba(79, 141, 255, 0.3); background: rgba(11, 24, 54, 0.6); color: #fff; padding: 8px 12px; font-size: 14px; outline: none; transition: border-color 0.3s, box-shadow 0.3s, background 0.3s; }
        .text-input:focus { border-color: rgba(122, 99, 255, 0.9); background: rgba(11, 24, 54, 0.9); box-shadow: 0 0 0 2px rgba(122, 99, 255, 0.4); }

        .volume-wrap { padding: 6px 10px 10px; }
        .label-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; color: var(--text); font-size: 13px; }
        .small { color: var(--muted); font-size: 12px; margin: 0 0 8px; }
        input[type="range"] { width: 100%; accent-color: #7a63ff; cursor: pointer; }

        .results { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 10px; padding: 0 10px 12px; max-height: 380px; overflow: auto; overflow-x: hidden; }
        .empty { border: 1px dashed rgba(79, 141, 255, 0.35); border-radius: 12px; padding: 14px; color: var(--muted); text-align: center; font-size: 13px; grid-column: 1 / -1; }
        .result-item { display: grid; grid-template-columns: 50px minmax(0, 1fr) auto; gap: 10px; align-items: center; border: 1px solid rgba(70, 106, 233, 0.25); border-radius: 14px; padding: 8px 10px; background: rgba(255, 255, 255, 0.02); width: 100%; box-sizing: border-box; min-height: 66px; }
        .result-meta { grid-column: 2; min-width: 0; max-width: 100%; overflow: hidden; }
        .result-item.playable { cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
        .result-item.playable:hover { border-color: rgba(122, 99, 255, 0.6); background: rgba(122, 99, 255, 0.12); transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.25); }
        .result-item.playable:active { transform: translateY(0); }

        .thumb-wrap { width: 50px; height: 50px; border-radius: 10px; overflow: hidden; background: rgba(255, 255, 255, 0.05); }
        .thumb { width: 50px; height: 50px; object-fit: cover; display: block; }
        .thumb.fallback { display: flex; align-items: center; justify-content: center; color: var(--muted); }

        .result-title { display: -webkit-box; width: 100%; max-width: 100%; font-size: 12.5px; font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.2; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
        .result-artist { margin-top: 2px; font-size: 11px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .result-duration { margin-top: 1px; font-size: 13px; font-weight: 600; color: rgba(165, 184, 214, 0.78); }

        .result-actions { grid-column: 3; grid-row: 1; display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-shrink: 0; }
        .result-actions ha-icon { --mdc-icon-size: 16px; }

        .mini-btn { border: 1px solid rgba(80, 122, 255, 0.45); border-radius: 10px; background: rgba(255, 255, 255, 0.05); color: #dbe6ff; font-weight: 700; padding: 6px 10px; font-size: 11px; cursor: pointer; white-space: nowrap; }
        .hover-pop:hover { transform: translateY(-2px); background: rgba(255, 255, 255, 0.12); }
        .hover-scale:hover { transform: scale(1.05); filter: brightness(1.1); }
        .hover-lift:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }

        .mini-btn.active { background: linear-gradient(120deg, #3578eb, #5d5eea); border-color: rgba(93, 117, 235, 0.85); color: #fff; }
        .mini-btn-accent { min-width: 28px; min-height: 28px; border-radius: 8px; padding: 0; background: #2f6dff; border-color: rgba(60, 120, 255, 0.8); color: #fff; display: inline-flex; align-items: center; justify-content: center; }
        .mini-btn-accent:hover { background: #4f8dff; transform: scale(1.1); }
        .mini-btn-danger { min-width: 58px; min-height: 28px; border-radius: 8px; padding: 0 8px; background: linear-gradient(135deg, #ef4444, #dc2626); border-color: transparent; color: #fff; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
        .mini-btn-danger:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4); }

        .result-actions .play-btn { font-size: 11px; }
        .actions-inline { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }

        .tile { border: 1px solid rgba(70, 106, 233, 0.25); border-radius: 16px; background: rgba(255, 255, 255, 0.02); padding: 12px; margin-bottom: 10px; }
        .section-title { margin: 0 0 12px 10px; font-size: 24px; font-weight: 800; display: flex; align-items: center; gap: 8px; }

        .switch { position: relative; width: 44px; height: 24px; display: inline-block; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.15); border-radius: 999px; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .slider::before { content: ""; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; border-radius: 50%; background: #fff; transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .switch input:checked + .slider { background: linear-gradient(120deg, #4f8dff, #7a63ff); }
        .switch input:checked + .slider::before { transform: translateX(20px); }
        
        .danger-btn { width: 100%; min-height: 40px; border-radius: 12px; border: 1px solid rgba(255, 120, 120, 0.3); background: linear-gradient(120deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.25)); color: #ff9999; font-size: 14px; font-weight: 800; display: inline-flex; gap: 8px; align-items: center; justify-content: center; cursor: pointer; }
        .danger-btn:hover { background: linear-gradient(120deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 1)); color: #fff; }

        .chat-shell { border-radius: 16px; border: 1px solid rgba(87, 107, 230, 0.3); margin: 0 10px; }
        .chat-item { max-width: 85%; padding: 8px 12px; font-size: 13px; }
        .chat-head { font-size: 9px; padding: 0 6px; min-height: 16px; margin-bottom: 4px; }
        .chat-composer-input { min-height: 38px; padding: 8px 12px; font-size: 13px; }
        .chat-send-btn { width: 38px; height: 38px; }

        @media (max-width: 450px) {
          .top-tabs { gap: 6px; padding: 6px; margin: 8px 8px 10px; }
          .tab-btn { padding: 10px 0; }
          .tab-btn span { display: none; }
          .tab-btn ha-icon { margin: 0; --mdc-icon-size: 22px; }
          
          .cover-disc { width: 60px; height: 60px; flex: 0 0 60px; border-width: 1px; }
          
          .subtabs { grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 8px 8px 4px; }
          .search-row { padding: 6px 8px; gap: 8px; }
          .result-item { grid-template-columns: 44px minmax(0, 1fr) auto; padding: 6px 8px; gap: 8px; }
          .thumb, .thumb-wrap { width: 44px; height: 44px; }
          .result-title { font-size: 12px; }
        }
      </style>

      <ha-card>
        ${deviceSelectorHtml}
        <div class="top-tabs">
          ${tabs.map((tab) => `<button class="tab-btn ${this._activeTab === tab.key ? "active" : ""}" data-tab="${tab.key}"><ha-icon icon="${tab.icon}"></ha-icon><span>${tab.label}</span></button>`).join("")}
        </div>
        ${body}
      </ha-card>
    `;

    if (this._activeTab === "chat") this._damBaoTrangThaiChat();
    if (this._activeTab === "control") this._damBaoTrangThaiDieuKhien();
    if (this._activeTab === "system") this._damBaoTrangThaiHeThong();

    this._ganSuKien();
    this._dongBoTienDoDom();
    this._capNhatHenGioTienDo();
  }
};