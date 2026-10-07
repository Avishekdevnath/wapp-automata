import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import pino from 'pino';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers
} from '@whiskeysockets/baileys';
import { getConfig } from '../src/config';
import { createDatabaseConnection } from '../src/persistence';
import { SQLiteQueueRepository } from '../src/queue';
import { normalizeMessage } from '../src/normalizer';
import { WebhookClient } from '../src/webhook';

const config = getConfig();

// ANSI color helpers
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m'
};

function logHeader(title: string): void {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════════════════════${colors.reset}\n`);
}

/**
 * 1. Health & Status Check
 */
async function runStatusCheck(): Promise<boolean> {
  logHeader('1. WhatsApp Collector Health & Credentials Check');

  // A. Session credentials check
  const sessionDir = path.resolve(config.SESSION_DATA_PATH);
  const credsFile = path.join(sessionDir, 'creds.json');

  if (!fs.existsSync(credsFile)) {
    console.log(`${colors.red}❌ creds.json not found in ${sessionDir}${colors.reset}`);
    console.log(`   Collector has not been paired yet. Scan QR code or use pair-code.`);
    return false;
  }

  try {
    const credsRaw = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
    const phone = credsRaw.me?.id?.split('@')[0]?.split(':')[0] || 'Unknown';
    const name = credsRaw.me?.name || 'Unnamed';
    const platform = credsRaw.platform || 'Unknown';
    console.log(`${colors.green}✔ Session Credentials Verified:${colors.reset}`);
    console.log(`   • Phone Number: ${colors.bold}+${phone}${colors.reset}`);
    console.log(`   • Account Name: ${colors.bold}${name}${colors.reset}`);
    console.log(`   • Platform:     ${platform}`);
    console.log(`   • Session Path: ${sessionDir}`);
  } catch (err: any) {
    console.log(`${colors.red}❌ Failed to parse creds.json: ${err.message}${colors.reset}`);
    return false;
  }

  // B. Database storage check
  const dbPath = path.resolve(config.SQLITE_DB_PATH);
  if (fs.existsSync(dbPath)) {
    const db = createDatabaseConnection({ dbPath });
    try {
      const stats = db.prepare('SELECT count(*) as total, max(created_at) as latest FROM messages').get() as { total: number; latest: number | null };
      const pending = db.prepare("SELECT count(*) as cnt FROM messages WHERE status = 'pending'").get() as { cnt: number };
      const delivered = db.prepare("SELECT count(*) as cnt FROM messages WHERE status = 'delivered'").get() as { cnt: number };
      console.log(`\n${colors.green}✔ SQLite Queue Database Verified:${colors.reset}`);
      console.log(`   • DB Path:            ${dbPath}`);
      console.log(`   • Total Messages:     ${stats.total}`);
      console.log(`   • Pending in Queue:   ${pending.cnt}`);
      console.log(`   • Delivered Webhooks: ${delivered.cnt}`);
      if (stats.latest) {
        console.log(`   • Latest Timestamp:   ${new Date(stats.latest).toLocaleString()}`);
      }
    } catch (err: any) {
      console.log(`${colors.yellow}⚠ Could not query messages table: ${err.message}${colors.reset}`);
    } finally {
      db.close();
    }
  } else {
    console.log(`${colors.yellow}⚠ SQLite DB does not exist yet at ${dbPath}${colors.reset}`);
  }

  // C. Webhook receiver check
  try {
    const url = new URL(config.WEBHOOK_URL);
    const isUp = await new Promise<boolean>((resolve) => {
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: '/api/session/status',
        method: 'GET',
        timeout: 2000
      }, (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 401);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    });

    if (isUp) {
      console.log(`\n${colors.green}✔ Webhook Receiver API (port ${url.port}) is Online & Responsive${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}⚠ Webhook Receiver (${config.WEBHOOK_URL}) is not responding. Ensure backend server is running.${colors.reset}`);
    }
  } catch (err: any) {
    console.log(`${colors.red}❌ Invalid WEBHOOK_URL: ${err.message}${colors.reset}`);
  }

  return true;
}

/**
 * 2. Pipeline End-to-End Simulation Test
 */
async function runPipelineSimulation(): Promise<boolean> {
  logHeader('2. Full Collector Pipeline Simulation Test');

  console.log(`Simulating complete message lifecycle:`);
  console.log(`[Raw Baileys Event] ➔ [Normalizer] ➔ [SQLite Durable Queue] ➔ [HMAC Webhook Dispatcher] ➔ [Stream Feed]`);

  // Step A: Construct realistic Baileys message event
  const testId = 'TEST_' + Date.now();
  const testText = `Automated Verification Message [${new Date().toLocaleTimeString()}]`;
  const mockRawEvent = {
    key: {
      remoteJid: '8801874819713@s.whatsapp.net',
      fromMe: false,
      id: testId
    },
    messageTimestamp: Math.floor(Date.now() / 1000),
    pushName: 'Verification Bot',
    message: {
      conversation: testText
    }
  };

  // Step B: Normalize
  console.log(`\n${colors.cyan}[Step A] Testing Normalizer...${colors.reset}`);
  const envelope = normalizeMessage(mockRawEvent);
  if (!envelope) {
    console.log(`${colors.red}❌ Normalizer returned null for raw event!${colors.reset}`);
    return false;
  }
  console.log(`${colors.green}✔ Normalization Successful:${colors.reset}`);
  console.log(`   • ID:         ${envelope.id}`);
  console.log(`   • Sender:     ${envelope.senderName} (${envelope.senderId})`);
  console.log(`   • Chat Type:  ${envelope.chatType}`);
  console.log(`   • Text:       "${envelope.text}"`);

  // Step C: Persist to SQLite durable queue
  console.log(`\n${colors.cyan}[Step B] Testing SQLite Durable Queue Insertion...${colors.reset}`);
  const db = createDatabaseConnection({ dbPath: config.SQLITE_DB_PATH });
  const queueRepo = new SQLiteQueueRepository(db);

  try {
    const inserted = queueRepo.enqueue(envelope);
    if (!inserted) {
      console.log(`${colors.yellow}⚠ Message already exists in queue (duplicate detection active)${colors.reset}`);
    } else {
      console.log(`${colors.green}✔ Message successfully enqueued with status='pending'${colors.reset}`);
    }

    const pending = queueRepo.fetchPending(10);
    const record = pending.find(r => r.id === envelope.id);
    if (!record) {
      console.log(`${colors.red}❌ Could not find enqueued record in queue!${colors.reset}`);
      return false;
    }

    // Step D: Dispatch to Webhook receiver
    console.log(`\n${colors.cyan}[Step C] Testing HMAC-SHA256 Webhook Delivery to ${config.WEBHOOK_URL}...${colors.reset}`);
    const webhookClient = new WebhookClient({
      url: config.WEBHOOK_URL,
      secret: config.WEBHOOK_SECRET,
      timeoutMs: config.WEBHOOK_TIMEOUT_MS
    });

    const result = await webhookClient.deliver(record);

    if (result.success) {
      console.log(`${colors.green}✔ Webhook Delivered Successfully!${colors.reset}`);
      console.log(`   • Status Code: ${result.statusCode}`);
      console.log(`   • Duration:    ${result.durationMs}ms`);
      queueRepo.markDelivered(envelope.id);
      console.log(`${colors.green}✔ Queue record marked as status='delivered'${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Webhook Delivery Failed:${colors.reset}`);
      console.log(`   • Error:       ${result.error}`);
      console.log(`   • Status Code: ${result.statusCode}`);
      return false;
    }
  } finally {
    db.close();
  }

  // Step E: Verify stream feed has the message
  console.log(`\n${colors.cyan}[Step D] Verifying Message in Dashboard Stream Feed...${colors.reset}`);
  try {
    // Authenticate and fetch messages
    const loginRes = await fetchJson('http://127.0.0.1:4000/api/auth/login', 'POST', { password: 'wapp2026' });
    const token = loginRes?.token;
    if (token) {
      const messages = await fetchJson('http://127.0.0.1:4000/api/messages', 'GET', undefined, {
        Cookie: `wapp_token=${token}`
      });
      const found = Array.isArray(messages) && messages.some((m: any) => m.text && m.text.includes(testId));
      if (found) {
        console.log(`${colors.green}✔ Verification Complete: Message is LIVE on http://localhost:5173/stream!${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠ Webhook accepted message, but not found at top of /api/messages feed.${colors.reset}`);
      }
    }
  } catch (err: any) {
    console.log(`${colors.gray}(Stream check skipped: ${err.message})${colors.reset}`);
  }

  return true;
}

