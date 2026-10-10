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

export function saveGroupsBatch(groups) {
  if (!Array.isArray(groups) || groups.length === 0) return 0;
  const db = getDb();
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO whatsapp_groups (
      jid, subject, owner, creation, description, participants_count, updated_at
    ) VALUES (
      @jid, @subject, @owner, @creation, @description, @participants_count, @updated_at
    )
  `);

  const runBatch = db.transaction((items) => {
    let count = 0;
    const now = Date.now();
    for (const g of items) {
      if (!g.jid || !g.subject) continue;
      insertStmt.run({
        jid: g.jid,
        subject: g.subject,
        owner: g.owner || null,
        creation: g.creation || null,
        description: g.description || null,
        participants_count: g.participants_count || (Array.isArray(g.participants) ? g.participants.length : 0),
        updated_at: now
      });
      count++;
    }

    // High-speed update for caught_messages matching these groups
    db.prepare(`
      UPDATE caught_messages
      SET chat_name = (SELECT subject FROM whatsapp_groups WHERE jid = caught_messages.remote_jid),
          chat_type = 'group'
      WHERE remote_jid LIKE '%@g.us'
        AND EXISTS (SELECT 1 FROM whatsapp_groups WHERE jid = caught_messages.remote_jid)
    `).run();

    return count;
  });

  return runBatch(groups);
}

export function getStoredGroups() {
  try {
    const db = getDb();
    return db.prepare('SELECT * FROM whatsapp_groups ORDER BY updated_at DESC').all();
  } catch (_) {
    return [];
  }
}

export function isInvalidChatName(name, remoteJid) {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (trimmed === remoteJid) return true;
  const lower = trimmed.toLowerCase();
  if (lower === 'me' || lower === 'you' || lower === 'unknown sender' || lower === 'unknown' || lower === 'null' || lower === 'undefined') return true;
  if (trimmed.startsWith('LID:')) return true;
  return false;
}

export function getStoredChatName(remoteJid) {
  if (!remoteJid) return null;
  try {
    const db = getDb();
    if (remoteJid.endsWith('@g.us')) {
      const g = db.prepare('SELECT subject FROM whatsapp_groups WHERE jid = ?').get(remoteJid);
      if (g && g.subject) return g.subject;
    }
    const row = db.prepare(`
      SELECT chat_name FROM caught_messages
      WHERE remote_jid = ?
        AND chat_name IS NOT NULL
        AND chat_name != remote_jid
        AND LOWER(chat_name) NOT IN ('me', 'you', 'unknown sender', 'unknown', 'null', 'undefined')
        AND chat_name NOT LIKE 'LID:%'
      LIMIT 1
    `).get(remoteJid);
    if (row && row.chat_name) return row.chat_name;

    const lidRow = db.prepare('SELECT display_name FROM lid_mappings WHERE (phone_jid = ? OR lid = ?) AND display_name IS NOT NULL AND display_name != "" AND display_name NOT LIKE "LID:%" LIMIT 1').get(remoteJid, remoteJid);
    if (lidRow && lidRow.display_name) return lidRow.display_name;

    return null;
  } catch (_) {
    return null;
  }
}

export function saveCaughtMessage(msg) {
  try {
    const db = getDb();
    let remoteJid = resolveCanonicalJid(msg.remote_jid || '');
    let chatName = msg.chat_name || '';

    // If chatName is invalid or missing, resolve a proper name
    if (isInvalidChatName(chatName, remoteJid)) {
      chatName = getStoredChatName(remoteJid) || '';
      if (!chatName) {
        if (remoteJid.endsWith('@s.whatsapp.net')) {
          chatName = '+' + remoteJid.split('@')[0].split(':')[0];
        } else if (remoteJid.endsWith('@g.us')) {
          chatName = 'Group: ' + remoteJid.split('@')[0];
        } else {
          chatName = remoteJid;
        }
      }
    }

    let senderName = msg.sender_name || '';
    if (msg.is_from_me) {
      if (!senderName || senderName.toLowerCase() === 'me' || senderName === 'Unknown Sender') {
        senderName = 'You';
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
      chat_type: msg.chat_type || (remoteJid.endsWith('@g.us') ? 'group' : 'direct'),
      sender_jid: msg.sender_jid || '',
      sender_phone: msg.sender_phone || '',
      sender_name: senderName,
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
  const search = options.search ? `%${options.search.trim()}%` : null;
  const filter = options.filter || 'all';
  const remoteJid = options.remoteJid || null;
  const before = options.before ? Number(options.before) : null;
  const days = options.days ? Number(options.days) : null;

  let limit;
  if (options.limit === 'all') {
    limit = 50000;
  } else if (options.limit) {
    limit = Math.min(Math.max(Number(options.limit) || 2000, 1), 50000);
  } else if (days) {
    limit = 25000;
  } else {
    limit = 2000;
  }

  let sql = 'SELECT * FROM caught_messages WHERE 1=1';
  const params = [];

  if (remoteJid) {
    sql += ' AND remote_jid = ?';
    params.push(remoteJid);
  }

  if (before) {
    sql += ' AND timestamp < ?';
    params.push(before);
  }

  if (days && !search) {
    let refTs = before;
    if (!refTs) {
      const latestRow = db.prepare('SELECT timestamp FROM caught_messages ORDER BY timestamp DESC LIMIT 1').get();
      refTs = latestRow ? latestRow.timestamp : null;
    }
    if (refTs) {
      const minTs = refTs - (days * 86400000);
      sql += ' AND timestamp >= ?';
      params.push(minTs);
    }
  }

  if (search) {
    sql += ' AND (message_text LIKE ? OR sender_name LIKE ? OR sender_phone LIKE ? OR chat_name LIKE ?)';
    params.push(search, search, search, search);
  }

  if (filter === 'groups' || filter === 'group') {
    sql += " AND chat_type = 'group'";
  } else if (filter === 'dms' || filter === 'direct') {
    sql += " AND chat_type = 'direct'";
  } else if (filter === 'media') {
    sql += ' AND has_media = 1';
  } else if (filter === 'sent') {
    sql += ' AND is_from_me = 1';
  }

  sql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  let rows = db.prepare(sql).all(...params);

  if (!before && !search && days && rows.length < 50) {
    const fallbackSql = 'SELECT * FROM caught_messages ORDER BY timestamp DESC LIMIT 50';
    const fallbackRows = db.prepare(fallbackSql).all();
    if (fallbackRows.length > rows.length) {
      rows = fallbackRows;
    }
  }

  return rows;
}

export function hasOlderMessages(oldestTimestamp) {
  try {
    if (!oldestTimestamp) return false;
    const db = getDb();
    const row = db.prepare('SELECT 1 FROM caught_messages WHERE timestamp < ? LIMIT 1').get(oldestTimestamp);
    return Boolean(row);
  } catch (_) {
    return false;
  }
}

export function getChatsList(options = {}) {
  const db = getDb();
  const search = options.search ? `%${options.search.trim()}%` : null;
  const filter = options.filter || 'all';

  let sql = `
    WITH active_chats AS (
      SELECT 
        c.remote_jid,
        COALESCE(
          (SELECT subject FROM whatsapp_groups WHERE jid = c.remote_jid),
          MAX(CASE 
            WHEN c.chat_name IS NOT NULL 
             AND c.chat_name != c.remote_jid 
             AND LOWER(c.chat_name) NOT IN ('me', 'you', 'unknown sender', 'unknown', 'null', 'undefined')
             AND c.chat_name NOT LIKE 'LID:%'
            THEN c.chat_name 
          END),
          (SELECT display_name FROM lid_mappings WHERE (phone_jid = c.remote_jid OR lid = c.remote_jid) AND display_name IS NOT NULL AND display_name != '' AND display_name NOT LIKE 'LID:%' LIMIT 1),
          MAX(CASE 
            WHEN c.remote_jid LIKE '%@s.whatsapp.net' 
            THEN '+' || SUBSTR(c.remote_jid, 1, INSTR(c.remote_jid, '@') - 1)
            WHEN c.remote_jid LIKE '%@g.us'
            THEN 'Group: ' || SUBSTR(c.remote_jid, 1, INSTR(c.remote_jid, '@') - 1)
            ELSE c.remote_jid
          END)
        ) as chat_name,
        c.chat_type,
        COUNT(*) as count,
        MAX(c.timestamp) as last_ts,
        (SELECT message_text FROM caught_messages m2 WHERE m2.remote_jid = c.remote_jid ORDER BY timestamp DESC LIMIT 1) as last_text,
        (SELECT sender_name FROM caught_messages m2 WHERE m2.remote_jid = c.remote_jid ORDER BY timestamp DESC LIMIT 1) as last_sender
      FROM caught_messages c
      WHERE c.remote_jid != 'status@broadcast'
      GROUP BY c.remote_jid
    ),
    all_groups AS (
      SELECT
        g.jid as remote_jid,
        g.subject as chat_name,
        'group' as chat_type,
        0 as count,
        0 as last_ts,
        'Group joined (' || g.participants_count || ' members)' as last_text,
        'System' as last_sender
      FROM whatsapp_groups g
      WHERE NOT EXISTS (SELECT 1 FROM caught_messages WHERE remote_jid = g.jid)
    ),
    combined_chats AS (
      SELECT * FROM active_chats
      UNION ALL
      SELECT * FROM all_groups
    )
    SELECT * FROM combined_chats
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
    sql += " AND chat_type = 'direct'";
  }

  sql += ' ORDER BY (count > 0) DESC, last_ts DESC';
  return db.prepare(sql).all(...params);
}

