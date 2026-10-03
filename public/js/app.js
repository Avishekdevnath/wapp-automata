/**
 * Global Application Core: Router, Sound, Polling & Utilities
 */
window.messagesCache = [];
window.currentUiMode = localStorage.getItem('wapp_ui_mode') || 'client';
window.soundEnabled = true;

// Switch between Client Mode and Developer Mode
function setUiMode(mode) {
  window.currentUiMode = mode;
  localStorage.setItem('wapp_ui_mode', mode);

  const isClient = mode === 'client';
  const clientView = document.getElementById('view-client');
  const devView = document.getElementById('view-dev');
  const btnClient = document.getElementById('btn-mode-client');
  const btnDev = document.getElementById('btn-mode-dev');
  const rolePill = document.getElementById('role-pill');

  if (clientView) clientView.classList.toggle('hidden', !isClient);
  if (devView) devView.classList.toggle('hidden', isClient);

  if (isClient) {
    if (btnClient) btnClient.className = 'px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    if (btnDev) btnDev.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5';
    if (rolePill) {
      rolePill.innerText = 'Client Mode';
      rolePill.className = 'text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    }
    renderClientFeed();
  } else {
    if (btnDev) btnDev.className = 'px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
    if (btnClient) btnClient.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5';
    if (rolePill) {
      rolePill.innerText = 'Developer Studio';
      rolePill.className = 'text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20';
    }
    renderDevFeed();
    renderAuditTable();
  }

  if (window.lucide) lucide.createIcons();
}

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
    
    const previousLength = window.messagesCache.length;
    window.messagesCache = data;

    if (previousLength > 0 && data.length > previousLength) {
      playChime();
      showToast(`${data.length - previousLength} new message received`, 'success');
    }

    if (typeof updateStats === 'function') updateStats(data);
    if (window.currentUiMode === 'client') {
      if (typeof renderClientFeed === 'function') renderClientFeed();
    } else {
      if (typeof renderDevFeed === 'function') renderDevFeed();
      if (typeof renderAuditTable === 'function') renderAuditTable();
    }
  } catch (err) {
    console.error('Error fetching messages:', err);
  }
}

function exportMessagesJson() {
  const blob = new Blob([JSON.stringify(window.messagesCache, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = 'wapp-messages-' + Date.now() + '.json';
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Exported messages JSON', 'success');
}

async function clearMessagesFeed() {
  if (!confirm('Clear all displayed messages from this session feed?')) return;
  try {
    await fetch('/api/clear', { method: 'POST' });
    window.messagesCache = [];
    renderDevFeed();
    renderClientFeed();
    renderAuditTable();
    updateStats([]);
    showToast('Feed cleared', 'info');
  } catch (err) {
    showToast('Error clearing feed', 'error');
  }
}

// Audio Chime & Utilities
function playChime() {
  if (!window.soundEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880.0, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.36);
  } catch (e) {}
}

function toggleSound() {
  window.soundEnabled = !window.soundEnabled;
  const icon = document.getElementById('icon-sound');
  if (!icon) return;

  if (window.soundEnabled) {
    icon.classList.add('text-emerald-400');
    icon.classList.remove('text-slate-500');
    showToast('Audio chime enabled', 'success');
  } else {
    icon.classList.remove('text-emerald-400');
    icon.classList.add('text-slate-500');
    showToast('Audio chime muted', 'info');
  }
}

function getAvatarColor(str) {
  const colors = [
    'from-emerald-500 to-teal-700',
    'from-sky-500 to-blue-700',
    'from-indigo-500 to-purple-700',
    'from-amber-500 to-orange-700',
    'from-rose-500 to-pink-700'
  ];
  let hash = 0;
  for (let i = 0; i < (str || '').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  if (!name) return 'WA';
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-600/90 text-white border-emerald-500/40',
    error: 'bg-rose-600/90 text-white border-rose-500/40',
    info: 'bg-dark-900/90 text-slate-200 border-dark-700'
  };

  toast.className = `px-4 py-2.5 rounded-xl border shadow-xl text-xs font-medium flex items-center gap-2 backdrop-blur-md transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Lifecycle Initialization
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setInterval(fetchMessages, 1500);
  setInterval(pollSessionStatus, 2000);
});
