import { Router } from 'express';
import {
  getMessages,
  getChatsList,
  getChatMessages,
  getChatTotal,
  deleteChatMessages,
  clearMessages,
  getStats,
  getAllMessagesForExport,
  repairExistingChatNames,
  hasOlderChatMessages,
  hasOlderMessages
} from '../storage/storage.js';
import { getStatus, fetchChatHistory } from '../collector/whatsapp.js';
import { sseClients, broadcastSse } from '../sse.js';

export const messagesRouter = Router();

// Helper to normalize message fields for React Dashboard & UI
export function normalizeMessage(m) {
  if (!m) return m;
  const { raw_json, ...rest } = m;
  return {
    ...rest,
    text: m.message_text || '',
    chat_jid: m.remote_jid,
    occurred_at: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
    is_from_me: Boolean(m.is_from_me),
    has_media: Boolean(m.has_media),
    is_archived: false,
    reply_to: m.quoted_message_id ? {
      messageId: m.quoted_message_id,
      senderId: m.quoted_sender_jid,
      senderName: m.quoted_sender_name,
      quotedText: m.quoted_text
    } : null,
    media: m.has_media ? {
      type: m.media_type || 'image',
      caption: m.message_text || ''
    } : null
  };
}

// 1. Live SSE Stream Endpoint
messagesRouter.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);

  // Send current status immediately on connection
  const initialData = JSON.stringify({ type: 'status', data: getStatus() });
  res.write(`data: ${initialData}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// 2. Query Messages (with filters and date windowing)
messagesRouter.get('/messages', (req, res) => {
  const search = req.query.search || '';
  const filter = req.query.filter || 'all';
  const remoteJid = req.query.remoteJid || null;
  const before = req.query.before ? Number(req.query.before) : null;
  const limitParam = req.query.limit;

  let days = null;
  let limit = '2000';

  if (limitParam === '30d' || req.query.days === '30' || (!limitParam && !req.query.days && !before)) {
    days = 30;
    limit = req.query.limit && !isNaN(req.query.limit) ? req.query.limit : '25000';
  } else if (limitParam === '60d' || req.query.days === '60') {
    days = 60;
    limit = '35000';
  } else if (limitParam === '90d' || req.query.days === '90') {
    days = 90;
    limit = '50000';
  } else if (limitParam === 'all' || req.query.days === 'all') {
    limit = 'all';
    days = null;
  } else if (limitParam) {
    limit = limitParam;
    days = req.query.days ? Number(req.query.days) : null;
  }

  const rawMessages = getMessages({ search, filter, limit, remoteJid, before, days });
  const messages = rawMessages.map(normalizeMessage);
  const stats = getStats();
  const oldestTimestamp = messages.length > 0 ? messages[messages.length - 1].timestamp : null;
  const hasMore = hasOlderMessages(oldestTimestamp);

  res.json({
    count: messages.length,
    loadedCount: messages.length,
    totalInDb: stats.totalMessages || stats.total,
    hasMore,
    oldestTimestamp,
    stats,
    messages
  });
});

// 3. Clear/Delete Messages
messagesRouter.post('/messages/delete', (req, res) => {
  const count = clearMessages();
  broadcastSse('cleared', { count });
  res.json({ success: true, deleted: count });
});

messagesRouter.delete('/messages', (req, res) => {
  const count = clearMessages();
  broadcastSse('cleared', { count });
  res.json({ status: 'ok', deleted: count });
});

// 4. Chats Directory
messagesRouter.get('/chats', (req, res) => {
  const search = req.query.search || '';
  const filter = req.query.filter || 'all';
  const chats = getChatsList({ search, filter });
  res.json({ count: chats.length, chats });
});

// 5. Chat Messages Pagination
messagesRouter.get('/chats/:jid/messages', (req, res) => {
  const { jid } = req.params;
  const limitParam = req.query.limit;
  const before = req.query.before ? Number(req.query.before) : null;
  const search = req.query.search || '';

  let days = null;
  let limit = '150';

  if (limitParam === '30d' || (!limitParam && !req.query.days && !before)) {
    days = 30;
    limit = '150';
  } else if (limitParam === '60d') {
    days = 60;
    limit = '300';
  } else if (limitParam === '90d') {
    days = 90;
    limit = '500';
  } else if (limitParam === 'all') {
    limit = 'all';
    days = null;
  } else if (limitParam) {
    limit = limitParam;
    days = req.query.days ? Number(req.query.days) : null;
  }

  if (before && (req.query.days || limitParam === '30d' || !limitParam)) {
    days = Number(req.query.days) || 30;
  }

  const messages = getChatMessages(jid, { limit, before, days, search });
  const total = getChatTotal(jid);
  const oldestLoaded = messages.length > 0 ? messages[0].timestamp : null;
  const hasMore = oldestLoaded ? hasOlderChatMessages(jid, oldestLoaded) : false;

  res.json({
    jid,
    total,
    totalInDb: total,
    count: messages.length,
    loadedCount: messages.length,
    hasMore,
    oldestTimestamp: oldestLoaded,
    messages
  });
});

// 6. Delete Chat Messages
messagesRouter.delete('/chats/:jid', (req, res) => {
  const { jid } = req.params;
  const count = deleteChatMessages(jid);
  res.json({ success: true, deleted: count });
});

// 7. Repair Chat Names
messagesRouter.post(['/chats/repair-names', '/repair-names'], (req, res) => {
  try {
    const status = getStatus();
    const phone = status.phone || null;
    const name = status.pushName || status.name || 'You';
    const result = repairExistingChatNames(phone, name);
    broadcastSse('names_repaired', result);
    res.json({ status: 'ok', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Fetch History for Specific Chat from Handset
messagesRouter.post(['/chats/:jid/catchup', '/chats/:jid/fetch-history'], async (req, res) => {
  const { jid } = req.params;
  const count = Math.min(Math.max(Number(req.query.count || req.body?.count) || 50, 1), 200);
  const result = await fetchChatHistory(jid, count);
  res.json(result);
});

// 9. Export Single Chat Messages as JSON
messagesRouter.get('/chats/:jid/export', (req, res) => {
  const { jid } = req.params;
  const messages = getChatMessages(jid, { limit: 10000 });
  const safeName = jid.replace(/[^a-zA-Z0-9_-]/g, '_');
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="chat_${safeName}_${Date.now()}.json"`
  });
  res.end(JSON.stringify({ remoteJid: jid, count: messages.length, messages }, null, 2));
});

// 10. Export All Messages as JSON
messagesRouter.get('/export', (req, res) => {
  const messages = getAllMessagesForExport();
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="wapp_messages_${Date.now()}.json"`
  });
  res.end(JSON.stringify(messages, null, 2));
});
