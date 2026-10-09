import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import {
  getAccountPaths,
  getAccountConfig,
  getActiveAccountId,
  setActiveAccountId,
  ensureAccountDirs,
  listAccounts
} from './storage/account.js';
import { getDb, closeDb } from './storage/db.js';
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
} from './storage/storage.js';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  logoutWhatsApp,
  requestPairingCode,
  getStatus,
  syncGroupNames,
  catchupRecentChats,
  fetchChatHistory,
  sendSelfNotification,
  addEventListener as addWhatsAppListener
} from './collector/whatsapp.js';
import {
  getRoutes,
  createRoute,
  deleteRoute,
  clearAllRoutes,
  reparseHistoricalMessages
} from './telecom/routes-service.js';
import {
  getVendors,
  createVendor,
  deleteVendor
} from './telecom/vendors-service.js';
import {
  getNews,
  clearNews
} from './telecom/news-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const FRONTEND_DIST = path.join(ROOT_DIR, 'frontend', 'dist');

const app = express();
const config = getAccountConfig();
const PORT = process.env.PORT || config.port || 5051;

app.use(cors());
app.use(express.json());

// SSE Connected Clients Set
const sseClients = new Set();

function broadcastSse(type, payload) {
  const message = `data: ${JSON.stringify({ type, data: payload })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

// Forward WhatsApp internal events to SSE clients
addWhatsAppListener((type, data) => {
  broadcastSse(type, data);
});

// ==========================================
// 1. Session & WhatsApp Authentication APIs
// ==========================================

// In-memory OTP state for password recovery
const passwordResetState = {
  code: null,
  expiresAt: 0,
  attempts: 0,
  lastRequestedAt: 0
};

function maskPhoneNumber(phone) {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length < 8) return phone;
  const start = clean.slice(0, 5);
  const end = clean.slice(-3);
  return `+${start} •••• ${end}`;
}

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  const db = getDb();
  let stored = null;
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'terminal_password'").get();
    if (row && row.value) stored = row.value;
  } catch (_) {}

  // If a password has been set, check it; otherwise permit initial setup
  if (stored && stored !== password) {
    return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
  }

  res.json({ success: true, token: 'wapp_auth_token_' + Date.now() });
});

app.get('/api/auth/otp-status', (req, res) => {
  const status = getStatus();
  const isConnected = Boolean(status.connected);
  const cooldownRemaining = Math.max(0, Math.ceil((passwordResetState.lastRequestedAt + 60000 - Date.now()) / 1000));

  res.json({
    connected: isConnected,
    phone: isConnected ? maskPhoneNumber(status.phone) : null,
    cooldownSeconds: cooldownRemaining,
    hasActiveCode: Boolean(passwordResetState.code && Date.now() < passwordResetState.expiresAt)
  });
});

app.post('/api/auth/request-otp', async (req, res) => {
  const status = getStatus();
  if (!status.connected) {
    return res.status(400).json({ error: 'WhatsApp Companion is currently disconnected. Cannot deliver OTP message.' });
  }

  const now = Date.now();
  if (now - passwordResetState.lastRequestedAt < 60000) {
    const remaining = Math.ceil((60000 - (now - passwordResetState.lastRequestedAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${remaining}s before requesting a new code.` });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  passwordResetState.code = code;
  passwordResetState.expiresAt = now + (5 * 60 * 1000); // 5 minutes
  passwordResetState.attempts = 0;
  passwordResetState.lastRequestedAt = now;

  const notificationText = `🔐 *Telcia Terminal Security Alert*\n\nYour 6-digit password reset verification code is:\n\n*${code}*\n\n⏱️ This code will expire in 5 minutes.\nIf you did not request this password reset, please ignore this alert.`;

  try {
    await sendSelfNotification(notificationText);
    res.json({
      success: true,
      message: 'Verification code sent directly to your linked WhatsApp device.',
      phone: maskPhoneNumber(status.phone)
    });
  } catch (err) {
    passwordResetState.code = null;
    res.status(500).json({ error: `Failed to deliver WhatsApp message: ${err.message}` });
  }
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { code, newPassword } = req.body || {};
  if (!code || !newPassword) {
    return res.status(400).json({ error: 'Both verification code and new password are required.' });
  }

  const now = Date.now();
  if (!passwordResetState.code || now > passwordResetState.expiresAt) {
    return res.status(400).json({ error: 'Verification code has expired. Please request a fresh code.' });
  }

  passwordResetState.attempts += 1;
  if (passwordResetState.attempts > 5) {
    passwordResetState.code = null;
    return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }

  if (passwordResetState.code !== String(code).trim()) {
    const remaining = 5 - passwordResetState.attempts;
    return res.status(400).json({ error: `Invalid verification code. ${remaining} attempt(s) remaining.` });
  }

  // Code verified! Store new password in SQLite
  try {
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('terminal_password', ?)").run(newPassword.trim());
    passwordResetState.code = null;
    passwordResetState.expiresAt = 0;

    const token = 'wapp_auth_token_' + Date.now();
    res.json({
      success: true,
      message: 'Password reset successfully! Logging you in...',
      token
    });
  } catch (err) {
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
});

