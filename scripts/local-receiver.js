/**
 * Enterprise Dual-Mode SaaS Dashboard & Webhook Receiver
 * Orchestrator & Router Entry Point
 */
const http = require('http');
const { PORT, HOST, DASHBOARD_PASSWORD, PUBLIC_DIR } = require('./server/config');
const { isAuthenticated, generateAuthToken } = require('./server/auth');
const { processWebhookDelivery } = require('./server/webhook-receiver');
const { handleRoutesGet, handleRoutesPost, handleRoutesSeed, handleRoutesClear, handleRoutesExport } = require('./server/routes-api');
const { handleTrendsGet, handleNewsGet, handleNewsClear, handleVendorsGet, handleInsightsGet, handlePitchPost, handleExecutiveBriefGet, handleArbitrageGet } = require('./server/market-api');
const { handleSystemApi } = require('./server/system-api');
const { handleAiSettingsApi } = require('./server/ai-settings');
const { handlePipelineApi } = require('./server/pipeline-api');
const { serveStaticFile } = require('./server/static');
const { backfillHistoricalTelecomData } = require('./server/db');
const { recentMessages } = require('./server/store');
const { startQueueWorker } = require('./server/ai-queue');

// Global process fault guards
process.on('uncaughtException', (err) => {
  console.error('⚠️ [UncaughtException in Dashboard Receiver]', err.message, err.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [UnhandledRejection in Dashboard Receiver]', reason);
});

const server = http.createServer(async (req, res) => {
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

  // 1. PUBLIC WEBHOOK INGESTION (Signed with HMAC SHA-256)
  if (req.method === 'POST' && (pathname === '/webhook' || pathname === '/')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const result = processWebhookDelivery(body, req.headers);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', received_at: Date.now(), valid: result.isValid }));
    });
    return;
  }

  // 2. AUTHENTICATION ENDPOINTS (Public)
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch {}
      if (parsed.password === DASHBOARD_PASSWORD) {
        const token = generateAuthToken();
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `wapp_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
        });
        return res.end(JSON.stringify({ status: 'ok', token }));
      }
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', error: 'Invalid password' }));
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'wapp_token=; Path=/; HttpOnly; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    });
    return res.end(JSON.stringify({ status: 'ok', logged_out: true }));
  }

  // 3. PROTECTED API ENDPOINTS (Require Authentication)
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized: Dashboard login required' }));
    }

    // Route Matrix APIs
    if (req.method === 'GET' && pathname === '/api/routes') return handleRoutesGet(req, res, parsedUrl);
    if (req.method === 'POST' && pathname === '/api/routes') return handleRoutesPost(req, res);
    if (req.method === 'POST' && pathname === '/api/routes/seed') return handleRoutesSeed(req, res);
    if ((req.method === 'POST' && pathname === '/api/routes/clear') || (req.method === 'DELETE' && pathname === '/api/routes')) return handleRoutesClear(req, res);
    if (req.method === 'GET' && pathname === '/api/export/routes') return handleRoutesExport(req, res);

    // Market & Intelligence APIs
    if (req.method === 'GET' && pathname === '/api/trends') return handleTrendsGet(req, res, parsedUrl);
    if (req.method === 'GET' && pathname === '/api/news/executive-brief') return handleExecutiveBriefGet(req, res, parsedUrl);
    if (req.method === 'GET' && pathname === '/api/news') return handleNewsGet(req, res);
    if ((req.method === 'POST' && pathname === '/api/news/clear') || (req.method === 'DELETE' && pathname === '/api/news')) return handleNewsClear(req, res);
    if (req.method === 'GET' && pathname === '/api/vendors') return handleVendorsGet(req, res);
    if (req.method === 'GET' && pathname === '/api/insights') return handleInsightsGet(req, res);
    if (req.method === 'GET' && pathname === '/api/arbitrage') return handleArbitrageGet(req, res);
    if (req.method === 'POST' && pathname === '/api/insights/pitch') return handlePitchPost(req, res);

    // Unified Data Clearance API
    if (req.method === 'POST' && pathname === '/api/data/clear') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch {}
        const target = parsed.target || 'all';
        const { getTradingDb } = require('./server/db');
        const db = getTradingDb();
        const results = {};
        if (target === 'routes' || target === 'all') {
          if (db) {
            results.routes = db.prepare('DELETE FROM route_ticks').run().changes;
            try {
              db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
              db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('user_cleared_routes', 'true')`).run();
            } catch (_) {}
          }
        }
        if (target === 'analysis' || target === 'all') {
          if (db) results.analysis = db.prepare('DELETE FROM ai_tasks').run().changes;
          const { clearPipelineData } = require('./server/pipeline-api');
          clearPipelineData();
        }
        if (target === 'news' || target === 'all') {
          if (db) results.news = db.prepare('DELETE FROM market_news').run().changes;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', target, deleted: results }));
      });
      return;
    }

    // AI Engine Settings APIs
    if (pathname.startsWith('/api/settings/ai')) {
      const handledAi = handleAiSettingsApi(req, res, pathname);
      if (handledAi) return;
    }

    // System Pipeline & AI Processing Inspector APIs
    if (pathname.startsWith('/api/pipeline')) {
      const handledPipe = handlePipelineApi(req, res, pathname, parsedUrl);
      if (handledPipe) return;
    }

    // System, Session, Storage, Forwarder & Media APIs
    const handled = handleSystemApi(req, res, pathname, parsedUrl);
    if (handled) return;

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'API endpoint not found' }));
  }

  // 4. STATIC FILE SERVING (Serves public/ assets & modular HTML views)
  if (req.method === 'GET') {
    return serveStaticFile(pathname, res);
  }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
  } catch (err) {
    console.error('🚨 [Server Error] Unhandled exception during request routing:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    }
  }
});

server.listen(PORT, HOST, () => {
  const displayUrl = (HOST === '0.0.0.0' || HOST === '::') ? `http://localhost:${PORT}/` : `http://${HOST}:${PORT}/`;
  console.log(`\n🇧🇩 🚀 Telcia • Telecom Intelligent Agent running at: ${displayUrl}`);
  console.log(`📁 Serving frontend components from:         ${PUBLIC_DIR}`);
  console.log(`🔑 Password Gate:                            "${DASHBOARD_PASSWORD}"`);
  console.log(`📡 Ingestion Endpoint:                        ${displayUrl}webhook\n`);

  startQueueWorker();
  setTimeout(() => backfillHistoricalTelecomData(recentMessages), 1000);
});

// Clean shutdown signals
const shutdownReceiver = () => {
  console.log('\n🛑 Gracefully shutting down dashboard receiver...');
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdownReceiver);
process.on('SIGTERM', shutdownReceiver);
