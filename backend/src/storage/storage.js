import { getDb } from './db.js';

export function saveLidMappingsBatch(mappings) {
  if (!Array.isArray(mappings) || mappings.length === 0) return 0;
  const db = getDb();

  const insertLid = db.prepare(`
    INSERT OR REPLACE INTO lid_mappings (lid, phone_jid, display_name)
    VALUES (?, ?, COALESCE(?, (SELECT display_name FROM lid_mappings WHERE lid = ?)))
  `);

  const runBatch = db.transaction((items) => {
    let applied = 0;
    for (const item of items) {
      const { lid, phoneJid, name } = item;
      if (!lid || !phoneJid) continue;
      insertLid.run(lid, phoneJid, name, lid);
      applied++;
    }

    // High-speed bulk SQL updates for sender phone and name
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

  return runBatch(mappings);
}

export function saveLidMapping(lid, phoneJid, name) {
  try {
    if (!lid || !phoneJid) return;
    saveLidMappingsBatch([{ lid, phoneJid, name }]);
  } catch (err) {
    console.warn('[Storage] Error saving LID mapping:', err.message);
  }
}

export function resolveCanonicalJid(jid) {
  if (!jid || !jid.endsWith('@lid')) return jid;
  try {
    const db = getDb();
    const row = db.prepare('SELECT phone_jid FROM lid_mappings WHERE lid = ?').get(jid);
    return row ? row.phone_jid : jid;
  } catch (_) {
    return jid;
  }
}

export function resolveSenderDisplayName(jid) {
  if (!jid) return null;
  try {
    const db = getDb();
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

export function saveCaughtMessage(msg) {
  try {
    const db = getDb();
    let remoteJid = resolveCanonicalJid(msg.remote_jid || '');
    let chatName = msg.chat_name || '';

    if ((!chatName || chatName === remoteJid || chatName === 'DNA' || chatName === 'Me') && remoteJid) {
      const existing = db.prepare('SELECT chat_name FROM caught_messages WHERE remote_jid = ? AND chat_name != remote_jid AND chat_name != "DNA" AND chat_name != "Me" AND chat_name IS NOT NULL LIMIT 1').get(remoteJid);
      if (existing && existing.chat_name) {
        chatName = existing.chat_name;
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

export function updateEditedMessage(id, newText, newRaw) {
  try {
    if (!id) return null;
    const db = getDb();
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

export function markMessageDeleted(id) {
  try {
    if (!id) return null;
    const db = getDb();
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

export function getMessages(options = {}) {
  const db = getDb();
  let limit;
  if (options.limit === 'all') {
    limit = 50000;
  } else {
    limit = Math.min(Math.max(Number(options.limit) || 200, 1), 50000);
  }
  const search = options.search ? `%${options.search.trim()}%` : null;
  const filter = options.filter || 'all';
  const remoteJid = options.remoteJid || null;

  let sql = 'SELECT * FROM caught_messages WHERE 1=1';
  const params = [];

  if (remoteJid) {
    sql += ' AND remote_jid = ?';
    params.push(remoteJid);
  }

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

export function getChatsList(options = {}) {
  const db = getDb();
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
    sql += " AND remote_jid != 'status@broadcast'";
  }

  sql += ' GROUP BY remote_jid ORDER BY last_ts DESC';
  return db.prepare(sql).all(...params);
}

export function getChatTotal(remoteJid) {
  try {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as total FROM caught_messages WHERE remote_jid = ?').get(remoteJid);
    return row ? row.total : 0;
  } catch (_) {
    return 0;
  }
}

export function getChatMessages(remoteJid, options = {}) {
  const db = getDb();
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

  const sql = `SELECT * FROM (${innerSql}) ORDER BY timestamp ASC`;
  return db.prepare(sql).all(...params);
}

export function updateChatName(remoteJid, chatName) {
  try {
    if (!remoteJid || !chatName) return;
    const db = getDb();
    db.prepare('UPDATE caught_messages SET chat_name = ? WHERE remote_jid = ?').run(chatName, remoteJid);
  } catch (err) {
    console.warn('[Storage] Error updating chat name:', err.message);
  }
}

export function deleteChatMessages(remoteJid) {
  const db = getDb();
  const info = db.prepare('DELETE FROM caught_messages WHERE remote_jid = ?').run(remoteJid);
  return info.changes;
}

export function clearMessages() {
  const db = getDb();
  const info = db.prepare('DELETE FROM caught_messages').run();
  return info.changes;
}

export function getRawMessage(id) {
  try {
    if (!id) return undefined;
    const db = getDb();
    const row = db.prepare('SELECT raw_json FROM caught_messages WHERE id = ?').get(id);
    if (row && row.raw_json) {
      const parsed = JSON.parse(row.raw_json);
      return parsed.message || undefined;
    }
  } catch (_) {}
  return undefined;
}

export function getStats() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM caught_messages').get().count;
  const groups = db.prepare("SELECT COUNT(DISTINCT remote_jid) as count FROM caught_messages WHERE chat_type = 'group'").get().count;
  const dms = db.prepare("SELECT COUNT(DISTINCT remote_jid) as count FROM caught_messages WHERE chat_type = 'direct'").get().count;
  const media = db.prepare('SELECT COUNT(*) as count FROM caught_messages WHERE has_media = 1').get().count;
  const lastMsg = db.prepare('SELECT timestamp FROM caught_messages ORDER BY timestamp DESC LIMIT 1').get();

  return {
    totalMessages: total,
    uniqueGroups: groups,
    uniqueDms: dms,
    mediaMessages: media,
    lastMessageTimestamp: lastMsg ? lastMsg.timestamp : null
  };
}

export function getAllMessagesForExport() {
  const db = getDb();
  return db.prepare('SELECT * FROM caught_messages ORDER BY timestamp ASC').all();
}
