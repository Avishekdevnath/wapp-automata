/**
 * Client Inbox Module: Live WhatsApp Messages Stream (Zero Loss)
 */
window.streamAutoScroll = true;
let streamPage = 1;
let streamPageSize = parseInt(localStorage.getItem('wapp_stream_page_size') || '25', 10);
let streamTotalCount = 0;

function renderClientFeed() {
  const container = document.getElementById('client-messages-container') || document.getElementById('client-messages-feed');
  if (!container) return;

  const allMsgs = (window.messagesCache || []).filter(m => (m.text && m.text.trim()) || m.has_media);

  // 1. Update Real-time Stream Counters
  const totalEl = document.getElementById('stat-total-streamed');
  const groupsEl = document.getElementById('stat-groups-streamed');
  const archivedGroupsEl = document.getElementById('stat-archived-groups-streamed');
  const sendersEl = document.getElementById('stat-senders-streamed');
  const streamBadge = document.getElementById('stream-count-badge');

  if (totalEl) totalEl.innerText = allMsgs.length;
  if (streamBadge) streamBadge.innerText = allMsgs.length;
  if (groupsEl) {
    const uniqueActiveGroups = new Set(
      allMsgs.filter(m => m.chat_type === 'group' && !m.is_archived).map(m => m.chat_name || m.chat_jid)
    );
    groupsEl.innerText = uniqueActiveGroups.size;
  }
  if (archivedGroupsEl) {
    const uniqueArchivedGroups = new Set(
      allMsgs.filter(m => m.is_archived).map(m => m.chat_name || m.chat_jid)
    );
    archivedGroupsEl.innerText = uniqueArchivedGroups.size;
  }
  if (sendersEl) {
    const uniqueSenders = new Set(allMsgs.map(m => m.sender_phone || m.sender_name).filter(Boolean));
    sendersEl.innerText = uniqueSenders.size;
  }

  // 2. Filter & Search Query
  const searchInput = document.getElementById('client-search-input');
  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const filterType = document.getElementById('client-filter-type')?.value || 'all';

  const filtered = allMsgs.filter(m => {
    if (filterType === 'group' && (m.chat_type !== 'group' || m.is_archived)) return false;
    if (filterType === 'archived' && !m.is_archived) return false;
    if (filterType === 'direct' && m.chat_type !== 'direct' && m.chat_type !== 'individual') return false;
    if (filterType === 'media' && !m.has_media && !m.media) return false;
    if (filterType === 'contact' && !m.contact && m.media?.type !== 'contact') return false;
    if (filterType === 'sent' && !m.is_from_me) return false;

    if (!searchQuery) return true;
    const haystack = [
      m.text,
      m.sender_name,
      m.sender_phone,
      m.chat_name,
      m.contact?.name,
      m.contact?.phone,
      m.media?.fileName
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(searchQuery);
  });

  streamTotalCount = filtered.length;
  updateStreamPaginationUI(streamTotalCount);

  const headerEl = document.getElementById('stream-table-header');
  const paginationEl = document.getElementById('stream-pagination-bar');

  if (filtered.length === 0) {
    if (headerEl) headerEl.classList.add('hidden');
    if (paginationEl) paginationEl.classList.add('hidden');

    const isFilteredSearch = Boolean(searchQuery || filterType !== 'all');
    const isConnected = Boolean(
      window.isWhatsAppConnected || 
      (window.deviceSessionCache && window.deviceSessionCache.status === 'authenticated') ||
      (document.getElementById('nav-device-phone')?.innerText && !document.getElementById('nav-device-phone')?.innerText.includes('Scan QR'))
    );

    let emptyHtml = '';

    if (isFilteredSearch) {
      // 1. Search / Filter Mismatch State
      emptyHtml = `
        <div class="h-full min-h-[360px] flex flex-col items-center justify-center p-6 sm:p-12 text-center select-none">
          <div class="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
            <i data-lucide="search-x" class="w-7 h-7"></i>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-2 inline-flex items-center gap-1.5">
            Filter Active
          </span>
          <h4 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            ${searchQuery ? `No messages match "${esc(searchQuery)}"` : 'No messages match current filter'}
          </h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
            No live records in the buffer match your search terms or filter selection (${filterType}). Try adjusting keywords or reset to view all live streams.
          </p>
          <div class="flex items-center gap-2 mt-5">
            <button onclick="clearClientFeedFilters()" class="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      `;
    } else if (!isConnected) {
      // 2. WhatsApp Disconnected / Unlinked State
      emptyHtml = `
        <div class="h-full min-h-[360px] flex flex-col items-center justify-center p-6 sm:p-12 text-center select-none">
          <div class="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 mb-4 shadow-inner">
            <i data-lucide="qr-code" class="w-7 h-7"></i>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-2 inline-flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            Gateway Offline
          </span>
          <h4 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            WhatsApp Gateway Not Linked
          </h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
            Link Telcia with your WhatsApp phone or Multi-Device to start capturing live carrier broadcasts, wholesale voice offers, and rate sheets in real time.
          </p>
          <div class="flex items-center justify-center gap-3 mt-5 flex-wrap">
            <button onclick="openDeviceModal()" class="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md">
              <i data-lucide="qr-code" class="w-3.5 h-3.5"></i>
              <span>Link WhatsApp via QR</span>
            </button>
            <button onclick="injectTestMessage()" class="btn btn-secondary btn-sm flex items-center gap-1.5">
              <i data-lucide="send" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>Send Test Ping</span>
            </button>
          </div>
        </div>
      `;
    } else {
      // 3. Connected, Awaiting Live Carrier Traffic State
      emptyHtml = `
        <div class="h-full min-h-[360px] flex flex-col items-center justify-center p-6 sm:p-12 text-center select-none">
          <div class="relative w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/10">
            <span class="absolute inset-0 rounded-2xl border border-emerald-400/40 animate-ping opacity-30"></span>
            <i data-lucide="radio" class="w-8 h-8 animate-pulse"></i>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mb-2 inline-flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Listening for Live Messages
          </span>
          <h4 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Awaiting Inbound WhatsApp Stream
          </h4>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-md leading-relaxed">
            Collector is connected with 100% durable local SQLite queuing. New carrier offers, rate sheets, and media will stream here automatically.
          </p>
          <div class="flex items-center justify-center gap-3 mt-5 flex-wrap">
            <button onclick="injectTestMessage()" class="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md">
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
              <span>Send Test Ping</span>
            </button>
            <button onclick="renderClientFeed()" class="btn btn-secondary btn-sm flex items-center gap-1.5">
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              <span>Refresh Feed</span>
            </button>
          </div>
        </div>
      `;
    }

    container.innerHTML = emptyHtml;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // If filtered.length > 0:
  if (headerEl) headerEl.classList.remove('hidden');
  if (paginationEl) paginationEl.classList.remove('hidden');

  // Sliced page messages
  let pageMessages = filtered;
  if (streamPageSize > 0) {
    const startIdx = (streamPage - 1) * streamPageSize;
    pageMessages = filtered.slice(startIdx, startIdx + streamPageSize);
  }

  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '');

  container.innerHTML = pageMessages.map(m => {
    const isOutbound = Boolean(m.is_from_me);
    const isArchived = Boolean(m.is_archived);
    const initials = isOutbound ? 'YOU' : (typeof getInitials === 'function' ? getInitials(m.sender_name || m.sender_phone) : 'WA');
    const avatarGradient = isOutbound
      ? 'from-indigo-500 to-purple-700'
      : (typeof getAvatarColor === 'function' ? getAvatarColor(m.sender_phone || m.sender_name) : 'from-emerald-500 to-teal-700');
    const isGroup = m.chat_type === 'group';

    // Time & Date formatting with Year: e.g. 04:21:39 and Oct 6, 2026
    let timeStr = '';
    let dateStr = '';
    if (m.occurred_at || m.timestamp) {
      try {
        const d = new Date(m.occurred_at || m.timestamp);
        if (!isNaN(d.getTime())) {
          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
          dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        }
      } catch {}
    }
    if (!timeStr) {
      timeStr = m.timestamp || '--:--';
    }

    const cleanPhone = (m.sender_phone || '').replace(/[^0-9]/g, '');

    const avatarUrl = m.sender_avatar_url || m.avatar_url;
    const avatarHtml = avatarUrl
      ? `<div class="w-6 h-6 rounded-md overflow-hidden shrink-0 border border-dark-700">
          <img src="${esc(avatarUrl)}" alt="${esc(initials)}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="w-full h-full bg-gradient-to-tr ${avatarGradient} items-center justify-center text-white font-bold text-[9px]" style="display:none;">${esc(initials)}</div>
         </div>`
      : `<div class="w-6 h-6 rounded-md bg-gradient-to-tr ${avatarGradient} flex items-center justify-center text-white font-bold text-[9px] shadow-xs shrink-0">${esc(initials)}</div>`;

    const mediaObj = m.media || m.raw_envelope?.message?.media;
    const mediaType = mediaObj?.type ||
      (m.raw_envelope?.message?.raw_payload?.message?.imageMessage ? 'image' :
       m.raw_envelope?.message?.raw_payload?.message?.videoMessage ? 'video' :
       m.raw_envelope?.message?.raw_payload?.message?.audioMessage ? 'audio' :
       m.raw_envelope?.message?.raw_payload?.message?.documentMessage ? 'document' :
       (m.has_media ? 'image' : null));

    // Media Pill
    let mediaPill = '';
    if (mediaType === 'audio') {
      const dur = mediaObj?.durationSeconds ? `${Math.floor(mediaObj.durationSeconds / 60)}:${String(mediaObj.durationSeconds % 60).padStart(2, '0')}` : '';
      mediaPill = `<span class="shrink-0 px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] flex items-center gap-1 font-semibold">
        <i data-lucide="mic" class="w-2.5 h-2.5"></i>
        <span>Voice Note${dur ? ` (${dur})` : ''}</span>
      </span>`;
    } else if (mediaType === 'document') {
      const docName = mediaObj?.fileName || 'Document';
      mediaPill = `<span class="shrink-0 px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono text-[10px] flex items-center gap-1 font-semibold max-w-[140px] truncate" title="${esc(docName)}">
        <i data-lucide="file-spreadsheet" class="w-2.5 h-2.5"></i>
        <span class="truncate">${esc(docName)}</span>
      </span>`;
    } else if (m.contact || mediaType === 'contact') {
      const cName = m.contact?.name || 'Contact';
      mediaPill = `<span class="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-[10px] flex items-center gap-1 font-semibold">
        <i data-lucide="user-check" class="w-2.5 h-2.5"></i>
        <span>vCard: ${esc(cName)}</span>
      </span>`;
    } else if (m.location || mediaType === 'location') {
      mediaPill = `<span class="shrink-0 px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] flex items-center gap-1 font-semibold">
        <i data-lucide="map-pin" class="w-2.5 h-2.5"></i>
        <span>Location</span>
      </span>`;
    } else if (m.has_media) {
      mediaPill = `<span class="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-[10px] flex items-center gap-1 font-semibold">
        <i data-lucide="paperclip" class="w-2.5 h-2.5"></i>
        <span class="capitalize">${mediaType || 'Media'}</span>
      </span>`;
    }

    // Context Badges
    const badges = [];
    if (isOutbound) {
      badges.push(`<span class="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[9px] font-semibold">You</span>`);
    }
    if (isArchived) {
      badges.push(`<span class="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px] font-semibold flex items-center gap-0.5"><i data-lucide="archive" class="w-2.5 h-2.5"></i><span>Archived</span></span>`);
    }
    if (isGroup) {
      badges.push(`<span class="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px] font-semibold truncate max-w-[120px]" title="${esc(m.chat_name || 'Group')}"><i data-lucide="users" class="w-2.5 h-2.5 inline mr-0.5"></i>${esc(m.chat_name || 'Group')}</span>`);
    } else if (!isOutbound) {
      badges.push(`<span class="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-medium">Direct</span>`);
    }

    const knockUrl = (!isOutbound && cleanPhone) 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Hi, inquiring about your wholesale route offer.')}`
      : null;

    // Multi-line and Compact Text Preview
    const rawText = (m.text || '').trim();
    const normalizedText = rawText.replace(/\n\s*\n+/g, '\n').trim();
    const isComfortable = (streamDensity === 'comfortable');

    let textPreviewHtml = '';
    if (normalizedText) {
      if (isComfortable) {
        textPreviewHtml = `<span class="line-clamp-2 whitespace-pre-line font-mono text-[11px] sm:text-xs text-slate-700 dark:text-slate-200 leading-snug break-words group-hover:text-slate-900 dark:group-hover:text-white transition-colors select-text">${esc(normalizedText)}</span>`;
      } else {
        const singleLineText = normalizedText.replace(/\r?\n+/g, ' • ');
        textPreviewHtml = `<span class="truncate font-mono text-[11px] sm:text-xs text-slate-700 dark:text-slate-200 leading-snug group-hover:text-slate-900 dark:group-hover:text-white transition-colors select-text" title="${esc(normalizedText)}">${esc(singleLineText)}</span>`;
      }
    } else {
      textPreviewHtml = mediaPill ? '' : '<span class="italic text-slate-400 dark:text-slate-600 text-xs">[No text preview]</span>';
    }

    return `
      <div class="table-msg-row flex items-start sm:items-center px-3 sm:px-4 py-2 hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors text-xs gap-2 sm:gap-3 group" ondblclick="openMessageDetailModal('${m.id}')">
        <!-- Col 1: Time & Date (w-20 sm:w-28 shrink-0 select-none) -->
        <div class="w-20 sm:w-28 shrink-0 select-none">
          <div class="font-mono text-[11px] text-slate-800 dark:text-slate-200 font-semibold tracking-tight">${esc(timeStr)}</div>
          ${dateStr ? `<div class="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-tight">${esc(dateStr)}</div>` : ''}
        </div>

        <!-- Col 2: Sender & Chat (w-36 sm:w-48 md:w-56 shrink-0 flex items-center gap-2 min-w-0) -->
        <div class="w-36 sm:w-48 md:w-56 shrink-0 flex items-center gap-2 min-w-0">
          ${avatarHtml}
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 truncate">
              <span class="font-bold truncate text-xs ${isOutbound ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}">
                ${esc(m.sender_name || (isOutbound ? 'You' : (m.sender_phone || 'Carrier')))}
              </span>
            </div>
            <div class="flex items-center gap-1 text-[10px] flex-wrap mt-0.5">
              ${badges.join('')}
              ${m.sender_phone && !isOutbound ? `<span class="text-slate-500 dark:text-slate-400 font-mono text-[10px] truncate">${esc(m.sender_phone)}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Col 3: Message & Attachments (flex-1 min-w-0 pr-3 flex items-start sm:items-center gap-2 select-text) -->
        <div class="flex-1 min-w-0 pr-3 flex items-start sm:items-center gap-2 select-text">
          ${mediaPill}
          ${m.reply_to ? `<span class="shrink-0 text-slate-400 dark:text-slate-500 flex items-center gap-0.5 text-[10px]" title="Quoted reply"><i data-lucide="reply" class="w-2.5 h-2.5"></i></span>` : ''}
          ${textPreviewHtml}
        </div>

        <!-- Col 4: Actions (w-24 sm:w-28 text-right shrink-0 flex items-center justify-end gap-1.5 select-none" onclick="event.stopPropagation()">
        <div class="w-24 sm:w-28 text-right shrink-0 flex items-center justify-end gap-1.5 select-none" onclick="event.stopPropagation()">
          <button onclick="copySingleMessageText('${m.id}', this)" class="p-1 sm:px-2 sm:py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-all text-[11px] flex items-center gap-1 shadow-xs" title="Copy message text">
            <i data-lucide="copy" class="w-3 h-3"></i>
            <span class="hidden sm:inline font-medium">Copy</span>
          </button>
          <button onclick="openMessageDetailModal('${m.id}')" class="px-2 py-1 rounded-lg bg-emerald-600/15 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white font-semibold text-[11px] flex items-center gap-1 shadow-xs transition-all border border-emerald-500/30" title="View verbatim message">
            <i data-lucide="eye" class="w-3 h-3"></i>
            <span>View</span>
          </button>
          ${knockUrl ? `
            <a href="${knockUrl}" target="_blank" class="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-dark-900 dark:hover:bg-dark-800 border border-slate-200 dark:border-dark-700 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title="Chat on WhatsApp">
              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
            </a>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  applyStreamDensity();
  if (window.lucide) lucide.createIcons();

  // Auto-scroll to top of table body if enabled and first page
  if (window.streamAutoScroll && streamPage === 1) {
    const scrollEl = document.getElementById('client-messages-container');
    if (scrollEl && scrollEl.scrollTop > 40) {
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

/**
 * Message Detail Inspector Modal (View full message verbatim with all rich media)
 */
window.openMessageDetailModal = function(msgId) {
  const allMsgs = window.messagesCache || [];
  const m = allMsgs.find(item => String(item.id) === String(msgId));
  const modal = document.getElementById('message-detail-modal');
  if (!m || !modal) return;

  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '');
  const isOutbound = Boolean(m.is_from_me);
  const isArchived = Boolean(m.is_archived);
  const initials = isOutbound ? 'YOU' : (typeof getInitials === 'function' ? getInitials(m.sender_name || m.sender_phone) : 'WA');
  const avatarGradient = isOutbound
    ? 'from-indigo-500 to-purple-700'
    : (typeof getAvatarColor === 'function' ? getAvatarColor(m.sender_phone || m.sender_name) : 'from-emerald-500 to-teal-700');
  const cleanPhone = (m.sender_phone || '').replace(/[^0-9]/g, '');

  // Populate Header
  const idEl = document.getElementById('modal-msg-id');
  if (idEl) idEl.innerText = `ID: ${m.id || '--'}`;

  // Populate Avatar & Sender
  const avatarEl = document.getElementById('modal-msg-avatar');
  if (avatarEl) {
    avatarEl.className = `w-10 h-10 rounded-xl bg-gradient-to-tr ${avatarGradient} flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0`;
    avatarEl.innerText = initials;
  }

  const senderEl = document.getElementById('modal-msg-sender');
  if (senderEl) {
    senderEl.innerText = m.sender_name || (isOutbound ? 'You' : 'Carrier Contact');
  }

  const phoneEl = document.getElementById('modal-msg-phone');
  if (phoneEl) {
    phoneEl.innerText = m.sender_phone ? m.sender_phone : (isOutbound ? 'Your Account' : 'Direct JID');
  }

  const timeEl = document.getElementById('modal-msg-time');
  if (timeEl) {
    timeEl.innerText = typeof formatDateTime === 'function' ? formatDateTime(m.occurred_at || m.timestamp) : (m.timestamp || '');
  }

  // Badges
  const badgesEl = document.getElementById('modal-msg-badges');
  if (badgesEl) {
    const bList = [];
    if (isOutbound) {
      bList.push(`<span class="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-semibold">Sent by You</span>`);
    }
    if (isArchived) {
      bList.push(`<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1"><i data-lucide="archive" class="w-3 h-3"></i><span>Archived Group</span></span>`);
    }
    if (m.chat_type === 'group') {
      bList.push(`<span class="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-semibold flex items-center gap-1"><i data-lucide="users" class="w-3 h-3"></i><span>${esc(m.chat_name || 'Group Chat')}</span></span>`);
    } else if (!isOutbound) {
      bList.push(`<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-semibold">Direct DM</span>`);
    }
    badgesEl.innerHTML = bList.join('');
  }

  // Knock URL
  const knockUrl = (!isOutbound && cleanPhone) 
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Hi, inquiring about your wholesale message.')}`
    : null;

  const knockContainer = document.getElementById('modal-msg-knock-container');
  if (knockContainer) {
    knockContainer.innerHTML = knockUrl ? `
      <a href="${knockUrl}" target="_blank" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-all">
        <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
        <span>Chat on WhatsApp</span>
      </a>
    ` : '';
  }

  const footerChat = document.getElementById('modal-footer-chat-btn');
  if (footerChat) {
    footerChat.innerHTML = knockUrl ? `
      <a href="${knockUrl}" target="_blank" class="btn btn-primary btn-sm flex items-center gap-1.5">
        <i data-lucide="message-circle" class="w-4 h-4"></i>
        <span>Knock Vendor on WhatsApp</span>
      </a>
    ` : '';
  }

  // Quoted reply box
  const replyContext = m.reply_to || m.raw_envelope?.message?.reply_to;
  const replyBox = document.getElementById('modal-msg-reply-container');
  if (replyBox) {
    if (replyContext) {
      replyBox.classList.remove('hidden');
      const qSender = replyContext.senderId
        ? (replyContext.senderId.includes('@s.whatsapp.net') ? '+' + replyContext.senderId.split('@')[0] : replyContext.senderId)
        : 'Message';
      replyBox.innerHTML = `
        <div class="p-3 rounded-xl bg-dark-900 border-l-4 border-emerald-500 text-xs text-slate-300 space-y-1">
          <div class="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
            <i data-lucide="reply" class="w-3.5 h-3.5"></i>
            <span>In Reply to ${esc(qSender)}</span>
          </div>
          ${replyContext.quotedText ? `<div class="italic text-slate-400 whitespace-pre-wrap">${esc(replyContext.quotedText)}</div>` : ''}
        </div>
      `;
    } else {
      replyBox.classList.add('hidden');
      replyBox.innerHTML = '';
    }
  }

  // Rich Media Attachments
  const mediaContainer = document.getElementById('modal-msg-media-container');
  const mediaObj = m.media || m.raw_envelope?.message?.media;
  const mediaType = mediaObj?.type ||
    (m.raw_envelope?.message?.raw_payload?.message?.imageMessage ? 'image' :
     m.raw_envelope?.message?.raw_payload?.message?.videoMessage ? 'video' :
     m.raw_envelope?.message?.raw_payload?.message?.audioMessage ? 'audio' :
     m.raw_envelope?.message?.raw_payload?.message?.documentMessage ? 'document' :
     (m.has_media ? 'image' : null));

  if (mediaContainer) {
    if (mediaType === 'audio') {
      mediaContainer.classList.remove('hidden');
      const durationSec = mediaObj?.durationSeconds;
      const durationText = durationSec ? `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}` : 'Voice Note';
      mediaContainer.innerHTML = `
        <div class="p-3.5 rounded-xl bg-dark-950 border border-dark-800 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-bold text-slate-200">
              <i data-lucide="mic" class="w-4 h-4 text-purple-400"></i>
              <span>${mediaObj?.isVoiceNote ? 'Voice Audio Note' : 'Audio Message'}</span>
            </div>
            <span class="text-xs font-mono text-purple-400">${durationText}</span>
          </div>
          ${m.media_id ? `
            <audio controls src="/api/media/${m.media_id}" class="w-full h-8 mt-1"></audio>
          ` : `
            <div class="p-2 rounded-lg bg-dark-900 text-xs text-slate-400 flex items-center gap-2">
              <i data-lucide="info" class="w-3.5 h-3.5 text-purple-400"></i>
              <span>Audio file recorded on WhatsApp (Duration: ${durationText})</span>
            </div>
          `}
        </div>
      `;
    } else if (mediaType === 'document') {
      mediaContainer.classList.remove('hidden');
      const docName = mediaObj?.fileName || 'ratesheet_document';
      const docSize = mediaObj?.fileSize
        ? (mediaObj.fileSize > 1048576 ? `${(mediaObj.fileSize / 1048576).toFixed(1)} MB` : `${Math.round(mediaObj.fileSize / 1024)} KB`)
        : 'File attachment';
      mediaContainer.innerHTML = `
        <div class="p-3.5 rounded-xl bg-dark-950 border border-dark-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-200 truncate">${esc(docName)}</div>
              <div class="text-[11px] text-slate-400 font-mono mt-0.5">${esc(docSize)} • Rate Sheet</div>
            </div>
          </div>
          ${m.media_id ? `
            <a href="/api/media/${m.media_id}" target="_blank" download class="btn btn-secondary btn-sm flex items-center gap-1.5 shrink-0">
              <i data-lucide="download" class="w-3.5 h-3.5"></i>
              <span>Download File</span>
            </a>
          ` : ''}
        </div>
      `;
    } else if (m.contact || mediaType === 'contact') {
      mediaContainer.classList.remove('hidden');
      const c = m.contact || {};
      const cClean = (c.phone || '').replace(/[^0-9]/g, '');
      const cKnock = cClean ? `https://wa.me/${cClean}` : null;
      mediaContainer.innerHTML = `
        <div class="p-3.5 rounded-xl bg-dark-950 border border-dark-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <i data-lucide="user-check" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-200 truncate">${esc(c.name || 'Shared Contact')}</div>
              <div class="text-[11px] font-mono text-emerald-400 mt-0.5">${esc(c.phone || 'Phone number attached')}</div>
            </div>
          </div>
          ${cKnock ? `
            <a href="${cKnock}" target="_blank" class="btn btn-primary btn-sm flex items-center gap-1.5 shrink-0">
              <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
              <span>Knock Contact</span>
            </a>
          ` : ''}
        </div>
      `;
    } else if (m.location || mediaType === 'location') {
      mediaContainer.classList.remove('hidden');
      const loc = m.location || {};
      const mapUrl = `https://maps.google.com/?q=${loc.latitude || 0},${loc.longitude || 0}`;
      mediaContainer.innerHTML = `
        <div class="p-3.5 rounded-xl bg-dark-950 border border-dark-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <i data-lucide="map-pin" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-slate-200 truncate">${esc(loc.name || 'Shared Location')}</div>
              <div class="text-[11px] text-slate-400 font-mono mt-0.5">${loc.latitude ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : 'Coordinates'}</div>
            </div>
          </div>
          <a href="${mapUrl}" target="_blank" class="btn btn-secondary btn-sm flex items-center gap-1.5 shrink-0">
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            <span>Google Maps</span>
          </a>
        </div>
      `;
    } else {
      mediaContainer.classList.add('hidden');
      mediaContainer.innerHTML = '';
    }
  }

  // Verbatim message text
  const textEl = document.getElementById('modal-msg-text');
  if (textEl) {
    textEl.innerText = m.text || '[No text content]';
  }

  // Raw JSON
  const rawEl = document.getElementById('modal-msg-raw-json');
  if (rawEl) {
    rawEl.innerText = JSON.stringify(m.raw_envelope || m, null, 2);
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
};

window.closeMessageDetailModal = function() {
  const modal = document.getElementById('message-detail-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  // Pause any audio playing inside the modal
  const audios = modal.querySelectorAll('audio');
  audios.forEach(a => { try { a.pause(); } catch {} });
};

window.copyModalMessageText = function() {
  const textEl = document.getElementById('modal-msg-text');
  const labelEl = document.getElementById('label-modal-copy-text');
  if (!textEl) return;
  const text = textEl.innerText;
  navigator.clipboard.writeText(text).then(() => {
    if (labelEl) {
      const orig = labelEl.innerText;
      labelEl.innerText = 'Copied!';
      setTimeout(() => { labelEl.innerText = orig; }, 2000);
    }
    if (typeof showToast === 'function') showToast('Message text copied to clipboard', 'success');
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Failed to copy text', 'error');
  });
};

window.copyModalRawJson = function() {
  const rawEl = document.getElementById('modal-msg-raw-json');
  if (!rawEl) return;
  navigator.clipboard.writeText(rawEl.innerText).then(() => {
    if (typeof showToast === 'function') showToast('Raw JSON copied to clipboard', 'success');
  });
};

// Global escape key listener for detail modal
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('message-detail-modal');
    if (modal && !modal.classList.contains('hidden')) {
      window.closeMessageDetailModal();
    }
  }
});

function toggleStreamAutoScroll() {
  window.streamAutoScroll = !window.streamAutoScroll;
  const label = document.getElementById('label-stream-autoscroll');
  const btn = document.getElementById('btn-stream-autoscroll');
  if (label) label.innerText = window.streamAutoScroll ? 'Auto-Scroll' : 'Scroll: OFF';
  if (btn) {
    btn.className = window.streamAutoScroll
      ? 'px-3 py-1.5 rounded-xl bg-dark-900 border border-dark-700 text-xs text-emerald-400 hover:text-white flex items-center gap-1.5 transition-all'
      : 'px-3 py-1.5 rounded-xl bg-dark-900 border border-dark-700 text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-all';
  }
}

function exportMessagesCsv() {
  const msgs = window.messagesCache || [];
  if (!msgs.length) {
    if (typeof showToast === 'function') showToast('No messages in buffer to export', 'info');
    return;
  }
  const escCsv = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
  let csv = 'Message ID,Date,Chat Name,Chat Type,Sender Name,Sender Phone,Message Text,Has Media\r\n';
  for (const m of msgs) {
    csv += `${escCsv(m.id)},${escCsv(m.occurred_at || m.timestamp)},${escCsv(m.chat_name)},${escCsv(m.chat_type)},${escCsv(m.sender_name)},${escCsv(m.sender_phone)},${escCsv(m.text)},${escCsv(m.has_media ? 'YES' : 'NO')}\r\n`;
  }
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `whatsapp_messages_stream_${new Date().toISOString().slice(0, 10)}.csv`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMessagesJson() {
  const msgs = window.messagesCache || [];
  if (!msgs.length) {
    if (typeof showToast === 'function') showToast('No messages in buffer to export', 'info');
    return;
  }
  const blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `whatsapp_messages_stream_${new Date().toISOString().slice(0, 10)}.json`;
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Stream Density Handlers (Compact vs Comfortable)
 */
let streamDensity = localStorage.getItem('wapp_stream_density') || 'compact';

function setStreamDensity(mode) {
  streamDensity = mode;
  localStorage.setItem('wapp_stream_density', mode);
  applyStreamDensity();
  renderClientFeed();
}

function applyStreamDensity() {
  const container = document.getElementById('client-messages-container');
  const btnCompact = document.getElementById('btn-stream-density-compact');
  const btnComfortable = document.getElementById('btn-stream-density-comfortable');

  if (container) {
    if (streamDensity === 'compact') {
      container.classList.add('density-compact');
      container.classList.remove('density-comfortable');
    } else {
      container.classList.remove('density-compact');
      container.classList.add('density-comfortable');
    }
  }

  if (btnCompact && btnComfortable) {
    if (streamDensity === 'compact') {
      btnCompact.className = 'p-1.5 px-2.5 rounded-lg text-white bg-emerald-600 transition-all text-xs flex items-center gap-1 font-semibold';
      btnComfortable.className = 'p-1.5 px-2.5 rounded-lg text-slate-400 hover:text-white transition-all text-xs flex items-center gap-1';
    } else {
      btnComfortable.className = 'p-1.5 px-2.5 rounded-lg text-white bg-emerald-600 transition-all text-xs flex items-center gap-1 font-semibold';
      btnCompact.className = 'p-1.5 px-2.5 rounded-lg text-slate-400 hover:text-white transition-all text-xs flex items-center gap-1';
    }
  }
}

/**
 * Stream Pagination Handlers
 */
function setStreamPageSize(size) {
  streamPageSize = parseInt(size, 10);
  streamPage = 1;
  localStorage.setItem('wapp_stream_page_size', streamPageSize);
  document.querySelectorAll('.btn-stream-size').forEach(btn => {
    if (parseInt(btn.getAttribute('data-size'), 10) === streamPageSize) {
      btn.className = 'btn-stream-size px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold transition-all font-mono shadow-xs';
    } else {
      btn.className = 'btn-stream-size px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all font-mono';
    }
  });
  renderClientFeed();
}

function changeStreamPage(delta) {
  if (streamPageSize <= 0) return;
  const maxPages = Math.max(1, Math.ceil(streamTotalCount / streamPageSize));
  const newPage = streamPage + delta;
  if (newPage >= 1 && newPage <= maxPages) {
    streamPage = newPage;
    renderClientFeed();
  }
}

function updateStreamPaginationUI(total) {
  const startEl = document.getElementById('stream-page-start');
  const endEl = document.getElementById('stream-page-end');
  const totalEl = document.getElementById('stream-page-total');
  const currEl = document.getElementById('stream-current-page');
  const totalPagesEl = document.getElementById('stream-total-pages');
  const prevBtn = document.getElementById('btn-stream-prev');
  const nextBtn = document.getElementById('btn-stream-next');

  if (streamPageSize <= 0) {
    const sVal = total > 0 ? 1 : 0;
    if (startEl) startEl.textContent = String(sVal);
    if (endEl) endEl.textContent = String(total);
    if (totalEl) totalEl.textContent = String(total);
    if (currEl) currEl.textContent = '1';
    if (totalPagesEl) totalPagesEl.textContent = '1';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
  } else {
    const maxPages = Math.max(1, Math.ceil(total / streamPageSize));
    if (streamPage > maxPages) streamPage = maxPages;
    if (streamPage < 1) streamPage = 1;

    const start = total === 0 ? 0 : (streamPage - 1) * streamPageSize + 1;
    const end = Math.min(streamPage * streamPageSize, total);

    if (startEl) startEl.textContent = String(start);
    if (endEl) endEl.textContent = String(end);
    if (totalEl) totalEl.textContent = String(total);
    if (currEl) currEl.textContent = String(streamPage);
    if (totalPagesEl) totalPagesEl.textContent = String(maxPages);

    if (prevBtn) prevBtn.disabled = (streamPage <= 1);
    if (nextBtn) nextBtn.disabled = (streamPage >= maxPages);
  }

  document.querySelectorAll('.btn-stream-size').forEach(btn => {
    const s = parseInt(btn.getAttribute('data-size'), 10);
    if (s === streamPageSize) {
      btn.className = 'btn-stream-size px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold transition-all font-mono shadow-xs';
    } else {
      btn.className = 'btn-stream-size px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all font-mono';
    }
  });
}

/**
 * Permanent Stream Purge Handlers
 */
function openPurgeStreamModal() {
  const modal = document.getElementById('modal-purge-stream');
  if (modal) {
    if (window.initWindow) window.initWindow(modal);
    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
  }
}

function closePurgeStreamModal() {
  const modal = document.getElementById('modal-purge-stream');
  if (modal) modal.classList.add('hidden');
  if (window.removeDockPill) window.removeDockPill('modal-purge-stream');
}

async function confirmPurgeStream() {
  try {
    const btn = document.getElementById('btn-confirm-purge-stream');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Purging...</span>';
    }

    const res = await fetch('/api/messages/purge', { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    window.messagesCache = [];
    closePurgeStreamModal();
    renderClientFeed();

    if (typeof showToast === 'function') {
      showToast('Raw WhatsApp stream wiped. All business routes & vendor contacts preserved!', 'success');
    }
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Failed to purge stream: ${err.message}`, 'error');
    }
  } finally {
    const btn = document.getElementById('btn-confirm-purge-stream');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i><span>Permanently Wipe Raw Stream</span>';
    }
    if (window.lucide) lucide.createIcons();
  }
}

// Global stream helpers
function clearClientFeedFilters() {
  const searchInput = document.getElementById('client-search-input');
  const filterType = document.getElementById('client-filter-type');
  if (searchInput) searchInput.value = '';
  if (filterType) filterType.value = 'all';
  renderClientFeed();
}

function copySingleMessageText(msgId, btn) {
  const allMsgs = window.messagesCache || [];
  const m = allMsgs.find(item => String(item.id) === String(msgId));
  if (!m || !m.text) {
    if (typeof showToast === 'function') showToast('No text in this message to copy', 'info');
    return;
  }
  navigator.clipboard.writeText(m.text).then(() => {
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = '<i data-lucide="check" class="w-3 h-3 text-emerald-400"></i><span class="hidden sm:inline text-emerald-400 font-medium">Copied</span>';
      if (window.lucide) lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = origHtml;
        if (window.lucide) lucide.createIcons();
      }, 1500);
    }
    if (typeof showToast === 'function') showToast('Message text copied to clipboard', 'success');
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Failed to copy message text', 'error');
  });
}

async function injectTestMessage() {
  try {
    if (typeof showToast === 'function') showToast('Injecting test wholesale rate ping...', 'info');
    const samplePings = [
      {
        sender_name: 'Apex Telecom Global',
        sender_phone: '+44 7700 900142',
        chat_type: 'group',
        chat_name: 'Wholesale Voice Traders BD & UK',
        text: '🔥 HOT BUYING OFFER - VOICE WHOLESALE 🔥\nBD Mobile 88017 / 88019: $0.0215 (ACD 4+, ASR 45%)\nUK Mobile 447: $0.0125 Direct Pure CLI\nUSA CC Flat: $0.0068\nPayment: Weekly USDT or Wire. Send stats now!'
      },
      {
        sender_name: 'FastRoute Carrier Desk',
        sender_phone: '+1 202 555 0198',
        chat_type: 'group',
        chat_name: 'Asia Voice Hub',
        text: 'DIRECT CLI ROUTES AVAILABLE:\nPakistan Jazz 92300: $0.0180 (120 Ports)\nIndia Airtel 9198: $0.0092 FAS Free Clean\nEgypt Vodafone: $0.0850 Stable Daily Volume'
      },
      {
        sender_name: 'Direct Line Trader',
        sender_phone: '+65 6789 0123',
        chat_type: 'direct',
        chat_name: 'Direct Conversation',
        text: 'Hello desk, need urgent route for Philippines Globe & Smart.\nTarget rate: $0.0450. Daily 60k minutes ready to send today.'
      }
    ];
    const ping = samplePings[Math.floor(Math.random() * samplePings.length)];
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ping)
    });
    if (res.ok) {
      if (typeof showToast === 'function') showToast('Test rate message injected successfully!', 'success');
      if (typeof fetchMessages === 'function') await fetchMessages();
      renderClientFeed();
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast(`Simulation failed: ${err.message}`, 'error');
  }
}

// Global exports
window.renderClientFeed = renderClientFeed;
window.clearClientFeedFilters = clearClientFeedFilters;
window.copySingleMessageText = copySingleMessageText;
window.injectTestMessage = injectTestMessage;
window.openMessageDetailModal = openMessageDetailModal;
window.closeMessageDetailModal = closeMessageDetailModal;
window.copyModalMessageText = copyModalMessageText;
window.copyModalRawJson = copyModalRawJson;
window.toggleRawEnvelope = toggleRawEnvelope;
window.toggleStreamAutoScroll = toggleStreamAutoScroll;
window.exportMessagesCsv = exportMessagesCsv;
window.exportMessagesJson = exportMessagesJson;
window.setStreamPageSize = setStreamPageSize;
window.changeStreamPage = changeStreamPage;
window.openPurgeStreamModal = openPurgeStreamModal;
window.closePurgeStreamModal = closePurgeStreamModal;
window.confirmPurgeStream = confirmPurgeStream;
window.setStreamDensity = setStreamDensity;


