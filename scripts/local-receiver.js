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
const { parseTelecomMessage, extractTelecomWithAI } = require('./telecom-parser');

// Zero-dependency .env loader — must run before any process.env reads
const _envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(_envPath)) {
  const _lines = fs.readFileSync(_envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const _line of _lines) {
    const trimmed = _line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const HOST = process.env.HOST || '0.0.0.0';
const SECRET = process.env.WEBHOOK_SECRET || 'local_dev_webhook_secret_key_12345';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'wapp2026';
const FORWARD_WEBHOOK_URL = process.env.FORWARD_WEBHOOK_URL || 'https://n8n.srv1718993.hstgr.cloud/webhook/ispsaddamb491e-a770-231f11c5fdff';
const FORWARD_FORMAT = process.env.FORWARD_FORMAT || 'clean'; // 'clean' or 'raw'

const DATA_DIR = fs.existsSync('/opt/wapp-automata/data') 
  ? '/opt/wapp-automata/data' 
  : (fs.existsSync(path.join(__dirname, '..', 'data')) ? path.join(__dirname, '..', 'data') : './data');

const SESSION_PATH = process.env.SESSION_DATA_PATH || 
  (fs.existsSync('/opt/wapp-automata/data/.session') ? '/opt/wapp-automata/data/.session' : './.session');

const HISTORY_FILE = path.join(DATA_DIR, 'dashboard_history.json');
const SQLITE_FILE = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'collector.sqlite');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MEDIA_DIR = path.join(DATA_DIR, 'media');

if (!fs.existsSync(MEDIA_DIR)) {
  try { fs.mkdirSync(MEDIA_DIR, { recursive: true }); } catch {}
}

let tradingDb = null;
function getTradingDb() {
  if (tradingDb) return tradingDb;
  try {
    const Database = require('better-sqlite3');
    const db = new Database(SQLITE_FILE);
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.exec(`
      CREATE TABLE IF NOT EXISTS route_ticks (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        vendor_name TEXT,
        vendor_phone TEXT NOT NULL,
        company_name TEXT,
        country TEXT NOT NULL,
        route_type TEXT NOT NULL,
        billing_pulse TEXT DEFAULT '1/1',
        rate_per_min REAL,
        ani_pass TEXT,
        quality_notes TEXT,
        fas_free INTEGER DEFAULT 1,
        intent TEXT DEFAULT 'WTS',
        raw_text TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_routes_dest ON route_ticks (country, route_type, created_at);
      CREATE INDEX IF NOT EXISTS idx_routes_price ON route_ticks (country, rate_per_min);
      CREATE INDEX IF NOT EXISTS idx_routes_created ON route_ticks (created_at DESC);

      CREATE TABLE IF NOT EXISTS market_news (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        category TEXT NOT NULL,
        headline TEXT NOT NULL,
        affected_countries TEXT,
        urgency TEXT DEFAULT 'MEDIUM',
        raw_text TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_news_created ON market_news (created_at DESC);

      CREATE TABLE IF NOT EXISTS vendors (
        phone TEXT PRIMARY KEY,
        name TEXT,
        company TEXT,
        total_offers INTEGER DEFAULT 1,
        last_seen_at INTEGER NOT NULL
      );
    `);
    tradingDb = db;
    return db;
  } catch (err) {
    console.error('Failed to initialize trading SQLite DB:', err.message);
    return null;
  }
}

function saveParsedTelecom(db, parsed, record) {
  if (!db || !parsed) return;
  const now = record.created_at ? new Date(record.created_at).getTime() : Date.now();
  const insertRoute = db.prepare(`
    INSERT OR IGNORE INTO route_ticks (
      id, message_id, vendor_name, vendor_phone, company_name,
      country, route_type, billing_pulse, rate_per_min, ani_pass,
      quality_notes, fas_free, intent, raw_text, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertVendor = db.prepare(`
    INSERT INTO vendors (phone, name, company, total_offers, last_seen_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(phone) DO UPDATE SET
      name = COALESCE(excluded.name, vendors.name),
      company = COALESCE(excluded.company, vendors.company),
      total_offers = vendors.total_offers + 1,
      last_seen_at = excluded.last_seen_at
  `);

  db.transaction(() => {
    if (Array.isArray(parsed.routes)) {
      for (const r of parsed.routes) {
        const routeId = `rt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        insertRoute.run(
          routeId,
          record.id || `msg_${Date.now()}`,
          r.vendor_name || record.sender_name || 'Vendor',
          record.sender_phone || r.vendor_phone || 'unknown',
          r.company_name || parsed.company || null,
          r.country,
          r.route_type,
          r.billing_pulse || '1/1',
          r.rate_per_min || null,
          r.ani_pass || null,
          r.quality_notes || null,
          r.fas_free ? 1 : 0,
          r.intent || 'WTS',
          r.raw_text || null,
          now
        );
      }
    }

    if (record.sender_phone) {
      upsertVendor.run(
        record.sender_phone,
        parsed.vendor_name || record.sender_name || 'Vendor',
        parsed.company || null,
        now
      );
    }

    if (parsed.news) {
      const newsId = `news_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      db.prepare(`
        INSERT OR IGNORE INTO market_news (
          id, message_id, category, headline, affected_countries, urgency, raw_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newsId,
        record.id || `msg_${Date.now()}`,
        parsed.news.category,
        parsed.news.headline,
        parsed.news.affected_countries,
        parsed.news.urgency,
        parsed.news.raw_text,
        now
      );
    }
  })();
}

