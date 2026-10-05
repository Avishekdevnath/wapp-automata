/**
 * System Pipeline & Real-Time AI Processing Controller
 */
let pipelineAutoRefresh = true;
let pipelineRefreshTimer = null;
let cachedPipelineEvents = [];

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
    if (statQueue) statQueue.innerText = `${data.stages.queue.pending} msgs`;
    if (statAiModel) statAiModel.innerText = (data.stages.ai.provider || 'deepseek').toUpperCase();
    if (statAiLatency) statAiLatency.innerText = `${data.stages.ai.avgLatencyMs || 0}ms`;
    if (statRoutes) statRoutes.innerText = data.summary.totalRoutes;
    if (statWebhook) statWebhook.innerText = data.stages.forwarder.endpoint;
    if (providerTag) providerTag.innerText = (data.stages.ai.provider || 'deepseek').toUpperCase();

    // 2. Render Live Feed Table
    cachedPipelineEvents = data.events || [];
    renderPipelineFeed(cachedPipelineEvents);
  } catch (err) {
    console.warn('[Pipeline Controller] Telemetry refresh failed:', err.message);
  }
}

function renderPipelineFeed(events) {
  const tbody = document.getElementById('pipeline-feed-tbody');
  if (!tbody) return;

  if (!events || events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-slate-500 text-xs">
          Waiting for live WhatsApp messages to flow through the AI engine...
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = events.map(evt => {
    let outcomeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">Non-Business Chat</span>';
    if (evt.status === 'EXTRACTED') {
      outcomeBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Extracted ${evt.routes_count} Route${evt.routes_count > 1 ? 's' : ''}</span>`;
    } else if (evt.status === 'NEWS_ALERT') {
      outcomeBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">News / Outage</span>`;
    }

    return `
      <tr class="hover:bg-dark-800/40 transition-colors">
        <td class="py-3 px-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">${escapeHtml(evt.timeStr || '')}</td>
        <td class="py-3 px-3">
          <span class="font-semibold text-slate-200 block truncate max-w-[140px]">${escapeHtml(evt.sender_name || 'Anonymous')}</span>
          <span class="text-[10px] text-slate-500 font-mono block">${escapeHtml(evt.sender_phone || '')}</span>
        </td>
        <td class="py-3 px-3">${outcomeBadge}</td>
        <td class="py-3 px-3 font-mono text-[11px] text-purple-300">${evt.latency_ms || 0}ms</td>
        <td class="py-3 px-3 text-right">
          <button onclick="openPipelineInspect('${escapeHtml(evt.id)}')" class="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-slate-300 hover:text-white transition-all" title="Inspect Trace">
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

  if (modal) modal.classList.remove('hidden');
}

function closePipelineInspectModal() {
  const modal = document.getElementById('modal-pipeline-inspect');
  if (modal) modal.classList.add('hidden');
}

function loadPipelineSample(sampleKey) {
  const input = document.getElementById('pipeline-sandbox-input');
  if (input && PIPELINE_SAMPLES[sampleKey]) {
    input.value = PIPELINE_SAMPLES[sampleKey];
  }
}

async function runPipelineSandboxTest() {
  const input = document.getElementById('pipeline-sandbox-input');
  const btn = document.getElementById('btn-run-sandbox');
  const latencyLabel = document.getElementById('pipeline-sandbox-latency');
  const outputBox = document.getElementById('pipeline-sandbox-output-box');
  const jsonEl = document.getElementById('pipeline-sandbox-json');

  if (!input || !input.value.trim()) return;

  if (btn) btn.disabled = true;
  if (latencyLabel) latencyLabel.innerText = 'Extracting...';

  try {
    const res = await fetch('/api/pipeline/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input.value.trim() })
    });
    const data = await res.json();

    if (outputBox) outputBox.classList.remove('hidden');
    if (jsonEl) jsonEl.innerText = JSON.stringify(data.parsed || data, null, 2);
    if (latencyLabel) latencyLabel.innerText = `${data.latency_ms || 0}ms (${(data.provider || 'local').toUpperCase()})`;
    
    // Refresh the pipeline feed to show this new trace
    loadPipelineStatus();
  } catch (err) {
    if (jsonEl) jsonEl.innerText = `Error: ${err.message}`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function togglePipelineAutoRefresh() {
  pipelineAutoRefresh = !pipelineAutoRefresh;
  const label = document.getElementById('label-pipeline-autorefresh');
  if (label) label.innerText = `Auto-Refresh: ${pipelineAutoRefresh ? 'ON' : 'OFF'}`;
}

// Auto-polling interval
setInterval(() => {
  if (pipelineAutoRefresh && window.currentActiveView === 'pipeline') {
    loadPipelineStatus();
  }
}, 3000);
