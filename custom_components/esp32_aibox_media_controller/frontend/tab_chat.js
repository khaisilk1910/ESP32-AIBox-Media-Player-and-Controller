export const TabChatMixin = {
  _chuanHoaChatMuc(item, fallbackRole = "server") {
    const source = item && typeof item === "object" ? item : {};
    const content = this._chuoiKhongRongDauTien(source.content, source.message, source.text, source.msg);
    if (!content) return null;
    const roleRaw = this._chuoiKhongRongDauTien(source.message_type, source.role, source.sender, fallbackRole).toLowerCase();
    const role = ["user", "human", "client", "me"].includes(roleRaw) ? "user" : "server";
    const timestamp = source.ts ?? source.timestamp ?? source.time ?? source.created_at ?? source.createdAt;
    const normalized = { ...source, content, message_type: role, role, sender: role };
    if (timestamp !== undefined && timestamp !== null && String(timestamp).trim() !== "") normalized.ts = timestamp;
    return normalized;
  },

  _laChatMucTrung(current, incoming) {
    const currentId = this._chuoiKhongRongDauTien(current?.id, current?.message_id, current?._local_echo_id);
    const incomingId = this._chuoiKhongRongDauTien(incoming?.id, incoming?.message_id, incoming?._local_echo_id);
    if (currentId && incomingId && currentId === incomingId) return true;
    if (current?.ts !== undefined && current?.ts !== null && incoming?.ts !== undefined && incoming?.ts !== null && current.ts === incoming.ts) return true;
    const currentLocal = this._epKieuBoolean(current?._local_echo, false);
    const incomingLocal = this._epKieuBoolean(incoming?._local_echo, false);
    return current?.message_type === incoming?.message_type && current?.content === incoming?.content && currentLocal !== incomingLocal && (currentLocal || incomingLocal);
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
          if (!this._epKieuBoolean(item._local_echo, false)) { delete nextItem._local_echo; delete nextItem._local_echo_id; }
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
    const item = this._chuanHoaChatMuc({ content, message_type: role, ts: Date.now(), _local_echo: true, _local_echo_id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}` }, role);
    if (!item) return;
    this._chatHistory = this._hopNhatLichSuChat(this._chatHistory, [item]);
    this._chatHistoryLoaded = true;
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
    } catch (err) {}
  },

  async _guiTinNhanChat() {
    const text = (this._chatInput || "").trim();
    if (!text) return;
    this._themTinNhanChatTam(text, "user");
    this._chatInput = ""; this._lastChatHistoryRequestAt = 0;
    this._veGiaoDienGiuFocusChat(); this._cuonCuoiKhungChat();
    try {
      await this._goiDichVu("esp32_aibox_media_controller", "chat_send_text", { text: text });
      await this._goiDichVu("esp32_aibox_media_controller", "chat_get_history");
      await this._lamMoiEntity(220, 2);
      this._cuonCuoiKhungChat();
    } catch (err) {}
  },

  _veGiaoDienGiuFocusChat() {
    const root = this.shadowRoot;
    const input = root?.getElementById("chatInput");
    const dangFocus = Boolean(input && root.activeElement === input);
    const viTriBatDau = dangFocus ? input.selectionStart ?? input.value.length : 0;
    const viTriKetThuc = dangFocus ? input.selectionEnd ?? input.value.length : viTriBatDau;

    this._pendingRender = false;
    this._veGiaoDien();

    const inputMoi = this.shadowRoot?.getElementById("chatInput");
    if (!inputMoi) return;
    inputMoi.focus();
    inputMoi.setSelectionRange(Math.max(0, Math.min(inputMoi.value.length, Number(viTriBatDau))), Math.max(0, Math.min(inputMoi.value.length, Number(viTriKetThuc))));
  },

  _cuonCuoiKhungChat() {
    requestAnimationFrame(() => {
      const historyEl = this.shadowRoot?.getElementById("chat-messages-container");
      if (!historyEl) return;
      historyEl.scrollTop = historyEl.scrollHeight;
    });
  },

  _veTabChat() { 
    const hasBg = !!this._chatBgBase64;
    const userBubbleClass = hasBg ? 'user-bubble-transparent' : 'user-bubble';
    const aiBubbleClass = hasBg ? 'ai-bubble-transparent' : 'ai-bubble';

    const historyMarkup = this._chatHistory.length === 0 
      ? `<div class="chat-empty empty" style="margin: auto; text-align: center; border: none; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);"><strong>Chưa có lịch sử chat</strong></div>` 
      : this._chatHistory.map(item => {
          const isUser = ["user", "human", "client"].includes(String(item.message_type || item.role).toLowerCase());
          return `
          <div class="chat-msg-row ${isUser ? 'user' : 'ai'}" style="position: relative; z-index: 10;">
             <div class="chat-bubble ${isUser ? userBubbleClass : aiBubbleClass}">
                ${this._maHoaHtml(item.content || item.message || "")}
             </div>
          </div>`;
        }).join("");
        
    let currentModel = 'hiyori';
    try { currentModel = localStorage.getItem('live2d_model_id') || 'hiyori'; } catch(e) {}
    if (this._live2dManager && this._live2dManager.currentModelId) currentModel = this._live2dManager.currentModelId;

    const models = [
        { id: 'hiyori', name: 'Hiyori' }, { id: 'miku', name: 'Miku' }, { id: 'haru', name: 'Haru' },
        { id: 'wanko', name: 'Wanko' }, { id: 'shizuku', name: 'Shizuku' }, { id: 'tororo', name: 'Tororo' },
        { id: 'hijiki', name: 'Hijiki' }, { id: 'ryou', name: 'Ryou' }, { id: 'chitose', name: 'Chitose' },
        { id: 'nicole', name: 'Nicole' }, { id: 'changli', name: 'Changli' }
    ];

    return `
      <section class="panel panel-chat" style="padding: 0;">
        <div class="chat-container-ui">
          <img class="chat-bg-img" style="display: ${hasBg ? 'block' : 'none'};" src="${hasBg ? 'data:image/jpeg;base64,' + this._chatBgBase64 : ''}" alt="">
          <div id="live2d-wrapper" class="live2d-stage"></div>
          <div class="chat-ui-header">
            <span style="font-size: 12px; font-weight: 700; color: #cbd5e1; display: flex; align-items: center;"><ha-icon icon="mdi:chat-processing" style="color: #818cf8; --mdc-icon-size: 16px; margin-right: 8px;"></ha-icon>Trò chuyện</span>
            <div style="display: flex; align-items: center; gap: 8px;">
                <select id="chat-live2d-select" class="live2d-select">${models.map(m => `<option value="${m.id}" ${m.id === currentModel ? 'selected' : ''}>${m.name}</option>`).join("")}</select>
                <input type="file" id="chatBackgroundUpload" accept="image/*" style="display: none;">
                <button id="btnChatBackground" class="chat-header-btn" title="Đổi ảnh nền" style="display: ${hasBg ? 'none' : 'block'};"><ha-icon icon="mdi:image"></ha-icon></button>
                <button id="btnRemoveBackground" class="chat-header-btn" title="Xóa ảnh nền" style="display: ${hasBg ? 'block' : 'none'};"><ha-icon icon="mdi:image-off"></ha-icon></button>
                <button id="btnClearChat" class="chat-header-btn" title="Xóa lịch sử"><ha-icon icon="mdi:trash-can"></ha-icon></button>
            </div>
          </div>
          <div class="chat-ui-messages" id="chat-messages-container">${historyMarkup}</div>
          <div class="chat-ui-footer">
            <div style="display: flex; gap: 8px;">
                <input type="text" id="chatInput" placeholder="Nhập tin nhắn..." value="${this._maHoaHtml(this._chatInput)}" class="chat-ui-input">
                <button id="chat-send" class="chat-ui-send-btn shadow-green"><ha-icon icon="mdi:send"></ha-icon></button>
            </div>
            <div style="display: flex; gap: 8px;">
                <button id="btnWakeUp" class="chat-ui-action-btn accent-gradient flex-1 shadow-indigo"><ha-icon icon="mdi:microphone" style="--mdc-icon-size: 14px; margin-right: 4px;"></ha-icon>Wake Up</button>
                <button id="btnTestMic" class="chat-ui-action-btn bg-purple shadow-purple"><ha-icon icon="mdi:waveform" style="--mdc-icon-size: 14px; margin-right: 4px;"></ha-icon>Test Mic</button>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button id="btnTiktokReply" class="chat-ui-action-btn flex-1 ${this._tiktokReplyEnabled ? 'bg-green border-green shadow-green' : 'bg-slate border-slate'}">
                    <ha-icon icon="mdi:video" style="--mdc-icon-size: 14px; margin-right: 4px;"></ha-icon><span id="tiktokReplyText">TikTok Reply: ${this._tiktokReplyEnabled ? 'ON' : 'OFF'}</span>
                </button>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  _ganSuKienTabChat(root) {
    const chatInput = root.getElementById("chatInput");
    if (chatInput) {
      chatInput.addEventListener("compositionstart", () => { this._chatDangCompose = true; });
      chatInput.addEventListener("compositionend", (ev) => { this._chatDangCompose = false; this._chatInput = ev.target.value; });
      chatInput.addEventListener("input", (ev) => { this._chatInput = ev.target.value; });
      chatInput.addEventListener("keydown", async (ev) => {
        if (ev.isComposing || this._chatDangCompose) return;
        if (ev.key === "Enter") { ev.preventDefault(); if (this._chatInput.trim() !== '') await this._guiTinNhanChat(); }
      });
      chatInput.addEventListener("blur", () => { setTimeout(() => this._xuLyRenderCho(), 0); });
    }

    root.getElementById("chat-send")?.addEventListener("click", async (ev) => { ev.preventDefault(); if(this._chatInput.trim() !== '') await this._guiTinNhanChat(); });
    root.getElementById("btnWakeUp")?.addEventListener("click", async () => { await this._goiDichVu("esp32_aibox_media_controller", "chat_wake_up"); await this._lamMoiEntity(280); });
    root.getElementById("btnTestMic")?.addEventListener("click", async () => { await this._goiDichVu("esp32_aibox_media_controller", "chat_test_mic"); await this._lamMoiEntity(280); });
    root.getElementById("btnTiktokReply")?.addEventListener("click", async () => { this._tiktokReplyEnabled = !this._tiktokReplyEnabled; this._veGiaoDien(); await this._goiDichVu("esp32_aibox_media_controller", "tiktok_reply_toggle", { enabled: this._tiktokReplyEnabled }); });
    root.getElementById("btnClearChat")?.addEventListener("click", () => { this._chatHistory = []; this._veGiaoDien(); });

    const btnChatBackground = root.getElementById("btnChatBackground");
    const chatBackgroundUpload = root.getElementById("chatBackgroundUpload");
    if (btnChatBackground && chatBackgroundUpload) {
      btnChatBackground.addEventListener("click", () => chatBackgroundUpload.click());
      chatBackgroundUpload.addEventListener("change", async (ev) => {
        const file = ev.target.files[0]; if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result.split(',')[1]; this._chatBgBase64 = base64; this._veGiaoDien();
          try { await this._goiDichVu("esp32_aibox_media_controller", "upload_chat_background", { image: base64 }); } catch(err) {}
        };
        reader.readAsDataURL(file);
      });
    }

    root.getElementById("btnRemoveBackground")?.addEventListener("click", async () => { this._chatBgBase64 = ""; this._veGiaoDien(); try { await this._goiDichVu("esp32_aibox_media_controller", "remove_chat_background"); } catch(err) {} });

    root.getElementById("chat-live2d-select")?.addEventListener("change", (ev) => {
      const modelId = ev.target.value;
      if (this._live2dManager) {
          this._live2dManager.setModel(modelId).then(success => {
              if (success) {
                  localStorage.setItem('live2d_model_id', modelId);
                  const wrapper = root.getElementById('live2d-wrapper');
                  if (wrapper && this._live2dManager.live2dApp.view) { wrapper.innerHTML = ''; wrapper.appendChild(this._live2dManager.live2dApp.view); }
                  this._goiDichVu("esp32_aibox_media_controller", "set_live2d_model", { model_id: modelId }).catch(() => {});
              }
          });
      }
    });
  }
};