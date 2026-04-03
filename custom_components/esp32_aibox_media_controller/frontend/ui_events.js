export const UIEventsMixin = {
  _ganSuKien() {
    const root = this.shadowRoot;
    if (!root) return;

    const deviceSelector = root.getElementById("device-selector");
    if (deviceSelector) {
      deviceSelector.addEventListener("change", (ev) => {
        const entityId = ev.target.value;
        if (entityId) {
          this._chuyenEntity(entityId);
        }
      });
    }

    const btnPrevDevice = root.getElementById("btn-prev-device");
    const btnNextDevice = root.getElementById("btn-next-device");
    if (btnPrevDevice || btnNextDevice) {
      const aiboxEntities = this._timCacEntityAibox();
      const currentIndex = aiboxEntities.indexOf(this._config?.entity);

      if (btnPrevDevice) {
        btnPrevDevice.addEventListener("click", () => {
          if (aiboxEntities.length <= 1) return;
          let nextIdx = currentIndex - 1;
          if (nextIdx < 0) nextIdx = aiboxEntities.length - 1;
          this._chuyenEntity(aiboxEntities[nextIdx]);
        });
      }

      if (btnNextDevice) {
        btnNextDevice.addEventListener("click", () => {
          if (aiboxEntities.length <= 1) return;
          let nextIdx = currentIndex + 1;
          if (nextIdx >= aiboxEntities.length) nextIdx = 0;
          this._chuyenEntity(aiboxEntities[nextIdx]);
        });
      }
    }

    root.querySelectorAll("[data-tab]").forEach((el) => {
      el.addEventListener("click", () => {
        this._activeTab = el.dataset.tab || "media";
        this._veGiaoDien();
      });
    });

    root.querySelectorAll("[data-media-tab]").forEach((el) => {
      el.addEventListener("click", () => {
        this._mediaSearchTab = el.dataset.mediaTab || "songs";
        this._veGiaoDien();
      });
    });

    root.querySelectorAll("[data-lighting-tab]").forEach((el) => {
      el.addEventListener("click", () => {
        this._lightingTab = el.dataset.lightingTab || "main";
        this._veGiaoDien();
      });
    });

    const btnRepeat = root.getElementById("btn-repeat");
    if (btnRepeat) {
      btnRepeat.addEventListener("click", () => {
        if (this._repeatMode === "all") this._repeatMode = "one";
        else if (this._repeatMode === "one") this._repeatMode = "off";
        else this._repeatMode = "all";
        this._veGiaoDien();
      });
    }

    const btnWaveToggle = root.getElementById("btn-wave-toggle");
    if (btnWaveToggle) {
      btnWaveToggle.addEventListener("click", () => {
        this._waveEffect = (this._waveEffect + 1) % 3;
        this._veGiaoDien();
      });
    }

    const mediaQuery = root.getElementById("media-query");
    if (mediaQuery) {
      mediaQuery.addEventListener("focus", () => {
        this._mediaQueryFocused = true;
      });
      mediaQuery.addEventListener("input", (ev) => {
        this._query = ev.target.value;
      });
      mediaQuery.addEventListener("compositionstart", () => {
        this._mediaDangCompose = true;
      });
      mediaQuery.addEventListener("compositionend", async (ev) => {
        this._mediaDangCompose = false;
        this._query = ev.target.value;
        if (!this._mediaTimKiemSauCompose) return;
        this._mediaTimKiemSauCompose = false;
        await this._xuLyTimKiem(ev.target.value);
      });
      mediaQuery.addEventListener("keydown", async (ev) => {
        if (ev.key !== "Enter") return;
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.isComposing || this._mediaDangCompose) {
          this._mediaTimKiemSauCompose = true;
          return;
        }
        this._query = mediaQuery.value;
        await this._xuLyTimKiem(mediaQuery.value);
      });
      mediaQuery.addEventListener("blur", () => {
        this._mediaQueryFocused = false;
        setTimeout(() => {
          this._xuLyRenderCho();
        }, 0);
      });
    }

    const btnSearch = root.getElementById("btn-search");
    if (btnSearch) {
      btnSearch.addEventListener("mousedown", (ev) => {
        ev.preventDefault();
      });
      btnSearch.addEventListener("click", async () => {
        const currentQuery = mediaQuery ? mediaQuery.value : this._query;
        await this._xuLyTimKiem(currentQuery);
      });
    }

    const progressTrack = root.getElementById("playback-progress-track");
    if (progressTrack) {
      const seekToClientX = async (clientX) => {
        const duration = this._liveDurationSeconds > 0
          ? this._liveDurationSeconds
          : this._epKieuGiayPhat(this._thongTinPhat().duration, 0);
        if (duration <= 0) return;
        const rect = progressTrack.getBoundingClientRect();
        if (!rect.width) return;
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const target = Math.floor(duration * ratio);
        this._livePositionSeconds = target;
        this._liveDurationSeconds = duration;
        this._liveTickAt = Date.now();
        this._dongBoTienDoDom();
        await this._goiDichVu("media_player", "seek", { position: target });
        await this._lamMoiEntity(180);
      };
      progressTrack.addEventListener("click", async (ev) => {
        await seekToClientX(ev.clientX);
      });
      progressTrack.addEventListener(
        "touchend",
        async (ev) => {
          const touch = ev.changedTouches?.[0];
          if (!touch) return;
          ev.preventDefault();
          await seekToClientX(touch.clientX);
        },
        { passive: false }
      );
    }

    const btnPrev = root.getElementById("btn-prev");
    if (btnPrev) {
      btnPrev.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        try { await this._goiDichVu("media_player", "media_previous_track"); } catch(e){}
      });
    }

    const btnPlayPause = root.getElementById("btn-playpause");
    if (btnPlayPause) {
      btnPlayPause.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        await this._xuLyPhatTamDung();
      });
    }

    const btnStop = root.getElementById("btn-stop");
    if (btnStop) {
      btnStop.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        this._forcePauseUntil = Date.now() + 5000;
        this._optimisticPlayUntil = 0;
        this._liveTrackKey = "";
        this._livePositionSeconds = 0;
        this._liveDurationSeconds = 0;
        this._livePlaying = false;
        this._nowPlayingCache = {
          trackKey: "", title: "", artist: "", source: "", thumbnail_url: "", duration: 0,
        };
        this._dongBoTienDoDom();
        this._capNhatHenGioTienDo();
        try {
          await this._goiDichVu("media_player", "media_stop");
        } catch (e) {
          await this._goiDichVu("media_player", "media_pause");
        }
        this._lastPlayPauseSent = "pause";
        await this._lamMoiEntity(300);
      });
    }

    const btnNext = root.getElementById("btn-next");
    if (btnNext) {
      btnNext.addEventListener("click", async (ev) => {
        ev.preventDefault(); ev.stopPropagation();
        try { await this._goiDichVu("media_player", "media_next_track"); } catch(e){}
      });
    }

    const volumeSlider = root.getElementById("media-volume");
    if (volumeSlider) {
      volumeSlider.addEventListener("input", (ev) => {
        this._volumeLevel = Number(ev.target.value) / 100;
      });
      volumeSlider.addEventListener("change", async (ev) => {
        this._volumeLevel = Number(ev.target.value) / 100;
        await this._goiDichVu("media_player", "volume_set", {
          volume_level: this._volumeLevel,
        });
      });
    }

    const playFromDataset = async (dataset) => {
      const id = dataset?.id || "";
      const source = dataset?.source || "";
      if (!id) return;
      await this._xuLyPhatMuc({ id }, source);
    };

    root.querySelectorAll(".play-btn").forEach((el) => {
      el.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        await playFromDataset(el.dataset);
      });
    });

    root.querySelectorAll(".add-btn").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const title = el.dataset.addTitle || "";
        if (!title) return;
        this._query = title;
        const searchInput = root.getElementById("media-query");
        if (searchInput) {
          searchInput.value = title;
          searchInput.focus();
          const at = searchInput.value.length;
          searchInput.setSelectionRange(at, at);
        }
      });
    });

    root.querySelectorAll(".result-item.playable").forEach((el) => {
      el.addEventListener("click", async (ev) => {
        if (ev.target && (ev.target.closest(".play-btn") || ev.target.closest(".add-btn"))) return;
        await playFromDataset(el.dataset);
      });
      el.addEventListener("keydown", async (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        ev.preventDefault();
        await playFromDataset(el.dataset);
      });
    });

    const wakeEnabled = root.getElementById("wake-enabled");
    if (wakeEnabled) {
      wakeEnabled.addEventListener("change", async (ev) => {
        const desired = Boolean(ev.target.checked);
        this._wakeEnabled = desired;
        this._datCongTacCho("wake_enabled", desired);
        try {
          await this._goiDichVu("esp32_aibox_media_controller", "wake_word_set_enabled", { enabled: desired });
          await this._lamMoiEntity(250, 2);
        } catch (err) {
          this._xoaCongTacCho("wake_enabled");
          this._wakeEnabled = !desired;
          ev.target.checked = this._wakeEnabled;
        }
      });
    }

    const wakeSensitivity = root.getElementById("wake-sensitivity");
    if (wakeSensitivity) {
      wakeSensitivity.addEventListener("input", (ev) => {
        this._wakeSensitivity = Number(ev.target.value);
      });
      wakeSensitivity.addEventListener("change", async (ev) => {
        this._wakeSensitivity = Number(ev.target.value);
        await this._goiDichVu("esp32_aibox_media_controller", "wake_word_set_sensitivity", { sensitivity: this._wakeSensitivity });
        await this._lamMoiEntity(300);
      });
    }

    const wakeRefresh = root.getElementById("wake-refresh");
    if (wakeRefresh) {
      wakeRefresh.addEventListener("click", async () => {
        await this._goiDichVu("esp32_aibox_media_controller", "wake_word_get_enabled");
        await this._goiDichVu("esp32_aibox_media_controller", "wake_word_get_sensitivity");
        await this._lamMoiEntity(220);
      });
    }

    const aiEnabled = root.getElementById("ai-enabled");
    if (aiEnabled) {
      aiEnabled.addEventListener("change", async (ev) => {
        const desired = Boolean(ev.target.checked);
        this._antiDeafEnabled = desired;
        this._datCongTacCho("anti_deaf_enabled", desired);
        try {
          await this._goiDichVu("esp32_aibox_media_controller", "anti_deaf_ai_set_enabled", { enabled: desired });
          await this._lamMoiEntity(250, 2);
        } catch (err) {
          this._xoaCongTacCho("anti_deaf_enabled");
          this._antiDeafEnabled = !desired;
          ev.target.checked = this._antiDeafEnabled;
        }
      });
    }

    const dlnaEnabled = root.getElementById("dlna-enabled");
    if (dlnaEnabled) {
      dlnaEnabled.addEventListener("change", async (ev) => {
        const desired = Boolean(ev.target.checked);
        this._dlnaEnabled = desired;
        this._datCongTacCho("dlna_enabled", desired);
        try {
          await this._goiDichVu("esp32_aibox_media_controller", "set_dlna", { enabled: desired });
          await this._lamMoiEntity(250, 2);
        } catch (err) {
          this._xoaCongTacCho("dlna_enabled");
          this._dlnaEnabled = !desired;
          ev.target.checked = this._dlnaEnabled;
        }
      });
    }

    const airplayEnabled = root.getElementById("airplay-enabled");
    if (airplayEnabled) {
      airplayEnabled.addEventListener("change", async (ev) => {
        const desired = Boolean(ev.target.checked);
        this._airplayEnabled = desired;
        this._datCongTacCho("airplay_enabled", desired);
        try {
          await this._goiDichVu("esp32_aibox_media_controller", "set_airplay", { enabled: desired });
          await this._lamMoiEntity(250, 2);
        } catch (err) {
          this._xoaCongTacCho("airplay_enabled");
          this._airplayEnabled = !desired;
          ev.target.checked = this._airplayEnabled;
        }
      });
    }

    const bluetoothEnabled = root.getElementById("bluetooth-enabled");
    if (bluetoothEnabled) {
      bluetoothEnabled.addEventListener("change", async (ev) => {
        const desired = Boolean(ev.target.checked);
        this._bluetoothEnabled = desired;
        this._datCongTacCho("bluetooth_enabled", desired);
        try {
          await this._goiDichVu("esp32_aibox_media_controller", "set_bluetooth", { enabled: desired });
          await this._lamMoiEntity(250, 2);
        } catch (err) {
          this._xoaCongTacCho("bluetooth_enabled");
          this._bluetoothEnabled = !desired;
          ev.target.checked = this._bluetoothEnabled;
        }
      });
    }

    const chatInput = root.getElementById("chat-input");
    if (chatInput) {
      chatInput.addEventListener("compositionstart", () => {
        this._chatDangCompose = true;
      });
      chatInput.addEventListener("compositionend", (ev) => {
        this._chatDangCompose = false;
        this._chatInput = ev.target.value;
      });
      chatInput.addEventListener("input", (ev) => {
        this._chatInput = ev.target.value;
      });
      chatInput.addEventListener("keydown", async (ev) => {
        if (ev.isComposing || this._chatDangCompose) return;
        if (ev.key === "Enter") {
          ev.preventDefault();
          await this._guiTinNhanChat();
        }
      });
      chatInput.addEventListener("blur", () => {
        setTimeout(() => { this._xuLyRenderCho(); }, 0);
      });
    }

    const chatSend = root.getElementById("chat-send");
    if (chatSend) {
      chatSend.addEventListener("mousedown", (ev) => { ev.preventDefault(); });
      chatSend.addEventListener("click", async () => { await this._guiTinNhanChat(); });
    }

    const chatWakeup = root.getElementById("chat-wakeup");
    if (chatWakeup) {
      chatWakeup.addEventListener("click", async () => {
        await this._goiDichVu("esp32_aibox_media_controller", "chat_wake_up");
        await this._lamMoiEntity(280);
      });
    }

    const chatTestMic = root.getElementById("chat-testmic");
    if (chatTestMic) {
      chatTestMic.addEventListener("click", async () => {
        await this._goiDichVu("esp32_aibox_media_controller", "chat_test_mic");
        await this._lamMoiEntity(280);
      });
    }

    const chatRefresh = root.getElementById("chat-refresh");
    if (chatRefresh) {
      chatRefresh.addEventListener("click", async () => {
        this._lastChatStateRequestAt = Date.now();
        this._lastChatHistoryRequestAt = Date.now();
        await this._goiDichVu("esp32_aibox_media_controller", "chat_get_state");
        await this._goiDichVu("esp32_aibox_media_controller", "chat_get_history");
        await this._lamMoiEntity(280);
      });
    }

    const eqEnabled = root.getElementById("eq-enabled");
    if (eqEnabled) {
      eqEnabled.addEventListener("change", async (ev) => {
        this._eqEnabled = Boolean(ev.target.checked);
        this._batDauCanhGacDongBoEq(1400);
        this._capNhatEqGiaoDien(root);
        await this._goiDichVu("media_player", "set_eq_enable", { enabled: this._eqEnabled });
        await this._lamMoiEntity(250, 2);
      });
    }

    root.querySelectorAll("[data-eq-band]").forEach((slider) => {
      const docBand = Math.max(0, Math.round(Number(slider.dataset.eqBand || 0)));
      slider.addEventListener("input", (ev) => {
        const band = Math.max(0, Math.min(this._eqBandCount - 1, docBand));
        const level = this._gioiHanEqLevel(ev.target.value, this._layEqLevelTheoBand(band, 0));
        if (!Array.isArray(this._eqBands) || this._eqBands.length < this._eqBandCount) {
          this._eqBands = Array.from({ length: this._eqBandCount }, (_, index) => this._layEqLevelTheoBand(index, 0));
        }
        this._eqBand = band;
        this._eqLevel = level;
        this._eqBands[band] = level;
        this._batDauCanhGacDongBoEq(1000);
        this._capNhatEqGiaoDien(root);
      });
      slider.addEventListener("change", async (ev) => {
        const band = Math.max(0, Math.min(this._eqBandCount - 1, docBand));
        const level = this._gioiHanEqLevel(ev.target.value, this._layEqLevelTheoBand(band, 0));
        if (!Array.isArray(this._eqBands) || this._eqBands.length < this._eqBandCount) {
          this._eqBands = Array.from({ length: this._eqBandCount }, (_, index) => this._layEqLevelTheoBand(index, 0));
        }
        this._eqBand = band;
        this._eqLevel = level;
        this._eqBands[band] = level;
        this._batDauCanhGacDongBoEq(1600);
        if (!this._eqEnabled) {
          this._eqEnabled = true;
          this._capNhatEqGiaoDien(root);
          await this._goiDichVu("media_player", "set_eq_enable", { enabled: true });
        }
        await this._goiDichVu("media_player", "set_eq_bandlevel", { band, level });
        await this._lamMoiEntity(220, 2);
        this._xuLyRenderCho();
      });
      slider.addEventListener("blur", () => { setTimeout(() => this._xuLyRenderCho(), 0); });
    });

    root.querySelectorAll(".eq-preset").forEach((el) => {
      el.addEventListener("click", async () => { await this._apDungEqMau(el.dataset.preset || ""); });
    });

    const bassEnabled = root.getElementById("bass-enabled");
    if (bassEnabled) {
      bassEnabled.addEventListener("change", async (ev) => {
        this._bassEnabled = Boolean(ev.target.checked);
        await this._goiDichVu("esp32_aibox_media_controller", "set_bass_enable", { enabled: this._bassEnabled });
        await this._lamMoiEntity(250, 2);
      });
    }

    const bassStrength = root.getElementById("bass-strength");
    if (bassStrength) {
      bassStrength.addEventListener("input", (ev) => {
        this._bassStrength = Number(ev.target.value);
      });
      bassStrength.addEventListener("change", async (ev) => {
        this._bassStrength = Number(ev.target.value);
        await this._goiDichVu("esp32_aibox_media_controller", "set_bass_strength", { strength: this._bassStrength });
        await this._lamMoiEntity(250, 2);
      });
    }

    const loudnessEnabled = root.getElementById("loudness-enabled");
    if (loudnessEnabled) {
      loudnessEnabled.addEventListener("change", async (ev) => {
        this._loudnessEnabled = Boolean(ev.target.checked);
        await this._goiDichVu("esp32_aibox_media_controller", "set_loudness_enable", { enabled: this._loudnessEnabled });
        await this._lamMoiEntity(250, 2);
      });
    }

    const loudnessGain = root.getElementById("loudness-gain");
    if (loudnessGain) {
      loudnessGain.addEventListener("input", (ev) => {
        this._loudnessGain = Number(ev.target.value);
      });
      loudnessGain.addEventListener("change", async (ev) => {
        this._loudnessGain = Number(ev.target.value);
        await this._goiDichVu("esp32_aibox_media_controller", "set_loudness_gain", { gain: this._loudnessGain });
        await this._lamMoiEntity(250, 2);
      });
    }

    const mainLightEnabled = root.getElementById("main-light-enabled");
    if (mainLightEnabled) {
      mainLightEnabled.addEventListener("change", async (ev) => {
        const desired = Boolean(ev.target.checked);
        this._mainLightEnabled = desired;
        this._datCongTacCho("main_light_enabled", desired);
        try {
          await this._goiDichVu("esp32_aibox_media_controller", "set_main_light", { enabled: desired });
          await this._lamMoiEntity(250, 2);
        } catch (err) {
          this._xoaCongTacCho("main_light_enabled");
          this._mainLightEnabled = !desired;
          ev.target.checked = this._mainLightEnabled;
        }
      });
    }

    const mainBrightness = root.getElementById("main-light-brightness");
    if (mainBrightness) {
      mainBrightness.addEventListener("input", (ev) => {
        this._mainLightBrightness = Number(ev.target.value);
      });
      mainBrightness.addEventListener("change", async (ev) => {
        this._mainLightBrightness = Number(ev.target.value);
        await this._goiDichVu("esp32_aibox_media_controller", "set_light_brightness", { brightness: this._mainLightBrightness });
        await this._lamMoiEntity(250, 2);
      });
    }

    const mainSpeed = root.getElementById("main-light-speed");
    if (mainSpeed) {
      mainSpeed.addEventListener("input", (ev) => {
        this._mainLightSpeed = Number(ev.target.value);
      });
      mainSpeed.addEventListener("change", async (ev) => {
        this._mainLightSpeed = Number(ev.target.value);
        await this._goiDichVu("esp32_aibox_media_controller", "set_light_speed", { speed: this._mainLightSpeed });
        await this._lamMoiEntity(250, 2);
      });
    }

    root.querySelectorAll(".light-mode").forEach((el) => {
      el.addEventListener("click", async () => {
        const mode = Number(el.dataset.mode || "0");
        this._mainLightMode = mode;
        await this._goiDichVu("esp32_aibox_media_controller", "set_light_mode", { mode });
        await this._lamMoiEntity(250, 2);
      });
    });

    const edgeEnabled = root.getElementById("edge-light-enabled");
    if (edgeEnabled) {
      edgeEnabled.addEventListener("change", async (ev) => {
        this._edgeLightEnabled = Boolean(ev.target.checked);
        await this._goiDichVu("esp32_aibox_media_controller", "set_edge_light", { enabled: this._edgeLightEnabled, intensity: this._edgeLightIntensity });
        await this._lamMoiEntity(250, 2);
      });
    }

    const edgeIntensity = root.getElementById("edge-light-intensity");
    if (edgeIntensity) {
      edgeIntensity.addEventListener("input", (ev) => {
        this._edgeLightIntensity = Number(ev.target.value);
      });
      edgeIntensity.addEventListener("change", async (ev) => {
        this._edgeLightIntensity = Number(ev.target.value);
        await this._goiDichVu("esp32_aibox_media_controller", "set_edge_light", { enabled: this._edgeLightEnabled, intensity: this._edgeLightIntensity });
        await this._lamMoiEntity(250, 2);
      });
    }

    const rebootBtn = root.getElementById("system-reboot");
    if (rebootBtn) {
      rebootBtn.addEventListener("click", async () => {
        await this._goiDichVu("esp32_aibox_media_controller", "reboot");
      });
    }
  }
};