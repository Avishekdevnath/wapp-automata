/**
 * AI Insights & Arbitrage Controller
 * - Highlights profitable spreads between Buy Requests (WTB) and Sell Offers (WTS)
 * - Summarizes market movements and generates trading briefings
 * - 1-Click AI Trade Negotiation Pitch Generator (Counter-offers, Volume Locks, FAS SLAs)
 */

async function loadAiInsights() {
  const container = document.getElementById('view-insights');
  if (!container) return;

  try {
    const res = await fetch('/api/insights');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const summary = data.summary || {};
    const arbitrage = data.arbitrageOpportunities || [];

    // 1. Update KPI counters
    const kpiRoutes = document.getElementById('kpi-total-routes');
    const kpiDest = document.getElementById('kpi-total-dest');
    const kpiVendors = document.getElementById('kpi-total-vendors');
    const kpiNews = document.getElementById('kpi-urgent-news');

    if (kpiRoutes) kpiRoutes.innerText = summary.totalRoutes || 0;
    if (kpiDest) kpiDest.innerText = summary.totalCountries || 0;
    if (kpiVendors) kpiVendors.innerText = summary.totalVendors || 0;
    if (kpiNews) kpiNews.innerText = summary.urgentNews || 0;

    // 2. Render Arbitrage Matches Card
    const arbContainer = document.getElementById('arbitrage-matches-list');
    if (arbContainer) {
      if (arbitrage.length === 0) {
        arbContainer.innerHTML = `
          <div class="p-6 text-center text-slate-400">
            <i data-lucide="scale" class="w-8 h-8 mx-auto text-slate-600 mb-2"></i>
            <p class="text-xs font-medium">No active buyer-seller spreads detected yet</p>
            <p class="text-[11px] text-slate-500 mt-0.5">As buyers post WTB requests, matches will automatically appear here</p>
          </div>
        `;
      } else {
        arbContainer.innerHTML = arbitrage.map(a => {
          const cleanPhone = (a.vendor_phone || '').replace(/[^0-9]/g, '');
          const rateVal = a.rate_per_min !== null ? Number(a.rate_per_min) : '';
          return `
            <div class="p-4 rounded-xl bg-dark-900 border border-dark-700/80 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs shrink-0">
                  WTB
                </div>
                <div>
                  <h5 class="text-xs font-bold text-white">${escapeHtml(a.country)} • ${escapeHtml(a.route_type)}</h5>
                  <p class="text-[11px] text-slate-400">Buyer: <span class="text-slate-200 font-medium">${escapeHtml(a.vendor_name || 'Buyer')}</span> (${escapeHtml(a.company_name || a.vendor_phone)})</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button 
                  onclick="populatePitchForm('${escapeHtml(a.country)}', '${escapeHtml(a.route_type)}', '${rateVal}', '${escapeHtml(a.vendor_name || 'Buyer')}', '${escapeHtml(cleanPhone)}')"
                  class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  title="Auto-fill trade deal into pitch generator"
                >
                  <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
                  <span>Pitch Deal</span>
                </button>
                <button 
                  onclick="knockVendor('${cleanPhone}', '${escapeHtml(a.vendor_name || 'Buyer')}', '${escapeHtml(a.country)}', '${escapeHtml(a.route_type)}', '1/1')"
                  class="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center gap-1.5 transition-all shrink-0"
                >
                  <i data-lucide="send" class="w-3.5 h-3.5"></i>
                  <span>Knock</span>
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading AI insights:', err);
  }
}

/**
 * Pre-populates the Deal Pitch Generator with route data
 */
function populatePitchForm(country, routeType, rate, vendorName, vendorPhone) {
  const elDest = document.getElementById('pitch-dest');
  const elType = document.getElementById('pitch-type');
  const elCurrent = document.getElementById('pitch-current-rate');
  const elTarget = document.getElementById('pitch-target-rate');
  const elVendor = document.getElementById('pitch-vendor');
  const elPhone = document.getElementById('pitch-phone');

  if (elDest && country) elDest.value = country;
  if (elType && routeType) elType.value = routeType;
  if (elCurrent && rate) {
    elCurrent.value = rate;
    const numRate = parseFloat(rate);
    if (!isNaN(numRate) && numRate > 0 && elTarget) {
      elTarget.value = (numRate * 0.88).toFixed(4); // Suggest 12% aggressive counter
    }
  }
  if (elVendor && vendorName) elVendor.value = vendorName;
  if (elPhone && vendorPhone) elPhone.value = vendorPhone;

  // Scroll to Pitch Generator
  elDest?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (typeof showToast === 'function') showToast(`Deal loaded for ${country} ${routeType}!`, 'info');
}

/**
 * Calls AI Trade Negotiation Pitch API and renders 3 strategy cards
 */
async function generateNegotiationPitches() {
  const dest = document.getElementById('pitch-dest')?.value?.trim() || '';
  const routeType = document.getElementById('pitch-type')?.value || 'CLI';
  const currentRate = parseFloat(document.getElementById('pitch-current-rate')?.value || '');
  const targetRate = parseFloat(document.getElementById('pitch-target-rate')?.value || '');
  const vendorName = document.getElementById('pitch-vendor')?.value?.trim() || 'Partner';
  const vendorPhone = document.getElementById('pitch-phone')?.value?.trim() || '';
  const volume = document.getElementById('pitch-volume')?.value?.trim() || '500 ports (100k min/day)';
  const pulse = document.getElementById('pitch-pulse')?.value || '1/1';

  if (!dest) {
    if (typeof showToast === 'function') showToast('Please enter a destination country', 'error');
    return;
  }

  const btn = document.getElementById('btn-generate-pitch');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Generating Pitches...</span>`;
    if (window.lucide) window.lucide.createIcons();
  }

  try {
    const res = await fetch('/api/insights/pitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination: dest,
        routeType,
        currentRate: isNaN(currentRate) ? null : currentRate,
        targetRate: isNaN(targetRate) ? null : targetRate,
        vendorName,
        vendorPhone,
        volume,
        pulse
      })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const pitches = data.pitches || [];
    const phone = data.phone || vendorPhone.replace(/[^0-9]/g, '');

    renderPitchCards(pitches, phone);

    const resContainer = document.getElementById('pitch-results-container');
    if (resContainer) {
      resContainer.classList.remove('hidden');
      resContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  } catch (err) {
    console.error('Error generating pitch:', err);
    if (typeof showToast === 'function') showToast(`Pitch generator error: ${err.message}`, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

/**
 * Render generated pitch cards
 */
function renderPitchCards(pitches, cleanPhone) {
  const container = document.getElementById('pitch-cards-grid');
  if (!container) return;

  container.innerHTML = pitches.map((p, idx) => {
    let badgeColor = 'emerald';
    let icon = 'trending-down';
    if (p.title.includes('Quality') || p.title.includes('FAS')) {
      badgeColor = 'sky';
      icon = 'shield-check';
    } else if (p.title.includes('Interconnect') || p.title.includes('Knock')) {
      badgeColor = 'amber';
      icon = 'zap';
    }

    return `
      <div class="glass-card rounded-2xl p-4 border border-dark-700/80 flex flex-col justify-between space-y-3.5 shadow-md">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-${badgeColor}-500/10 text-${badgeColor}-400 border border-${badgeColor}-500/30">
              <i data-lucide="${icon}" class="w-3 h-3"></i>
              ${escapeHtml(p.title)}
            </span>
            <span class="text-[10px] text-slate-500 font-mono">Strategy #${idx + 1}</span>
          </div>
          <p class="text-[11px] text-slate-400 italic">${escapeHtml(p.strategy)}</p>

          <textarea 
            id="pitch-text-${idx}" 
            rows="5" 
            class="w-full bg-dark-950 border border-dark-800 rounded-xl p-3 text-xs text-slate-200 font-mono leading-relaxed resize-none focus:outline-none focus:border-emerald-500"
          >${escapeHtml(p.text)}</textarea>
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-dark-800">
          <button 
            onclick="copyPitchText(${idx})"
            class="flex-1 py-2 px-3 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
          >
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span>Copy</span>
          </button>
          <button 
            onclick="knockWhatsAppPitch(${idx}, '${cleanPhone}')"
            class="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
          >
            <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
            <span>WhatsApp</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function copyPitchText(idx) {
  const textarea = document.getElementById(`pitch-text-${idx}`);
  if (!textarea) return;
  navigator.clipboard.writeText(textarea.value).then(() => {
    if (typeof showToast === 'function') showToast('Trade pitch copied to clipboard!', 'success');
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Failed to copy pitch', 'error');
  });
}

function knockWhatsAppPitch(idx, cleanPhone) {
  const textarea = document.getElementById(`pitch-text-${idx}`);
  if (!textarea) return;
  const text = textarea.value;

  if (cleanPhone && cleanPhone.length >= 7) {
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  } else {
    // If no phone provided, copy to clipboard and open WhatsApp Web
    navigator.clipboard.writeText(text).then(() => {
      if (typeof showToast === 'function') showToast('No phone specified: Pitch copied to clipboard!', 'info');
      window.open('https://web.whatsapp.com', '_blank');
    });
  }
}

window.loadAiInsights = loadAiInsights;
window.populatePitchForm = populatePitchForm;
window.generateNegotiationPitches = generateNegotiationPitches;
window.copyPitchText = copyPitchText;
window.knockWhatsAppPitch = knockWhatsAppPitch;
