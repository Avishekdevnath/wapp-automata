/**
 * Isolated Baileys WhatsApp Engine
 * Completely self-contained within local-wp-scraper/session
 */
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const {
  saveMessage,
  getStats,
  updateChatName,
  saveLidMapping,
  saveLidMappingsBatch,
  resolveCanonicalJid,
  resolveSenderDisplayName,
  updateEditedMessage,
  markMessageDeleted,
  getRawMessage,
  getLatestMessageTimestamp,
  getRecentActiveChats,
  getLatestMessageForChat
} = require('./storage');

const SESSION_DIR = path.join(__dirname, 'session');
if (!fs.existsSync(SESSION_DIR)) {
  fs.mkdirSync(SESSION_DIR, { recursive: true });
}

let sock = null;
let connectionState = {
  status: 'disconnected', // 'disconnected' | 'connecting' | 'awaiting_qr' | 'connected'
  qrCode: null,
  qrDataUrl: null,
  pairingCode: null,
  user: null,
  lastError: null,
  connectedAt: null
};

// Event emitter callbacks
const listeners = new Set();

function emitUpdate(type, data) {
  for (const listener of listeners) {
    try {
      listener(type, data);
    } catch (_) {}
  }
}

function addEventListener(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getStatus() {
  return {
    ...connectionState,
    stats: getStats()
  };
}

/**
 * Normalizes Baileys raw proto message into clean readable object
 */
function extractMessageDetails(msg) {
  if (!msg || !msg.message) return null;

  const key = msg.key || {};
  const messageId = key.id || `msg_${Date.now()}`;
  let remoteJid = key.remoteJid || '';
  const isFromMe = Boolean(key.fromMe);

  let m = msg.message;

  // --- 0. Protocol Messages: Edits & Revocations ("Delete for everyone") ---
  let protoMsg = m.protocolMessage;
  if (!protoMsg && m.editedMessage?.message?.protocolMessage) {
    protoMsg = m.editedMessage.message.protocolMessage;
  }

  if (protoMsg) {
    const targetId = protoMsg.key?.id;
    // Type 0 is REVOKE ("Delete for everyone")
    if (protoMsg.type === 0) {
      return {
        isRevoke: true,
        targetId,
        key: protoMsg.key,
        timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now(),
        raw: msg
      };
    }
    // Type 14 is MESSAGE_EDIT
    if (protoMsg.type === 14 && protoMsg.editedMessage) {
      let editM = protoMsg.editedMessage;
      if (editM.ephemeralMessage?.message) editM = editM.ephemeralMessage.message;
      if (editM.viewOnceMessage?.message) editM = editM.viewOnceMessage.message;
      if (editM.viewOnceMessageV2?.message) editM = editM.viewOnceMessageV2.message;

      let newText = '';
      if (editM.conversation) newText = editM.conversation;
      else if (editM.extendedTextMessage?.text) newText = editM.extendedTextMessage.text;
      else if (editM.imageMessage?.caption) newText = editM.imageMessage.caption;
      else if (editM.videoMessage?.caption) newText = editM.videoMessage.caption;
      else if (editM.documentMessage?.caption) newText = editM.documentMessage.caption;

      return {
        isEdit: true,
        targetId,
        newText: newText.trim(),
        key: protoMsg.key,
        timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now(),
        raw: msg
      };
    }
    return null; // Ignore other protocol messages (e.g. ephemeral settings, app state)
  }

  // --- 1. Resolve Canonical Phone Number for LIDs ---
  const senderPn = key.senderPn || key.remoteJidPn || key.participantPn;
  if (senderPn && senderPn.endsWith('@s.whatsapp.net')) {
    if (remoteJid.endsWith('@lid')) {
      saveLidMapping(remoteJid, senderPn, !isFromMe ? msg.pushName : null);
      remoteJid = senderPn;
    }
  } else if (remoteJid.endsWith('@lid')) {
    remoteJid = resolveCanonicalJid(remoteJid);
  }

  // --- 2. Determine chat type ---
  let chatType = 'direct';
  if (remoteJid.endsWith('@g.us')) chatType = 'group';
  else if (remoteJid === 'status@broadcast') chatType = 'broadcast';
  else if (remoteJid.endsWith('@broadcast')) chatType = 'broadcast';

  // --- 3. Determine sender JID and Phone ---
  let senderJid = remoteJid;
  if (chatType === 'group') {
    senderJid = key.participant || msg.participant || remoteJid;
  }
  if (isFromMe && connectionState.user?.id) {
    senderJid = connectionState.user.id;
  }

  let senderPhone = '';
  if (senderJid.includes('@s.whatsapp.net')) {
    senderPhone = '+' + senderJid.split('@')[0].split(':')[0];
  } else if (senderJid.includes('@lid')) {
    const canonical = resolveCanonicalJid(senderJid);
    if (canonical && canonical.includes('@s.whatsapp.net')) {
      senderPhone = '+' + canonical.split('@')[0].split(':')[0];
      senderJid = canonical;
    } else {
      senderPhone = 'LID:' + senderJid.split('@')[0];
    }
  }

  if (senderPn && senderPn.includes('@s.whatsapp.net')) {
    senderPhone = '+' + senderPn.split('@')[0].split(':')[0];
  }

  const myName = connectionState.user?.name || 'Me';
  let senderName = isFromMe ? myName : (msg.pushName || null);
  if (!senderName || senderName.startsWith('LID:')) {
    const resolved = resolveSenderDisplayName(senderJid);
    senderName = resolved || senderPhone || 'Unknown Sender';
  }

  // --- 4. Unwrap potential ephemeral or viewOnce wrappers ---
  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
  if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;

  // --- 5. Extract text and media type ---
  let text = '';
  let hasMedia = false;
  let mediaType = null;

  if (m.conversation) {
    text = m.conversation;
  } else if (m.extendedTextMessage?.text) {
    text = m.extendedTextMessage.text;
  } else if (m.imageMessage) {
    hasMedia = true;
    mediaType = 'image';
    text = m.imageMessage.caption || '[Image]';
  } else if (m.videoMessage) {
    hasMedia = true;
    mediaType = 'video';
    text = m.videoMessage.caption || '[Video]';
  } else if (m.audioMessage) {
    hasMedia = true;
    mediaType = m.audioMessage.ptt ? 'voice_note' : 'audio';
    text = '[Voice Note / Audio]';
  } else if (m.documentMessage) {
    hasMedia = true;
    mediaType = 'document';
    text = m.documentMessage.caption || m.documentMessage.fileName || '[Document]';
  } else if (m.stickerMessage) {
    hasMedia = true;
    mediaType = 'sticker';
    text = '[Sticker]';
  } else if (m.contactMessage) {
    text = `[Contact: ${m.contactMessage.displayName || 'VCard'}]`;
  } else if (m.locationMessage) {
    text = `[Location: ${m.locationMessage.name || `${m.locationMessage.degreesLatitude}, ${m.locationMessage.degreesLongitude}`}]`;
  } else if (m.buttonsResponseMessage) {
    text = m.buttonsResponseMessage.selectedDisplayText || m.buttonsResponseMessage.selectedButtonId || '[Button Click]';
  } else if (m.listResponseMessage) {
    text = m.listResponseMessage.title || '[List Selection]';
  }

  // --- 6. Extract Quoted Message Context ---
  const ctx = m.extendedTextMessage?.contextInfo ||
              m.imageMessage?.contextInfo ||
              m.videoMessage?.contextInfo ||
              m.documentMessage?.contextInfo ||
              m.audioMessage?.contextInfo ||
              m.stickerMessage?.contextInfo ||
              m.contactMessage?.contextInfo ||
              m.locationMessage?.contextInfo ||
              m.contextInfo;

  let quotedMessageId = null;
  let quotedSenderJid = null;
  let quotedSenderName = null;
  let quotedText = null;

  if (ctx && (ctx.stanzaId || ctx.quotedMessage)) {
    quotedMessageId = ctx.stanzaId || null;
    quotedSenderJid = ctx.participant || null;

    if (quotedSenderJid) {
      if (quotedSenderJid.endsWith('@lid')) {
        const canonical = resolveCanonicalJid(quotedSenderJid);
        if (canonical && canonical.endsWith('@s.whatsapp.net')) {
          quotedSenderJid = canonical;
        }
      }
      if (connectionState.user?.id && quotedSenderJid.split('@')[0] === connectionState.user.id.split('@')[0]) {
        quotedSenderName = 'You';
      } else {
        quotedSenderName = resolveSenderDisplayName(quotedSenderJid);
      }
    }

    const qm = ctx.quotedMessage;
    if (qm) {
      let inner = qm;
      if (inner.ephemeralMessage?.message) inner = inner.ephemeralMessage.message;
      if (inner.viewOnceMessage?.message) inner = inner.viewOnceMessage.message;
      if (inner.viewOnceMessageV2?.message) inner = inner.viewOnceMessageV2.message;

      if (inner.conversation) quotedText = inner.conversation;
      else if (inner.extendedTextMessage?.text) quotedText = inner.extendedTextMessage.text;
      else if (inner.imageMessage) quotedText = inner.imageMessage.caption || '[Image]';
      else if (inner.videoMessage) quotedText = inner.videoMessage.caption || '[Video]';
      else if (inner.documentMessage) quotedText = inner.documentMessage.caption || inner.documentMessage.fileName || '[Document]';
      else if (inner.audioMessage) quotedText = '[Voice Note / Audio]';
      else if (inner.stickerMessage) quotedText = '[Sticker]';
      else if (inner.contactMessage) quotedText = `[Contact: ${inner.contactMessage.displayName || 'Contact'}]`;
      else if (inner.locationMessage) quotedText = `[Location: ${inner.locationMessage.name || 'Location'}]`;
    }
  }

  const timestamp = typeof msg.messageTimestamp === 'number'
    ? msg.messageTimestamp * 1000
    : (typeof msg.messageTimestamp?.low === 'number' ? msg.messageTimestamp.low * 1000 : Date.now());

  // --- 7. Determine canonical Destination Chat Name ---
  let chatName = remoteJid;
  if (chatType === 'group') {
    chatName = msg.chatName || remoteJid.split('@')[0];
  } else if (remoteJid === 'status@broadcast') {
    chatName = '📢 WhatsApp Status Stories';
  } else {
    // Direct DM:
    if (!isFromMe) {
      chatName = msg.pushName || senderPhone || remoteJid.split('@')[0];
    } else {
      // Outgoing message sent by user: chatName is the recipient contact, NEVER the sender's own name
      chatName = (remoteJid.includes('@s.whatsapp.net') ? ('+' + remoteJid.split('@')[0].split(':')[0]) : remoteJid);
    }
  }

  return {
    id: messageId,
    remote_jid: remoteJid,
    chat_name: chatName,
    chat_type: chatType,
    sender_jid: senderJid,
    sender_phone: senderPhone,
    sender_name: senderName,
    message_text: text.trim(),
    has_media: hasMedia,
    media_type: mediaType,
    is_from_me: isFromMe,
    timestamp,
    raw: msg,
    quoted_message_id: quotedMessageId,
    quoted_sender_jid: quotedSenderJid,
    quoted_sender_name: quotedSenderName,
    quoted_text: quotedText,
    is_edited: 0,
    is_deleted: 0
  };
}

/**
 * Initializes and connects the Baileys client
 */
/**
 * Watchdog and Heartbeat Manager
 */
let heartbeatTimer = null;
let lastActivityTimestamp = Date.now();
let isReconnecting = false;

function resetActivity() {
  lastActivityTimestamp = Date.now();
}

function startHeartbeat() {
  stopHeartbeat();
  lastActivityTimestamp = Date.now();
  connectionState.watchdog = { status: 'healthy', lastPing: Date.now() };

  heartbeatTimer = setInterval(async () => {
    if (!sock || connectionState.status !== 'connected') return;

    // Check if WebSocket is dead or frozen
    if (!sock.ws || !sock.ws.isOpen) {
      console.warn('⚠️ [Watchdog] WebSocket is not open while marked connected. Triggering clean reconnect...');
      triggerWatchdogReconnect();
      return;
    }

    // Ping presence to keep socket alive and active
    const idleMs = Date.now() - lastActivityTimestamp;
    try {
      await sock.sendPresenceUpdate('available');
      connectionState.watchdog = { status: 'healthy', lastPing: Date.now() };
    } catch (err) {
      console.warn(`⚠️ [Watchdog] Presence ping warning: ${err.message}. Idle: ${Math.round(idleMs / 1000)}s`);
      connectionState.watchdog = { status: 'warning', lastPing: Date.now(), error: err.message };
      if (idleMs > 120000) {
        console.warn('🚨 [Watchdog] Socket silent & unresponsive for > 120s. Triggering clean reconnect...');
        triggerWatchdogReconnect();
      }
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (connectionState.watchdog) {
    connectionState.watchdog.status = 'stopped';
  }
}

async function triggerWatchdogReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;
  stopHeartbeat();
  console.log('🔄 [Watchdog] Executing automatic self-healing reconnection cycle...');
  try {
    if (sock) {
      sock.end(undefined);
      sock = null;
    }
  } catch (_) {}
  connectionState.status = 'disconnected';
  emitUpdate('status', getStatus());
  setTimeout(async () => {
    isReconnecting = false;
    try {
      await connectWhatsApp();
    } catch (err) {
      console.error('❌ [Watchdog Reconnect Error]:', err.message);
    }
  }, 3000);
}

/**
 * On-Demand History Catchup for Active Chats
 */
async function catchupRecentChats(count = 50) {
  if (!sock || connectionState.status !== 'connected') {
    return { status: 'not_connected', requested: 0 };
  }
  const activeChats = getRecentActiveChats(15);
  let requestedCount = 0;
  console.log(`📡 [Catch-up] Initiating on-demand message history sync for ${activeChats.length} active chats...`);

  for (const chat of activeChats) {
    try {
      const key = {
        remoteJid: chat.remote_jid,
        fromMe: Boolean(chat.is_from_me),
        id: chat.last_id
      };
      if (typeof sock.fetchMessageHistory === 'function') {
        await sock.fetchMessageHistory(count, key, chat.last_ts);
        requestedCount++;
        // Polite delay between chat PDO requests to avoid flooding phone
        await new Promise(r => setTimeout(r, 600));
      }
    } catch (e) {
      console.warn(`[Catch-up] Error requesting history for ${chat.remote_jid}:`, e.message);
    }
  }
  console.log(`✅ [Catch-up] Requested recent message history for ${requestedCount} active chats from mobile phone.`);
  return { status: 'ok', requested: requestedCount };
}

/**
 * Initializes and connects the Baileys client
 */
async function connectWhatsApp() {
  if (sock && connectionState.status === 'connected') {
    return { status: 'already_connected', user: connectionState.user };
  }

  connectionState.status = 'connecting';
  connectionState.lastError = null;
  emitUpdate('status', getStatus());

  try {
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['Telcia Local Scraper', 'Chrome', '124.0.0.0'],
      syncFullHistory: true,
      defaultQueryTimeoutMs: 60000,
      getMessage: async (key) => {
        return getRawMessage(key?.id);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionState.status = 'awaiting_qr';
        connectionState.qrCode = qr;
        try {
          connectionState.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        } catch (_) {}
        emitUpdate('status', getStatus());
        console.log('⚡ [Local Scraper] QR Code generated and ready for scan.');
      }

      if (connection === 'open') {
        const user = sock.user || {};
        const phone = user.id ? '+' + user.id.split('@')[0].split(':')[0] : '';
        connectionState.status = 'connected';
        connectionState.qrCode = null;
        connectionState.qrDataUrl = null;
        connectionState.pairingCode = null;
        connectionState.user = {
          id: user.id,
          name: user.name || 'Connected User',
          phone
        };
        connectionState.connectedAt = Date.now();
        emitUpdate('status', getStatus());
        console.log(`✅ [Local Scraper] WhatsApp connected successfully as ${phone} (${user.name || 'User'})`);

        // Start active liveness watchdog
        startHeartbeat();

        // Detect downtime gap and trigger catchup
        const latestTs = getLatestMessageTimestamp();
        const now = Date.now();
        if (latestTs && (now - latestTs > 5 * 60 * 1000)) {
          const gapMinutes = Math.round((now - latestTs) / 60000);
          console.log(`⚠️ [Local Scraper] Offline gap detected: ~${gapMinutes} minutes since last recorded message.`);
          connectionState.lastGap = {
            gapMinutes,
            lastRecordedTs: latestTs,
            detectedAt: now
          };
          emitUpdate('gap_detected', connectionState.lastGap);

          // Proactively ask phone for catch-up of recently active chats
          setTimeout(() => {
            catchupRecentChats(50).catch(e => console.warn('[Catch-up error]:', e.message));
          }, 3500);
        }

        // Automatically sync group subjects/titles
        setTimeout(() => {
          syncGroupNames().catch(e => console.warn('Group sync error:', e.message));
        }, 1500);
      }

      if (connection === 'close') {
        stopHeartbeat();
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        connectionState.status = 'disconnected';
        connectionState.user = null;
        connectionState.qrCode = null;
        connectionState.qrDataUrl = null;
        connectionState.lastError = lastDisconnect?.error?.message || `Disconnected (Code: ${statusCode})`;
        emitUpdate('status', getStatus());
        console.log(`⚠️ [Local Scraper] Connection closed. Reason: ${connectionState.lastError}. Reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(connectWhatsApp, 3000);
        } else {
          cleanSessionFiles();
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      resetActivity();
      for (const m of messages) {
        const parsed = extractMessageDetails(m);
        if (!parsed) continue;

        if (parsed.isEdit) {
          const updatedMsg = updateEditedMessage(parsed.targetId, parsed.newText, parsed.raw);
          if (updatedMsg) {
            emitUpdate('message_edited', updatedMsg);
            console.log(`✏️ [Edited] Message ${parsed.targetId} updated: "${parsed.newText.slice(0, 50)}"`);
          }
          continue;
        }

        if (parsed.isRevoke) {
          const updatedMsg = markMessageDeleted(parsed.targetId);
          if (updatedMsg) {
            emitUpdate('message_deleted', updatedMsg);
            console.log(`🚫 [Revoked] Message ${parsed.targetId} marked as deleted.`);
          }
          continue;
        }

        if (parsed.message_text) {
          saveMessage(parsed);
          emitUpdate('message', parsed);
          console.log(`📩 [Caught] [${parsed.chat_type}] From: ${parsed.sender_name} (${parsed.sender_phone}): "${parsed.message_text.slice(0, 70)}"`);
        }
      }
    });

    sock.ev.on('messages.update', async (updates) => {
      resetActivity();
      for (const update of updates) {
        const key = update.key;
        const targetId = key?.id;
        if (!targetId) continue;

        const msgObj = update.update?.message;
        if (msgObj) {
          const parsed = extractMessageDetails({ key, message: msgObj, messageTimestamp: update.update?.messageTimestamp });
          if (parsed?.isEdit) {
            const updated = updateEditedMessage(parsed.targetId, parsed.newText, parsed.raw);
            if (updated) emitUpdate('message_edited', updated);
          } else if (parsed?.isRevoke) {
            const updated = markMessageDeleted(parsed.targetId);
            if (updated) emitUpdate('message_deleted', updated);
          }
        }
      }
    });

    sock.ev.on('messaging-history.set', async ({ chats, messages: historyMsgs, isLatest }) => {
      console.log(`📜 [Local Scraper] WhatsApp history sync received: ${historyMsgs ? historyMsgs.length : 0} messages.`);
      if (Array.isArray(historyMsgs) && historyMsgs.length > 0) {
        let count = 0;
        for (const m of historyMsgs) {
          const parsed = extractMessageDetails(m);
          if (parsed && !parsed.isEdit && !parsed.isRevoke && parsed.message_text) {
            saveMessage(parsed);
            count++;
          }
        }
        console.log(`✅ [Local Scraper] Saved ${count} historical messages from WhatsApp phone sync.`);
        emitUpdate('history_synced', { count, isLatest });
        emitUpdate('status', getStatus());
      }
    });

    return { status: 'connecting' };
  } catch (err) {
    stopHeartbeat();
    connectionState.status = 'disconnected';
    connectionState.lastError = err.message;
    emitUpdate('status', getStatus());
    console.error('❌ [Local Scraper] Connection error:', err.message);
    throw err;
  }
}

/**
 * Requests an 8-digit mobile pairing code for phone-number based linking
 */
async function requestPairingCode(phoneNumber) {
  if (!sock) {
    await connectWhatsApp();
  }

  const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 8) {
    throw new Error('Valid phone number with country code is required (e.g. 8801812345678)');
  }

  try {
    const code = await sock.requestPairingCode(cleanPhone);
    const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
    connectionState.pairingCode = formattedCode;
    connectionState.status = 'awaiting_qr';
    emitUpdate('status', getStatus());
    return formattedCode;
  } catch (err) {
    console.error('Failed to request pairing code:', err.message);
    throw err;
  }
}

/**
 * Completely logs out and deletes session keys
 */
async function logoutWhatsApp() {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
      sock.end(undefined);
      sock = null;
    }
  } catch (_) {}

  cleanSessionFiles();

  connectionState = {
    status: 'disconnected',
    qrCode: null,
    qrDataUrl: null,
    pairingCode: null,
    user: null,
    lastError: null,
    connectedAt: null
  };

  emitUpdate('status', getStatus());
  console.log('🛑 [Local Scraper] Session logged out and local credentials removed.');
  return { status: 'logged_out' };
}

/**
 * Syncs human-readable group names (subjects) and resolves participant LIDs to Phone numbers into SQLite
 */
async function syncGroupNames() {
  if (!sock || connectionState.status !== 'connected') {
    return { groups: 0, participants: 0 };
  }
  try {
    const groups = await sock.groupFetchAllParticipating();
    let groupCount = 0;
    const participantMappings = [];

    for (const [jid, meta] of Object.entries(groups)) {
      if (meta && meta.subject) {
        updateChatName(jid, meta.subject);
        groupCount++;
      }

      if (meta && Array.isArray(meta.participants)) {
        for (const p of meta.participants) {
          const lid = p.lid || (p.id?.endsWith('@lid') ? p.id : null);
          const phoneJid = p.jid || (p.id?.endsWith('@s.whatsapp.net') ? p.id : null);
          const name = p.name || p.notify || null;
          if (lid && phoneJid) {
            participantMappings.push({ lid, phoneJid, name });
          } else if (lid && name) {
            // Even if phone number is hidden by community privacy, map display name to LID
            participantMappings.push({ lid, phoneJid: lid, name });
          }
        }
      }
    }

    let mappedCount = 0;
    if (participantMappings.length > 0) {
      mappedCount = saveLidMappingsBatch(participantMappings);
    }

    console.log(`👥 [Local Scraper] Synced names for ${groupCount} WhatsApp groups and mapped ${mappedCount} participants!`);
    emitUpdate('status', getStatus());
    return { groups: groupCount, participants: mappedCount };
  } catch (err) {
    console.warn('[Local Scraper] Could not fetch group names & participants:', err.message);
    return { groups: 0, participants: 0 };
  }
}

function cleanSessionFiles() {
  try {
    if (fs.existsSync(SESSION_DIR)) {
      const files = fs.readdirSync(SESSION_DIR);
      for (const file of files) {
        fs.unlinkSync(path.join(SESSION_DIR, file));
      }
    }
  } catch (err) {
    console.warn('Could not clean session directory:', err.message);
  }
}

module.exports = {
  connectWhatsApp,
  requestPairingCode,
  logoutWhatsApp,
  getStatus,
  addEventListener,
  syncGroupNames,
  catchupRecentChats,
  triggerWatchdogReconnect
};