async function processTelecomIntelligence(record) {
  if (!record || !record.text) return;
  try {
    const parsed = await extractTelecomWithAI(record.text, record.sender_phone, record.sender_name);
    if (!parsed || !parsed.isTelecom) return;
    const db = getTradingDb();
    if (!db) return;
    saveParsedTelecom(db, parsed, record);
    if (parsed.routes && parsed.routes.length > 0) {
      console.log(`📈 [Trading Terminal] Extracted ${parsed.routes.length} routes from ${record.sender_name || record.sender_phone}`);
    }
  } catch (err) {
    console.error('Error in processTelecomIntelligence:', err.message);
  }
}

function backfillHistoricalTelecomData() {
  try {
    const db = getTradingDb();
    if (!db) return;
    const count = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get()?.c || 0;
    if (count === 0 && recentMessages.length > 0) {
      console.log(`🔍 [Telecom Backfill] Seeding routes from ${recentMessages.length} existing messages...`);
      for (const msg of recentMessages) {
        if (msg.text) {
          const parsed = parseTelecomMessage(msg.text, msg.sender_phone, msg.sender_name);
          if (parsed && parsed.isTelecom) {
            saveParsedTelecom(db, parsed, msg);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Telecom Backfill] Warning:', err.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function formatDateTime(d) {
  const date = d ? new Date(d) : new Date();
  if (isNaN(date.getTime())) return String(d || '');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ', ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

let storageWarning = null;

function getStorageStats() {
  let disk = { totalGb: 25, usedGb: 5, freeGb: 20, usedPercent: 20 };
  try {
    if (fs.statfsSync) {
      const s = fs.statfsSync('/');
      const total = (s.bsize * s.blocks) / (1024 * 1024 * 1024);
      const free = (s.bsize * s.bavail) / (1024 * 1024 * 1024);
      const used = total - free;
      const pct = s.blocks > 0 ? Math.round(((s.blocks - s.bavail) / s.blocks) * 100) : 0;
      disk = {
        totalGb: Number(total.toFixed(2)),
        usedGb: Number(used.toFixed(2)),
        freeGb: Number(free.toFixed(2)),
        usedPercent: pct
      };
    }
  } catch (err) {}

  let totalFiles = 0;
  let totalBytes = 0;
  const files = [];

  try {
    if (fs.existsSync(MEDIA_DIR)) {
      const names = fs.readdirSync(MEDIA_DIR);
      for (const name of names) {
        const filePath = path.join(MEDIA_DIR, name);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            totalBytes += stat.size;
            files.push({ name, path: filePath, size: stat.size, mtime: stat.mtimeMs });
          }
        } catch {}
      }
    }
  } catch {}

  // Sort oldest first
  files.sort((a, b) => a.mtime - b.mtime);
  totalFiles = files.length;

  return {
    disk,
    media: {
      totalFiles,
      totalBytes,
      totalMb: Number((totalBytes / (1024 * 1024)).toFixed(2))
    },
    autoPurgeThresholdPercent: 80,
    autoPurgeEvictPercent: 50,
    warning: storageWarning,
    files
  };
}

function purgeMediaFiles(percentage) {
  const stats = getStorageStats();
  const files = stats.files;
  if (!files || files.length === 0) {
    return { status: 'ok', deletedCount: 0, freedBytes: 0, freedMb: 0, remainingFiles: 0 };
  }

  let toDelete = [];
  if (percentage >= 100) {
    toDelete = files;
  } else {
    const fraction = Math.max(1, Math.min(100, percentage)) / 100;
    const count = Math.ceil(files.length * fraction);
    toDelete = files.slice(0, count);
  }

  let freedBytes = 0;
  let deletedCount = 0;

  for (const f of toDelete) {
    try {
      if (fs.existsSync(f.path)) {
        fs.unlinkSync(f.path);
        freedBytes += f.size;
        deletedCount++;
      }
    } catch (err) {
      console.warn(`Failed to unlink media file ${f.path}:`, err.message);
    }
  }

  const freedMb = Number((freedBytes / (1024 * 1024)).toFixed(2));
  console.log(`🧹 Purged ${deletedCount} media files (${percentage}%), freed ${freedMb} MB. Remaining files: ${files.length - deletedCount}`);

  return {
    status: 'ok',
    deletedCount,
    freedBytes,
    freedMb,
    remainingFiles: files.length - deletedCount
  };
}

function checkStorageAndAutoPurge() {
  const stats = getStorageStats();
  if (stats.disk.usedPercent >= 80) {
    console.warn(`⚠️ STORAGE WARNING: Disk usage at ${stats.disk.usedPercent}% (exceeds 80% threshold). Automatically purging oldest 50% media...`);
    const result = purgeMediaFiles(50);
    storageWarning = {
      triggeredAt: Date.now(),
      message: `Server storage reached ${stats.disk.usedPercent}%. The oldest 50% of cached media files (${result.deletedCount} files, ${result.freedMb} MB) were automatically purged to prevent system disruption.`
    };
  }
}

// Background storage monitor every 5 minutes
setInterval(checkStorageAndAutoPurge, 5 * 60 * 1000).unref();

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
            timestamp: formatDateTime(r.created_at),
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

function generateAuthToken() {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const data = `${expiresAt}`;
  const sig = crypto.createHmac('sha256', DASHBOARD_PASSWORD).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [expiresAtStr, sig] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSig = crypto.createHmac('sha256', DASHBOARD_PASSWORD).update(expiresAtStr).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'));
  } catch {
    return false;
  }
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  if (cookies.wapp_token && verifyAuthToken(cookies.wapp_token)) return true;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    return verifyAuthToken(token);
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
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
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
    if (parsed.message.chat_id === 'status@broadcast') {
      chatType = 'status';
    }

    const rawSenderId = parsed.message.sender_id || '';
    if (rawSenderId.includes('@s.whatsapp.net')) {
      senderPhone = '+' + rawSenderId.split('@')[0].split(':')[0];
    } else if (rawSenderId.includes('@lid')) {
      senderPhone = 'LID:' + rawSenderId.split('@')[0];
    }

    // Resolve actual phone number if participantPn is present in raw_payload
    const participantPn = parsed.message.raw_payload?.key?.participantPn;
    if (participantPn && participantPn.includes('@s.whatsapp.net')) {
      senderPhone = '+' + participantPn.split('@')[0].split(':')[0];
    }

    senderDisplay = parsed.message.sender_name || senderPhone || 'Contact';
    chatDisplay = parsed.message.chat_name || (chatType === 'status' ? `${senderDisplay}'s Status Story` : (parsed.message.chat_id || 'Chat'));
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
    chat_name: (parsed && parsed.message && parsed.message.chat_name) || (chatType === 'status' ? `${senderDisplay}'s Status Story` : ''),
    chat_type: chatType,
    text,
    has_media: hasMedia,
    timestamp: formatDateTime(occurredAt),
    occurred_at: occurredAt,
    latency_ms: latencyMs,
    isValid: isValidSig,
    headers,
    raw_envelope: parsed || { raw: body }
  };

  recentMessages.unshift(record);
  if (recentMessages.length > 500) recentMessages.pop();
  saveMessagesToDisk(recentMessages);

  // Ingest into Telecom Intelligence Engine
  processTelecomIntelligence(record);

  if (hasMedia && parsed && parsed.message && parsed.message.raw_payload) {
    downloadMediaInBackground(messageId, parsed.message.raw_payload);
  }

  // Forward to client downstream webhook (n8n)
  if (FORWARD_WEBHOOK_URL) {
    forwardWebhookToClient(body, headers, record);
  }

  console.log(`📥 Ingested Webhook [${new Date().toISOString()}] | ID: ${deliveryId} | From: ${senderDisplay} (${senderPhone}) | Chat: ${chatDisplay} [${chatType}] | HMAC: ${isValidSig ? '✅ VALID' : '❌ INVALID'}`);

  return { isValid: isValidSig };
}

function buildCleanPayload(record) {
  const host = process.env.PUBLIC_URL || 'http://107.170.31.114:4000';
  const mediaUrl = record.has_media ? `${host}/api/media/${record.id}` : null;
  const rawMsg = record.raw_envelope?.message || {};

  let mediaType = rawMsg.media?.type || null;
  if (!mediaType && rawMsg.raw_payload?.message) {
    const m = rawMsg.raw_payload.message;
    if (m.imageMessage) mediaType = 'image';
    else if (m.videoMessage) mediaType = 'video';
    else if (m.audioMessage) mediaType = 'audio';
    else if (m.documentMessage) mediaType = 'document';
  }

  let phone = record.sender_phone;
  const participantPn = rawMsg.raw_payload?.key?.participantPn;
  if (participantPn && participantPn.includes('@s.whatsapp.net')) {
    phone = '+' + participantPn.split('@')[0].split(':')[0];
  }

  let chatType = record.chat_type;
  if (rawMsg.chat_id === 'status@broadcast' || rawMsg.raw_payload?.key?.remoteJid === 'status@broadcast') {
    chatType = 'status';
  }

  return {
    event: record.event || 'whatsapp.message.received',
    message_id: record.id,
    delivery_id: record.delivery_id,
    sender_name: record.sender_name,
    sender_phone: phone,
    chat_name: record.chat_name || (chatType === 'status' ? `${record.sender_name}'s Status Story` : record.sender_name),
    chat_type: chatType,
    text: record.text || '',
    has_media: Boolean(record.has_media),
    media_type: mediaType,
    media_url: mediaUrl,
    timestamp: record.occurred_at || record.timestamp
  };
}

async function forwardWebhookToClient(rawBodyString, headers, record) {
  if (!FORWARD_WEBHOOK_URL) return;

  const dispatchUrl = FORWARD_WEBHOOK_URL;
  const payloadToSend = FORWARD_FORMAT === 'clean' 
    ? JSON.stringify(buildCleanPayload(record)) 
    : rawBodyString;

  const dispatchHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'User-Agent': 'WhatsApp-Raw-Collector/1.0.0',
    'X-Collector-Signature': (headers && headers['x-collector-signature']) || '',
    'X-Collector-Timestamp': (headers && headers['x-collector-timestamp']) || String(Date.now()),
    'X-Collector-Delivery-Id': (headers && headers['x-collector-delivery-id']) || `fwd_${Date.now()}`,
    'X-Collector-Event': (headers && headers['x-collector-event']) || 'whatsapp.message.received',
    'X-Collector-Version': '1.0'
  };

  const startTime = Date.now();
  try {
    const res = await fetch(dispatchUrl, {
      method: 'POST',
      headers: dispatchHeaders,
      body: payloadToSend,
      signal: AbortSignal.timeout(10000)
    });
    const latency = Date.now() - startTime;
    record.forwarded_to = dispatchUrl;
    record.forward_status = res.ok ? 'delivered' : 'failed';
    record.forward_code = res.status;
    record.forward_latency_ms = latency;
    record.forwarded_at = new Date().toISOString();
    saveMessagesToDisk(recentMessages);

    console.log(`🚀 [Forwarder] Delivered clean message [${record.id}] to n8n -> HTTP ${res.status} in ${latency}ms`);
  } catch (err) {
    const latency = Date.now() - startTime;
    record.forwarded_to = dispatchUrl;
    record.forward_status = 'failed';
    record.forward_error = err.message;
    record.forward_latency_ms = latency;
    record.forwarded_at = new Date().toISOString();
    saveMessagesToDisk(recentMessages);

    console.warn(`⚠️ [Forwarder] Failed delivering message [${record.id}] to n8n: ${err.message}`);
  }
}

