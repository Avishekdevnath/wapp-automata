/**
 * Default Seed Knowledge Base Articles for TELCIA (Telecom Cognitive Intelligent Agent)
 */
export const SEED_KNOWLEDGE_BASE = [
  // 0. ABOUT TELCIA
  {
    id: 'about-telcia-system',
    category: 'system',
    category_label: 'About TELCIA',
    question: 'What is TELCIA and what does it stand for?',
    short_answer: 'TELCIA stands for Telecom Cognitive Intelligent Agent—an autonomous real-time intelligence desk for wholesale telecom voice trading.',
    detailed_steps: JSON.stringify([
      '**TELCIA Full Form:** Telecom Cognitive Intelligent Agent.',
      '**Mission:** Collect, parse, verify, and index live wholesale telecom voice trading offers, carrier corridors, and rate matrix broadcasts from WhatsApp groups and trader chats with zero message loss.',
      '**Core Architecture:** WhatsApp Companion Gateway → Local SQLite Durable Queue → Regex & AI Route Extraction Pipeline → Dedicated Carrier CRM Dossiers → Webhook Dispatcher.',
      '**Operator Standard:** Strict privacy isolation, automated rate card parsing, real-time market trends, and one-click WhatsApp knock trading.'
    ]),
    wait_time: '24/7 Autonomous Operation',
    tags: JSON.stringify(['telcia', 'about', 'full form', 'telecom cognitive intelligent agent', 'what is telcia', 'meaning', 'architecture', 'overview']),
    action_label: 'View Dashboard',
    action_type: 'dashboard',
    sort_order: 0
  },
  // 1. LOGIN, ACCESS & AUTHENTICATION
  {
    id: 'terminal-login-access',
    category: 'security',
    category_label: 'Login & Access Control',
    question: 'How do I log in or unlock the Telcia terminal?',
    short_answer: 'Enter your master terminal password on the central lock screen and click "Unlock Terminal".',
    detailed_steps: JSON.stringify([
      'Open https://telcia.bijoytel.network in your web browser.',
      'On the lock screen dialog, type your terminal password.',
      'Click "Unlock Terminal" or press Enter to access your active desk.',
      'If this is your first time logging in and no password was configured, contact your server operator or set an initial password.',
      'If you have forgotten the password, click "Forgot Password?" below the input to receive a 6-digit verification code directly on your linked WhatsApp.'
    ]),
    wait_time: 'Instant (1s)',
    tags: JSON.stringify(['login', 'log in', 'signin', 'sign in', 'unlock', 'lock screen', 'access', 'terminal password', 'authentication', 'password']),
    action_label: 'Security Settings',
    action_type: 'settings',
    sort_order: 1
  },
  {
    id: 'forgot-login-password',
    category: 'security',
    category_label: 'Login & Access Control',
    question: 'I forgot my login password. How do I recover it via WhatsApp OTP?',
    short_answer: 'Click "Forgot Password?" on the lock screen to receive a 6-digit verification code directly on your linked WhatsApp phone.',
    detailed_steps: JSON.stringify([
      'On the terminal lock screen, click the "Forgot Password?" button.',
      'The system will show your currently linked WhatsApp phone (e.g. +88018 •••• 713).',
      'Click "Send Code to WhatsApp".',
      'Within 5 to 15 seconds, a security notification containing your 6-digit PIN arrives in your WhatsApp self-chat.',
      'Enter the 6-digit code, type your new password, confirm it, and click "Reset Password & Unlock".',
      'The terminal updates your credentials in SQLite and logs you in immediately.'
    ]),
    wait_time: '5 – 15 Seconds Delivery',
    tags: JSON.stringify(['login', 'forgot password', 'login recovery', 'reset login', 'otp', 'pin', 'lock screen', 'signin', 'unlock password']),
    action_label: 'Security Settings',
    action_type: 'settings',
    sort_order: 2
  },
  {
    id: 'logout-and-switch-account',
    category: 'security',
    category_label: 'Login & Access Control',
    question: 'How do I log out or log in with another WhatsApp account?',
    short_answer: 'Click the Lock icon in the header to log out, or switch Desks to access another isolated WhatsApp account.',
    detailed_steps: JSON.stringify([
      'To Log Out: Click the Lock icon in the top right header to lock the terminal immediately.',
      'To Log In with Another WhatsApp Account: Click your active Desk in the top header and select a different desk or "+ Create New Desk...".',
      'Each desk maintains its own isolated WhatsApp companion login. You can link Phone A to Desk 1 and Phone B to Desk 2 with zero cross-talk.',
      'To unlink a WhatsApp account from an existing desk: Go to Settings → WhatsApp Gateway card → Click "Unlink & Reset".'
    ]),
    wait_time: 'Instant Switching',
    tags: JSON.stringify(['login', 'logout', 'log out', 'sign out', 'switch account', 'change user', 'multiple logins', 'another account', 'lock']),
    action_label: 'Manage Desks',
    action_type: 'settings',
    sort_order: 3
  },
  {
    id: 'login-invalid-attempts',
    category: 'security',
    category_label: 'Login & Access Control',
    question: 'What happens if someone enters an incorrect login password or wrong OTP?',
    short_answer: 'Incorrect passwords are rejected with security logs; OTP resets lock after 5 bad attempts for brute-force protection.',
    detailed_steps: JSON.stringify([
      'Incorrect login password attempts are rejected immediately with HTTP 401.',
      'During WhatsApp OTP password reset, the 6-digit PIN is strictly valid for 5 minutes.',
      'If 5 incorrect OTP codes are entered, the security PIN is destroyed immediately to prevent brute-force attacks.',
      'A 60-second cooldown is enforced before a new verification code can be dispatched to your phone.'
    ]),
    wait_time: '60s Cooldown / 5m Expiry',
    tags: JSON.stringify(['login', 'failed login', 'wrong password', 'brute force', 'security lock', 'otp attempts', 'lockout', 'invalid password']),
    action_label: 'Security Settings',
    action_type: 'settings',
    sort_order: 4
  },
  {
    id: 'keep-login-session',
    category: 'security',
    category_label: 'Login & Access Control',
    question: 'How long does my terminal login session last?',
    short_answer: 'Your authenticated session is stored securely in your browser and persists until you explicitly log out.',
    detailed_steps: JSON.stringify([
      'Once unlocked, a secure authentication token is stored in your browser local storage.',
      'Refreshing the page, switching tabs, or reopening your browser will keep you logged in on that device.',
      'To protect sensitive wholesale carrier data on shared workstations, always click the Lock icon in the header before leaving your desk.'
    ]),
    wait_time: 'Persistent Session',
    tags: JSON.stringify(['login', 'session duration', 'stay logged in', 'remember me', 'browser session', 'token', 'auth persistence']),
    action_label: 'Security Settings',
    action_type: 'settings',
    sort_order: 5
  },

  // 1. WHATSAPP PAIRING
  {
    id: 'pairing-wait-time',
    category: 'pairing',
    category_label: 'WhatsApp Pairing',
    question: 'How long does first-time WhatsApp pairing take?',
    short_answer: 'First-time pairing typically takes 3 to 5 minutes for active trading accounts with many groups.',
    detailed_steps: JSON.stringify([
      'Keep your phone screen unlocked and actively on the WhatsApp app.',
      'Ensure the phone is connected to stable Wi-Fi or high-speed mobile data.',
      'During this 3 to 5 minute window, WhatsApp transfers cryptographic keys, recent chat history, and group participant lists in the background.',
      'Do not close or restart the terminal while the status shows "Syncing Initial History...".',
      'Once the green "Connected" badge appears, live incoming traffic will begin streaming automatically.'
    ]),
    wait_time: '3 – 5 Minutes',
    tags: JSON.stringify(['pairing', 'wait time', 'linking', 'sync', 'initial setup', 'duration', 'login', 'whatsapp login']),
    action_label: 'Open Pairing Modal',
    action_type: 'device-modal',
    sort_order: 6
  },
  {
    id: 'pairing-methods',
    category: 'pairing',
    category_label: 'WhatsApp Pairing',
    question: 'How do I link my WhatsApp account (QR Code vs 8-Digit Pairing Code)?',
    short_answer: 'You can link your phone using either instant QR Code scan or the remote 8-digit Pairing Code.',
    detailed_steps: JSON.stringify([
      'Click "Connect Device" or the status indicator in the top header.',
      'Option A (QR Code): Open WhatsApp on phone → Settings → Linked Devices → Link a Device → Point your camera at the QR code on screen.',
      'Option B (Pairing Code): If linking remotely, enter your phone number with country code (e.g. +88018...). A temporary 8-digit code will appear. Tap the push notification on your phone and enter the 8 characters.',
      'Leave your phone screen active for 3–5 minutes until initial synchronization completes.'
    ]),
    wait_time: '30s to Pair + 3–5m Sync',
    tags: JSON.stringify(['qr code', 'pairing code', 'link device', 'companion', 'how to link', 'whatsapp signin', 'login']),
    action_label: 'Link Account Now',
    action_type: 'device-modal',
    sort_order: 7
  },
  {
    id: 'phone-background-sleep',
    category: 'pairing',
    category_label: 'WhatsApp Pairing',
    question: 'How do I keep WhatsApp from disconnecting when my phone sleeps?',
    short_answer: 'Turn off battery optimization for WhatsApp on Android or ensure Background App Refresh is On in iOS.',
    detailed_steps: JSON.stringify([
      'Android: Go to Phone Settings → Apps → WhatsApp → Battery → Select "Unrestricted" (prevent OS from sleeping the socket).',
      'iOS: Go to Settings → General → Background App Refresh → Enable it for WhatsApp.',
      'Keep the phone connected to power and stable Wi-Fi during business trading hours.',
      'WhatsApp Multi-Device will maintain the companion socket connection 24/7 on your VPS.'
    ]),
    wait_time: '1 Minute Setup',
    tags: JSON.stringify(['battery saver', 'sleep', 'disconnect', 'keep alive', 'background', 'offline']),
    action_label: 'Check Connection',
    action_type: 'device-modal',
    sort_order: 8
  },
  {
    id: 'reconnect-on-reboot',
    category: 'pairing',
    category_label: 'WhatsApp Pairing',
    question: 'What happens when the server restarts or reboots?',
    short_answer: 'The terminal automatically reconnects using preserved encryption keys and catches up in 30–60 seconds.',
    detailed_steps: JSON.stringify([
      'You do NOT need to re-scan the QR code after a server reboot.',
      'Baileys securely re-uses the session keys stored in your desk workspace.',
      'Allow 30 to 60 seconds for Baileys to reconnect to WhatsApp servers and process offline backlogs.',
      'The live stream will automatically resume as new broadcasts arrive.'
    ]),
    wait_time: '30 – 60 Seconds',
    tags: JSON.stringify(['restart', 'reboot', 'reconnect', 'offline catchup', 'automatic', 're-login']),
    action_label: 'View Stream',
    action_type: 'stream',
    sort_order: 9
  },
  {
    id: 'session-logged-out',
    category: 'pairing',
    category_label: 'WhatsApp Pairing',
    question: 'What should I do if the terminal says "Session Logged Out"?',
    short_answer: 'If a session was unlinked from the phone, simply generate a fresh QR code or 8-digit pairing code.',
    detailed_steps: JSON.stringify([
      'Open the WhatsApp Pairing modal from the header.',
      'Click "Reset Session & Re-link" to clear old session tokens.',
      'Scan the new QR code or request an 8-digit code with your phone number.',
      'Existing messages in your database are 100% safe and will NOT be erased when re-linking.'
    ]),
    wait_time: '3 – 5 Minutes',
    tags: JSON.stringify(['logged out', 'session expired', 'relink', 're-auth', 'disconnected', 'login again']),
    action_label: 'Reset & Re-link',
    action_type: 'device-modal',
    sort_order: 10
  },

  // 2. LIVE MESSAGE STREAM & INGESTION
  {
    id: 'stream-search-filters',
    category: 'stream',
    category_label: 'Live Stream & Messages',
    question: 'How do I search for specific carrier rates or country destinations?',
    short_answer: 'Use the real-time search bar in the Live Stream table to filter by keyword, country code, or sender.',
    detailed_steps: JSON.stringify([
      'Navigate to "Live Messages Stream" from the sidebar.',
      'In the search box, type country names (e.g. "Ghana", "Zimbabwe", "India") or dial codes (e.g. "233", "263", "91").',
      'You can also filter by group names or specific trading contact numbers.',
      'The stream updates in real-time as new broadcasts are captured.'
    ]),
    wait_time: 'Instant (0s)',
    tags: JSON.stringify(['search', 'filter', 'rates', 'destinations', 'find messages', 'country code']),
    action_label: 'Go to Live Stream',
    action_type: 'stream',
    sort_order: 11
  },
  {
    id: 'formatted-vs-raw',
    category: 'stream',
    category_label: 'Live Stream & Messages',
    question: 'What is the difference between "Formatted" and "Raw" message view?',
    short_answer: 'Formatted renders WhatsApp bold, lists, and links; Raw displays the exact verbatim characters.',
    detailed_steps: JSON.stringify([
      'Click any row in the Live Stream to open the Message Detail modal.',
      'By default, "Formatted" view renders rich WhatsApp Markdown (*bold*, _italic_, bullet lists, code blocks, and clickable URLs).',
      'Toggle the "Raw" pill button in the top right of the message box to view exact untouched characters.',
      'Click "Copy" at any time to copy 100% untouched text to your clipboard for pasting into Skype, Telegram, or email.'
    ]),
    wait_time: 'Instant',
    tags: JSON.stringify(['formatting', 'markdown', 'raw', 'bold', 'verbatim', 'copy message']),
    action_label: 'View Stream',
    action_type: 'stream',
    sort_order: 12
  },
  {
    id: 'export-csv-excel',
    category: 'stream',
    category_label: 'Live Stream & Messages',
    question: 'How do I export scraped trading messages to Excel or CSV?',
    short_answer: 'Click the "Export" button on the top right of the Live Stream table to download clean CSV or JSON.',
    detailed_steps: JSON.stringify([
      'Apply any search filters or date ranges you want to include in the export.',
      'Click the "Export" button located in the table action header.',
      'Select "Download CSV" (compatible with Microsoft Excel and Google Sheets).',
      'The CSV file will include Timestamp, Group Name, Sender Phone, Sender Name, and Full Message Text.'
    ]),
    wait_time: '2 – 5 Seconds',
    tags: JSON.stringify(['export', 'csv', 'excel', 'download', 'backup', 'reports']),
    action_label: 'Export Data',
    action_type: 'stream',
    sort_order: 13
  },

  // 3. MULTI-DESK WORKSPACES
  {
    id: 'what-is-a-desk',
    category: 'desks',
    category_label: 'Multi-Desk Workspaces',
    question: 'What is a "Desk" and why should I use multiple desks?',
    short_answer: 'A Desk is an isolated workspace with its own dedicated WhatsApp connection and independent database.',
    detailed_steps: JSON.stringify([
      'Desks allow you to segment different business operations (e.g. "Voice Trading", "SMS Gateway", "Sales Desk").',
      'Each desk runs in total physical isolation: its SQLite database and session files are completely separate.',
      'Messages from your Voice desk will never mix with messages from your SMS or Sales desks.',
      'You can switch desks seamlessly from the top navigation bar without logging out.'
    ]),
    wait_time: 'Instant Switching (1s)',
    tags: JSON.stringify(['multi-desk', 'desk', 'workspace', 'data isolation', 'separation', 'accounts', 'login']),
    action_label: 'Terminal Settings',
    action_type: 'settings',
    sort_order: 14
  },
  {
    id: 'create-new-desk',
    category: 'desks',
    category_label: 'Multi-Desk Workspaces',
    question: 'How do I create a new Desk?',
    short_answer: 'Click your active Desk pill in the top header and select "+ Create New Desk...".',
    detailed_steps: JSON.stringify([
      'Click the active Desk button in the top navigation bar (e.g. "Main Trading Desk").',
      'In the dropdown menu, click "+ Create New Desk...".',
      'Give your desk a name (e.g. "Carrier Desk 2") and optional custom identifier.',
      'Click "Create & Switch". In 2–3 seconds, your new independent workspace is ready.',
      'Open the device modal to link a separate WhatsApp number to this new desk.'
    ]),
    wait_time: '2 – 3 Seconds',
    tags: JSON.stringify(['new desk', 'add desk', 'create desk', 'multiple accounts', 'setup', 'new login']),
    action_label: 'View Desks',
    action_type: 'settings',
    sort_order: 15
  },

  // 5. WHOLESALE RATES & MARKET INTELLIGENCE
  {
    id: 'route-extraction',
    category: 'wholesale',
    category_label: 'Wholesale Rates & Intelligence',
    question: 'How does the terminal identify Buying vs Selling routes?',
    short_answer: 'The terminal parses keyword indicators like "Buying / Need / Looking for" vs "Selling / Offer / Push".',
    detailed_steps: JSON.stringify([
      'Navigate to "Market Routes" or "Carriers & Vendors" in the sidebar.',
      'The engine automatically detects wholesale buying requests (demand) versus selling proposals (supply).',
      'Extracts route destination names, dial codes, qualities (CLI, Non-CLI, CC), and rates in USD/EUR.',
      'Click any route card to view all historical messages quoting that specific destination.'
    ]),
    wait_time: 'Real-Time Ingestion',
    tags: JSON.stringify(['routes', 'buying', 'selling', 'rates', 'cli', 'non-cli', 'wholesale']),
    action_label: 'View Routes',
    action_type: 'routes',
    sort_order: 16
  },
  {
    id: 'vendor-profiles',
    category: 'wholesale',
    category_label: 'Wholesale Rates & Intelligence',
    question: 'How do I find carriers or vendors trading a specific route?',
    short_answer: 'Open "Carriers & Vendors" to see ranked carrier profiles, message activity, and direct chat links.',
    detailed_steps: JSON.stringify([
      'Click "Carriers & Vendors" in the sidebar.',
      'Search for a vendor by company name, phone number, or target destination.',
      'Review their historical rate posts, consistency, and trading groups.',
      'Click the "Chat on WhatsApp" button to open a direct bilateral conversation on your phone.'
    ]),
    wait_time: 'Instant',
    tags: JSON.stringify(['carriers', 'vendors', 'directory', 'traders', 'contact', 'telecom']),
    action_label: 'Carriers Directory',
    action_type: 'routes',
    sort_order: 17
  },

  // 6. TROUBLESHOOTING & SYSTEM HEALTH
  {
    id: 'whatsapp-ban-safety',
    category: 'troubleshooting',
    category_label: 'Troubleshooting & FAQ',
    question: 'Will using this terminal ban or suspend my WhatsApp account?',
    short_answer: 'No. Telcia operates as a passive companion device with zero unsolicited outbound spam messaging.',
    detailed_steps: JSON.stringify([
      'WhatsApp bans accounts that blast hundreds of cold messages to unknown numbers.',
      'Telcia is a read-only scraper that captures inbound group broadcasts and messages you are already receiving.',
      'It connects through standard official Multi-Device protocols as an authorized companion.',
      'The only message Telcia sends is your own 6-digit security code to your own phone when you ask for it.'
    ]),
    wait_time: 'Safe & Compliant',
    tags: JSON.stringify(['ban', 'suspension', 'safety', 'companion mode', 'account risk']),
    action_label: 'System Pipeline',
    action_type: 'settings',
    sort_order: 18
  },
  {
    id: 'storage-cleanup-retention',
    category: 'troubleshooting',
    category_label: 'Troubleshooting & FAQ',
    question: 'How do I free up server disk space or prune old messages?',
    short_answer: 'Go to Settings → Storage & Retention card → Adjust retention days or click "Prune Old Messages".',
    detailed_steps: JSON.stringify([
      'Click "Settings & Config" in the sidebar.',
      'Look at the "Storage Retention & Pruning" section.',
      'You can set automatic message retention (default is 180 days). Messages older than this period auto-expire.',
      'To instantly free up space, click "Prune by 10%" or select a custom retention cutoff.',
      'The SQLite database runs in Write-Ahead Log (WAL) mode for maximum performance.'
    ]),
    wait_time: '5 – 15 Seconds',
    tags: JSON.stringify(['disk space', 'prune', 'retention', 'storage', 'cleanup', 'vacuum']),
    action_label: 'Storage Settings',
    action_type: 'settings',
    sort_order: 19
  },
  {
    id: 'ai-rag-how-to-enable',
    category: 'troubleshooting',
    category_label: 'Troubleshooting & FAQ',
    question: 'How do I enable AI-powered answers in this Help Center?',
    short_answer: 'Add an API key in AI Settings (DeepSeek, OpenAI, Grok, or local Ollama).',
    detailed_steps: JSON.stringify([
      'Click the AI Settings button (or Robot icon) in the top header or in Settings.',
      'Choose your preferred AI provider (DeepSeek is highly cost-effective, or OpenAI / Grok).',
      'Paste your API key and click "Test Connection".',
      'Once verified, click "Save Configuration".',
      'The Help Center will instantly upgrade from standard search to conversational AI RAG assistance!'
    ]),
    wait_time: '1 Minute Setup',
    tags: JSON.stringify(['ai', 'rag', 'deepseek', 'openai', 'grok', 'api key', 'ai assistant']),
    action_label: 'Configure AI Key',
    action_type: 'ai-settings',
    sort_order: 20
  },
  {
    id: 'messages-not-appearing',
    category: 'troubleshooting',
    category_label: 'Troubleshooting & FAQ',
    question: 'My status is Green but messages are not appearing. What should I check?',
    short_answer: 'Check if you have active filters applied or if initial history sync is still in progress.',
    detailed_steps: JSON.stringify([
      '1. Check Filters: Clear any search text or date ranges in the Live Stream table header.',
      '2. Check Initial Sync: If you just paired your phone within the last 5 minutes, wait for the background group sync to finish.',
      '3. Verify Direct Messages: If expecting 1-on-1 private messages, verify that "Record Direct Messages (DMs)" is toggled ON in Settings.',
      '4. Check Group Membership: Ensure the linked phone is actually a member of the WhatsApp groups broadcasting rates.'
    ]),
    wait_time: '1 – 2 Minutes Check',
    tags: JSON.stringify(['missing messages', 'no messages', 'sync delay', 'filter', 'troubleshoot']),
    action_label: 'Check Settings',
    action_type: 'settings',
    sort_order: 21
  }
];

