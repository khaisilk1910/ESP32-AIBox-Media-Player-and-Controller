const SYSTEM_VIETNAM_PROVINCES = [{"name": "An Giang", "lat": 10.5149, "lon": 105.1132}, {"name": "Bà Rịa - Vũng Tàu", "lat": 10.582, "lon": 107.29}, {"name": "Bắc Giang", "lat": 21.3093, "lon": 106.6165}, {"name": "Bắc Kạn", "lat": 22.2572, "lon": 105.8589}, {"name": "Bạc Liêu", "lat": 9.3477, "lon": 105.5097}, {"name": "Bắc Ninh", "lat": 21.1212, "lon": 106.088}, {"name": "Bến Tre", "lat": 10.1094, "lon": 106.5526}, {"name": "Bình Định", "lat": 14.1525, "lon": 108.924}, {"name": "Bình Dương", "lat": 11.2241, "lon": 106.6675}, {"name": "Bình Phước", "lat": 11.679, "lon": 106.7976}, {"name": "Bình Thuận", "lat": 11.1015, "lon": 107.9416}, {"name": "Cà Mau", "lat": 9.0875, "lon": 105.032}, {"name": "Cần Thơ", "lat": 10.0907, "lon": 105.5799}, {"name": "Cao Bằng", "lat": 22.7731, "lon": 106.0017}, {"name": "Đà Nẵng", "lat": 16.0544, "lon": 108.2022}, {"name": "Đắk Lắk", "lat": 12.8399, "lon": 108.2285}, {"name": "Đắk Nông", "lat": 12.1289, "lon": 107.5874}, {"name": "Điện Biên", "lat": 21.721, "lon": 103.0411}, {"name": "Đồng Nai", "lat": 11.0063, "lon": 107.1922}, {"name": "Đồng Tháp", "lat": 10.6267, "lon": 105.6316}, {"name": "Gia Lai", "lat": 13.7964, "lon": 108.2608}, {"name": "Hà Giang", "lat": 22.6069, "lon": 104.7995}, {"name": "Hà Nam", "lat": 20.5269, "lon": 105.9544}, {"name": "Hà Nội", "lat": 21.0285, "lon": 105.8542}, {"name": "Hà Tĩnh", "lat": 18.2879, "lon": 105.7843}, {"name": "Hải Dương", "lat": 20.9444, "lon": 106.378}, {"name": "Hải Phòng", "lat": 20.8449, "lon": 106.6881}, {"name": "Hậu Giang", "lat": 9.7633, "lon": 105.638}, {"name": "Hòa Bình", "lat": 20.6609, "lon": 105.3925}, {"name": "Hồ Chí Minh", "lat": 10.8231, "lon": 106.6297}, {"name": "Hưng Yên", "lat": 20.8193, "lon": 106.0315}, {"name": "Khánh Hòa", "lat": 12.1961, "lon": 108.995}, {"name": "Kiên Giang", "lat": 9.9114, "lon": 105.2534}, {"name": "Kon Tum", "lat": 14.6995, "lon": 107.9324}, {"name": "Lai Châu", "lat": 22.3049, "lon": 102.9629}, {"name": "Lâm Đồng", "lat": 11.6938, "lon": 108.1528}, {"name": "Lạng Sơn", "lat": 21.8567, "lon": 106.4424}, {"name": "Lào Cai", "lat": 22.2968, "lon": 104.0566}, {"name": "Long An", "lat": 10.5602, "lon": 106.4049}, {"name": "Nam Định", "lat": 20.2712, "lon": 106.163}, {"name": "Nghệ An", "lat": 19.3739, "lon": 104.9233}, {"name": "Ninh Bình", "lat": 20.1845, "lon": 105.9803}, {"name": "Ninh Thuận", "lat": 11.745, "lon": 108.8983}, {"name": "Phú Thọ", "lat": 21.3212, "lon": 105.1267}, {"name": "Phú Yên", "lat": 13.2127, "lon": 109.0834}, {"name": "Quảng Bình", "lat": 17.5463, "lon": 106.2576}, {"name": "Quảng Nam", "lat": 15.5973, "lon": 107.9758}, {"name": "Quảng Ngãi", "lat": 14.9635, "lon": 108.6643}, {"name": "Quảng Ninh", "lat": 21.1718, "lon": 107.2013}, {"name": "Quảng Trị", "lat": 16.8581, "lon": 106.8589}, {"name": "Sóc Trăng", "lat": 9.5868, "lon": 105.9468}, {"name": "Sơn La", "lat": 21.1509, "lon": 103.8884}, {"name": "Tây Ninh", "lat": 11.4046, "lon": 106.0034}, {"name": "Thái Bình", "lat": 20.5297, "lon": 106.3876}, {"name": "Thái Nguyên", "lat": 21.6499, "lon": 105.8351}, {"name": "Thanh Hóa", "lat": 20.1072, "lon": 105.2124}, {"name": "Thừa Thiên Huế", "lat": 16.3375, "lon": 107.5564}, {"name": "Tiền Giang", "lat": 10.4493, "lon": 106.3421}, {"name": "Trà Vinh", "lat": 9.7705, "lon": 106.3564}, {"name": "Tuyên Quang", "lat": 22.1257, "lon": 105.209}, {"name": "Vĩnh Long", "lat": 10.2394, "lon": 105.9572}, {"name": "Vĩnh Phúc", "lat": 21.3114, "lon": 105.6033}, {"name": "Yên Bái", "lat": 21.8014, "lon": 104.5148}];

