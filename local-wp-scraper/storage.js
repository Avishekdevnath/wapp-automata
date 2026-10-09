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
    raw_json TEXT NOT NULL,
    quoted_message_id TEXT,
    quoted_sender_jid TEXT,
    quoted_sender_name TEXT,
    quoted_text TEXT,
    is_edited INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_caught_ts ON caught_messages (timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_caught_chat ON caught_messages (remote_jid);
  CREATE INDEX IF NOT EXISTS idx_caught_sender ON caught_messages (sender_phone);
  CREATE INDEX IF NOT EXISTS idx_caught_chat_ts ON caught_messages (remote_jid, timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_caught_quoted ON caught_messages (quoted_message_id);
  CREATE INDEX IF NOT EXISTS idx_caught_sender_jid ON caught_messages (sender_jid);
  CREATE INDEX IF NOT EXISTS idx_caught_quoted_sender_jid ON caught_messages (quoted_sender_jid);

  CREATE TABLE IF NOT EXISTS lid_mappings (
    lid TEXT PRIMARY KEY,
    phone_jid TEXT NOT NULL,
    display_name TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_lid_phone ON lid_mappings (phone_jid);
`);

// Safe runtime migration in case an existing DB missed columns or indexes
const columnsToMigrate = [
  ['quoted_message_id', 'TEXT'],
  ['quoted_sender_jid', 'TEXT'],
  ['quoted_sender_name', 'TEXT'],
  ['quoted_text', 'TEXT'],
  ['is_edited', 'INTEGER DEFAULT 0'],
  ['is_deleted', 'INTEGER DEFAULT 0']
];
for (const [col, colType] of columnsToMigrate) {
  try {
    db.prepare(`ALTER TABLE caught_messages ADD COLUMN ${col} ${colType}`).run();
  } catch (_) {}
}
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_caught_sender_jid ON caught_messages (sender_jid);
    CREATE INDEX IF NOT EXISTS idx_caught_quoted_sender_jid ON caught_messages (quoted_sender_jid);
  `);
} catch (_) {}

const saveLidMappingsBatch = db.transaction((mappings) => {
  const insertLid = db.prepare(`
    INSERT OR REPLACE INTO lid_mappings (lid, phone_jid, display_name)
    VALUES (?, ?, COALESCE(?, (SELECT display_name FROM lid_mappings WHERE lid = ?)))
  `);

  let applied = 0;
  for (const item of mappings) {
    const { lid, phoneJid, name } = item;
    if (!lid || !phoneJid) continue;
    insertLid.run(lid, phoneJid, name, lid);
    applied++;
  }

  // Blazing fast bulk SQL updates (indexed)
  db.prepare(`
    UPDATE caught_messages
    SET sender_phone = '+' || SUBSTR((SELECT phone_jid FROM lid_mappings WHERE lid = caught_messages.sender_jid), 1, INSTR((SELECT phone_jid FROM lid_mappings WHERE lid = caught_messages.sender_jid), '@') - 1),
        sender_name = CASE
          WHEN (sender_name IS NULL OR sender_name LIKE 'LID:%' OR sender_name = 'Unknown Sender')
               AND (SELECT display_name FROM lid_mappings WHERE lid = caught_messages.sender_jid) IS NOT NULL
          THEN (SELECT display_name FROM lid_mappings WHERE lid = caught_messages.sender_jid)
          ELSE sender_name
        END
    WHERE sender_jid LIKE '%@lid'
      AND EXISTS (SELECT 1 FROM lid_mappings WHERE lid = caught_messages.sender_jid)
  `).run();

  db.prepare(`
    UPDATE caught_messages
    SET remote_jid = (SELECT phone_jid FROM lid_mappings WHERE lid = caught_messages.remote_jid)
    WHERE remote_jid LIKE '%@lid'
      AND EXISTS (SELECT 1 FROM lid_mappings WHERE lid = caught_messages.remote_jid)
  `).run();

  db.prepare(`
    UPDATE caught_messages
    SET quoted_sender_name = (SELECT display_name FROM lid_mappings WHERE lid = caught_messages.quoted_sender_jid)
    WHERE quoted_sender_jid LIKE '%@lid'
      AND EXISTS (SELECT 1 FROM lid_mappings WHERE lid = caught_messages.quoted_sender_jid AND display_name IS NOT NULL)
  `).run();

  return applied;
});

function saveLidMapping(lid, phoneJid, name) {
  try {
    if (!lid || !phoneJid) return;
    saveLidMappingsBatch([{ lid, phoneJid, name }]);
  } catch (err) {
    console.warn('[Storage] Error saving LID mapping:', err.message);
  }
}

function resolveCanonicalJid(jid) {
  if (!jid || !jid.endsWith('@lid')) return jid;
  try {
    const row = db.prepare('SELECT phone_jid FROM lid_mappings WHERE lid = ?').get(jid);
    return row ? row.phone_jid : jid;
  } catch (_) {
    return jid;
  }
}

function resolveSenderDisplayName(jid) {
  if (!jid) return null;
  try {
    const row = db.prepare('SELECT phone_jid, display_name FROM lid_mappings WHERE lid = ? OR phone_jid = ?').get(jid, jid);
    if (row && row.display_name && !row.display_name.startsWith('LID:')) {
      return row.display_name;
    }
    const msgRow = db.prepare('SELECT sender_name FROM caught_messages WHERE sender_jid = ? AND sender_name NOT LIKE "LID:%" AND sender_name != "Unknown Sender" AND sender_name != "" LIMIT 1').get(jid);
    if (msgRow && msgRow.sender_name) {
      return msgRow.sender_name;
    }
    if (jid.includes('@s.whatsapp.net')) {
      return '+' + jid.split('@')[0].split(':')[0];
    }
    if (row && row.phone_jid) {
      return '+' + row.phone_jid.split('@')[0].split(':')[0];
    }
    return jid.split('@')[0];
  } catch (_) {
    return jid.split('@')[0];
  }
}

function updateEditedMessage(id, newText, newRaw) {
  try {
    if (!id) return null;
    const rawJson = typeof newRaw === 'string' ? newRaw : JSON.stringify(newRaw || {});
    db.prepare(`
      UPDATE caught_messages
      SET message_text = ?, is_edited = 1, raw_json = ?
      WHERE id = ?
    `).run(newText, rawJson, id);
    return db.prepare('SELECT * FROM caught_messages WHERE id = ?').get(id) || null;
  } catch (err) {
    console.error('[Storage] Error updating edited message:', err.message);
    return null;
  }
}

function markMessageDeleted(id) {
  try {
    if (!id) return null;
    db.prepare(`
      UPDATE caught_messages
      SET is_deleted = 1, message_text = '🚫 This message was deleted'
      WHERE id = ?
    `).run(id);
    return db.prepare('SELECT * FROM caught_messages WHERE id = ?').get(id) || null;
  } catch (err) {
    console.error('[Storage] Error marking message deleted:', err.message);
    return null;
  }
}

const insertStmt = db.prepare(`
  INSERT OR REPLACE INTO caught_messages (
    id, remote_jid, chat_name, chat_type, sender_jid, sender_phone,
    sender_name, message_text, has_media, media_type, is_from_me, timestamp, raw_json,
    quoted_message_id, quoted_sender_jid, quoted_sender_name, quoted_text, is_edited, is_deleted
  ) VALUES (
    @id, @remote_jid, @chat_name, @chat_type, @sender_jid, @sender_phone,
    @sender_name, @message_text, @has_media, @media_type, @is_from_me, @timestamp, @raw_json,
    @quoted_message_id, @quoted_sender_jid, @quoted_sender_name, @quoted_text, @is_edited, @is_deleted
  )
`);

function saveMessage(msg) {
  try {
    let remoteJid = resolveCanonicalJid(msg.remote_jid || '');
    let chatName = msg.chat_name || '';

    // If chatName is user's own name, raw JID, or missing, look up existing contact name
    if ((!chatName || chatName === remoteJid || chatName === 'DNA' || chatName === 'Me') && remoteJid) {
      const existing = db.prepare('SELECT chat_name FROM caught_messages WHERE remote_jid = ? AND chat_name != remote_jid AND chat_name != "DNA" AND chat_name != "Me" AND chat_name IS NOT NULL LIMIT 1').get(remoteJid);
      if (existing && existing.chat_name) {
        chatName = existing.chat_name;
      }
    }

    insertStmt.run({
      id: msg.id,
      remote_jid: remoteJid,
      chat_name: chatName,
      chat_type: msg.chat_type || 'direct',
      sender_jid: msg.sender_jid || '',
      sender_phone: msg.sender_phone || '',
      sender_name: msg.sender_name || '',
      message_text: msg.message_text || '',
      has_media: msg.has_media ? 1 : 0,
      media_type: msg.media_type || null,
      is_from_me: msg.is_from_me ? 1 : 0,
      timestamp: msg.timestamp || Date.now(),
      raw_json: typeof msg.raw === 'string' ? msg.raw : JSON.stringify(msg.raw || {}),
      quoted_message_id: msg.quoted_message_id || null,
      quoted_sender_jid: msg.quoted_sender_jid || null,
      quoted_sender_name: msg.quoted_sender_name || null,
      quoted_text: msg.quoted_text || null,
      is_edited: msg.is_edited ? 1 : 0,
      is_deleted: msg.is_deleted ? 1 : 0
    });
    return true;
  } catch (err) {
    console.error('[Storage] Error saving message:', err.message);
    return false;
  }
}

function getMessages(options = {}) {
  const isAll = options.limit === 'all';
  const limit = isAll ? 10000 : Math.min(Math.max(Number(options.limit) || 150, 1), 10000);
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
        let fileName = null;
        if (r.raw_payload) {
          try {
            const p = JSON.parse(r.raw_payload);
            pushName = p.pushName || p.message?.sender_name || null;
            if (p.key?.participantPn && p.key.participantPn.includes('@s.whatsapp.net')) {
              senderPhone = '+' + p.key.participantPn.split('@')[0].split(':')[0];
            }
            const doc = p.message?.documentMessage;
            if (doc?.fileName || doc?.title) {
              fileName = doc.fileName || doc.title;
            }
          } catch (_) {}
        }

        let text = (r.message_text || '').trim();
        if (!text && r.has_media) {
          text = fileName ? `[📄 Document: ${fileName}]` : `[📎 ${r.media_type ? r.media_type.toUpperCase() : 'Media File'}]`;
        }
        if (!text) {
          text = '[Empty / System Event]';
        }

        insertStmt.run({
          id: r.id,
          remote_jid: r.chat_id || '',
          chat_name: r.source_name || r.chat_id || '',
          chat_type: r.chat_type || 'direct',
          sender_jid: r.sender_id || '',
          sender_phone: senderPhone,
          sender_name: pushName || r.source_name || senderPhone || 'Unknown',
          message_text: text,
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

function getChatsList(options = {}) {
  const search = options.search ? `%${options.search.trim()}%` : null;
  const filter = options.filter || 'all';

  let sql = `
    SELECT 
      remote_jid,
      COALESCE(MAX(CASE WHEN chat_name != remote_jid AND chat_name IS NOT NULL THEN chat_name END), MAX(chat_name), remote_jid) as chat_name,
      chat_type,
      COUNT(*) as count,
      MAX(timestamp) as last_ts,
      (SELECT message_text FROM caught_messages m2 WHERE m2.remote_jid = caught_messages.remote_jid ORDER BY timestamp DESC LIMIT 1) as last_text,
      (SELECT sender_name FROM caught_messages m2 WHERE m2.remote_jid = caught_messages.remote_jid ORDER BY timestamp DESC LIMIT 1) as last_sender
    FROM caught_messages
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ' AND (chat_name LIKE ? OR remote_jid LIKE ? OR last_text LIKE ?)';
    params.push(search, search, search);
  }

  if (filter === 'groups') {
    sql += " AND chat_type = 'group'";
  } else if (filter === 'dms') {
    sql += " AND chat_type = 'direct' AND remote_jid != 'status@broadcast'";
  } else if (filter === 'status') {
    sql += " AND remote_jid = 'status@broadcast'";
  } else {
    // Exclude broadcast status stories from normal all chats list
    sql += " AND remote_jid != 'status@broadcast'";
  }

  sql += ' GROUP BY remote_jid ORDER BY last_ts DESC';
  return db.prepare(sql).all(...params);
}

function getChatTotal(remoteJid) {
  try {
    const row = db.prepare('SELECT COUNT(*) as total FROM caught_messages WHERE remote_jid = ?').get(remoteJid);
    return row ? row.total : 0;
  } catch (_) {
    return 0;
  }
}

function getChatMessages(remoteJid, options = {}) {
  let limit;
  if (options.limit === 'all' || !options.limit) {
    limit = 50000;
  } else {
    limit = Math.min(Math.max(Number(options.limit) || 200, 1), 50000);
  }
  const search = options.search ? `%${options.search.trim()}%` : null;

  let innerSql = 'SELECT * FROM caught_messages WHERE remote_jid = ?';
  const params = [remoteJid];

  if (search) {
    innerSql += ' AND (message_text LIKE ? OR sender_name LIKE ? OR sender_phone LIKE ?)';
    params.push(search, search, search);
  }

  innerSql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  // Wrap in outer query to return in chronological order (oldest to newest)
  const sql = `SELECT * FROM (${innerSql}) ORDER BY timestamp ASC`;
  return db.prepare(sql).all(...params);
}

function updateChatName(remoteJid, chatName) {
  try {
    if (!remoteJid || !chatName) return;
    db.prepare('UPDATE caught_messages SET chat_name = ? WHERE remote_jid = ?').run(chatName, remoteJid);
  } catch (err) {
    console.warn('[Storage] Error updating chat name:', err.message);
  }
}

function deleteChatMessages(remoteJid) {
  const info = db.prepare('DELETE FROM caught_messages WHERE remote_jid = ?').run(remoteJid);
  return info.changes;
}

function getRawMessage(id) {
  try {
    if (!id) return undefined;
    const row = db.prepare('SELECT raw_json FROM caught_messages WHERE id = ?').get(id);
    if (row && row.raw_json) {
      const parsed = JSON.parse(row.raw_json);
      return parsed.message || undefined;
    }
  } catch (_) {}
  return undefined;
}

function getLatestMessageTimestamp() {
  try {
    const row = db.prepare('SELECT timestamp FROM caught_messages ORDER BY timestamp DESC LIMIT 1').get();
    return row ? row.timestamp : null;
  } catch (_) {
    return null;
  }
}

function getRecentActiveChats(limit = 20) {
  try {
    const rows = db.prepare(`
      SELECT remote_jid, MAX(timestamp) as last_ts, id as last_id, is_from_me
      FROM caught_messages
      GROUP BY remote_jid
      ORDER BY last_ts DESC
      LIMIT ?
    `).all(limit);
    return rows;
  } catch (_) {
    return [];
  }
}

function getLatestMessageForChat(remoteJid) {
  try {
    return db.prepare('SELECT * FROM caught_messages WHERE remote_jid = ? ORDER BY timestamp DESC LIMIT 1').get(remoteJid);
  } catch (_) {
    return null;
  }
}

module.exports = {
  saveMessage,
  getMessages,
  getAllMessagesForExport,
  clearMessages,
  getStats,
  importFromCollectorDb,
  getChatsList,
  getChatMessages,
  getChatTotal,
  deleteChatMessages,
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
};


