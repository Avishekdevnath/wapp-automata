/**
 * In-Memory Message Feed & JSON/SQLite Persistence Store
 */
const fs = require('fs');
const { DATA_DIR, HISTORY_FILE, SQLITE_FILE, formatDateTime } = require('./config');

function saveMessagesToDisk(messages) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages.slice(0, 500), null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write history file:', err.message);
  }
}

function loadSavedMessages() {
  // 1. Try reading persistent JSON file
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) {
        const valid = list.filter(m => (m.text && m.text.trim()) || m.has_media);
        if (valid.length > 0) {
          return valid;
        }
      }
    }
  } catch (err) {
    console.error('Error loading history file:', err.message);
  }

  // 2. If history file is empty, seed from SQLite DB if available
  try {
    if (fs.existsSync(SQLITE_FILE)) {
      const Database = require('better-sqlite3');
      const db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
      const rows = db.prepare(`
        SELECT id, chat_id, sender_id, chat_type, source_name, message_timestamp, message_text, has_media, created_at, status
        FROM messages
        WHERE (message_text IS NOT NULL AND trim(message_text) != '') OR has_media = 1
        ORDER BY created_at DESC
        LIMIT 100
      `).all();
      db.close();

      if (rows && rows.length > 0) {
        const seeded = rows.map(r => {
          let senderPhone = '';
          if (r.sender_id.includes('@s.whatsapp.net')) {
            senderPhone = '+' + r.sender_id.split('@')[0].split(':')[0];
          } else if (r.sender_id.includes('@lid')) {
            senderPhone = 'LID:' + r.sender_id.split('@')[0];
          }

          return {
            id: r.id,
            delivery_id: 'db_' + r.id.slice(0, 8),
            event: 'whatsapp.message.received',
            attempt: 1,
            sender_name: senderPhone || r.sender_id,
            sender_phone: senderPhone,
            chat_name: r.source_name || '',
            chat_type: r.chat_type || 'direct',
            text: r.message_text || '',
            has_media: Boolean(r.has_media),
            timestamp: formatDateTime(r.created_at),
            occurred_at: new Date(r.created_at).toISOString(),
            latency_ms: 12,
            isValid: true,
            headers: { 'x-collector-signature': 'sha256=(stored_in_sqlite)' },
            raw_envelope: {
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
          };
        });
        saveMessagesToDisk(seeded);
        return seeded;
      }
    }
  } catch (err) {
    console.warn('Could not seed history from SQLite:', err.message);
  }

  return [];
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
