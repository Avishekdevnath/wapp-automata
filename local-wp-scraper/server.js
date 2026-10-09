/**
 * Standalone Local WhatsApp Scraper Server
 * Pure Node.js HTTP + Server-Sent Events (SSE) + Plain HTML Interface
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const {
  connectWhatsApp,
  requestPairingCode,
  logoutWhatsApp,
  getStatus,
  addEventListener,
  syncGroupNames,
  catchupRecentChats,
  triggerWatchdogReconnect
} = require('./whatsapp');
const {
  getMessages,
  getAllMessagesForExport,
  clearMessages,
  getStats,
  getChatsList,
  getChatMessages,
  getChatTotal,
  deleteChatMessages
} = require('./storage');

const PORT = process.env.PORT || 5050;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Connected SSE clients
const sseClients = new Set();

// Register Baileys event listener to broadcast via SSE
addEventListener((type, data) => {
  const payload = `data: ${JSON.stringify({ type, data })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (_) {
      sseClients.delete(client);
    }
  }
});

// Periodic SSE heartbeat (every 15s)
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': heartbeat\n\n');
    } catch (_) {
      sseClients.delete(client);
    }
  }
}, 15000);

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Helper for JSON responses
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // Helper for reading JSON request body
  const readJsonBody = () => {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(body ? JSON.parse(body) : {});
        } catch (e) {
          reject(e);
        }
      });
      req.on('error', reject);
    });
  };

  try {
    // 1. Static HTML serving
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      const htmlPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return fs.createReadStream(htmlPath).pipe(res);
      }
      return sendJson(404, { error: 'index.html not found' });
    }

    // 2. Server-Sent Events (SSE) Stream
    if (req.method === 'GET' && pathname === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      res.write(`data: ${JSON.stringify({ type: 'status', data: getStatus() })}\n\n`);
      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // 3. Status API
    if (req.method === 'GET' && pathname === '/api/status') {
      return sendJson(200, getStatus());
    }

    // 4. Connect WhatsApp API
    if (req.method === 'POST' && pathname === '/api/connect') {
      connectWhatsApp().catch(err => {
        console.error('Async connect error:', err.message);
      });
      return sendJson(200, { status: 'connecting', message: 'Connection initiated' });
    }

    // 5. Pairing Code Request API
    if (req.method === 'POST' && pathname === '/api/pair-code') {
      const body = await readJsonBody();
      if (!body.phone) {
        return sendJson(400, { error: 'Phone number is required' });
      }
      try {
        const code = await requestPairingCode(body.phone);
        return sendJson(200, { status: 'ok', pairingCode: code });
      } catch (err) {
        return sendJson(500, { error: err.message });
      }
    }

    // 6. Logout API
    if (req.method === 'POST' && pathname === '/api/logout') {
      const result = await logoutWhatsApp();
      return sendJson(200, result);
    }

    // 7. Get Caught Messages
    if (req.method === 'GET' && pathname === '/api/messages') {
      const search = parsedUrl.searchParams.get('search') || '';
      const filter = parsedUrl.searchParams.get('filter') || 'all';
      const limit = parsedUrl.searchParams.get('limit') || '200';
      const messages = getMessages({ search, filter, limit });
      return sendJson(200, {
        count: messages.length,
        stats: getStats(),
        messages
      });
    }

    // 8. Clear Caught Messages
    if (req.method === 'DELETE' && pathname === '/api/messages') {
      const deletedCount = clearMessages();
      // Broadcast clear event
      const payload = `data: ${JSON.stringify({ type: 'cleared', data: { count: deletedCount } })}\n\n`;
      for (const client of sseClients) {
        try { client.write(payload); } catch (_) {}
      }
      return sendJson(200, { status: 'ok', deleted: deletedCount });
    }

    // 9. Export All Messages
    if (req.method === 'GET' && pathname === '/api/export') {
      const allMsgs = getAllMessagesForExport();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="scraped_messages_${Date.now()}.json"`
      });
      return res.end(JSON.stringify(allMsgs, null, 2));
    }

    // 10. Import previous messages from collector.sqlite
    if (req.method === 'POST' && pathname === '/api/import-main-db') {
      const { importFromCollectorDb } = require('./storage');
      const imported = importFromCollectorDb();
      const payload = `data: ${JSON.stringify({ type: 'status', data: getStatus() })}\n\n`;
      for (const client of sseClients) {
        try { client.write(payload); } catch (_) {}
      }
      return sendJson(200, { status: 'ok', importedCount: imported });
    }

    // 11. Get Distinct Chats & Groups List
    if (req.method === 'GET' && pathname === '/api/chats') {
      const search = parsedUrl.searchParams.get('search') || '';
      const filter = parsedUrl.searchParams.get('filter') || 'all';
      const chats = getChatsList({ search, filter });
      return sendJson(200, {
        count: chats.length,
        chats
      });
    }

    // 12. Sync Group Titles/Subjects & Participant LIDs from Baileys
    if (req.method === 'POST' && pathname === '/api/chats/sync-names') {
      const result = await syncGroupNames();
      return sendJson(200, {
        status: 'ok',
        updatedCount: typeof result === 'object' ? result.groups : result,
        groups: result?.groups || 0,
        participants: result?.participants || 0
      });
    }

    // 12b. Proactive History Catchup for Active Chats
    if (req.method === 'POST' && pathname === '/api/sync-history') {
      const result = await catchupRecentChats(50);
      return sendJson(200, {
        status: 'ok',
        message: 'Catch-up sync initiated with mobile phone',
        ...result
      });
    }

    // 12c. Manual Watchdog Reconnection Trigger
    if (req.method === 'POST' && pathname === '/api/reconnect') {
      triggerWatchdogReconnect().catch(err => console.error('Reconnect error:', err));
      return sendJson(200, { status: 'ok', message: 'Watchdog reconnection initiated' });
    }

    // 13. Single Chat Messages API: GET /api/chats/<encoded_jid>/messages
    const chatMsgsMatch = pathname.match(/^\/api\/chats\/(.+)\/messages$/);
    if (req.method === 'GET' && chatMsgsMatch) {
      const remoteJid = decodeURIComponent(chatMsgsMatch[1]);
      const search = parsedUrl.searchParams.get('search') || '';
      const limit = parsedUrl.searchParams.get('limit') || 'all';
      const messages = getChatMessages(remoteJid, { search, limit });
      const totalInDb = getChatTotal(remoteJid);
      return sendJson(200, {
        remoteJid,
        totalInDb,
        loadedCount: messages.length,
        count: messages.length,
        messages
      });
    }

    // 14. Export Single Chat Messages: GET /api/chats/<encoded_jid>/export
    const chatExportMatch = pathname.match(/^\/api\/chats\/(.+)\/export$/);
    if (req.method === 'GET' && chatExportMatch) {
      const remoteJid = decodeURIComponent(chatExportMatch[1]);
      const messages = getChatMessages(remoteJid, { limit: 10000 });
      const safeName = remoteJid.replace(/[^a-zA-Z0-9_-]/g, '_');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="chat_${safeName}_${Date.now()}.json"`
      });
      return res.end(JSON.stringify({ remoteJid, count: messages.length, messages }, null, 2));
    }

    // 15. Delete Single Chat Messages: DELETE /api/chats/<encoded_jid>
    const chatDeleteMatch = pathname.match(/^\/api\/chats\/(.+)$/);
    if (req.method === 'DELETE' && chatDeleteMatch && !pathname.endsWith('/messages') && !pathname.endsWith('/export')) {
      const remoteJid = decodeURIComponent(chatDeleteMatch[1]);
      const deleted = deleteChatMessages(remoteJid);
      const payload = `data: ${JSON.stringify({ type: 'chat_cleared', data: { remoteJid } })}\n\n`;
      for (const client of sseClients) {
        try { client.write(payload); } catch (_) {}
      }
      return sendJson(200, { status: 'ok', remoteJid, deleted });
    }

    sendJson(404, { error: 'Not Found' });
  } catch (err) {
    console.error('Request error:', err);
    sendJson(500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 [Local WhatsApp Scraper] Plain HTML Suite Running!`);
  console.log(`📡 URL:       http://localhost:${PORT}/`);
  console.log(`🔒 Isolation: 100% Isolated Session & SQLite Storage`);
  console.log(`======================================================\n`);

  // Auto-connect if session credentials already exist
  const credsPath = path.join(__dirname, 'session', 'creds.json');
  if (fs.existsSync(credsPath)) {
    console.log('🔑 [Local Scraper] Saved credentials detected. Auto-connecting...');
    connectWhatsApp().catch(err => console.warn('Auto-connect warning:', err.message));
  }
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n🛑 [Server] Received ${signal}. Shutting down cleanly...`);
  server.close(() => {
    console.log('✅ [Server] HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


