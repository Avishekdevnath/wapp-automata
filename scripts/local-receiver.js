/**
 * Enterprise Dual-Mode SaaS Dashboard & Webhook Receiver
 * - Modular architecture serving static assets from public/
 * - Password Gate & Token Authentication
 * - Client Inbox & Developer Studio APIs
 * - Webhook HMAC-SHA256 signature verification & durable persistence
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const HOST = process.env.HOST || '0.0.0.0';
const SECRET = process.env.WEBHOOK_SECRET || 'local_dev_webhook_secret_key_12345';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'wapp2026';

const DATA_DIR = fs.existsSync('/opt/wapp-automata/data') 
  ? '/opt/wapp-automata/data' 
  : (fs.existsSync(path.join(__dirname, '..', 'data')) ? path.join(__dirname, '..', 'data') : './data');

const SESSION_PATH = process.env.SESSION_DATA_PATH || 
  (fs.existsSync('/opt/wapp-automata/data/.session') ? '/opt/wapp-automata/data/.session' : './.session');

const HISTORY_FILE = path.join(DATA_DIR, 'dashboard_history.json');
const SQLITE_FILE = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'collector.sqlite');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function loadSavedMessages() {
  // 1. Try reading persistent JSON file
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      const list = JSON.parse(data);
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (err) {
    console.error('Error loading history file:', err.message);
  }

  // 2. If history file is empty, seed from SQLite DB if available
  try {
    if (fs.existsSync(SQLITE_FILE)) {
      const Database = require('better-sqlite3');
      const db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
      const rows = db.prepare(`
        SELECT id, chat_id, sender_id, chat_type, source_name, message_timestamp, message_text, has_media, created_at, status
        FROM messages
        ORDER BY created_at DESC
        LIMIT 100
      `).all();
      db.close();

      if (rows && rows.length > 0) {
        const seeded = rows.map(r => {
          let senderPhone = '';
          if (r.sender_id.includes('@s.whatsapp.net')) {
            senderPhone = '+' + r.sender_id.split('@')[0].split(':')[0];
          } else if (r.sender_id.includes('@lid')) {
            senderPhone = 'LID:' + r.sender_id.split('@')[0];
          }

          return {
            id: r.id,
            delivery_id: 'db_' + r.id.slice(0, 8),
            event: 'whatsapp.message.received',
            attempt: 1,
            sender_name: senderPhone || r.sender_id,
            sender_phone: senderPhone,
            chat_name: r.source_name || '',
            chat_type: r.chat_type || 'direct',
            text: r.message_text || '',
            has_media: Boolean(r.has_media),
            timestamp: new Date(r.created_at).toLocaleTimeString(),
            occurred_at: new Date(r.created_at).toISOString(),
            latency_ms: 12,
            isValid: true,
            headers: { 'x-collector-signature': 'sha256=(stored_in_sqlite)' },
            raw_envelope: {
              event: 'whatsapp.message.received',
              message: {
                message_id: r.id,
                chat_id: r.chat_id,
                chat_name: r.source_name,
                chat_type: r.chat_type,
                sender_id: r.sender_id,
                text: r.message_text,
                has_media: Boolean(r.has_media)
              }
            }
          };
        });
        saveMessagesToDisk(seeded);
        return seeded;
      }
    }
  } catch (err) {
    console.warn('Could not seed history from SQLite:', err.message);
  }

  return [];
}

function saveMessagesToDisk(messages) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(messages.slice(0, 500), null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write history file:', err.message);
  }
}

const recentMessages = loadSavedMessages();
const activeSessions = new Set();
const serverStartTime = Date.now();

const stats = {
  totalReceived: 0,
  validSignatures: 0,
  invalidSignatures: 0,
  groupsCount: new Set(),
  sendersCount: new Set()
};

for (const m of recentMessages) {
  stats.totalReceived++;
  if (m.isValid) stats.validSignatures++;
  else stats.invalidSignatures++;
  if (m.chat_name) stats.groupsCount.add(m.chat_name);
  if (m.sender_phone) stats.sendersCount.add(m.sender_phone);
}

function verifySignature(body, signatureHeader) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const expectedHash = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  const expectedSignature = `sha256=${expectedHash}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch {
    return false;
  }
}

function computeSignature(body) {
  const hash = crypto.createHmac('sha256', SECRET).update(body).digest('hex');
  return `sha256=${hash}`;
}

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  if (cookies.wapp_token && activeSessions.has(cookies.wapp_token)) return true;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    return activeSessions.has(token);
  }
  return false;
}

function getSessionState() {
  try {
    const stateFile = path.join(SESSION_PATH, 'session_state.json');
    if (fs.existsSync(stateFile)) {
      const content = fs.readFileSync(stateFile, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed.status === 'authenticated' && parsed.accountJid) {
        const rawId = parsed.accountJid.split('@')[0].split(':')[0];
        parsed.phone = '+' + rawId;
      }
      return parsed;
    }

    const credsFile = path.join(SESSION_PATH, 'creds.json');
    if (fs.existsSync(credsFile)) {
      const content = fs.readFileSync(credsFile, 'utf8');
      const creds = JSON.parse(content);
      if (creds && creds.me && creds.me.id) {
        const rawId = creds.me.id.split('@')[0].split(':')[0];
        return {
          status: 'authenticated',
          accountJid: creds.me.id,
          phone: '+' + rawId,
          name: creds.me.name || 'WhatsApp Account',
          updatedAt: Date.now()
        };
      }
    }
  } catch (err) {}

  return {
    status: 'disconnected',
    phone: null,
    name: null,
    qr: null,
    updatedAt: Date.now()
  };
}

function serveStaticFile(reqPath, res) {
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath === '/' ? 'index.html' : safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

function processWebhookDelivery(body, headers) {
  const signature = headers['x-collector-signature'];
  const event = headers['x-collector-event'] || 'whatsapp.message.received';
  const deliveryId = headers['x-collector-delivery-id'] || 'del_' + Date.now();

  const isValidSig = verifySignature(body, signature);

  stats.totalReceived++;
  if (isValidSig) stats.validSignatures++;
  else stats.invalidSignatures++;

  let parsed = null;
  try { parsed = JSON.parse(body); } catch {}

  let senderDisplay = 'Contact';
  let senderPhone = '';
  let chatDisplay = 'Chat';
  let chatType = 'direct';
  let text = body;
  let hasMedia = false;
  let messageId = 'msg_' + Date.now();
  let occurredAt = new Date().toISOString();
  let latencyMs = 15;

  if (parsed && parsed.message) {
    messageId = parsed.message.message_id || messageId;
    text = parsed.message.text || '';
    hasMedia = Boolean(parsed.message.has_media);
    chatType = parsed.message.chat_type || 'direct';

    const rawSenderId = parsed.message.sender_id || '';
    if (rawSenderId.includes('@s.whatsapp.net')) {
      senderPhone = '+' + rawSenderId.split('@')[0].split(':')[0];
    } else if (rawSenderId.includes('@lid')) {
      senderPhone = 'LID:' + rawSenderId.split('@')[0];
    }

    senderDisplay = parsed.message.sender_name || senderPhone || 'Contact';
    chatDisplay = parsed.message.chat_name || parsed.message.chat_id || 'Chat';
    occurredAt = parsed.occurred_at || occurredAt;

    if (parsed.occurred_at) {
      const delta = Date.now() - new Date(parsed.occurred_at).getTime();
      if (delta >= 0 && delta < 600000) latencyMs = delta;
    }

    if (parsed.message.chat_name) stats.groupsCount.add(parsed.message.chat_name);
    if (senderPhone) stats.sendersCount.add(senderPhone);
  }

  const record = {
    id: messageId,
    delivery_id: deliveryId,
    event,
    attempt: (parsed && parsed.attempt) || 1,
    sender_name: senderDisplay,
    sender_phone: senderPhone,
    chat_name: (parsed && parsed.message && parsed.message.chat_name) || '',
    chat_type: chatType,
    text,
    has_media: hasMedia,
    timestamp: new Date().toLocaleTimeString(),
    occurred_at: occurredAt,
    latency_ms: latencyMs,
    isValid: isValidSig,
    headers,
    raw_envelope: parsed || { raw: body }
  };

  recentMessages.unshift(record);
  if (recentMessages.length > 500) recentMessages.pop();
  saveMessagesToDisk(recentMessages);

  console.log(`📥 Ingested Webhook [${new Date().toISOString()}] | ID: ${deliveryId} | From: ${senderDisplay} (${senderPhone}) | Chat: ${chatDisplay} [${chatType}] | HMAC: ${isValidSig ? '✅ VALID' : '❌ INVALID'}`);

  return { isValid: isValidSig };
}

const server = http.createServer((req, res) => {
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
        const token = crypto.randomBytes(24).toString('hex');
        activeSessions.add(token);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `wapp_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` // 30 days
        });
        return res.end(JSON.stringify({ status: 'ok', token }));
      }
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', error: 'Invalid password' }));
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const cookies = parseCookies(req);
    if (cookies.wapp_token) {
      activeSessions.delete(cookies.wapp_token);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'wapp_token=; Path=/; HttpOnly; Max-Age=0'
    });
    return res.end(JSON.stringify({ status: 'ok', logged_out: true }));
  }

  // 3. PROTECTED API ENDPOINTS (Require Authentication)
  if (pathname.startsWith('/api/')) {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized: Dashboard login required' }));
    }

    if (req.method === 'GET' && pathname === '/api/session/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(getSessionState()));
    }

    if (req.method === 'POST' && pathname === '/api/session/reset') {
      try {
        if (fs.existsSync(SESSION_PATH)) {
          fs.rmSync(SESSION_PATH, { recursive: true, force: true });
          fs.mkdirSync(SESSION_PATH, { recursive: true });
        }
        exec('pm2 restart wapp-automata', (err) => {
          if (err) console.error('Error restarting PM2 wapp-automata:', err);
        });
      } catch (err) {
        console.error('Error clearing session folder:', err);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', message: 'Session reset initiated' }));
    }

    if (req.method === 'POST' && pathname === '/api/simulate') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body); } catch {}

        const now = new Date().toISOString();
        const testPayload = {
          event: 'whatsapp.message.received',
          delivery_id: 'sim_' + Date.now(),
          attempt: 1,
          occurred_at: now,
          message: {
            message_id: 'sim_msg_' + Date.now(),
            chat_id: parsed.chat_type === 'group' ? '8801516539430-1620000000@g.us' : '8801700000000@s.whatsapp.net',
            chat_name: parsed.chat_name || (parsed.chat_type === 'group' ? 'Executive Support Group' : 'Direct Conversation'),
            chat_type: parsed.chat_type || 'direct',
            sender_id: parsed.sender_phone ? parsed.sender_phone.replace(/[^0-9]/g, '') + '@s.whatsapp.net' : '8801700000000@s.whatsapp.net',
            sender_name: parsed.sender_name || 'Sarah Khan',
            text: parsed.text || 'Simulated WhatsApp message verification test.',
            has_media: false
          }
        };

        const payloadStr = JSON.stringify(testPayload);
        const sig = computeSignature(payloadStr);
        const headers = {
          'x-collector-signature': sig,
          'x-collector-event': testPayload.event,
          'x-collector-delivery-id': testPayload.delivery_id,
          'x-collector-timestamp': Date.now().toString()
        };

        const result = processWebhookDelivery(payloadStr, headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', simulated: true, valid: result.isValid }));
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/messages') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(recentMessages));
    }

    if (req.method === 'GET' && pathname === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
        totalReceived: stats.totalReceived,
        validSignatures: stats.validSignatures,
        uniqueGroups: stats.groupsCount.size,
        uniqueSenders: stats.sendersCount.size
      }));
    }

    if (req.method === 'POST' && pathname === '/api/clear') {
      recentMessages.length = 0;
      saveMessagesToDisk(recentMessages);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', cleared: true }));
    }
  }

  // 4. STATIC FILE SERVING (Serves public/ assets)
  if (req.method === 'GET') {
    return serveStaticFile(pathname, res);
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Modular Dual-Mode SaaS Dashboard running at: http://${HOST}:${PORT}/`);
  console.log(`📁 Serving frontend components from:         ${PUBLIC_DIR}`);
  console.log(`🔑 Password Gate:                            "${DASHBOARD_PASSWORD}"`);
  console.log(`📡 Ingestion Endpoint:                        http://${HOST}:${PORT}/webhook\n`);
});
