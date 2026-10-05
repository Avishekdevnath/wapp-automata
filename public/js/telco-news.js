/**
 * Telecom Industry News & Outage Alerts Controller
 * - Displays carrier maintenance, regulatory blocks (FCC/NCC), and FAS fraud warnings
 * - AI Executive Outage & Risk Briefing synthesized with DeepSeek AI
 */

async function loadTelcoNews() {
  const container = document.getElementById('telco-news-container');
  const countBadge = document.getElementById('news-count-badge');
  if (!container) return;

  // Load Executive Brief in parallel
  loadExecutiveBrief(false);

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
          `<span class="px-2 py-0.5 bg-dark-950 border border-dark-800 rounded-md text-[10px] text-amber-300 font-medium">${escapeHtml(c)}</span>`
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

window.loadTelcoNews = loadTelcoNews;
window.loadExecutiveBrief = loadExecutiveBrief;
window.refreshExecutiveBrief = refreshExecutiveBrief;
