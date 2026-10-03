/**
 * Client Inbox Module: Clean & Non-Technical Message Feed
 */
function renderClientFeed() {
  const container = document.getElementById('client-messages-container');
  if (!container) return;

  const searchInput = document.getElementById('client-search-input');
  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const filterType = document.getElementById('client-filter-type')?.value || 'all';

  const filtered = (window.messagesCache || []).filter(m => {
    if (filterType === 'group' && m.chat_type !== 'group') return false;
    if (filterType === 'direct' && m.chat_type !== 'direct') return false;

    if (!searchQuery) return true;
    const haystack = [m.text, m.sender_name, m.sender_phone, m.chat_name].join(' ').toLowerCase();
    return haystack.includes(searchQuery);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-12 text-center border border-dashed border-dark-700">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-dark-900 border border-dark-700 flex items-center justify-center text-slate-500 mb-3">
          <i data-lucide="message-square" class="w-6 h-6 text-emerald-400"></i>
        </div>
        <h4 class="text-sm font-semibold text-white">No WhatsApp messages found</h4>
        <p class="text-xs text-slate-400 mt-1">Incoming chats from your linked WhatsApp account will appear here in real-time.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(m => {
    const initials = getInitials(m.sender_name || m.sender_phone);
    const avatarGradient = getAvatarColor(m.sender_phone || m.sender_name);
    const isGroup = m.chat_type === 'group';

    return `
      <div class="glass-card rounded-2xl p-4 sm:p-5 border border-dark-700/70 hover:border-dark-600 transition-all">
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr ${avatarGradient} flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0">
            ${escapeHtml(initials)}
          </div>

          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-white">${escapeHtml(m.sender_name || 'Contact')}</span>
                ${m.sender_phone ? `
                  <span class="px-2 py-0.5 rounded-full bg-dark-950 border border-dark-700 text-slate-300 font-mono text-[11px]">
                    ${escapeHtml(m.sender_phone)}
                  </span>
                ` : ''}
                ${isGroup ? `
                  <span class="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-medium flex items-center gap-1">
                    <i data-lucide="users" class="w-3 h-3"></i>
                    <span>${escapeHtml(m.chat_name || 'Group')}</span>
                  </span>
                ` : ''}
              </div>
              <span class="text-[11px] text-slate-400 font-mono">${m.timestamp}</span>
            </div>

            <div class="text-xs text-slate-200 bg-dark-950/80 p-3 rounded-xl border border-dark-800/80 leading-relaxed font-sans">
              ${escapeHtml(m.text || '(media/image attachment)')}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}
