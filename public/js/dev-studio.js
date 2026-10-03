/**
 * Developer Studio Module: Engineering Telemetry, HMAC Audit Trail & Payload Inspector
 */
let selectedMessage = null;

function switchDevSubTab(tab) {
  document.getElementById('dev-content-feed')?.classList.toggle('hidden', tab !== 'feed');
  document.getElementById('dev-content-audit')?.classList.toggle('hidden', tab !== 'audit');
  document.getElementById('dev-content-docs')?.classList.toggle('hidden', tab !== 'docs');

  ['feed', 'audit', 'docs'].forEach(t => {
    const btn = document.getElementById(`dev-tab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-dark-800 transition-all flex items-center gap-1.5';
      }
    }
  });

  if (window.lucide) lucide.createIcons();
}

function updateStats(data) {
  const totalEl = document.getElementById('stat-total');
  const hmacEl = document.getElementById('stat-hmac-rate');
  const chanEl = document.getElementById('stat-channels');
  const latEl = document.getElementById('stat-latency');

  if (totalEl) totalEl.innerText = data.length;

  if (hmacEl) {
    const validCount = data.filter(m => m.isValid).length;
    hmacEl.innerText = data.length > 0 ? `${Math.round((validCount / data.length) * 100)}%` : '100%';
  }

  if (chanEl) {
    const channels = new Set();
    data.forEach(m => {
      if (m.chat_name) channels.add(m.chat_name);
      else if (m.chat_id) channels.add(m.chat_id);
    });
    chanEl.innerText = channels.size;
  }

  if (latEl && data.length > 0 && data[0].latency_ms) {
    latEl.innerText = `~${data[0].latency_ms} ms`;
  }
}

function renderDevFeed() {
  const container = document.getElementById('dev-messages-container');
  if (!container) return;

  if (!window.messagesCache || window.messagesCache.length === 0) {
    container.innerHTML = '<div class="glass-card rounded-2xl p-8 text-center text-xs text-slate-500">No events logged</div>';
    return;
  }

  container.innerHTML = window.messagesCache.map(m => `
    <div class="glass-card rounded-2xl p-4 border border-dark-700 font-mono text-xs space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-emerald-400 font-bold">${escapeHtml(m.event || 'whatsapp.message.received')}</span>
        <span class="text-slate-400">${escapeHtml(typeof formatDateTime === 'function' ? formatDateTime(m.occurred_at || m.timestamp) : (m.timestamp || ''))}</span>
      </div>
      <div class="flex items-center justify-between text-slate-400 text-[11px]">
        <span>Delivery: <code class="text-slate-200">${m.delivery_id || m.id}</code></span>
        <span>Latency: <code class="text-emerald-400">${m.latency_ms || 15}ms</code></span>
      </div>
      <div class="bg-dark-950 p-2.5 rounded-lg text-slate-300 truncate">
        ${escapeHtml(m.text || '')}
      </div>
      <div class="flex justify-end pt-1">
        <button onclick="inspectMessage('${m.id}')" class="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1">
          <i data-lucide="eye" class="w-3 h-3"></i> Inspect Payload
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function renderAuditTable() {
  const tbody = document.getElementById('audit-table-body');
  if (!tbody) return;

  tbody.innerHTML = (window.messagesCache || []).map(m => `
    <tr class="hover:bg-dark-850/60 transition-colors">
      <td class="py-2.5 px-3 text-slate-200">${m.delivery_id || m.id}</td>
      <td class="py-2.5 px-3 text-emerald-400">${m.event || 'whatsapp.message.received'}</td>
      <td class="py-2.5 px-3 text-slate-400 truncate max-w-[120px]">${(m.headers && m.headers['x-collector-signature']) ? m.headers['x-collector-signature'].slice(0, 16) + '...' : 'sha256=...'}</td>
      <td class="py-2.5 px-3 text-slate-300">${m.attempt || 1}</td>
      <td class="py-2.5 px-3">
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${m.isValid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">
          ${m.isValid ? 'PASS' : 'TAMPERED'}
        </span>
      </td>
      <td class="py-2.5 px-3 text-right">
        <button onclick="inspectMessage('${m.id}')" class="text-emerald-400 hover:text-emerald-300">View</button>
      </td>
    </tr>
  `).join('');
}

function inspectMessage(id) {
  const msg = (window.messagesCache || []).find(m => m.id === id);
  if (!msg) return;

  selectedMessage = msg;
  const sub = document.getElementById('drawer-subtitle');
  const content = document.getElementById('drawer-json-content');
  const drawer = document.getElementById('inspector-drawer');

  if (sub) sub.innerText = msg.delivery_id || msg.id;
  if (content) content.innerText = JSON.stringify(msg.raw_envelope || msg, null, 2);
  if (drawer) drawer.classList.remove('hidden');

  if (window.lucide) lucide.createIcons();
}

function closeInspector() {
  document.getElementById('inspector-drawer')?.classList.add('hidden');
}

function copyDrawerJson() {
  if (!selectedMessage) return;
  navigator.clipboard.writeText(JSON.stringify(selectedMessage.raw_envelope || selectedMessage, null, 2));
  showToast('Payload JSON copied to clipboard', 'success');
}
