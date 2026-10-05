/**
 * WappAutomata • Route Matrix Modals Controller
 * Handles Route Details Inspector, Trade Ticket Clipboard, and Post Route creation.
 */
(function() {
  'use strict';

  let activeDetailRouteId = null;

  function getRoutesList() {
    if (typeof window.getCachedRoutes === 'function') return window.getCachedRoutes();
    return window.cachedRoutes || [];
  }

  function getFlags() {
    if (typeof window.getCountryFlags === 'function') return window.getCountryFlags();
    return window.COUNTRY_FLAGS || {};
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

  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Recent';
    const now = Date.now();
    const diffSec = Math.floor((now - Number(timestamp)) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }

  /**
   * Route Detail Modal Inspector
   */
  function openRouteDetailModal(routeId) {
    const routes = getRoutesList();
    const route = routes.find(r => r.id === routeId);
    if (!route) return;

    activeDetailRouteId = routeId;
    const flags = getFlags();
    const flag = flags[route.country] || '🌐';
    const cleanPhone = (route.vendor_phone || '').replace(/[^0-9]/g, '');

    const elFlag = document.getElementById('modal-route-flag');
    const elTitle = document.getElementById('modal-route-title');
    const elSubtitle = document.getElementById('modal-route-subtitle');
    const elDest = document.getElementById('modal-route-dest');
    const elIntent = document.getElementById('modal-route-intent');
    const elType = document.getElementById('modal-route-type');
    const elRate = document.getElementById('modal-route-rate');
    const elPulse = document.getElementById('modal-route-pulse');
    const elFas = document.getElementById('modal-route-fas');
    const elVendor = document.getElementById('modal-route-vendor');
    const elCompany = document.getElementById('modal-route-company');
    const elPhone = document.getElementById('modal-route-phone');
    const elNotes = document.getElementById('modal-route-notes');
    const btnKnock = document.getElementById('btn-modal-knock');
    const elNewsBox = document.getElementById('modal-route-news-box');

    if (elNewsBox) {
      if (route.active_news) {
        elNewsBox.classList.remove('hidden');
        const isOutage = route.active_news.category === 'OUTAGE' || route.active_news.urgency === 'HIGH';
        const cardType = isOutage ? 'incident-outage' : 'incident-warning';
        const iconName = isOutage ? 'alert-octagon' : (route.active_news.category === 'REGULATION' ? 'scale' : 'wrench');
        
        elNewsBox.innerHTML = `
          <div class="modal-incident-card ${cardType} space-y-2 shadow-sm">
            <div class="flex items-center justify-between gap-2">
              <span class="incident-header-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 shadow-sm">
                <i data-lucide="${iconName}" class="w-3 h-3"></i>
                <span>${escapeHtml(route.active_news.category)} • ${escapeHtml(route.active_news.urgency)}</span>
              </span>
              <span class="text-[11px] font-mono opacity-80 shrink-0 font-medium">${formatTimeAgo(route.active_news.created_at)}</span>
            </div>
            <p class="incident-headline text-xs font-bold leading-snug">${escapeHtml(route.active_news.headline)}</p>
            ${route.active_news.raw_text ? `
              <div class="incident-quote-box p-3 rounded-xl text-xs leading-relaxed font-sans shadow-inner">
                ${escapeHtml(route.active_news.raw_text)}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        elNewsBox.classList.add('hidden');
        elNewsBox.innerHTML = '';
      }
    }

    if (elFlag) elFlag.innerText = flag;
    if (elTitle) elTitle.innerText = `${route.country} - ${route.route_type}`;
    if (elSubtitle) elSubtitle.innerText = `${route.vendor_name || 'Carrier'} • Verified Wholesale Feed`;
    if (elDest) elDest.innerText = `${flag} ${route.country} (${route.ani_pass || 'Clean ANI'})`;
    if (elIntent) {
      elIntent.innerHTML = (route.intent === 'WTB')
        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300">🟡 Buying (WTB)</span>'
        : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">🟢 Selling (WTS)</span>';
    }
    if (elType) {
      elType.innerHTML = `<span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-dark-800 text-slate-200 border border-dark-700">${escapeHtml(route.route_type)}</span>`;
    }
    if (elRate) {
      const bestPill = route.is_best_trusted_price ? '<span class="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">🏆 Best Trusted Price</span>' : '';
      const diffPill = route.diff_vs_avg_text ? `<span class="block text-[11px] text-slate-400 font-normal font-sans mt-0.5">${escapeHtml(route.diff_vs_avg_text)} vs 30d avg</span>` : '';
      elRate.innerHTML = (route.rate_per_min !== null) 
        ? `<span class="text-emerald-400 font-bold font-mono text-sm">$${Number(route.rate_per_min).toFixed(4)} / min</span>${bestPill}${diffPill}` 
        : 'Ping for Rate';
    }
    if (elPulse) elPulse.innerText = route.billing_pulse || '1/1';
    if (elFas) {
      const flagsList = (route.fraud_flags && Array.isArray(route.fraud_flags) && route.fraud_flags.length > 0)
        ? `<div class="mt-1 flex flex-wrap gap-1">${route.fraud_flags.map(f => `<span class="px-1.5 py-0.5 bg-dark-950 border border-dark-800 rounded text-[10px] text-slate-300">${escapeHtml(f)}</span>`).join('')}</div>`
        : '';
      const badgeHtml = typeof window.renderFraudBadge === 'function' ? window.renderFraudBadge(route) : '';
      elFas.innerHTML = `<div class="space-y-1">${badgeHtml}${flagsList}</div>`;
    }
    if (elVendor) elVendor.innerText = route.vendor_name || 'Direct Vendor';
    if (elCompany) elCompany.innerText = route.company_name || 'Wholesale Provider';
    if (elPhone) elPhone.innerText = route.vendor_phone;
    if (elNotes) elNotes.innerText = route.quality_notes || route.raw_text || 'Standard wholesale voice termination terms apply. Direct SIP interconnect.';

    if (btnKnock) {
      btnKnock.onclick = () => {
        if (typeof window.knockVendor === 'function') {
          window.knockVendor(cleanPhone, route.vendor_name || 'Partner', route.country, route.route_type, route.billing_pulse);
        }
      };
    }

    const modal = document.getElementById('route-detail-modal');
    if (modal) {
      if (window.initWindow) window.initWindow(modal);
      modal.classList.remove('hidden');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  function closeRouteDetailModal() {
    const modal = document.getElementById('route-detail-modal');
    if (modal) modal.classList.add('hidden');
    if (window.removeDockPill) window.removeDockPill('route-detail-modal');
    activeDetailRouteId = null;
  }

  function pitchRouteFromModal() {
    const routes = getRoutesList();
    const route = routes.find(r => r.id === activeDetailRouteId);
    if (!route) return;
    const cleanPhone = (route.vendor_phone || '').replace(/[^0-9]/g, '');
    closeRouteDetailModal();
    window.location.hash = '#/insights';
    setTimeout(() => {
      if (typeof window.populatePitchForm === 'function') {
        window.populatePitchForm(route.country, route.route_type, route.rate_per_min, route.vendor_name, cleanPhone);
      }
    }, 250);
  }

  /**
   * 1-Click Copy Wholesale Trade Ticket to Clipboard
   */
  function copyTradeTicket(routeId) {
    const targetId = routeId || activeDetailRouteId;
    const routes = getRoutesList();
    const route = routes.find(r => r.id === targetId);
    if (!route) {
      if (typeof showToast === 'function') showToast('Route data not available', 'error');
      return;
    }

    const flags = getFlags();
    const rateStr = route.rate_per_min !== null ? `$${Number(route.rate_per_min).toFixed(4)}/min` : 'Ping for Rate';
    const flag = flags[route.country] || '';

    const ticket = `========================================
WHOLESALE ROUTE TICKET - WAPPAUTOMATA
========================================
Destination : ${flag} ${route.country}
Intent      : ${route.intent || 'WTS'} (${(route.intent === 'WTB') ? 'Buying' : 'Selling'})
Route Type  : ${route.route_type}
Rate        : ${rateStr}
Billing     : ${route.billing_pulse || '1/1'}
FAS Status  : ${route.fas_free ? '100% FAS-Free Verified' : 'Standard'}
Quality/Notes: ${route.quality_notes || 'Clean interconnect'}
Carrier     : ${route.vendor_name || 'Direct Vendor'} (${route.vendor_phone})
========================================`;

    navigator.clipboard.writeText(ticket).then(() => {
      if (typeof showToast === 'function') showToast(`Trade ticket for ${route.country} copied!`, 'success');
    }).catch(() => {
      if (typeof showToast === 'function') showToast('Failed to copy ticket', 'error');
    });
  }

  /**
   * Post Route Modal Handlers
   */
  function openPostRouteModal() {
    const modal = document.getElementById('modal-post-route');
    if (modal) {
      if (window.initWindow) window.initWindow(modal);
      modal.classList.remove('hidden');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  function closePostRouteModal() {
    const modal = document.getElementById('modal-post-route');
    if (modal) modal.classList.add('hidden');
    if (window.removeDockPill) window.removeDockPill('modal-post-route');
  }

  async function handlePostRouteSubmit(e) {
    e.preventDefault();
    const country = document.getElementById('post-country')?.value;
    const intent = document.getElementById('post-intent')?.value || 'WTS';
    const route_type = document.getElementById('post-route-type')?.value;
    const billing_pulse = document.getElementById('post-pulse')?.value || '1/1';
    const rate_per_min = document.getElementById('post-rate')?.value || null;
    const vendor_name = document.getElementById('post-vendor-name')?.value || 'Terminal Trader';
    const vendor_phone = document.getElementById('post-vendor-phone')?.value;
    const quality_notes = document.getElementById('post-notes')?.value;
    const fas_free = document.getElementById('post-fas-free')?.checked;

    try {
      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country,
          intent,
          route_type,
          billing_pulse,
          rate_per_min,
          vendor_name,
          vendor_phone,
          quality_notes,
          fas_free
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      if (typeof showToast === 'function') showToast(`Route for ${country} successfully posted!`, 'success');
      closePostRouteModal();
      if (typeof window.loadRouteMatrix === 'function') window.loadRouteMatrix();
    } catch (err) {
      if (typeof showToast === 'function') showToast(`Failed to post route: ${err.message}`, 'error');
    }
  }

  // Export to Global Scope
  window.openRouteDetailModal = openRouteDetailModal;
  window.closeRouteDetailModal = closeRouteDetailModal;
  window.pitchRouteFromModal = pitchRouteFromModal;
  window.copyTradeTicket = copyTradeTicket;
  window.openPostRouteModal = openPostRouteModal;
  window.closePostRouteModal = closePostRouteModal;
  window.handlePostRouteSubmit = handlePostRouteSubmit;
})();
