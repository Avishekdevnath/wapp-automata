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
  getAllMessagesForExport
} from './storage/storage.js';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  logoutWhatsApp,
  requestPairingCode,
  getStatus,
  syncGroupNames,
  catchupRecentChats,
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

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  // Standard simple admin token for dashboard
  res.json({ success: true, token: 'wapp_auth_token_' + Date.now() });
});

app.get('/api/session/status', (req, res) => {
  res.json(getStatus());
});

app.get('/api/status', (req, res) => {
  res.json(getStatus());
});

app.post('/api/connect', async (req, res) => {
  connectWhatsApp().catch(err => {
    console.error('[API] Connect error:', err.message);
  });
  res.json({ status: 'connecting', message: 'Connection initiated' });
});

app.post('/api/pair-code', async (req, res) => {
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

app.post('/api/logout', async (req, res) => {
  try {
    const result = await logoutWhatsApp();
    res.json(result);
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
// ==========================================

app.get('/api/messages', (req, res) => {
  const search = req.query.search || '';
  const filter = req.query.filter || 'all';
  const limit = req.query.limit || '200';
  const remoteJid = req.query.remoteJid || null;

  const messages = getMessages({ search, filter, limit, remoteJid });
  res.json({
    count: messages.length,
    stats: getStats(),
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
  const limit = req.query.limit || '200';
  const search = req.query.search || '';
  const messages = getChatMessages(jid, { limit, search });
  const total = getChatTotal(jid);
  res.json({ jid, total, count: messages.length, messages });
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
app.get(['/chat', '/chat/*', '/wp', '/wp/*'], (req, res) => {
  if (fs.existsSync(CHAT_UI_PATH)) {
    return res.sendFile(CHAT_UI_PATH);
  }
  res.status(404).send('WhatsApp Web UI not found at backend/public/chat.html');
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/chat') && !req.path.startsWith('/wp')) {
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