export function repairExistingChatNames(userPhone = null, userName = 'You') {
  try {
    const db = getDb();
    console.log('[Storage] Running comprehensive chat and sender name repair...');

    const runRepair = db.transaction(() => {
      // 1. Repair outgoing sender_name where it was saved as 'me'
      const infoMe = db.prepare(`
        UPDATE caught_messages
        SET sender_name = ?,
            sender_phone = CASE WHEN (sender_phone IS NULL OR sender_phone = '' OR sender_phone = 'me') AND ? IS NOT NULL THEN ? ELSE sender_phone END
        WHERE is_from_me = 1
          AND (sender_name IS NULL OR LOWER(sender_name) IN ('me', 'unknown sender', ''))
      `).run(userName || 'You', userPhone, userPhone);

      // 2. Repair groups chat_name from whatsapp_groups
      const infoGroups = db.prepare(`
        UPDATE caught_messages
        SET chat_name = (SELECT subject FROM whatsapp_groups WHERE jid = caught_messages.remote_jid),
            chat_type = 'group'
        WHERE remote_jid LIKE '%@g.us'
          AND EXISTS (SELECT 1 FROM whatsapp_groups WHERE jid = caught_messages.remote_jid)
      `).run();

      // 3. Repair DMs where chat_name was set to 'me', 'you', null, or raw LID
      const infoLidDms = db.prepare(`
        UPDATE caught_messages
        SET chat_name = (SELECT display_name FROM lid_mappings WHERE (phone_jid = caught_messages.remote_jid OR lid = caught_messages.remote_jid) AND display_name IS NOT NULL AND display_name != '' AND display_name NOT LIKE 'LID:%' LIMIT 1)
        WHERE (chat_name IS NULL OR LOWER(chat_name) IN ('me', 'you', 'unknown sender', 'unknown', '') OR chat_name LIKE '%@lid' OR chat_name LIKE 'LID:%')
          AND remote_jid NOT LIKE '%@g.us'
          AND EXISTS (SELECT 1 FROM lid_mappings WHERE (phone_jid = caught_messages.remote_jid OR lid = caught_messages.remote_jid) AND display_name IS NOT NULL AND display_name != '' AND display_name NOT LIKE 'LID:%')
      `).run();

      // For remaining DMs with invalid chat_name, copy from another message in same chat
      const infoOtherMsgs = db.prepare(`
        UPDATE caught_messages
        SET chat_name = (
          SELECT m2.chat_name FROM caught_messages m2
          WHERE m2.remote_jid = caught_messages.remote_jid
            AND m2.chat_name IS NOT NULL
            AND m2.chat_name != m2.remote_jid
            AND LOWER(m2.chat_name) NOT IN ('me', 'you', 'unknown sender', 'unknown', 'null', 'undefined', '')
            AND m2.chat_name NOT LIKE 'LID:%'
          LIMIT 1
        )
        WHERE (chat_name IS NULL OR LOWER(chat_name) IN ('me', 'you', 'unknown sender', 'unknown', '') OR chat_name LIKE '%@lid' OR chat_name LIKE 'LID:%')
          AND remote_jid NOT LIKE '%@g.us'
          AND EXISTS (
            SELECT 1 FROM caught_messages m2
            WHERE m2.remote_jid = caught_messages.remote_jid
              AND m2.chat_name IS NOT NULL
              AND m2.chat_name != m2.remote_jid
              AND LOWER(m2.chat_name) NOT IN ('me', 'you', 'unknown sender', 'unknown', 'null', 'undefined', '')
              AND m2.chat_name NOT LIKE 'LID:%'
          )
      `).run();

      // Format remaining direct messages as +phone
      const infoPhoneDms = db.prepare(`
        UPDATE caught_messages
        SET chat_name = '+' || SUBSTR(remote_jid, 1, INSTR(remote_jid, '@') - 1)
        WHERE (chat_name IS NULL OR LOWER(chat_name) IN ('me', 'you', 'unknown sender', 'unknown', '') OR chat_name = remote_jid OR chat_name LIKE '%@lid' OR chat_name LIKE 'LID:%')
          AND remote_jid LIKE '%@s.whatsapp.net'
      `).run();

      // Ensure chat_type is properly set
      db.prepare(`
        UPDATE caught_messages
        SET chat_type = 'group'
        WHERE remote_jid LIKE '%@g.us' AND chat_type != 'group'
      `).run();

      db.prepare(`
        UPDATE caught_messages
        SET chat_type = 'direct'
        WHERE remote_jid NOT LIKE '%@g.us' AND remote_jid != 'status@broadcast' AND chat_type != 'direct'
      `).run();

      return {
        repairedMe: infoMe.changes,
        repairedGroups: infoGroups.changes,
        repairedLidDms: infoLidDms.changes,
        repairedOtherMsgs: infoOtherMsgs.changes,
        repairedPhoneDms: infoPhoneDms.changes
      };
    });

    const res = runRepair();
    console.log(`✅ [Storage] Repaired chat names: ${JSON.stringify(res)}`);
    return res;
  } catch (err) {
    console.error('[Storage] Error during repairExistingChatNames:', err.message);
    return null;
  }
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
  const search = options.search ? `%${options.search.trim()}%` : null;
  const before = options.before ? Number(options.before) : null;
  const days = options.days ? Number(options.days) : null;

  let limit;
  if (options.limit === 'all') {
    limit = 10000;
  } else {
    limit = Math.min(Math.max(Number(options.limit) || 150, 1), 5000);
  }

  let innerSql = 'SELECT * FROM caught_messages WHERE remote_jid = ?';
  const params = [remoteJid];

  if (before) {
    innerSql += ' AND timestamp < ?';
    params.push(before);
  }

  if (days && !search) {
    // If days is specified (e.g. 30), calculate timestamp threshold relative to the reference point (before or latest)
    let refTs = before;
    if (!refTs) {
      const latestRow = db.prepare('SELECT timestamp FROM caught_messages WHERE remote_jid = ? ORDER BY timestamp DESC LIMIT 1').get(remoteJid);
      refTs = latestRow ? latestRow.timestamp : null;
    }
    if (refTs) {
      const minTs = refTs - (days * 86400000);
      innerSql += ' AND timestamp >= ?';
      params.push(minTs);
    }
  }

  if (search) {
    innerSql += ' AND (message_text LIKE ? OR sender_name LIKE ? OR sender_phone LIKE ?)';
    params.push(search, search, search);
  }

  innerSql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const sql = `SELECT * FROM (${innerSql}) ORDER BY timestamp ASC`;
  let rows = db.prepare(sql).all(...params);

  // If days filter resulted in very few messages (e.g. inactive chat in those 30 days) and no 'before' was given,
  // ensure at least min 30-50 messages are returned so user doesn't see an empty screen
  if (!before && !search && days && rows.length < 30) {
    const fallbackSql = `SELECT * FROM (SELECT * FROM caught_messages WHERE remote_jid = ? ORDER BY timestamp DESC LIMIT 50) ORDER BY timestamp ASC`;
    const fallbackRows = db.prepare(fallbackSql).all(remoteJid);
    if (fallbackRows.length > rows.length) {
      rows = fallbackRows;
    }
  }

  return rows;
}

