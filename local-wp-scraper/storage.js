/**
 * Isolated SQLite Storage for Local WhatsApp Scraper
 * Uses better-sqlite3 with WAL mode for fast local persistence.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'scraped.sqlite');
const db = new Database(DB_PATH);

// Enable WAL mode for optimal local concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Initialize isolated messages schema
db.exec(`
  CREATE TABLE IF NOT EXISTS caught_messages (
    id TEXT PRIMARY KEY,
    remote_jid TEXT NOT NULL,
    chat_name TEXT,
    chat_type TEXT NOT NULL,
    sender_jid TEXT NOT NULL,
    sender_phone TEXT,
    sender_name TEXT,
    message_text TEXT NOT NULL,
    has_media INTEGER DEFAULT 0,
    media_type TEXT,
    is_from_me INTEGER DEFAULT 0,
    timestamp INTEGER NOT NULL,
    raw_json TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_caught_ts ON caught_messages (timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_caught_chat ON caught_messages (remote_jid);
  CREATE INDEX IF NOT EXISTS idx_caught_sender ON caught_messages (sender_phone);
`);

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO caught_messages (
    id, remote_jid, chat_name, chat_type, sender_jid, sender_phone,
    sender_name, message_text, has_media, media_type, is_from_me, timestamp, raw_json
  ) VALUES (
    @id, @remote_jid, @chat_name, @chat_type, @sender_jid, @sender_phone,
    @sender_name, @message_text, @has_media, @media_type, @is_from_me, @timestamp, @raw_json
  )
`);

function saveMessage(msg) {
  try {
    insertStmt.run({
      id: msg.id,
      remote_jid: msg.remote_jid || '',
      chat_name: msg.chat_name || '',
      chat_type: msg.chat_type || 'direct',
      sender_jid: msg.sender_jid || '',
      sender_phone: msg.sender_phone || '',
      sender_name: msg.sender_name || '',
      message_text: msg.message_text || '',
      has_media: msg.has_media ? 1 : 0,
      media_type: msg.media_type || null,
      is_from_me: msg.is_from_me ? 1 : 0,
      timestamp: msg.timestamp || Date.now(),
      raw_json: typeof msg.raw === 'string' ? msg.raw : JSON.stringify(msg.raw || {})
    });
    return true;
  } catch (err) {
    console.error('[Storage] Error saving message:', err.message);
    return false;
  }
}

function getMessages(options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 1000);
  const search = options.search ? `%${options.search.trim()}%` : null;
  const filter = options.filter || 'all';

  let sql = 'SELECT * FROM caught_messages WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (message_text LIKE ? OR sender_name LIKE ? OR sender_phone LIKE ? OR chat_name LIKE ?)';
    params.push(search, search, search, search);
  }

  if (filter === 'groups') {
    sql += " AND chat_type = 'group'";
  } else if (filter === 'dms') {
    sql += " AND chat_type = 'direct'";
  } else if (filter === 'media') {
    sql += ' AND has_media = 1';
  }

  sql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

function getAllMessagesForExport() {
  return db.prepare('SELECT * FROM caught_messages ORDER BY timestamp DESC').all();
}

function clearMessages() {
  const info = db.prepare('DELETE FROM caught_messages').run();
  try { db.pragma('incremental_vacuum(50)'); } catch (_) {}
  return info.changes;
}

function getStats() {
  const total = db.prepare('SELECT COUNT(*) as c FROM caught_messages').get()?.c || 0;
  const groups = db.prepare("SELECT COUNT(*) as c FROM caught_messages WHERE chat_type = 'group'").get()?.c || 0;
  const dms = db.prepare("SELECT COUNT(*) as c FROM caught_messages WHERE chat_type = 'direct'").get()?.c || 0;
  const senders = db.prepare("SELECT COUNT(DISTINCT sender_phone) as c FROM caught_messages WHERE sender_phone IS NOT NULL AND sender_phone != ''").get()?.c || 0;
  return { total, groups, dms, senders };
}

function importFromCollectorDb() {
  const mainDbPath = path.resolve(__dirname, '..', 'data', 'collector.sqlite');
  if (!fs.existsSync(mainDbPath)) return 0;

  try {
    const mainDb = new Database(mainDbPath, { readonly: true });
    const rows = mainDb.prepare(`
      SELECT id, chat_id, sender_id, chat_type, source_name, message_timestamp, message_text, has_media, media_type, raw_payload, created_at
      FROM messages
      WHERE message_text IS NOT NULL AND trim(message_text) != ''
      ORDER BY created_at DESC
    `).all();
    mainDb.close();

    if (!rows || rows.length === 0) return 0;

    let imported = 0;
    const insertMany = db.transaction((items) => {
      for (const r of items) {
        let senderPhone = '';
        if (r.sender_id && r.sender_id.includes('@s.whatsapp.net')) {
          senderPhone = '+' + r.sender_id.split('@')[0].split(':')[0];
        } else if (r.sender_id && r.sender_id.includes('@lid')) {
          senderPhone = 'LID:' + r.sender_id.split('@')[0];
        }

        let pushName = null;
        if (r.raw_payload) {
          try {
            const p = JSON.parse(r.raw_payload);
            pushName = p.pushName || p.message?.sender_name || null;
            if (p.key?.participantPn && p.key.participantPn.includes('@s.whatsapp.net')) {
              senderPhone = '+' + p.key.participantPn.split('@')[0].split(':')[0];
            }
          } catch (_) {}
        }

        insertStmt.run({
          id: r.id,
          remote_jid: r.chat_id || '',
          chat_name: r.source_name || r.chat_id || '',
          chat_type: r.chat_type || 'direct',
          sender_jid: r.sender_id || '',
          sender_phone: senderPhone,
          sender_name: pushName || r.source_name || senderPhone || 'Unknown',
          message_text: r.message_text || '',
          has_media: r.has_media ? 1 : 0,
          media_type: r.media_type || null,
          is_from_me: 0,
          timestamp: r.message_timestamp ? r.message_timestamp * 1000 : r.created_at || Date.now(),
          raw_json: r.raw_payload || '{}'
        });
        imported++;
      }
    });

    insertMany(rows);
    return imported;
  } catch (err) {
    console.error('[Storage] Error importing from main db:', err.message);
    return 0;
  }
}

module.exports = {
  saveMessage,
  getMessages,
  getAllMessagesForExport,
  clearMessages,
  getStats,
  importFromCollectorDb
};
