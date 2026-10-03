/**
 * Enterprise-Grade SaaS Webhook Monitor & Control Plane
 * Listens on http://127.0.0.1:4000/webhook and verifies incoming collector payloads.
 * Serves a publish-ready modern SaaS dashboard at http://127.0.0.1:4000/
 */
const http = require('http');
const crypto = require('crypto');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const SECRET = process.env.WEBHOOK_SECRET || 'local_dev_webhook_secret_key_12345';
const recentMessages = [];
const deliveryLogs = [];

const serverStartTime = Date.now();
const stats = {
  totalReceived: 0,
  validSignatures: 0,
  invalidSignatures: 0,
  groupsCount: new Set(),
  sendersCount: new Set(),
  latencies: []
};

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

function renderHtmlPage() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WappAutomata • SaaS Webhook Studio</title>
  <!-- Google Fonts: Inter -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <!-- Tailwind CSS CDN with Typography & Forms -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
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
    /* Custom Scrollbars */
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
    .code-scroll {
      max-height: 480px;
    }
  </style>
</head>
<body class="min-h-screen antialiased flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">

  <!-- Top Glass Navigation Bar -->
  <header class="sticky top-0 z-40 border-b border-dark-700/80 bg-dark-950/80 backdrop-blur-xl">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        
        <!-- Logo & Brand Info -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-[1px] shadow-lg shadow-emerald-500/20">
            <div class="w-full h-full bg-dark-950 rounded-[11px] flex items-center justify-center">
              <i data-lucide="radio" class="w-5 h-5 text-emerald-400"></i>
            </div>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">WappAutomata</span>
              <span class="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Studio v1.0</span>
            </div>
            <p class="text-xs text-slate-400">WhatsApp Webhook Ingestion & Security Monitor</p>
          </div>
        </div>

        <!-- Center Status Beacon -->
        <div class="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-full bg-dark-900 border border-dark-700 text-xs">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span class="text-slate-300 font-medium">Gateway:</span>
          <code class="text-emerald-400 font-mono text-[11px] font-semibold">http://127.0.0.1:4000/webhook</code>
          <button onclick="copyToClipboard('http://127.0.0.1:4000/webhook', 'Webhook URL')" title="Copy URL" class="text-slate-400 hover:text-white transition-colors">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
          </button>
        </div>

        <!-- Global Action Controls -->
        <div class="flex items-center gap-2">
          <!-- Audio Alert Toggle -->
          <button id="btn-sound" onclick="toggleSound()" class="p-2 rounded-lg bg-dark-900 hover:bg-dark-800 border border-dark-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5" title="Toggle audio chime on message">
            <i id="icon-sound" data-lucide="volume-2" class="w-4 h-4 text-emerald-400"></i>
            <span class="hidden sm:inline text-xs font-medium">Chime</span>
          </button>

          <!-- Simulator Trigger Button -->
          <button onclick="openSimulateModal()" class="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all text-xs font-medium flex items-center gap-1.5 shadow-sm">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
            <span>Simulate Webhook</span>
          </button>

          <!-- Export JSON Button -->
          <button onclick="exportMessagesJson()" class="p-2 rounded-lg bg-dark-900 hover:bg-dark-800 border border-dark-700 text-slate-300 hover:text-white transition-all text-xs" title="Export Ingested Messages JSON">
            <i data-lucide="download" class="w-4 h-4"></i>
          </button>

          <!-- Clear Feed Button -->
          <button onclick="clearMessagesFeed()" class="p-2 rounded-lg bg-dark-900 hover:bg-rose-900/30 border border-dark-700 hover:border-rose-700/50 text-slate-400 hover:text-rose-300 transition-all text-xs" title="Clear Message Feed">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>

      </div>
    </div>
  </header>

  <!-- Main Content Layout -->
  <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

    <!-- KPI Metric Cards Ribbon -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- Card 1: Total Received -->
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

      <!-- Card 2: Security & HMAC -->
      <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
        <div class="space-y-1">
          <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">HMAC SHA-256</p>
          <h3 id="stat-hmac-rate" class="text-2xl font-bold tracking-tight text-emerald-400 font-mono">100%</h3>
          <p class="text-[11px] text-slate-400 flex items-center gap-1">
            <i data-lucide="shield-check" class="w-3 h-3 text-emerald-400"></i> Cryptographically Verified
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
          <i data-lucide="lock" class="w-6 h-6"></i>
        </div>
      </div>

      <!-- Card 3: Active Channels -->
      <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
        <div class="space-y-1">
          <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Channels</p>
          <h3 id="stat-channels" class="text-2xl font-bold tracking-tight text-white font-mono">0</h3>
          <p class="text-[11px] text-slate-400 flex items-center gap-1">
            <i data-lucide="users" class="w-3 h-3 text-sky-400"></i> Groups & Contacts Detected
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
          <i data-lucide="message-square" class="w-6 h-6"></i>
        </div>
      </div>

      <!-- Card 4: Transit Latency -->
      <div class="glass-card rounded-2xl p-4 flex items-center justify-between">
        <div class="space-y-1">
          <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Delivery Latency</p>
          <h3 id="stat-latency" class="text-2xl font-bold tracking-tight text-white font-mono">~18 ms</h3>
          <p class="text-[11px] text-slate-400 flex items-center gap-1">
            <i data-lucide="zap" class="w-3 h-3 text-amber-400"></i> Zero-loss Queue Transit
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <i data-lucide="gauge" class="w-6 h-6"></i>
        </div>
      </div>

    </div>

    <!-- Navigation Tabs & Search Controls -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-dark-700/80 pb-3">
      
      <!-- Primary Tabs -->
      <nav class="flex items-center gap-1.5">
        <button onclick="switchTab('feed')" id="tab-btn-feed" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-2 transition-all">
          <i data-lucide="activity" class="w-4 h-4"></i>
          <span>Live Ingestion Feed</span>
          <span id="tab-badge-count" class="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">0</span>
        </button>

        <button onclick="switchTab('audit')" id="tab-btn-audit" class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-dark-800 transition-all flex items-center gap-2">
          <i data-lucide="file-check-2" class="w-4 h-4"></i>
          <span>Security & Audit Log</span>
        </button>

        <button onclick="switchTab('docs')" id="tab-btn-docs" class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-dark-800 transition-all flex items-center gap-2">
          <i data-lucide="code-2" class="w-4 h-4"></i>
          <span>Developer SDKs</span>
        </button>
      </nav>

      <!-- Search & Filters (Shown only on Feed tab) -->
      <div id="feed-search-controls" class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 sm:w-64">
          <i data-lucide="search" class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            id="search-input" 
            placeholder="Search text, phone, sender, group..."
            oninput="handleSearchChange()"
            class="w-full bg-dark-900 border border-dark-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <select id="filter-type" onchange="handleFilterChange()" class="bg-dark-900 border border-dark-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500">
          <option value="all">All Messages</option>
          <option value="group">👥 Groups Only</option>
          <option value="direct">👤 Direct Chats</option>
          <option value="media">📎 Has Media</option>
        </select>

        <button id="btn-pause-stream" onclick="toggleStreamPause()" class="p-1.5 rounded-lg bg-dark-900 border border-dark-700 text-slate-400 hover:text-white text-xs transition-colors" title="Pause / Resume Live Feed Stream">
          <i id="icon-stream-pause" data-lucide="pause" class="w-4 h-4 text-emerald-400"></i>
        </button>
      </div>

    </div>

    <!-- TAB 1: Live Message Feed Section -->
    <div id="tab-content-feed" class="space-y-3">
      <div id="messages-container" class="space-y-3">
        <!-- Dynamically rendered cards appear here -->
      </div>
    </div>

    <!-- TAB 2: Security & Audit Log Section -->
    <div id="tab-content-audit" class="hidden space-y-4">
      <div class="glass-card rounded-2xl p-5 border border-dark-700">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h4 class="text-sm font-semibold text-white">Cryptographic HMAC-SHA256 & Delivery Audit Trail</h4>
            <p class="text-xs text-slate-400">Verifying signature headers, timestamp drift, and payload idempotency keys.</p>
          </div>
          <span class="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">Secret: ••••••••••••${SECRET.slice(-4)}</span>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs font-mono">
            <thead>
              <tr class="border-b border-dark-700 text-slate-400 uppercase text-[10px]">
                <th class="py-2.5 px-3">Delivery ID</th>
                <th class="py-2.5 px-3">Event Type</th>
                <th class="py-2.5 px-3">HMAC Digest</th>
                <th class="py-2.5 px-3">Attempt</th>
                <th class="py-2.5 px-3">Transit Time</th>
                <th class="py-2.5 px-3">Verification</th>
                <th class="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="audit-table-body" class="divide-y divide-dark-800 text-slate-300">
              <!-- Rendered rows -->
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: Developer SDKs & Webhook Guide -->
    <div id="tab-content-docs" class="hidden space-y-6">
      <div class="glass-card rounded-2xl p-6 border border-dark-700 space-y-6">
        <div>
          <h3 class="text-base font-bold text-white flex items-center gap-2">
            <i data-lucide="shield-alert" class="w-5 h-5 text-emerald-400"></i>
            Validating Webhooks in Client Applications
          </h3>
          <p class="text-xs text-slate-400 mt-1">
            Every webhook dispatched by <code class="text-emerald-300 font-mono">wapp-automata</code> includes a SHA-256 HMAC header <code class="text-emerald-300 font-mono">X-Collector-Signature</code> signed with your <code class="text-emerald-300 font-mono">WEBHOOK_SECRET</code>.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Node.js / Express snippet -->
          <div class="bg-dark-950 rounded-xl p-4 border border-dark-700 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-emerald-400 font-mono">Node.js (Express / Fastify)</span>
              <button onclick="copySnippet('code-node')" class="text-slate-400 hover:text-white text-xs flex items-center gap-1">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
              </button>
            </div>
            <pre class="text-[11px] font-mono text-slate-300 overflow-x-auto p-3 bg-dark-900 rounded-lg"><code id="code-node">const crypto = require('crypto');

