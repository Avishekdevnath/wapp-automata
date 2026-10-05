/**
 * Enterprise Dual-Mode SaaS Dashboard & Webhook Receiver
 * Orchestrator & Router Entry Point
 */
const http = require('http');
const { PORT, HOST, DASHBOARD_PASSWORD, PUBLIC_DIR } = require('./server/config');
const { isAuthenticated, generateAuthToken } = require('./server/auth');
const { processWebhookDelivery } = require('./server/webhook-receiver');
const { handleRoutesGet, handleRoutesPost, handleRoutesSeed, handleRoutesExport } = require('./server/routes-api');
const { handleTrendsGet, handleNewsGet, handleVendorsGet, handleInsightsGet, handlePitchPost } = require('./server/market-api');
const { handleSystemApi } = require('./server/system-api');
const { handleAiSettingsApi } = require('./server/ai-settings');
const { handlePipelineApi } = require('./server/pipeline-api');
const { serveStaticFile } = require('./server/static');
const { backfillHistoricalTelecomData } = require('./server/db');
const { recentMessages } = require('./server/store');
const { startQueueWorker } = require('./server/ai-queue');

const server = http.createServer(async (req, res) => {
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
    if (req.method === 'GET' && pathname === '/api/export/routes') return handleRoutesExport(req, res);

    // Market & Intelligence APIs
    if (req.method === 'GET' && pathname === '/api/trends') return handleTrendsGet(req, res, parsedUrl);
    if (req.method === 'GET' && pathname === '/api/news') return handleNewsGet(req, res);
    if (req.method === 'GET' && pathname === '/api/vendors') return handleVendorsGet(req, res);
    if (req.method === 'GET' && pathname === '/api/insights') return handleInsightsGet(req, res);
    if (req.method === 'POST' && pathname === '/api/insights/pitch') return handlePitchPost(req, res);

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
});

server.listen(PORT, HOST, () => {
  const displayUrl = (HOST === '0.0.0.0' || HOST === '::') ? `http://localhost:${PORT}/` : `http://${HOST}:${PORT}/`;
  console.log(`\n🚀 Wholesale Telecom Trading Terminal running at: ${displayUrl}`);
  console.log(`📁 Serving frontend components from:         ${PUBLIC_DIR}`);
  console.log(`🔑 Password Gate:                            "${DASHBOARD_PASSWORD}"`);
  console.log(`📡 Ingestion Endpoint:                        ${displayUrl}webhook\n`);

  startQueueWorker();
  setTimeout(() => backfillHistoricalTelecomData(recentMessages), 1000);
});
