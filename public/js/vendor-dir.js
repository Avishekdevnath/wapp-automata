/**
 * Vendor Directory Controller
 * - Displays all wholesale carriers, suppliers, and contacts
 * - Direct WhatsApp link to chat with account manager
 */

async function loadVendorDirectory() {
  const container = document.getElementById('vendors-tbody');
  const countBadge = document.getElementById('vendor-count-badge');
  if (!container) return;

  try {
    const res = await fetch('/api/vendors');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const vendors = data.vendors || [];

    if (countBadge) countBadge.innerText = vendors.length;

    if (vendors.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="5" class="py-12 text-center text-slate-400">
            <i data-lucide="users" class="w-10 h-10 mx-auto text-slate-600 mb-2"></i>
            <p class="text-sm font-medium">No vendors registered yet</p>
            <p class="text-xs text-slate-500 mt-1">Vendors will populate automatically as WhatsApp posts are received</p>
          </td>
        </tr>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    container.innerHTML = vendors.map(v => {
      const cleanPhone = (v.phone || '').replace(/[^0-9]/g, '');
      const dateStr = formatDateTime(v.last_seen_at);

      return `
        <tr class="border-b border-dark-800/60 hover:bg-dark-800/40 transition-colors">
          <td class="py-3 px-4">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs shrink-0">
                ${(v.name || 'V')[0].toUpperCase()}
              </div>
              <div>
                <span class="font-semibold text-white text-xs block">${escapeHtml(v.name || 'Account Manager')}</span>
                <span class="text-[10px] text-slate-400 font-mono">${escapeHtml(v.phone)}</span>
              </div>
            </div>
          </td>

          <td class="py-3 px-4">
            <span class="text-xs text-slate-200 font-medium">${escapeHtml(v.company || 'Direct Carrier / Broker')}</span>
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
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-900 hover:bg-emerald-600 text-slate-300 hover:text-white border border-dark-700 hover:border-emerald-500 text-xs font-medium transition-all"
            >
              <i data-lucide="message-square" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>Chat</span>
            </a>
          </td>
        </tr>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    console.error('Error loading vendor directory:', err);
  }
}

window.loadVendorDirectory = loadVendorDirectory;
