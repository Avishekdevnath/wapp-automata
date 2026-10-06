/**
 * Telecom Industry News & Outage Alerts Controller
 * - Displays carrier maintenance, regulatory blocks (FCC/NCC), and FAS fraud warnings
 * - AI Executive Outage & Risk Briefing synthesized with DeepSeek AI
 * - Full Search, Category/Urgency Filtering & Sliced Pagination
 */
let cachedNews = [];
let newsCurrentPage = 1;
let newsPageSize = parseInt(localStorage.getItem('wapp_news_page_size') || '6', 10);
let newsSearchQuery = '';
let newsCategoryFilter = 'all';
let newsUrgencyFilter = 'all';

async function loadTelcoNews() {
  const container = document.getElementById('telco-news-container');
  const countBadge = document.getElementById('news-count-badge');
  if (!container) return;

  // Load Executive Brief and Arbitrage Signals in parallel
  loadExecutiveBrief(false);
  loadArbitrageSignals();

  try {
    const res = await fetch('/api/news');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedNews = data.news || [];

    if (countBadge) countBadge.innerText = cachedNews.length;

    renderNewsList();
  } catch (err) {
    console.error('Error loading telco news:', err);
    if (container) {
      container.innerHTML = `
        <div class="col-span-full glass-card rounded-2xl p-8 text-center border border-dark-700/80 text-rose-400">
          <i data-lucide="alert-circle" class="w-8 h-8 mx-auto text-rose-500 mb-2"></i>
          <h4 class="text-xs font-semibold">Failed to load carrier news</h4>
          <p class="text-[11px] text-slate-500 mt-1">${escapeHtml(err.message)}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function handleNewsSearch(event) {
  newsSearchQuery = (event.target.value || '').toLowerCase().trim();
  newsCurrentPage = 1;
  renderNewsList();
}

function handleNewsFilter() {
  const catEl = document.getElementById('news-filter-category');
  const urgEl = document.getElementById('news-filter-urgency');
  if (catEl) newsCategoryFilter = catEl.value;
  if (urgEl) newsUrgencyFilter = urgEl.value;

  newsCurrentPage = 1;
  renderNewsList();
}

function setNewsPageSize(size) {
  newsPageSize = parseInt(size, 10);
  localStorage.setItem('wapp_news_page_size', String(newsPageSize));
  newsCurrentPage = 1;
  renderNewsList();
}

function changeNewsPage(delta) {
  newsCurrentPage += delta;
  renderNewsList();
}

function getFilteredNews() {
  let list = cachedNews.slice();

  // 1. Search Query
  if (newsSearchQuery) {
    list = list.filter(item => {
      const haystack = [item.headline, item.raw_text, item.category, item.affected_countries]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(newsSearchQuery);
    });
  }

  // 2. Category Filter
  if (newsCategoryFilter !== 'all') {
    list = list.filter(item => (item.category || '').toUpperCase() === newsCategoryFilter.toUpperCase());
  }

  // 3. Urgency Filter
  if (newsUrgencyFilter !== 'all') {
    if (newsUrgencyFilter === 'HIGH') {
      list = list.filter(item => (item.urgency || '').toUpperCase() === 'HIGH');
    } else {
      list = list.filter(item => (item.urgency || '').toUpperCase() !== 'HIGH');
    }
  }

  return list;
}

function renderNewsList() {
  const container = document.getElementById('telco-news-container');
  const activeBadge = document.getElementById('news-active-count-badge');
  if (!container) return;

  const filtered = getFilteredNews();
  const total = filtered.length;

  if (activeBadge) activeBadge.innerText = `${total} Alert${total === 1 ? '' : 's'}`;

  updateNewsPaginationUI(total);

  if (total === 0) {
    container.innerHTML = `
      <div class="col-span-full glass-card rounded-2xl p-10 text-center border border-dashed border-dark-700">
        <i data-lucide="shield-check" class="w-10 h-10 mx-auto text-emerald-400 mb-2"></i>
        <h4 class="text-sm font-semibold text-white">No Disruptions Matched Filter</h4>
        <p class="text-xs text-slate-400 mt-1">Try resetting search keywords or selecting All Categories.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Sliced page items
  let pageItems = filtered;
  if (newsPageSize > 0) {
    const startIdx = (newsCurrentPage - 1) * newsPageSize;
    pageItems = filtered.slice(startIdx, startIdx + newsPageSize);
  }

  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '');

  container.innerHTML = pageItems.map(item => {
    let icon = 'alert-triangle';
    let badgeClass = 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold';
    let cardModifier = 'news-card-standard';

    if (item.urgency === 'HIGH') {
      icon = 'alert-octagon';
      badgeClass = 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30 animate-pulse font-bold';
      cardModifier = 'news-card-high';
    } else if (item.category === 'MAINTENANCE') {
      icon = 'wrench';
      badgeClass = 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30 font-bold';
      cardModifier = 'news-card-maintenance';
    } else if (item.category === 'REGULATION') {
      icon = 'scale';
      badgeClass = 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30 font-bold';
      cardModifier = 'news-card-regulation';
    }

    const dateStr = typeof formatDateTime === 'function' 
      ? formatDateTime(item.created_at) 
      : (item.created_at ? new Date(item.created_at).toLocaleDateString() : '—');

    return `
      <div class="glass-card rounded-2xl p-5 ${cardModifier} space-y-3 hover:border-slate-500 transition-all shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badgeClass}">
            <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
            <span>${esc(item.category)} • ${esc(item.urgency)}</span>
          </span>
          <span class="text-[10px] text-slate-500 font-mono">${dateStr}</span>
        </div>

        <div>
          <h4 class="text-xs font-bold text-slate-900 dark:text-white leading-snug">${esc(item.headline)}</h4>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-3 leading-relaxed">${esc(item.raw_text || '')}</p>
        </div>

        <div class="pt-2 border-t border-slate-200 dark:border-dark-800 flex items-center justify-between text-[11px]">
          <span class="text-slate-500 dark:text-slate-400 font-medium">Impact: <span class="text-slate-900 dark:text-slate-200 font-semibold">${esc(item.affected_countries || 'Global')}</span></span>
          <span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">Live Ingested</span>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function updateNewsPaginationUI(total) {
  const startEl = document.getElementById('news-page-start');
  const endEl = document.getElementById('news-page-end');
  const totalEl = document.getElementById('news-page-total');
  const currEl = document.getElementById('news-current-page');
  const totalPagesEl = document.getElementById('news-total-pages');
  const prevBtn = document.getElementById('btn-news-prev');
  const nextBtn = document.getElementById('btn-news-next');

  if (newsPageSize <= 0) {
    if (startEl) startEl.innerText = total > 0 ? 1 : 0;
    if (endEl) endEl.innerText = total;
    if (totalEl) totalEl.innerText = total;
    if (currEl) currEl.innerText = 1;
    if (totalPagesEl) totalPagesEl.innerText = 1;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const maxPages = Math.max(1, Math.ceil(total / newsPageSize));
  if (newsCurrentPage > maxPages) newsCurrentPage = maxPages;

  const start = total === 0 ? 0 : (newsCurrentPage - 1) * newsPageSize + 1;
  const end = Math.min(newsCurrentPage * newsPageSize, total);

  if (startEl) startEl.innerText = start;
  if (endEl) endEl.innerText = end;
  if (totalEl) totalEl.innerText = total;
  if (currEl) currEl.innerText = newsCurrentPage;
  if (totalPagesEl) totalPagesEl.innerText = maxPages;

  if (prevBtn) prevBtn.disabled = (newsCurrentPage <= 1);
  if (nextBtn) nextBtn.disabled = (newsCurrentPage >= maxPages);

  // Update button active styling
  document.querySelectorAll('.btn-news-size').forEach(btn => {
    const s = parseInt(btn.getAttribute('data-size'), 10);
    if (s === newsPageSize) {
      btn.className = 'btn-news-size px-2.5 py-1 rounded-lg bg-rose-600 text-white font-semibold transition-all font-mono';
    } else {
      btn.className = 'btn-news-size px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all font-mono';
    }
  });
}

/**
 * Loads AI Executive Outage & Risk Briefing
 */
async function loadExecutiveBrief(forceRefresh = false) {
  const elBadge = document.getElementById('brief-status-badge');
  const elIconBox = document.getElementById('brief-status-icon-box');
  const elHeadline = document.getElementById('brief-headline');
  const elTime = document.getElementById('brief-generated-time');
  const elCount = document.getElementById('brief-alerts-count');
  const elCorridors = document.getElementById('brief-corridors-list');
  const elRouting = document.getElementById('brief-routing-list');
  const elReg = document.getElementById('brief-regulatory-text');

  if (!elHeadline) return;

  try {
    const url = `/api/news/executive-brief${forceRefresh ? '?refresh=true' : ''}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const brief = data.brief || {};

    const color = brief.badge_color || 'amber';
    const status = brief.status_level ? brief.status_level.replace(/_/g, ' ') : 'MODERATE RISK';

    if (elBadge) {
      elBadge.className = `px-2 py-0.5 rounded text-[10px] font-bold bg-${color}-500/10 text-${color}-400 border border-${color}-500/30`;
      elBadge.innerText = status;
    }
    if (elIconBox) {
      elIconBox.className = `w-10 h-10 rounded-2xl bg-${color}-500/10 border border-${color}-500/30 flex items-center justify-center text-${color}-400 shrink-0`;
      elIconBox.innerHTML = color === 'rose' 
        ? `<i data-lucide="alert-octagon" class="w-5 h-5"></i>` 
        : (color === 'emerald' ? `<i data-lucide="shield-check" class="w-5 h-5"></i>` : `<i data-lucide="shield-alert" class="w-5 h-5"></i>`);
    }

    if (elHeadline) elHeadline.innerText = brief.headline || 'Network Posture Normal';
    if (elCount) elCount.innerText = brief.active_alerts_count || 0;
    if (elTime) elTime.innerText = `Updated ${formatTimeAgo(brief.generated_at || Date.now())}`;

    // Render Corridors at Risk
    if (elCorridors) {
      const corridors = brief.corridors_at_risk || [];
      if (corridors.length === 0) {
        elCorridors.innerHTML = `<span class="text-slate-500 italic text-[11px]">No degraded corridors</span>`;
      } else {
        elCorridors.innerHTML = corridors.map(c => 
          `<span class="px-2 py-0.5 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 rounded-md text-[10px] text-amber-700 dark:text-amber-300 font-semibold">${escapeHtml(c)}</span>`
        ).join('');
      }
    }

    // Render Routing Recommendations
    if (elRouting) {
      const recs = brief.routing_recommendations || [];
      if (recs.length === 0) {
        elRouting.innerHTML = `<li class="text-slate-500 italic text-[11px]">Traffic routing standard</li>`;
      } else {
        elRouting.innerHTML = recs.map(r => 
          `<li class="flex items-start gap-1.5"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5"></i><span>${escapeHtml(r)}</span></li>`
        ).join('');
      }
    }

    // Render Regulatory Text
    if (elReg) {
      elReg.innerText = brief.regulatory_brief || 'Standard carrier compliance across active interconnects.';
    }

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading executive brief:', err);
  }
}

async function refreshExecutiveBrief() {
  const btn = document.getElementById('btn-refresh-brief');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-50');
  }
  await loadExecutiveBrief(true);
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('opacity-50');
  }
  if (typeof showToast === 'function') showToast('Executive Briefing regenerated!', 'success');
}