/**
 * 3. Live Socket Connection & Real-Time WhatsApp Message Inspector
 */
async function runLiveSocketInspector(): Promise<void> {
  logHeader('3. Live WhatsApp Socket Inspector (Direct Listening Mode)');

  const sessionDir = path.resolve(config.SESSION_DATA_PATH);
  const credsFile = path.join(sessionDir, 'creds.json');
  if (!fs.existsSync(credsFile)) {
    console.log(`${colors.red}❌ Cannot run live inspector: No session found at ${sessionDir}${colors.reset}`);
    return;
  }

  console.log(`${colors.yellow}ℹ Initializing direct Baileys WebSocket connection with full diagnostic tracing...${colors.reset}`);
  console.log(`${colors.gray}Session directory: ${sessionDir}${colors.reset}\n`);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    fireInitQueries: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: false,
    logger: pino({ level: 'warn' }),
    printQRInTerminal: false,
    defaultQueryTimeoutMs: 60_000,
    getMessage: async () => undefined
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`\n${colors.yellow}⚠ QR Code received. Device is not paired yet.${colors.reset}`);
    }

    if (connection === 'open') {
      const myId = sock.user?.id || 'Unknown';
      const myName = sock.user?.name || 'WhatsApp Client';
      console.log(`\n${colors.bold}${colors.green}================================================================================${colors.reset}`);
      console.log(`${colors.bold}${colors.green}🟢 LIVE WHATSAPP SOCKET CONNECTED!${colors.reset}`);
      console.log(`📱 Authenticated Account: ${colors.bold}${myId}${colors.reset} (${myName})`);
      console.log(`📡 Status:                 Active & Listening`);
      console.log(`👉 SEND A TEST MESSAGE ON WHATSAPP NOW to this number or any joined group!`);
      console.log(`${colors.bold}${colors.green}================================================================================${colors.reset}\n`);

      try {
        await sock.sendPresenceUpdate('available');
        console.log(`${colors.gray}✔ Broadcasted 'available' presence to WhatsApp servers.${colors.reset}\n`);
      } catch (err: any) {
        console.log(`${colors.gray}⚠ Presence update note: ${err.message}${colors.reset}\n`);
      }
    }

    if (connection === 'close') {
      const error = (lastDisconnect?.error as any)?.output?.statusCode;
      console.log(`\n${colors.yellow}🔌 Connection closed (status: ${error}).${colors.reset}`);
      if (error === DisconnectReason.connectionReplaced) {
        console.log(`${colors.yellow}   Note: Another collector process connected to this session.${colors.reset}`);
      }
    }
  });

  // Intercept every incoming raw message
  sock.ev.on('messages.upsert', async (upsert) => {
    console.log(`\n${colors.bold}${colors.magenta}🔔 [INCOMING EVENT] messages.upsert received! (${upsert.messages.length} message(s), type: ${upsert.type})${colors.reset}`);

    for (const msg of upsert.messages) {
      const remoteJid = msg.key?.remoteJid || 'unknown';
      const fromMe = Boolean(msg.key?.fromMe);
      const id = msg.key?.id;
      const pushName = msg.pushName || 'Unknown';

      let text = '';
      if (msg.message?.conversation) {
        text = msg.message.conversation;
      } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
      } else if (msg.message?.imageMessage?.caption) {
        text = `[Image] ${msg.message.imageMessage.caption}`;
      } else if (msg.messageStubType) {
        text = `[Protocol Stub: ${msg.messageStubType}]`;
      }

      console.log(`${colors.cyan}--------------------------------------------------------------------------------${colors.reset}`);
      console.log(`   • Message ID:  ${id}`);
      console.log(`   • Remote JID:  ${remoteJid}`);
      console.log(`   • Push Name:   ${pushName}`);
      console.log(`   • From Me:     ${fromMe}`);
      console.log(`   • Text Body:   "${colors.bold}${text}${colors.reset}"`);
      console.log(`   • Raw Keys:    ${Object.keys(msg.message || {}).join(', ') || 'No message object'}`);

      // Run through production normalizer
      const envelope = normalizeMessage(msg);
      if (envelope) {
        console.log(`   • Normalizer:  ${colors.green}✅ PASSED (chatType: ${envelope.chatType}, senderId: ${envelope.senderId})${colors.reset}`);

        // Forward to webhook directly
        try {
          const webhookClient = new WebhookClient({
            url: config.WEBHOOK_URL,
            secret: config.WEBHOOK_SECRET,
            timeoutMs: 3000
          });
          const res = await webhookClient.send('live_' + Date.now(), envelope);
          if (res.success) {
            console.log(`   • Webhook:     ${colors.green}✅ Delivered to ${config.WEBHOOK_URL} (${res.durationMs}ms)${colors.reset}`);
          } else {
            console.log(`   • Webhook:     ${colors.red}❌ Failed: ${res.error}${colors.reset}`);
          }
        } catch (err: any) {
          console.log(`   • Webhook:     ${colors.gray}Skipped: ${err.message}${colors.reset}`);
        }
      } else {
        console.log(`   • Normalizer:  ${colors.yellow}⚠ Ignored (contentless, handshake, or protocol packet)${colors.reset}`);
      }
      console.log(`${colors.cyan}--------------------------------------------------------------------------------${colors.reset}`);
    }
  });

  // Keep process alive until CTRL+C
  await new Promise<void>(() => {});
}

