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
  const sendersEl = document.getElementById('stat-senders-streamed');
  const streamBadge = document.getElementById('stream-count-badge');

  if (totalEl) totalEl.innerText = allMsgs.length;
  if (streamBadge) streamBadge.innerText = allMsgs.length;
  if (groupsEl) {
    const uniqueGroups = new Set(allMsgs.filter(m => m.chat_type === 'group').map(m => m.chat_name || m.chat_jid));
    groupsEl.innerText = uniqueGroups.size;
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
    if (filterType === 'group' && m.chat_type !== 'group') return false;
    if (filterType === 'direct' && m.chat_type !== 'direct') return false;
    if (filterType === 'media' && !m.has_media) return false;

    if (!searchQuery) return true;
    const haystack = [m.text, m.sender_name, m.sender_phone, m.chat_name].join(' ').toLowerCase();
    return haystack.includes(searchQuery);
  });

  streamTotalCount = filtered.length;
  updateStreamPaginationUI(streamTotalCount);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="glass-card rounded-2xl p-12 text-center border border-dashed border-dark-700">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-dark-900 border border-dark-700 flex items-center justify-center text-slate-500 mb-3">
          <i data-lucide="radio" class="w-6 h-6 text-emerald-400"></i>
        </div>
        <h4 class="text-sm font-semibold text-white">No messages matched stream filter</h4>
        <p class="text-xs text-slate-400 mt-1">Live incoming WhatsApp messages from connected groups will stream here in real-time.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Sliced page messages
  let pageMessages = filtered;
  if (streamPageSize > 0) {
    const startIdx = (streamPage - 1) * streamPageSize;
    pageMessages = filtered.slice(startIdx, startIdx + streamPageSize);
  }

  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '');

  container.innerHTML = pageMessages.map(m => {
    const initials = typeof getInitials === 'function' ? getInitials(m.sender_name || m.sender_phone) : 'WA';
    const avatarGradient = typeof getAvatarColor === 'function' ? getAvatarColor(m.sender_phone || m.sender_name) : 'from-emerald-500 to-teal-700';
    const isGroup = m.chat_type === 'group';
    const formattedTime = typeof formatDateTime === 'function' ? formatDateTime(m.occurred_at || m.timestamp) : (m.timestamp || '');
    const cleanPhone = (m.sender_phone || '').replace(/[^0-9]/g, '');

    const avatarUrl = m.sender_avatar_url || m.avatar_url;
    const avatarHtml = avatarUrl
      ? `<div class="msg-avatar relative w-7 h-7 sm:w-8 sm:h-8 shrink-0">
          <img src="${esc(avatarUrl)}" alt="${esc(initials)}" class="w-full h-full rounded-lg object-cover shadow-sm border border-dark-700/80" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="w-full h-full rounded-lg bg-gradient-to-tr ${avatarGradient} items-center justify-center text-white font-bold text-[10px] shadow-sm" style="display:none;">${esc(initials)}</div>
         </div>`
      : `<div class="msg-avatar w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr ${avatarGradient} flex items-center justify-center text-white font-bold text-[10px] shadow-sm shrink-0">${esc(initials)}</div>`;

    const mediaType = m.raw_envelope?.message?.media?.type ||
      (m.raw_envelope?.message?.raw_payload?.message?.imageMessage ? 'image' :
       m.raw_envelope?.message?.raw_payload?.message?.videoMessage ? 'video' :
       m.raw_envelope?.message?.raw_payload?.message?.audioMessage ? 'audio' :
       m.raw_envelope?.message?.raw_payload?.message?.documentMessage ? 'document' :
       (m.has_media ? 'image' : null));

    const knockUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Hi, inquiring about your wholesale route offer.')}`
      : null;

    return `
      <div class="glass-card rounded-xl p-2.5 sm:p-3 border border-dark-700/70 hover:border-emerald-500/30 transition-all shadow-sm group">
        <div class="flex items-start gap-2.5 sm:gap-3">
          ${avatarHtml}

          <div class="flex-1 min-w-0 space-y-1.5">
            <!-- Header Row -->
            <div class="msg-header flex flex-wrap items-center justify-between gap-1.5">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-tight leading-none">${esc(m.sender_name || 'Carrier Contact')}</span>
                ${m.sender_phone ? `
                  <span class="msg-badge px-1.5 py-0.5 rounded bg-dark-950 border border-dark-700 text-slate-300 font-mono text-[10px]">
                    ${esc(m.sender_phone)}
                  </span>
                ` : ''}
                ${isGroup ? `
                  <span class="msg-badge px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 dark:text-sky-300 text-[10px] font-medium flex items-center gap-1">
                    <i data-lucide="users" class="w-2.5 h-2.5"></i>
                    <span class="truncate max-w-[180px]">${esc(m.chat_name || 'Group Chat')}</span>
                  </span>
                ` : `
                  <span class="msg-badge px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 dark:text-emerald-300 text-[10px] font-medium">Direct DM</span>
                `}
              </div>

              <div class="flex items-center gap-2 text-slate-400 text-[11px]">
                <span>${esc(formattedTime)}</span>
                ${knockUrl ? `
                  <a href="${knockUrl}" target="_blank" class="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[10px] flex items-center gap-1 shadow-sm transition-all" title="Message on WhatsApp">
                    <i data-lucide="message-circle" class="w-3 h-3"></i>
                    <span>Knock</span>
                  </a>
                ` : ''}
              </div>
            </div>

            <!-- Message Body -->
            <div class="msg-body p-2 px-2.5 rounded-lg bg-dark-950/70 border border-dark-800/80 text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap break-words selection:bg-emerald-500 selection:text-white">
              ${esc(m.text || '')}
            </div>

            <!-- Media Preview if Available -->
            ${m.has_media ? `
              <div class="flex items-center gap-2 pt-0.5">
                <span class="px-2 py-0.5 rounded bg-dark-900 border border-dark-700 text-[10px] text-slate-300 flex items-center gap-1">
                  <i data-lucide="${mediaType === 'image' ? 'image' : mediaType === 'video' ? 'video' : 'paperclip'}" class="w-3 h-3 text-emerald-400"></i>
                  <span class="capitalize">${mediaType || 'Media'}</span>
                </span>
                ${m.media_id ? `
                  <a href="/api/media/${m.media_id}" target="_blank" class="text-[11px] text-emerald-400 hover:underline flex items-center gap-1">
                    <span>View Media</span>
                    <i data-lucide="external-link" class="w-2.5 h-2.5"></i>
                  </a>
                ` : ''}
              </div>
            ` : ''}

            <!-- Bottom Metadata & Raw Inspector -->
            <div class="msg-footer flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
              <span class="font-mono">ID: ${esc(m.id || '--')}</span>
              <button onclick="toggleRawEnvelope('${m.id}')" class="hover:text-slate-300 flex items-center gap-1 transition-colors">
                <i data-lucide="code" class="w-3 h-3"></i>
                <span>Raw Envelope</span>
              </button>
            </div>

            <!-- Expandable Raw Envelope JSON -->
            <div id="raw-env-${m.id}" class="hidden p-2 rounded-lg bg-dark-950 border border-dark-800 text-[10px] text-slate-400 font-mono overflow-x-auto max-h-60">
              <pre>${esc(JSON.stringify(m.raw_envelope || m, null, 2))}</pre>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  applyStreamDensity();
  if (window.lucide) lucide.createIcons();

  // Auto-scroll to top if enabled and first page
  if (window.streamAutoScroll && streamPage === 1) {
    const scrollEl = document.getElementById('main-content-scroll');
    if (scrollEl && scrollEl.scrollTop > 60) {
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

function toggleRawEnvelope(msgId) {
  const el = document.getElementById('raw-env-' + msgId);
  if (el) el.classList.toggle('hidden');
  if (window.lucide) lucide.createIcons();
}

function toggleStreamAutoScroll() {
  window.streamAutoScroll = !window.streamAutoScroll;
  const label = document.getElementById('label-stream-autoscroll');
  const btn = document.getElementById('btn-stream-autoscroll');
  if (label) label.innerText = window.streamAutoScroll ? 'Auto-Scroll: ON' : 'Auto-Scroll: OFF';
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
      btn.className = 'btn-stream-size px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold transition-all font-mono';
    } else {
      btn.className = 'btn-stream-size px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all font-mono';
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
    if (startEl) startEl.innerText = total > 0 ? 1 : 0;
    if (endEl) endEl.innerText = total;
    if (totalEl) totalEl.innerText = total;
    if (currEl) currEl.innerText = 1;
    if (totalPagesEl) totalPagesEl.innerText = 1;
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const maxPages = Math.max(1, Math.ceil(total / streamPageSize));
  if (streamPage > maxPages) streamPage = maxPages;

  const start = total === 0 ? 0 : (streamPage - 1) * streamPageSize + 1;
  const end = Math.min(streamPage * streamPageSize, total);

  if (startEl) startEl.innerText = start;
  if (endEl) endEl.innerText = end;
  if (totalEl) totalEl.innerText = total;
  if (currEl) currEl.innerText = streamPage;
  if (totalPagesEl) totalPagesEl.innerText = maxPages;

  if (prevBtn) prevBtn.disabled = (streamPage <= 1);
  if (nextBtn) nextBtn.disabled = (streamPage >= maxPages);

  document.querySelectorAll('.btn-stream-size').forEach(btn => {
    const s = parseInt(btn.getAttribute('data-size'), 10);
    if (s === streamPageSize) {
      btn.className = 'btn-stream-size px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold transition-all font-mono';
    } else {
      btn.className = 'btn-stream-size px-2.5 py-1 rounded-lg text-slate-400 hover:text-white transition-all font-mono';
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

// Global exports
window.renderClientFeed = renderClientFeed;
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