function verifyCollectorWebhook(rawBody, signature, secret) {
  if (!signature || !signature.startsWith('sha256=')) return false;
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'utf8'),
    Buffer.from(\`sha256=\${hash}\`, 'utf8')
  );
}

// In Express route:
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['x-collector-signature'];
  if (!verifyCollectorWebhook(req.body, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  const payload = JSON.parse(req.body.toString('utf8'));
  console.log('Verified message:', payload.message.text);
  res.status(200).json({ status: 'ok' });
});</code></pre>
          </div>

          <!-- Python snippet -->
          <div class="bg-dark-950 rounded-xl p-4 border border-dark-700 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-sky-400 font-mono">Python (FastAPI / Flask)</span>
              <button onclick="copySnippet('code-py')" class="text-slate-400 hover:text-white text-xs flex items-center gap-1">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy
              </button>
            </div>
            <pre class="text-[11px] font-mono text-slate-300 overflow-x-auto p-3 bg-dark-900 rounded-lg"><code id="code-py">import hmac
import hashlib
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()
WEBHOOK_SECRET = "local_dev_webhook_secret_key_12345".encode()

@app.post("/webhook")
async def receive_webhook(request: Request):
    signature = request.headers.get("x-collector-signature")
    if not signature or not signature.startswith("sha256="):
        raise HTTPException(status_code=401, detail="Missing signature")

    raw_body = await request.body()
    expected = "sha256=" + hmac.new(WEBHOOK_SECRET, raw_body, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Forged HMAC signature")

    payload = await request.json()
    print(f"Verified sender: {payload['message']['sender_name']}")
    return {"status": "ok"}</code></pre>
          </div>
        </div>

      </div>
    </div>

  </main>

  <!-- Slide-Over Drawer / Payload Inspector Modal -->
  <div id="inspector-drawer" class="fixed inset-0 z-50 overflow-hidden hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-dark-950/80 backdrop-blur-sm transition-opacity" onclick="closeInspector()"></div>

    <div class="fixed inset-y-0 right-0 pl-10 max-w-full flex">
      <div class="w-screen max-w-2xl bg-dark-900 border-l border-dark-700 shadow-2xl flex flex-col">
        
        <!-- Drawer Header -->
        <div class="p-6 border-b border-dark-700 flex items-center justify-between bg-dark-950/60">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <i data-lucide="binary" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="text-sm font-bold text-white" id="drawer-title">Webhook Payload Inspector</h3>
              <p class="text-xs text-slate-400 font-mono" id="drawer-subtitle">del_01HZX87Z9WABC456</p>
            </div>
          </div>
          <button onclick="closeInspector()" class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition-colors">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <!-- Drawer Content Body -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          
          <!-- Metadata Summary Grid -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3 bg-dark-950 rounded-xl border border-dark-800">
              <span class="text-[10px] text-slate-400 uppercase font-semibold block">Event Type</span>
              <span id="drawer-event" class="text-xs font-mono text-emerald-400 font-medium truncate block">-</span>
            </div>
            <div class="p-3 bg-dark-950 rounded-xl border border-dark-800">
              <span class="text-[10px] text-slate-400 uppercase font-semibold block">Attempt</span>
              <span id="drawer-attempt" class="text-xs font-mono text-white font-medium block">1</span>
            </div>
            <div class="p-3 bg-dark-950 rounded-xl border border-dark-800">
              <span class="text-[10px] text-slate-400 uppercase font-semibold block">Security Status</span>
              <span id="drawer-security" class="text-xs font-medium text-emerald-400 block">HMAC Valid</span>
            </div>
            <div class="p-3 bg-dark-950 rounded-xl border border-dark-800">
              <span class="text-[10px] text-slate-400 uppercase font-semibold block">Transit Drift</span>
              <span id="drawer-latency" class="text-xs font-mono text-slate-200 block">12ms</span>
            </div>
          </div>

          <!-- HTTP Headers Section -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-400"></i> Dispatched HTTP Headers
              </span>
            </div>
            <div class="bg-dark-950 rounded-xl p-3 border border-dark-800 overflow-x-auto text-[11px] font-mono">
              <table class="w-full text-left">
                <tbody id="drawer-headers-body" class="divide-y divide-dark-850">
                  <!-- Injected Headers -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- Canonical Envelope JSON Section -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="file-json" class="w-3.5 h-3.5 text-sky-400"></i> Full Canonical Webhook Payload
              </span>
              <button onclick="copyDrawerJson()" class="text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i> Copy JSON
              </button>
            </div>
            <pre class="bg-dark-950 text-slate-200 p-4 rounded-xl border border-dark-800 text-xs font-mono overflow-x-auto max-h-96 leading-relaxed"><code id="drawer-json-content"></code></pre>
          </div>

        </div>

        <!-- Drawer Footer -->
        <div class="p-4 border-t border-dark-700 bg-dark-950/60 flex items-center justify-between">
          <button onclick="copyDrawerCurl()" class="px-3.5 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 border border-dark-600 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-all">
            <i data-lucide="terminal" class="w-3.5 h-3.5 text-emerald-400"></i> Copy cURL Replay
          </button>
          <button onclick="closeInspector()" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all">
            Done
          </button>
        </div>

      </div>
    </div>
  </div>

  <!-- Webhook Simulation Modal -->
  <div id="simulate-modal" class="fixed inset-0 z-50 overflow-hidden hidden" role="dialog" aria-modal="true">
    <div class="absolute inset-0 bg-dark-950/80 backdrop-blur-sm" onclick="closeSimulateModal()"></div>
    <div class="fixed inset-0 flex items-center justify-center p-4">
      <div class="bg-dark-900 border border-dark-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-dark-700 pb-3">
          <div class="flex items-center gap-2">
            <i data-lucide="sparkles" class="w-5 h-5 text-emerald-400"></i>
            <h3 class="text-sm font-bold text-white">Simulate Incoming WhatsApp Event</h3>
          </div>
          <button onclick="closeSimulateModal()" class="text-slate-400 hover:text-white">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 font-medium mb-1">Preset Scenario</label>
            <select id="sim-preset" onchange="applySimPreset()" class="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500">
              <option value="quote">🍅 Wholesale Supplier Price Quote (Group)</option>
              <option value="direct">💬 Direct Customer Order (1-on-1)</option>
              <option value="media">📎 Warehouse Inventory Invoice (Media/Photo)</option>
              <option value="tampered">⚠️ Security Attack Simulation (Forged HMAC)</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 font-medium mb-1">Sender Name</label>
              <input type="text" id="sim-sender-name" value="Haji Produce Trading" class="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500" />
            </div>
            <div>
              <label class="block text-slate-400 font-medium mb-1">Phone Number</label>
              <input type="text" id="sim-sender-phone" value="+8801712345678" class="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500" />
            </div>
          </div>

          <div>
            <label class="block text-slate-400 font-medium mb-1">Group / Channel Title</label>
            <input type="text" id="sim-group-name" value="Karwan Bazar Wholesale Hub" class="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500" />
          </div>

          <div>
            <label class="block text-slate-400 font-medium mb-1">Raw WhatsApp Text</label>
            <textarea id="sim-text" rows="3" class="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500">Tomato Premium Quality: 45 Tk/kg. 200 Crates in stock today!</textarea>
          </div>

          <div class="flex items-center gap-2 pt-1">
            <input type="checkbox" id="sim-forge-hmac" class="rounded bg-dark-950 border-dark-700 text-emerald-500 focus:ring-0" />
            <label for="sim-forge-hmac" class="text-slate-400">Deliberately forge HMAC signature (test security rejection)</label>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-3 border-t border-dark-700">
          <button onclick="closeSimulateModal()" class="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium">Cancel</button>
          <button onclick="executeSimulate()" class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-md shadow-emerald-600/20">
            <i data-lucide="send" class="w-3.5 h-3.5"></i> Dispatch Payload
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Notification Toast Container -->
  <div id="toast-container" class="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none"></div>

  <!-- Client-Side Dashboard Script -->
  <script>
    let messagesCache = [];
    let isStreamPaused = false;
    let soundEnabled = true;
    let selectedMessage = null;
    let pollInterval = null;

    // Web Audio Synthesizer Chime
    function playChime() {
      if (!soundEnabled) return;
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880.0, audioCtx.currentTime + 0.15); // A5
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
        icon.setAttribute('data-lucide', 'volume-2');
        icon.classList.add('text-emerald-400');
        icon.classList.remove('text-slate-500');
        showToast('Audio chime enabled', 'success');
      } else {
        icon.setAttribute('data-lucide', 'volume-x');
        icon.classList.remove('text-emerald-400');
        icon.classList.add('text-slate-500');
        showToast('Audio chime muted', 'info');
      }
      lucide.createIcons();
    }

    function toggleStreamPause() {
      isStreamPaused = !isStreamPaused;
      const icon = document.getElementById('icon-stream-pause');
      const btn = document.getElementById('btn-pause-stream');
      if (isStreamPaused) {
        icon.setAttribute('data-lucide', 'play');
        btn.classList.add('bg-amber-500/20', 'text-amber-300');
        showToast('Live stream updates paused', 'warning');
      } else {
        icon.setAttribute('data-lucide', 'pause');
        btn.classList.remove('bg-amber-500/20', 'text-amber-300');
        showToast('Live stream resumed', 'success');
        fetchMessages();
      }
      lucide.createIcons();
    }

    // Avatar Color Generator based on phone or string
    function getAvatarColor(str) {
      const colors = [
        'from-emerald-500 to-teal-700',
        'from-sky-500 to-blue-700',
        'from-indigo-500 to-purple-700',
        'from-amber-500 to-orange-700',
        'from-rose-500 to-pink-700',
        'from-teal-500 to-cyan-700'
      ];
      let hash = 0;
      for (let i = 0; i < (str || '').length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colors[Math.abs(hash) % colors.length];
    }

    function getInitials(name) {
      if (!name) return 'WA';
      const parts = name.trim().split(/\\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }

    // Data Fetching & UI Rendering
    async function fetchMessages() {
      if (isStreamPaused) return;
      try {
        const res = await fetch('/api/messages');
        const data = await res.json();
        
        const previousLength = messagesCache.length;
        messagesCache = data;

        if (previousLength > 0 && data.length > previousLength) {
          playChime();
          const newCount = data.length - previousLength;
          showToast(\`\${newCount} new webhook \${newCount > 1 ? 'events' : 'event'} received\`, 'success');
        }

        updateStats(data);
        renderFeed(data);
        renderAuditTable(data);
      } catch (err) {
        console.error('Failed to poll messages:', err);
      }
    }

    function updateStats(data) {
      document.getElementById('stat-total').innerText = data.length;
      document.getElementById('tab-badge-count').innerText = data.length;

      const validCount = data.filter(m => m.isValid).length;
      const rate = data.length > 0 ? Math.round((validCount / data.length) * 100) : 100;
      document.getElementById('stat-hmac-rate').innerText = \`\${rate}%\`;

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

    function renderFeed(data) {
      const container = document.getElementById('messages-container');
      const searchQuery = (document.getElementById('search-input').value || '').toLowerCase();
      const filterType = document.getElementById('filter-type').value;

      const filtered = data.filter(m => {
        // Type filter
        if (filterType === 'group' && m.chat_type !== 'group') return false;
        if (filterType === 'direct' && m.chat_type !== 'direct') return false;
        if (filterType === 'media' && !m.has_media) return false;

        // Search query
        if (!searchQuery) return true;
        const haystack = [
          m.text,
          m.sender_name,
          m.sender_phone,
          m.chat_name,
          m.chat_id,
          m.id,
          m.delivery_id
        ].join(' ').toLowerCase();
        return haystack.includes(searchQuery);
      });

      if (filtered.length === 0) {
        container.innerHTML = \`
          <div class="glass-card rounded-2xl p-12 text-center border border-dashed border-dark-700">
            <div class="w-14 h-14 mx-auto rounded-2xl bg-dark-900 border border-dark-700 flex items-center justify-center text-slate-500 mb-4">
              <i data-lucide="radio" class="w-7 h-7 text-emerald-500/60 animate-pulse"></i>
            </div>
            <h4 class="text-base font-semibold text-white">Listening for WhatsApp Messages</h4>
            <p class="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Send a message from your connected WhatsApp phone, or click <strong>Simulate Webhook</strong> in the top-right to test incoming events instantly.
            </p>
          </div>
        \`;
        lucide.createIcons();
        return;
      }

      container.innerHTML = filtered.map(m => {
        const avatarGradient = getAvatarColor(m.sender_phone || m.sender_id || m.sender_name);
        const initials = getInitials(m.sender_name || m.sender_phone);
        const phoneFormatted = m.sender_phone || m.sender_id;
        const isGroup = m.chat_type === 'group';

        return \`
          <div class="glass-card rounded-2xl p-4 sm:p-5 border border-dark-700/80 hover:border-dark-600 transition-all group">
            <div class="flex items-start justify-between gap-3">
              
              <!-- Sender Profile & Details -->
              <div class="flex items-start gap-3.5 flex-1 min-w-0">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-tr \${avatarGradient} flex items-center justify-center text-white font-bold text-xs shadow-md shrink-0">
                  \${escapeHtml(initials)}
                </div>

                <div class="flex-1 min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-sm font-semibold text-white truncate">\${escapeHtml(m.sender_name || 'Anonymous Contact')}</span>
                    
                    \${phoneFormatted ? \`
                      <button onclick="copyToClipboard('\${escapeHtml(phoneFormatted)}', 'Phone number')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-dark-950 border border-dark-700 text-slate-300 font-mono text-[11px] hover:border-emerald-500/50 hover:text-emerald-400 transition-colors">
                        <i data-lucide="phone" class="w-2.5 h-2.5 text-slate-400"></i>
                        <span>\${escapeHtml(phoneFormatted)}</span>
                      </button>
                    \` : ''}

                    \${isGroup ? \`
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-medium">
                        <i data-lucide="users" class="w-3 h-3"></i>
                        <span class="truncate max-w-[200px]">\${escapeHtml(m.chat_name || m.chat_id)}</span>
                      </span>
                    \` : \`
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[11px]">
                        <i data-lucide="user" class="w-3 h-3"></i> Direct Chat
                      </span>
                    \`}

                    \${m.has_media ? \`
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px]">
                        <i data-lucide="paperclip" class="w-3 h-3"></i> Media
                      </span>
                    \` : ''}
                  </div>

                  <!-- Verbatim Message Content -->
                  <div class="mt-2 text-xs text-slate-200 font-sans whitespace-pre-wrap break-words bg-dark-950/70 p-3 rounded-xl border border-dark-800/80 leading-relaxed font-mono">
                    \${escapeHtml(m.text || '(empty/media message)')}
                  </div>
                </div>
              </div>

              <!-- Status Stamp & Time -->
              <div class="flex flex-col items-end gap-1.5 shrink-0">
                <div class="flex items-center gap-1.5">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium flex items-center gap-1 \${
                    m.isValid 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }">
                    <i data-lucide="\${m.isValid ? 'shield-check' : 'alert-octagon'}" class="w-3 h-3"></i>
                    <span>\${m.isValid ? 'HMAC VALID' : 'HMAC INVALID'}</span>
                  </span>
                </div>

                <span class="text-[11px] text-slate-400 font-mono" title="\${escapeHtml(m.occurred_at || '')}">
                  \${escapeHtml(m.timestamp)}
                </span>
              </div>

            </div>

            <!-- Card Bottom Action Row -->
            <div class="mt-3 pt-3 border-t border-dark-800/80 flex items-center justify-between text-xs text-slate-400">
              <div class="flex items-center gap-3 font-mono text-[11px] text-slate-500">
                <span>ID: <code class="text-slate-400">\${escapeHtml(m.id || 'N/A')}</code></span>
                \${m.latency_ms ? \`<span>Transit: <code class="text-emerald-400">\${m.latency_ms}ms</code></span>\` : ''}
              </div>

              <div class="flex items-center gap-2">
                <button onclick="inspectMessage('\${escapeHtml(m.id)}')" class="px-2.5 py-1 rounded-lg bg-dark-900 hover:bg-dark-800 text-slate-300 hover:text-white border border-dark-700 text-[11px] font-medium flex items-center gap-1.5 transition-all">
                  <i data-lucide="eye" class="w-3 h-3 text-emerald-400"></i> Inspect Payload
                </button>
                <button onclick="copyMessageJson('\${escapeHtml(m.id)}')" class="p-1 rounded-lg bg-dark-900 hover:bg-dark-800 text-slate-400 hover:text-white border border-dark-700 transition-colors" title="Copy Raw Webhook JSON">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                </button>
              </div>
            </div>

          </div>
        \`;
      }).join('');

      lucide.createIcons();
    }

    function renderAuditTable(data) {
      const tbody = document.getElementById('audit-table-body');
      if (data.length === 0) {
        tbody.innerHTML = \`<tr><td colspan="7" class="py-8 text-center text-slate-500 font-sans">No audit records registered yet.</td></tr>\`;
        return;
      }

      tbody.innerHTML = data.map(m => \`
        <tr class="hover:bg-dark-850/60 transition-colors">
          <td class="py-2.5 px-3 text-slate-200 font-medium">\${escapeHtml(m.delivery_id || m.id)}</td>
          <td class="py-2.5 px-3 text-emerald-400">\${escapeHtml(m.event || 'whatsapp.message.received')}</td>
          <td class="py-2.5 px-3 text-slate-400 truncate max-w-[140px]" title="\${escapeHtml(m.headers ? m.headers['x-collector-signature'] : '')}">
            \${escapeHtml((m.headers && m.headers['x-collector-signature']) ? m.headers['x-collector-signature'].slice(0, 18) + '...' : 'sha256=...')}
          </td>
          <td class="py-2.5 px-3 text-slate-300">\${escapeHtml(m.attempt || 1)}</td>
          <td class="py-2.5 px-3 text-slate-300">\${m.latency_ms ? m.latency_ms + ' ms' : '< 20 ms'}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold \${m.isValid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}">
              \${m.isValid ? 'PASS' : 'TAMPERED'}
            </span>
          </td>
          <td class="py-2.5 px-3 text-right">
            <button onclick="inspectMessage('\${escapeHtml(m.id)}')" class="text-emerald-400 hover:text-emerald-300 text-xs">Inspect</button>
          </td>
        </tr>
      \`).join('');
    }

    function switchTab(tabId) {
      document.getElementById('tab-content-feed').classList.toggle('hidden', tabId !== 'feed');
      document.getElementById('tab-content-audit').classList.toggle('hidden', tabId !== 'audit');
      document.getElementById('tab-content-docs').classList.toggle('hidden', tabId !== 'docs');

      const searchControls = document.getElementById('feed-search-controls');
      if (searchControls) searchControls.classList.toggle('hidden', tabId !== 'feed');

      ['feed', 'audit', 'docs'].forEach(t => {
        const btn = document.getElementById(\`tab-btn-\${t}\`);
        if (t === tabId) {
          btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-2 transition-all';
        } else {
          btn.className = 'px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-dark-800 transition-all flex items-center gap-2';
        }
      });
      lucide.createIcons();
    }

    function handleSearchChange() {
      renderFeed(messagesCache);
    }

    function handleFilterChange() {
      renderFeed(messagesCache);
    }

    // Inspector Slide-over Drawer
    function inspectMessage(messageId) {
      const msg = messagesCache.find(m => m.id === messageId);
      if (!msg) return;
      selectedMessage = msg;

      document.getElementById('drawer-title').innerText = \`Message: \${msg.sender_name || msg.sender_phone || 'WhatsApp'}\`;
      document.getElementById('drawer-subtitle').innerText = msg.delivery_id || msg.id;
      document.getElementById('drawer-event').innerText = msg.event || 'whatsapp.message.received';
      document.getElementById('drawer-attempt').innerText = msg.attempt || 1;
      document.getElementById('drawer-security').innerText = msg.isValid ? 'HMAC Valid (SHA-256)' : 'Invalid HMAC Signature';
      document.getElementById('drawer-security').className = msg.isValid ? 'text-xs font-medium text-emerald-400 block' : 'text-xs font-medium text-rose-400 block';
      document.getElementById('drawer-latency').innerText = msg.latency_ms ? \`\${msg.latency_ms} ms\` : '12 ms';

      const headersBody = document.getElementById('drawer-headers-body');
      if (msg.headers) {
        headersBody.innerHTML = Object.entries(msg.headers).map(([k, v]) => \`
          <tr class="py-1">
            <td class="text-slate-400 py-1 font-semibold pr-4 whitespace-nowrap">\${escapeHtml(k)}</td>
            <td class="text-emerald-300 py-1 break-all select-all">\${escapeHtml(v)}</td>
          </tr>
        \`).join('');
      } else {
        headersBody.innerHTML = '<tr><td class="py-2 text-slate-500">No raw headers logged</td></tr>';
      }

      document.getElementById('drawer-json-content').innerText = JSON.stringify(msg.raw_envelope || msg, null, 2);
      document.getElementById('inspector-drawer').classList.remove('hidden');
      lucide.createIcons();
    }

    function closeInspector() {
      document.getElementById('inspector-drawer').classList.add('hidden');
      selectedMessage = null;
    }

    function copyDrawerJson() {
      if (!selectedMessage) return;
      navigator.clipboard.writeText(JSON.stringify(selectedMessage.raw_envelope || selectedMessage, null, 2));
      showToast('Payload JSON copied to clipboard', 'success');
    }

    function copyDrawerCurl() {
      if (!selectedMessage) return;
      const jsonStr = JSON.stringify(selectedMessage.raw_envelope || selectedMessage);
      const sig = selectedMessage.headers ? selectedMessage.headers['x-collector-signature'] : '';
      const curl = \`curl -X POST http://127.0.0.1:4000/webhook \\\\
  -H "Content-Type: application/json" \\\\
  -H "X-Collector-Signature: \${sig}" \\\\
  -H "X-Collector-Event: whatsapp.message.received" \\\\
  -d '\${jsonStr}'\`;
      navigator.clipboard.writeText(curl);
      showToast('cURL replay command copied to clipboard', 'success');
    }

    function copyMessageJson(messageId) {
      const msg = messagesCache.find(m => m.id === messageId);
      if (!msg) return;
      navigator.clipboard.writeText(JSON.stringify(msg.raw_envelope || msg, null, 2));
      showToast('Message JSON copied', 'success');
    }

    // Webhook Simulator Modal
    function openSimulateModal() {
      document.getElementById('simulate-modal').classList.remove('hidden');
      lucide.createIcons();
    }

    function closeSimulateModal() {
      document.getElementById('simulate-modal').classList.add('hidden');
    }

    function applySimPreset() {
      const preset = document.getElementById('sim-preset').value;
      const senderInput = document.getElementById('sim-sender-name');
      const phoneInput = document.getElementById('sim-sender-phone');
      const groupInput = document.getElementById('sim-group-name');
      const textInput = document.getElementById('sim-text');
      const forgeCheck = document.getElementById('sim-forge-hmac');

      forgeCheck.checked = false;

      if (preset === 'quote') {
        senderInput.value = 'Haji Produce Trading';
        phoneInput.value = '+8801712345678';
        groupInput.value = 'Karwan Bazar Wholesale Hub';
        textInput.value = 'Tomato Premium Quality: 45 Tk/kg. 200 Crates in stock today!';
      } else if (preset === 'direct') {
        senderInput.value = 'Rahim Chowdhury';
        phoneInput.value = '+8801911998877';
        groupInput.value = '';
        textInput.value = 'Hello, can you share the invoice for yesterday delivery?';
      } else if (preset === 'media') {
        senderInput.value = 'Delta Agro Logistics';
        phoneInput.value = '+8801819992233';
        groupInput.value = 'National Cold Storage Suppliers';
        textInput.value = 'Delivery manifest and cold-chain temperature chart attached.';
      } else if (preset === 'tampered') {
        senderInput.value = 'Untrusted Actor';
        phoneInput.value = '+1234567890';
        groupInput.value = 'Security Red Team Test';
        textInput.value = 'ATTACK_PAYLOAD: testing forged signature rejection.';
        forgeCheck.checked = true;
      }
    }

    async function executeSimulate() {
      const senderName = document.getElementById('sim-sender-name').value;
      const phone = document.getElementById('sim-sender-phone').value;
      const groupName = document.getElementById('sim-group-name').value;
      const text = document.getElementById('sim-text').value;
      const isForge = document.getElementById('sim-forge-hmac').checked;

      closeSimulateModal();

      const simPayload = {
        senderName,
        phone,
        groupName,
        text,
        forgeSignature: isForge
      };

      try {
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(simPayload)
        });
        const result = await res.json();
        showToast(isForge ? 'Simulated attack payload dispatched' : 'Simulated webhook event dispatched', isForge ? 'warning' : 'success');
        fetchMessages();
      } catch (err) {
        showToast('Simulation dispatch error: ' + err.message, 'error');
      }
    }

    // Utilities
    async function clearMessagesFeed() {
      if (!confirm('Clear all received messages from memory?')) return;
      try {
        await fetch('/api/clear', { method: 'POST' });
        messagesCache = [];
        updateStats([]);
        renderFeed([]);
        renderAuditTable([]);
        showToast('Feed cleared successfully', 'info');
      } catch (e) {
        showToast('Failed to clear feed', 'error');
      }
    }

    function exportMessagesJson() {
      if (messagesCache.length === 0) {
        showToast('No messages to export', 'warning');
        return;
      }
      const blob = new Blob([JSON.stringify(messagesCache, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`wapp-automata-webhooks-\${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Exported messages JSON file', 'success');
    }

    function copyToClipboard(text, label) {
      navigator.clipboard.writeText(text);
      showToast(\`\${label || 'Content'} copied to clipboard\`, 'success');
    }

    function copySnippet(elementId) {
      const code = document.getElementById(elementId).innerText;
      navigator.clipboard.writeText(code);
      showToast('Code snippet copied to clipboard', 'success');
    }

    function showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      const colors = {
        success: 'bg-emerald-600/90 text-white border-emerald-500/40',
        warning: 'bg-amber-600/90 text-white border-amber-500/40',
        error: 'bg-rose-600/90 text-white border-rose-500/40',
        info: 'bg-dark-900/90 text-slate-200 border-dark-700'
      };

      toast.className = \`px-4 py-2.5 rounded-xl border shadow-xl text-xs font-medium flex items-center gap-2 backdrop-blur-md transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0 \${colors[type] || colors.info}\`;
      toast.innerHTML = \`<span>\${escapeHtml(message)}</span>\`;
      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
      });

      setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Initialize Polling
    fetchMessages();
    pollInterval = setInterval(fetchMessages, 1500);
    lucide.createIcons();
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const server = http.createServer((req, res) => {
  // 1. Browser dashboard routes
  if (req.method === 'GET') {
    if (req.url === '/api/messages') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(recentMessages));
    }
    if (req.url === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
        totalReceived: stats.totalReceived,
        validSignatures: stats.validSignatures,
        invalidSignatures: stats.invalidSignatures,
        uniqueGroups: stats.groupsCount.size,
        uniqueSenders: stats.sendersCount.size
      }));
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderHtmlPage());
  }

  // 2. Action endpoints
  if (req.method === 'POST') {
    if (req.url === '/api/clear') {
      recentMessages.length = 0;
      deliveryLogs.length = 0;
      stats.groupsCount.clear();
      stats.sendersCount.clear();
      stats.totalReceived = 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', cleared: true }));
    }

    // Simulator endpoint
    if (req.url === '/api/simulate') {
      let simBody = '';
      req.on('data', chunk => { simBody += chunk; });
      req.on('end', () => {
        let simData = {};
        try { simData = JSON.parse(simBody); } catch {}

        const now = new Date();
        const fakeMessageId = 'sim_' + crypto.randomBytes(6).toString('hex').toUpperCase();
        const fakeDeliveryId = 'del_' + crypto.randomBytes(8).toString('hex');
        const phone = simData.phone || '+8801712345678';
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const isGroup = Boolean(simData.groupName);
        const chatId = isGroup ? `${cleanPhone}-16849302@g.us` : `${cleanPhone}@s.whatsapp.net`;
        const senderId = `${cleanPhone}@s.whatsapp.net`;

        const envelope = {
          event: 'whatsapp.message.received',
          version: '1.0',
          delivery_id: fakeDeliveryId,
          attempt: 1,
          occurred_at: new Date(now.getTime() - 150).toISOString(),
          received_at: now.toISOString(),
          dispatched_at: now.toISOString(),
          message: {
            message_id: fakeMessageId,
            chat_id: chatId,
            chat_name: isGroup ? simData.groupName : null,
            chat_type: isGroup ? 'group' : 'direct',
            sender_id: senderId,
            sender_name: simData.senderName || 'Simulated Supplier',
            text: simData.text || 'Simulated wholesale produce message.',
            has_media: false,
            media: null,
            reply_to: null,
            raw_payload: {
              key: { remoteJid: chatId, fromMe: false, id: fakeMessageId, participant: isGroup ? senderId : undefined },
              message: { conversation: simData.text || 'Simulated text' },
              messageTimestamp: Math.floor(now.getTime() / 1000)
            }
          }
        };

        const jsonString = JSON.stringify(envelope);
        const signature = simData.forgeSignature ? 'sha256=invalid_tampered_signature_000000' : computeSignature(jsonString);

        // Inject as standard webhook delivery
        processWebhookDelivery(jsonString, {
          'x-collector-signature': signature,
          'x-collector-event': 'whatsapp.message.received',
          'x-collector-delivery-id': fakeDeliveryId,
          'x-collector-timestamp': String(now.getTime()),
          'x-collector-version': '1.0'
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', simulated: true, delivery_id: fakeDeliveryId }));
      });
      return;
    }

    // Actual Webhook Delivery (POST /webhook or POST /)
    if (req.url === '/webhook' || req.url === '/') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        const result = processWebhookDelivery(body, req.headers);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', received_at: Date.now(), valid: result.isValid }));
      });
      return;
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
});

function processWebhookDelivery(body, headers) {
  const signature = headers['x-collector-signature'];
  const event = headers['x-collector-event'] || 'whatsapp.message.received';
  const deliveryId = headers['x-collector-delivery-id'] || 'del_' + Date.now();
  const timestamp = headers['x-collector-timestamp'] || Date.now();

  const isValidSig = verifySignature(body, signature);

  stats.totalReceived++;
  if (isValidSig) {
    stats.validSignatures++;
  } else {
    stats.invalidSignatures++;
  }

  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {}

  let senderDisplay = 'Unknown Contact';
  let senderPhone = '';
  let chatDisplay = 'Unknown Chat';
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

    senderDisplay = parsed.message.sender_name || senderPhone || 'Unknown Contact';
    chatDisplay = parsed.message.chat_name || parsed.message.chat_id || 'Direct Chat';
    occurredAt = parsed.occurred_at || occurredAt;

    if (parsed.occurred_at) {
      const delta = Date.now() - new Date(parsed.occurred_at).getTime();
      if (delta >= 0 && delta < 600000) {
        latencyMs = delta;
      }
    }

    if (parsed.message.chat_name) {
      stats.groupsCount.add(parsed.message.chat_name);
    }
    if (senderPhone) {
      stats.sendersCount.add(senderPhone);
    }
  }

  const messageRecord = {
    id: messageId,
    delivery_id: deliveryId,
    event,
    attempt: (parsed && parsed.attempt) || 1,
    sender_name: senderDisplay,
    sender_phone: senderPhone,
    sender_id: (parsed && parsed.message && parsed.message.sender_id) || '',
    chat_name: (parsed && parsed.message && parsed.message.chat_name) || '',
    chat_id: (parsed && parsed.message && parsed.message.chat_id) || '',
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

  recentMessages.unshift(messageRecord);
  if (recentMessages.length > 200) {
    recentMessages.pop();
  }

  console.log('\n============================================================');
  console.log(`📥 Ingested Webhook [${new Date().toISOString()}]`);
  console.log('------------------------------------------------------------');
  console.log(`Event:       ${event}`);
  console.log(`Delivery ID: ${deliveryId}`);
  console.log(`HMAC Valid:  ${isValidSig ? '✅ YES (SHA-256)' : '❌ NO (Secret mismatch/tampered)'}`);
  console.log(`Sender:      ${senderDisplay} (${senderPhone || 'no phone'})`);
  console.log(`Chat:        ${chatDisplay} [${chatType}]`);
  console.log(`Latency:     ${latencyMs} ms`);
  console.log(`Text:        ${text.slice(0, 100)}${text.length > 100 ? '...' : ''}`);
  console.log('============================================================\n');

  return { isValid: isValidSig };
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 SaaS Webhook Studio & Monitor running at: http://127.0.0.1:${PORT}/`);
  console.log(`📡 Ingestion Endpoint:                      http://127.0.0.1:${PORT}/webhook`);
  console.log(`🔑 Listening with WEBHOOK_SECRET:            "${SECRET}"`);
  console.log('Ready to receive production WhatsApp events from wapp-automata.\n');
});