// Simple HTTP Helper
function fetchJson(urlStr: string, method: string = 'GET', body?: any, headers?: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqHeaders: Record<string, string> = { ...headers };
    let bodyStr = '';
    if (body) {
      bodyStr = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr).toString();
    }

    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders,
      timeout: 4000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Main Entry Point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');
  const isPipelineOnly = args.includes('--pipeline');

  if (isLive) {
    await runLiveSocketInspector();
  } else if (isPipelineOnly) {
    await runStatusCheck();
    await runPipelineSimulation();
  } else {
    // Default: Run Health Check + Pipeline Simulation, and explain how to run --live
    await runStatusCheck();
    await runPipelineSimulation();

    logHeader('Summary & Live Test Instructions');
    console.log(`${colors.bold}To test real incoming messages from WhatsApp live in your console:${colors.reset}\n`);
    console.log(`1. Stop the background daemon temporarily (to avoid 440 duplicate connection):`);
    console.log(`   ${colors.cyan}npx tsx backend/scripts/test-collector.ts --live${colors.reset}\n`);
    console.log(`2. Send a WhatsApp message from any phone to ${colors.bold}+8801874819713${colors.reset}.`);
    console.log(`3. Watch the raw packet, normalizer output, and webhook delivery print live in real-time!\n`);
  }
}

void main();
