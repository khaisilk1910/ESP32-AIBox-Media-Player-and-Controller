export const TabChatMixin = {
  _khoiTaoTrangThaiChat() {
    this._chatInput = "";
    this._chatHistory = [];
    this._chatHistoryLoaded = false;
    this._chatDangCompose = false;
    this._chatBgBase64 = "";
    this._chatBackgroundLoaded = false;
    this._chatBackgroundRequestedAt = 0;
    this._tiktokReplyEnabled = false;
    this._chatWakeState = "ready";
    this._chatWakeButtonText = "Wake Up";
    this._chatWakeButtonEnabled = true;
    this._chatTestMicState = "";
    this._chatTestMicButtonText = "Test Mic";
    this._lastChatStateRequestAt = 0;
    this._lastChatHistoryRequestAt = 0;
    this._live2dManager = null;
    this._lastEmotionActionTime = 0;
    this._lastRenderedAiSignature = "";
    this._chatScrollPinnedToBottom = true;
    this._chatForceScroll = false;
    this._chatLastKnownOffsetFromBottom = 0;
  },

  _dongBoTrangThaiChat(attrs) {
    const beforeSignature = this._taoChuKyChatHistory(this._chatHistory);
    this._dongBoLichSuChatTuEntity?.(attrs.last_chat_items);
    const afterSignature = this._taoChuKyChatHistory(this._chatHistory);
    if (afterSignature && afterSignature !== beforeSignature && this._chatScrollPinnedToBottom) {
      this._chatForceScroll = true;
    }

    const chat = (attrs.chat_state && typeof attrs.chat_state === 'object') ? attrs.chat_state : {};
    const stateVal = this._chuoiKhongRongDauTien(chat.state, chat.chat_state, chat.status, this._chatWakeState, 'ready');
    this._chatWakeState = stateVal || 'ready';

    const buttonText = this._chuoiKhongRongDauTien(chat.button_text, chat.buttonText, this._chatWakeButtonText, 'Wake Up');
    this._chatWakeButtonText = buttonText || 'Wake Up';

    const buttonEnabled = chat.button_enabled ?? chat.buttonEnabled ?? chat.enabled;
    if (buttonEnabled !== undefined) {
      this._chatWakeButtonEnabled = this._epKieuBoolean(buttonEnabled, this._chatWakeButtonEnabled);
    }

    const testMicState = this._chuoiKhongRongDauTien(chat.test_mic_state, chat.testMicState, this._chatTestMicState);
    if (testMicState) this._chatTestMicState = testMicState;
    const testMicText = this._chuoiKhongRongDauTien(chat.test_mic_button_text, chat.testMicButtonText, chat.test_mic_text, this._chatTestMicButtonText, 'Test Mic');
    this._chatTestMicButtonText = testMicText || 'Test Mic';

    const tiktokVal = chat.tiktok_reply_enabled ?? chat.tiktokReplyEnabled ?? attrs.tiktok_reply_enabled;
    if (tiktokVal !== undefined) {
      this._tiktokReplyEnabled = this._epKieuBoolean(tiktokVal, this._tiktokReplyEnabled);
    }

    const bgVal = attrs.chat_background ?? attrs.chat_background_image ?? attrs.chat_bg_base64;
    if (typeof bgVal === 'string') {
      this._chatBgBase64 = bgVal;
      this._chatBackgroundLoaded = true;
    }

    this._kichHoatHieuUngCamXucChoTinNhanMoi();
  },

  async _initLive2D() {
    if (!this._live2dManager) {
      try {
        const baseUrl = new URL('.', import.meta.url).href;
        const loadScript = (src) => new Promise((resolve, reject) => {
          if (document.querySelector(`script[src="${baseUrl + src}"]`)) { resolve(); return; }
          const script = document.createElement('script');
          script.src = baseUrl + src;
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
        if (!window.PIXI) await loadScript('pixi.js');
        if (!window.Live2DCubismCore) await loadScript('live2dcubismcore.min.js');
        if (!window.PIXI || !window.PIXI.live2d) await loadScript('cubism4.min.js');
        if (!window.Live2DManager) await loadScript('live2d.js');
        if (window.Live2DManager) {
          this._live2dManager = new window.Live2DManager();
          if (this._activeTab === 'chat') this._veGiaoDien();
        }
      } catch (e) {
        console.error('ESP32 AIBox: Lỗi tải thư viện Live2D', e);
      }
    }
  },

  _veLive2DChoChat() {
    setTimeout(() => {
      if (this._live2dManager && this._live2dManager.live2dApp) {
        const live2dWrapper = this.shadowRoot.getElementById('live2d-wrapper');
        if (live2dWrapper && this._live2dManager.live2dApp.view) {
          live2dWrapper.innerHTML = '';
          live2dWrapper.appendChild(this._live2dManager.live2dApp.view);
        }
      }
      this._cuonCuoiKhungChat(false);
    }, 100);
  },

  _chuanHoaChatMuc(item, fallbackRole = 'server') {
    const source = item && typeof item === 'object' ? item : {};
    const content = this._chuoiKhongRongDauTien(source.content, source.message, source.text, source.msg);
    if (!content) return null;

    const roleRaw = this._chuoiKhongRongDauTien(source.message_type, source.role, source.sender, fallbackRole).toLowerCase();
    let role = 'server';
    if (['user', 'human', 'client', 'me', 'self', 'requester'].includes(roleRaw)) role = 'user';
    else if (['assistant', 'ai', 'bot', 'server', 'model'].includes(roleRaw)) role = 'server';
    else if (['system', 'notice', 'status', 'event', 'warn', 'warning', 'error'].includes(roleRaw)) role = 'system';
    else role = fallbackRole === 'user' ? 'user' : (fallbackRole === 'system' ? 'system' : 'server');

    const timestamp = source.ts ?? source.timestamp ?? source.time ?? source.created_at ?? source.createdAt;
    const normalized = { ...source, content, message_type: role, role, sender: role };
    if (timestamp !== undefined && timestamp !== null && String(timestamp).trim() !== '') normalized.ts = timestamp;
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
    return merged.slice(-120);
  },

  _taoChuKyChatHistory(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    const last = items[items.length - 1] || {};
    return `${items.length}|${last.ts || ''}|${last.message_type || last.role || ''}|${last.content || last.message || ''}`;
  },

  _dongBoLichSuChatTuEntity(items) {
    if (!Array.isArray(items)) return;
    const hasLocalEcho = this._chatHistory.some((item) => this._epKieuBoolean(item?._local_echo, false));
    this._chatHistory = hasLocalEcho ? this._hopNhatLichSuChat(this._chatHistory, items) : this._hopNhatLichSuChat(items);
    this._chatHistoryLoaded = true;
  },

  _themTinNhanChatTam(content, role = 'user') {
    const item = this._chuanHoaChatMuc({
      content,
      message_type: role,
      ts: Date.now(),
      _local_echo: true,
      _local_echo_id: `local-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    }, role);
    if (!item) return;
    this._chatHistory = this._hopNhatLichSuChat(this._chatHistory, [item]);
    this._chatHistoryLoaded = true;
  },

  _parseEmotionFromContent(content) {
    if (!content || typeof content !== 'string') return null;
    const emojiToEmotionMap = {
      '😊': 'happy', '😢': 'sad', '😠': 'angry', '😲': 'surprised',
      '😂': 'laughing', '🥰': 'loving', '😳': 'embarrassed', '😐': 'neutral',
      '😍': 'loving', '😎': 'happy', '🙂': 'happy', '😅': 'embarrassed',
    };
    const trimmed = content.trim();
    if (!trimmed) return null;
    const firstChar = trimmed.charAt(0);
    if (firstChar && emojiToEmotionMap[firstChar]) return emojiToEmotionMap[firstChar];
    const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/u;
    const emojiMatch = trimmed.match(emojiRegex);
    return emojiMatch ? (emojiToEmotionMap[emojiMatch[0]] || null) : null;
  },

  _kichHoatHieuUngCamXucChoTinNhanMoi() {
    const lastAi = [...this._chatHistory].reverse().find((item) => ['server', 'assistant', 'ai', 'bot'].includes(String(item?.message_type || item?.role || '').toLowerCase()));
    if (!lastAi) return;
    const signature = `${lastAi.ts || ''}|${lastAi.content || ''}`;
    if (!signature || signature === this._lastRenderedAiSignature) return;
    this._lastRenderedAiSignature = signature;
    const emotion = this._parseEmotionFromContent(lastAi.content || '');
    if (!emotion) return;
    const now = Date.now();
    if (this._lastEmotionActionTime && now - this._lastEmotionActionTime < 5000) return;
    if (this._live2dManager && typeof this._live2dManager.triggerEmotionAction === 'function') {
      this._live2dManager.triggerEmotionAction(emotion);
      this._lastEmotionActionTime = now;
    }
  },

  _layTrangThaiCuonChat() {
    const historyEl = this.shadowRoot?.getElementById('chat-messages-container');
    if (!historyEl) {
      return {
        pinned: this._chatScrollPinnedToBottom,
        offset: this._chatLastKnownOffsetFromBottom,
      };
    }
    const maxScroll = Math.max(0, historyEl.scrollHeight - historyEl.clientHeight);
    const offset = Math.max(0, maxScroll - historyEl.scrollTop);
    const pinned = offset <= 24;
    this._chatScrollPinnedToBottom = pinned;
    this._chatLastKnownOffsetFromBottom = offset;
    return { pinned, offset };
  },

  _phucHoiTrangThaiCuonChat(state) {
    const historyEl = this.shadowRoot?.getElementById('chat-messages-container');
    if (!historyEl) return;
    const saved = state || { pinned: this._chatScrollPinnedToBottom, offset: this._chatLastKnownOffsetFromBottom };
    requestAnimationFrame(() => {
      const maxScroll = Math.max(0, historyEl.scrollHeight - historyEl.clientHeight);
      if (this._chatForceScroll || saved?.pinned) {
        historyEl.scrollTop = historyEl.scrollHeight;
      } else {
        historyEl.scrollTop = Math.max(0, maxScroll - Number(saved?.offset || 0));
      }
      this._chatForceScroll = false;
      this._layTrangThaiCuonChat();
    });
  },

  async _damBaoTrangThaiChat() {
    const now = Date.now();
    const chat = this._thuocTinh().chat_state || {};
    const hasState = Object.keys(chat).length > 0;
    const isEditing = this._dangSuaOInputVanBan?.() && this._activeTab === 'chat';
    const shouldFetchState = (!hasState || now - this._lastChatStateRequestAt >= 10000);
    const shouldFetchHistory = (!this._chatHistoryLoaded || now - this._lastChatHistoryRequestAt >= 18000) && !isEditing;
    const shouldFetchBackground = (!this._chatBackgroundLoaded && now - this._chatBackgroundRequestedAt >= 30000);

    if (!shouldFetchState && !shouldFetchHistory && !shouldFetchBackground) return;
    if (shouldFetchState) this._lastChatStateRequestAt = now;
    if (shouldFetchHistory) this._lastChatHistoryRequestAt = now;
    if (shouldFetchBackground) this._chatBackgroundRequestedAt = now;

    try {
      if (shouldFetchState) await this._goiDichVu('esp32_aibox_media_controller', 'chat_get_state');
      if (shouldFetchHistory) await this._goiDichVu('esp32_aibox_media_controller', 'chat_get_history');
      if (shouldFetchBackground) {
        try { await this._goiDichVu('esp32_aibox_media_controller', 'get_chat_background'); } catch (_) {}
      }
      await this._lamMoiEntity(120, 1, { minGapMs: 1200 });
    } catch (_) {}
  },

  async _guiTinNhanChat() {
    const text = (this._chatInput || '').trim();
    if (!text) return;
    this._themTinNhanChatTam(text, 'user');
    this._chatInput = '';
    this._chatForceScroll = true;
    this._lastChatHistoryRequestAt = 0;
    this._veGiaoDienGiuFocusChat();
    this._cuonCuoiKhungChat(true);
    try {
      await this._goiDichVu('esp32_aibox_media_controller', 'chat_send_text', { text });
      await this._lamMoiEntity(120, 1, { minGapMs: 800 });
      this._cuonCuoiKhungChat(true);
    } catch (_) {}
  },

  _veGiaoDienGiuFocusChat() {
    const root = this.shadowRoot;
    const input = root?.getElementById('chatInput');
    const scrollState = this._layTrangThaiCuonChat();
    const dangFocus = Boolean(input && root.activeElement === input);
    const viTriBatDau = dangFocus ? input.selectionStart ?? input.value.length : 0;
    const viTriKetThuc = dangFocus ? input.selectionEnd ?? input.value.length : viTriBatDau;

    this._pendingRender = false;
    this._veGiaoDien();

    const inputMoi = this.shadowRoot?.getElementById('chatInput');
    if (inputMoi) {
      inputMoi.focus();
      inputMoi.setSelectionRange(
        Math.max(0, Math.min(inputMoi.value.length, Number(viTriBatDau))),
        Math.max(0, Math.min(inputMoi.value.length, Number(viTriKetThuc))),
      );
    }
    this._phucHoiTrangThaiCuonChat(scrollState);
  },

  _cuonCuoiKhungChat(force = false) {
    if (!force && !this._chatScrollPinnedToBottom) return;
    this._chatForceScroll = this._chatForceScroll || force;
    requestAnimationFrame(() => {
      const historyEl = this.shadowRoot?.getElementById('chat-messages-container');
      if (!historyEl) return;
      historyEl.scrollTop = historyEl.scrollHeight;
      this._chatForceScroll = false;
      this._layTrangThaiCuonChat();
    });
  },

  _veTabChat() {
    const hasBg = !!this._chatBgBase64;
    const historyMarkup = this._chatHistory.length === 0
      ? `<div class="chat-empty-state"><strong>Chưa có lịch sử chat</strong><div class="chat-empty-sub">Nhấn Wake Up hoặc gửi tin nhắn để bắt đầu.</div></div>`
      : this._chatHistory.map((item) => {
          const role = String(item.message_type || item.role || 'server').toLowerCase();
          const isUser = role === 'user';
          const isSystem = role === 'system';
          const bubbleClass = isSystem
            ? 'system-bubble'
            : isUser
              ? (hasBg ? 'user-bubble transparent' : 'user-bubble')
              : (hasBg ? 'ai-bubble transparent' : 'ai-bubble');
          const meta = isSystem ? 'System' : (isUser ? 'Bạn' : 'AI');
          const icon = isSystem ? '•' : (isUser ? '✎' : '💬');
          return `
            <div class="chat-msg-row ${isSystem ? 'system' : (isUser ? 'user' : 'ai')}">
              <div class="chat-msg-stack">
                <div class="chat-msg-meta ${isSystem ? 'center' : ''}">${icon} ${this._maHoaHtml(meta)}</div>
                <div class="chat-bubble ${bubbleClass}">${this._maHoaHtml(item.content || item.message || '').replace(/\n/g, '<br>')}</div>
              </div>
            </div>`;
        }).join('');

    const wakeText = this._chuoiKhongRongDauTien(this._chatWakeButtonText, 'Wake Up');
    const testMicActive = ['recording', 'playing', 'interrupt', 'stop'].includes(String(this._chatTestMicState || '').toLowerCase());
    const testMicText = this._chuoiKhongRongDauTien(this._chatTestMicButtonText, 'Test Mic');

    return `
      <section class="panel panel-chat" style="padding:0;">
        <style>
          .chat-shell { position: relative; display: flex; flex-direction: column; height: 600px; border-radius: 18px; overflow: hidden; border: 1px solid var(--line); background: rgba(10,18,42,0.88); box-shadow: inset 0 0 0 1px rgba(129,140,248,0.08), 0 8px 24px rgba(15,23,42,0.28); }
          .chat-bg-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; z-index: 0; display: ${hasBg ? 'block' : 'none'}; opacity: 0.92; }
          .chat-bg-overlay { position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(2,6,23,0.18), rgba(2,6,23,0.52) 25%, rgba(2,6,23,0.1) 55%, rgba(2,6,23,0.46)); }
          .live2d-stage { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 2; pointer-events: none; }
          .chat-header { position: relative; z-index: 10; background: rgba(30,41,59,0.80); border-bottom: 1px solid rgba(99,102,241,0.18); padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; backdrop-filter: blur(4px); }
          .chat-title { font-size: 12px; font-weight: 800; color: #cbd5e1; display: flex; align-items: center; gap: 8px; }
          .chat-title ha-icon { color: #a78bfa; --mdc-icon-size: 16px; }
          .chat-tools { display:flex; align-items:center; gap:6px; }
          .chat-icon-btn { background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 4px; display: inline-flex; align-items: center; justify-content: center; transition: color 0.2s ease, transform 0.2s ease; }
          .chat-icon-btn:hover { color: #fff; transform: scale(1.05); }
          .chat-icon-btn ha-icon { --mdc-icon-size: 16px; }
          .chat-messages { flex: 1; position: relative; z-index: 10; overflow-y: auto; padding: 12px 10px 10px; display: flex; flex-direction: column; gap: 8px; background: rgba(2,6,23,0.32); scrollbar-width: thin; }
          .chat-empty-state { margin: auto; text-align: center; font-size: 12px; color: #e2e8f0; padding: 18px 16px; border-radius: 14px; background: rgba(2,6,23,0.42); backdrop-filter: blur(4px); border: 1px solid rgba(129,140,248,0.12); }
          .chat-empty-sub { color: #94a3b8; font-size: 11px; margin-top: 6px; }
          .chat-msg-row { display: flex; width: 100%; }
          .chat-msg-row.user { justify-content: flex-end; }
          .chat-msg-row.ai { justify-content: flex-start; }
          .chat-msg-row.system { justify-content: center; }
          .chat-msg-stack { max-width: 82%; display: flex; flex-direction: column; gap: 4px; }
          .chat-msg-row.user .chat-msg-stack { align-items: flex-end; }
          .chat-msg-row.ai .chat-msg-stack { align-items: flex-start; }
          .chat-msg-row.system .chat-msg-stack { align-items: center; }
          .chat-msg-meta { font-size: 10px; font-weight: 700; color: rgba(226,232,240,0.78); letter-spacing: 0.01em; }
          .chat-msg-meta.center { text-align: center; }
          .chat-bubble { max-width: 100%; padding: 10px 12px; font-size: 12px; border-radius: 14px; color: #fff; word-break: break-word; white-space: pre-wrap; line-height: 1.5; box-shadow: 0 8px 20px rgba(2,6,23,0.18); }
          .chat-bubble.transparent { backdrop-filter: blur(2px); background: rgba(2,6,23,0.22); }
          .user-bubble { background: linear-gradient(135deg, #2563eb, #3b82f6); border-top-right-radius: 6px; }
          .ai-bubble { background: linear-gradient(135deg, #16a34a, #22c55e); border-top-left-radius: 6px; }
          .system-bubble { background: rgba(217,119,6,0.22); border: 1px solid rgba(245,158,11,0.30); color: #fde68a; font-style: italic; text-align: center; }
          .user-bubble.transparent { border: 2px solid rgba(59,130,246,0.92); }
          .ai-bubble.transparent { border: 2px solid rgba(34,197,94,0.92); }
          .chat-footer { position: relative; z-index: 10; background: rgba(30,41,59,0.50); border-top: 1px solid rgba(99,102,241,0.18); padding: 8px; display: flex; flex-direction: column; gap: 8px; backdrop-filter: blur(4px); }
          .chat-input-row { display: flex; gap: 8px; }
          .chat-input { flex: 1; background: rgba(51,65,85,0.55); border: 1px solid rgba(99,102,241,0.22); color: #fff; border-radius: 10px; padding: 10px 12px; font-size: 12px; outline: none; min-height: 40px; }
          .chat-input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139,92,246,0.18); }
          .chat-send-btn { background: linear-gradient(135deg, #16a34a, #22c55e); color: #fff; border: none; border-radius: 10px; width: 46px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: filter 0.2s ease, transform 0.2s ease; box-shadow: 0 4px 12px rgba(34,197,94,0.25); }
          .chat-send-btn:hover { filter: brightness(1.08); transform: translateY(-1px); }
          .chat-send-btn ha-icon { --mdc-icon-size: 16px; }
          .chat-action-row { display: flex; gap: 8px; }
          .chat-action-btn { flex: 1; font-size: 12px; font-weight: 700; color: #fff; border: none; border-radius: 10px; padding: 9px 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: filter 0.2s ease, transform 0.2s ease; }
          .chat-action-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
          .chat-action-btn[disabled] { opacity: 0.56; cursor: not-allowed; transform: none; filter: none; }
          .accent-gradient { background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 12px rgba(99,102,241,0.28); }
          .bg-purple { background: linear-gradient(135deg, #9333ea, #a855f7); box-shadow: 0 4px 12px rgba(147,51,234,0.28); }
          .bg-red { background: linear-gradient(135deg, #dc2626, #ef4444); box-shadow: 0 4px 12px rgba(220,38,38,0.28); }
          .bg-green { background: rgba(22,163,74,0.86); border: 1px solid rgba(34,197,94,0.34); box-shadow: 0 4px 12px rgba(34,197,94,0.25); }
          .bg-slate { background: rgba(51,65,85,0.56); border: 1px solid rgba(99,102,241,0.18); }
        </style>
        <div class="chat-shell">
          <img class="chat-bg-img" src="${hasBg ? 'data:image/jpeg;base64,' + this._chatBgBase64 : ''}" alt="">
          <div class="chat-bg-overlay"></div>
          <div id="live2d-wrapper" class="live2d-stage"></div>
          <div class="chat-header">
            <span class="chat-title"><ha-icon icon="mdi:chat-processing"></ha-icon>Chat</span>
            <div class="chat-tools">
              <input type="file" id="chatBackgroundUpload" accept="image/*" style="display:none;">
              <button id="btnChatBackground" class="chat-icon-btn" title="Đổi ảnh nền" style="display:${hasBg ? 'none' : 'inline-flex'};"><ha-icon icon="mdi:image"></ha-icon></button>
              <button id="btnRemoveBackground" class="chat-icon-btn" title="Xóa ảnh nền" style="display:${hasBg ? 'inline-flex' : 'none'};"><ha-icon icon="mdi:image-off"></ha-icon></button>
              <button id="btnClearChat" class="chat-icon-btn" title="Xóa lịch sử hiển thị"><ha-icon icon="mdi:trash-can"></ha-icon></button>
            </div>
          </div>
          <div id="chat-messages-container" class="chat-messages">${historyMarkup}</div>
          <div class="chat-footer">
            <div class="chat-input-row">
              <input type="text" id="chatInput" class="chat-input" placeholder="Nhập tin nhắn..." value="${this._maHoaHtml(this._chatInput)}">
              <button id="chat-send" class="chat-send-btn"><ha-icon icon="mdi:send"></ha-icon></button>
            </div>
            <div class="chat-action-row">
              <button id="btnWakeUp" class="chat-action-btn accent-gradient" ${this._chatWakeButtonEnabled ? '' : 'disabled'}><ha-icon icon="mdi:microphone" style="--mdc-icon-size:14px; margin-right:4px;"></ha-icon>${this._maHoaHtml(wakeText)}</button>
              <button id="btnTestMic" class="chat-action-btn ${testMicActive ? 'bg-red' : 'bg-purple'}"><ha-icon icon="mdi:microphone-outline" style="--mdc-icon-size:14px; margin-right:4px;"></ha-icon>${this._maHoaHtml(testMicText)}</button>
            </div>
            <div class="chat-action-row">
              <button id="btnTiktokReply" class="chat-action-btn ${this._tiktokReplyEnabled ? 'bg-green' : 'bg-slate'}"><ha-icon icon="mdi:video" style="--mdc-icon-size:14px; margin-right:4px;"></ha-icon><span id="tiktokReplyText">TikTok Reply: ${this._tiktokReplyEnabled ? 'ON' : 'OFF'}</span></button>
            </div>
          </div>
        </div>
      </section>
    `;
  },

  _ganSuKienTabChat(root) {
    const historyEl = root.getElementById('chat-messages-container');
    historyEl?.addEventListener('scroll', () => { this._layTrangThaiCuonChat(); }, { passive: true });

    const chatInput = root.getElementById('chatInput');
    if (chatInput) {
      chatInput.addEventListener('compositionstart', () => { this._chatDangCompose = true; });
      chatInput.addEventListener('compositionend', (ev) => { this._chatDangCompose = false; this._chatInput = ev.target.value; });
      chatInput.addEventListener('input', (ev) => { this._chatInput = ev.target.value; });
      chatInput.addEventListener('keydown', async (ev) => {
        if (ev.isComposing || this._chatDangCompose) return;
        if (ev.key === 'Enter') {
          ev.preventDefault();
          if (this._chatInput.trim() !== '') await this._guiTinNhanChat();
        }
      });
      chatInput.addEventListener('focus', () => { this._layTrangThaiCuonChat(); });
      chatInput.addEventListener('blur', () => { setTimeout(() => this._xuLyRenderCho?.(), 0); });
    }

    root.getElementById('chat-send')?.addEventListener('click', async (ev) => {
      ev.preventDefault();
      if (this._chatInput.trim() !== '') await this._guiTinNhanChat();
    });

    root.getElementById('btnWakeUp')?.addEventListener('click', async () => {
      try {
        await this._goiDichVu('esp32_aibox_media_controller', 'chat_wake_up');
        this._lastChatStateRequestAt = 0;
        await this._lamMoiEntity(120, 1, { minGapMs: 800 });
      } catch (_) {}
    });

    root.getElementById('btnTestMic')?.addEventListener('click', async () => {
      try {
        await this._goiDichVu('esp32_aibox_media_controller', 'chat_test_mic');
        this._lastChatStateRequestAt = 0;
        await this._lamMoiEntity(120, 1, { minGapMs: 800 });
      } catch (_) {}
    });

    root.getElementById('btnTiktokReply')?.addEventListener('click', async () => {
      const nextEnabled = !this._tiktokReplyEnabled;
      this._tiktokReplyEnabled = nextEnabled;
      this._veGiaoDien();
      try {
        await this._goiDichVu('esp32_aibox_media_controller', 'tiktok_reply_toggle', { enabled: nextEnabled });
        await this._lamMoiEntity(120, 1, { minGapMs: 800 });
      } catch (_) {}
    });

    root.getElementById('btnClearChat')?.addEventListener('click', () => {
      this._chatHistory = [];
      this._chatHistoryLoaded = false;
      this._veGiaoDien();
    });

    const btnChatBackground = root.getElementById('btnChatBackground');
    const chatBackgroundUpload = root.getElementById('chatBackgroundUpload');
    if (btnChatBackground && chatBackgroundUpload) {
      btnChatBackground.addEventListener('click', () => chatBackgroundUpload.click());
      chatBackgroundUpload.addEventListener('change', async (ev) => {
        const file = ev.target.files?.[0];
        if (!file || !file.type.startsWith('image/')) return;
        if (file.size > 1024 * 1024) return;
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = String(reader.result || '').split(',')[1] || '';
          this._chatBgBase64 = base64;
          this._chatBackgroundLoaded = true;
          this._veGiaoDien();
          try {
            await this._goiDichVu('esp32_aibox_media_controller', 'upload_chat_background', { image: base64 });
            await this._lamMoiEntity(120, 1, { minGapMs: 800 });
          } catch (_) {}
        };
        reader.readAsDataURL(file);
        ev.target.value = '';
      });
    }

    root.getElementById('btnRemoveBackground')?.addEventListener('click', async () => {
      this._chatBgBase64 = '';
      this._chatBackgroundLoaded = true;
      this._veGiaoDien();
      try {
        await this._goiDichVu('esp32_aibox_media_controller', 'remove_chat_background');
        await this._lamMoiEntity(120, 1, { minGapMs: 800 });
      } catch (_) {}
    });
  },
};
