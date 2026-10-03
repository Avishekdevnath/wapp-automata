/**
 * Enterprise Dual-Mode SaaS Dashboard & Webhook Receiver
 * - Protected by Password Gate
 * - Mode 1: Client Inbox (Clean, non-technical, in-browser QR pairing & account switching)
 * - Mode 2: Developer Studio (Telemetry KPIs, HMAC audit log, JSON inspector, Webhook simulator)
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

const SESSION_PATH = process.env.SESSION_DATA_PATH || 
  (fs.existsSync('/opt/wapp-automata/data/.session') ? '/opt/wapp-automata/data/.session' : './.session');

const DATA_DIR = fs.existsSync('/opt/wapp-automata/data') 
  ? '/opt/wapp-automata/data' 
  : (fs.existsSync(path.join(__dirname, '..', 'data')) ? path.join(__dirname, '..', 'data') : './data');

const HISTORY_FILE = path.join(DATA_DIR, 'dashboard_history.json');
const SQLITE_FILE = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'collector.sqlite');

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
const activeSessions = new Set(); // in-memory auth tokens
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
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
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
  if (cookies.wapp_token && activeSessions.has(cookies.wapp_token)) {
    return true;
  }
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

function renderHtmlPage() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WappAutomata • Live Control Center</title>
  <!-- Google Fonts: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <!-- QRCode.js for In-Browser QR Rendering -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            brand: {
              50: '#ecfdf5',
              100: '#d1fae5',
              500: '#10b981',
              600: '#059669',
              700: '#047857',
            },
            dark: {
              950: '#060911',
              900: '#0c1220',
              850: '#11192d',
              800: '#18243c',
              700: '#233352',
            }
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #060911;
      color: #f1f5f9;
      font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
    }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0c1220; }
    ::-webkit-scrollbar-thumb { background: #233352; border-radius: 9999px; }
    ::-webkit-scrollbar-thumb:hover { background: #33476d; }
    
    .glass-card {
      background: rgba(12, 18, 32, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(35, 51, 82, 0.7);
    }
    .badge-glow {
      box-shadow: 0 0 15px rgba(16, 185, 129, 0.25);
    }
    #qrcode-canvas img {
      margin: 0 auto;
      border-radius: 12px;
      padding: 10px;
      background: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
  </style>
</head>
<body class="min-h-screen antialiased flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">

  <!-- ========================================== -->
  <!-- 1. LOGIN SCREEN OVERLAY (Security Gate)   -->
  <!-- ========================================== -->
  <div id="auth-overlay" class="fixed inset-0 z-50 bg-dark-950 flex items-center justify-center p-4">
    <div class="glass-card max-w-md w-full rounded-3xl p-8 border border-dark-700 shadow-2xl space-y-6 text-center">
      
      <!-- Icon & Branding -->
      <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] mx-auto shadow-xl shadow-emerald-500/20">
        <div class="w-full h-full bg-dark-950 rounded-[15px] flex items-center justify-center">
          <i data-lucide="shield-lock" class="w-8 h-8 text-emerald-400"></i>
        </div>
      </div>

      <div class="space-y-1">
        <h2 class="text-xl font-bold text-white tracking-tight">WappAutomata Security Gate</h2>
        <p class="text-xs text-slate-400">Enter your dashboard authorization password to access live WhatsApp communications.</p>
      </div>

      <form onsubmit="handleLoginSubmit(event)" class="space-y-4 text-left">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1.5">Access Password</label>
          <div class="relative">
            <i data-lucide="key-round" class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input 
              type="password" 
              id="auth-password" 
              placeholder="Enter dashboard password..." 
              required
              class="w-full bg-dark-900 border border-dark-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        <p id="auth-error-msg" class="text-xs text-rose-400 font-medium hidden text-center"></p>

        <button type="submit" id="btn-login" class="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2">
          <span>Unlock Dashboard</span>
          <i data-lucide="arrow-right" class="w-4 h-4"></i>
        </button>
      </form>

      <p class="text-[11px] text-slate-500">End-to-End Encrypted Gateway • DigitalOcean Droplet</p>
    </div>
  </div>

  <!-- ========================================== -->
  <!-- 2. MAIN APPLICATION (Post-Authentication) -->
  <!-- ========================================== -->
  <div id="main-app" class="flex-1 flex flex-col hidden">

    <!-- Top Navigation Header -->
    <header class="sticky top-0 z-40 border-b border-dark-700/80 bg-dark-950/80 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16 gap-3">
          
          <!-- Logo & Brand -->
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/20 shrink-0">
              <div class="w-full h-full bg-dark-950 rounded-[11px] flex items-center justify-center">
                <i data-lucide="radio" class="w-5 h-5 text-emerald-400"></i>
              </div>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-base tracking-tight text-white">WappAutomata</span>
                <span id="role-pill" class="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Client Mode</span>
              </div>
              <p class="text-xs text-slate-400 hidden sm:block">WhatsApp Live Communications & Gateway</p>
            </div>
          </div>

          <!-- Mode Switcher Pill (Client Inbox <-> Developer Studio) -->
          <div class="flex items-center p-1 rounded-xl bg-dark-900 border border-dark-700 text-xs">
            <button onclick="setUiMode('client')" id="btn-mode-client" class="px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
              <span>Client Inbox</span>
            </button>
            <button onclick="setUiMode('dev')" id="btn-mode-dev" class="px-3 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5">
              <i data-lucide="code-2" class="w-3.5 h-3.5"></i>
              <span>Developer Studio</span>
            </button>
          </div>

          <!-- Top Right Controls -->
          <div class="flex items-center gap-2">
            <!-- WhatsApp Device Manager Trigger Pill -->
            <button onclick="openDeviceModal()" id="btn-device-status" class="px-3 py-1.5 rounded-xl bg-dark-900 hover:bg-dark-800 border border-dark-700 hover:border-emerald-500/40 text-xs flex items-center gap-2 transition-all">
              <span id="nav-device-dot" class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span id="nav-device-phone" class="text-slate-200 font-medium font-mono text-[11px] truncate max-w-[130px]">+880...</span>
              <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
            </button>

            <!-- Sound Alert Toggle -->
            <button id="btn-sound" onclick="toggleSound()" class="p-2 rounded-xl bg-dark-900 hover:bg-dark-800 border border-dark-700 text-slate-300 hover:text-white transition-all text-xs" title="Toggle audio chime on message">
              <i id="icon-sound" data-lucide="volume-2" class="w-4 h-4 text-emerald-400"></i>
            </button>

            <!-- Logout Button -->
            <button onclick="handleLogout()" class="p-2 rounded-xl bg-dark-900 hover:bg-rose-900/30 border border-dark-700 hover:border-rose-700/50 text-slate-400 hover:text-rose-300 transition-all text-xs" title="Lock & Log Out">
              <i data-lucide="log-out" class="w-4 h-4"></i>
            </button>
          </div>

        </div>
      </div>
    </header>

    <!-- Main Dynamic Content Workspace -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

      <!-- ============================================== -->
      <!-- VIEW 1: CLIENT INBOX (Clean & Non-Technical)  -->
      <!-- ============================================== -->
      <div id="view-client" class="space-y-6">

        <!-- WhatsApp Device Status Banner -->
        <div class="glass-card rounded-2xl p-5 border border-dark-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <i data-lucide="smartphone" class="w-6 h-6"></i>
            </div>
            <div class="space-y-0.5">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connected WhatsApp Phone</span>
                <span id="client-banner-status" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Active</span>
              </div>
              <h3 id="client-banner-phone" class="text-lg font-bold text-white font-mono">+880 1516-539430</h3>
              <p id="client-banner-name" class="text-xs text-slate-400">Account: Smart Tutors</p>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button onclick="openDeviceModal()" class="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-200 border border-dark-600 text-xs font-medium flex items-center gap-2 transition-all">
              <i data-lucide="qr-code" class="w-4 h-4 text-emerald-400"></i>
              <span>Switch / Re-link Account</span>
            </button>
          </div>
        </div>

        <!-- Client Search & Chat Filter Bar -->
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-dark-700/80 pb-3">
          <div class="relative flex-1 max-w-md">
            <i data-lucide="search" class="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              type="text" 
              id="client-search-input" 
              placeholder="Search by sender, phone number, group, or message..."
              oninput="renderClientFeed()"
              class="w-full bg-dark-900 border border-dark-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div class="flex items-center gap-2">
            <select id="client-filter-type" onchange="renderClientFeed()" class="bg-dark-900 border border-dark-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500">
              <option value="all">All Conversations</option>
              <option value="group">👥 Groups Only</option>
              <option value="direct">👤 Direct Messages</option>
            </select>
          </div>
        </div>

        <!-- Client Message List -->
        <div id="client-messages-container" class="space-y-3">
          <!-- Dynamically populated clean cards -->
        </div>

      </div>

      <!-- ============================================== -->
      <!-- VIEW 2: DEVELOPER STUDIO (Full Technical View) -->
      <!-- ============================================== -->
      <div id="view-dev" class="hidden space-y-6">

        <!-- KPI Metric Ribbon -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Messages Ingested</p>
              <h3 id="stat-total" class="text-2xl font-bold tracking-tight text-white font-mono">0</h3>
              <p class="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <i data-lucide="arrow-up-right" class="w-3 h-3"></i> Durable SQLite Queue
              </p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <i data-lucide="inbox" class="w-6 h-6"></i>
            </div>
          </div>

          <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">HMAC SHA-256</p>
              <h3 id="stat-hmac-rate" class="text-2xl font-bold tracking-tight text-emerald-400 font-mono">100%</h3>
              <p class="text-[11px] text-slate-400 flex items-center gap-1">
                <i data-lucide="shield-check" class="w-3 h-3 text-emerald-400"></i> Zero Forged Packets
              </p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <i data-lucide="lock" class="w-6 h-6"></i>
            </div>
          </div>

          <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Channels</p>
              <h3 id="stat-channels" class="text-2xl font-bold tracking-tight text-white font-mono">0</h3>
              <p class="text-[11px] text-slate-400 flex items-center gap-1">
                <i data-lucide="users" class="w-3 h-3 text-sky-400"></i> Detected Groups & Contacts
              </p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <i data-lucide="message-square" class="w-6 h-6"></i>
            </div>
          </div>

          <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
            <div class="space-y-1">
              <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Transit Latency</p>
              <h3 id="stat-latency" class="text-2xl font-bold tracking-tight text-white font-mono">~18 ms</h3>
              <p class="text-[11px] text-slate-400 flex items-center gap-1">
                <i data-lucide="zap" class="w-3 h-3 text-amber-400"></i> Sub-Second Ingestion
              </p>
            </div>
            <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <i data-lucide="gauge" class="w-6 h-6"></i>
            </div>
          </div>
        </div>

        <!-- Dev View Action Bar -->
        <div class="flex items-center justify-between border-b border-dark-700/80 pb-3">
          <div class="flex items-center gap-2">
            <button onclick="switchDevSubTab('feed')" id="dev-tab-feed" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <i data-lucide="binary" class="w-3.5 h-3.5"></i> Raw Payloads
            </button>
            <button onclick="switchDevSubTab('audit')" id="dev-tab-audit" class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-dark-800 transition-all flex items-center gap-1.5">
              <i data-lucide="shield-check" class="w-3.5 h-3.5"></i> HMAC Audit Trail
            </button>
            <button onclick="switchDevSubTab('docs')" id="dev-tab-docs" class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-dark-800 transition-all flex items-center gap-1.5">
              <i data-lucide="code-2" class="w-3.5 h-3.5"></i> Client SDKs
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="openSimulateModal()" class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all text-xs font-medium flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
              <span>Simulate Webhook</span>
            </button>
            <button onclick="exportMessagesJson()" class="p-2 rounded-lg bg-dark-900 border border-dark-700 text-slate-400 hover:text-white text-xs" title="Export JSON">
              <i data-lucide="download" class="w-4 h-4"></i>
            </button>
            <button onclick="clearMessagesFeed()" class="p-2 rounded-lg bg-dark-900 border border-dark-700 hover:border-rose-700/50 text-slate-400 hover:text-rose-300 text-xs" title="Clear Feed">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>

        <!-- Dev Sub-Tab 1: Raw Feed -->
        <div id="dev-content-feed" class="space-y-3">
          <div id="dev-messages-container" class="space-y-3"></div>
        </div>

        <!-- Dev Sub-Tab 2: Audit Table -->
        <div id="dev-content-audit" class="hidden glass-card rounded-2xl p-5 border border-dark-700 overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-dark-700 text-slate-400 uppercase text-[10px]">
                <th class="py-2.5 px-3">Delivery ID</th>
                <th class="py-2.5 px-3">Event</th>
                <th class="py-2.5 px-3">HMAC Digest</th>
                <th class="py-2.5 px-3">Attempt</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="audit-table-body" class="divide-y divide-dark-800 text-slate-300"></tbody>
          </table>
        </div>

        <!-- Dev Sub-Tab 3: Client SDKs -->
        <div id="dev-content-docs" class="hidden space-y-4">
          <div class="glass-card rounded-2xl p-6 border border-dark-700 space-y-4">
            <h4 class="text-sm font-semibold text-white">Client Webhook Verification</h4>
            <p class="text-xs text-slate-400">Copy this code into your client application (Next.js / Node / Python) to verify HMAC-SHA256 signatures.</p>
            <pre class="bg-dark-950 p-4 rounded-xl text-xs font-mono text-emerald-300 overflow-x-auto"><code>const crypto = require('crypto');
function verifyWebhook(body, sig, secret) {
  const hash = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hash));
}</code></pre>
          </div>
        </div>

      </div>

    </main>

  </div>

  <!-- ============================================== -->
  <!-- 3. IN-BROWSER WHATSAPP DEVICE MANAGER MODAL   -->
  <!-- ============================================== -->
  <div id="device-modal" class="fixed inset-0 z-50 overflow-hidden hidden" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onclick="closeDeviceModal()"></div>
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <div class="glass-card max-w-md w-full rounded-3xl p-6 sm:p-8 border border-dark-700 shadow-2xl space-y-5 text-center relative">
        
        <button onclick="closeDeviceModal()" class="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>

        <!-- Connected State Visual -->
        <div id="device-modal-connected" class="space-y-4">
          <div class="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
            <i data-lucide="check-circle-2" class="w-8 h-8"></i>
          </div>
          <div class="space-y-1">
            <h3 class="text-lg font-bold text-white">WhatsApp Account Active</h3>
            <p class="text-xs text-slate-400">This phone is connected 24/7 to the collector daemon.</p>
          </div>

          <div class="bg-dark-950 rounded-2xl p-4 border border-dark-800 text-left space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Linked Phone:</span>
              <span id="modal-connected-phone" class="text-white font-mono font-semibold">+880 1516-539430</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Account Name:</span>
              <span id="modal-connected-name" class="text-slate-200 font-medium">Smart Tutors</span>
            </div>
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-400">Connection Mode:</span>
              <span class="text-emerald-400 font-medium">Multi-Device Companion</span>
            </div>
          </div>

          <div class="pt-2">
            <button onclick="triggerSessionReset()" id="btn-reset-session" class="w-full py-2.5 rounded-xl bg-dark-800 hover:bg-rose-900/30 text-rose-300 border border-dark-700 hover:border-rose-500/40 text-xs font-semibold transition-all flex items-center justify-center gap-2">
              <i data-lucide="log-out" class="w-4 h-4"></i>
              <span>Switch / Log Out WhatsApp Account</span>
            </button>
          </div>
        </div>

        <!-- QR Scan Required State Visual -->
        <div id="device-modal-scan" class="space-y-4 hidden">
          <div class="space-y-1">
            <h3 class="text-lg font-bold text-white">Pair New WhatsApp Phone</h3>
            <p class="text-xs text-slate-400">Scan this code to link your WhatsApp account.</p>
          </div>

          <!-- Canvas QR code rendered dynamically -->
          <div class="p-3 bg-white/5 rounded-2xl border border-dark-700 flex items-center justify-center min-h-[220px]">
            <div id="qrcode-canvas"></div>
            <div id="qr-loading-spinner" class="text-xs text-slate-400 flex flex-col items-center gap-2">
              <i data-lucide="loader-2" class="w-6 h-6 animate-spin text-emerald-400"></i>
              <span>Generating fresh pairing QR code...</span>
            </div>
          </div>

          <!-- 3 Step Instructions -->
          <div class="text-left text-xs space-y-1.5 bg-dark-950 p-3.5 rounded-xl border border-dark-800 text-slate-300">
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">1</span>
              <span>Open <strong>WhatsApp</strong> on your phone</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">2</span>
              <span>Tap <strong>Settings</strong> or <strong>⋮</strong> → <strong>Linked Devices</strong></span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">3</span>
              <span>Tap <strong>Link a Device</strong> and scan this screen</span>
            </div>
          </div>

          <p class="text-[11px] text-slate-500">QR code refreshes automatically every ~20 seconds.</p>
        </div>

      </div>
    </div>
  </div>

  <!-- ============================================== -->
  <!-- 4. SLIDE-OVER DRAWER (Payload Inspector)       -->
  <!-- ============================================== -->
  <div id="inspector-drawer" class="fixed inset-0 z-50 overflow-hidden hidden" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onclick="closeInspector()"></div>
    <div class="fixed inset-y-0 right-0 pl-10 max-w-full flex">
      <div class="w-screen max-w-2xl bg-dark-900 border-l border-dark-700 shadow-2xl flex flex-col">
        <div class="p-6 border-b border-dark-700 flex items-center justify-between bg-dark-950/60">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <i data-lucide="binary" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white" id="drawer-title">Webhook Payload Inspector</h3>
              <p class="text-xs text-slate-400 font-mono" id="drawer-subtitle">del_01...</p>
            </div>
          </div>
          <button onclick="closeInspector()" class="text-slate-400 hover:text-white">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-6 space-y-4">
          <pre class="bg-dark-950 text-slate-200 p-4 rounded-xl border border-dark-800 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed"><code id="drawer-json-content"></code></pre>
        </div>
        <div class="p-4 border-t border-dark-700 bg-dark-950/60 flex items-center justify-between">
          <button onclick="copyDrawerJson()" class="px-3.5 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-600 text-xs font-medium text-slate-200 flex items-center gap-1.5">
            <i data-lucide="copy" class="w-3.5 h-3.5 text-emerald-400"></i> Copy JSON
          </button>
          <button onclick="closeInspector()" class="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium">Done</button>
        </div>
      </div>
    </div>
  </div>

  <!-- ============================================== -->
  <!-- 5. SIMULATE WEBHOOK MODAL (Developer Studio)   -->
  <!-- ============================================== -->
  <div id="simulate-modal" class="fixed inset-0 z-50 overflow-hidden hidden" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onclick="closeSimulateModal()"></div>
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <div class="glass-card max-w-lg w-full rounded-3xl p-6 sm:p-8 border border-dark-700 shadow-2xl space-y-5 text-left relative">
        <button onclick="closeSimulateModal()" class="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>

        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <i data-lucide="sparkles" class="w-5 h-5"></i>
          </div>
          <div>
            <h3 class="text-base font-bold text-white">Simulate Webhook Ingestion</h3>
            <p class="text-xs text-slate-400">Dispatch an authentic HMAC-signed WhatsApp payload to the receiver.</p>
          </div>
        </div>

        <form onsubmit="handleSimulateSubmit(event)" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Sender Name</label>
              <input type="text" id="sim-sender-name" value="Dr. Tariqul Islam" required
                class="w-full bg-dark-950 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Sender Phone</label>
              <input type="text" id="sim-sender-phone" value="+880 1711-223344" required
                class="w-full bg-dark-950 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono" />
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Chat Type</label>
              <select id="sim-chat-type" class="w-full bg-dark-950 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500">
                <option value="direct">Direct Message (1:1)</option>
                <option value="group" selected>Group Chat</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Chat / Group Name</label>
              <input type="text" id="sim-chat-name" value="Executive Parents Community"
                class="w-full bg-dark-950 border border-dark-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Message Text</label>
            <textarea id="sim-text" rows="3" required
              class="w-full bg-dark-950 border border-dark-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 leading-relaxed">Hello, please provide an update on today's session schedule.</textarea>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2">
            <button type="button" onclick="closeSimulateModal()" class="px-4 py-2 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-300 text-xs font-medium">Cancel</button>
            <button type="submit" id="btn-submit-sim" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/25 flex items-center gap-1.5 transition-all">
              <i data-lucide="send" class="w-3.5 h-3.5"></i>
              <span>Dispatch Payload</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div id="toast-container" class="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none"></div>

  <!-- Application Logic -->
  <script>
    let messagesCache = [];
    let currentUiMode = localStorage.getItem('wapp_ui_mode') || 'client';
    let soundEnabled = true;
    let selectedMessage = null;
    let qrInstance = null;
    let lastRenderedQR = null;

    // Check Auth State on Startup
    async function checkAuth() {
      try {
        const res = await fetch('/api/session/status');
        if (res.status === 401) {
          document.getElementById('auth-overlay').classList.remove('hidden');
          document.getElementById('main-app').classList.add('hidden');
        } else {
          document.getElementById('auth-overlay').classList.add('hidden');
          document.getElementById('main-app').classList.remove('hidden');
          setUiMode(currentUiMode);
          fetchMessages();
          pollSessionStatus();
        }
      } catch (e) {
        document.getElementById('auth-overlay').classList.remove('hidden');
      }
      lucide.createIcons();
    }

    async function handleLoginSubmit(e) {
      e.preventDefault();
      const password = document.getElementById('auth-password').value;
      const btn = document.getElementById('btn-login');
      const err = document.getElementById('auth-error-msg');

      btn.disabled = true;
      btn.innerText = 'Verifying...';
      err.classList.add('hidden');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          document.getElementById('auth-overlay').classList.add('hidden');
          document.getElementById('main-app').classList.remove('hidden');
          setUiMode(currentUiMode);
          fetchMessages();
          pollSessionStatus();
          showToast('Dashboard unlocked successfully', 'success');
        } else {
          err.innerText = data.error || 'Incorrect authorization password';
          err.classList.remove('hidden');
        }
      } catch (err) {
        err.innerText = 'Network connection error';
        err.classList.remove('hidden');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Unlock Dashboard</span><i data-lucide="arrow-right" class="w-4 h-4"></i>';
        lucide.createIcons();
      }
    }

    async function handleLogout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      location.reload();
    }

    // Switch between Client Mode and Developer Mode
    function setUiMode(mode) {
      currentUiMode = mode;
      localStorage.setItem('wapp_ui_mode', mode);

      const isClient = mode === 'client';
      document.getElementById('view-client').classList.toggle('hidden', !isClient);
      document.getElementById('view-dev').classList.toggle('hidden', isClient);

      const btnClient = document.getElementById('btn-mode-client');
      const btnDev = document.getElementById('btn-mode-dev');
      const rolePill = document.getElementById('role-pill');

      if (isClient) {
        btnClient.className = 'px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
        btnDev.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5';
        rolePill.innerText = 'Client Mode';
        rolePill.className = 'text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
        renderClientFeed();
      } else {
        btnDev.className = 'px-3 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
        btnClient.className = 'px-3 py-1 rounded-lg text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5';
        rolePill.innerText = 'Developer Studio';
        rolePill.className = 'text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20';
        renderDevFeed();
        renderAuditTable();
      }
      lucide.createIcons();
    }

    function switchDevSubTab(tab) {
      document.getElementById('dev-content-feed').classList.toggle('hidden', tab !== 'feed');
      document.getElementById('dev-content-audit').classList.toggle('hidden', tab !== 'audit');
      document.getElementById('dev-content-docs').classList.toggle('hidden', tab !== 'docs');

      ['feed', 'audit', 'docs'].forEach(t => {
        const btn = document.getElementById(\`dev-tab-\${t}\`);
        if (t === tab) {
          btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5';
        } else {
          btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-dark-800 transition-all flex items-center gap-1.5';
        }
      });
      lucide.createIcons();
    }

    // Polling WhatsApp Session Status & Live QR
    async function pollSessionStatus() {
      try {
        const res = await fetch('/api/session/status');
        if (!res.ok) return;
        const session = await res.json();

        const isAuth = session.status === 'authenticated';
        const phone = session.phone || 'No Account Linked';
        const name = session.name || 'WhatsApp Account';

        // Update Nav Pill
        document.getElementById('nav-device-phone').innerText = phone;
        document.getElementById('nav-device-dot').className = isAuth ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-rose-400';

        // Update Client Banner
        document.getElementById('client-banner-phone').innerText = phone;
        document.getElementById('client-banner-name').innerText = isAuth ? \`Account: \${name}\` : 'Scan QR code to connect';
        document.getElementById('client-banner-status').innerText = isAuth ? 'Active' : 'Disconnected';
        document.getElementById('client-banner-status').className = isAuth 
          ? 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          : 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30';

        // Update Modal
        document.getElementById('modal-connected-phone').innerText = phone;
        document.getElementById('modal-connected-name').innerText = name;

        if (isAuth) {
          document.getElementById('device-modal-connected').classList.remove('hidden');
          document.getElementById('device-modal-scan').classList.add('hidden');
        } else {
          document.getElementById('device-modal-connected').classList.add('hidden');
          document.getElementById('device-modal-scan').classList.remove('hidden');

          if (session.qr && session.qr !== lastRenderedQR) {
            renderQrCode(session.qr);
            lastRenderedQR = session.qr;
          }
        }
      } catch (e) {}
    }

    function renderQrCode(qrString) {
      const container = document.getElementById('qrcode-canvas');
      const spinner = document.getElementById('qr-loading-spinner');
      if (spinner) spinner.classList.add('hidden');
      if (!container) return;
      container.innerHTML = '';

      if (window.QRCode) {
        try {
          new QRCode(container, {
            text: qrString,
            width: 220,
            height: 220,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
          });
          return;
        } catch (e) {
          console.warn('QRCode library error, using fallback img', e);
        }
      }

      const img = document.createElement('img');
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(qrString);
      img.className = 'rounded-xl shadow mx-auto';
      img.alt = 'WhatsApp QR Code';
      container.appendChild(img);
    }

    function openDeviceModal() {
      document.getElementById('device-modal').classList.remove('hidden');
      pollSessionStatus();
      lucide.createIcons();
    }

    function closeDeviceModal() {
      document.getElementById('device-modal').classList.add('hidden');
    }

    async function triggerSessionReset() {
      if (!confirm('Are you sure you want to disconnect this WhatsApp account and scan a new one?')) return;
      const btn = document.getElementById('btn-reset-session');
      btn.disabled = true;
      btn.innerText = 'Resetting session...';

      try {
        await fetch('/api/session/reset', { method: 'POST' });
        showToast('Session reset. Preparing QR code...', 'info');
        document.getElementById('device-modal-connected').classList.add('hidden');
        document.getElementById('device-modal-scan').classList.remove('hidden');
        document.getElementById('qr-loading-spinner').classList.remove('hidden');
        document.getElementById('qrcode-canvas').innerHTML = '';
        lastRenderedQR = null;
      } catch (e) {
        showToast('Error resetting session', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="log-out" class="w-4 h-4"></i><span>Switch / Log Out WhatsApp Account</span>';
        lucide.createIcons();
      }
    }

    // Data Polling
    async function fetchMessages() {
      try {
        const res = await fetch('/api/messages');
        if (!res.ok) return;
        const data = await res.json();
        
        const previousLength = messagesCache.length;
        messagesCache = data;

        if (previousLength > 0 && data.length > previousLength) {
          playChime();
          showToast(\`\${data.length - previousLength} new message received\`, 'success');
        }

        updateStats(data);
        if (currentUiMode === 'client') {
          renderClientFeed();
        } else {
          renderDevFeed();
          renderAuditTable();
        }
      } catch (err) {}
    }

    function updateStats(data) {
      document.getElementById('stat-total').innerText = data.length;
      const validCount = data.filter(m => m.isValid).length;
      document.getElementById('stat-hmac-rate').innerText = data.length > 0 ? \`\${Math.round((validCount / data.length) * 100)}%\` : '100%';

      const channels = new Set();
      data.forEach(m => {
        if (m.chat_name) channels.add(m.chat_name);
        else if (m.chat_id) channels.add(m.chat_id);
      });
      document.getElementById('stat-channels').innerText = channels.size;
      if (data.length > 0 && data[0].latency_ms) {
        document.getElementById('stat-latency').innerText = \`~\${data[0].latency_ms} ms\`;
      }
    }

    // RENDER: Client Clean View
    function renderClientFeed() {
      const container = document.getElementById('client-messages-container');
      const searchQuery = (document.getElementById('client-search-input').value || '').toLowerCase();
      const filterType = document.getElementById('client-filter-type').value;

      const filtered = messagesCache.filter(m => {
        if (filterType === 'group' && m.chat_type !== 'group') return false;
        if (filterType === 'direct' && m.chat_type !== 'direct') return false;

        if (!searchQuery) return true;
        const haystack = [m.text, m.sender_name, m.sender_phone, m.chat_name].join(' ').toLowerCase();
        return haystack.includes(searchQuery);
      });

      if (filtered.length === 0) {
        container.innerHTML = \`
          <div class="glass-card rounded-2xl p-12 text-center border border-dashed border-dark-700">
            <div class="w-12 h-12 mx-auto rounded-2xl bg-dark-900 border border-dark-700 flex items-center justify-center text-slate-500 mb-3">
              <i data-lucide="message-square" class="w-6 h-6 text-emerald-400"></i>
            </div>
            <h4 class="text-sm font-semibold text-white">No WhatsApp messages yet</h4>
            <p class="text-xs text-slate-400 mt-1">Incoming chats from your linked WhatsApp will appear here in real-time.</p>
          </div>
        \`;
        lucide.createIcons();
        return;
      }

      container.innerHTML = filtered.map(m => {
        const initials = getInitials(m.sender_name || m.sender_phone);
        const avatarGradient = getAvatarColor(m.sender_phone || m.sender_name);
        const isGroup = m.chat_type === 'group';

        return \`
          <div class="glass-card rounded-2xl p-4 sm:p-5 border border-dark-700/70 hover:border-dark-600 transition-all">
            <div class="flex items-start gap-3.5">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr \${avatarGradient} flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0">
                \${escapeHtml(initials)}
              </div>

              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-bold text-white">\${escapeHtml(m.sender_name || 'Contact')}</span>
                    \${m.sender_phone ? \`
                      <span class="px-2 py-0.5 rounded-full bg-dark-950 border border-dark-700 text-slate-300 font-mono text-[11px]">
                        \${escapeHtml(m.sender_phone)}
                      </span>
                    \` : ''}
                    \${isGroup ? \`
                      <span class="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-medium flex items-center gap-1">
                        <i data-lucide="users" class="w-3 h-3"></i>
                        <span>\${escapeHtml(m.chat_name || 'Group')}</span>
                      </span>
                    \` : ''}
                  </div>
                  <span class="text-[11px] text-slate-400 font-mono">\${m.timestamp}</span>
                </div>

                <div class="text-xs text-slate-200 bg-dark-950/80 p-3 rounded-xl border border-dark-800/80 leading-relaxed font-sans">
                  \${escapeHtml(m.text || '(media/image attachment)')}
                </div>
              </div>
            </div>
          </div>
        \`;
      }).join('');
      lucide.createIcons();
    }

    // RENDER: Developer Studio
    function renderDevFeed() {
      const container = document.getElementById('dev-messages-container');
      if (messagesCache.length === 0) {
        container.innerHTML = '<div class="glass-card rounded-2xl p-8 text-center text-xs text-slate-500">No events logged</div>';
        return;
      }
      container.innerHTML = messagesCache.map(m => \`
        <div class="glass-card rounded-2xl p-4 border border-dark-700 font-mono text-xs space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-emerald-400 font-bold">\${escapeHtml(m.event || 'whatsapp.message.received')}</span>
            <span class="text-slate-400">\${m.timestamp}</span>
          </div>
          <div class="flex items-center justify-between text-slate-400 text-[11px]">
            <span>Delivery: <code class="text-slate-200">\${m.delivery_id || m.id}</code></span>
            <span>Latency: <code class="text-emerald-400">\${m.latency_ms || 15}ms</code></span>
          </div>
          <div class="bg-dark-950 p-2.5 rounded-lg text-slate-300 truncate">
            \${escapeHtml(m.text || '')}
          </div>
          <div class="flex justify-end pt-1">
            <button onclick="inspectMessage('\${m.id}')" class="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1">
              <i data-lucide="eye" class="w-3 h-3"></i> Inspect Payload
            </button>
          </div>
        </div>
      \`).join('');
      lucide.createIcons();
    }

    function renderAuditTable() {
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;
      tbody.innerHTML = messagesCache.map(m => \`
        <tr class="hover:bg-dark-850/60 transition-colors">
          <td class="py-2.5 px-3 text-slate-200">\${m.delivery_id || m.id}</td>
          <td class="py-2.5 px-3 text-emerald-400">\${m.event || 'whatsapp.message.received'}</td>
          <td class="py-2.5 px-3 text-slate-400 truncate max-w-[120px]">\${(m.headers && m.headers['x-collector-signature']) ? m.headers['x-collector-signature'].slice(0, 16) + '...' : 'sha256=...'}</td>
          <td class="py-2.5 px-3 text-slate-300">\${m.attempt || 1}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold \${m.isValid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">
              \${m.isValid ? 'PASS' : 'TAMPERED'}
            </span>
          </td>
          <td class="py-2.5 px-3 text-right">
            <button onclick="inspectMessage('\${m.id}')" class="text-emerald-400 hover:text-emerald-300">View</button>
          </td>
        </tr>
      \`).join('');
    }

    function inspectMessage(id) {
      const msg = messagesCache.find(m => m.id === id);
      if (!msg) return;
      selectedMessage = msg;
      document.getElementById('drawer-subtitle').innerText = msg.delivery_id || msg.id;
      document.getElementById('drawer-json-content').innerText = JSON.stringify(msg.raw_envelope || msg, null, 2);
      document.getElementById('inspector-drawer').classList.remove('hidden');
      lucide.createIcons();
    }

    function closeInspector() {
      document.getElementById('inspector-drawer').classList.add('hidden');
    }

    function copyDrawerJson() {
      if (!selectedMessage) return;
      navigator.clipboard.writeText(JSON.stringify(selectedMessage.raw_envelope || selectedMessage, null, 2));
      showToast('Payload JSON copied', 'success');
    }

    // Audio & Utilities
    function playChime() {
      if (!soundEnabled) return;
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880.0, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.36);
      } catch (e) {}
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      const icon = document.getElementById('icon-sound');
      if (soundEnabled) {
        icon.classList.add('text-emerald-400');
        icon.classList.remove('text-slate-500');
        showToast('Audio chime enabled', 'success');
      } else {
        icon.classList.remove('text-emerald-400');
        icon.classList.add('text-slate-500');
        showToast('Audio chime muted', 'info');
      }
    }

    function getAvatarColor(str) {
      const colors = ['from-emerald-500 to-teal-700', 'from-sky-500 to-blue-700', 'from-indigo-500 to-purple-700', 'from-amber-500 to-orange-700', 'from-rose-500 to-pink-700'];
      let hash = 0;
      for (let i = 0; i < (str || '').length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      return colors[Math.abs(hash) % colors.length];
    }

    function getInitials(name) {
      if (!name) return 'WA';
      const parts = name.trim().split(/\\s+/);
      return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
    }

    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      const colors = {
        success: 'bg-emerald-600/90 text-white border-emerald-500/40',
        error: 'bg-rose-600/90 text-white border-rose-500/40',
        info: 'bg-dark-900/90 text-slate-200 border-dark-700'
      };
      toast.className = \`px-4 py-2.5 rounded-xl border shadow-xl text-xs font-medium flex items-center gap-2 backdrop-blur-md transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0 \${colors[type] || colors.info}\`;
      toast.innerHTML = \`<span>\${escapeHtml(message)}</span>\`;
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.remove('translate-y-2', 'opacity-0'));
      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    function openSimulateModal() {
      document.getElementById('simulate-modal').classList.remove('hidden');
      lucide.createIcons();
    }

    function closeSimulateModal() {
      document.getElementById('simulate-modal').classList.add('hidden');
    }

    async function handleSimulateSubmit(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-submit-sim');
      btn.disabled = true;
      btn.innerHTML = '<span>Dispatching...</span>';

      const payload = {
        sender_name: document.getElementById('sim-sender-name').value,
        sender_phone: document.getElementById('sim-sender-phone').value,
        chat_type: document.getElementById('sim-chat-type').value,
        chat_name: document.getElementById('sim-chat-name').value,
        text: document.getElementById('sim-text').value
      };

      try {
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.status === 'ok') {
          showToast('Simulated WhatsApp webhook dispatched!', 'success');
          closeSimulateModal();
          fetchMessages();
        } else {
          showToast(data.error || 'Failed to dispatch simulation', 'error');
        }
      } catch (err) {
        showToast('Network error dispatching simulation', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="send" class="w-3.5 h-3.5"></i><span>Dispatch Payload</span>';
        lucide.createIcons();
      }
    }

    function exportMessagesJson() {
      const blob = new Blob([JSON.stringify(messagesCache, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = 'wapp-messages-' + Date.now() + '.json';
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported messages JSON', 'success');
    }

    async function clearMessagesFeed() {
      if (!confirm('Clear all displayed messages from this session feed?')) return;
      try {
        await fetch('/api/clear', { method: 'POST' });
        messagesCache = [];
        renderDevFeed();
        renderClientFeed();
        renderAuditTable();
        updateStats([]);
        showToast('Feed cleared', 'info');
      } catch (err) {
        showToast('Error clearing feed', 'error');
      }
    }

    // Startup Pollers
    checkAuth();
    setInterval(fetchMessages, 1500);
    setInterval(pollSessionStatus, 2000);
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const server = http.createServer((req, res) => {
  // 1. PUBLIC WEBHOOK INGESTION (Signed with HMAC SHA-256)
  if (req.method === 'POST' && (req.url === '/webhook' || req.url === '/')) {
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
  if (req.method === 'POST' && req.url === '/api/auth/login') {
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

  if (req.method === 'POST' && req.url === '/api/auth/logout') {
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
  if (req.url.startsWith('/api/')) {
    if (!isAuthenticated(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Unauthorized: Dashboard login required' }));
    }

    if (req.method === 'GET' && req.url === '/api/session/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(getSessionState()));
    }

    if (req.method === 'POST' && req.url === '/api/session/reset') {
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

    if (req.method === 'POST' && req.url === '/api/simulate') {
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

    if (req.method === 'GET' && req.url === '/api/messages') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(recentMessages));
    }

    if (req.method === 'GET' && req.url === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
        totalReceived: stats.totalReceived,
        validSignatures: stats.validSignatures,
        uniqueGroups: stats.groupsCount.size,
        uniqueSenders: stats.sendersCount.size
      }));
    }

    if (req.method === 'POST' && req.url === '/api/clear') {
      recentMessages.length = 0;
      saveMessagesToDisk(recentMessages);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', cleared: true }));
    }
  }

  // 4. BROWSER HTML ROOT (Serves page; client-side JS gates view)
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderHtmlPage());
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
});

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

  return { isValid: isValidSig };
}

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Dual-Mode SaaS Dashboard running at: http://${HOST}:${PORT}/`);
  console.log(`🔑 Password Gate:                          "${DASHBOARD_PASSWORD}"`);
  console.log(`📡 Ingestion Endpoint:                      http://${HOST}:${PORT}/webhook\n`);
});
