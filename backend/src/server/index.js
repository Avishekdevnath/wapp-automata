/**
 * Enterprise Dual-Mode SaaS Dashboard & Webhook Receiver
 * Orchestrator & Router Entry Point
 */
const http = require('http');
const { PORT, HOST, DASHBOARD_PASSWORD, PUBLIC_DIR } = require('./config');
const { isAuthenticated, generateAuthToken } = require('./auth');
const { processWebhookDelivery } = require('./webhook-receiver');
const { handleRoutesGet, handleRoutesPost, handleRoutesSeed, handleRoutesClear, handleRoutesExport } = require('./routes-api');
const { handleTrendsGet, handleNewsGet, handleNewsClear, handleNewsSeed, handleVendorsGet, handleInsightsGet, handlePitchPost, handleExecutiveBriefGet, handleArbitrageGet } = require('./market-api');
const { handleSystemApi } = require('./system-api');
const { handleAiSettingsApi } = require('./ai-settings');
const { handlePipelineApi } = require('./pipeline-api');
const { serveStaticFile } = require('./static');
const { backfillHistoricalTelecomData } = require('./db');
const { recentMessages } = require('./store');
const { startQueueWorker } = require('./ai-queue');

let persistenceModule;
try {
  persistenceModule = require('../persistence');
} catch (_) {
  persistenceModule = require('../../dist/persistence');
}
const { listAccountIds, sanitizeAccountId } = persistenceModule;

let poolModule;
try {
  poolModule = require('../collector/pool');
} catch (_) {
  poolModule = require('../../dist/collector/pool');
}
const { globalAccountPool } = poolModule;

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

  // 2.1 SESSION & PAIRING STATUS (Public: so QR Code & Device Link modal can always load and refresh without 401)
  if (pathname === '/api/session/status' || pathname === '/api/session/pair-code' || pathname === '/api/session/refresh') {
    const handled = await handleSystemApi(req, res, pathname, parsedUrl);
    if (handled) return;
  }

  // 3. PROTECTED API ENDPOINTS (Require Authentication)
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized: Dashboard login required' }));
    }

    // Route Matrix APIs
    if (req.method === 'GET' && pathname === '/api/routes') return handleRoutesGet(req, res, parsedUrl);
    if (req.method === 'POST' && (pathname === '/api/routes' || pathname === '/api/routes/post')) return handleRoutesPost(req, res);
    if (req.method === 'POST' && pathname === '/api/routes/seed') return handleRoutesSeed(req, res);
    if ((req.method === 'POST' && pathname === '/api/routes/clear') || (req.method === 'DELETE' && pathname === '/api/routes')) return handleRoutesClear(req, res);
    if (req.method === 'GET' && pathname === '/api/export/routes') return handleRoutesExport(req, res);

    // Market & Intelligence APIs
    if (req.method === 'GET' && pathname === '/api/trends') return handleTrendsGet(req, res, parsedUrl);
    if (req.method === 'GET' && pathname === '/api/news/executive-brief') return handleExecutiveBriefGet(req, res, parsedUrl);
    if (req.method === 'GET' && pathname === '/api/news') return handleNewsGet(req, res);
    if ((req.method === 'POST' && pathname === '/api/news/clear') || (req.method === 'DELETE' && pathname === '/api/news')) return handleNewsClear(req, res);
    if (req.method === 'POST' && pathname === '/api/news/seed') return handleNewsSeed(req, res);
    if (req.method === 'GET' && pathname === '/api/vendors') return handleVendorsGet(req, res);
    if (req.method === 'GET' && pathname === '/api/insights') return handleInsightsGet(req, res);
    if (req.method === 'GET' && pathname === '/api/arbitrage') return handleArbitrageGet(req, res);
    if (req.method === 'POST' && pathname === '/api/insights/pitch') return handlePitchPost(req, res);

    // 3.1 Account Workspaces & System Admin APIs (Strict Single-Account Silo Isolation)
    if (req.method === 'GET' && pathname === '/api/accounts') {
      const headerAccountId = req.headers['x-account-id'] ? sanitizeAccountId(req.headers['x-account-id']) : 'default';
      const accounts = [{
        id: headerAccountId,
        label: headerAccountId === 'default' ? 'Desk 1 (Primary)' : `Desk ${headerAccountId.toUpperCase()}`,
        isDefault: headerAccountId === 'default'
      }];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', accounts }));
    }

    if (req.method === 'GET' && (pathname === '/api/admin/fleet' || pathname === '/api/admin/desks')) {
      const headerAccountId = req.headers['x-account-id'] ? sanitizeAccountId(req.headers['x-account-id']) : 'default';
      const fullFleet = globalAccountPool.getFleetStatus();
      const scopedFleet = fullFleet.filter(f => f.accountId === headerAccountId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', fleet: scopedFleet }));
    }

    if (req.method === 'POST' && pathname === '/api/admin/desks') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch {}
        const accountId = sanitizeAccountId(parsed.accountId);
        try {
          await globalAccountPool.startAccount(accountId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'ok', accountId }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'error', error: err.message }));
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/admin/desks/restart') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        let parsed = {};
        try { parsed = JSON.parse(body || '{}'); } catch {}
        const accountId = sanitizeAccountId(parsed.accountId);
        try {
          await globalAccountPool.restartAccount(accountId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'ok', accountId }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'error', error: err.message }));
        }
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
    const handled = await handleSystemApi(req, res, pathname, parsedUrl);
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
