/**
 * Route Matrix Controller
 * - Fetches, filters, and displays live wholesale telecom rate sheets
 * - Dual view modes: Precision Table View and High-Impact Card Grid View
 * - Real-time filtering by Trading Intent (WTS/WTB), Country, Route Type, Pulse, Sort & Search
 * - 1-Click WhatsApp "Knock Vendor" Deal Outreach & Clipboard Trade Tickets
 * - In-app Route Posting & Benchmark Auto-Seeding
 */

let routePage = 1;
let routePageSize = parseInt(localStorage.getItem('wapp_route_page_size') || '25', 10);
let routeTotalCount = 0;

let currentRouteFilters = {
  q: '',
  country: '',
  type: '',
  pulse: '',
  intent: '',
  sort: 'price_asc',
  limit: routePageSize,
  offset: 0
};

let routeViewMode = localStorage.getItem('wapp_route_view_mode') || 'table';
let cachedRoutes = [];
let activeDetailRouteId = null;

const COUNTRY_FLAGS = {
  'USA': '🇺🇸',
  'Canada': '🇨🇦',
  'United Kingdom': '🇬🇧',
  'Australia': '🇦🇺',
  'Germany': '🇩🇪',
  'Hong Kong': '🇭🇰',
  'Bangladesh': '🇧🇩',
  'India': '🇮🇳',
  'Singapore': '🇸🇬',
  'Puerto Rico': '🇵🇷',
  'Japan': '🇯🇵',
  'Colombia': '🇨🇴',
  'Mexico': '🇲🇽',
  'Brazil': '🇧🇷',
  'Macau': '🇲🇴',
  'Taiwan': '🇹🇼',
  'Malaysia': '🇲🇾',
  'Indonesia': '🇮🇩',
  'China': '🇨🇳',
  'Philippines': '🇵🇭',
  'Pakistan': '🇵🇰',
  'New Zealand': '🇳🇿',
  'UAE': '🇦🇪',
  'Saudi Arabia': '🇸🇦'
};

// Global Data Accessors for Modular Subcomponents
window.COUNTRY_FLAGS = COUNTRY_FLAGS;
window.getCountryFlags = () => COUNTRY_FLAGS;
window.getCachedRoutes = () => cachedRoutes;

/**
 * Primary Route Matrix Loader
 */
