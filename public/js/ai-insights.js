/**
 * AI Insights & Arbitrage Controller
 * - Highlights profitable spreads between Buy Requests (WTB) and Sell Offers (WTS)
 * - Summarizes market movements and generates trading briefings
 */

async function loadAiInsights() {
  const container = document.getElementById('ai-insights-container');
  if (!container) return;

  try {
    const res = await fetch('/api/insights');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const summary = data.summary || {};
    const arbitrage = data.arbitrageOpportunities || [];
    const recent = data.recentRoutes || [];

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
              <button 
                onclick="knockVendor('${cleanPhone}', '${escapeHtml(a.vendor_name || 'Buyer')}', '${escapeHtml(a.country)}', '${escapeHtml(a.route_type)}', '1/1')"
                class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shrink-0"
              >
                <i data-lucide="send" class="w-3.5 h-3.5"></i>
                <span>Supply Route</span>
              </button>
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

window.loadAiInsights = loadAiInsights;