function formatTimeAgo(time) {
  if (!time) return 'Just now';
  const diff = Date.now() - new Date(time).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

/**
 * Live Arbitrage & Spread Matching Signals (ADR-016)
 */
async function loadArbitrageSignals() {
  const container = document.getElementById('arbitrage-signals-container');
  if (!container) return;

  try {
    const res = await fetch('/api/arbitrage');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const opportunities = data.opportunities || [];

    if (opportunities.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-6 text-center text-slate-400 border border-dashed border-dark-800 rounded-xl">
          <i data-lucide="scale" class="w-6 h-6 mx-auto text-slate-500 mb-1.5 opacity-60"></i>
          <p class="text-xs font-semibold text-slate-300">No active arbitrage spreads detected yet</p>
          <p class="text-[11px] text-slate-500 mt-0.5">As new WTS (offers) and WTB (needs) stream in, matched corridor spreads will appear here instantly.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons({ root: container });
      return;
    }

    container.innerHTML = opportunities.map(opp => {
      const isProfitable = opp.isProfitable;
      const profitBadge = isProfitable
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">+${opp.marginPercent}% Spread</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">Neutral</span>`;

      const buyerWa = opp.buyer_phone ? `https://wa.me/${opp.buyer_phone.replace(/[^0-9]/g, '')}` : null;
      const sellerWa = opp.seller_phone ? `https://wa.me/${opp.seller_phone.replace(/[^0-9]/g, '')}` : null;

      return `
        <div class="p-4 rounded-xl bg-dark-950/60 border ${isProfitable ? 'border-emerald-500/30 hover:border-emerald-500/50' : 'border-dark-800'} transition-all space-y-3 flex flex-col justify-between shadow-sm">
          <div class="space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h5 class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span class="inline-block w-2 h-2 rounded-full ${isProfitable ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}"></span>
                  <span>${escapeHtml(opp.country)}</span>
                </h5>
                <span class="text-[10px] text-slate-400 font-mono uppercase tracking-wider">${escapeHtml(opp.route_type)} • Pulse: ${escapeHtml(opp.sell_pulse || '1/1')}</span>
              </div>
              ${profitBadge}
            </div>

            <!-- Price Comparison Grid -->
            <div class="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-dark-900 border border-dark-800 text-[11px]">
              <div>
                <span class="text-[10px] text-slate-500 block uppercase font-bold">Sell Offer (WTS)</span>
                <span class="font-mono font-bold text-slate-200 text-xs">$${opp.sell_rate.toFixed(4)}<span class="text-[9px] text-slate-400 font-normal">/m</span></span>
                <span class="text-[10px] text-slate-400 truncate block mt-0.5" title="${escapeHtml(opp.seller_name)}">${escapeHtml(opp.seller_company || opp.seller_name)}</span>
              </div>
              <div class="border-l border-dark-800 pl-2">
                <span class="text-[10px] text-slate-500 block uppercase font-bold">Buy Bid (WTB)</span>
                <span class="font-mono font-bold text-emerald-400 text-xs">$${opp.buy_rate.toFixed(4)}<span class="text-[9px] text-slate-400 font-normal">/m</span></span>
                <span class="text-[10px] text-slate-400 truncate block mt-0.5" title="${escapeHtml(opp.buyer_name)}">${escapeHtml(opp.buyer_company || opp.buyer_name)}</span>
              </div>
            </div>

            <!-- Spread Margin Highlight -->
            <div class="flex items-center justify-between text-xs px-1">
              <span class="text-slate-400 text-[11px]">Gross Arbitrage Spread:</span>
              <span class="font-mono font-bold ${isProfitable ? 'text-emerald-400' : 'text-slate-400'}">
                ${opp.spread >= 0 ? '+' : ''}$${opp.spread.toFixed(4)}/min
              </span>
            </div>
          </div>

          <!-- Quick Actions -->
          <div class="pt-2 border-t border-dark-800 flex items-center gap-1.5">
            ${sellerWa ? `
              <a href="${sellerWa}" target="_blank" class="flex-1 py-1 px-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-300 text-[11px] font-medium text-center transition-all flex items-center justify-center gap-1">
                <i data-lucide="phone-outgoing" class="w-3 h-3 text-emerald-500"></i>
                <span>Buy Route</span>
              </a>
            ` : ''}
            ${buyerWa ? `
              <a href="${buyerWa}" target="_blank" class="flex-1 py-1 px-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-300 text-[11px] font-medium text-center transition-all flex items-center justify-center gap-1">
                <i data-lucide="phone-incoming" class="w-3 h-3 text-sky-400"></i>
                <span>Sell Route</span>
              </a>
            ` : ''}
            <button onclick="if(typeof openPitchModal==='function') openPitchModal('${escapeHtml(opp.country)}', '${escapeHtml(opp.route_type)}', '${escapeHtml(opp.seller_phone || opp.buyer_phone || '')}', ${opp.sell_rate});" class="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all flex items-center gap-1" title="Generate Arbitrage Pitch">
              <i data-lucide="sparkles" class="w-3 h-3"></i>
              <span>Pitch</span>
            </button>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons({ root: container });
  } catch (err) {
    console.error('Error loading arbitrage signals:', err);
    if (container) {
      container.innerHTML = `
        <div class="col-span-full py-4 text-center text-rose-400 text-xs">
          Failed to load live arbitrage spreads: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

// Global window exports
window.loadTelcoNews = loadTelcoNews;
window.handleNewsSearch = handleNewsSearch;
window.handleNewsFilter = handleNewsFilter;
window.setNewsPageSize = setNewsPageSize;
window.changeNewsPage = changeNewsPage;
window.loadExecutiveBrief = loadExecutiveBrief;
window.refreshExecutiveBrief = refreshExecutiveBrief;
window.loadArbitrageSignals = loadArbitrageSignals;
