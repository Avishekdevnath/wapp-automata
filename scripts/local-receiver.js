/**
 * Lightweight Local Webhook Receiver for Testing
 * Listens on http://127.0.0.1:4000/webhook and verifies incoming collector payloads.
 * Includes a live visual browser dashboard at http://127.0.0.1:4000/
 */
const http = require('http');
const crypto = require('crypto');

const PORT = 4000;
const SECRET = process.env.WEBHOOK_SECRET || 'local_dev_webhook_secret_key_12345';
const recentMessages = [];

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

function renderHtmlPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>wapp-automata Webhook Monitor</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
    .container { max-width: 900px; margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #334155; }
    h1 { font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; background: #064e3b; color: #34d399; padding: 4px 10px; border-radius: 9999px; font-size: 13px; font-weight: 500; }
    .status-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; }
    .stats-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; gap: 32px; font-size: 14px; }
    .stat-item span { display: block; color: #94a3b8; font-size: 12px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .stat-item strong { font-size: 18px; color: #fff; }
    .messages-container { display: flex; flex-direction: column; gap: 12px; }
    .msg-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .msg-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; }
    .sender-name { font-weight: 600; color: #38bdf8; }
    .chat-info { color: #94a3b8; margin-left: 6px; }
    .msg-time { color: #64748b; font-size: 12px; }
    .msg-text { background: #0f172a; padding: 12px; border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #e2e8f0; white-space: pre-wrap; word-break: break-word; }
    .badge-hmac { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 500; }
    .badge-hmac.valid { background: #064e3b; color: #34d399; }
    .badge-hmac.invalid { background: #7f1d1d; color: #f87171; }
    .empty-state { text-align: center; padding: 48px 16px; color: #64748b; font-size: 14px; background: #1e293b; border-radius: 8px; border: 1px dashed #334155; }
    .refresh-hint { text-align: center; color: #64748b; font-size: 12px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>📱 wapp-automata Webhook Monitor</h1>
      <span class="status-badge"><span class="status-dot"></span> Listening on :4000</span>
    </header>

    <div class="stats-card">
      <div class="stat-item">
        <span>Webhook URL</span>
        <strong>http://127.0.0.1:4000/webhook</strong>
      </div>
      <div class="stat-item">
        <span>Messages Received</span>
        <strong id="msg-count">${recentMessages.length}</strong>
      </div>
      <div class="stat-item">
        <span>HMAC Verification</span>
        <strong style="color: #34d399;">SHA-256 Active</strong>
      </div>
    </div>

    <div class="messages-container" id="messages-list">
      ${recentMessages.length === 0 ? `
        <div class="empty-state">
          Waiting for incoming WhatsApp messages...<br>
          <small style="color: #475569; margin-top: 8px; display: block;">Send a message from or to your linked WhatsApp account.</small>
        </div>
      ` : recentMessages.map(m => `
        <div class="msg-card">
          <div class="msg-header">
            <div>
              <span class="sender-name">${escapeHtml(m.sender)}</span>
              <span class="chat-info">in ${escapeHtml(m.chat)}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span class="badge-hmac ${m.isValid ? 'valid' : 'invalid'}">${m.isValid ? 'HMAC VALID' : 'HMAC INVALID'}</span>
              <span class="msg-time">${m.timestamp}</span>
            </div>
          </div>
          <div class="msg-text">${escapeHtml(m.text || '(empty/media message)')}</div>
        </div>
      `).join('')}
    </div>

    <p class="refresh-hint">Auto-refreshes every 2 seconds</p>
  </div>

  <script>
    setInterval(async () => {
      try {
        const res = await fetch('/api/messages');
        const data = await res.json();
        document.getElementById('msg-count').innerText = data.length;
        if (data.length > 0) {
          const list = document.getElementById('messages-list');
          list.innerHTML = data.map(m => \`
            <div class="msg-card">
              <div class="msg-header">
                <div>
                  <span class="sender-name">\${escapeHtml(m.sender)}</span>
                  <span class="chat-info">in \${escapeHtml(m.chat)}</span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <span class="badge-hmac \${m.isValid ? 'valid' : 'invalid'}">\${m.isValid ? 'HMAC VALID' : 'HMAC INVALID'}</span>
                  <span class="msg-time">\${m.timestamp}</span>
                </div>
              </div>
              <div class="msg-text">\${escapeHtml(m.text || '(empty/media message)')}</div>
            </div>
          \`).join('');
        }
      } catch (e) {}
    }, 2000);

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const server = http.createServer((req, res) => {
  // 1. Browser dashboard route (GET / or GET /webhook)
  if (req.method === 'GET') {
    if (req.url === '/api/messages') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(recentMessages));
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(renderHtmlPage());
  }

  // 2. Webhook delivery route (POST /webhook or POST /)
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const signature = req.headers['x-collector-signature'];
      const event = req.headers['x-collector-event'];
      const deliveryId = req.headers['x-collector-delivery-id'];
      const timestamp = req.headers['x-collector-timestamp'];

      const isValidSig = verifySignature(body, signature);

      let msgData = {
        message_id: 'unknown',
        sender: 'Unknown',
        chat: 'Unknown',
        text: '',
        has_media: false
      };

      try {
        const parsed = JSON.parse(body);
        if (parsed.message) {
          msgData = {
            message_id: parsed.message.message_id,
            sender: parsed.message.sender_name || parsed.message.sender_id,
            chat: parsed.message.chat_name || parsed.message.chat_id,
            text: parsed.message.text,
            has_media: parsed.message.has_media
          };
        }
      } catch {
        msgData.text = body;
      }

      recentMessages.unshift({
        id: msgData.message_id,
        sender: msgData.sender,
        chat: msgData.chat,
        text: msgData.text,
        timestamp: new Date().toLocaleTimeString(),
        isValid: isValidSig
      });

      if (recentMessages.length > 50) {
        recentMessages.pop();
      }

      console.log('\n============================================================');
      console.log(`📥 Incoming Webhook [${new Date().toISOString()}]`);
      console.log('------------------------------------------------------------');
      console.log(`Event:       ${event}`);
      console.log(`Delivery ID: ${deliveryId}`);
      console.log(`Timestamp:   ${timestamp}`);
      console.log(`HMAC Valid:  ${isValidSig ? '✅ YES' : '❌ NO (Secret mismatch)'}`);
      console.log(`Message ID:  ${msgData.message_id}`);
      console.log(`Sender:      ${msgData.sender}`);
      console.log(`Chat:        ${msgData.chat}`);
      console.log(`Text:        ${msgData.text}`);
      console.log('============================================================\n');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', received_at: Date.now() }));
    });
    return;
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Local Webhook Receiver running at: http://127.0.0.1:${PORT}/webhook`);
  console.log(`📊 Live Web Dashboard available at:  http://127.0.0.1:${PORT}/`);
  console.log(`🔑 Listening with WEBHOOK_SECRET:    "${SECRET}"`);
  console.log('Ready to receive incoming messages from wapp-automata.\n');
});
