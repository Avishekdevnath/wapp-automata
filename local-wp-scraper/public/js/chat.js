// App State
    let activeView = 'chats'; // 'chats' | 'stream'
    let currentChatFilter = 'all'; // 'all' | 'groups' | 'dms'
    let currentStreamFilter = 'all';
    let chatSearchQuery = '';
    let streamSearchQuery = '';
    let msgSearchQuery = '';
    let activeChatJid = null;
    let activeChatMeta = null;

    let chatsCache = [];
    let currentChatMessages = [];
    let streamMessages = [];
    let allStats = { total: 0, groups: 0, dms: 0, senders: 0 };

    // Deterministic color palette for group senders (like WhatsApp Web)
    const SENDER_COLORS = [
      '#38bdf8', '#ec4899', '#34d399', '#f59e0b',
      '#a78bfa', '#06b6d4', '#f97316', '#fb7185',
      '#2dd4bf', '#818cf8', '#e879f9', '#4ade80'
    ];
    function getSenderColor(identifier) {
      if (!identifier) return '#94a3b8';
      let hash = 0;
      for (let i = 0; i < identifier.length; i++) {
        hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
      }
      return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
    }

    // 1. Navigation & View Switcher
    function switchView(view) {
      activeView = view;
      document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-container').forEach(c => c.classList.remove('active'));

      if (view === 'chats') {
        document.getElementById('tab-chat-view').classList.add('active');
        document.getElementById('view-chats').classList.add('active');
        if (chatsCache.length === 0) loadChatsList();
      } else if (view === 'stream') {
        document.getElementById('tab-stream-view').classList.add('active');
        document.getElementById('view-stream').classList.add('active');
        loadStreamMessages();
      }
    }

    function toggleSessionDrawer() {
      const drawer = document.getElementById('session-drawer');
      const btn = document.getElementById('tab-session-toggle');
      if (drawer.style.display === 'block') {
        drawer.style.display = 'none';
        btn.classList.remove('active');
      } else {
        drawer.style.display = 'block';
        btn.classList.add('active');
      }
    }

    // 2. Server-Sent Events (SSE) Stream
    function initSSEStream() {
      const es = new EventSource('/api/stream');

      es.onopen = () => {
        const ind = document.getElementById('live-indicator');
        ind.className = 'badge badge-connected';
        document.getElementById('live-text').innerText = 'Live SSE Active';
      };

      es.onerror = () => {
        const ind = document.getElementById('live-indicator');
        ind.className = 'badge badge-disconnected';
        document.getElementById('live-text').innerText = 'Reconnecting...';
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'status') {
            updateStatusUI(payload.data);
          } else if (payload.type === 'message') {
            handleIncomingLiveMessage(payload.data);
          } else if (payload.type === 'message_edited') {
            handleLiveMessageEdited(payload.data);
          } else if (payload.type === 'message_deleted') {
            handleLiveMessageDeleted(payload.data);
          } else if (payload.type === 'cleared') {
            chatsCache = [];
            currentChatMessages = [];
            streamMessages = [];
            renderChatsList();
            if (activeChatJid) selectChat(activeChatJid);
            renderStreamTable();
            loadStatus();
          } else if (payload.type === 'chat_cleared') {
            if (activeChatJid === payload.data?.remoteJid) {
              currentChatMessages = [];
              renderChatMessages();
            }
            loadChatsList();
          } else if (payload.type === 'gap_detected') {
            const gap = payload.data;
            console.warn(`⚠️ Offline gap of ~${gap.gapMinutes} mins detected. Auto catch-up initiated.`);
            const badge = document.getElementById('sidebar-live-text');
            if (badge) badge.innerText = `Catching up (${gap.gapMinutes}m gap)...`;
          } else if (payload.type === 'history_synced') {
            const count = payload.data?.count || 0;
            console.log(`✅ Synced ${count} historical messages from WhatsApp phone.`);
            loadChatsList();
            if (activeChatJid) selectChat(activeChatJid);
            loadStatus();
          }
        } catch (_) {}
      };
    }

    // 3. Status UI Updater
    function updateStatusUI(data) {
      const phoneEl = document.getElementById('account-phone');
      const qrPlaceholder = document.getElementById('qr-placeholder');
      const qrDisplay = document.getElementById('qr-display');
      const qrImg = document.getElementById('qr-img');
      const pairingDisplay = document.getElementById('pairing-display');
      const pairingCode = document.getElementById('pairing-code');

      if (data.status === 'connected') {
        const user = data.user || {};
        const label = `${user.phone || 'Linked'} (${user.name || 'User'})`;
        phoneEl.innerText = label;
        phoneEl.style.color = '#4ade80';

        const sbText = document.getElementById('sidebar-live-text');
        if (sbText) sbText.innerText = `Live • ${user.phone || 'Connected'}`;

        const dashAcc = document.getElementById('dash-account');
        if (dashAcc) dashAcc.innerText = label;

        qrPlaceholder.style.display = 'block';
        qrPlaceholder.innerHTML = '<p style="color: #4ade80; font-weight: bold;">WhatsApp is connected!</p>';
        qrDisplay.style.display = 'none';
        pairingDisplay.style.display = 'none';
      } else if (data.status === 'awaiting_qr') {
        phoneEl.innerText = 'Scan QR Code';
        phoneEl.style.color = '#fbbf24';
        qrPlaceholder.style.display = 'none';

        const sbText = document.getElementById('sidebar-live-text');
        if (sbText) sbText.innerText = `Waiting for QR Scan...`;

        if (data.qrDataUrl) {
          qrDisplay.style.display = 'block';
          qrImg.src = data.qrDataUrl;
        }
        if (data.pairingCode) {
          pairingDisplay.style.display = 'block';
          pairingCode.innerText = data.pairingCode;
        }
      } else {
        phoneEl.innerText = 'Disconnected';
        phoneEl.style.color = '#f87171';

        const sbText = document.getElementById('sidebar-live-text');
        if (sbText) sbText.innerText = `Disconnected • Click Session to Reconnect`;

        qrPlaceholder.style.display = 'block';
        qrPlaceholder.innerHTML = `
          <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">WhatsApp is disconnected</p>
          <button onclick="startConnection()" class="btn btn-accent">Connect WhatsApp</button>
        `;
        qrDisplay.style.display = 'none';
        pairingDisplay.style.display = 'none';
      }

      if (data.stats) {
        allStats = data.stats;
        document.getElementById('count-all').innerText = `(${data.stats.total || 0})`;
        document.getElementById('count-groups').innerText = `(${data.stats.groups || 0})`;
        document.getElementById('count-dms').innerText = `(${data.stats.dms || 0})`;
      }
    }

    // 4. Handle Incoming Live Message via SSE
    function handleIncomingLiveMessage(msg) {
      // 1. Update stats count
      allStats.total = (allStats.total || 0) + 1;
      if (msg.chat_type === 'group') allStats.groups = (allStats.groups || 0) + 1;
      else allStats.dms = (allStats.dms || 0) + 1;

      // 2. If active chat matches incoming message, append bubble!
      if (activeChatJid && activeChatJid === msg.remote_jid) {
        currentChatMessages.push(msg);
        appendSingleMessageBubble(msg, true);
        const countEl = document.getElementById('active-chat-count');
        if (countEl) countEl.innerText = `${currentChatMessages.length} messages`;
      }

      // 3. Update or bump chat in sidebar
      let existingIndex = chatsCache.findIndex(c => c.remote_jid === msg.remote_jid);
      if (existingIndex !== -1) {
        const item = chatsCache[existingIndex];
        item.last_text = msg.message_text;
        item.last_sender = msg.sender_name || msg.sender_phone;
        item.last_ts = msg.timestamp;
        item.count = (Number(item.count) || 0) + 1;
        // Bump to top
        chatsCache.splice(existingIndex, 1);
        chatsCache.unshift(item);
      } else {
        chatsCache.unshift({
          remote_jid: msg.remote_jid,
          chat_name: msg.chat_name || msg.remote_jid,
          chat_type: msg.chat_type,
          count: 1,
          last_ts: msg.timestamp,
          last_text: msg.message_text,
          last_sender: msg.sender_name || msg.sender_phone
        });
      }
      renderChatsList();

      // 4. If in stream view, prepend row
      if (activeView === 'stream') {
        streamMessages.unshift(msg);
        renderStreamTable(true);
      }
    }

    // 5. Load Chats List from Server
    async function loadChatsList() {
      try {
        const query = new URLSearchParams({
          filter: currentChatFilter,
          search: chatSearchQuery
        });
        const res = await fetch(`/api/chats?${query.toString()}`);
        const data = await res.json();
        chatsCache = data.chats || [];
        renderChatsList();

        document.getElementById('sidebar-stats-text').innerText = `${chatsCache.length} chats displayed`;
        const dashChats = document.getElementById('dash-chats');
        if (dashChats) dashChats.innerText = `${chatsCache.length} chats & groups`;
        if (chatsCache[0]) {
          const dashLast = document.getElementById('dash-last');
          if (dashLast) {
            const timeStr = new Date(chatsCache[0].last_ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            dashLast.innerText = `${timeStr} (${chatsCache[0].chat_name || 'Latest'})`;
          }
        }
      } catch (err) {
        console.error('Failed to load chats:', err);
      }
    }

    // 6. Render Chats List in Sidebar
    function renderChatsList() {
      const container = document.getElementById('chats-list-wrap');
      if (chatsCache.length === 0) {
        container.innerHTML = `
          <div class="empty-placeholder" style="padding-top: 50px;">
            <div class="empty-icon">🔍</div>
            <p>No chats found matching "${escapeHtml(chatSearchQuery)}".</p>
          </div>
        `;
        return;
      }

      let html = '';
      chatsCache.forEach(chat => {
        const isGroup = chat.chat_type === 'group';
        const isSelected = activeChatJid === chat.remote_jid;
        const avatarClass = isGroup ? 'group' : 'direct';
        const avatarIcon = isGroup ? '👥' : '👤';

        let title = chat.chat_name;
        if (!title || title === chat.remote_jid) {
          if (isGroup) {
            title = 'Group: ' + chat.remote_jid.split('@')[0];
          } else {
            title = '+' + chat.remote_jid.split('@')[0].split(':')[0];
          }
        }

        const timeStr = formatTimestamp(chat.last_ts);
        const countFormatted = Number(chat.count).toLocaleString();

        let snippet = chat.last_text || '';
        if (chat.last_sender && isGroup) {
          snippet = `${chat.last_sender}: ${snippet}`;
        }

        html += `
          <div
            class="chat-item ${isSelected ? 'active' : ''}"
            onclick="selectChat('${escapeAttr(chat.remote_jid)}')"
            id="chat-item-${escapeAttr(chat.remote_jid.replace(/[^a-zA-Z0-9_-]/g, '_'))}"
          >
            <div class="chat-avatar ${avatarClass}">${avatarIcon}</div>
            <div class="chat-content">
              <div class="chat-row-top">
                <span class="chat-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
                <span class="chat-time">${timeStr}</span>
              </div>
              <div class="chat-row-bottom">
                <span class="chat-snippet" title="${escapeHtml(snippet)}">${escapeHtml(snippet)}</span>
                <span class="chat-badge-count">${countFormatted}</span>
              </div>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
    }

    // 7. Select and Open a Specific Chat
    async function selectChat(remoteJid) {
      activeChatJid = remoteJid;

      // Update sidebar active highlights
      document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
      const activeEl = document.getElementById(`chat-item-${remoteJid.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
      if (activeEl) activeEl.classList.add('active');

      // Find meta in cache
      activeChatMeta = chatsCache.find(c => c.remote_jid === remoteJid) || { remote_jid: remoteJid, chat_name: remoteJid };

      document.getElementById('no-chat-selected').style.display = 'none';
      const mainContainer = document.getElementById('active-chat-container');
      mainContainer.style.display = 'flex';

      // Update header info
      const isGroup = (activeChatMeta.chat_type === 'group') || remoteJid.endsWith('@g.us');
      const avatarEl = document.getElementById('active-chat-avatar');
      avatarEl.className = `chat-avatar ${isGroup ? 'group' : 'direct'}`;
      avatarEl.innerText = isGroup ? '👥' : '👤';

      let title = activeChatMeta.chat_name;
      if (!title || title === remoteJid) {
        const found = chatsCache.find(c => c.remote_jid === remoteJid);
        if (found && found.chat_name && found.chat_name !== remoteJid) {
          title = found.chat_name;
          activeChatMeta.chat_name = found.chat_name;
        } else {
          title = isGroup ? ('Group: ' + remoteJid.split('@')[0]) : ('+' + remoteJid.split('@')[0].split(':')[0]);
        }
      }
      document.getElementById('active-chat-title').innerText = title;
      document.getElementById('active-chat-jid').innerText = remoteJid;

      // Fetch messages for this chat
      await loadActiveChatMessages();
    }

    // 8. Load Messages for Currently Active Chat
    async function loadActiveChatMessages(forceLimit) {
      if (!activeChatJid) return;
      const wrap = document.getElementById('chat-messages-wrap');
      wrap.innerHTML = `
        <div class="empty-placeholder">
          <div class="empty-icon">⏳</div>
          <p>Loading conversation messages...</p>
        </div>
      `;

      try {
        const limitSelect = document.getElementById('msg-limit-select');
        if (forceLimit) {
          limitSelect.value = forceLimit;
        }
        const limit = limitSelect.value || 'all';
        const query = new URLSearchParams({
          limit,
          search: msgSearchQuery
        });

        const res = await fetch(`/api/chats/${encodeURIComponent(activeChatJid)}/messages?${query.toString()}`);
        const data = await res.json();
        currentChatMessages = data.messages || [];

        const totalInDb = (typeof data.totalInDb === 'number') ? data.totalInDb : currentChatMessages.length;
        const loadedCount = (typeof data.loadedCount === 'number') ? data.loadedCount : currentChatMessages.length;

        // Sync with activeChatMeta & sidebar badge
        if (activeChatMeta) {
          activeChatMeta.count = totalInDb;
        }
        const safeId = activeChatJid.replace(/[^a-zA-Z0-9_-]/g, '_');
        const sidebarBadge = document.querySelector(`#chat-item-${safeId} .chat-badge-count`);
        if (sidebarBadge) {
          sidebarBadge.innerText = totalInDb.toLocaleString();
        }

        // Header status display
        const countEl = document.getElementById('active-chat-count');
        if (loadedCount >= totalInDb) {
          countEl.innerHTML = `<span style="color: #4ade80; font-weight: 700;">✓ ${totalInDb.toLocaleString()} messages (All Loaded)</span>`;
        } else {
          countEl.innerHTML = `
            <span style="color: #fbbf24; font-weight: 600;">Showing ${loadedCount.toLocaleString()} of ${totalInDb.toLocaleString()} messages</span>
            <button class="btn btn-accent" style="padding: 1px 7px; font-size: 10px; margin-left: 6px; cursor: pointer;" onclick="loadAllChatMessages()">Load All</button>
          `;
        }

        renderChatMessages(totalInDb, loadedCount);
      } catch (err) {
        console.error('Failed to load chat messages:', err);
        wrap.innerHTML = `<div class="empty-placeholder"><p style="color: #f87171;">Failed to load messages: ${escapeHtml(err.message)}</p></div>`;
      }
    }

    function loadAllChatMessages() {
      const select = document.getElementById('msg-limit-select');
      if (select) select.value = 'all';
      loadActiveChatMessages('all');
    }

    function jumpToTop() {
      const wrap = document.getElementById('chat-messages-wrap');
      if (wrap) wrap.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function jumpToBottom() {
      const wrap = document.getElementById('chat-messages-wrap');
      if (wrap) wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
    }

    // 9. Render Chat Messages as WhatsApp Bubbles
    function renderChatMessages(totalInDb = 0, loadedCount = 0) {
      const wrap = document.getElementById('chat-messages-wrap');
      const dateRangeEl = document.getElementById('active-chat-daterange');

      if (currentChatMessages.length === 0) {
        if (dateRangeEl) dateRangeEl.innerText = '📅 —';
        wrap.innerHTML = `
          <div class="empty-placeholder">
            <div class="empty-icon">📭</div>
            <p>No messages found in this chat.</p>
          </div>
        `;
        return;
      }

      // Update date range in header
      if (dateRangeEl && currentChatMessages.length > 0) {
        const firstDate = new Date(currentChatMessages[0].timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        const lastDate = new Date(currentChatMessages[currentChatMessages.length - 1].timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
        dateRangeEl.innerText = `📅 ${firstDate} — ${lastDate}`;
      }

      let html = '';

      // Older messages notice banner if limited
      if (loadedCount < totalInDb) {
        const remaining = totalInDb - loadedCount;
        html += `
          <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; padding: 10px 14px; text-align: center; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <span style="color: #fbbf24; font-size: 12px; font-weight: 600;">
              ⚠️ Showing latest ${loadedCount.toLocaleString()} messages (${remaining.toLocaleString()} older messages in database)
            </span>
            <button onclick="loadAllChatMessages()" class="btn btn-accent" style="padding: 3px 10px; font-size: 11px;">
              ⬆️ Load All ${totalInDb.toLocaleString()} Messages
            </button>
          </div>
        `;
      }

      let lastDateStr = '';

      currentChatMessages.forEach(m => {
        const msgDate = new Date(m.timestamp);
        const dateStr = formatDateDivider(msgDate);
        if (dateStr !== lastDateStr) {
          html += `<div class="date-divider">${dateStr}</div>`;
          lastDateStr = dateStr;
        }

        html += buildMessageBubbleHtml(m);
      });

      wrap.innerHTML = html;
      // Scroll to bottom to view latest message
      wrap.scrollTop = wrap.scrollHeight;
    }

    function appendSingleMessageBubble(msg, smoothScroll = true) {
      const wrap = document.getElementById('chat-messages-wrap');
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = buildMessageBubbleHtml(msg);
      if (tempDiv.firstElementChild) {
        wrap.appendChild(tempDiv.firstElementChild);
        if (smoothScroll) {
          wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
        }
      }
    }

    function buildMessageBubbleHtml(m) {
      const isOut = Boolean(m.is_from_me);
      const isGroup = (m.chat_type === 'group') || (m.remote_jid && m.remote_jid.endsWith('@g.us'));
      const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const senderId = m.sender_phone || m.sender_jid || m.sender_name || 'sender';
      const senderColor = getSenderColor(senderId);

      let mediaHtml = '';
      if (m.has_media) {
        const typeLabel = m.media_type ? m.media_type.toUpperCase() : 'MEDIA';
        mediaHtml = `<div class="media-attachment-badge">📎 ${escapeHtml(typeLabel)}</div>`;
      }

      // Quoted reply box
      let quoteHtml = '';
      if (m.quoted_text || m.quoted_message_id) {
        const qSender = m.quoted_sender_name || (m.quoted_sender_jid ? m.quoted_sender_jid.split('@')[0] : 'Replied Message');
        const qText = m.quoted_text || '[Media / Message]';
        quoteHtml = `
          <div class="quote-preview" onclick="scrollToMessage('${m.quoted_message_id || ''}')" title="Click to jump to quoted message">
            <div class="quote-sender">${escapeHtml(qSender)}</div>
            <div class="quote-text">${escapeHtml(qText)}</div>
          </div>
        `;
      }

      const rawJson = typeof m.raw_json === 'string' ? m.raw_json : JSON.stringify(m.raw_json || {}, null, 2);

      let bodyContentHtml = '';
      if (m.is_deleted) {
        bodyContentHtml = `<span class="msg-deleted-text">🚫 This message was deleted</span>`;
      } else {
        bodyContentHtml = formatMessageText(m.message_text);
      }

      return `
        <div class="msg-bubble-wrap ${isOut ? 'out' : ''}" id="msg-wrap-${m.id}">
          <div class="msg-bubble" id="msg-bubble-${m.id}">
            ${(!isOut && isGroup) ? `
              <div class="msg-author" style="color: ${senderColor}">
                <span>${escapeHtml(m.sender_name || 'Participant')}</span>
                ${m.sender_phone ? `<span class="msg-phone">${escapeHtml(m.sender_phone)}</span>` : ''}
              </div>
            ` : ''}

            ${quoteHtml}
            ${mediaHtml}

            <div class="msg-body" id="msg-body-${m.id}">${bodyContentHtml}</div>

            <div class="msg-footer">
              <button class="raw-btn" onclick="toggleMsgRaw('${m.id}')">JSON</button>
              ${m.is_edited ? `<span class="msg-edited-badge" id="msg-edited-${m.id}">(edited)</span>` : ''}
              <span class="msg-timestamp">${timeStr}</span>
            </div>

            <div id="raw-${m.id}" class="raw-viewer">
              <pre>${escapeHtml(rawJson)}</pre>
            </div>
          </div>
        </div>
      `;
    }

    function scrollToMessage(targetId) {
      if (!targetId) return;
      const target = document.getElementById('msg-wrap-' + targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('highlight-target');
        setTimeout(() => target.classList.remove('highlight-target'), 2000);
      } else {
        console.log('Quoted message not currently loaded in DOM:', targetId);
      }
    }

    function handleLiveMessageEdited(data) {
      if (!data || !data.id) return;

      // 1. Update in currentChatMessages cache
      const msg = currentChatMessages.find(m => m.id === data.id);
      if (msg) {
        msg.message_text = data.message_text;
        msg.is_edited = 1;
        msg.raw_json = data.raw_json || msg.raw_json;
      }

      // 2. Update active DOM bubble if rendered
      const bodyEl = document.getElementById('msg-body-' + data.id);
      if (bodyEl) {
        bodyEl.innerHTML = formatMessageText(data.message_text);
        const bubbleEl = document.getElementById('msg-bubble-' + data.id);
        if (bubbleEl && !document.getElementById('msg-edited-' + data.id)) {
          const footer = bubbleEl.querySelector('.msg-footer');
          if (footer) {
            const badge = document.createElement('span');
            badge.id = 'msg-edited-' + data.id;
            badge.className = 'msg-edited-badge';
            badge.innerText = '(edited)';
            const ts = footer.querySelector('.msg-timestamp');
            if (ts) footer.insertBefore(badge, ts);
            else footer.appendChild(badge);
          }
        }
      }

      // 3. Update sidebar preview if it's the last message
      const chatItem = chatsCache.find(c => c.remote_jid === data.remote_jid);
      if (chatItem) {
        chatItem.last_text = data.message_text;
        renderChatsList();
      }

      // 4. Update stream row if present
      const streamItem = streamMessages.find(m => m.id === data.id);
      if (streamItem) {
        streamItem.message_text = data.message_text;
        streamItem.is_edited = 1;
        if (activeView === 'stream') renderStreamTable();
      }
    }

    function handleLiveMessageDeleted(data) {
      if (!data || !data.id) return;

      // 1. Update in currentChatMessages cache
      const msg = currentChatMessages.find(m => m.id === data.id);
      if (msg) {
        msg.is_deleted = 1;
        msg.message_text = '🚫 This message was deleted';
      }

      // 2. Update active DOM bubble if rendered
      const bodyEl = document.getElementById('msg-body-' + data.id);
      if (bodyEl) {
        bodyEl.innerHTML = '<span class="msg-deleted-text">🚫 This message was deleted</span>';
      }

      // 3. Update stream row if present
      const streamItem = streamMessages.find(m => m.id === data.id);
      if (streamItem) {
        streamItem.is_deleted = 1;
        streamItem.message_text = '🚫 This message was deleted';
        if (activeView === 'stream') renderStreamTable();
      }
    }

    function toggleMsgRaw(id) {
      const el = document.getElementById('raw-' + id);
      if (el) {
        el.style.display = el.style.display === 'block' ? 'none' : 'block';
      }
    }

    // 10. Global Stream View Logic
    async function loadStreamMessages() {
      try {
        const limit = document.getElementById('stream-limit-select').value;
        const query = new URLSearchParams({
          filter: currentStreamFilter,
          search: streamSearchQuery,
          limit
        });
        const res = await fetch(`/api/messages?${query.toString()}`);
        const data = await res.json();
        streamMessages = data.messages || [];
        renderStreamTable();
      } catch (err) {
        console.error('Failed to load stream messages:', err);
      }
    }

    function renderStreamTable(isNewIncoming = false) {
      const tbody = document.getElementById('stream-tbody');
      if (streamMessages.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="empty-placeholder">
              <div class="empty-icon">📡</div>
              <p>No messages matching filter.</p>
            </td>
          </tr>
        `;
        return;
      }

      let html = '';
      streamMessages.forEach((m, idx) => {
        const timeStr = new Date(m.timestamp).toLocaleTimeString();
        const isGroup = m.chat_type === 'group';
        const pillClass = isGroup ? 'pill-group' : 'pill-direct';
        const pillLabel = isGroup ? 'Group' : 'Direct';
        const flashClass = (idx === 0 && isNewIncoming) ? 'new-flash' : '';
        const rawJson = typeof m.raw_json === 'string' ? m.raw_json : JSON.stringify(m.raw_json || {}, null, 2);

        html += `
          <tr class="${flashClass}">
            <td style="font-family: monospace; font-size: 11.5px; color: var(--text-muted);">${timeStr}</td>
            <td>
              <span class="pill ${pillClass}">${pillLabel}</span>
              <div style="font-weight: 600; margin-top: 3px; font-size: 12px; color: #f8fafc;">
                ${escapeHtml(m.chat_name || m.remote_jid)}
              </div>
            </td>
            <td>
              <div style="font-weight: 600; color: #fff;">${escapeHtml(m.sender_name || 'Unknown')}</div>
              <div style="font-size: 11px; font-family: monospace; color: var(--text-muted);">${escapeHtml(m.sender_phone || '')}</div>
            </td>
            <td>
              ${(m.quoted_text || m.quoted_message_id) ? `
                <div class="quote-preview" style="max-width: 340px; margin-bottom: 4px;">
                  <div class="quote-sender">${escapeHtml(m.quoted_sender_name || 'Quoted')}</div>
                  <div class="quote-text">${escapeHtml(m.quoted_text || '[Media]')}</div>
                </div>
              ` : ''}
              <div style="white-space: pre-wrap; word-break: break-word;">
                ${m.is_deleted ? '<span class="msg-deleted-text">🚫 This message was deleted</span>' : escapeHtml(m.message_text)}
                ${m.is_edited ? ' <span class="msg-edited-badge">(edited)</span>' : ''}
              </div>
              ${m.has_media ? `<span style="font-size: 11px; color: #a5b4fc; margin-right: 6px;">[📎 ${m.media_type || 'Media'}]</span>` : ''}
              <button class="raw-btn" style="margin-top: 4px; display: inline-block;" onclick="toggleMsgRaw('${m.id}')">View Raw JSON</button>
              <div id="raw-${m.id}" class="raw-viewer"><pre>${escapeHtml(rawJson)}</pre></div>
            </td>
          </tr>
        `;
      });

      tbody.innerHTML = html;
    }

    // 11. Search & Filter Handlers
    let chatSearchTimer = null;
    function handleChatSearch() {
      clearTimeout(chatSearchTimer);
      const val = document.getElementById('chat-search-input').value.trim();
      document.getElementById('clear-search-btn').style.display = val ? 'block' : 'none';
      chatSearchTimer = setTimeout(() => {
        chatSearchQuery = val;
        loadChatsList();
      }, 250);
    }

    function clearChatSearch() {
      document.getElementById('chat-search-input').value = '';
      document.getElementById('clear-search-btn').style.display = 'none';
      chatSearchQuery = '';
      loadChatsList();
    }

    function setChatFilter(filter, btn) {
      currentChatFilter = filter;
      document.querySelectorAll('.sidebar-header .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadChatsList();
    }

    let msgSearchTimer = null;
    function handleMsgSearch() {
      clearTimeout(msgSearchTimer);
      msgSearchTimer = setTimeout(() => {
        msgSearchQuery = document.getElementById('msg-search-input').value.trim();
        loadActiveChatMessages();
      }, 250);
    }

    function changeMsgLimit() {
      loadActiveChatMessages();
    }

    let streamSearchTimer = null;
    function handleStreamSearch() {
      clearTimeout(streamSearchTimer);
      streamSearchTimer = setTimeout(() => {
        streamSearchQuery = document.getElementById('stream-search-input').value.trim();
        loadStreamMessages();
      }, 250);
    }

    function setStreamFilter(filter, btn) {
      currentStreamFilter = filter;
      document.querySelectorAll('.stream-controls .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadStreamMessages();
    }

    // 12. Actions
    async function catchupMissedMessages() {
      const btn = document.getElementById('btn-catchup');
      if (btn) {
        btn.disabled = true;
        btn.innerText = '📡 Requesting Phone...';
      }
      try {
        const res = await fetch('/api/sync-history', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Catch-up sync requested from mobile phone! WhatsApp is requesting missed messages.');
      } catch (err) {
        alert('Failed to trigger catch-up: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerText = '⚡ Catch-up Missed';
        }
      }
    }

    async function syncGroupNames() {
      try {
        const res = await fetch('/api/chats/sync-names', { method: 'POST' });
        const data = await res.json();
        const groups = data.groups || data.updatedCount || 0;
        const participants = data.participants || 0;
        alert(`✅ Synced ${groups} WhatsApp group titles and resolved ${participants} member identities!`);
        await loadChatsList();
        if (activeChatJid) selectChat(activeChatJid);
      } catch (err) {
        alert('Failed to sync group names: ' + err.message);
      }
    }

    async function exportCurrentChat() {
      if (!activeChatJid) return;
      window.location.href = `/api/chats/${encodeURIComponent(activeChatJid)}/export`;
    }

    async function clearCurrentChat() {
      if (!activeChatJid) return;
      if (!confirm(`Are you sure you want to delete all messages for this chat (${activeChatJid})?`)) return;
      await fetch(`/api/chats/${encodeURIComponent(activeChatJid)}`, { method: 'DELETE' });
      currentChatMessages = [];
      renderChatMessages();
      loadChatsList();
    }

    async function startConnection() {
      await fetch('/api/connect', { method: 'POST' });
    }

    async function requestPairing() {
      const phone = document.getElementById('phone-input').value.trim();
      if (!phone) return alert('Enter phone number with country code (e.g. 8801874819713)');
      try {
        const res = await fetch('/api/pair-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data.error) alert(data.error);
      } catch (err) {
        alert('Failed: ' + err.message);
      }
    }

    async function logoutSession() {
      if (!confirm('Log out and clear session credentials?')) return;
      await fetch('/api/logout', { method: 'POST' });
    }

    async function clearAllMessages() {
      if (!confirm('Clear ALL caught messages from the database?')) return;
      await fetch('/api/messages', { method: 'DELETE' });
      chatsCache = [];
      currentChatMessages = [];
      streamMessages = [];
      renderChatsList();
      if (activeChatJid) selectChat(activeChatJid);
    }

    async function loadMainDbHistory() {
      if (!confirm('Import existing messages from collector.sqlite?')) return;
      try {
        const res = await fetch('/api/import-main-db', { method: 'POST' });
        const data = await res.json();
        alert(`Imported ${data.importedCount || 0} messages!`);
        await loadStatus();
        await loadChatsList();
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    }

    function exportAllMessages() {
      window.location.href = '/api/export';
    }

    async function loadStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        updateStatusUI(data);
      } catch (_) {}
    }

    // Helper formatting functions
    function formatTimestamp(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(-2)}`;
    }

    function formatDateDivider(date) {
      const now = new Date();
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);

      if (date.toDateString() === now.toDateString()) return 'Today';
      if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatMessageText(text) {
      if (!text) return '';
      const escaped = escapeHtml(text);
      // Auto-link URLs
      return escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener" style="color: #53bdeb; text-decoration: underline;">$1</a>');
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

    function escapeAttr(str) {
      if (!str) return '';
      return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    // Initialize on page load
    window.addEventListener('DOMContentLoaded', () => {
      initSSEStream();
      loadStatus();
      loadChatsList();
    });