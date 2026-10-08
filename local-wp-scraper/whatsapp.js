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

const { saveMessage, getStats } = require('./storage');

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
  const remoteJid = key.remoteJid || '';
  const isFromMe = Boolean(key.fromMe);

  // Determine chat type
  let chatType = 'direct';
  if (remoteJid.endsWith('@g.us')) chatType = 'group';
  else if (remoteJid.endsWith('@broadcast')) chatType = 'broadcast';
  else if (remoteJid === 'status@broadcast') chatType = 'status';

  // Determine sender JID and Phone
  let senderJid = remoteJid;
  if (chatType === 'group') {
    senderJid = key.participant || msg.participant || remoteJid;
  }

  let senderPhone = '';
  if (senderJid.includes('@s.whatsapp.net')) {
    senderPhone = '+' + senderJid.split('@')[0].split(':')[0];
  } else if (senderJid.includes('@lid')) {
    senderPhone = 'LID:' + senderJid.split('@')[0];
  }

  // Check if participantPn exists in key
  if (key.participantPn && key.participantPn.includes('@s.whatsapp.net')) {
    senderPhone = '+' + key.participantPn.split('@')[0].split(':')[0];
  }

  const senderName = msg.pushName || senderPhone || 'Unknown Sender';

  // Unwrap potential ephemeral or viewOnce wrappers
  let m = msg.message;
  if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
  if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
  if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
  if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;

  // Extract text and media type
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
  } else if (m.protocolMessage) {
    return null; // Ignore protocol messages (sync, revoke, etc.)
  }

  const timestamp = typeof msg.messageTimestamp === 'number'
    ? msg.messageTimestamp * 1000
    : (typeof msg.messageTimestamp?.low === 'number' ? msg.messageTimestamp.low * 1000 : Date.now());

  return {
    id: messageId,
    remote_jid: remoteJid,
    chat_name: chatType === 'group' ? (msg.chatName || remoteJid.split('@')[0]) : senderName,
    chat_type: chatType,
    sender_jid: senderJid,
    sender_phone: senderPhone,
    sender_name: senderName,
    message_text: text.trim(),
    has_media: hasMedia,
    media_type: mediaType,
    is_from_me: isFromMe,
    timestamp,
    raw: msg
  };
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
      syncFullHistory: false,
      defaultQueryTimeoutMs: 60000
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
      }

      if (connection === 'close') {
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
      for (const m of messages) {
        const parsed = extractMessageDetails(m);
        if (parsed && parsed.message_text) {
          saveMessage(parsed);
          emitUpdate('message', parsed);
          console.log(`📩 [Caught] [${parsed.chat_type}] From: ${parsed.sender_name} (${parsed.sender_phone}): "${parsed.message_text.slice(0, 70)}"`);
        }
      }
    });

    return { status: 'connecting' };
  } catch (err) {
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
  addEventListener
};
