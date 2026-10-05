/**
 * AI Settings Controller (DeepSeek, OpenAI, Grok, Local Regex)
 */

async function openAiSettingsModal() {
  const modal = document.getElementById('modal-ai-settings');
  if (modal) {
    if (window.initWindow) window.initWindow(modal);
    modal.classList.remove('hidden');
  }
  await loadAiSettings();
  if (window.lucide) lucide.createIcons();
}

function closeAiSettingsModal() {
  const modal = document.getElementById('modal-ai-settings');
  if (modal) modal.classList.add('hidden');
  if (window.removeDockPill) window.removeDockPill('modal-ai-settings');
  const feedback = document.getElementById('ai-test-feedback');
  if (feedback) feedback.classList.add('hidden');
}

async function loadAiSettings() {
  try {
    const res = await fetch('/api/settings/ai');
    if (!res.ok) return;
    const data = await res.json();

    // 1. Check matching provider radio
    const radio = document.querySelector(`input[name="ai-provider"][value="${data.provider || 'deepseek'}"]`);
    if (radio) radio.checked = true;

    // 2. Update status badges
    const deepseekBadge = document.getElementById('badge-deepseek-status');
    const openaiBadge = document.getElementById('badge-openai-status');
    const grokBadge = document.getElementById('badge-grok-status');

    if (deepseekBadge) {
      deepseekBadge.innerText = data.deepseek?.hasKey ? `Active (${data.deepseek.maskedKey})` : 'Not set';
      deepseekBadge.className = data.deepseek?.hasKey ? 'text-[10px] text-emerald-400 font-mono' : 'text-[10px] text-slate-500 font-mono';
    }
    if (openaiBadge) {
      openaiBadge.innerText = data.openai?.hasKey ? `Active (${data.openai.maskedKey})` : 'Not set';
      openaiBadge.className = data.openai?.hasKey ? 'text-[10px] text-emerald-400 font-mono' : 'text-[10px] text-slate-500 font-mono';
    }
    if (grokBadge) {
      grokBadge.innerText = data.grok?.hasKey ? `Active (${data.grok.maskedKey})` : 'Not set';
      grokBadge.className = data.grok?.hasKey ? 'text-[10px] text-emerald-400 font-mono' : 'text-[10px] text-slate-500 font-mono';
    }

    // 3. Update header badge
    updateHeaderAiBadge(data.provider || 'deepseek');
    syncAiProviderFields();
  } catch (err) {
    console.warn('Failed to load AI settings:', err.message);
  }
}

function updateHeaderAiBadge(provider) {
  const badge = document.getElementById('header-ai-provider-badge');
  if (!badge) return;
  const names = {
    deepseek: 'DeepSeek',
    openai: 'ChatGPT',
    grok: 'xAI Grok',
    local: 'Regex'
  };
  badge.innerText = names[provider] || provider;
}

function syncAiProviderFields() {
  const provider = document.querySelector('input[name="ai-provider"]:checked')?.value || 'deepseek';
  updateHeaderAiBadge(provider);
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

async function handleAiSettingsSave(e) {
  e.preventDefault();
  const provider = document.querySelector('input[name="ai-provider"]:checked')?.value || 'deepseek';
  const deepseekKey = document.getElementById('input-key-deepseek')?.value;
  const openaiKey = document.getElementById('input-key-openai')?.value;
  const grokKey = document.getElementById('input-key-grok')?.value;

  const payload = { provider };
  if (deepseekKey) payload.deepseek_key = deepseekKey;
  if (openaiKey) payload.openai_key = openaiKey;
  if (grokKey) payload.grok_key = grokKey;

  const btn = document.getElementById('btn-save-ai');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/settings/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (typeof showToast === 'function') {
      showToast(`AI settings saved. Active engine: ${provider.toUpperCase()}`, 'success');
    }

    closeAiSettingsModal();
    updateHeaderAiBadge(provider);
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Failed to save AI settings: ${err.message}`, 'error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleAiTestConnection() {
  const provider = document.querySelector('input[name="ai-provider"]:checked')?.value || 'deepseek';
  const inputMap = {
    deepseek: 'input-key-deepseek',
    openai: 'input-key-openai',
    grok: 'input-key-grok'
  };
  const keyInput = inputMap[provider] ? document.getElementById(inputMap[provider]) : null;
  const keyVal = keyInput ? keyInput.value : '';

  const feedback = document.getElementById('ai-test-feedback');
  const btn = document.getElementById('btn-test-ai');

  if (feedback) {
    feedback.classList.remove('hidden');
    feedback.className = 'p-3 rounded-xl bg-dark-950 border border-dark-800 text-[11px] text-slate-300 flex items-center gap-2';
    feedback.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-purple-400"></i><span>Testing connection & route extraction...</span>';
  }
  if (btn) btn.disabled = true;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/settings/ai/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key: keyVal })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    if (feedback) {
      feedback.className = 'p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300 space-y-1.5';
      feedback.innerHTML = `
        <div class="font-bold flex items-center gap-1.5">
          <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i>
          <span>Connection Successful (${data.latencyMs || 0}ms latency)</span>
        </div>
        <div class="text-[10px] text-slate-300 font-mono bg-dark-900 p-2 rounded-lg border border-dark-800">
          Model: ${data.model} | Extracted: ${data.extracted?.routes?.[0]?.country || 'Verified'} ${data.extracted?.routes?.[0]?.route_type || ''} ($${data.extracted?.routes?.[0]?.rate_per_min || '0.0055'})
        </div>
      `;
    }
  } catch (err) {
    if (feedback) {
      feedback.className = 'p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 space-y-1';
      feedback.innerHTML = `
        <div class="font-bold flex items-center gap-1.5">
          <i data-lucide="alert-circle" class="w-4 h-4 text-rose-400"></i>
          <span>Connection Failed</span>
        </div>
        <div class="text-[10px] text-slate-300 font-mono">${err.message}</div>
      `;
    }
  } finally {
    if (btn) btn.disabled = false;
    if (window.lucide) lucide.createIcons();
  }
}

// Auto-load on startup
document.addEventListener('DOMContentLoaded', () => {
  loadAiSettings();
});

// Global exports
window.openAiSettingsModal = openAiSettingsModal;
window.closeAiSettingsModal = closeAiSettingsModal;
window.handleAiSettingsSave = handleAiSettingsSave;
window.handleAiTestConnection = handleAiTestConnection;
window.syncAiProviderFields = syncAiProviderFields;
window.togglePasswordVisibility = togglePasswordVisibility;
