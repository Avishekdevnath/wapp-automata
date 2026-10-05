/**
 * Vendor Directory Controller
 * - Displays all wholesale carriers, suppliers, and contacts
 * - Full Search, Activity Filtering, Multi-Sort & Pagination
 * - Direct WhatsApp link to chat with account manager
 */
let cachedVendors = [];
let vendorCurrentPage = 1;
let vendorPageSize = parseInt(localStorage.getItem('wapp_vendor_page_size') || '10', 10);
let vendorSearchQuery = '';
let vendorActivityFilter = 'all';
let vendorSortOrder = 'offers_desc';

async function loadVendorDirectory() {
  const container = document.getElementById('vendors-tbody');
  const countBadge = document.getElementById('vendor-count-badge');
  if (!container) return;

  try {
    const res = await fetch('/api/vendors');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedVendors = data.vendors || [];

    if (countBadge) countBadge.innerText = cachedVendors.length;

    renderVendorList();
  } catch (err) {
    console.error('Error loading vendor directory:', err);
    if (container) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-rose-400">
            <i data-lucide="alert-circle" class="w-8 h-8 mx-auto mb-2 text-rose-500"></i>
            <p class="text-xs font-semibold">Failed to load carriers list</p>
            <p class="text-[11px] text-slate-500 mt-1">${escapeHtml(err.message)}</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  }
}

function handleVendorSearch(event) {
  vendorSearchQuery = (event.target.value || '').toLowerCase().trim();
  vendorCurrentPage = 1;
  renderVendorList();
}

function handleVendorFilter() {
  const activityEl = document.getElementById('vendor-filter-activity');
  const sortEl = document.getElementById('vendor-sort-by');
  if (activityEl) vendorActivityFilter = activityEl.value;
  if (sortEl) vendorSortOrder = sortEl.value;

  vendorCurrentPage = 1;
  renderVendorList();
}

function setVendorPageSize(size) {
  vendorPageSize = parseInt(size, 10);
  localStorage.setItem('wapp_vendor_page_size', String(vendorPageSize));
  vendorCurrentPage = 1;
  renderVendorList();
}

function changeVendorPage(delta) {
  vendorCurrentPage += delta;
  renderVendorList();
}

function getFilteredVendors() {
  let list = cachedVendors.slice();

  // 1. Search Filter
  if (vendorSearchQuery) {
    list = list.filter(v => {
      const haystack = [v.name, v.phone, v.company].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(vendorSearchQuery);
    });
  }

  // 2. Activity Filter
  if (vendorActivityFilter === 'high') {
    list = list.filter(v => (v.total_offers || 0) >= 5);
  } else if (vendorActivityFilter === 'standard') {
    list = list.filter(v => (v.total_offers || 0) < 5);
  }

  // 3. Sorting
  if (vendorSortOrder === 'offers_desc') {
    list.sort((a, b) => (b.total_offers || 0) - (a.total_offers || 0));
  } else if (vendorSortOrder === 'recent') {
    list.sort((a, b) => (Number(b.last_seen_at) || 0) - (Number(a.last_seen_at) || 0));
  } else if (vendorSortOrder === 'name_asc') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  return list;
}

