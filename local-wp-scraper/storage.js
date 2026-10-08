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

module.exports = {
  saveMessage,
  getMessages,
  getAllMessagesForExport,
  clearMessages,
  getStats
};
