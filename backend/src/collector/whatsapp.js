import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

import {
  saveCaughtMessage,
  getStats,
  updateChatName,
  saveLidMapping,
  saveLidMappingsBatch,
  resolveCanonicalJid,
  resolveSenderDisplayName,
  updateEditedMessage,
  markMessageDeleted,
  getRawMessage,
  saveGroupsBatch,
  getStoredChatName,
  repairExistingChatNames,
  deleteWhatsAppSessionData
} from '../storage/storage.js';
import { getAccountPaths, getActiveAccountId } from '../storage/account.js';
import { recordLiveMessageRoutes } from '../telecom/routes-service.js';

let sock = null;
const groupNamesCache = new Map();

let connectionState = {
  status: 'disconnected', // 'disconnected' | 'connecting' | 'awaiting_qr' | 'connected'
  qrCode: null,
  qrDataUrl: null,
  pairingCode: null,
  user: null,
  lastError: null,
  connectedAt: null,
  lastGap: null
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

export function addEventListener(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getStatus() {
  const isConnected = connectionState.status === 'connected';
  const rawUser = connectionState.user || (sock?.user) || null;
  let phone = rawUser?.id ? rawUser.id.split('@')[0].split(':')[0] : null;
  if (phone && !phone.startsWith('+')) phone = '+' + phone;
  const pushName = rawUser?.name || null;

  return {
    ...connectionState,
    connected: isConnected,
    phone: isConnected ? phone : null,
    pushName: isConnected ? pushName : null,
    name: isConnected ? pushName : null,
    accountJid: rawUser?.id || null,
    user: rawUser ? {
      id: rawUser.id,
      name: pushName || 'User',
      phone: phone || null
    } : null,
    status: isConnected ? 'authenticated' : connectionState.status,
    rawStatus: connectionState.status,
    accountId: getActiveAccountId(),
    stats: getStats()
  };
}

export function getSocket() {
  return sock;
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

  // Protocol Messages: Edits & Revocations
  let protoMsg = m.protocolMessage;
  if (!protoMsg && m.editedMessage?.message?.protocolMessage) {
    protoMsg = m.editedMessage.message.protocolMessage;
  }

  if (protoMsg) {
    const targetId = protoMsg.key?.id;
    if (protoMsg.type === 0) {
      return {
        isRevoke: true,
        targetId,
        key: protoMsg.key,
        timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now(),
        raw: msg
      };
    }
    if (protoMsg.type === 14 && protoMsg.editedMessage) {
      const innerEdit = protoMsg.editedMessage;
      const editedText = innerEdit.conversation ||
        innerEdit.extendedTextMessage?.text ||
        innerEdit.imageMessage?.caption ||
        innerEdit.videoMessage?.caption ||
        innerEdit.documentMessage?.caption || '';
      return {
        isEdit: true,
        targetId,
        newText: editedText,
        key: protoMsg.key,
        timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now(),
        raw: msg
      };
    }
  }

  // Handle ephemeral, viewOnce, and document wrappers
  if (m.ephemeralMessage) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
  if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;

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
    text = m.imageMessage.caption ? `[Image] ${m.imageMessage.caption}` : '[Image]';
  } else if (m.videoMessage) {
    hasMedia = true;
    mediaType = 'video';
    text = m.videoMessage.caption ? `[Video] ${m.videoMessage.caption}` : '[Video]';
  } else if (m.audioMessage) {
    hasMedia = true;
    mediaType = 'audio';
    text = m.audioMessage.ptt ? '[Voice Note]' : '[Audio]';
  } else if (m.documentMessage) {
    hasMedia = true;
    mediaType = 'document';
    const fileName = m.documentMessage.fileName || 'file';
    text = m.documentMessage.caption ? `[Doc: ${fileName}] ${m.documentMessage.caption}` : `[Doc: ${fileName}]`;
  } else if (m.stickerMessage) {
    hasMedia = true;
    mediaType = 'sticker';
    text = '[Sticker]';
  } else if (m.contactMessage) {
    text = `[Contact: ${m.contactMessage.displayName || 'Unknown'}]`;
  } else if (m.contactsArrayMessage) {
    text = `[Contacts: ${(m.contactsArrayMessage.contacts || []).length} shared]`;
  } else if (m.locationMessage) {
    text = `[Location: ${m.locationMessage.degreesLatitude}, ${m.locationMessage.degreesLongitude}]`;
  } else {
    const keys = Object.keys(m);
    if (keys.length > 0) {
      text = `[${keys[0].replace('Message', '')}]`;
    }
  }

  const isGroup = remoteJid.endsWith('@g.us');
  const chatType = isGroup ? 'group' : (remoteJid.includes('@broadcast') ? 'broadcast' : 'direct');

  // Determine sender JID
  let senderJid = remoteJid;
  if (isGroup) {
    senderJid = key.participant || msg.participant || remoteJid;
  }
  if (isFromMe && (connectionState.user?.id || sock?.user?.id)) {
    senderJid = connectionState.user?.id || sock?.user?.id;
  }

  let senderPhone = '';
  if (senderJid && senderJid.includes('@s.whatsapp.net')) {
    senderPhone = '+' + senderJid.split('@')[0].split(':')[0];
  } else if (senderJid && senderJid.includes('@lid')) {
    const canonical = resolveCanonicalJid(senderJid);
    if (canonical && canonical.includes('@s.whatsapp.net')) {
      senderPhone = '+' + canonical.split('@')[0].split(':')[0];
      senderJid = canonical;
    } else {
      senderPhone = 'LID:' + senderJid.split('@')[0];
    }
  }

  const myName = connectionState.user?.name || sock?.user?.name || 'You';
  let senderName = isFromMe ? myName : (msg.pushName || null);
  if (!senderName || senderName.startsWith('LID:') || senderName.toLowerCase() === 'me') {
    const resolved = resolveSenderDisplayName(senderJid);
    senderName = resolved || senderPhone || 'Unknown Sender';
  }

  // Determine Destination Chat Name
  let chatName = remoteJid;
  if (isGroup) {
    chatName = msg.chatName || groupNamesCache.get(remoteJid) || getStoredChatName(remoteJid) || null;
  } else if (remoteJid === 'status@broadcast') {
    chatName = '📢 WhatsApp Status Stories';
  } else {
    // Direct DM:
    if (!isFromMe) {
      chatName = msg.pushName || resolveSenderDisplayName(remoteJid) || (remoteJid.includes('@s.whatsapp.net') ? ('+' + remoteJid.split('@')[0].split(':')[0]) : remoteJid);
    } else {
      // Outgoing message sent by user: chatName is the recipient contact, NEVER the sender's own name
      const resolvedRecipient = resolveSenderDisplayName(remoteJid);
      chatName = resolvedRecipient || (remoteJid.includes('@s.whatsapp.net') ? ('+' + remoteJid.split('@')[0].split(':')[0]) : remoteJid);
    }
  }

  // Quoted reply context
  const contextInfo = m.extendedTextMessage?.contextInfo ||
    m.imageMessage?.contextInfo ||
    m.videoMessage?.contextInfo ||
    m.documentMessage?.contextInfo;

  let quotedMessageId = null;
  let quotedSenderJid = null;
  let quotedSenderName = null;
  let quotedText = null;

  if (contextInfo) {
    quotedMessageId = contextInfo.stanzaId || null;
    quotedSenderJid = contextInfo.participant || null;
    if (quotedSenderJid) {
      quotedSenderName = resolveSenderDisplayName(quotedSenderJid);
    }
    const qMsg = contextInfo.quotedMessage;
    if (qMsg) {
      quotedText = qMsg.conversation ||
        qMsg.extendedTextMessage?.text ||
        qMsg.imageMessage?.caption ||
        qMsg.videoMessage?.caption ||
        qMsg.documentMessage?.caption ||
        (qMsg.imageMessage ? '[Image]' : null) ||
        (qMsg.documentMessage ? `[Doc: ${qMsg.documentMessage.fileName || 'file'}]` : null) ||
        null;
    }
  }

  let timestamp = Date.now();
  if (typeof msg.messageTimestamp === 'number') {
    timestamp = msg.messageTimestamp * 1000;
  } else if (msg.messageTimestamp?.low) {
    timestamp = msg.messageTimestamp.low * 1000;
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
    quoted_message_id: quotedMessageId,
    quoted_sender_jid: quotedSenderJid,
    quoted_sender_name: quotedSenderName,
    quoted_text: quotedText,
    raw: msg
  };
}

let watchdogTimer = null;
let isConnecting = false;

function startWatchdog() {
  stopWatchdog();
  watchdogTimer = setInterval(async () => {
    if (sock && connectionState.status === 'connected') {
      try {
        await sock.sendPresenceUpdate('unavailable');
      } catch (err) {
        console.warn('⚠️ [Watchdog] Heartbeat ping failed. Triggering auto-reconnect:', err.message);
        reconnect();
      }
    }
  }, 30000);
}

function stopWatchdog() {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}

function reconnect() {
  if (isConnecting) return;
  disconnectWhatsApp().then(() => {
    setTimeout(connectWhatsApp, 2000);
  });
}

/**
 * Connect to WhatsApp with multi-file auth state and stealth configuration
 */
export async function connectWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const paths = getAccountPaths();
    console.log(`📡 [WhatsApp] Connecting account [${paths.accountId}] using session: ${paths.sessionDir}`);

    const { state, saveCreds } = await useMultiFileAuthState(paths.sessionDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`📦 [WhatsApp] Baileys v${version.join('.')}, isLatest: ${isLatest}`);

    connectionState.status = 'connecting';
    emitUpdate('status', getStatus());

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['Telcia BD', 'Chrome', '124.0.0.0'],
      syncFullHistory: true,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      defaultQueryTimeoutMs: 60000,
      getMessage: async (key) => {
        if (!key || !key.id) return undefined;
        return getRawMessage(key.id);
      },
      shouldSyncHistoryMessage: () => true
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
        emitUpdate('qr', { qr, qrDataUrl: connectionState.qrDataUrl });
        console.log(`📷 [WhatsApp] Fresh pairing QR code generated for [${paths.accountId}].`);
      }

      if (connection === 'open') {
        connectionState.status = 'connected';
        connectionState.connectedAt = Date.now();
        connectionState.qrCode = null;
        connectionState.qrDataUrl = null;
        connectionState.pairingCode = null;
        connectionState.user = sock.user;
        connectionState.lastError = null;

        // Stealth mode: unavailable presence so phone notifications remain fully audible
        try {
          await sock.sendPresenceUpdate('unavailable');
        } catch (_) {}

        startWatchdog();
        emitUpdate('status', getStatus());
        console.log(`✅ [WhatsApp] Connected successfully! Account: ${sock.user?.id || 'Unknown'}`);

        // Automatically sync group subjects/titles & participant mappings
        setTimeout(() => {
          syncGroupNames().then(res => {
            console.log(`👥 [WhatsApp] Auto-synced ${res.groups} groups on connection`);
          }).catch(e => console.warn('[WhatsApp] Group sync error on connect:', e.message));
        }, 1500);
      }

      if (connection === 'close') {
        stopWatchdog();
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        connectionState.status = 'disconnected';
        connectionState.user = null;
        connectionState.qrCode = null;
        connectionState.qrDataUrl = null;
        connectionState.lastError = lastDisconnect?.error?.message || `Code: ${statusCode}`;
        emitUpdate('status', getStatus());
        console.log(`⚠️ [WhatsApp] Disconnected (${connectionState.lastError}). Auto-reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(connectWhatsApp, 3000);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const m of messages) {
        const parsed = extractMessageDetails(m);
        if (!parsed) continue;

        if (parsed.isEdit) {
          const updated = updateEditedMessage(parsed.targetId, parsed.newText, parsed.raw);
          if (updated) emitUpdate('message_edited', updated);
          continue;
        }

        if (parsed.isRevoke) {
          const deleted = markMessageDeleted(parsed.targetId);
          if (deleted) emitUpdate('message_deleted', deleted);
          continue;
        }

        if (parsed.message_text) {
          saveCaughtMessage(parsed);
          try {
            const routeRes = recordLiveMessageRoutes(parsed);
            if (routeRes && routeRes.newRoutes > 0) {
              emitUpdate('routes_updated', { newRoutes: routeRes.newRoutes });
            }
          } catch (rErr) {
            console.warn('[Telecom] Route auto-extract notice:', rErr.message);
          }
          emitUpdate('message', parsed);
        }
      }
    });

    sock.ev.on('messaging-history.set', async ({ messages: historyMsgs }) => {
      if (Array.isArray(historyMsgs) && historyMsgs.length > 0) {
        console.log(`📜 [WhatsApp] Catch-up history packet received (${historyMsgs.length} messages)`);
        for (const m of historyMsgs) {
          const parsed = extractMessageDetails(m);
          if (parsed && !parsed.isEdit && !parsed.isRevoke && parsed.message_text) {
            saveCaughtMessage(parsed);
            try {
              recordLiveMessageRoutes(parsed);
            } catch (_) {}
          }
        }
      }
    });

    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
      if (sock?.groupMetadata && id) {
        try {
          const meta = await sock.groupMetadata(id);
          if (meta.subject) updateChatName(id, meta.subject);
          if (Array.isArray(meta.participants)) {
            const batch = [];
            for (const p of meta.participants) {
              if (p.lid && p.id && p.id.includes('@s.whatsapp.net')) {
                batch.push({ lid: p.lid, phoneJid: p.id, name: null });
              }
            }
            if (batch.length > 0) saveLidMappingsBatch(batch);
          }
        } catch (_) {}
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      const batch = [];
      for (const c of contacts) {
        if (c.lid && c.id && c.id.includes('@s.whatsapp.net')) {
          batch.push({ lid: c.lid, phoneJid: c.id, name: c.notify || c.name || null });
        }
      }
      if (batch.length > 0) saveLidMappingsBatch(batch);
    });

    sock.ev.on('groups.update', async (groupUpdates) => {
      const items = [];
      for (const update of groupUpdates) {
        if (update.id && update.subject) {
          groupNamesCache.set(update.id, update.subject);
          updateChatName(update.id, update.subject);
          items.push({
            jid: update.id,
            subject: update.subject,
            description: update.desc || null
          });
        }
      }
      if (items.length > 0) {
        saveGroupsBatch(items);
        emitUpdate('status', getStatus());
      }
    });

  } catch (err) {
    connectionState.status = 'disconnected';
    connectionState.lastError = err.message;
    emitUpdate('status', getStatus());
    console.error('❌ [WhatsApp] Connection error:', err.message);
  } finally {
    isConnecting = false;
  }
}

export async function disconnectWhatsApp() {
  stopWatchdog();
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      sock.end();
    } catch (_) {}
    sock = null;
  }
  connectionState.status = 'disconnected';
  emitUpdate('status', getStatus());
}

export async function logoutWhatsApp() {
  stopWatchdog();
  if (sock) {
    try {
      await sock.logout();
    } catch (_) {}
  }
  await disconnectWhatsApp();
  groupNamesCache.clear();
  const paths = getAccountPaths();
  if (fs.existsSync(paths.sessionDir)) {
    fs.rmSync(paths.sessionDir, { recursive: true, force: true });
    fs.mkdirSync(paths.sessionDir, { recursive: true });
  }
  const mediaDir = path.join(paths.dataDir, 'media');
  if (fs.existsSync(mediaDir)) {
    try {
      fs.rmSync(mediaDir, { recursive: true, force: true });
      fs.mkdirSync(mediaDir, { recursive: true });
    } catch (_) {}
  }
  try {
    const deleted = deleteWhatsAppSessionData();
    console.log(`🧹 [WhatsApp] Deleted on logout: ${deleted.msgs} raw messages, ${deleted.grps} groups, ${deleted.lids} member identities.`);
  } catch (err) {
    console.warn('[WhatsApp] Error deleting session data on logout:', err.message);
  }
  emitUpdate('status', getStatus());
  return { status: 'logged_out', message: 'Session and raw messages cleared' };
}

export async function requestPairingCode(phoneNumber) {
  if (!sock) {
    await connectWhatsApp();
  }
  if (!phoneNumber) throw new Error('Phone number is required');
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
  const code = await sock.requestPairingCode(cleanPhone);
  connectionState.pairingCode = code;
  emitUpdate('status', getStatus());
  return code;
}

export async function syncGroupNames() {
  if (!sock || connectionState.status !== 'connected') {
    return { groups: 0, participants: 0 };
  }
  try {
    const groups = await sock.groupFetchAllParticipating();
    let groupCount = 0;
    const participantMappings = [];
    const groupItems = [];

    for (const [jid, meta] of Object.entries(groups)) {
      if (meta && meta.subject) {
        groupNamesCache.set(jid, meta.subject);
        updateChatName(jid, meta.subject);
        groupCount++;
        groupItems.push({
          jid,
          subject: meta.subject,
          owner: meta.owner || null,
          creation: meta.creation || null,
          description: meta.desc || null,
          participants_count: Array.isArray(meta.participants) ? meta.participants.length : 0
        });
      }

      if (meta && Array.isArray(meta.participants)) {
        for (const p of meta.participants) {
          const lid = p.lid || (p.id?.endsWith('@lid') ? p.id : null);
          const phoneJid = p.jid || (p.id?.endsWith('@s.whatsapp.net') ? p.id : null);
          const name = p.name || p.notify || null;
          if (lid && phoneJid) {
            participantMappings.push({ lid, phoneJid, name });
          } else if (lid && name) {
            participantMappings.push({ lid, phoneJid: lid, name });
          }
        }
      }
    }

    if (groupItems.length > 0) {
      saveGroupsBatch(groupItems);
    }

    let mappedCount = 0;
    if (participantMappings.length > 0) {
      mappedCount = saveLidMappingsBatch(participantMappings);
    }

    // Repair existing messages that had 'me' or raw numbers
    const rawUser = connectionState.user || sock?.user;
    const userPhone = rawUser?.id ? ('+' + rawUser.id.split('@')[0].split(':')[0]) : null;
    const userName = rawUser?.name || 'You';
    repairExistingChatNames(userPhone, userName);

    console.log(`👥 [WhatsApp] Synced ${groupCount} groups and mapped ${mappedCount} participants!`);
    emitUpdate('status', getStatus());
    return { groups: groupCount, participants: mappedCount };
  } catch (err) {
    console.warn('[WhatsApp] Could not fetch group names & participants:', err.message);
    return { groups: 0, participants: 0 };
  }
}

export async function catchupRecentChats(count = 50) {
  if (!sock || connectionState.status !== 'connected') {
    return { status: 'not_connected', requested: 0 };
  }
  try {
    const { getDb } = await import('../storage/db.js');
    const db = getDb();
    const activeChats = db.prepare(`
      SELECT remote_jid, MIN(id) as oldest_id, MIN(timestamp) as oldest_ts, is_from_me
      FROM caught_messages
      WHERE remote_jid != 'status@broadcast'
      GROUP BY remote_jid
      ORDER BY MAX(timestamp) DESC
      LIMIT 30
    `).all();

    let requestedCount = 0;
    for (const chat of activeChats) {
      try {
        const key = {
          remoteJid: chat.remote_jid,
          fromMe: Boolean(chat.is_from_me),
          id: chat.oldest_id
        };
        if (typeof sock.fetchMessageHistory === 'function') {
          await sock.fetchMessageHistory(count, key, chat.oldest_ts);
          requestedCount++;
          await new Promise(r => setTimeout(r, 600));
        }
      } catch (_) {}
    }
    return { status: 'ok', requested: requestedCount };
  } catch (err) {
    console.warn('[WhatsApp] Catch-up error:', err.message);
    return { status: 'error', error: err.message, requested: 0 };
  }
}

export async function fetchChatHistory(remoteJid, count = 50) {
  if (!sock || connectionState.status !== 'connected' || !remoteJid) {
    return { status: 'not_connected', requested: 0 };
  }
  try {
    const { getDb } = await import('../storage/db.js');
    const db = getDb();
    const oldest = db.prepare(`
      SELECT id, timestamp, is_from_me
      FROM caught_messages
      WHERE remote_jid = ?
      ORDER BY timestamp ASC
      LIMIT 1
    `).get(remoteJid);

    if (typeof sock.fetchMessageHistory === 'function') {
      const key = {
        remoteJid,
        fromMe: oldest ? Boolean(oldest.is_from_me) : false,
        id: oldest ? oldest.id : `msg_${Date.now()}`
      };
      const ts = oldest ? oldest.timestamp : Date.now();
      await sock.fetchMessageHistory(count, key, ts);
      return { status: 'ok', requested: count, fromId: key.id };
    }
    return { status: 'unsupported', requested: 0 };
  } catch (err) {
    console.warn(`[WhatsApp] fetchChatHistory error for ${remoteJid}:`, err.message);
    return { status: 'error', error: err.message, requested: 0 };
  }
}

/**
 * Sends a notification directly to the connected account's own WhatsApp number
 * Used for terminal alerts, security notices, and password reset OTPs.
 */
export async function sendSelfNotification(text) {
  if (!sock || connectionState.status !== 'connected') {
    throw new Error('WhatsApp Companion is not currently connected');
  }
  const rawUser = connectionState.user || sock.user;
  if (!rawUser || !rawUser.id) {
    throw new Error('No active user account found on WhatsApp connection');
  }
  const cleanPhone = rawUser.id.split('@')[0].split(':')[0];
  const targetJid = `${cleanPhone}@s.whatsapp.net`;
  console.log(`📤 [WhatsApp] Delivering direct self-notification to [${targetJid}]...`);
  return await sock.sendMessage(targetJid, { text });
}


