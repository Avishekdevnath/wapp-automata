/**
 * Telco Man • Settings & Terminal Configuration Controller
 * Handles Carrier Account Management, Password Reset, Sidebar Menu Toggles,
 * Appearance Dual-Mode Styling, and Database Purge Actions.
 */
(function() {
  'use strict';

  const SIDEBAR_MENUS = [
    { id: 'routes', name: 'Route Matrix', icon: 'table', desc: 'Voice rate sheets & offers' },
    { id: 'trends', name: 'Market Trends', icon: 'trending-up', desc: 'Historical price charts' },
    { id: 'insights', name: 'AI Insights', icon: 'sparkles', desc: 'Arbitrage & deal signals' },
    { id: 'news', name: 'Telco News & Outages', icon: 'newspaper', desc: 'Carrier maintenance notices' },
    { id: 'vendors', name: 'Carriers & Vendors', icon: 'users', desc: 'Wholesale contact directory' },
    { id: 'terminal', name: 'Live Messages Stream', icon: 'radio', desc: 'Zero-loss WhatsApp feed' },
    { id: 'pipeline', name: 'System Pipeline', icon: 'cpu', desc: 'AI processing inspector' },
    { id: 'dev', name: 'Developer Studio', icon: 'code-2', desc: 'Webhook lab & test simulator' }
  ];

  // -------------------------------------------------------------------------
  // 1. Sidebar Menu Visibility Preferences
  // -------------------------------------------------------------------------
  function getSidebarMenuPrefs() {
    try {
      const saved = localStorage.getItem('telco_sidebar_menus');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      routes: true,
      trends: true,
      insights: true,
      news: true,
      vendors: true,
      terminal: true,
      pipeline: true,
      dev: true
    };
  }

  function saveSidebarMenuPrefs(prefs) {
    try {
      localStorage.setItem('telco_sidebar_menus', JSON.stringify(prefs));
    } catch (_) {}
  }

  window.initSidebarMenuToggles = function initSidebarMenuToggles() {
    const prefs = getSidebarMenuPrefs();
    SIDEBAR_MENUS.forEach(menu => {
      const isVisible = prefs[menu.id] !== false;
      const btn = document.querySelector(`.sidebar-nav-btn[data-view="${menu.id}"]`);
      if (btn) {
        btn.classList.toggle('hidden', !isVisible);
      }
    });
  };

  window.toggleSidebarMenu = function toggleSidebarMenu(menuId, isVisible) {
    const prefs = getSidebarMenuPrefs();
    prefs[menuId] = isVisible;
    saveSidebarMenuPrefs(prefs);

    const btn = document.querySelector(`.sidebar-nav-btn[data-view="${menuId}"]`);
    if (btn) {
      btn.classList.toggle('hidden', !isVisible);
    }

    if (typeof showToast === 'function') {
      showToast(`${menuId.toUpperCase()} menu ${isVisible ? 'enabled' : 'hidden'}`, 'info');
    }
  };

  window.enableAllSidebarMenus = function enableAllSidebarMenus() {
    const prefs = {};
    SIDEBAR_MENUS.forEach(menu => {
      prefs[menu.id] = true;
      const btn = document.querySelector(`.sidebar-nav-btn[data-view="${menu.id}"]`);
      if (btn) btn.classList.remove('hidden');
    });
    saveSidebarMenuPrefs(prefs);
    renderSidebarMenuToggles();
    if (typeof showToast === 'function') showToast('All navigation menus enabled', 'success');
  };

  window.resetSidebarMenus = function resetSidebarMenus() {
    enableAllSidebarMenus();
  };

  function renderSidebarMenuToggles() {
    const container = document.getElementById('sidebar-menu-toggles-container');
    if (!container) return;

    const prefs = getSidebarMenuPrefs();
    let html = '';

    SIDEBAR_MENUS.forEach(menu => {
      const isChecked = prefs[menu.id] !== false;
      html += `
        <div class="flex items-center justify-between p-2.5 rounded-xl bg-dark-950/60 border border-dark-800 hover:border-slate-700 transition-colors">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="${menu.icon}" class="w-4 h-4 text-slate-400 shrink-0"></i>
            <div class="truncate">
              <span class="font-semibold text-slate-900 dark:text-white block text-xs truncate">${menu.name}</span>
              <span class="text-[10px] text-slate-500 block truncate">${menu.desc}</span>
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-2">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSidebarMenu('${menu.id}', this.checked)" class="sr-only peer">
            <div class="w-8 h-4 bg-slate-300 dark:bg-dark-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
          </label>
        </div>
      `;
    });

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons({ root: container });
  }

  // -------------------------------------------------------------------------
  // 2. Settings View Initializer & Live Stats Telemetry
  // -------------------------------------------------------------------------
  window.loadSettingsView = async function loadSettingsView() {
    renderSidebarMenuToggles();
    syncThemeButtons();
    syncSettingsPageSize();
    updateSettingsAudioToggle();
    await fetchDmRecordingSetting();
    await refreshSettingsStats();
    await fetchWhatsAppSettingsStatus();
    if (window.lucide) lucide.createIcons();
  };

  window.refreshSettingsStats = async function refreshSettingsStats() {
    try {
      const res = await fetch('/api/settings/stats');
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.counts) return;

      const setEl = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text;
      };

      setEl('settings-stat-routes', Number(data.counts.routes || 0).toLocaleString());
      setEl('settings-stat-ai', Number(data.counts.aiTasks || 0).toLocaleString());
      setEl('settings-stat-news', Number(data.counts.news || 0).toLocaleString());
      setEl('settings-stat-vendors', Number(data.counts.vendors || 0).toLocaleString());

      if (data.storage) {
        if (data.storage.disk) {
          setEl('settings-stat-disk', `${data.storage.disk.usedPercent || 0}% used`);
        }
        if (data.storage.media) {
          setEl('settings-stat-media', `${data.storage.media.totalSizeMb || 0} MB`);
        }
      }
    } catch (err) {
      console.warn('Failed to refresh settings stats:', err.message);
    }
  };

  async function fetchWhatsAppSettingsStatus() {
    try {
      const res = await fetch('/api/session/status');
      if (!res.ok) return;
      const state = await res.json();

      const phoneEl = document.getElementById('settings-wp-phone');
      const badgeEl = document.getElementById('settings-wp-status-badge');
      const platformEl = document.getElementById('settings-wp-platform');

      const isConnected = state.status === 'connected' || state.connected === true;
      const isWaitingQr = state.status === 'scan_qr' || !!state.qr;

      if (badgeEl) {
        if (isConnected) {
          badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
          badgeEl.innerText = 'Connected (Active)';
        } else if (isWaitingQr) {
          badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse';
          badgeEl.innerText = 'Waiting for QR Scan';
        } else {
          badgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30';
          badgeEl.innerText = 'Disconnected';
        }
      }

      if (phoneEl) {
        phoneEl.innerText = state.phone || state.jid || (isConnected ? 'Linked Carrier Account' : 'Not Linked');
      }

      if (platformEl && state.platform) {
        platformEl.innerText = `${state.platform} (Baileys v6)`;
      }
    } catch (err) {
      console.warn('Failed to fetch WhatsApp settings status:', err.message);
    }
  }

  // -------------------------------------------------------------------------
  // 3. WhatsApp Account Unlink & Socket Restart
  // -------------------------------------------------------------------------
  window.handleSettingsUnlinkWp = async function handleSettingsUnlinkWp() {
    const confirmed = confirm(
      'Are you sure you want to UNLINK your current WhatsApp account?\n\n' +
      'This will clear active session tokens and restart the collector so you can scan a fresh QR code or enter an 8-digit pair code.\n' +
      'All saved routes, AI tasks, and incoming chat logs will remain completely safe.'
    );
    if (!confirmed) return;

    try {
      if (typeof showToast === 'function') showToast('Resetting WhatsApp session...', 'info');
      const res = await fetch('/api/session/reset', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (typeof showToast === 'function') {
        showToast('WhatsApp session cleared. Opening pairing modal...', 'success');
      }
      setTimeout(() => {
        if (typeof openDeviceModal === 'function') openDeviceModal();
        fetchWhatsAppSettingsStatus();
      }, 1200);
    } catch (err) {
      if (typeof showToast === 'function') showToast('Failed to reset session: ' + err.message, 'error');
    }
  };

  window.handleSettingsRestartWp = async function handleSettingsRestartWp() {
    try {
      if (typeof showToast === 'function') showToast('Restarting WhatsApp collector...', 'info');
      const res = await fetch('/api/session/restart', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (typeof showToast === 'function') showToast('WhatsApp background socket restarted successfully', 'success');
      setTimeout(fetchWhatsAppSettingsStatus, 2000);
    } catch (err) {
      if (typeof showToast === 'function') showToast('Failed to restart socket: ' + err.message, 'error');
    }
  };

  // -------------------------------------------------------------------------
  // 4. Access Password Change Form Handler
  // -------------------------------------------------------------------------
  window.handleSettingsPasswordChange = async function handleSettingsPasswordChange(e) {
    e.preventDefault();
    const currEl = document.getElementById('input-curr-pwd');
    const newEl = document.getElementById('input-new-pwd');
    const confEl = document.getElementById('input-confirm-pwd');
    const fbEl = document.getElementById('pwd-change-feedback');
    const btnEl = document.getElementById('btn-save-pwd');

    if (!currEl || !newEl || !confEl) return;

    const currentPassword = currEl.value.trim();
    const newPassword = newEl.value.trim();
    const confirmPassword = confEl.value.trim();

    if (newPassword !== confirmPassword) {
      if (fbEl) {
        fbEl.className = 'text-[11px] p-2.5 rounded-lg font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30';
        fbEl.innerText = 'New passwords do not match. Please re-enter.';
        fbEl.classList.remove('hidden');
      }
      return;
    }

    if (newPassword.length < 4) {
      if (fbEl) {
        fbEl.className = 'text-[11px] p-2.5 rounded-lg font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30';
        fbEl.innerText = 'New password must be at least 4 characters long.';
        fbEl.classList.remove('hidden');
      }
      return;
    }

    try {
      if (btnEl) btnEl.disabled = true;
      const res = await fetch('/api/settings/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password update failed');
      }

      if (fbEl) {
        fbEl.className = 'text-[11px] p-2.5 rounded-lg font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30';
        fbEl.innerText = 'Password successfully updated and persisted to .env!';
        fbEl.classList.remove('hidden');
      }

      // Update current stored session token with the new password
      try {
        localStorage.setItem('wapp_token', newPassword);
        sessionStorage.setItem('wapp_token', newPassword);
      } catch (_) {}

      currEl.value = '';
      newEl.value = '';
      confEl.value = '';

      if (typeof showToast === 'function') showToast('Terminal password updated successfully!', 'success');
    } catch (err) {
      if (fbEl) {
        fbEl.className = 'text-[11px] p-2.5 rounded-lg font-medium bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30';
        fbEl.innerText = err.message;
        fbEl.classList.remove('hidden');
      }
    } finally {
      if (btnEl) btnEl.disabled = false;
    }
  };

  // -------------------------------------------------------------------------
  // 5. Theme & Appearance Synchronizer
  // -------------------------------------------------------------------------
  window.setThemeMode = function setThemeMode(mode) {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('wapp_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('wapp_theme', 'light');
    }
    syncThemeButtons();
    // Update header theme icon
    const themeIcon = document.getElementById('icon-theme');
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', mode === 'dark' ? 'sun' : 'moon');
    }
    if (window.lucide) lucide.createIcons();
  };

  function syncThemeButtons() {
    const isDark = document.documentElement.classList.contains('dark');
    const darkBtn = document.getElementById('theme-btn-dark');
    const lightBtn = document.getElementById('theme-btn-light');

    if (darkBtn) {
      if (isDark) {
        darkBtn.className = 'p-3 rounded-xl border border-emerald-500 bg-emerald-500/10 flex items-center gap-2.5 transition-all text-left shadow-sm';
      } else {
        darkBtn.className = 'p-3 rounded-xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-950/60 flex items-center gap-2.5 transition-all text-left opacity-70 hover:opacity-100';
      }
    }

    if (lightBtn) {
      if (!isDark) {
        lightBtn.className = 'p-3 rounded-xl border border-amber-500 bg-amber-500/10 flex items-center gap-2.5 transition-all text-left shadow-sm';
      } else {
        lightBtn.className = 'p-3 rounded-xl border border-slate-200 dark:border-dark-800 bg-white dark:bg-dark-950/60 flex items-center gap-2.5 transition-all text-left opacity-70 hover:opacity-100';
      }
    }
  }

  function syncSettingsPageSize() {
    const sel = document.getElementById('select-settings-pagesize');
    if (!sel) return;
    const saved = localStorage.getItem('wapp_route_pagesize') || '25';
    sel.value = saved;
  }

  window.handleSettingsPageSize = function handleSettingsPageSize(size) {
    try {
      localStorage.setItem('wapp_route_pagesize', size);
      if (typeof window.routePageSize !== 'undefined') {
        window.routePageSize = Number(size);
      }
      if (typeof loadRouteMatrix === 'function') loadRouteMatrix();
      if (typeof showToast === 'function') showToast(`Page size set to ${size} rows`, 'info');
    } catch (_) {}
  };

  window.updateSettingsAudioToggle = function updateSettingsAudioToggle() {
    const btn = document.getElementById('settings-audio-btn');
    if (!btn) return;
    const enabled = window.soundEnabled !== false;
    if (enabled) {
      btn.innerText = 'Enabled';
      btn.className = 'px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all';
    } else {
      btn.innerText = 'Muted';
      btn.className = 'px-3 py-1 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-dark-800 text-slate-500 border border-slate-300 dark:border-dark-700 transition-all';
    }
  };

  // -------------------------------------------------------------------------
  // 6. Direct Message (DM) Ingestion Settings (ADR-013)
  // -------------------------------------------------------------------------
  async function fetchDmRecordingSetting() {
    const input = document.getElementById('toggle-record-dms');
    const label = document.getElementById('settings-dm-switch-label');
    const badge = document.getElementById('settings-dm-status-badge');
    if (!input) return;

    try {
      const res = await fetch('/api/settings/dms');
      if (!res.ok) return;
      const data = await res.json();
      const isEnabled = Boolean(data.record_direct_messages);

      input.checked = isEnabled;
      if (label) label.innerText = isEnabled ? 'ON' : 'OFF';
      if (label) label.className = isEnabled ? 'text-[11px] font-bold text-emerald-500' : 'text-[11px] font-bold text-slate-400';
      if (badge) {
        if (isEnabled) {
          badge.innerText = 'DMs Recorded (Zero-Seen)';
          badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
        } else {
          badge.innerText = 'DMs Ignored';
          badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30';
        }
      }
    } catch (_) {}
  }

  window.toggleDmRecording = async function toggleDmRecording(checked) {
    const input = document.getElementById('toggle-record-dms');
    const label = document.getElementById('settings-dm-switch-label');
    const badge = document.getElementById('settings-dm-status-badge');

    try {
      const res = await fetch('/api/settings/dms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_direct_messages: checked })
      });
      const data = await res.json();
      const isEnabled = Boolean(data.record_direct_messages);

      if (input) input.checked = isEnabled;
      if (label) label.innerText = isEnabled ? 'ON' : 'OFF';
      if (label) label.className = isEnabled ? 'text-[11px] font-bold text-emerald-500' : 'text-[11px] font-bold text-slate-400';
      if (badge) {
        if (isEnabled) {
          badge.innerText = 'DMs Recorded (Zero-Seen)';
          badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
        } else {
          badge.innerText = 'DMs Ignored';
          badge.className = 'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30';
        }
      }

      if (typeof showToast === 'function') {
        showToast(
          isEnabled
            ? 'DM recording enabled. (Zero-Seen: DMs will never be marked as read)'
            : 'DM recording disabled. Ingesting groups only.',
          isEnabled ? 'success' : 'info'
        );
      }
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast('Failed to update DM setting: ' + err.message, 'error');
      }
      if (input) input.checked = !checked;
    }
  };

  // Run menu toggle initializer on initial script load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initSidebarMenuToggles);
  } else {
    window.initSidebarMenuToggles();
  }

})();
