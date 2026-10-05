/**
 * Global Application Core: Router, Sound, Polling & Utilities
 * Wholesale Telecom Route Intelligence Terminal
 */
window.messagesCache = [];
window.currentView = localStorage.getItem('wapp_active_view') || 'routes';
window.soundEnabled = true;

window.escapeHtml = function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

window.formatDateTime = function formatDateTime(val) {
  if (!val) return '—';
  try {
    const num = Number(val);
    const d = !isNaN(num) && num > 0
      ? new Date(num < 1e12 ? num * 1000 : num)
      : new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return String(val);
  }
};

// High-Performance Scoped Lucide Icon Batcher
// Prevents re-parsing the entire DOM and destroying existing SVGs
(function() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    const nativeCreateIcons = window.lucide.createIcons.bind(window.lucide);
    let rafScheduled = false;
    const targetContainers = new Set();

    function flushIconUpdates() {
      rafScheduled = false;
      if (targetContainers.size > 0) {
        targetContainers.forEach(container => {
          if (container && container.nodeType === 1) {
            nativeCreateIcons({ root: container });
          }
        });
        targetContainers.clear();
      } else {
        const unrendered = document.querySelectorAll('i[data-lucide]');
        if (unrendered.length > 0) {
          nativeCreateIcons();
        }
      }
    }

    window.lucide.createIcons = function(options) {
      if (options && options.root) {
        targetContainers.add(options.root);
      }
      if (!rafScheduled) {
        rafScheduled = true;
        requestAnimationFrame(flushIconUpdates);
      }
    };

    window.refreshIcons = function(container) {
      window.lucide.createIcons(container ? { root: container } : undefined);
    };
  }
})();

// Multi-View Navigation & Hash Router
function getViewFromHash() {
  const hash = (window.location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
  const validViews = ['routes', 'trends', 'insights', 'news', 'vendors', 'terminal', 'pipeline', 'dev'];
  if (validViews.includes(hash)) return hash;
  if (hash === 'stream') return 'terminal';
  return null;
}

function switchView(viewName, updateHash = true) {
  if (!viewName) viewName = 'routes';
  window.currentView = viewName;
  localStorage.setItem('wapp_active_view', viewName);

  if (updateHash && window.location.hash !== `#/${viewName}`) {
    if (window.history.pushState) {
      window.history.pushState(null, '', `#/${viewName}`);
    } else {
      window.location.hash = `#/${viewName}`;
    }
  }

  window.currentActiveView = viewName;

  const views = [
    'view-routes',
    'view-trends',
    'view-insights',
    'view-news',
    'view-vendors',
    'view-terminal',
    'view-pipeline',
    'view-dev'
  ];

  // Hide all views and show target view
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hidden', v !== `view-${viewName}`);
  });

  // Update sidebar active buttons with .active class
  document.querySelectorAll('.sidebar-nav-btn').forEach(btn => {
    const target = btn.getAttribute('data-view');
    const isActive = (target === viewName);
    btn.classList.toggle('active', isActive);
  });

  // Update top title
  const titleMap = {
    'routes': { title: 'Route Matrix & Rate Sheet', sub: 'Filter, compare, and knock carriers for active wholesale voice routes' },
    'trends': { title: 'Market Trends & Price Analytics', sub: 'Historical pricing charts, rate fluctuations, and multi-year data' },
    'insights': { title: 'AI Insights & Arbitrage', sub: 'Automated deal matching between buy requests and supply offers' },
    'news': { title: 'Telco News & Outage Alerts', sub: 'Real-time carrier maintenance, regulatory blocks, and FAS fraud warnings' },
    'vendors': { title: 'Carrier & Vendor Directory', sub: 'Registered telecom wholesale providers and account managers' },
    'terminal': { title: 'Live WhatsApp Messages Stream', sub: 'Continuous 24/7 capture of all incoming group broadcasts, rate sheets, and carrier DMs' },
    'pipeline': { title: 'System Pipeline & AI Inspector', sub: 'Real-time telemetry of message ingestion, AI entity extraction, queue, and market indexing' },
    'dev': { title: 'Developer Studio & API Lab', sub: 'Webhook payload inspection, HMAC validation, and traffic simulator' }
  };

  const currentMeta = titleMap[viewName] || titleMap['routes'];
  const titleEl = document.getElementById('view-header-title');
  const subEl = document.getElementById('view-header-sub');
  if (titleEl) titleEl.innerText = currentMeta.title;
  if (subEl) subEl.innerText = currentMeta.sub;

  // Trigger data loader for the active view
  if (viewName === 'routes' && typeof loadRouteMatrix === 'function') loadRouteMatrix();
  if (viewName === 'trends' && typeof loadMarketTrends === 'function') loadMarketTrends();
  if (viewName === 'insights' && typeof loadAiInsights === 'function') loadAiInsights();
  if (viewName === 'news' && typeof loadTelcoNews === 'function') loadTelcoNews();
  if (viewName === 'vendors' && typeof loadVendorDirectory === 'function') loadVendorDirectory();
  if (viewName === 'terminal' && typeof renderClientFeed === 'function') renderClientFeed();
  if (viewName === 'pipeline' && typeof loadPipelineStatus === 'function') loadPipelineStatus();
  if (viewName === 'dev') {
    if (typeof renderDevFeed === 'function') renderDevFeed();
    if (typeof renderAuditTable === 'function') renderAuditTable();
  }

  // Close mobile sidebar if open
  closeMobileSidebar();

  // Reset scroll position and toggle fixed terminal viewport lock
  const scrollEl = document.getElementById('main-content-scroll') || document.getElementById('app-main-content');
  if (scrollEl) {
    if (viewName === 'terminal') {
      scrollEl.classList.add('terminal-view-active');
    } else {
      scrollEl.classList.remove('terminal-view-active');
      scrollEl.scrollTop = 0;
    }
  }

  if (window.lucide) lucide.createIcons();
}

