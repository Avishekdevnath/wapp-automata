/**
 * Lightweight Local Webhook Receiver for Testing
 * Listens on http://127.0.0.1:4000/webhook and verifies incoming collector payloads.
 */
const http = require('http');
const crypto = require('crypto');

const PORT = 4000;
const SECRET = process.env.WEBHOOK_SECRET || 'local_dev_webhook_secret_key_12345';

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

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const signature = req.headers['x-collector-signature'];
    const event = req.headers['x-collector-event'];
    const deliveryId = req.headers['x-collector-delivery-id'];
    const timestamp = req.headers['x-collector-timestamp'];

    const isValidSig = verifySignature(body, signature);

    console.log('\n============================================================');
    console.log(`📥 Incoming Webhook [${new Date().toISOString()}]`);
    console.log('------------------------------------------------------------');
    console.log(`Event:       ${event}`);
    console.log(`Delivery ID: ${deliveryId}`);
    console.log(`Timestamp:   ${timestamp}`);
    console.log(`Signature:   ${signature}`);
    console.log(`HMAC Valid:  ${isValidSig ? '✅ YES' : '❌ NO (Secret mismatch)'}`);

    try {
      const parsed = JSON.parse(body);
      const msg = parsed.message;
      console.log('------------------------------------------------------------');
      console.log(`Message ID:  ${msg.message_id}`);
      console.log(`Sender:      ${msg.sender_name || msg.sender_id}`);
      console.log(`Chat:        ${msg.chat_name || msg.chat_id} (${msg.chat_type})`);
      console.log(`Has Media:   ${msg.has_media}`);
      console.log(`Text:        ${msg.text}`);
      console.log('============================================================\n');
    } catch {
      console.log('Raw Body:', body);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', received_at: Date.now() }));
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 Local Webhook Receiver running at: http://127.0.0.1:${PORT}/webhook`);
  console.log(`🔑 Listening with WEBHOOK_SECRET: "${SECRET}"`);
  console.log('Ready to receive incoming messages from wapp-automata.\n');
});