/**
 * Ensures knowledge_base table exists and syncs seed records
 */
export function ensureKnowledgeBase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_base (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      category_label TEXT NOT NULL,
      question TEXT NOT NULL,
      short_answer TEXT NOT NULL,
      detailed_steps TEXT NOT NULL,
      wait_time TEXT,
      tags TEXT NOT NULL,
      action_label TEXT,
      action_type TEXT,
      sort_order INTEGER DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base (category);
    CREATE INDEX IF NOT EXISTS idx_kb_order ON knowledge_base (sort_order ASC);
  `);

  console.log('🌱 [Database] Syncing Knowledge Base articles into SQLite...');
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO knowledge_base 
    (id, category, category_label, question, short_answer, detailed_steps, wait_time, tags, action_label, action_type, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  for (const item of SEED_KNOWLEDGE_BASE) {
    const stepsStr = typeof item.detailed_steps === 'string' ? item.detailed_steps : JSON.stringify(item.detailed_steps);
    const tagsStr = typeof item.tags === 'string' ? item.tags : JSON.stringify(item.tags);
    insertStmt.run(
      item.id,
      item.category,
      item.category_label,
      item.question,
      item.short_answer,
      stepsStr,
      item.wait_time || null,
      tagsStr,
      item.action_label || null,
      item.action_type || null,
      item.sort_order || 0,
      now
    );
  }
  console.log(`✅ [Database] Seeded & updated ${SEED_KNOWLEDGE_BASE.length} Knowledge Base articles.`);
}