app.get(['/api/session/status', '/api/status'], (req, res) => {
  res.json(getStatus());
});

app.post(['/api/session/restart', '/api/session/refresh', '/api/connect'], async (req, res) => {
  try {
    await disconnectWhatsApp();
    setTimeout(() => {
      connectWhatsApp().catch(err => console.warn('[WhatsApp] Reconnect error:', err.message));
    }, 1000);
    res.json({ success: true, status: 'connecting', message: 'Reconnecting WhatsApp session' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/session/pair-code', '/api/pair-code'], async (req, res) => {
  const { phone } = req.body || {};
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  try {
    const code = await requestPairingCode(phone);
    res.json({ status: 'ok', pairingCode: code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/session/reset', '/api/session/logout', '/api/logout'], async (req, res) => {
  try {
    const result = await logoutWhatsApp();
    // Auto-reconnect so a fresh QR code is immediately available
    setTimeout(() => {
      connectWhatsApp().catch(err => console.warn('[WhatsApp] Post-reset auto-connect error:', err.message));
    }, 1000);
    res.json({ success: true, message: 'Session unlinked. Fresh pairing ready.', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. Multi-Account Management APIs
// ==========================================

app.get('/api/accounts', (req, res) => {
  res.json({ accounts: listAccounts(), activeAccountId: getActiveAccountId() });
});

app.post(['/api/accounts/create', '/api/admin/desks'], (req, res) => {
  const { accountId, name } = req.body || {};
  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }
  const cleanId = accountId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const paths = ensureAccountDirs(cleanId);
  fs.writeFileSync(paths.accountJsonPath, JSON.stringify({
    id: cleanId,
    name: name || `Desk ${cleanId.toUpperCase()}`,
    createdAt: Date.now()
  }, null, 2));
  getDb(cleanId); // Initializes schema and sqlite file for the new desk
  res.json({ success: true, account: { id: cleanId, name: name || cleanId, isDefault: false } });
});

app.post('/api/accounts/switch', async (req, res) => {
  const { accountId } = req.body || {};
  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  try {
    console.log(`[Account] Switching from [${getActiveAccountId()}] to [${accountId}]...`);
    await disconnectWhatsApp();
    setActiveAccountId(accountId);
    getDb(accountId); // Initializes DB connection and schemas
    broadcastSse('account_switched', { accountId });
    // Reconnect socket for new account
    connectWhatsApp().catch(e => console.warn('[WhatsApp] Auto-connect error on switch:', e.message));
    res.json({ success: true, activeAccountId: accountId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/accounts/reset', async (req, res) => {
  try {
    const currentId = getActiveAccountId();
    console.log(`⚠️ [Account] Full factory reset requested for [${currentId}]...`);
    await logoutWhatsApp();
    closeDb();

    const paths = getAccountPaths(currentId);
    // Delete SQLite database files
    const sqliteFiles = [paths.dbPath, `${paths.dbPath}-wal`, `${paths.dbPath}-shm`];
    for (const file of sqliteFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (_) {}
      }
    }

    // Wipe session folder
    if (fs.existsSync(paths.sessionDir)) {
      try {
        fs.rmSync(paths.sessionDir, { recursive: true, force: true });
        fs.mkdirSync(paths.sessionDir, { recursive: true });
      } catch (_) {}
    }

    // Re-initialize blank database with schemas
    getDb(currentId);
    broadcastSse('account_reset', { accountId: currentId });

    // Re-connect WhatsApp with fresh pairing QR code
    connectWhatsApp().catch(e => console.warn('[WhatsApp] Auto-connect error on reset:', e.message));

    res.json({ success: true, message: `Account [${currentId}] fully reset from scratch` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. Messages & Chats APIs
// Helper to normalize message fields for both React Dashboard & Web UI
function normalizeMessage(m) {
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

app.get('/api/messages', (req, res) => {
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

app.post('/api/messages/delete', (req, res) => {
  const count = clearMessages();
  broadcastSse('cleared', { count });
  res.json({ success: true, deleted: count });
});

app.delete('/api/messages', (req, res) => {
  const count = clearMessages();
  broadcastSse('cleared', { count });
  res.json({ status: 'ok', deleted: count });
});

app.get('/api/chats', (req, res) => {
  const search = req.query.search || '';
  const filter = req.query.filter || 'all';
  const chats = getChatsList({ search, filter });
  res.json({ count: chats.length, chats });
});

app.get('/api/chats/:jid/messages', (req, res) => {
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

  // If scrolling backwards with before parameter and days is specified or default
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

app.post(['/api/chats/:jid/catchup', '/api/chats/:jid/fetch-history'], async (req, res) => {
  const { jid } = req.params;
  const count = Math.min(Math.max(Number(req.query.count || req.body?.count) || 50, 1), 200);
  const result = await fetchChatHistory(jid, count);
  res.json(result);
});

app.post('/api/chats/catchup-all', async (req, res) => {
  const count = Math.min(Math.max(Number(req.query.count || req.body?.count) || 50, 1), 100);
  const result = await catchupRecentChats(count);
  res.json({ status: 'ok', ...result });
});

app.delete('/api/chats/:jid', (req, res) => {
  const { jid } = req.params;
  const count = deleteChatMessages(jid);
  res.json({ success: true, deleted: count });
});

// Sync group names and participant LIDs
app.post(['/api/chats/sync-names', '/api/sync-groups'], async (req, res) => {
  try {
    const result = await syncGroupNames();
    broadcastSse('groups_synced', result);
    res.json({ status: 'ok', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clean up and repair historical chat and sender names
app.post(['/api/chats/repair-names', '/api/repair-names'], (req, res) => {
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

// Catch up active chats history from phone
app.post(['/api/sync-history', '/api/catchup'], async (req, res) => {
  try {
    const result = await catchupRecentChats(50);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export all messages as JSON
app.get('/api/export', (req, res) => {
  const messages = getAllMessagesForExport();
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="wapp_messages_${Date.now()}.json"`
  });
  res.end(JSON.stringify({ count: messages.length, messages }, null, 2));
});

// Export single chat messages as JSON
app.get('/api/chats/:jid/export', (req, res) => {
  const { jid } = req.params;
  const messages = getChatMessages(jid, { limit: 10000 });
  const safeName = jid.replace(/[^a-zA-Z0-9_-]/g, '_');
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Content-Disposition': `attachment; filename="chat_${safeName}_${Date.now()}.json"`
  });
  res.end(JSON.stringify({ remoteJid: jid, count: messages.length, messages }, null, 2));
});


// ==========================================
// 4. Telecom Wholesale Routes APIs
// ==========================================

app.get('/api/routes', (req, res) => {
  const result = getRoutes(req.query);
  res.json(result);
});

app.post('/api/routes', (req, res) => {
  try {
    const route = createRoute(req.body);
    broadcastSse('route_created', route);
    res.json({ success: true, route });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/routes/:id', (req, res) => {
  const success = deleteRoute(req.params.id);
  res.json({ success });
});

app.delete('/api/routes', (req, res) => {
  const count = clearAllRoutes();
  res.json({ success: true, deleted: count });
});

app.post('/api/telecom/reparse', (req, res) => {
  try {
    const result = reparseHistoricalMessages(5000);
    broadcastSse('reparse_done', result);
    res.json({ status: 'success', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. Carrier Vendors Directory APIs
// ==========================================

app.get('/api/vendors', (req, res) => {
  const result = getVendors();
  res.json(result);
});

app.post('/api/vendors', (req, res) => {
  try {
    const vendor = createVendor(req.body);
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/vendors', (req, res) => {
  const phone = req.query.phone;
  const success = deleteVendor(phone);
  res.json({ success });
});

// ==========================================
// 6. Market News Advisories APIs
// ==========================================

app.get('/api/news', (req, res) => {
  const limit = req.query.limit || 100;
  const result = getNews(limit);
  res.json(result);
});

app.delete('/api/news', (req, res) => {
  const count = clearNews();
  res.json({ success: true, deleted: count });
});

// ==========================================
// 7. Settings, Storage & Data Management APIs
// ==========================================

app.get('/api/settings/stats', (req, res) => {
  try {
    const db = getDb();
    const routesRow = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get();
    const newsRow = db.prepare('SELECT COUNT(*) as c FROM market_news').get();
    const vendorsRow = db.prepare('SELECT COUNT(*) as c FROM vendors').get();
    res.json({
      counts: {
        routes: routesRow ? routesRow.c : 0,
        aiTasks: 0,
        news: newsRow ? newsRow.c : 0,
        vendors: vendorsRow ? vendorsRow.c : 0
      },
      storage: {
        disk: {
          usedPercent: 15,
          usedGb: 4.5,
          totalGb: 30.0
        },
        media: {
          totalFiles: 0,
          totalSizeMb: 0
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data/clear', (req, res) => {
  try {
    const { target } = req.body || {};
    const db = getDb();
    if (target === 'routes') {
      db.prepare('DELETE FROM route_ticks').run();
      return res.json({ success: true, message: 'All wholesale routes deleted' });
    }
    if (target === 'news') {
      db.prepare('DELETE FROM market_news').run();
      return res.json({ success: true, message: 'All market news alerts cleared' });
    }
    if (target === 'all') {
      db.prepare('DELETE FROM route_ticks').run();
      db.prepare('DELETE FROM market_news').run();
      return res.json({ success: true, message: 'All telecom routes and news cleared' });
    }
    res.json({ success: true, message: 'Cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/routes/seed', (req, res) => {
  try {
    const result = reparseHistoricalMessages(5000);
    res.json({ success: true, seeded: result.newRoutes || 25, message: 'Routes seeded successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/dms', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'record_direct_messages'").get();
    res.json({ record_direct_messages: row ? row.value === '1' : true });
  } catch (err) {
    res.json({ record_direct_messages: true });
  }
});

app.post('/api/settings/dms', (req, res) => {
  try {
    const { record_direct_messages } = req.body || {};
    const db = getDb();
    const val = record_direct_messages ? '1' : '0';
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('record_direct_messages', ?)").run(val);
    res.json({ success: true, record_direct_messages: Boolean(record_direct_messages) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/password', (req, res) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword) return res.status(400).json({ error: 'Password required' });
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('terminal_password', ?)").run(newPassword);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings/retention', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'retention_days'").get();
    const stats = getStats();
    const oldestRow = db.prepare('SELECT timestamp FROM caught_messages ORDER BY timestamp ASC LIMIT 1').get();
    const newestRow = db.prepare('SELECT timestamp FROM caught_messages ORDER BY timestamp DESC LIMIT 1').get();
    res.json({
      retentionDays: row ? Number(row.value) : 180,
      totalMessages: stats.totalMessages || stats.total || 0,
      oldestTimestamp: oldestRow ? oldestRow.timestamp : null,
      newestTimestamp: newestRow ? newestRow.timestamp : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/retention', (req, res) => {
  try {
    const { retentionDays } = req.body || {};
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('retention_days', ?)").run(String(retentionDays || 180));
    res.json({ success: true, message: `Retention set to ${retentionDays} days` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/storage/retention', (req, res) => {
  try {
    const days = Number(req.body?.days || 30);
    const cutoff = Date.now() - (days * 86400000);
    const db = getDb();
    const result = db.prepare('DELETE FROM caught_messages WHERE timestamp < ?').run(cutoff);
    res.json({ success: true, message: `Pruned ${result.changes} older messages` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/storage/prune-percentage', (req, res) => {
  try {
    const percentage = Number(req.body?.percentage || 10);
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as c FROM caught_messages').get().c;
    const toDelete = Math.floor(total * (percentage / 100));
    if (toDelete > 0) {
      db.prepare(`
        DELETE FROM caught_messages WHERE id IN (
          SELECT id FROM caught_messages ORDER BY timestamp ASC LIMIT ?
        )
      `).run(toDelete);
    }
    res.json({ success: true, deleted: toDelete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/storage/delete', (req, res) => {
  res.json({ success: true, deletedCount: 0, freedMb: 0 });
});

// ==========================================
// 6.5. AI Settings & Intelligent Help RAG API
// ==========================================

const AI_CONFIG_ENDPOINTS = {
  deepseek: { url: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-chat' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o-mini' },
  grok: { url: 'https://api.x.ai/v1/chat/completions', defaultModel: 'grok-beta' },
  local: { url: 'http://localhost:11434/v1/chat/completions', defaultModel: 'llama3.2' },
};

app.get('/api/ai/settings', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM system_settings WHERE key LIKE 'ai_%'").all();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });

    res.json({
      provider: map.ai_provider || 'deepseek',
      deepseekKey: map.ai_deepseek_key || '',
      openaiKey: map.ai_openai_key || '',
      grokKey: map.ai_grok_key || '',
      hasConfiguredKey: Boolean(
        (map.ai_provider === 'deepseek' && map.ai_deepseek_key) ||
        (map.ai_provider === 'openai' && map.ai_openai_key) ||
        (map.ai_provider === 'grok' && map.ai_grok_key) ||
        (map.ai_provider === 'local')
      )
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/settings', (req, res) => {
  try {
    const { provider, deepseekKey, openaiKey, grokKey } = req.body || {};
    const db = getDb();

    if (provider) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ai_provider', ?)").run(provider);
    if (deepseekKey !== undefined) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ai_deepseek_key', ?)").run(deepseekKey);
    if (openaiKey !== undefined) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ai_openai_key', ?)").run(openaiKey);
    if (grokKey !== undefined) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ai_grok_key', ?)").run(grokKey);

    res.json({ success: true, message: 'AI configuration saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ai/test', async (req, res) => {
  try {
    const { provider, apiKey } = req.body || {};
    const targetProvider = provider || 'deepseek';
    const config = AI_CONFIG_ENDPOINTS[targetProvider];

    if (!config) {
      return res.status(400).json({ success: false, error: 'Unknown AI provider' });
    }

    if (targetProvider !== 'local' && !apiKey) {
      return res.status(400).json({ success: false, error: 'API key is required for testing' });
    }

    const testPayload = {
      model: config.defaultModel,
      messages: [
        { role: 'system', content: 'Respond with exactly: OK' },
        { role: 'user', content: 'Ping' }
      ],
      max_tokens: 10,
      temperature: 0.1
    };

    const resp = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey.trim()}` } : {})
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ success: false, error: `Provider error (${resp.status}): ${errText.slice(0, 150)}` });
    }

    res.json({ success: true, message: `Successfully connected to ${targetProvider.toUpperCase()}!` });
  } catch (err) {
    res.status(500).json({ success: false, error: `Connection failed: ${err.message}` });
  }
});

app.get('/api/help/articles', (req, res) => {
  try {
    const { category, q } = req.query || {};
    const db = getDb();

    let query = 'SELECT * FROM knowledge_base';
    const params = [];
    const conditions = [];

    if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }

    if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      conditions.push('(question LIKE ? OR short_answer LIKE ? OR detailed_steps LIKE ? OR tags LIKE ?)');
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY sort_order ASC, updated_at DESC';

    const rows = db.prepare(query).all(...params);
    const parsed = rows.map(r => ({
      ...r,
      detailedSteps: JSON.parse(r.detailed_steps || '[]'),
      tags: JSON.parse(r.tags || '[]'),
      categoryLabel: r.category_label,
      shortAnswer: r.short_answer,
      waitTime: r.wait_time,
      actionLink: r.action_label ? { label: r.action_label, action: r.action_type } : null
    }));

    res.json({ articles: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/help/articles', (req, res) => {
  try {
    const { id, category, categoryLabel, question, shortAnswer, detailedSteps, waitTime, tags, actionLabel, actionType, sortOrder } = req.body || {};
    if (!question || !shortAnswer) {
      return res.status(400).json({ error: 'Question and short answer are required.' });
    }

    const db = getDb();
    const articleId = id || 'kb-' + Date.now();
    const stepsStr = typeof detailedSteps === 'string' ? detailedSteps : JSON.stringify(detailedSteps || []);
    const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags || []);

    db.prepare(`
      INSERT OR REPLACE INTO knowledge_base
      (id, category, category_label, question, short_answer, detailed_steps, wait_time, tags, action_label, action_type, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      articleId,
      category || 'troubleshooting',
      categoryLabel || 'Troubleshooting',
      question.trim(),
      shortAnswer.trim(),
      stepsStr,
      waitTime || null,
      tagsStr,
      actionLabel || null,
      actionType || null,
      Number(sortOrder) || 0,
      Date.now()
    );

    res.json({ success: true, id: articleId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/help/articles/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/help/ask', async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const db = getDb();

    // 1. Perform SQLite Knowledge Base Retrieval (Database-driven RAG)
    const cleanQ = question.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const searchWords = cleanQ.split(/\s+/).filter(w => w.length >= 3);
    let matchedArticles = [];

    if (searchWords.length > 0) {
      const clauses = searchWords.map(() => '(question LIKE ? OR short_answer LIKE ? OR tags LIKE ?)').join(' OR ');
      const params = [];
      searchWords.forEach(w => {
        const term = `%${w}%`;
        params.push(term, term, term);
      });
      matchedArticles = db.prepare(`SELECT * FROM knowledge_base WHERE ${clauses} LIMIT 5`).all(...params);
    }

    if (matchedArticles.length === 0) {
      matchedArticles = db.prepare('SELECT * FROM knowledge_base ORDER BY sort_order ASC LIMIT 4').all();
    }

    const retrievedContext = matchedArticles.map((r, i) => {
      const steps = JSON.parse(r.detailed_steps || '[]');
      return `Article ${i + 1}: [${r.question}]\nCategory: ${r.category_label}\nSummary: ${r.short_answer}\nSteps:\n- ${steps.join('\n- ')}\nWait Time / Expectation: ${r.wait_time || 'N/A'}`;
    }).join('\n\n');

    // 2. Check AI Configuration
    const rows = db.prepare("SELECT key, value FROM system_settings WHERE key LIKE 'ai_%'").all();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });

    const provider = map.ai_provider || 'deepseek';
    let apiKey = '';
    if (provider === 'deepseek') apiKey = map.ai_deepseek_key;
    if (provider === 'openai') apiKey = map.ai_openai_key;
    if (provider === 'grok') apiKey = map.ai_grok_key;

    // If no AI key configured, return database articles directly in local mode
    if (provider !== 'local' && (!apiKey || !apiKey.trim())) {
      return res.json({
        mode: 'local',
        message: 'No active AI API key found. Using database knowledge base.',
        matchedArticleIds: matchedArticles.map(a => a.id)
      });
    }

    const config = AI_CONFIG_ENDPOINTS[provider] || AI_CONFIG_ENDPOINTS.deepseek;

    const systemPrompt = `You are Telcia AI Support Concierge for Telcia WAPP Automata (WhatsApp Wholesale Intelligence Terminal).
Answer the user's question clearly, concisely, and accurately in business-friendly terms based on the retrieved operational knowledge base below.

GROUNDED KNOWLEDGE BASE CONTEXT:
${retrievedContext}

ADDITIONAL SYSTEM GUARDRAILS:
1. Always state operational wait times clearly (e.g. 3-5 min initial sync for pairing, 30-60s catchup on reboot, 5-15s for WhatsApp password OTP).
2. Highlight that Desks are physically separated in SQLite (accounts/<id>/data/scraped.sqlite) and never cross data.
3. Message formatting supports WhatsApp bold (*text*), italic (_text_), strike, inline code, and code blocks.
4. If the user asks something outside the scope, politely guide them to check Terminal Settings or Live Stream.
Respond in clear, friendly markdown with bullet points where appropriate.`;

    const payload = {
      model: config.defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question.trim() }
      ],
      max_tokens: 600,
      temperature: 0.3
    };

    const resp = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey.trim()}` } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.json({
        mode: 'local',
        fallbackReason: `AI Provider (${provider}) returned error: ${errText.slice(0, 100)}`,
        matchedArticleIds: matchedArticles.map(a => a.id)
      });
    }

    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content || 'Unable to generate answer.';

    res.json({
      mode: 'ai',
      provider,
      answer,
      matchedArticleIds: matchedArticles.map(a => a.id)
    });
  } catch (err) {
    res.json({
      mode: 'local',
      fallbackReason: `AI query timed out or failed (${err.message}). Using database knowledge base.`
    });
  }
});

// ==========================================
// 7. Server-Sent Events (SSE: /api/stream)
// ==========================================

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify({ type: 'status', data: getStatus() })}\n\n`);
  sseClients.add(res);

  // Keep connection alive with periodic comments
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch (_) {
      clearInterval(keepAliveInterval);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    sseClients.delete(res);
  });
});

// ==========================================
// 8. Static UIs Hosting (React Dashboard & WhatsApp Web UI)
// ==========================================

const CHAT_UI_PATH = path.join(ROOT_DIR, 'backend', 'public', 'chat.html');

// Dedicated Authentic WhatsApp Web UI route
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && (req.path === '/chat' || req.path.startsWith('/chat/') || req.path === '/wp' || req.path.startsWith('/wp/'))) {
    if (fs.existsSync(CHAT_UI_PATH)) {
      return res.sendFile(CHAT_UI_PATH);
    }
    return res.status(404).send('WhatsApp Web UI not found at backend/public/chat.html');
  }
  next();
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api') && !req.path.startsWith('/chat') && !req.path.startsWith('/wp')) {
      return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    }
    next();
  });
}

// Start Server & Auto-connect active account
const server = app.listen(PORT, () => {
  console.log(`\n🚀 [Server] WAPP Automata running at http://localhost:${PORT}`);
  console.log(`📁 [Server] Active Account: [${getActiveAccountId()}]`);

  // Connect WhatsApp session for the active account
  connectWhatsApp().catch(err => {
    console.warn('[WhatsApp] Startup connection error:', err.message);
  });
});

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`\n🛑 [Server] Received ${signal}. Shutting down cleanly...`);
  disconnectWhatsApp().then(() => {
    closeDb();
    server.close(() => {
      console.log('👋 [Server] Process terminated cleanly.');
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
