/**
 * System Pipeline & Real-Time AI Processing Controller
 */
let pipelineAutoRefresh = true;
let pipelineRefreshTimer = null;
let cachedPipelineEvents = [];
let pipelineCurrentPage = 1;
let pipelinePageSize = parseInt(localStorage.getItem('wapp_pipeline_page_size') || '10', 10);
let pipelineSearchQuery = '';
let pipelineStatusFilter = 'all';

function esc(str) {
  if (window.escapeHtml) return window.escapeHtml(str);
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const PIPELINE_SAMPLES = {
  rate_sheet: `🔥 DIRECT ROUTE AVAILABLE 🔥\nColombia CC CLI 1/1 pulse\nClean 86xx / 1xx ANI passing, 100% FAS free\nAggressive rate: $0.0062 / min\nPing Carlos Morales — LatAm Telecom Bogota`,
  buying_demand: `WTB Urgent USA CC CLI routes\nLooking for 500 ports retail dialer traffic\nTarget price: $0.0070 / min, 1/1 pulse\nContact: Sarah Jenkins - VoxTel Enterprise NY`,
  outage_alert: `⚠️ EMERGENCY NOTICE: Major fiber cut on SEA-ME-WE 5\nAll UAE & India voice gateways experiencing high latency & degraded ASR.\nTraffic re-routed via secondary backup links.`
};

async function loadPipelineStatus() {
  try {
    const res = await fetch('/api/pipeline/status');
    if (!res.ok) return;
    const data = await res.json();
    if (data.status !== 'ok') return;

    // 1. Update 5 Stage Telemetry Counters
    const statIngested = document.getElementById('pipe-stat-ingested');
    const statQueue = document.getElementById('pipe-stat-queue');
    const statAiModel = document.getElementById('pipe-stat-ai-model');
    const statAiLatency = document.getElementById('pipe-stat-ai-latency');
    const statRoutes = document.getElementById('pipe-stat-routes');
    const statWebhook = document.getElementById('pipe-stat-webhook');
    const providerTag = document.getElementById('pipeline-active-provider-tag');

    if (statIngested) statIngested.innerText = data.summary.totalIngested;
    if (statQueue) {
      const q = data.stages.queue;
      if (q && q.processing > 0) {
        statQueue.innerText = `${q.pending} pend (${q.processing} run)`;
      } else if (q && q.pending > 0) {
        statQueue.innerText = `${q.pending} pending`;
      } else {
        statQueue.innerText = `0 msgs (Idle)`;
      }
    }
    if (statAiModel) statAiModel.innerText = (data.stages.ai.provider || 'deepseek').toUpperCase();
    if (statAiLatency) statAiLatency.innerText = `${data.stages.ai.avgLatencyMs || 0}ms`;
    if (statRoutes) statRoutes.innerText = data.summary.totalRoutes;
    if (statWebhook) statWebhook.innerText = data.stages.forwarder.endpoint;
    if (providerTag) providerTag.innerText = (data.stages.ai.provider || 'deepseek').toUpperCase();

    // 2. Render Live Feed Table
    cachedPipelineEvents = data.events || [];
    renderPipelineFeed();
  } catch (err) {
    console.warn('[Pipeline Controller] Telemetry refresh failed:', err.message);
  }
}

function handlePipelineSearch(event) {
  pipelineSearchQuery = (event.target.value || '').toLowerCase().trim();
  pipelineCurrentPage = 1;
  renderPipelineFeed();
}

function handlePipelineFilter() {
  const statusEl = document.getElementById('pipeline-filter-status');
  if (statusEl) pipelineStatusFilter = statusEl.value;
  pipelineCurrentPage = 1;
  renderPipelineFeed();
}

function setPipelinePageSize(size) {
  pipelinePageSize = parseInt(size, 10);
  localStorage.setItem('wapp_pipeline_page_size', String(pipelinePageSize));
  pipelineCurrentPage = 1;
  renderPipelineFeed();
}

function changePipelinePage(delta) {
  pipelineCurrentPage += delta;
  renderPipelineFeed();
}

function getFilteredPipelineEvents() {
  let list = cachedPipelineEvents.slice();

  // 1. Search Query
  if (pipelineSearchQuery) {
    list = list.filter(e => {
      const haystack = [
        e.sender_name, 
        e.sender_phone, 
        e.raw_text, 
        e.status, 
        e.intent,
        ...(Array.isArray(e.routes) ? e.routes.map(r => `${r.destination} ${r.rate} ${r.profile}`) : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(pipelineSearchQuery);
    });
  }

  // 2. Status Filter
  if (pipelineStatusFilter && pipelineStatusFilter !== 'all') {
    if (pipelineStatusFilter === 'NON_BUSINESS') {
      list = list.filter(e => e.status !== 'EXTRACTED' && e.status !== 'NEWS_ALERT');
    } else {
      list = list.filter(e => e.status === pipelineStatusFilter);
    }
  }

  return list;
}

function updatePipelinePaginationUI(total) {
  const startEl = document.getElementById('pipeline-page-start');
  const endEl = document.getElementById('pipeline-page-end');
  const totalEl = document.getElementById('pipeline-page-total');
  const currEl = document.getElementById('pipeline-current-page');
  const totalPagesEl = document.getElementById('pipeline-total-pages');
  const prevBtn = document.getElementById('btn-pipeline-prev');
  const nextBtn = document.getElementById('btn-pipeline-next');

  if (pipelinePageSize <= 0) {
    if (startEl) startEl.innerText = total > 0 ? 1 : 0;
    if (endEl) endEl.innerText = total;
    if (totalEl) totalEl.innerText = total;
    if (currEl) currEl.innerText = 1;
    if (totalPagesEl) totalPagesEl.innerText = 1;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const maxPages = Math.max(1, Math.ceil(total / pipelinePageSize));
  if (pipelineCurrentPage > maxPages) pipelineCurrentPage = maxPages;

  const start = total === 0 ? 0 : (pipelineCurrentPage - 1) * pipelinePageSize + 1;
  const end = Math.min(pipelineCurrentPage * pipelinePageSize, total);

  if (startEl) startEl.innerText = start;
  if (endEl) endEl.innerText = end;
  if (totalEl) totalEl.innerText = total;
  if (currEl) currEl.innerText = pipelineCurrentPage;
  if (totalPagesEl) totalPagesEl.innerText = maxPages;

  if (prevBtn) prevBtn.disabled = (pipelineCurrentPage <= 1);
  if (nextBtn) nextBtn.disabled = (pipelineCurrentPage >= maxPages);

  // Update button active state classes
  document.querySelectorAll('.btn-pipeline-size').forEach(btn => {
    const s = parseInt(btn.getAttribute('data-size'), 10);
    if (s === pipelinePageSize) {
      btn.className = 'btn-pipeline-size px-2 py-0.5 rounded-md bg-purple-600 text-white font-semibold transition-all font-mono';
    } else {
      btn.className = 'btn-pipeline-size px-2 py-0.5 rounded-md text-slate-400 hover:text-white transition-all font-mono';
    }
  });
}

function renderPipelineFeed(events) {
  if (Array.isArray(events)) {
    cachedPipelineEvents = events;
  }

  const tbody = document.getElementById('pipeline-feed-tbody');
  if (!tbody) return;

  const filtered = getFilteredPipelineEvents();
  const total = filtered.length;

  updatePipelinePaginationUI(total);

  if (total === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-500 text-xs">
          ${cachedPipelineEvents.length === 0 
            ? 'Waiting for live WhatsApp messages to flow through the AI engine...' 
            : 'No telemetry events match your search query or status filter.'}
        </td>
      </tr>
    `;
    return;
  }

  // Sliced page data
  let pageData = filtered;
  if (pipelinePageSize > 0) {
    const startIdx = (pipelineCurrentPage - 1) * pipelinePageSize;
    pageData = filtered.slice(startIdx, startIdx + pipelinePageSize);
  }

  tbody.innerHTML = pageData.map(evt => {
    let outcomeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 border border-slate-300 dark:border-slate-700">Non-Business Chat</span>';
    if (evt.status === 'EXTRACTED') {
      outcomeBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">Extracted ${evt.routes_count} Route${evt.routes_count > 1 ? 's' : ''}</span>`;
    } else if (evt.status === 'NEWS_ALERT') {
      outcomeBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30">News / Outage</span>`;
    }

    return `
      <tr class="hover:bg-slate-100 dark:hover:bg-dark-800/40 transition-colors">
        <td class="py-3 px-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">${esc(evt.timeStr || '')}</td>
        <td class="py-3 px-3">
          <span class="font-semibold text-slate-700 dark:text-slate-200 block truncate max-w-[140px]">${esc(evt.sender_name || 'Anonymous')}</span>
          <span class="text-[10px] text-slate-500 font-mono block">${esc(evt.sender_phone || '')}</span>
        </td>
        <td class="py-3 px-3">${outcomeBadge}</td>
        <td class="py-3 px-3 font-mono text-[11px] text-purple-400 dark:text-purple-300 font-semibold">${evt.latency_ms || 0}ms</td>
        <td class="py-3 px-3 text-right">
          <button onclick="openPipelineInspect('${esc(evt.id)}')" class="p-1.5 rounded-lg bg-slate-200 dark:bg-dark-800 hover:bg-slate-300 dark:hover:bg-dark-700 border border-slate-300 dark:border-dark-700 text-slate-700 dark:text-slate-300 hover:text-black dark:hover:text-white transition-all" title="Inspect Trace">
            <i data-lucide="eye" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function openPipelineInspect(id) {
  const evt = cachedPipelineEvents.find(e => e.id === id);
  if (!evt) return;

  const rawTextEl = document.getElementById('inspect-raw-text');
  const providerEl = document.getElementById('inspect-provider');
  const latencyEl = document.getElementById('inspect-latency');
  const jsonEl = document.getElementById('inspect-parsed-json');
  const modal = document.getElementById('modal-pipeline-inspect');

  if (rawTextEl) rawTextEl.innerText = evt.raw_text;
  if (providerEl) providerEl.innerText = (evt.provider || 'local').toUpperCase();
  if (latencyEl) latencyEl.innerText = `${evt.latency_ms || 0}ms`;
  if (jsonEl) {
    const payload = { is_telecom: evt.is_telecom, intent: evt.intent, routes: evt.routes, news: evt.news };
    jsonEl.innerText = JSON.stringify(payload, null, 2);
  }

  if (modal) {
    if (window.initWindow) window.initWindow(modal);
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }
}

function closePipelineInspectModal() {
  const modal = document.getElementById('modal-pipeline-inspect');
  if (modal) modal.classList.add('hidden');
  if (window.removeDockPill) window.removeDockPill('modal-pipeline-inspect');
}

function loadPipelineSample(sampleKey) {
  const input = document.getElementById('pipeline-sandbox-input');
  if (input && PIPELINE_SAMPLES[sampleKey]) {
    input.value = PIPELINE_SAMPLES[sampleKey];
    input.focus();
  }
}

async function runPipelineSandboxTest() {
  const input = document.getElementById('pipeline-sandbox-input');
  const btn = document.getElementById('btn-run-sandbox');
  const latencyLabel = document.getElementById('pipeline-sandbox-latency');
  const outputBox = document.getElementById('pipeline-sandbox-output-box');
  const jsonEl = document.getElementById('pipeline-sandbox-json');
  const badgeEl = document.getElementById('pipeline-sandbox-badge');

  const text = input ? input.value.trim() : '';
  if (!text) {
    if (input) input.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span><span>Analyzing with AI...</span>';
  }
  if (latencyLabel) latencyLabel.innerText = 'Extracting...';

  try {
    const token = (typeof getSavedToken === 'function' ? getSavedToken() : null) || localStorage.getItem('wapp_token') || sessionStorage.getItem('wapp_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/pipeline/test', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text })
    });

    if (res.status === 401) {
      throw new Error('Unauthorized: Session expired. Please re-login to the dashboard.');
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}: Failed to extract telecom data`);
    }

    if (outputBox) outputBox.classList.remove('hidden');
    if (jsonEl) jsonEl.innerText = JSON.stringify(data.parsed || data, null, 2);
    if (latencyLabel) latencyLabel.innerText = `${data.latency_ms || 0}ms (${(data.provider || 'local').toUpperCase()})`;

    // Dynamic extraction outcome badge
    if (badgeEl && data.parsed) {
      const p = data.parsed;
      if (p.isTelecom && Array.isArray(p.routes) && p.routes.length > 0) {
        badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30';
        badgeEl.innerText = `Extracted: ${p.routes.length} Active Route${p.routes.length > 1 ? 's' : ''}`;
      } else if (p.news) {
        badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30';
        badgeEl.innerText = 'Market Alert / Telco News';
      } else if (p.isTelecom) {
        badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30';
        badgeEl.innerText = 'Telecom Message (0 Routes)';
      } else {
        badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30';
        badgeEl.innerText = 'Filtered: Non-Telecom Noise (0 Routes)';
      }
    }

    // Refresh telemetry and live trace feed
    loadPipelineStatus();
  } catch (err) {
    if (outputBox) outputBox.classList.remove('hidden');
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30';
      badgeEl.innerText = 'Extraction Error';
    }
    if (jsonEl) jsonEl.innerText = `Error: ${err.message}`;
    if (latencyLabel) latencyLabel.innerText = 'Failed';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i><span>Test AI Extraction</span>';
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

window.pipelineAutoRefresh = true;

function togglePipelineAutoRefresh() {
  window.pipelineAutoRefresh = !window.pipelineAutoRefresh;
  const label = document.getElementById('label-pipeline-autorefresh');
  if (label) label.innerText = `Auto-Refresh: ${window.pipelineAutoRefresh ? 'ON' : 'OFF'}`;
}

// Attach globally to window for onclick handlers
window.loadPipelineStatus = loadPipelineStatus;
window.renderPipelineFeed = renderPipelineFeed;
window.openPipelineInspect = openPipelineInspect;
window.closePipelineInspectModal = closePipelineInspectModal;
window.loadPipelineSample = loadPipelineSample;
window.runPipelineSandboxTest = runPipelineSandboxTest;
window.togglePipelineAutoRefresh = togglePipelineAutoRefresh;
window.handlePipelineSearch = handlePipelineSearch;
window.handlePipelineFilter = handlePipelineFilter;
window.setPipelinePageSize = setPipelinePageSize;
window.changePipelinePage = changePipelinePage;
