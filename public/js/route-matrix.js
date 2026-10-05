/**
 * Route Matrix Controller
 * - Fetches and renders live telecom rate sheets
 * - Real-time filtering by Country, Route Type, Pulse, Search
 * - 1-Click "Knock Vendor" WhatsApp deal opening
 */

let currentRouteFilters = {
  q: '',
  country: '',
  type: '',
  pulse: '',
  intent: '',
  limit: 50,
  offset: 0
};

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

async function loadRouteMatrix() {
  const container = document.getElementById('route-matrix-tbody');
  const countBadge = document.getElementById('route-count-badge');
  const totalCountEl = document.getElementById('route-total-count');
  if (!container) return;

  const params = new URLSearchParams();
  if (currentRouteFilters.q) params.set('q', currentRouteFilters.q);
  if (currentRouteFilters.country) params.set('country', currentRouteFilters.country);
  if (currentRouteFilters.type) params.set('type', currentRouteFilters.type);
  if (currentRouteFilters.pulse) params.set('pulse', currentRouteFilters.pulse);
  if (currentRouteFilters.intent) params.set('intent', currentRouteFilters.intent);
  params.set('limit', currentRouteFilters.limit);
  params.set('offset', currentRouteFilters.offset);

  try {
    const res = await fetch(`/api/routes?${params.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const routes = data.routes || [];

    if (countBadge) countBadge.innerText = data.total || routes.length;
    if (totalCountEl) totalCountEl.innerText = `${data.total || routes.length} Active Routes`;

    if (routes.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="py-12 text-center text-slate-400">
            <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-600 mb-2"></i>
            <p class="text-sm font-medium">No matching telecom routes found</p>
            <p class="text-xs text-slate-500 mt-1">Try broadening your search or country filter</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = routes.map(r => {
      const flag = COUNTRY_FLAGS[r.country] || '🌐';
      let typeBadgeClass = 'bg-slate-800 text-slate-300 border-slate-700';
      if (r.route_type.includes('CLI')) typeBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      if (r.route_type.includes('CC')) typeBadgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      if (r.route_type.includes('IVR')) typeBadgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/30';

      const pulseBadgeClass = r.billing_pulse === '1/1' 
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
        : 'bg-slate-800 text-slate-400 border-slate-700';

      const rateDisplay = r.rate_per_min !== null 
        ? `$${Number(r.rate_per_min).toFixed(4)}` 
        : '<span class="text-slate-500 italic text-[11px]">Ping for Rate</span>';

      const timeAgo = formatTimeAgo(r.created_at);
      const cleanPhone = (r.vendor_phone || '').replace(/[^0-9]/g, '');

      return `
        <tr class="border-b border-dark-800/60 hover:bg-dark-800/40 transition-colors">
          <!-- Destination -->
          <td class="py-3 px-4">
            <div class="flex items-center gap-2">
              <span class="text-base select-none">${flag}</span>
              <div>
                <span class="font-semibold text-white text-xs block">${escapeHtml(r.country)}</span>
                <span class="text-[10px] text-slate-400">${escapeHtml(r.ani_pass || 'Standard ANI')}</span>
              </div>
            </div>
          </td>

          <!-- Route Type -->
          <td class="py-3 px-4">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${typeBadgeClass}">
              ${escapeHtml(r.route_type)}
            </span>
          </td>

          <!-- Billing Pulse -->
          <td class="py-3 px-4">
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${pulseBadgeClass}">
              ${escapeHtml(r.billing_pulse)}
            </span>
          </td>

          <!-- Price / Rate -->
          <td class="py-3 px-4">
            <span class="font-mono text-xs font-semibold text-emerald-300">
              ${rateDisplay}
            </span>
          </td>

          <!-- Quality & FAS -->
          <td class="py-3 px-4">
            <div class="space-y-0.5">
              ${r.fas_free ? '<span class="inline-flex items-center gap-1 text-[10px] text-emerald-400"><i data-lucide="check" class="w-3 h-3"></i> 100% FAS-Free</span>' : '<span class="text-[10px] text-amber-400">Standard</span>'}
              ${r.quality_notes ? `<span class="block text-[10px] text-slate-400 truncate max-w-[140px]">${escapeHtml(r.quality_notes)}</span>` : ''}
            </div>
          </td>

          <!-- Vendor / Carrier -->
          <td class="py-3 px-4">
            <div>
              <span class="text-xs font-medium text-slate-200 block">${escapeHtml(r.vendor_name || 'Vendor')}</span>
              <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(r.company_name || r.vendor_phone)}</span>
            </div>
          </td>

          <!-- 1-Click Knock Action -->
          <td class="py-3 px-4 text-right">
            <div class="flex items-center justify-end gap-2">
              <span class="text-[10px] text-slate-500 mr-1 hidden sm:inline">${timeAgo}</span>
              <button 
                onclick="knockVendor('${cleanPhone}', '${escapeHtml(r.vendor_name || 'Partner')}', '${escapeHtml(r.country)}', '${escapeHtml(r.route_type)}', '${escapeHtml(r.billing_pulse)}')"
                class="px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 transition-all shrink-0"
                title="Open WhatsApp chat with pre-filled deal request"
              >
                <i data-lucide="zap" class="w-3.5 h-3.5 fill-current"></i>
                <span>Knock</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading route matrix:', err);
    if (container) {
      container.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-400 text-xs font-mono">Failed to load route data: ${err.message}</td></tr>`;
    }
  }
}

/**
 * 1-Click WhatsApp Knock Outreach
 */
function knockVendor(cleanPhone, vendorName, country, routeType, pulse) {
  if (!cleanPhone || cleanPhone === 'unknown') {
    showToast('Vendor phone number is not available', 'error');
    return;
  }

  const messageText = `Hi ${vendorName}, saw your offer for ${country} ${routeType} (${pulse}). We have live outbound CC traffic. Please share latest rate sheet and test IP.`;
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
  
  // Open in new tab
  window.open(url, '_blank');
  showToast(`Knocking ${vendorName} on WhatsApp...`, 'success');
}

/**
 * Route Matrix Filter Event Handlers
 */
function handleRouteSearch(e) {
  currentRouteFilters.q = (e.target.value || '').trim();
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

function handleCountryFilter(country) {
  currentRouteFilters.country = country;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

function handleTypeFilter(type) {
  currentRouteFilters.type = type;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

function handlePulseFilter(pulse) {
  currentRouteFilters.pulse = pulse;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

function handleIntentFilter(intent) {
  currentRouteFilters.intent = intent;
  currentRouteFilters.offset = 0;
  loadRouteMatrix();
}

function exportRoutesCSV() {
  window.open('/api/export/routes', '_blank');
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
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

window.loadRouteMatrix = loadRouteMatrix;
window.knockVendor = knockVendor;
window.handleRouteSearch = handleRouteSearch;
window.handleCountryFilter = handleCountryFilter;
window.handleTypeFilter = handleTypeFilter;
window.handlePulseFilter = handlePulseFilter;
window.handleIntentFilter = handleIntentFilter;
window.exportRoutesCSV = exportRoutesCSV;