function renderVendorList() {
  const container = document.getElementById('vendors-tbody');
  if (!container) return;

  const filtered = getFilteredVendors();
  const total = filtered.length;

  updateVendorPaginationUI(total);

  if (total === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-slate-400">
          <i data-lucide="users" class="w-10 h-10 mx-auto text-slate-600 mb-2"></i>
          <p class="text-sm font-medium">No carriers matched your filter</p>
          <p class="text-xs text-slate-500 mt-1">Try clearing search terms or resetting activity filters</p>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Sliced page data
  let pageData = filtered;
  if (vendorPageSize > 0) {
    const startIdx = (vendorCurrentPage - 1) * vendorPageSize;
    pageData = filtered.slice(startIdx, startIdx + vendorPageSize);
  }

  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '');

  container.innerHTML = pageData.map(v => {
    const cleanPhone = (v.phone || '').replace(/[^0-9]/g, '');
    const dateStr = typeof formatDateTime === 'function' 
      ? formatDateTime(v.last_seen_at) 
      : (v.last_seen_at ? new Date(v.last_seen_at).toLocaleDateString() : '—');

    return `
      <tr class="border-b border-dark-800/60 hover:bg-dark-800/40 transition-colors">
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold text-xs shrink-0">
              ${(v.name || 'V')[0].toUpperCase()}
            </div>
            <div>
              <span class="font-semibold text-white text-xs block">${esc(v.name || 'Account Manager')}</span>
              <span class="text-[10px] text-slate-400 font-mono">${esc(v.phone)}</span>
            </div>
          </div>
        </td>

        <td class="py-3 px-4">
          <span class="text-xs text-slate-200 font-medium">${esc(v.company || 'Direct Carrier / Broker')}</span>
        </td>

        <td class="py-3 px-4">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            ${v.total_offers || 1} Offers
          </span>
        </td>

        <td class="py-3 px-4">
          <span class="text-[11px] text-slate-400 font-mono">${dateStr}</span>
        </td>

        <td class="py-3 px-4 text-right">
          <a 
            href="https://wa.me/${cleanPhone}" 
            target="_blank"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900 hover:bg-emerald-600 text-slate-300 hover:text-white border border-dark-700 hover:border-emerald-500 text-xs font-medium transition-all shadow-sm"
          >
            <i data-lucide="message-square" class="w-3.5 h-3.5 text-emerald-400"></i>
            <span>Chat</span>
          </a>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) window.lucide.createIcons();
}

function updateVendorPaginationUI(total) {
  const startEl = document.getElementById('vendor-page-start');
  const endEl = document.getElementById('vendor-page-end');
  const totalEl = document.getElementById('vendor-page-total');
  const currEl = document.getElementById('vendor-current-page');
  const totalPagesEl = document.getElementById('vendor-total-pages');
  const prevBtn = document.getElementById('btn-vendor-prev');
  const nextBtn = document.getElementById('btn-vendor-next');

  if (vendorPageSize <= 0) {
    if (startEl) startEl.innerText = total > 0 ? 1 : 0;
    if (endEl) endEl.innerText = total;
    if (totalEl) totalEl.innerText = total;
    if (currEl) currEl.innerText = 1;
    if (totalPagesEl) totalPagesEl.innerText = 1;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const maxPages = Math.max(1, Math.ceil(total / vendorPageSize));
  if (vendorCurrentPage > maxPages) vendorCurrentPage = maxPages;

  const start = total === 0 ? 0 : (vendorCurrentPage - 1) * vendorPageSize + 1;
  const end = Math.min(vendorCurrentPage * vendorPageSize, total);

  if (startEl) startEl.innerText = start;
  if (endEl) endEl.innerText = end;
  if (totalEl) totalEl.innerText = total;
  if (currEl) currEl.innerText = vendorCurrentPage;
  if (totalPagesEl) totalPagesEl.innerText = maxPages;

  if (prevBtn) prevBtn.disabled = (vendorCurrentPage <= 1);
  if (nextBtn) nextBtn.disabled = (vendorCurrentPage >= maxPages);

  // Update page size button active states
  document.querySelectorAll('.btn-vendor-size').forEach(btn => {
    const s = parseInt(btn.getAttribute('data-size'), 10);
    if (s === vendorPageSize) {
      btn.className = 'btn-vendor-size px-2.5 py-1 rounded-lg bg-purple-600 text-white font-semibold transition-all font-mono';
    } else {
      btn.className = 'btn-vendor-size px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all font-mono';
    }
  });
}

// Global window exports
window.loadVendorDirectory = loadVendorDirectory;
window.handleVendorSearch = handleVendorSearch;
window.handleVendorFilter = handleVendorFilter;
window.setVendorPageSize = setVendorPageSize;
window.changeVendorPage = changeVendorPage;