// Universal Sidebar Controller (Desktop Collapse & Mobile Off-Canvas Drawer)
function toggleSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  const isDesktop = window.innerWidth >= 1024;
  if (isDesktop) {
    const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
    try {
      localStorage.setItem('wapp_sidebar_collapsed', isCollapsed ? '1' : '0');
    } catch {}
  } else {
    const isClosed = sidebar.classList.contains('-translate-x-full');
    if (isClosed) {
      sidebar.classList.remove('-translate-x-full');
      if (backdrop) backdrop.classList.remove('hidden');
    } else {
      closeMobileSidebar();
    }
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar && window.innerWidth < 1024) {
    sidebar.classList.add('-translate-x-full');
  }
  if (backdrop) backdrop.classList.add('hidden');
}

function initSidebarState() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  if (window.innerWidth >= 1024) {
    try {
      if (localStorage.getItem('wapp_sidebar_collapsed') === '1') {
        sidebar.classList.add('sidebar-collapsed');
      } else {
        sidebar.classList.remove('sidebar-collapsed');
      }
    } catch {}
    sidebar.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
  } else {
    sidebar.classList.remove('sidebar-collapsed');
    sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
  }
}

// Window resize listener to handle responsive transitions cleanly
window.addEventListener('resize', () => {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  if (window.innerWidth >= 1024) {
    sidebar.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
    try {
      if (localStorage.getItem('wapp_sidebar_collapsed') === '1') {
        sidebar.classList.add('sidebar-collapsed');
      }
    } catch {}
  } else {
    sidebar.classList.remove('sidebar-collapsed');
    if (!sidebar.classList.contains('-translate-x-full') && backdrop) {
      backdrop.classList.remove('hidden');
    }
  }
});

// Explicit Global Exports
window.toggleSidebar = toggleSidebar;
window.toggleMobileSidebar = toggleSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.initSidebarState = initSidebarState;

