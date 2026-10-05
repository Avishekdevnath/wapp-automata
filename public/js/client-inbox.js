/**
 * Client Inbox Module: Live WhatsApp Messages Stream (Zero Loss)
 */
window.streamAutoScroll = true;

function renderClientFeed() {
  const container = document.getElementById('client-messages-container') || document.getElementById('client-messages-feed');
  if (!container) return;

  const allMsgs = window.messagesCache || [];

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
    // Hide internal protocol messages with no content
    if (!m.text && !m.has_media) return false;

    if (filterType === 'group' && m.chat_type !== 'group') return false;
    if (filterType === 'direct' && m.chat_type !== 'direct') return false;
    if (filterType === 'media' && !m.has_media) return false;

    if (!searchQuery) return true;
    const haystack = [m.text, m.sender_name, m.sender_phone, m.chat_name].join(' ').toLowerCase();
    return haystack.includes(searchQuery);
  });

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

  const esc = typeof escapeHtml === 'function' ? escapeHtml : (s) => String(s || '');

  container.innerHTML = filtered.map(m => {
    const initials = typeof getInitials === 'function' ? getInitials(m.sender_name || m.sender_phone) : 'WA';
    const avatarGradient = typeof getAvatarColor === 'function' ? getAvatarColor(m.sender_phone || m.sender_name) : 'from-emerald-500 to-teal-700';
    const isGroup = m.chat_type === 'group';
    const formattedTime = typeof formatDateTime === 'function' ? formatDateTime(m.occurred_at || m.timestamp) : (m.timestamp || '');
    const cleanPhone = (m.sender_phone || '').replace(/[^0-9]/g, '');

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
      <div class="glass-card rounded-2xl p-4 sm:p-5 border border-dark-700/70 hover:border-emerald-500/30 transition-all shadow-md group">
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr ${avatarGradient} flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0">
            ${esc(initials)}
          </div>

          <div class="flex-1 min-w-0 space-y-2.5">
            <!-- Header Row -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-bold text-white tracking-tight">${esc(m.sender_name || 'Carrier Contact')}</span>
                ${m.sender_phone ? `
                  <span class="px-2 py-0.5 rounded-full bg-dark-950 border border-dark-700 text-slate-300 font-mono text-[11px]">
                    ${esc(m.sender_phone)}
                  </span>
                ` : ''}
                ${isGroup ? `
                  <span class="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-medium flex items-center gap-1">
                    <i data-lucide="users" class="w-3 h-3"></i>
                    <span>${esc(m.chat_name || 'Group Chat')}</span>
                  </span>
                ` : `
                  <span class="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-medium flex items-center gap-1">
                    <i data-lucide="user" class="w-3 h-3"></i>
                    <span>Direct Message</span>
                  </span>
                `}
              </div>

              <!-- Right: Timestamp & Actions -->
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-slate-400 font-mono">${esc(formattedTime)}</span>
                ${knockUrl ? `
                  <a href="${knockUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-sm">
                    <i data-lucide="send" class="w-3 h-3"></i>
                    <span>Knock</span>
                  </a>
                ` : ''}
              </div>
            </div>

            <!-- Message Text Content -->
            ${m.text ? `
              <div class="text-xs text-slate-200 bg-dark-950/90 p-3.5 rounded-xl border border-dark-800/80 leading-relaxed font-sans whitespace-pre-wrap break-words select-text">
                ${esc(m.text)}
              </div>
            ` : ''}

            <!-- Media Preview Block -->
            ${m.has_media ? `
              <div class="mt-2">
                ${(mediaType === 'image' || mediaType === 'sticker') ? `
                  <div class="rounded-2xl overflow-hidden border border-dark-700/80 bg-dark-950 max-w-sm shadow-xl">
                    <a href="/api/media/${m.id}" target="_blank" title="Click to view full image" class="block group/img relative cursor-pointer">
                      <img 
                        src="/api/media/${m.id}" 
                        alt="WhatsApp Media" 
                        loading="lazy" 
                        class="w-full max-h-80 object-cover rounded-xl transition-all group-hover/img:scale-[1.01]"
                        onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'p-3 text-xs text-slate-400 flex items-center gap-2\\'><i data-lucide=\\'image-off\\' class=\\'w-4 h-4 text-slate-500\\'></i><span>Image preview unavailable</span></div>'; if (window.lucide) lucide.createIcons();"
                      />
                      <div class="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-dark-950/90 text-[10px] text-slate-200 border border-dark-700/80 flex items-center gap-1.5 backdrop-blur-md opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <i data-lucide="maximize-2" class="w-3 h-3 text-emerald-400"></i>
                        <span>Full Resolution</span>
                      </div>
                    </a>
                  </div>
                ` : mediaType === 'audio' ? `
                  <div class="p-3 rounded-2xl border border-dark-700/80 bg-dark-950/90 max-w-sm flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <i data-lucide="mic" class="w-4 h-4"></i>
                    </div>
                    <audio controls src="/api/media/${m.id}" class="w-full h-8"></audio>
                  </div>
                ` : mediaType === 'video' ? `
                  <div class="rounded-2xl overflow-hidden border border-dark-700/80 bg-dark-950 max-w-sm shadow-xl">
                    <video controls src="/api/media/${m.id}" class="w-full max-h-80 rounded-xl bg-black"></video>
                  </div>
                ` : `
                  <div class="p-3 rounded-2xl border border-dark-700/80 bg-dark-950 max-w-sm flex items-center justify-between gap-3 shadow-md">
                    <div class="flex items-center gap-2.5 text-xs text-slate-200 truncate min-w-0">
                      <i data-lucide="file-text" class="w-5 h-5 text-emerald-400 shrink-0"></i>
                      <span class="truncate font-medium">${esc(m.raw_envelope?.message?.media?.fileName || 'Document File')}</span>
                    </div>
                    <a href="/api/media/${m.id}" download class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium shrink-0 flex items-center gap-1.5 transition-colors shadow-sm">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                      <span>Download</span>
                    </a>
                  </div>
                `}
              </div>
            ` : ''}

            <!-- Footer: Message ID & Raw Payload Toggle -->
            <div class="flex items-center justify-between text-[10px] text-slate-500 pt-1">
              <span class="font-mono">ID: ${esc(m.id)}</span>
              <button onclick="toggleRawEnvelope('${m.id}')" class="text-slate-400 hover:text-emerald-400 flex items-center gap-1 transition-colors">
                <i data-lucide="code" class="w-3 h-3"></i>
                <span>Raw Payload</span>
              </button>
            </div>

            <!-- Collapsible Raw JSON Envelope -->
            <div id="raw-env-${m.id}" class="hidden pt-2">
              <pre class="bg-dark-950 p-3 rounded-xl text-[10px] text-slate-400 font-mono overflow-x-auto border border-dark-800/80 max-h-60 leading-normal">${esc(JSON.stringify(m.raw_envelope || m, null, 2))}</pre>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();

  // Auto-scroll to top of stream if enabled and new message arrived
  if (window.streamAutoScroll && container) {
    // Keep user's scroll position or smooth scroll
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

// Global exports
window.renderClientFeed = renderClientFeed;
window.toggleRawEnvelope = toggleRawEnvelope;
window.toggleStreamAutoScroll = toggleStreamAutoScroll;
window.exportMessagesCsv = exportMessagesCsv;
