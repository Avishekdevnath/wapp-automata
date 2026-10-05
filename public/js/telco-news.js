/**
 * Telecom Industry News & Outage Alerts Controller
 * - Displays carrier maintenance, regulatory blocks (FCC/NCC), and FAS fraud warnings
 */

async function loadTelcoNews() {
  const container = document.getElementById('telco-news-container');
  const countBadge = document.getElementById('news-count-badge');
  if (!container) return;

  try {
    const res = await fetch('/api/news');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const newsList = data.news || [];

    if (countBadge) countBadge.innerText = newsList.length;

    if (newsList.length === 0) {
      container.innerHTML = `
        <div class="col-span-full glass-card rounded-2xl p-8 text-center border border-dark-700/80">
          <i data-lucide="shield-check" class="w-10 h-10 mx-auto text-emerald-400 mb-2"></i>
          <h4 class="text-sm font-semibold text-white">No Active Disruptions Reported</h4>
          <p class="text-xs text-slate-400 mt-1">Carriers have not reported any gateway outages or regulatory blocks today.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = newsList.map(item => {
      let icon = 'alert-triangle';
      let badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      let borderClass = 'border-dark-700/80';

      if (item.urgency === 'HIGH') {
        icon = 'alert-octagon';
        badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse';
        borderClass = 'border-rose-500/40 bg-rose-950/10';
      } else if (item.category === 'MAINTENANCE') {
        icon = 'wrench';
        badgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      } else if (item.category === 'REGULATION') {
        icon = 'scale';
        badgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      }

      const dateStr = formatDateTime(item.created_at);

      return `
        <div class="glass-card rounded-2xl p-5 border ${borderClass} space-y-3 hover:border-slate-600 transition-all">
          <div class="flex items-center justify-between gap-3">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${badgeClass}">
              <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
              <span>${escapeHtml(item.category)} • ${escapeHtml(item.urgency)}</span>
            </span>
            <span class="text-[10px] text-slate-500 font-mono">${dateStr}</span>
          </div>

          <div>
            <h4 class="text-xs font-bold text-white leading-snug">${escapeHtml(item.headline)}</h4>
            <p class="text-[11px] text-slate-400 mt-1 line-clamp-3">${escapeHtml(item.raw_text || '')}</p>
          </div>

          <div class="pt-2 border-t border-dark-800 flex items-center justify-between text-[11px]">
            <span class="text-slate-400 font-medium">Impact: <span class="text-slate-200 font-semibold">${escapeHtml(item.affected_countries || 'Global')}</span></span>
            <span class="text-[10px] text-slate-500">Live Ingested</span>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading telco news:', err);
  }
}

window.loadTelcoNews = loadTelcoNews;