// Data Polling
async function fetchMessages() {
  try {
    const res = await fetch('/api/messages');
    if (res.status === 401) {
      if (typeof checkAuth === 'function') checkAuth();
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    
    const validData = Array.isArray(data) ? data.filter(m => (m.text && m.text.trim()) || m.has_media) : [];
    const previousLength = window.messagesCache.length;
    window.messagesCache = validData;

    // Update Stream badge in sidebar
    const streamBadge = document.getElementById('stream-count-badge');
    if (streamBadge) streamBadge.innerText = validData.length;

    if (previousLength > 0 && data.length > previousLength) {
      playChime();
      showToast(`${data.length - previousLength} new message ingested`, 'success');

      // Refresh active view
      if (window.currentView === 'routes' && typeof loadRouteMatrix === 'function') loadRouteMatrix();
      if (window.currentView === 'insights' && typeof loadAiInsights === 'function') loadAiInsights();
      if (window.currentView === 'news' && typeof loadTelcoNews === 'function') loadTelcoNews();
    }

    if (typeof updateStats === 'function') updateStats(data);
    if (window.currentView === 'terminal' && typeof renderClientFeed === 'function') renderClientFeed();
    if (window.currentView === 'dev') {
      if (typeof renderDevFeed === 'function') renderDevFeed();
      if (typeof renderAuditTable === 'function') renderAuditTable();
    }
  } catch (err) {
    console.error('Error fetching messages:', err);
  }
}

async function clearMessagesFeed() {
  if (!confirm('Clear all displayed messages from this session feed?')) return;
  try {
    await fetch('/api/clear', { method: 'POST' });
    window.messagesCache = [];
    if (typeof renderDevFeed === 'function') renderDevFeed();
    if (typeof renderClientFeed === 'function') renderClientFeed();
    if (typeof renderAuditTable === 'function') renderAuditTable();
    if (typeof updateStats === 'function') updateStats([]);
    showToast('Feed cleared', 'info');
  } catch (err) {
    showToast('Error clearing feed', 'error');
  }
}

// Sound chime generator using Web Audio API
function playChime() {
  if (!window.soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {}
}

function toggleSound() {
  window.soundEnabled = !window.soundEnabled;
  const icon = document.getElementById('icon-sound');
  if (icon) {
    if (window.soundEnabled) {
      icon.setAttribute('data-lucide', 'volume-2');
      icon.className = 'w-4 h-4 text-emerald-400';
      showToast('Sound alerts enabled', 'info');
    } else {
      icon.setAttribute('data-lucide', 'volume-x');
      icon.className = 'w-4 h-4 text-slate-500';
      showToast('Sound alerts muted', 'info');
    }
    if (window.lucide) lucide.createIcons();
  }
}

// WhatsApp Enterprise Dual-Mode Theme Manager (Dark & Light)
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('wapp_theme', isDark ? 'dark' : 'light');
  updateThemeIcon(isDark);
  if (typeof trendsChartInstance !== 'undefined' && trendsChartInstance && typeof loadMarketTrends === 'function') {
    loadMarketTrends();
  }
  if (typeof showToast === 'function') {
    showToast(isDark ? 'Dark Theme (WhatsApp Web)' : 'Light Theme (WhatsApp Clean)', 'info');
  }
}

function updateThemeIcon(isDark) {
  const icon = document.getElementById('icon-theme');
  const btn = document.getElementById('btn-theme');
  if (icon) {
    icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    icon.className = isDark ? 'w-4 h-4 text-amber-400' : 'w-4 h-4 text-emerald-600';
  }
  if (btn) {
    btn.setAttribute('title', isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme');
  }
  if (window.lucide) lucide.createIcons();
}

function initTheme() {
  const saved = localStorage.getItem('wapp_theme');
  const isDark = saved ? saved === 'dark' : true;
  document.documentElement.classList.toggle('dark', isDark);
  updateThemeIcon(isDark);
}
window.toggleTheme = toggleTheme;

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const borderColors = {
    success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200',
    error: 'border-rose-500/40 bg-rose-950/90 text-rose-200',
    info: 'border-blue-500/40 bg-dark-900/90 text-slate-200'
  };

  toast.className = `glass-card pointer-events-auto px-4 py-2.5 rounded-xl border text-xs shadow-2xl flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 ${borderColors[type] || borderColors.info}`;
  toast.innerHTML = `
    <span class="font-medium">${message}</span>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Hashchange event listener for browser navigation (Back / Forward buttons)
window.addEventListener('hashchange', () => {
  const hashView = getViewFromHash();
  if (hashView && hashView !== window.currentView) {
    switchView(hashView, false);
  }
});

async function fetchInitialBadgeCounts() {
  try {
    const token = localStorage.getItem('wapp_token') || sessionStorage.getItem('wapp_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // 1. Routes Count
    fetch('/api/routes', { headers })
      .then(r => r.ok && r.json())
      .then(d => {
        if (d && d.total !== undefined) {
          const el = document.getElementById('route-count-badge');
          if (el) el.innerText = d.total;
        }
      }).catch(() => {});

    // 2. News Count
    fetch('/api/news', { headers })
      .then(r => r.ok && r.json())
      .then(d => {
        if (d && Array.isArray(d.news)) {
          const el = document.getElementById('news-count-badge');
          if (el) el.innerText = d.news.length;
        }
      }).catch(() => {});

    // 3. Vendors Count
    fetch('/api/vendors', { headers })
      .then(r => r.ok && r.json())
      .then(d => {
        if (d && Array.isArray(d.vendors)) {
          const el = document.getElementById('vendor-count-badge');
          if (el) el.innerText = d.vendors.length;
        }
      }).catch(() => {});
  } catch {}
}
window.fetchInitialBadgeCounts = fetchInitialBadgeCounts;

// Trader Keyboard Shortcuts Engine (Zero-Mouse Trading Control)
function openShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.initWindow) window.initWindow('shortcuts-modal');
    if (window.lucide) window.lucide.createIcons();
  }
}
window.openShortcutsModal = openShortcutsModal;

function closeShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (modal) modal.classList.add('hidden');
}
window.closeShortcutsModal = closeShortcutsModal;

function toggleShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  if (!modal) return;
  if (modal.classList.contains('hidden')) {
    openShortcutsModal();
  } else {
    closeShortcutsModal();
  }
}
window.toggleShortcutsModal = toggleShortcutsModal;

(function initTraderKeyboardShortcuts() {
  const VIEW_MAP = {
    '1': 'routes',
    '2': 'trends',
    '3': 'insights',
    '4': 'news',
    '5': 'vendors',
    '6': 'terminal',
    '7': 'pipeline',
    '8': 'dev'
  };

  const SEARCH_INPUT_MAP = {
    'routes': 'route-search-input',
    'news': 'news-search-input',
    'vendors': 'vendor-search-input',
    'terminal': 'client-search-input',
    'pipeline': 'pipe-search-input'
  };

  document.addEventListener('keydown', (e) => {
    // 1. If currently typing inside any input, textarea, or select:
    const activeEl = document.activeElement;
    const isTyping = activeEl && (
      activeEl.tagName === 'INPUT' ||
      activeEl.tagName === 'TEXTAREA' ||
      activeEl.tagName === 'SELECT' ||
      activeEl.isContentEditable
    );

    // Escape while typing simply blurs/unfocuses the input
    if (e.key === 'Escape' && isTyping) {
      activeEl.blur();
      return;
    }

    // Never hijack keystrokes while the user is actively filling out a field
    if (isTyping) return;

    // Do not trigger view changes if any dialog/modal is open
    const openModal = document.querySelector('.win-modal-container:not(.hidden)');
    if (openModal) return;

    // 2. Press '/' anywhere to focus search input of active view
    if (e.key === '/') {
      e.preventDefault();
      const current = window.currentActiveView || window.currentView || 'routes';
      const inputId = SEARCH_INPUT_MAP[current] || 'route-search-input';
      const searchEl = document.getElementById(inputId);
      if (searchEl) {
        searchEl.focus();
        searchEl.select();
      } else {
        // Fallback to route matrix search
        switchView('routes');
        setTimeout(() => {
          const fallback = document.getElementById('route-search-input');
          if (fallback) { fallback.focus(); fallback.select(); }
        }, 50);
      }
      return;
    }

    // 3. Press '1' through '8' to switch views instantly
    if (VIEW_MAP[e.key]) {
      e.preventDefault();
      const targetView = VIEW_MAP[e.key];
      switchView(targetView);
      return;
    }

    // 4. Press '?' to toggle keyboard shortcuts cheat sheet
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault();
      toggleShortcutsModal();
      return;
    }

    // 5. Press '\' or 'Ctrl+B' to toggle sidebar
    if (e.key === '\\' || (e.key.toLowerCase() === 'b' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    // 6. Escape closes mobile sidebar drawer if open
    if (e.key === 'Escape' && window.innerWidth < 1024) {
      const sidebar = document.getElementById('app-sidebar');
      if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        closeMobileSidebar();
        return;
      }
    }
  });
})();

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebarState();

  if (typeof checkAuth === 'function') {
    checkAuth();
  }

  // Load initial view from URL hash or localStorage or fallback to 'routes'
  const initialView = getViewFromHash() || localStorage.getItem('wapp_active_view') || 'routes';
  switchView(initialView, true);

  // Immediately populate badge numbers
  fetchInitialBadgeCounts();

  // Coordinated Background Polling Engine with Smart Tab Sleep
  let heartbeatCycle = 0;
  let isHeartbeatBusy = false;

  async function coordinatedDashboardHeartbeat() {
    // Pause network polling when tab is hidden to save 100% idle CPU
    if (document.hidden) return;
    if (isHeartbeatBusy) return;
    isHeartbeatBusy = true;

    try {
      heartbeatCycle++;

      // 1. Fetch live messages every cycle (~5s)
      if (typeof fetchMessages === 'function') {
        await fetchMessages();
      }

      // 2. Poll device session status every 2nd cycle (~10s) if device modal is closed
      const deviceModal = document.getElementById('device-modal');
      const isDeviceModalOpen = deviceModal && !deviceModal.classList.contains('hidden');
      if (typeof pollDeviceStatus === 'function' && !isDeviceModalOpen && (heartbeatCycle % 2 === 0)) {
        await pollDeviceStatus();
      }

      // 3. Poll storage status every 6th cycle (~30s)
      if (typeof pollStorageStatus === 'function' && (heartbeatCycle % 6 === 0)) {
        await pollStorageStatus();
      }

      // 4. If Pipeline view is currently active, sync pipeline metrics
      if (window.currentActiveView === 'pipeline' && window.pipelineAutoRefresh !== false && typeof loadPipelineStatus === 'function') {
        await loadPipelineStatus();
      }
    } catch (err) {
      console.warn('[Heartbeat] Polling cycle error:', err);
    } finally {
      isHeartbeatBusy = false;
    }
  }

  // Initial immediate fetch
  coordinatedDashboardHeartbeat();

  // Unified single polling timer
  setInterval(coordinatedDashboardHeartbeat, 5000);

  // Instantly sync when user switches back to this tab
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      coordinatedDashboardHeartbeat();
    }
  });
});