async function loadRouteMatrix() {
  const tableContainer = document.getElementById('route-matrix-table-container');
  const cardsContainer = document.getElementById('route-matrix-cards-container');
  const tbody = document.getElementById('route-matrix-tbody');
  const cardsGrid = document.getElementById('route-matrix-cards-grid');
  const countBadge = document.getElementById('route-count-badge');
  const totalCountEl = document.getElementById('route-total-count');

  currentRouteFilters.limit = routePageSize;
  currentRouteFilters.offset = (routePage - 1) * routePageSize;

  const params = new URLSearchParams();
  if (currentRouteFilters.q) params.set('q', currentRouteFilters.q);
  if (currentRouteFilters.country) params.set('country', currentRouteFilters.country);
  if (currentRouteFilters.type) params.set('type', currentRouteFilters.type);
  if (currentRouteFilters.pulse) params.set('pulse', currentRouteFilters.pulse);
  if (currentRouteFilters.intent) params.set('intent', currentRouteFilters.intent);
  if (currentRouteFilters.sort) params.set('sort', currentRouteFilters.sort);
  params.set('limit', currentRouteFilters.limit);
  params.set('offset', currentRouteFilters.offset);

  try {
    const res = await fetch(`/api/routes?${params.toString()}`);
    if (res.status === 401) {
      if (typeof checkAuth === 'function') checkAuth();
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    let routes = data.routes || [];

    // --- De-clutter: Limit "Best Trusted Price" to Top 3 Pricing Tiers ---
    const uniquePrices = [...new Set(routes
      .filter(r => r.rate_per_min !== null)
      .map(r => Number(r.rate_per_min))
    )].sort((a, b) => a - b).slice(0, 3);

    routes = routes.map(r => {
      const price = Number(r.rate_per_min);
      const rankIndex = uniquePrices.indexOf(price);
      r.best_price_rank = rankIndex !== -1 ? rankIndex + 1 : 0;
      r.is_best_trusted_price = rankIndex !== -1;
      return r;
    });
    
    cachedRoutes = routes;
    window.cachedRoutes = routes;

    const stats = data.stats || {
      total: routes.length,
      floorRate: null,
      wtsCount: 0,
      wtbCount: 0,
      fasFreeCount: 0,
      destCount: 0
    };

    // 1. Update KPI Strip Metrics
    const kpiTotal = document.getElementById('kpi-total-routes');
    const kpiDest = document.getElementById('kpi-dest-count');
    const kpiFloor = document.getElementById('kpi-floor-rate');
    const kpiLiq = document.getElementById('kpi-liquidity');
    const kpiFas = document.getElementById('kpi-fas-quality');

    if (kpiTotal) kpiTotal.innerText = stats.total || routes.length;
    if (kpiDest) kpiDest.innerText = `Across ${stats.destCount || 16} destinations`;
    const kpiFloorSub = document.getElementById('kpi-floor-sub');
    if (kpiFloor) {
      const bestRate = stats.bestTrustedFloor || stats.floorRate;
      kpiFloor.innerText = bestRate ? `$${Number(bestRate).toFixed(4)}` : '$0.0045';
      if (kpiFloorSub && stats.bestTrustedCountry) {
        kpiFloorSub.innerText = `${stats.bestTrustedCountry} • Verified Safe`;
      }
    }
    if (kpiLiq) {
      kpiLiq.innerText = `${stats.wtsCount || 0} / ${stats.wtbCount || 0}`;
    }
    if (kpiFas) {
      const totalAll = stats.total || routes.length;
      const pct = totalAll > 0 ? Math.round(((stats.fasFreeCount || 0) / totalAll) * 100) : 100;
      kpiFas.innerText = `${pct}%`;
    }

    // 2. Update Intent Filter Badges
    const allCountBadge = document.getElementById('intent-all-count');
    const wtsCountBadge = document.getElementById('intent-wts-count');
    const wtbCountBadge = document.getElementById('intent-wtb-count');
    if (allCountBadge) allCountBadge.innerText = stats.total || routes.length;
    if (wtsCountBadge) wtsCountBadge.innerText = stats.wtsCount || 0;
    if (wtbCountBadge) wtbCountBadge.innerText = stats.wtbCount || 0;

    // 3. Update Sidebar & Table Header Badges
    // 4. Update Pagination Controls
    updateRoutePaginationUI(data.total !== undefined ? data.total : routes.length);

    // 5. Render active view mode only (prevents redundant DOM overhead)
    if (routeViewMode === 'cards') {
      renderRouteCards(routes);
    } else {
      renderRouteTable(routes);
    }

    // Apply active view mode container visibility
    applyRouteViewMode();
    applyRouteTableDensity();

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading route matrix:', err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-rose-400 text-xs font-mono">Failed to load route data: ${err.message}</td></tr>`;
    }
  }
}

/**
 * Render FAS & Fraud Security Status Badge
 */
function renderFraudBadge(r) {
  const level = r.fraud_risk_level || 'LOW';
  const score = r.fraud_risk_score || 0;
  const flags = Array.isArray(r.fraud_flags) ? r.fraud_flags : [];
  const flagsStr = escapeHtml(flags.join(' • '));

  if (level === 'CRITICAL') {
    return `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30" title="${flagsStr || 'Extreme FAS Risk'}"><i data-lucide="alert-triangle" class="w-3 h-3 text-rose-500"></i> High FAS Risk (${score})</span>`;
  }
  if (level === 'HIGH') {
    return `<span class="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30" title="${flagsStr || 'Below market floor'}"><i data-lucide="shield-alert" class="w-3 h-3 text-amber-500"></i> Rate Notice (${score})</span>`;
  }
  if (level === 'MEDIUM') {
    return `<span class="inline-flex items-center gap-1 text-[10px] font-medium text-sky-500/70" title="${flagsStr || 'Standard commercial corridor'}"><i data-lucide="shield" class="w-3.5 h-3.5"></i> Standard</span>`;
  }
  // Remove bulky redundant pill for SAFE routes to de-clutter UI
  return `<span class="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-500/70" title="${flagsStr || 'Verified route terms'}"><i data-lucide="shield-check" class="w-3.5 h-3.5"></i> Verified</span>`;
}