function downloadMediaInBackground(msgId, rawPayload) {
  setImmediate(async () => {
    try {
      const { downloadMediaMessage } = require('@whiskeysockets/baileys');
      const buffer = await downloadMediaMessage(
        rawPayload,
        'buffer',
        {},
        { logger: { debug(){}, info(){}, error(){}, warn(){} } }
      );
      if (buffer && buffer.length > 0) {
        let ext = '.jpg';
        const m = rawPayload.message || {};
        if (m.videoMessage) ext = '.mp4';
        else if (m.audioMessage) ext = '.ogg';
        else if (m.documentMessage) ext = '.pdf';

        const savePath = path.join(MEDIA_DIR, `${msgId}${ext}`);
        fs.writeFileSync(savePath, buffer);
        console.log(`🖼️ Auto-cached media attachment for [${msgId}] (${buffer.length} bytes)`);
      }
    } catch (err) {}
  });
}

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

    if (req.method === 'GET' && pathname.startsWith('/api/media/')) {
      const msgId = pathname.replace('/api/media/', '').split('?')[0].trim();
      if (!msgId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Message ID is required' }));
      }

      // 1. Check if media file already exists on disk in MEDIA_DIR
      const possibleExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.ogg', '.opus', '.mp3', '.pdf', '.bin'];
      for (const ext of possibleExtensions) {
        const filePath = path.join(MEDIA_DIR, `${msgId}${ext}`);
        if (fs.existsSync(filePath)) {
          const mime = MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, {
            'Content-Type': mime,
            'Cache-Control': 'public, max-age=86400',
            'Content-Length': fs.statSync(filePath).size
          });
          return fs.createReadStream(filePath).pipe(res);
        }
      }

      // 2. Locate the message in recentMessages or SQLite
      let msgRecord = recentMessages.find(m => m.id === msgId);
      let rawPayload = null;
      if (msgRecord && msgRecord.raw_envelope) {
        rawPayload = msgRecord.raw_envelope.message?.raw_payload || msgRecord.raw_envelope.raw_payload;
      }

      if (!rawPayload && fs.existsSync(SQLITE_FILE)) {
        try {
          const Database = require('better-sqlite3');
          const db = new Database(SQLITE_FILE, { readonly: true, fileMustExist: true });
          const row = db.prepare('SELECT raw_payload FROM messages WHERE id = ?').get(msgId);
          db.close();
          if (row && row.raw_payload) {
            rawPayload = JSON.parse(row.raw_payload);
          }
        } catch (err) {}
      }

      // 3. Attempt download and decrypt via Baileys downloadMediaMessage
      if (rawPayload && (rawPayload.message || rawPayload.key)) {
        try {
          const { downloadMediaMessage } = require('@whiskeysockets/baileys');
          const buffer = await downloadMediaMessage(
            rawPayload,
            'buffer',
            {},
            { logger: { debug(){}, info(){}, error(){}, warn(){} } }
          );

          if (buffer && buffer.length > 0) {
            let ext = '.bin';
            let mime = 'application/octet-stream';
            const m = rawPayload.message || {};
            if (m.imageMessage) { ext = '.jpg'; mime = 'image/jpeg'; }
            else if (m.videoMessage) { ext = '.mp4'; mime = 'video/mp4'; }
            else if (m.audioMessage) { ext = '.ogg'; mime = 'audio/ogg'; }
            else if (m.documentMessage) { ext = '.pdf'; mime = m.documentMessage.mimetype || 'application/pdf'; }

            const savePath = path.join(MEDIA_DIR, `${msgId}${ext}`);
            try { fs.writeFileSync(savePath, buffer); } catch {}

            res.writeHead(200, {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=86400',
              'Content-Length': buffer.length
            });
            return res.end(buffer);
          }
        } catch (downloadErr) {
          console.warn(`Failed to download full media for ${msgId}:`, downloadErr.message);
        }

        // 4. Fallback to jpegThumbnail if available
        const thumbBase64 = rawPayload.message?.imageMessage?.jpegThumbnail ||
                            rawPayload.message?.videoMessage?.jpegThumbnail;
        if (thumbBase64) {
          const thumbBuffer = Buffer.from(thumbBase64, 'base64');
          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Content-Length': thumbBuffer.length
          });
          return res.end(thumbBuffer);
        }
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Media not found or expired' }));
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

    if (req.method === 'GET' && pathname === '/api/storage/status') {
      const stats = getStorageStats();
      const output = {
        disk: stats.disk,
        media: stats.media,
        autoPurgeThresholdPercent: stats.autoPurgeThresholdPercent,
        autoPurgeEvictPercent: stats.autoPurgeEvictPercent,
        warning: stats.warning
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(output));
    }

    if (req.method === 'POST' && pathname === '/api/storage/purge') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body); } catch {}
        const percentage = Number(parsed.percentage) || 100;
        const result = purgeMediaFiles(percentage);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/storage/dismiss-warning') {
      storageWarning = null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', dismissed: true }));
    }

    if (req.method === 'GET' && pathname === '/api/forward/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        url: FORWARD_WEBHOOK_URL,
        enabled: !!FORWARD_WEBHOOK_URL
      }));
    }

    if (req.method === 'POST' && pathname === '/api/forward/test') {
      if (!FORWARD_WEBHOOK_URL) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'FORWARD_WEBHOOK_URL is not configured' }));
      }
      const testPayload = {
        event: 'whatsapp.message.received',
        version: '1.0',
        delivery_id: `test_${Date.now()}`,
        attempt: 1,
        occurred_at: new Date().toISOString(),
        received_at: new Date().toISOString(),
        dispatched_at: new Date().toISOString(),
        message: {
          message_id: `test_msg_${Date.now()}`,
          chat_id: 'test@s.whatsapp.net',
          chat_name: 'Webhook Test Ping',
          chat_type: 'direct',
          sender_id: 'test@s.whatsapp.net',
          sender_name: 'WappAutomata Gateway',
          text: 'This is a test webhook verification from WappAutomata to n8n.',
          has_media: false,
          media: null,
          reply_to: null,
          raw_payload: { ping: true }
        }
      };
      const bodyStr = JSON.stringify(testPayload);
      const sig = computeSignature(bodyStr);
      const startTime = Date.now();
      try {
        const fRes = await fetch(FORWARD_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'User-Agent': 'WhatsApp-Raw-Collector/1.0.0',
            'X-Collector-Signature': sig,
            'X-Collector-Timestamp': String(Date.now()),
            'X-Collector-Delivery-Id': testPayload.delivery_id,
            'X-Collector-Event': testPayload.event,
            'X-Collector-Version': '1.0'
          },
          body: bodyStr,
          signal: AbortSignal.timeout(10000)
        });
        const latency = Date.now() - startTime;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'ok',
          statusCode: fRes.status,
          latencyMs: latency,
          url: FORWARD_WEBHOOK_URL
        }));
      } catch (err) {
        const latency = Date.now() - startTime;
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'error',
          error: err.message,
          latencyMs: latency,
          url: FORWARD_WEBHOOK_URL
        }));
      }
    }

    if (req.method === 'POST' && pathname === '/api/forward/resend') {
      let b = '';
      req.on('data', c => { b += c; });
      req.on('end', async () => {
        let parsed = {};
        try { parsed = JSON.parse(b); } catch {}
        const msgId = parsed.message_id;
        const record = recentMessages.find(m => m.id === msgId);
        if (!record) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Message not found in feed' }));
        }
        const bodyStr = JSON.stringify(record.raw_envelope);
        await forwardWebhookToClient(bodyStr, record.headers || {}, record);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'ok',
          forward_status: record.forward_status,
          forward_code: record.forward_code
        }));
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/clear') {
      recentMessages.length = 0;
      saveMessagesToDisk(recentMessages);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', cleared: true }));
    }

    // ==========================================
    // 4. WHOLESALE TELECOM TRADING TERMINAL APIS
    // ==========================================

    if (req.method === 'GET' && pathname === '/api/routes') {
      const db = getTradingDb();
      if (!db) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Database unavailable' }));
      }

      const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
      const country = (parsedUrl.searchParams.get('country') || '').trim();
      const type = (parsedUrl.searchParams.get('type') || '').trim();
      const pulse = (parsedUrl.searchParams.get('pulse') || '').trim();
      const intent = (parsedUrl.searchParams.get('intent') || '').trim().toUpperCase();
      const limit = Math.min(parseInt(parsedUrl.searchParams.get('limit') || '50', 10), 200);
      const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

      let where = [];
      let params = [];

      if (q) {
        where.push('(LOWER(country) LIKE ? OR LOWER(vendor_name) LIKE ? OR LOWER(COALESCE(company_name,"")) LIKE ? OR LOWER(COALESCE(quality_notes,"")) LIKE ? OR LOWER(COALESCE(raw_text,"")) LIKE ?)');
        const wild = `%${q}%`;
        params.push(wild, wild, wild, wild, wild);
      }
      if (country) {
        where.push('LOWER(country) = LOWER(?)');
        params.push(country);
      }
      if (type) {
        where.push('LOWER(route_type) = LOWER(?)');
        params.push(type);
      }
      if (pulse) {
        where.push('billing_pulse = ?');
        params.push(pulse);
      }
      if (intent) {
        where.push('intent = ?');
        params.push(intent);
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
      const countRow = db.prepare(`SELECT COUNT(*) as total FROM route_ticks ${whereClause}`).get(...params);
      const rows = db.prepare(`
        SELECT * FROM route_ticks 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        total: countRow ? countRow.total : 0,
        routes: rows
      }));
    }

    if (req.method === 'GET' && pathname === '/api/trends') {
      const db = getTradingDb();
      if (!db) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
      const days = parseInt(parsedUrl.searchParams.get('days') || '30', 10);
      const country = parsedUrl.searchParams.get('country') || '';
      const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

      let sql = `
        SELECT 
          date(created_at / 1000, 'unixepoch') AS day,
          country,
          route_type,
          ROUND(MIN(rate_per_min), 5) AS min_rate,
          ROUND(AVG(rate_per_min), 5) AS avg_rate,
          ROUND(MAX(rate_per_min), 5) AS max_rate,
          COUNT(*) as offer_count
        FROM route_ticks
        WHERE created_at >= ?
      `;
      const params = [cutoff];
      if (country) {
        sql += ' AND LOWER(country) = LOWER(?)';
        params.push(country);
      }
      sql += ' GROUP BY day, country, route_type ORDER BY day ASC';

      const rows = db.prepare(sql).all(...params);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', trends: rows }));
    }

    if (req.method === 'GET' && pathname === '/api/news') {
      const db = getTradingDb();
      if (!db) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
      const rows = db.prepare('SELECT * FROM market_news ORDER BY created_at DESC LIMIT 50').all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', news: rows }));
    }

    if (req.method === 'GET' && pathname === '/api/vendors') {
      const db = getTradingDb();
      if (!db) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
      const rows = db.prepare('SELECT * FROM vendors ORDER BY last_seen_at DESC LIMIT 50').all();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', vendors: rows }));
    }

    if (req.method === 'GET' && pathname === '/api/insights') {
      const db = getTradingDb();
      if (!db) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
      const totalRoutes = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get()?.c || 0;
      const totalCountries = db.prepare('SELECT COUNT(DISTINCT country) as c FROM route_ticks').get()?.c || 0;
      const totalVendors = db.prepare('SELECT COUNT(*) as c FROM vendors').get()?.c || 0;
      const urgentNews = db.prepare("SELECT COUNT(*) as c FROM market_news WHERE urgency = 'HIGH'").get()?.c || 0;
      const recentRoutes = db.prepare('SELECT * FROM route_ticks ORDER BY created_at DESC LIMIT 6').all();
      const topNews = db.prepare('SELECT * FROM market_news ORDER BY created_at DESC LIMIT 3').all();

      // Detect potential arbitrage: matching countries where WTS exists and WTB exists
      const wtsCountries = db.prepare("SELECT DISTINCT country FROM route_ticks WHERE intent = 'WTS'").all().map(r => r.country);
      let wtbMatches = [];
      if (wtsCountries.length > 0) {
        const placeholders = wtsCountries.map(() => '?').join(',');
        wtbMatches = db.prepare(`
          SELECT * FROM route_ticks WHERE intent = 'WTB' AND country IN (${placeholders})
          ORDER BY created_at DESC LIMIT 5
        `).all(...wtsCountries);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        summary: {
          totalRoutes,
          totalCountries,
          totalVendors,
          urgentNews
        },
        recentRoutes,
        topNews,
        arbitrageOpportunities: wtbMatches
      }));
    }

    if (req.method === 'GET' && pathname === '/api/export/routes') {
      const db = getTradingDb();
      if (!db) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Database unavailable' }));
      }
      const rows = db.prepare('SELECT * FROM route_ticks ORDER BY created_at DESC LIMIT 2000').all();
      
      let csv = 'ID,Date,Country,Route Type,Pulse,Rate USD,FAS Free,Vendor Name,Vendor Phone,Company,Quality Notes,Intent\r\n';
      for (const r of rows) {
        const dateStr = new Date(r.created_at).toISOString();
        const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
        csv += `${esc(r.id)},${esc(dateStr)},${esc(r.country)},${esc(r.route_type)},${esc(r.billing_pulse)},${esc(r.rate_per_min || '')},${esc(r.fas_free ? 'YES' : 'NO')},${esc(r.vendor_name)},${esc(r.vendor_phone)},${esc(r.company_name)},${esc(r.quality_notes)},${esc(r.intent)}\r\n`;
      }

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="telecom_routes_${new Date().toISOString().slice(0, 10)}.csv"`
      });
      return res.end(csv);
    }
  }

  // 5. STATIC FILE SERVING (Serves public/ assets)
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

  // Backfill telecom data from existing history
  setTimeout(backfillHistoricalTelecomData, 1000);
});
