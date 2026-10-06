/**
 * In-Memory Message Feed & JSON/SQLite Persistence Store
 */
const fs = require('fs');
const { DATA_DIR, HISTORY_FILE, SQLITE_FILE, MAX_HISTORY_MESSAGES, formatDateTime } = require('./config');

function saveMessagesToDisk(messages) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages.slice(0, MAX_HISTORY_MESSAGES), null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write history file:', err.message);
  }
}

function loadSavedMessages() {
  const map = new Map();

  // 1. Read from SQLite DB (up to MAX_HISTORY_MESSAGES) to guarantee lifetime historical retention
  try {
    if (fs.existsSync(SQLITE_FILE)) {
      const Database = require('better-sqlite3');
      const db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
      const rows = db.prepare(`
        SELECT id, chat_id, sender_id, chat_type, source_name, message_timestamp, message_text, has_media, media_type, media_metadata, raw_payload, created_at, status
        FROM messages
        WHERE (message_text IS NOT NULL AND trim(message_text) != '') OR has_media = 1
        ORDER BY created_at DESC
        LIMIT ?
      `).all(MAX_HISTORY_MESSAGES);
      db.close();

      if (rows && rows.length > 0) {
        for (const r of rows) {
          let senderPhone = '';
          if (r.sender_id.includes('@s.whatsapp.net')) {
            senderPhone = '+' + r.sender_id.split('@')[0].split(':')[0];
          } else if (r.sender_id.includes('@lid')) {
            senderPhone = 'LID:' + r.sender_id.split('@')[0];
          }

          let parsedPayload = null;
          let pushName = null;
          let participantPn = null;
          if (r.raw_payload) {
            try {
              parsedPayload = JSON.parse(r.raw_payload);
              pushName = parsedPayload.pushName || parsedPayload.message?.sender_name || null;
              participantPn = parsedPayload.key?.participantPn;
              if (participantPn && participantPn.includes('@s.whatsapp.net')) {
                senderPhone = '+' + participantPn.split('@')[0].split(':')[0];
              }
            } catch (_) {}
          }

          let parsedMedia = null;
          if (r.media_metadata) {
            try { parsedMedia = JSON.parse(r.media_metadata); } catch (_) {}
          }

          const senderDisplay = pushName || senderPhone || r.sender_id;

          map.set(r.id, {
            id: r.id,
            delivery_id: 'db_' + r.id.slice(0, 8),
            event: 'whatsapp.message.received',
            attempt: 1,
            sender_name: senderDisplay,
            sender_phone: senderPhone,
            chat_name: r.source_name || '',
            chat_type: r.chat_type || 'direct',
            text: r.message_text || '',
            has_media: Boolean(r.has_media),
            media: parsedMedia,
            timestamp: formatDateTime(r.created_at),
            occurred_at: new Date(r.created_at).toISOString(),
            latency_ms: 12,
            isValid: true,
            headers: { 'x-collector-signature': 'sha256=(stored_in_sqlite)' },
            raw_envelope: parsedPayload || {
              event: 'whatsapp.message.received',
              message: {
                message_id: r.id,
                chat_id: r.chat_id,
                chat_name: r.source_name,
                chat_type: r.chat_type,
                sender_id: r.sender_id,
                text: r.message_text,
                has_media: Boolean(r.has_media)
              }
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn('Could not load history from SQLite:', err.message);
  }

  // 2. Read persistent JSON file to overlay any in-flight live metadata or forwarder status
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) {
        for (const item of list) {
          if (item && item.id) {
            if (map.has(item.id)) {
              const existing = map.get(item.id);
              map.set(item.id, { ...existing, ...item });
            } else {
              map.set(item.id, item);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error loading history file:', err.message);
  }

  const result = Array.from(map.values());
  result.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
  const capped = result.slice(0, MAX_HISTORY_MESSAGES);
  saveMessagesToDisk(capped);
  return capped;
}

const recentMessages = loadSavedMessages();
const serverStartTime = Date.now();

const stats = {
  totalReceived: 0,
  validSignatures: 0,
  invalidSignatures: 0,
  groupsCount: new Set(),
  sendersCount: new Set()
};

for (const m of recentMessages) {
  stats.totalReceived++;
  if (m.isValid) stats.validSignatures++;
  else stats.invalidSignatures++;
  if (m.chat_name) stats.groupsCount.add(m.chat_name);
  if (m.sender_phone) stats.sendersCount.add(m.sender_phone);
}

module.exports = {
  recentMessages,
  serverStartTime,
  stats,
  saveMessagesToDisk,
  loadSavedMessages
};