export function hasOlderChatMessages(remoteJid, oldestTimestamp) {
  try {
    if (!remoteJid || !oldestTimestamp) return false;
    const db = getDb();
    const row = db.prepare('SELECT 1 FROM caught_messages WHERE remote_jid = ? AND timestamp < ? LIMIT 1').get(remoteJid, oldestTimestamp);
    return Boolean(row);
  } catch (_) {
    return false;
  }
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

export function clearGroups() {
  const db = getDb();
  const info = db.prepare('DELETE FROM whatsapp_groups').run();
  return info.changes;
}

export function clearLidMappings() {
  const db = getDb();
  const info = db.prepare('DELETE FROM lid_mappings').run();
  return info.changes;
}

export function deleteWhatsAppSessionData() {
  const db = getDb();
  const msgs = db.prepare('DELETE FROM caught_messages').run().changes;
  const grps = db.prepare('DELETE FROM whatsapp_groups').run().changes;
  const lids = db.prepare('DELETE FROM lid_mappings').run().changes;
  return { msgs, grps, lids };
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
  const groupCountRow = db.prepare(`
    SELECT COUNT(DISTINCT jid) as count FROM (
      SELECT remote_jid as jid FROM caught_messages WHERE chat_type = 'group'
      UNION
      SELECT jid FROM whatsapp_groups
    )
  `).get();
  const groups = groupCountRow ? groupCountRow.count : 0;
  const dms = db.prepare("SELECT COUNT(DISTINCT remote_jid) as count FROM caught_messages WHERE chat_type = 'direct'").get().count;
  const media = db.prepare('SELECT COUNT(*) as count FROM caught_messages WHERE has_media = 1').get().count;
  const lastMsg = db.prepare('SELECT timestamp FROM caught_messages ORDER BY timestamp DESC LIMIT 1').get();
  const membersRow = db.prepare('SELECT COUNT(*) as count FROM lid_mappings').get();
  const resolvedMembers = membersRow ? membersRow.count : 0;

  return {
    totalMessages: total,
    total,
    uniqueGroups: groups,
    groups,
    uniqueDms: dms,
    dms,
    mediaMessages: media,
    resolvedMembers,
    lastMessageTimestamp: lastMsg ? lastMsg.timestamp : null
  };
}

export function getAllMessagesForExport() {
  const db = getDb();
  return db.prepare('SELECT * FROM caught_messages ORDER BY timestamp ASC').all();
}