/**
 * Render Precision Table View
 */
function renderRouteTable(routes) {
  const container = document.getElementById('route-matrix-tbody');
  if (!container) return;

  if (!routes || routes.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center text-slate-400">
          <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-600 mb-2"></i>
          <p class="text-sm font-semibold text-white">No matching telecom routes found</p>
          <p class="text-xs text-slate-500 mt-1">Try resetting your filter, broadening search, or re-seeding benchmark routes.</p>
          <button onclick="triggerSeedBenchmark()" class="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs inline-flex items-center gap-1.5 shadow-md">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span>Load Authentic Benchmark Routes</span>
          </button>
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = routes.map(r => {
    const flag = COUNTRY_FLAGS[r.country] || '🌐';
    const isWts = (r.intent || 'WTS') === 'WTS';
    const intentBadge = isWts 
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🟢 SELL</span>'
      : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">🟡 BUY</span>';

    let typeBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
    if (r.route_type.includes('CLI')) typeBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (r.route_type.includes('CC')) typeBadgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (r.route_type.includes('IVR')) typeBadgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/30';

    const pulseBadgeClass = r.billing_pulse === '1/1' 
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
      : 'bg-slate-800 text-slate-400 border-slate-700';

    let diffColorClass = 'text-slate-400';
    if (r.diff_vs_avg_text) {
      if (r.diff_vs_avg_text.includes('-')) diffColorClass = 'text-emerald-400 font-bold';
      else if (r.diff_vs_avg_text.includes('+')) diffColorClass = 'text-rose-400 font-bold';
    }
    const histDiff = r.diff_vs_avg_text 
      ? `<span class="text-[10px] ${diffColorClass} font-mono block mt-0.5" title="Historical 30-day corridor comparison">${escapeHtml(r.diff_vs_avg_text)}</span>` 
      : '';

    let rateClass = 'text-emerald-400';
    let rateCellBg = '';
    
    if (r.best_price_rank === 1) {
      rateClass = 'text-amber-400 drop-shadow-md';
      rateCellBg = 'bg-amber-500/20 shadow-inner border-x border-amber-500/40';
    } else if (r.best_price_rank === 2) {
      rateClass = 'text-slate-300 drop-shadow-sm'; // Silver
      rateCellBg = 'bg-slate-500/10 shadow-inner border-x border-slate-500/30';
    } else if (r.best_price_rank === 3) {
      rateClass = 'text-orange-400 drop-shadow-sm'; // Bronze
      rateCellBg = 'bg-orange-500/10 shadow-inner border-x border-orange-500/30';
    }

    const rateDisplay = r.rate_per_min !== null 
      ? `<div>
          <span class="font-mono text-sm font-bold ${rateClass}">$${Number(r.rate_per_min).toFixed(4)}</span>
          ${histDiff}
        </div>` 
      : '<span class="text-slate-500 italic text-[11px]">Ping for Rate</span>';

    const cleanPhone = (r.vendor_phone || '').replace(/[^0-9]/g, '');

    const newsBadge = r.active_news ? `
      <span class="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${r.active_news.urgency === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'} cursor-pointer shrink-0" title="WhatsApp Alert: ${escapeHtml(r.active_news.headline)}">
        <i data-lucide="${r.active_news.category === 'OUTAGE' ? 'alert-octagon' : (r.active_news.category === 'REGULATION' ? 'scale' : 'wrench')}" class="w-2.5 h-2.5"></i>
        <span>${escapeHtml(r.active_news.category)}</span>
      </span>
    ` : '';

    return `
      <tr class="border-b border-dark-800/60 hover:bg-dark-800/40 transition-colors">
        <!-- Destination -->
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <span class="text-xl select-none leading-none">${flag}</span>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-bold text-white text-xs block leading-tight">${escapeHtml(r.country)}</span>
                ${newsBadge}
              </div>
              <span class="text-[10px] text-slate-400 block">${escapeHtml(r.ani_pass || 'Clean ANI')}</span>
            </div>
          </div>
        </td>

        <!-- Intent -->
        <td class="py-3 px-3">
          ${intentBadge}
        </td>

        <!-- Route Type -->
        <td class="py-3 px-3">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${typeBadgeClass}">
            ${escapeHtml(r.route_type)}
          </span>
        </td>

        <!-- Billing Pulse -->
        <td class="py-3 px-3">
          <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${pulseBadgeClass}">
            ${escapeHtml(r.billing_pulse || '1/1')}
          </span>
        </td>

        <!-- Price / Rate -->
        <td class="py-3 px-4 ${rateCellBg}">
          ${rateDisplay}
        </td>

        <!-- Quality & FAS -->
        <td class="py-3 px-4">
          <div class="space-y-1">
            ${renderFraudBadge(r)}
            ${r.quality_notes ? `<span class="block text-[10px] text-slate-400 truncate max-w-[150px]" title="${escapeHtml(r.quality_notes)}">${escapeHtml(r.quality_notes)}</span>` : ''}
          </div>
        </td>

        <!-- Carrier / Vendor -->
        <td class="py-3 px-4">
          <div>
            <span class="text-xs font-semibold text-slate-200 block truncate max-w-[140px]">${escapeHtml(r.vendor_name || 'Carrier')}</span>
            <span class="text-[10px] text-slate-400 font-mono block">${escapeHtml(r.company_name || r.vendor_phone)}</span>
          </div>
        </td>

        <!-- Quick Actions -->
        <td class="py-3 px-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button 
              onclick="openRouteDetailModal('${escapeHtml(r.id)}')"
              class="p-1.5 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-700 text-slate-300 hover:text-white transition-all"
              title="Inspect Route Specs"
            >
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
            <button 
              onclick="knockVendor('${cleanPhone}', '${escapeHtml(r.vendor_name || 'Partner')}', '${escapeHtml(r.country)}', '${escapeHtml(r.route_type)}', '${escapeHtml(r.billing_pulse)}') "
              class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm shadow-emerald-600/20 transition-all shrink-0"
              title="Open WhatsApp deal knock"
            >
              <i data-lucide="zap" class="w-3 h-3 fill-current"></i>
              <span>Knock</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Render High-Impact Trading Card Grid View
 */
function renderRouteCards(routes) {
  const container = document.getElementById('route-matrix-cards-grid');
  if (!container) return;

  if (!routes || routes.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-600 mb-2"></i>
        <p class="text-sm font-semibold text-white">No matching telecom routes</p>
        <p class="text-xs text-slate-500 mt-1">Broaden your filters or click Refresh Data above.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = routes.map(r => {
    const flag = COUNTRY_FLAGS[r.country] || '🌐';
    const isWts = (r.intent || 'WTS') === 'WTS';
    const cleanPhone = (r.vendor_phone || '').replace(/[^0-9]/g, '');
    const timeAgo = formatTimeAgo(r.created_at);

    const intentPill = isWts
      ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">🟢 WTS (Selling)</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">🟡 WTB (Buying)</span>';

    let diffColorClass = 'text-slate-400';
    if (r.diff_vs_avg_text) {
      if (r.diff_vs_avg_text.includes('-')) diffColorClass = 'text-emerald-400 font-bold';
      else if (r.diff_vs_avg_text.includes('+')) diffColorClass = 'text-rose-400 font-bold';
    }
    const histDiff = r.diff_vs_avg_text 
      ? `<span class="text-[10px] ${diffColorClass} font-mono block mt-0.5" title="Historical 30-day corridor comparison">${escapeHtml(r.diff_vs_avg_text)}</span>` 
      : '';

    let priceCardClass = 'bg-dark-900 border border-dark-800';
    let rateClass = 'text-emerald-400';
    
    if (r.best_price_rank === 1) {
        priceCardClass = 'bg-amber-500/20 border border-amber-500/40 shadow-inner';
        rateClass = 'text-amber-400 drop-shadow-md';
    } else if (r.best_price_rank === 2) {
        priceCardClass = 'bg-slate-500/10 border border-slate-500/30 shadow-inner';
        rateClass = 'text-slate-300 drop-shadow-sm';
    } else if (r.best_price_rank === 3) {
        priceCardClass = 'bg-orange-500/10 border border-orange-500/30 shadow-inner';
        rateClass = 'text-orange-400 drop-shadow-sm';
    }

    const rateDisplay = r.rate_per_min !== null 
      ? `$${Number(r.rate_per_min).toFixed(4)}` 
      : 'Ping for Rate';

    const cardNewsBadge = r.active_news ? `
      <span class="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${r.active_news.urgency === 'HIGH' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}" title="WhatsApp Incident: ${escapeHtml(r.active_news.headline)}">
        <i data-lucide="${r.active_news.category === 'OUTAGE' ? 'alert-octagon' : (r.active_news.category === 'REGULATION' ? 'scale' : 'wrench')}" class="w-2.5 h-2.5"></i>
        <span>${escapeHtml(r.active_news.category)}</span>
      </span>
    ` : '';

    return `
      <div class="glass-card rounded-2xl p-4 border border-dark-700/80 hover:border-emerald-500/50 shadow-md space-y-3.5 transition-all">
        <!-- Card Header -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl select-none">${flag}</span>
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="font-bold text-sm text-white leading-tight">${escapeHtml(r.country)}</h4>
                ${cardNewsBadge}
              </div>
              <span class="text-[10px] text-slate-400">${escapeHtml(r.ani_pass || 'Standard ANI')}</span>
            </div>
          </div>
          ${intentPill}
        </div>

        <!-- Price & Pulse Highlight -->
        <div class="p-3 rounded-xl flex items-center justify-between transition-colors ${priceCardClass}">
          <div>
            <span class="text-[10px] uppercase font-semibold text-slate-400 block">Wholesale Rate</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="font-mono text-xl font-black ${rateClass}">${rateDisplay}</span>
              <span class="text-[10px] text-slate-500">/min</span>
            </div>
            ${histDiff}
          </div>
          <div class="text-right space-y-1">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-dark-800 text-slate-300 border border-dark-700">
              ${escapeHtml(r.route_type)}
            </span>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 block text-center">
              Pulse: ${escapeHtml(r.billing_pulse || '1/1')}
            </span>
          </div>
        </div>

        <!-- Quality & FAS Indicator -->
        <div class="text-xs space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[11px] text-slate-400 font-medium">Security & FAS:</span>
            ${renderFraudBadge(r)}
          </div>
          ${r.quality_notes ? `<p class="text-[11px] text-slate-400 bg-dark-950 p-2 rounded-lg border border-dark-800/80 line-clamp-2">${escapeHtml(r.quality_notes)}</p>` : ''}
        </div>

        <!-- Carrier & Action Footer -->
        <div class="pt-3 border-t border-dark-800/80 flex items-center justify-between gap-2">
          <div class="min-w-0">
            <span class="font-semibold text-xs text-white block truncate">${escapeHtml(r.vendor_name || 'Carrier')}</span>
            <span class="text-[10px] text-slate-500 block truncate">${escapeHtml(r.company_name || r.vendor_phone)} • ${timeAgo}</span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <button 
              onclick="copyTradeTicket('${escapeHtml(r.id)}')"
              class="p-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-300 hover:text-white border border-dark-700 transition-all"
              title="Copy Trade Ticket"
            >
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
            <button 
              onclick="openRouteDetailModal('${escapeHtml(r.id)}')"
              class="p-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-300 hover:text-white border border-dark-700 transition-all"
              title="Inspect Details"
            >
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
            <button 
              onclick="knockVendor('${cleanPhone}', '${escapeHtml(r.vendor_name || 'Partner')}', '${escapeHtml(r.country)}', '${escapeHtml(r.route_type)}', '${escapeHtml(r.billing_pulse)}')"
              class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20 transition-all"
              title="Knock on WhatsApp"
            >
              <i data-lucide="zap" class="w-3.5 h-3.5 fill-current"></i>
              <span>Knock</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Switch View Mode: 'table' or 'cards'
 */
function setRouteViewMode(mode) {
  routeViewMode = mode;
  localStorage.setItem('wapp_route_view_mode', mode);
  if (routeViewMode === 'cards') {
    renderRouteCards(cachedRoutes);
  } else {
    renderRouteTable(cachedRoutes);
  }
  applyRouteViewMode();
  if (window.lucide) window.lucide.createIcons();
}

function applyRouteViewMode() {
  const tableContainer = document.getElementById('route-matrix-table-container');
  const cardsContainer = document.getElementById('route-matrix-cards-container');
  const btnTable = document.getElementById('btn-view-mode-table');
  const btnCards = document.getElementById('btn-view-mode-cards');

  const densityControls = document.getElementById('route-density-controls');
  if (routeViewMode === 'cards') {
    if (tableContainer) tableContainer.classList.add('hidden');
    if (cardsContainer) cardsContainer.classList.remove('hidden');
    if (densityControls) densityControls.classList.add('hidden');
    if (btnTable) {
      btnTable.className = 'p-2 rounded-lg text-slate-400 hover:text-white transition-all';
    }
    if (btnCards) {
      btnCards.className = 'p-2 rounded-lg text-white bg-emerald-600 transition-all';
    }
  } else {
    if (tableContainer) tableContainer.classList.remove('hidden');
    if (cardsContainer) cardsContainer.classList.add('hidden');
    if (densityControls) densityControls.classList.remove('hidden');
    if (btnTable) {
      btnTable.className = 'p-2 rounded-lg text-white bg-emerald-600 transition-all';
    }
    if (btnCards) {
      btnCards.className = 'p-2 rounded-lg text-slate-400 hover:text-white transition-all';
    }
  }
}

/**
 * Switch Table Density: 'compact' or 'comfortable'
 */
let routeTableDensity = localStorage.getItem('wapp_route_density') || 'compact';

function setRouteTableDensity(density) {
  routeTableDensity = density;
  localStorage.setItem('wapp_route_density', density);
  applyRouteTableDensity();
}

function applyRouteTableDensity() {
  const table = document.getElementById('route-matrix-table');
  const btnCompact = document.getElementById('btn-route-density-compact');
  const btnComfortable = document.getElementById('btn-route-density-comfortable');

  if (table) {
    if (routeTableDensity === 'compact') {
      table.classList.add('table-density-compact');
      table.classList.remove('table-density-comfortable');
    } else {
      table.classList.remove('table-density-compact');
      table.classList.add('table-density-comfortable');
    }
  }

  if (btnCompact && btnComfortable) {
    if (routeTableDensity === 'compact') {
      btnCompact.className = 'p-2 rounded-lg text-white bg-emerald-600 transition-all';
      btnComfortable.className = 'p-2 rounded-lg text-slate-400 hover:text-white transition-all';
    } else {
      btnComfortable.className = 'p-2 rounded-lg text-white bg-emerald-600 transition-all';
      btnCompact.className = 'p-2 rounded-lg text-slate-400 hover:text-white transition-all';
    }
  }
}

/**
 * Trading Intent Filter Handler (All, WTS, WTB)
 */
function handleIntentTab(intent) {
  currentRouteFilters.intent = intent;
  routePage = 1;
  currentRouteFilters.offset = 0;

  // Update tabs active state
  const tabAll = document.getElementById('tab-intent-all');
  const tabWts = document.getElementById('tab-intent-wts');
  const tabWtb = document.getElementById('tab-intent-wtb');

  const inactiveClass = 'route-intent-tab px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-all flex items-center gap-1.5';
  const activeClass = 'route-intent-tab px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow-sm transition-all flex items-center gap-1.5';

  if (tabAll) tabAll.className = (intent === '') ? activeClass : inactiveClass;
  if (tabWts) tabWts.className = (intent === 'WTS') ? activeClass : inactiveClass;
  if (tabWtb) tabWtb.className = (intent === 'WTB') ? activeClass : inactiveClass;

  loadRouteMatrix();
}

/**
 * Sort Filter Handler
 */
function handleSortChange(sortVal) {
  currentRouteFilters.sort = sortVal;
  routePage = 1;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

/**
 * Route Matrix Actions & Modals have been modularized into:
 * - /js/route-modals.js  (Route Detail Modal, Trade Ticket, Post Route Modal)
 * - /js/route-actions.js (Knock Vendor, CSV Export, Benchmark Seeding)
 */

/**
 * Route Matrix Filter Event Handlers
 */
function handleRouteSearch(e) {
  currentRouteFilters.q = (e.target.value || '').trim();
  routePage = 1;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

function handleCountryFilter(country) {
  currentRouteFilters.country = country;
  routePage = 1;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

function handleTypeFilter(type) {
  currentRouteFilters.type = type;
  routePage = 1;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

function handlePulseFilter(pulse) {
  currentRouteFilters.pulse = pulse;
  routePage = 1;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

/**
 * Route Matrix Pagination Handlers
 */
function setRoutePageSize(size) {
  routePageSize = parseInt(size, 10);
  routePage = 1;
  localStorage.setItem('wapp_route_page_size', routePageSize);
  document.querySelectorAll('.btn-route-size').forEach(btn => {
    if (parseInt(btn.getAttribute('data-size'), 10) === routePageSize) {
      btn.className = 'btn-route-size px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold transition-all font-mono';
    } else {
      btn.className = 'btn-route-size px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all font-mono';
    }
  });
  loadRouteMatrix();
}

function changeRoutePage(delta) {
  const maxPages = Math.max(1, Math.ceil(routeTotalCount / routePageSize));
  const newPage = routePage + delta;
  if (newPage >= 1 && newPage <= maxPages) {
    routePage = newPage;
    loadRouteMatrix();
  }
}

function updateRoutePaginationUI(total) {
  routeTotalCount = total;
  const maxPages = Math.max(1, Math.ceil(total / routePageSize));
  if (routePage > maxPages) routePage = maxPages;

  const start = total === 0 ? 0 : (routePage - 1) * routePageSize + 1;
  const end = Math.min(routePage * routePageSize, total);

  const startEl = document.getElementById('route-page-start');
  const endEl = document.getElementById('route-page-end');
  const totalEl = document.getElementById('route-page-total');
  const currEl = document.getElementById('route-current-page');
  const totalPagesEl = document.getElementById('route-total-pages');
  const prevBtn = document.getElementById('btn-route-prev');
  const nextBtn = document.getElementById('btn-route-next');
  const countBadge = document.getElementById('route-count-badge');
  const totalCountEl = document.getElementById('route-total-count');

  if (startEl) startEl.innerText = start;
  if (endEl) endEl.innerText = end;
  if (totalEl) totalEl.innerText = total;
  if (currEl) currEl.innerText = routePage;
  if (totalPagesEl) totalPagesEl.innerText = maxPages;
  if (countBadge) countBadge.innerText = total;
  if (totalCountEl) totalCountEl.innerText = `${total} Active Routes`;

  if (prevBtn) prevBtn.disabled = (routePage <= 1);
  if (nextBtn) nextBtn.disabled = (routePage >= maxPages);

  // Sync button active style
  document.querySelectorAll('.btn-route-size').forEach(btn => {
    const s = parseInt(btn.getAttribute('data-size'), 10);
    if (s === routePageSize) {
      btn.className = 'btn-route-size px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold transition-all font-mono';
    } else {
      btn.className = 'btn-route-size px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all font-mono';
    }
  });
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Recent';
  const now = Date.now();
  const diffSec = Math.floor((now - Number(timestamp)) / 1000);
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function refreshRouteMatrix() {
  const btn = document.getElementById('btn-refresh-routes');
  const icon = btn?.querySelector('i');
  if (icon) icon.classList.add('animate-spin');
  try {
    await loadRouteMatrix();
    if (typeof showToast === 'function') {
      showToast('Route matrix refreshed successfully', 'success');
    }
  } catch (err) {
    console.error('Failed to refresh route matrix:', err);
  } finally {
    if (icon) {
      setTimeout(() => icon.classList.remove('animate-spin'), 400);
    }
  }
}

// Global Exports from Route Matrix Core
window.loadRouteMatrix = loadRouteMatrix;
window.refreshRouteMatrix = refreshRouteMatrix;
window.setRouteViewMode = setRouteViewMode;
window.handleIntentTab = handleIntentTab;
window.handleSortChange = handleSortChange;
window.handleRouteSearch = handleRouteSearch;
window.handleCountryFilter = handleCountryFilter;
window.handleTypeFilter = handleTypeFilter;
window.handlePulseFilter = handlePulseFilter;
window.setRoutePageSize = setRoutePageSize;
window.changeRoutePage = changeRoutePage;
window.setRouteTableDensity = setRouteTableDensity;
window.renderFraudBadge = renderFraudBadge;

