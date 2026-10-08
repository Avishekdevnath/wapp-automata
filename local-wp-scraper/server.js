/**
 * Standalone Local WhatsApp Scraper Server
 * Pure Node.js HTTP + Server-Sent Events (SSE) + Plain HTML Interface
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const { connectWhatsApp, requestPairingCode, logoutWhatsApp, getStatus, addEventListener } = require('./whatsapp');
const { getMessages, getAllMessagesForExport, clearMessages, getStats } = require('./storage');

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
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10);
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
});