export const TabSystemMixin = {
  // === STATE ===
  _khoiTaoTrangThaiSystem() {
    this._lastSystemStateRequestAt = 0;

    this._systemOpenSections = {
      alarms: true,
      ota: true,
      mac: true,
      weather: true,
      hass: false,
      wifi: false,
    };

    this._systemAlarmBanner = { active: false, title: '', message: '' };
    this._systemAlarms = [];
    this._systemAlarmModal = {
      open: false,
      mode: 'add',
      id: '',
      hour: '07',
      minute: '00',
      repeat: 'none',
      label: '',
      volume: 100,
      selectedDays: [],
      youtubeSongName: '',
      customSoundPath: '',
      currentSoundLabel: 'Đang dùng: Mặc định (alarm.mp3)',
      pendingFileName: '',
      removeCurrentSound: false,
    };

    this._systemWifi = {
      currentSsid: '',
      ipAddress: '',
      isConnected: false,
      apModeActive: false,
      apSsid: 'Phicomm-R1',
      apIp: '',
      scannedNetworks: [],
      savedNetworks: [],
      ssidInput: '',
      passwordInput: '',
      securityType: 'wpa',
    };

    this._systemOta = {
      currentOtaUrl: '',
      options: [
        'https://api.tenclass.net/xiaozhi/ota/',
        'https://me.ai-box.vn/xiaozhi/ota/',
      ],
      selectedOtaUrl: '',
    };

    this._systemMac = {
      macAddress: 'Đang tải...',
      isCustom: false,
      macTypeLabel: '--',
    };

    this._systemWeather = {
      name: '',
      lat: 0,
      lon: 0,
      provinces: Array.isArray(SYSTEM_VIETNAM_PROVINCES) ? SYSTEM_VIETNAM_PROVINCES.slice() : [],
      selectedValue: '',
    };

    this._systemMonitor = {
      ramPercent: null,
      cpuPercent: null,
      updatedAtMs: 0,
      status: 'idle',
      connected: false,
      rawText: '',
    };

    this._systemHass = {
      url: '',
      apiKeyMasked: '',
      agentId: '',
      configured: false,
      apiKeyDraft: '',
    };

    this._systemLedEnabled = false;
  },

  async _damBaoTrangThaiHeThong() {
    const now = Date.now();
    if (now - this._lastSystemStateRequestAt < 7000) return;
    this._lastSystemStateRequestAt = now;
    this._dongBoTrangThaiSystemTuEntity?.();
    try {
      await this._goiMotTrongCacDichVu([
        'refresh_state',
        'system_refresh_state',
        'get_system_state',
      ], {}, ['esp32_aibox_media_controller', 'media_player']);
    } catch (_) {}
    try { await this._lamMoiEntity(250, 2); } catch (_) {}
    try {
      await this._taiDanhSachTinhThanhThoiTiet();
    } catch (_) {}
  },

  _dongBoTrangThaiSystemTuEntity() {
    const attrs = this._thuocTinh?.() || {};

    const monitor = this._docPayloadSystem(
      attrs.system_monitor,
      attrs.system_stats,
      attrs.systemMonitor,
      attrs.monitor,
    );
    if (monitor && typeof monitor === 'object') {
      const ramPercent = Number.isFinite(Number(monitor.ram_percent ?? monitor.ramPercent))
        ? Math.max(0, Math.min(100, Number(monitor.ram_percent ?? monitor.ramPercent)))
        : this._systemMonitor.ramPercent;
      const cpuPercent = Number.isFinite(Number(monitor.cpu_percent ?? monitor.cpuPercent))
        ? Math.max(0, Math.min(100, Number(monitor.cpu_percent ?? monitor.cpuPercent)))
        : this._systemMonitor.cpuPercent;
      this._systemMonitor = {
        ...this._systemMonitor,
        ramPercent,
        cpuPercent,
        updatedAtMs: Number(monitor.updated_at_ms ?? monitor.updatedAtMs ?? this._systemMonitor.updatedAtMs ?? 0) || 0,
        connected: this._epKieuBoolean(monitor.connected ?? monitor.success ?? true, this._systemMonitor.connected),
        status: String(monitor.status || (this._epKieuBoolean(monitor.connected ?? true, true) ? 'online' : 'offline')),
        rawText: String(monitor.raw_text ?? monitor.rawText ?? this._systemMonitor.rawText ?? ''),
      };
    }

    const ledState = this._chonGiaTriDauTien(
      attrs.led_state,
      attrs.led,
      attrs.standby_led,
      attrs.ledCho,
      attrs.led_cho,
    );
    if (ledState && typeof ledState === 'object') {
      this._systemLedEnabled = this._epKieuBoolean(
        ledState.enabled ?? ledState.state ?? ledState.value,
        this._systemLedEnabled,
      );
    } else if (ledState !== undefined) {
      this._systemLedEnabled = this._epKieuBoolean(ledState, this._systemLedEnabled);
    } else {
      this._systemLedEnabled = this._ledChoEnabled ?? this._systemLedEnabled;
    }

    const ota = this._docPayloadSystem(
      attrs.ota_config,
      attrs.ota,
      attrs.ota_state,
      attrs.system_ota,
    );
    const otaUrl = this._chuoiKhongRongDauTien(
      ota.ota_url,
      ota.current_ota_url,
      ota.url,
      this._systemOta.currentOtaUrl,
    );
    const otaOptions = Array.isArray(ota.options) && ota.options.length > 0 ? ota.options : this._systemOta.options;
    this._systemOta = {
      ...this._systemOta,
      currentOtaUrl: otaUrl,
      options: otaOptions,
      selectedOtaUrl: this._systemOta.selectedOtaUrl || otaUrl || otaOptions[0] || '',
    };

    const mac = this._docPayloadSystem(
      attrs.mac_info,
      attrs.mac_state,
      attrs.mac,
      attrs.system_mac,
    );
    const macAddress = this._chuoiKhongRongDauTien(
      mac.mac_address,
      mac.address,
      mac.mac,
      this._systemMac.macAddress,
      'Đang tải...',
    );
    const isCustom = this._epKieuBoolean(mac.is_custom ?? mac.custom ?? mac.randomized, this._systemMac.isCustom);
    this._systemMac = {
      macAddress,
      isCustom,
      macTypeLabel: isCustom ? '🔀 Custom MAC (Random)' : '📡 Real MAC (Hardware)',
    };

    const weather = this._docPayloadSystem(
      attrs.weather_province,
      attrs.weather_province_state,
      attrs.weather_location,
      attrs.system_weather,
    );
    const weatherName = this._chuoiKhongRongDauTien(weather.name, weather.province, weather.city, this._systemWeather.name);
    const weatherLat = this._epKieuSo(weather.lat ?? weather.latitude, this._systemWeather.lat);
    const weatherLon = this._epKieuSo(weather.lon ?? weather.lng ?? weather.longitude, this._systemWeather.lon);
    const matchedWeatherProvince = this._timTinhThanhTheoGiaTri(weatherName, weatherLat, weatherLon);
    this._systemWeather = {
      ...this._systemWeather,
      name: weatherName,
      lat: weatherLat,
      lon: weatherLon,
      selectedValue: matchedWeatherProvince
        ? this._giaTriLuaChonTinhThanh(matchedWeatherProvince)
        : (weatherName && Number.isFinite(weatherLat) && Number.isFinite(weatherLon)
          ? JSON.stringify({ name: weatherName, lat: weatherLat, lon: weatherLon })
          : ''),
    };

    const hass = this._docPayloadSystem(
      attrs.hass_config,
      attrs.hass,
      attrs.home_assistant,
      attrs.system_hass,
    );
    const hassUrl = this._chuoiKhongRongDauTien(hass.url, hass.host, this._systemHass.url);
    const hassAgentId = this._chuoiKhongRongDauTien(hass.agent_id, hass.agentId, this._systemHass.agentId);
    const hassApiKey = this._chuoiKhongRongDauTien(hass.api_key, hass.apiKey, '');
    const configured = this._epKieuBoolean(hass.configured ?? (hassUrl && (hassApiKey || this._systemHass.apiKeyMasked)), this._systemHass.configured);
    this._systemHass = {
      ...this._systemHass,
      url: hassUrl,
      agentId: hassAgentId,
      configured,
      apiKeyMasked: hassApiKey === '***' ? '***' : (hassApiKey ? '***' : this._systemHass.apiKeyMasked),
    };

    const wifi = this._docPayloadSystem(
      attrs.wifi_status,
      attrs.wifi,
      attrs.network,
      attrs.system_wifi,
    );
    const wifiScanned = Array.isArray(wifi.networks) ? wifi.networks : (Array.isArray(wifi.scanned_networks) ? wifi.scanned_networks : this._systemWifi.scannedNetworks);
    const wifiSaved = Array.isArray(wifi.saved_networks) ? wifi.saved_networks : (Array.isArray(wifi.saved) ? wifi.saved : this._systemWifi.savedNetworks);
    this._systemWifi = {
      ...this._systemWifi,
      currentSsid: this._chuoiKhongRongDauTien(wifi.current_ssid, wifi.ssid, this._systemWifi.currentSsid),
      ipAddress: this._chuoiKhongRongDauTien(wifi.ip_address, wifi.ip, this._systemWifi.ipAddress),
      isConnected: this._epKieuBoolean(wifi.is_connected ?? wifi.connected ?? wifi.online, this._systemWifi.isConnected),
      apModeActive: this._epKieuBoolean(wifi.ap_mode_active ?? wifi.ap_active, this._systemWifi.apModeActive),
      apSsid: this._chuoiKhongRongDauTien(wifi.ap_ssid, wifi.hotspot_ssid, this._systemWifi.apSsid || 'Phicomm-R1'),
      apIp: this._chuoiKhongRongDauTien(wifi.ap_ip, wifi.hotspot_ip, this._systemWifi.apIp),
      scannedNetworks: wifiScanned,
      savedNetworks: wifiSaved,
    };

    const alarms = this._docPayloadSystem(
      attrs.alarm_list,
      attrs.alarms,
      attrs.alarm_state,
      attrs.system_alarms,
    );
    if (Array.isArray(alarms)) {
      this._systemAlarms = alarms;
    } else if (Array.isArray(alarms.alarms)) {
      this._systemAlarms = alarms.alarms;
    }

    const banner = this._docPayloadSystem(
      attrs.alarm_banner,
      attrs.active_alarm,
      attrs.alarm_triggered,
    );
    if (banner && typeof banner === 'object' && this._epKieuBoolean(banner.active ?? banner.triggered, false)) {
      this._systemAlarmBanner = {
        active: true,
        title: this._chuoiKhongRongDauTien(banner.message, 'Báo thức'),
        message: this._chuoiKhongRongDauTien(
          banner.time ? `Thời gian: ${banner.time}${banner.alarm_label ? ` - ${banner.alarm_label}` : ''}` : '',
          banner.label,
          this._systemAlarmBanner.message,
        ),
      };
    }
  },

  async _taiDanhSachTinhThanhThoiTiet() {
    if (Array.isArray(this._systemWeather.provinces) && this._systemWeather.provinces.length > 0) return;
    this._systemWeather.provinces = Array.isArray(SYSTEM_VIETNAM_PROVINCES) ? SYSTEM_VIETNAM_PROVINCES.slice() : [];
    if (this._activeTab === 'system') this._veGiaoDien();
  },

  // === RENDER ===
  _veTabHeThong() {
    this._dongBoTrangThaiSystemTuEntity();
    const otaOptions = Array.isArray(this._systemOta.options) && this._systemOta.options.length > 0 ? this._systemOta.options : [this._systemOta.currentOtaUrl].filter(Boolean);
    const provinces = Array.isArray(this._systemWeather.provinces) ? this._systemWeather.provinces : [];
    const scannedNetworks = this._layDanhSachWifiQuetHienThi();
    const modal = this._systemAlarmModal || {};
    const monitor = this._systemMonitor || {};
    const ramPercent = Number.isFinite(Number(monitor.ramPercent)) ? Math.max(0, Math.min(100, Number(monitor.ramPercent))) : null;
    const cpuPercent = Number.isFinite(Number(monitor.cpuPercent)) ? Math.max(0, Math.min(100, Number(monitor.cpuPercent))) : null;
    const monitorOnline = this._epKieuBoolean(monitor.connected ?? (monitor.status !== 'offline'), false);
    const monitorUpdatedText = monitor.updatedAtMs ? new Date(monitor.updatedAtMs).toLocaleTimeString() : 'Chưa có dữ liệu';

    return `
      <section class="panel panel-system">
        <style>
          .panel-system { display: grid; gap: 10px; }
          .system-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
          .system-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
          .system-title { margin: 0; font-size: 16px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
          .system-toggle-btn { border: 1px solid var(--line); border-radius: 10px; background: var(--bg-tile); color: var(--text); padding: 6px 10px; font-size: 11px; font-weight: 700; cursor: pointer; }
          .system-note { color: var(--muted); font-size: 11px; line-height: 1.45; }
          .system-muted { color: var(--muted); }
          .system-value { font-size: 12px; font-weight: 700; word-break: break-word; }
          .system-code { font-family: monospace; font-size: 11px; word-break: break-all; }
          .system-pill { border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 800; border: 1px solid var(--line); }
          .system-pill.ok { background: rgba(34,197,94,0.15); color: #4ade80; border-color: rgba(34,197,94,0.25); }
          .system-pill.warn { background: rgba(251,191,36,0.15); color: #fbbf24; border-color: rgba(251,191,36,0.25); }
          .system-pill.off { background: rgba(148,163,184,0.12); color: var(--muted); }
          .system-card-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
          .system-list { display: grid; gap: 8px; }
          .system-item { border: 1px solid var(--line); border-radius: 14px; background: rgba(255,255,255,0.02); padding: 10px; }
          .system-item-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .system-item-title { font-size: 13px; font-weight: 800; }
          .system-item-sub { font-size: 11px; color: var(--muted); }
          .system-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 0; }
          .system-form { display: grid; gap: 8px; }
          .system-input, .system-select, .system-textarea {
            width: 100%; border: 1px solid var(--line); border-radius: 12px; background: var(--input-bg);
            color: var(--text); padding: 10px 12px; font-size: 12px; outline: none;
          }
          .system-textarea { min-height: 88px; resize: vertical; }
          .system-two-col { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
          .system-three-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
          .system-empty { color: var(--muted); font-size: 12px; text-align: center; padding: 14px 8px; border: 1px dashed var(--line); border-radius: 12px; }
          .system-badge-inline { display: inline-flex; align-items: center; gap: 6px; }
          .alarm-banner { border: 1px solid rgba(239,68,68,0.35); background: linear-gradient(135deg, rgba(239,68,68,0.22), rgba(249,115,22,0.14)); }
          .alarm-days { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
          .alarm-day { display: flex; align-items: center; justify-content: center; min-height: 34px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-tile); cursor: pointer; font-size: 11px; font-weight: 700; }
          .alarm-day input { display: none; }
          .alarm-day.is-active { background: var(--accent); color: #fff; border-color: transparent; }
          .alarm-modal-backdrop {
            position: fixed; inset: 0; background: rgba(2,6,23,0.72); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center; padding: 16px; z-index: 9999;
          }
          .alarm-modal {
            width: min(720px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: 20px;
            border: 1px solid var(--line); background: var(--bg-card); color: var(--text); padding: 14px;
            box-shadow: 0 18px 48px rgba(0,0,0,0.35);
          }
          .alarm-modal-title { margin: 0; font-size: 18px; font-weight: 800; }
          .system-divider { height: 1px; background: var(--line); margin: 10px 0; }
          .wpa-hint { font-size: 10px; color: var(--muted); }
          .system-monitor-dot { width: 10px; height: 10px; border-radius: 999px; background: #64748b; box-shadow: 0 0 0 2px rgba(255,255,255,0.05); }
          .system-monitor-dot.is-online { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.18); }
          .system-progress { width: 100%; height: 10px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
          .system-progress-bar { height: 100%; border-radius: 999px; transition: width 0.35s ease; }
          .system-progress-bar.ram { background: linear-gradient(90deg, #60a5fa, #8b5cf6); }
          .system-progress-bar.cpu { background: linear-gradient(90deg, #a78bfa, #c084fc); }
          @media (max-width: 520px) {
            .system-two-col, .system-three-col, .alarm-days { grid-template-columns: 1fr 1fr; }
          }
        </style>

        <div class="tile">
          <div class="system-section-head">
            <h4 class="system-title"><ha-icon icon="mdi:microchip"></ha-icon> System Monitor</h4>
            <div class="system-badge-inline">
              <span class="system-note">${this._maHoaHtml(monitorUpdatedText)}</span>
              <span class="system-monitor-dot ${monitorOnline ? 'is-online' : ''}"></span>
            </div>
          </div>
          <div class="system-form">
            <div>
              <div class="system-row" style="margin:0 0 6px 0;"><span class="system-muted">RAM Usage</span><strong>${ramPercent === null ? '--%' : `${Math.round(ramPercent)}%`}</strong></div>
              <div class="system-progress"><div class="system-progress-bar ram" style="width:${ramPercent === null ? 0 : ramPercent}%"></div></div>
            </div>
            <div>
              <div class="system-row" style="margin:0 0 6px 0;"><span class="system-muted">CPU Load</span><strong>${cpuPercent === null ? '--%' : `${Math.round(cpuPercent)}%`}</strong></div>
              <div class="system-progress"><div class="system-progress-bar cpu" style="width:${cpuPercent === null ? 0 : cpuPercent}%"></div></div>
            </div>
            <div class="system-card-actions">
              <button id="system-reboot" class="danger-btn hover-scale"><ha-icon icon="mdi:restart"></ha-icon> Reboot</button>
              <button id="system-monitor-refresh" class="mini-btn hover-pop">Làm mới</button>
            </div>
          </div>
        </div>

        ${this._systemAlarmBanner.active ? `
          <div class="tile alarm-banner">
            <div class="system-section-head" style="margin-bottom:0;">
              <div>
                <div class="system-title"><ha-icon icon="mdi:bell-ring"></ha-icon>${this._maHoaHtml(this._systemAlarmBanner.title || 'Báo thức')}</div>
                <div class="system-note">${this._maHoaHtml(this._systemAlarmBanner.message || 'Đang phát báo thức...')}</div>
              </div>
              <button id="alarm-stop-active" class="danger-btn hover-scale"><ha-icon icon="mdi:stop"></ha-icon>Dừng</button>
            </div>
          </div>
        ` : ''}


        <div class="system-grid">
          <div class="tile">
            <div class="system-section-head">
              <h4 class="system-title"><ha-icon icon="mdi:bell-outline"></ha-icon> Báo thức</h4>
              <button class="system-toggle-btn" data-system-toggle="alarms">${this._systemOpenSections.alarms ? 'Ẩn' : 'Hiện'}</button>
            </div>
            ${this._systemOpenSections.alarms ? `
              <div class="system-card-actions">
                <button id="alarm-add" class="mini-btn mini-btn-accent"><ha-icon icon="mdi:plus"></ha-icon></button>
                <button id="alarm-refresh" class="mini-btn hover-pop">Làm mới</button>
              </div>
              <div class="system-list" style="margin-top:10px;">
                ${this._systemAlarms.length ? this._systemAlarms.map((alarm, idx) => this._renderAlarmItem(alarm, idx)).join('') : `<div class="system-empty">Chưa có báo thức nào.</div>`}
              </div>
            ` : ''}
          </div>

          <div class="tile">
            <div class="system-section-head">
              <h4 class="system-title"><ha-icon icon="mdi:cloud-upload-outline"></ha-icon> OTA Server</h4>
              <button class="system-toggle-btn" data-system-toggle="ota">${this._systemOpenSections.ota ? 'Ẩn' : 'Hiện'}</button>
            </div>
            ${this._systemOpenSections.ota ? `
              <div class="system-row"><span class="system-muted">OTA URL hiện tại</span><span class="system-pill ${this._systemOta.currentOtaUrl ? 'ok' : 'off'}">${this._systemOta.currentOtaUrl ? 'Đã có' : 'Chưa có'}</span></div>
              <div class="system-value system-code">${this._maHoaHtml(this._systemOta.currentOtaUrl || 'Đang tải...')}</div>
              <div class="system-form" style="margin-top:10px;">
                <select id="system-ota-select" class="system-select">
                  ${otaOptions.map((url) => `<option value="${this._maHoaHtml(url)}" ${String(this._systemOta.selectedOtaUrl || this._systemOta.currentOtaUrl) === String(url) ? 'selected' : ''}>${this._maHoaHtml(this._tenHienThiOta(url))}</option>`).join('')}
                </select>
                <div class="system-card-actions">
                  <button id="system-ota-refresh" class="mini-btn hover-pop">Làm mới</button>
                  <button id="system-ota-save" class="mini-btn mini-btn-accent"><ha-icon icon="mdi:content-save"></ha-icon></button>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="tile">
            <div class="system-section-head">
              <h4 class="system-title"><ha-icon icon="mdi:network-outline"></ha-icon> MAC Address</h4>
              <button class="system-toggle-btn" data-system-toggle="mac">${this._systemOpenSections.mac ? 'Ẩn' : 'Hiện'}</button>
            </div>
            ${this._systemOpenSections.mac ? `
              <div class="system-value system-code">${this._maHoaHtml(this._systemMac.macAddress || 'Đang tải...')}</div>
              <div class="system-note" style="margin-top:4px;">${this._maHoaHtml(this._systemMac.macTypeLabel || '--')}</div>
              <div class="system-card-actions">
                <button id="system-mac-random" class="mini-btn mini-btn-accent"><ha-icon icon="mdi:shuffle-variant"></ha-icon></button>
                <button id="system-mac-refresh" class="mini-btn hover-pop">Làm mới</button>
                <button id="system-mac-clear" class="mini-btn hover-pop">Dùng MAC thực</button>
              </div>
            ` : ''}
          </div>

          <div class="tile">
            <div class="system-section-head">
              <h4 class="system-title"><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon> Vị trí thời tiết</h4>
              <button class="system-toggle-btn" data-system-toggle="weather">${this._systemOpenSections.weather ? 'Ẩn' : 'Hiện'}</button>
            </div>
            ${this._systemOpenSections.weather ? `
              <div class="system-value">${this._maHoaHtml(this._systemWeather.name || 'Tự động (theo IP nhà mạng)')}</div>
              <div class="system-note">${this._systemWeather.name ? this._maHoaHtml(`(${this._systemWeather.lat}, ${this._systemWeather.lon})`) : 'Chọn tỉnh/thành để dự báo chính xác hơn.'}</div>
              <div class="system-form" style="margin-top:10px;">
                <select id="system-weather-select" class="system-select">
                  <option value="">🌐 Tự động (theo IP)</option>
                  ${provinces.map((p) => {
                    const value = this._giaTriLuaChonTinhThanh(p);
                    const selected = this._laLuaChonTinhThanhDangChon(p);
                    return `<option value="${this._maHoaHtml(value)}" ${selected ? 'selected' : ''}>${this._maHoaHtml(p.name)}</option>`;
                  }).join('')}
                </select>
                <div class="system-card-actions">
                  <button id="system-weather-refresh" class="mini-btn hover-pop">Làm mới</button>
                  <button id="system-weather-save" class="mini-btn mini-btn-accent"><ha-icon icon="mdi:content-save"></ha-icon></button>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="tile">
            <div class="system-section-head">
              <h4 class="system-title"><ha-icon icon="mdi:home-assistant"></ha-icon> Home Assistant</h4>
              <div class="system-badge-inline">
                <span class="system-pill ${this._systemHass.configured ? 'ok' : 'off'}">${this._systemHass.configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</span>
                <button class="system-toggle-btn" data-system-toggle="hass">${this._systemOpenSections.hass ? 'Ẩn' : 'Hiện'}</button>
              </div>
            </div>
            ${this._systemOpenSections.hass ? `
              <div class="system-form">
                <input id="system-hass-url" class="system-input" type="text" placeholder="http://192.168.1.x:8123" value="${this._maHoaHtml(this._systemHass.url || '')}" />
                <input id="system-hass-api-key" class="system-input" type="password" placeholder="${this._systemHass.apiKeyMasked ? '••••••••••••••••' : 'Long-Lived Access Token'}" value="" />
                <input id="system-hass-agent-id" class="system-input" type="text" placeholder="Agent ID" value="${this._maHoaHtml(this._systemHass.agentId || '')}" />
                <div class="system-note">Lấy token từ Profile → Long-Lived Access Tokens.</div>
                <div class="system-card-actions">
                  <button id="system-hass-refresh" class="mini-btn hover-pop">Làm mới</button>
                  <button id="system-hass-save" class="mini-btn mini-btn-accent"><ha-icon icon="mdi:content-save"></ha-icon></button>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="tile">
            <div class="system-section-head">
              <h4 class="system-title"><ha-icon icon="mdi:wifi"></ha-icon> WiFi Setup</h4>
              <button class="system-toggle-btn" data-system-toggle="wifi">${this._systemOpenSections.wifi ? 'Ẩn' : 'Hiện'}</button>
            </div>
            ${this._systemOpenSections.wifi ? `
              <div class="system-row"><span class="system-muted">Trạng thái hiện tại</span><span class="system-pill ${this._systemWifi.isConnected ? 'ok' : 'warn'}">${this._systemWifi.isConnected ? 'Đã kết nối' : 'Chưa kết nối'}</span></div>
              <div class="system-value">${this._maHoaHtml(this._systemWifi.currentSsid || 'Chưa kết nối')}</div>
              <div class="system-note">${this._maHoaHtml(this._systemWifi.ipAddress || '')}</div>
              ${this._systemWifi.apModeActive ? `<div class="system-item" style="margin-top:10px;"><div class="system-item-title">AP Mode Active</div><div class="system-item-sub">SSID: ${this._maHoaHtml(this._systemWifi.apSsid || 'Phicomm-R1')}${this._systemWifi.apIp ? ` | IP: ${this._maHoaHtml(this._systemWifi.apIp)}` : ''}</div><div class="system-card-actions"><button id="system-wifi-stop-ap" class="mini-btn hover-pop">Tắt AP</button></div></div>` : ''}
              <div class="system-form" style="margin-top:10px;">
                <div class="system-card-actions">
                  <button id="system-wifi-scan" class="mini-btn hover-pop">Quét WiFi</button>
                  <button id="system-wifi-refresh-status" class="mini-btn hover-pop">Làm mới</button>
                  <button id="system-wifi-start-ap" class="mini-btn hover-pop">Bật AP</button>
                </div>
                <input id="system-wifi-ssid" class="system-input" type="text" placeholder="SSID WiFi" value="${this._maHoaHtml(this._systemWifi.ssidInput || '')}" />
                <input id="system-wifi-password" class="system-input" type="password" placeholder="Mật khẩu WiFi" value="${this._maHoaHtml(this._systemWifi.passwordInput || '')}" />
                <select id="system-wifi-security" class="system-select">
                  ${[['wpa','WPA/WPA2'],['wep','WEP'],['open','Open']].map(([v,l]) => `<option value="${v}" ${this._systemWifi.securityType === v ? 'selected' : ''}>${l}</option>`).join('')}
                </select>
                <button id="system-wifi-connect" class="mini-btn mini-btn-accent"><ha-icon icon="mdi:wifi-check"></ha-icon></button>
              </div>
              <div class="system-divider"></div>
              <div class="system-title" style="font-size:14px;"><ha-icon icon="mdi:wifi-star"></ha-icon> WiFi đã lưu</div>
              <div class="system-list" style="margin-top:10px;">
                ${this._systemWifi.savedNetworks.length ? this._systemWifi.savedNetworks.map((network) => this._renderSavedWifiItem(network)).join('') : `<div class="system-empty">Chưa có WiFi nào được lưu.</div>`}
              </div>
              <div class="system-divider"></div>
              <div class="system-title" style="font-size:14px;"><ha-icon icon="mdi:wifi-refresh"></ha-icon> Kết quả quét</div>
              <div class="system-list" style="margin-top:10px;">
                ${scannedNetworks.length ? scannedNetworks.map((network, idx) => this._renderScannedWifiItem(network, idx)).join('') : `<div class="system-empty">Bấm Quét để tìm mạng WiFi.</div>`}
              </div>
            ` : ''}
          </div>
        </div>

        ${modal.open ? this._renderAlarmModal(modal) : ''}
      </section>
    `;
  },

  _chuanHoaTenTinhThanh(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .trim()
      .toLowerCase();
  },

  _giaTriLuaChonTinhThanh(province) {
    if (!province || typeof province !== 'object') return '';
    return JSON.stringify({ name: province.name, lat: province.lat, lon: province.lon });
  },

  _timTinhThanhTheoGiaTri(name, lat, lon) {
    const provinces = Array.isArray(this._systemWeather?.provinces) ? this._systemWeather.provinces : [];
    if (!provinces.length) return null;

    const normalizedName = this._chuanHoaTenTinhThanh(name);
    if (normalizedName) {
      const byName = provinces.find((province) => this._chuanHoaTenTinhThanh(province?.name) === normalizedName);
      if (byName) return byName;
    }

    const targetLat = Number(lat);
    const targetLon = Number(lon);
    if (Number.isFinite(targetLat) && Number.isFinite(targetLon)) {
      return provinces.find((province) => Math.abs(Number(province?.lat) - targetLat) < 0.02 && Math.abs(Number(province?.lon) - targetLon) < 0.02) || null;
    }
    return null;
  },

  _laLuaChonTinhThanhDangChon(province) {
    const current = this._timTinhThanhTheoGiaTri(this._systemWeather?.name, this._systemWeather?.lat, this._systemWeather?.lon);
    if (!current || !province) return false;
    return this._chuanHoaTenTinhThanh(current.name) === this._chuanHoaTenTinhThanh(province.name);
  },

  _layDanhSachWifiQuetHienThi() {
    const rawNetworks = Array.isArray(this._systemWifi?.scannedNetworks) ? this._systemWifi.scannedNetworks : [];
    const merged = new Map();
    for (const item of rawNetworks) {
      if (!item || typeof item !== 'object') continue;
      const ssid = String(item.ssid || '').trim();
      const bssid = String(item.bssid || item.mac || '').trim().toLowerCase();
      const freq = String(item.frequency || item.freq || item.channel || '').trim();
      const capabilities = String(item.capabilities || '').trim();
      const key = [ssid, bssid, freq, capabilities].join('|');
      const prev = merged.get(key);
      const prevLevel = Number(prev?.level ?? -999);
      const nextLevel = Number(item?.level ?? -999);
      if (!prev || nextLevel > prevLevel) merged.set(key, item);
    }
    return Array.from(merged.values()).sort((a, b) => Number(b?.level ?? -999) - Number(a?.level ?? -999));
  },

  _wifiBandText(network) {
    const frequency = Number(network?.frequency ?? network?.freq);
    const channel = Number(network?.channel);
    const ssid = String(network?.ssid || '').toLowerCase();
    if (Number.isFinite(frequency)) {
      if (frequency >= 4900) return '5GHz';
      if (frequency >= 2400) return '2.4GHz';
    }
    if (Number.isFinite(channel)) {
      if (channel >= 36) return '5GHz';
      if (channel >= 1) return '2.4GHz';
    }
    if (ssid.includes('5g')) return '5GHz';
    return '';
  },

  _renderAlarmItem(alarm, idx) {
    const id = this._maHoaHtml(String(alarm?.id ?? idx));
    const repeat = this._moTaLapLaiAlarm(alarm);
    const timeText = `${String(alarm?.hour ?? '00').padStart(2, '0')}:${String(alarm?.minute ?? '00').padStart(2, '0')}`;
    const soundText = alarm?.custom_sound_path
      ? `File: ${String(alarm.custom_sound_path).split('/').pop()}`
      : alarm?.youtube_song_name
        ? `YouTube: ${alarm.youtube_song_name}`
        : 'Âm mặc định';
    return `
      <div class="system-item">
        <div class="system-item-head">
          <div>
            <div class="system-item-title">${this._maHoaHtml(timeText)}${alarm?.label ? ` - ${this._maHoaHtml(alarm.label)}` : ''}</div>
            <div class="system-item-sub">${this._maHoaHtml(repeat)} · ${this._maHoaHtml(soundText)} · Volume ${this._maHoaHtml(String(alarm?.volume ?? 100))}%</div>
          </div>
          <span class="system-pill ${this._epKieuBoolean(alarm?.enabled ?? true, true) ? 'ok' : 'off'}">${this._epKieuBoolean(alarm?.enabled ?? true, true) ? 'Bật' : 'Tắt'}</span>
        </div>
        <div class="system-card-actions">
          <button class="mini-btn hover-pop" data-alarm-action="toggle" data-alarm-id="${id}">${this._epKieuBoolean(alarm?.enabled ?? true, true) ? 'Tắt' : 'Bật'}</button>
          <button class="mini-btn hover-pop" data-alarm-action="edit" data-alarm-index="${idx}">Sửa</button>
          <button class="mini-btn hover-pop" data-alarm-action="delete" data-alarm-id="${id}">Xóa</button>
        </div>
      </div>
    `;
  },

  _renderSavedWifiItem(network) {
    const ssid = this._maHoaHtml(String(network?.ssid || 'Không rõ'));
    const networkId = this._maHoaHtml(String(network?.network_id ?? ''));
    const statusText = Number(network?.status) === 0 ? 'Đã lưu' : Number(network?.status) === 1 ? 'Đang kết nối' : 'Không khả dụng';
    return `
      <div class="system-item">
        <div class="system-item-head">
          <div>
            <div class="system-item-title">${ssid}</div>
            <div class="system-item-sub">${this._maHoaHtml(statusText)}</div>
          </div>
          <div class="system-card-actions" style="margin-top:0;">
            <button class="mini-btn hover-pop" data-wifi-saved-action="connect" data-ssid="${ssid}" data-network-id="${networkId}">Kết nối</button>
            <button class="mini-btn hover-pop" data-wifi-saved-action="delete" data-ssid="${ssid}" data-network-id="${networkId}">Xóa</button>
          </div>
        </div>
      </div>
    `;
  },

  _renderScannedWifiItem(network, idx) {
    const ssid = this._maHoaHtml(String(network?.ssid || `WiFi ${idx + 1}`));
    const capabilities = this._maHoaHtml(String(network?.capabilities || ''));
    const secureLabel = network?.is_secure ? 'Có mật khẩu' : 'Open';
    const bandText = this._wifiBandText(network);
    return `
      <div class="system-item">
        <div class="system-item-head">
          <div>
            <div class="system-item-title">${ssid}</div>
            <div class="system-item-sub">${this._maHoaHtml(secureLabel)}${capabilities ? ` · ${capabilities}` : ''}${bandText ? ` · ${this._maHoaHtml(bandText)}` : ''}</div>
          </div>
          <button class="mini-btn hover-pop" data-wifi-scan-action="select" data-ssid="${ssid}" data-capabilities="${capabilities}">Chọn</button>
        </div>
      </div>
    `;
  },

  _renderAlarmModal(modal) {
    const selectedDays = Array.isArray(modal.selectedDays) ? modal.selectedDays : [];
    const days = [
      ['mon', 'T2'], ['tue', 'T3'], ['wed', 'T4'], ['thu', 'T5'], ['fri', 'T6'], ['sat', 'T7'], ['sun', 'CN'],
    ];
    return `
      <div class="alarm-modal-backdrop" id="alarm-modal-backdrop">
        <div class="alarm-modal" role="dialog" aria-modal="true">
          <div class="system-section-head">
            <h3 class="alarm-modal-title">${modal.mode === 'edit' ? 'Chỉnh sửa báo thức' : 'Thêm báo thức'}</h3>
            <button id="alarm-modal-close" class="system-toggle-btn">Đóng</button>
          </div>
          <div class="system-form">
            <div class="system-two-col">
              <input id="alarm-hour" class="system-input" type="number" min="0" max="23" value="${this._maHoaHtml(String(modal.hour || '07'))}" placeholder="Giờ" />
              <input id="alarm-minute" class="system-input" type="number" min="0" max="59" value="${this._maHoaHtml(String(modal.minute || '00'))}" placeholder="Phút" />
            </div>
            <select id="alarm-repeat" class="system-select">
              ${[['none','Không lặp'],['daily','Mỗi ngày'],['weekdays','Thứ 2 - Thứ 6'],['weekends','Cuối tuần'],['custom','Tùy chọn ngày']].map(([v,l]) => `<option value="${v}" ${modal.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <div class="alarm-days" id="alarm-days-wrap" ${modal.repeat === 'custom' ? '' : 'style="display:none;"'}>
              ${days.map(([key, label]) => `<label class="alarm-day ${selectedDays.includes(key) ? 'is-active' : ''}" data-alarm-day-item="${key}"><input type="checkbox" data-alarm-day="${key}" ${selectedDays.includes(key) ? 'checked' : ''} /><span>${label}</span></label>`).join('')}
            </div>
            <input id="alarm-label" class="system-input" type="text" placeholder="Nhãn báo thức" value="${this._maHoaHtml(modal.label || '')}" />
            <div>
              <div class="label-line"><span>Âm lượng</span><strong id="alarm-volume-display">${this._maHoaHtml(String(modal.volume ?? 100))}%</strong></div>
              <input id="alarm-volume" type="range" min="0" max="100" step="1" value="${this._maHoaHtml(String(modal.volume ?? 100))}" />
            </div>
            <input id="alarm-youtube-song" class="system-input" type="text" placeholder="Tên bài hát YouTube (tùy chọn)" value="${this._maHoaHtml(modal.youtubeSongName || '')}" />
            <div class="system-item">
              <div class="system-item-title">Âm báo tùy chỉnh</div>
              <div class="system-item-sub" id="alarm-current-sound">${this._maHoaHtml(modal.pendingFileName ? `File mới: ${modal.pendingFileName}` : (modal.currentSoundLabel || 'Đang dùng: Mặc định (alarm.mp3)'))}</div>
              <div class="system-card-actions">
                <input id="alarm-sound-file" class="system-input" type="file" accept="audio/*" />
                ${modal.mode === 'edit' ? `<button id="alarm-remove-current-sound" class="mini-btn hover-pop">Xóa âm hiện tại</button>` : ''}
              </div>
            </div>
            <div class="system-card-actions">
              <button id="alarm-submit" class="mini-btn mini-btn-accent"><ha-icon icon="mdi:content-save"></ha-icon></button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // === EVENTS ===
  _ganSuKienTabSystem(root) {

    root.getElementById('system-monitor-refresh')?.addEventListener('click', async () => {
      await this._lamMoiSystemMonitor();
    });

    root.getElementById('system-led-toggle')?.addEventListener('change', async (ev) => {
      const enabled = Boolean(ev.target.checked);
      this._systemLedEnabled = enabled;
      await this._goiMotTrongCacDichVu(['set_led_state', 'set_led', 'led_toggle'], { enabled }, ['esp32_aibox_media_controller', 'media_player']);
      await this._lamMoiEntity(200, 1);
    });

    root.querySelectorAll('[data-system-toggle]').forEach((btn) => btn.addEventListener('click', () => {
      const key = btn.dataset.systemToggle;
      if (!key) return;
      this._systemOpenSections[key] = !this._systemOpenSections[key];
      this._veGiaoDien();
    }));

    root.getElementById('alarm-stop-active')?.addEventListener('click', async () => this._dungBaoThuc());
    root.getElementById('alarm-add')?.addEventListener('click', () => this._moModalBaoThuc());
    root.getElementById('alarm-refresh')?.addEventListener('click', async () => this._taiBaoThuc());
    root.querySelectorAll('[data-alarm-action="toggle"]').forEach((btn) => btn.addEventListener('click', async () => this._batTatBaoThuc(btn.dataset.alarmId)));
    root.querySelectorAll('[data-alarm-action="delete"]').forEach((btn) => btn.addEventListener('click', async () => this._xoaBaoThuc(btn.dataset.alarmId)));
    root.querySelectorAll('[data-alarm-action="edit"]').forEach((btn) => btn.addEventListener('click', () => {
      const index = Number(btn.dataset.alarmIndex || -1);
      if (index < 0 || index >= this._systemAlarms.length) return;
      this._moModalBaoThuc(this._systemAlarms[index]);
    }));

    root.getElementById('system-ota-select')?.addEventListener('change', (ev) => { this._systemOta.selectedOtaUrl = String(ev.target.value || ''); });
    root.getElementById('system-ota-refresh')?.addEventListener('click', async () => this._lamMoiOta());
    root.getElementById('system-ota-save')?.addEventListener('click', async () => this._luuOta());

    root.getElementById('system-mac-refresh')?.addEventListener('click', async () => this._layMac());
    root.getElementById('system-mac-random')?.addEventListener('click', async () => this._randomMac());
    root.getElementById('system-mac-clear')?.addEventListener('click', async () => this._xoaMacTuyChinh());

    root.getElementById('system-weather-select')?.addEventListener('change', (ev) => { this._systemWeather.selectedValue = String(ev.target.value || ''); });
    root.getElementById('system-weather-refresh')?.addEventListener('click', async () => this._layViTriThoiTiet());
    root.getElementById('system-weather-save')?.addEventListener('click', async () => this._luuViTriThoiTiet());

    root.getElementById('system-hass-refresh')?.addEventListener('click', async () => this._layCauHinhHass());
    root.getElementById('system-hass-save')?.addEventListener('click', async () => this._luuCauHinhHass(root));

    root.getElementById('system-wifi-scan')?.addEventListener('click', async () => this._quetWifi());
    root.getElementById('system-wifi-refresh-status')?.addEventListener('click', async () => this._lamMoiWifi());
    root.getElementById('system-wifi-start-ap')?.addEventListener('click', async () => this._batApMode());
    root.getElementById('system-wifi-stop-ap')?.addEventListener('click', async () => this._tatApMode());
    root.getElementById('system-wifi-connect')?.addEventListener('click', async () => this._ketNoiWifi(root));
    root.querySelectorAll('[data-wifi-saved-action="connect"]').forEach((btn) => btn.addEventListener('click', async () => this._ketNoiWifiDaLuu(btn.dataset.ssid, btn.dataset.networkId)));
    root.querySelectorAll('[data-wifi-saved-action="delete"]').forEach((btn) => btn.addEventListener('click', async () => this._xoaWifiDaLuu(btn.dataset.ssid, btn.dataset.networkId)));
    root.querySelectorAll('[data-wifi-scan-action="select"]').forEach((btn) => btn.addEventListener('click', () => this._chonMangWifi(btn.dataset.ssid, btn.dataset.capabilities)));

    root.getElementById('system-reboot')?.addEventListener('click', async () => {
      if (!window.confirm('Bạn có chắc muốn reboot loa?')) return;
      await this._goiMotTrongCacDichVu(['reboot', 'system_reboot'], {}, ['esp32_aibox_media_controller', 'media_player']);
    });

    this._ganSuKienModalAlarm(root);
  },

  _ganSuKienModalAlarm(root) {
    const modal = this._systemAlarmModal;
    if (!modal?.open) return;

    root.getElementById('alarm-modal-close')?.addEventListener('click', () => this._dongModalBaoThuc());
    root.getElementById('alarm-modal-backdrop')?.addEventListener('click', (ev) => {
      if (ev.target?.id === 'alarm-modal-backdrop') this._dongModalBaoThuc();
    });
    root.getElementById('alarm-repeat')?.addEventListener('change', (ev) => {
      this._systemAlarmModal.repeat = String(ev.target.value || 'none');
      this._veGiaoDien();
    });
    root.querySelectorAll('[data-alarm-day]').forEach((checkbox) => checkbox.addEventListener('change', () => {
      const day = checkbox.dataset.alarmDay;
      const days = new Set(this._systemAlarmModal.selectedDays || []);
      if (checkbox.checked) days.add(day);
      else days.delete(day);
      this._systemAlarmModal.selectedDays = Array.from(days);
      const label = root.querySelector(`[data-alarm-day-item="${day}"]`);
      label?.classList.toggle('is-active', checkbox.checked);
    }));
    root.getElementById('alarm-volume')?.addEventListener('input', (ev) => {
      const volume = Math.max(0, Math.min(100, parseInt(ev.target.value, 10) || 0));
      this._systemAlarmModal.volume = volume;
      const dsp = root.getElementById('alarm-volume-display');
      if (dsp) dsp.textContent = `${volume}%`;
    });
    root.getElementById('alarm-sound-file')?.addEventListener('change', (ev) => {
      const file = ev.target.files?.[0];
      this._systemAlarmModal.pendingFileName = file?.name || '';
      const info = root.getElementById('alarm-current-sound');
      if (info && file?.name) info.textContent = `File mới: ${file.name}`;
    });
    root.getElementById('alarm-remove-current-sound')?.addEventListener('click', () => {
      this._systemAlarmModal.removeCurrentSound = true;
      this._systemAlarmModal.customSoundPath = '';
      this._systemAlarmModal.pendingFileName = '';
      const info = root.getElementById('alarm-current-sound');
      if (info) info.textContent = 'Âm hiện tại sẽ bị xóa khi lưu.';
    });
    root.getElementById('alarm-submit')?.addEventListener('click', async () => this._luuBaoThuc(root));
  },

  // === ACTION HELPERS ===
  _docPayloadSystem(...values) {
    for (const value of values) {
      if (value === undefined || value === null || value === '') continue;
      if (typeof value === 'string') {
        try { return JSON.parse(value); } catch (_) { return value; }
      }
      return value;
    }
    return {};
  },

  _chonGiaTriDauTien(...values) {
    for (const value of values) {
      if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
  },

  _tenHienThiOta(url) {
    const normalized = String(url || '').trim();
    if (normalized === 'https://api.tenclass.net/xiaozhi/ota/') return 'Xiaozhi';
    if (normalized === 'https://me.ai-box.vn/xiaozhi/ota/') return 'AI-BOX.VN';
    return normalized || 'Không rõ';
  },

  _moTaLapLaiAlarm(alarm) {
    const repeat = String(alarm?.repeat || 'none').toLowerCase();
    if (repeat === 'daily') return 'Mỗi ngày';
    if (repeat === 'weekdays') return 'Thứ 2 - Thứ 6';
    if (repeat === 'weekends') return 'Cuối tuần';
    if (repeat === 'custom') {
      const days = Array.isArray(alarm?.selected_days) ? alarm.selected_days : [];
      return days.length ? `Ngày: ${days.join(', ')}` : 'Tùy chọn ngày';
    }
    return 'Không lặp';
  },

  _tonTaiDichVu(domain, service) {
    return Boolean(this._hass?.services?.[domain]?.[service]);
  },

  async _goiMotTrongCacDichVu(serviceNames, data = {}, domains = ['esp32_aibox_media_controller', 'media_player']) {
    if (!this._hass || !this._config) return;
    const payload = { entity_id: this._config.entity, ...data };
    const candidates = Array.isArray(serviceNames) ? serviceNames.filter(Boolean) : [serviceNames].filter(Boolean);
    const candidateDomains = Array.isArray(domains) ? domains.filter(Boolean) : [domains].filter(Boolean);

    for (const service of candidates) {
      for (const domain of candidateDomains) {
        if (this._tonTaiDichVu(domain, service)) {
          await this._hass.callService(domain, service, payload);
          return { domain, service };
        }
      }
    }

    const service = candidates[0];
    const domain = candidateDomains[0] || 'esp32_aibox_media_controller';
    await this._hass.callService(domain, service, payload);
    return { domain, service };
  },

  async _lamMoiSystemMonitor() {
    await this._goiMotTrongCacDichVu(['refresh_state', 'system_refresh_state', 'get_system_state'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _taiBaoThuc() {
    await this._goiMotTrongCacDichVu(['alarm_list', 'list_alarms', 'get_alarm_list'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _dungBaoThuc() {
    await this._goiMotTrongCacDichVu(['alarm_stop', 'stop_alarm'], {}, ['esp32_aibox_media_controller', 'media_player']);
    this._systemAlarmBanner.active = false;
    this._veGiaoDien();
    await this._lamMoiEntity(250, 1);
  },

  _moModalBaoThuc(alarm = null) {
    if (alarm) {
      this._systemAlarmModal = {
        open: true,
        mode: 'edit',
        id: String(alarm.id ?? ''),
        hour: String(alarm.hour ?? '07').padStart(2, '0'),
        minute: String(alarm.minute ?? '00').padStart(2, '0'),
        repeat: String(alarm.repeat || 'none'),
        label: String(alarm.label || ''),
        volume: Math.max(0, Math.min(100, parseInt(alarm.volume, 10) || 100)),
        selectedDays: Array.isArray(alarm.selected_days) ? alarm.selected_days.slice() : [],
        youtubeSongName: String(alarm.youtube_song_name || ''),
        customSoundPath: String(alarm.custom_sound_path || ''),
        currentSoundLabel: alarm.custom_sound_path
          ? `File hiện tại: ${String(alarm.custom_sound_path).split('/').pop()}`
          : (alarm.youtube_song_name ? `Đang dùng: YouTube - ${alarm.youtube_song_name}` : 'Đang dùng: Mặc định (alarm.mp3)'),
        pendingFileName: '',
        removeCurrentSound: false,
      };
    } else {
      this._systemAlarmModal = {
        ...this._systemAlarmModal,
        open: true,
        mode: 'add',
        id: '',
        hour: '07',
        minute: '00',
        repeat: 'none',
        label: '',
        volume: 100,
        selectedDays: [],
        youtubeSongName: '',
        customSoundPath: '',
        currentSoundLabel: 'Đang dùng: Mặc định (alarm.mp3)',
        pendingFileName: '',
        removeCurrentSound: false,
      };
    }
    this._veGiaoDien();
  },

  _dongModalBaoThuc() {
    this._systemAlarmModal.open = false;
    this._veGiaoDien();
  },

  async _uploadAlarmSoundFromFile(file, alarmId = -1) {
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = String(reader.result || '');
        resolve(raw.includes(',') ? raw.split(',')[1] : raw);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    await this._goiMotTrongCacDichVu([
      'alarm_upload_sound',
      'upload_alarm_sound',
    ], {
      alarm_id: alarmId,
      file_name: file.name,
      file_data: base64,
    }, ['esp32_aibox_media_controller', 'media_player']);
  },

  async _luuBaoThuc(root) {
    const hour = Math.max(0, Math.min(23, parseInt(root.getElementById('alarm-hour')?.value, 10) || 0));
    const minute = Math.max(0, Math.min(59, parseInt(root.getElementById('alarm-minute')?.value, 10) || 0));
    const repeat = String(root.getElementById('alarm-repeat')?.value || 'none');
    const label = String(root.getElementById('alarm-label')?.value || '').trim();
    const volume = Math.max(0, Math.min(100, parseInt(root.getElementById('alarm-volume')?.value, 10) || 100));
    const youtubeSongName = String(root.getElementById('alarm-youtube-song')?.value || '').trim();
    const file = root.getElementById('alarm-sound-file')?.files?.[0] || null;
    const modal = this._systemAlarmModal;
    const selectedDays = repeat === 'custom' ? (modal.selectedDays || []) : (repeat === 'none' ? [] : undefined);

    let customSoundPath;
    if (modal.mode === 'edit') {
      if (modal.removeCurrentSound) customSoundPath = '';
      else if (modal.customSoundPath) customSoundPath = modal.customSoundPath;
    }

    if (file) {
      await this._uploadAlarmSoundFromFile(file, modal.mode === 'edit' ? modal.id : -1);
      customSoundPath = file.name;
    }

    const payload = {
      hour,
      minute,
      repeat,
      label,
      volume,
    };

    if (youtubeSongName || modal.mode === 'edit') payload.youtube_song_name = youtubeSongName;
    if (customSoundPath !== undefined) payload.custom_sound_path = customSoundPath;
    if (repeat === 'custom') payload.selected_days = selectedDays;
    else if (modal.mode === 'edit' && repeat !== 'custom') payload.selected_days = ['__CLEAR__'];

    if (modal.mode === 'edit') {
      payload.alarm_id = modal.id;
      await this._goiMotTrongCacDichVu(['alarm_edit', 'edit_alarm'], payload, ['esp32_aibox_media_controller', 'media_player']);
    } else {
      await this._goiMotTrongCacDichVu(['alarm_add', 'add_alarm'], payload, ['esp32_aibox_media_controller', 'media_player']);
    }

    this._dongModalBaoThuc();
    await this._lamMoiEntity(250, 2);
    await this._taiBaoThuc();
  },

  async _xoaBaoThuc(alarmId) {
    if (!alarmId || !window.confirm('Xóa báo thức này?')) return;
    await this._goiMotTrongCacDichVu(['alarm_delete', 'delete_alarm'], { alarm_id: alarmId }, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
    await this._taiBaoThuc();
  },

  async _batTatBaoThuc(alarmId) {
    if (!alarmId) return;
    await this._goiMotTrongCacDichVu(['alarm_toggle', 'toggle_alarm'], { alarm_id: alarmId }, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
    await this._taiBaoThuc();
  },

  async _lamMoiOta() {
    await this._goiMotTrongCacDichVu(['ota_get', 'get_ota', 'ota_refresh'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _luuOta() {
    const otaUrl = String(this._systemOta.selectedOtaUrl || this._systemOta.currentOtaUrl || '').trim();
    if (!otaUrl) return;
    await this._goiMotTrongCacDichVu(['ota_set', 'set_ota', 'set_ota_url'], { ota_url: otaUrl, url: otaUrl }, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _layMac() {
    await this._goiMotTrongCacDichVu(['mac_get', 'get_mac'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _randomMac() {
    const confirmed = window.confirm(
      '⚠️ CẢNH BÁO QUAN TRỌNG ⚠️\n\n' +
      'Chỉ dùng khi bạn KHÔNG CÓ QUYỀN TRUY CẬP thiết bị trên xiaozhi.me\n\n' +
      'Nếu tạo MAC mới, bạn có thể mất quyền truy cập các tính năng đã mua.\n\n' +
      'Bạn có chắc chắn muốn tiếp tục?'
    );
    if (!confirmed) return;
    await this._goiMotTrongCacDichVu(['mac_random', 'random_mac'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _xoaMacTuyChinh() {
    if (!window.confirm('Xóa MAC tùy chỉnh và dùng lại MAC phần cứng?')) return;
    await this._goiMotTrongCacDichVu(['mac_clear', 'clear_mac'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _layViTriThoiTiet() {
    await this._goiMotTrongCacDichVu(['weather_province_get', 'get_weather_province', 'weather_location_get'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _luuViTriThoiTiet() {
    let payload = { name: '', lat: 0, lon: 0 };
    if (this._systemWeather.selectedValue) {
      try { payload = JSON.parse(this._systemWeather.selectedValue); } catch (_) {}
    }

    const matchedProvince = this._timTinhThanhTheoGiaTri(payload.name, payload.lat, payload.lon);
    if (matchedProvince) {
      payload = { name: matchedProvince.name, lat: matchedProvince.lat, lon: matchedProvince.lon };
      this._systemWeather = {
        ...this._systemWeather,
        name: matchedProvince.name,
        lat: matchedProvince.lat,
        lon: matchedProvince.lon,
        selectedValue: this._giaTriLuaChonTinhThanh(matchedProvince),
      };
    } else if (!payload.name) {
      this._systemWeather = {
        ...this._systemWeather,
        name: '',
        lat: 0,
        lon: 0,
        selectedValue: '',
      };
    }

    await this._goiMotTrongCacDichVu([
      'weather_province_set',
      'set_weather_province',
      'weather_location_set',
    ], payload, ['esp32_aibox_media_controller', 'media_player']);
    this._veGiaoDien();
    await this._lamMoiEntity(350, 2);
  },

  async _layCauHinhHass() {
    await this._goiMotTrongCacDichVu(['hass_get', 'get_hass_config', 'home_assistant_get'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _luuCauHinhHass(root) {
    const url = String(root.getElementById('system-hass-url')?.value || '').trim();
    const apiKey = String(root.getElementById('system-hass-api-key')?.value || '').trim();
    const agentId = String(root.getElementById('system-hass-agent-id')?.value || '').trim();
    const payload = { url, agent_id: agentId };
    if (apiKey) payload.api_key = apiKey;
    await this._goiMotTrongCacDichVu(['hass_set', 'set_hass_config', 'home_assistant_set'], payload, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  _chonMangWifi(ssid, capabilities = '') {
    this._systemWifi.ssidInput = String(ssid || '');
    this._systemWifi.securityType = /WPA/i.test(capabilities) ? 'wpa' : (/WEP/i.test(capabilities) ? 'wep' : 'open');
    this._veGiaoDien();
  },

  async _quetWifi() {
    await this._goiMotTrongCacDichVu(['wifi_scan', 'scan_wifi'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(900, 2);
  },

  async _lamMoiWifi() {
    await this._goiMotTrongCacDichVu(['wifi_get_status', 'get_wifi_status'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._goiMotTrongCacDichVu(['wifi_get_saved', 'get_saved_wifi'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _batApMode() {
    await this._goiMotTrongCacDichVu(['wifi_start_ap', 'start_wifi_ap'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _tatApMode() {
    await this._goiMotTrongCacDichVu(['wifi_stop_ap', 'stop_wifi_ap'], {}, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },

  async _ketNoiWifi(root) {
    const ssid = String(root.getElementById('system-wifi-ssid')?.value || '').trim();
    const password = String(root.getElementById('system-wifi-password')?.value || '').trim();
    const securityType = String(root.getElementById('system-wifi-security')?.value || 'wpa');
    if (!ssid) {
      window.alert('Vui lòng nhập SSID WiFi.');
      return;
    }
    this._systemWifi.ssidInput = ssid;
    this._systemWifi.passwordInput = password;
    this._systemWifi.securityType = securityType;
    await this._goiMotTrongCacDichVu(['wifi_connect', 'connect_wifi'], { ssid, password, security_type: securityType }, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(500, 2);
  },

  async _ketNoiWifiDaLuu(ssid, networkId) {
    await this._goiMotTrongCacDichVu(['wifi_connect', 'connect_wifi'], { ssid, network_id: Number(networkId) }, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(500, 2);
  },

  async _xoaWifiDaLuu(ssid, networkId) {
    if (!window.confirm(`Xóa WiFi "${ssid}"?`)) return;
    await this._goiMotTrongCacDichVu(['wifi_delete_saved', 'delete_saved_wifi'], { ssid, network_id: Number(networkId) }, ['esp32_aibox_media_controller', 'media_player']);
    await this._lamMoiEntity(250, 2);
  },
};
