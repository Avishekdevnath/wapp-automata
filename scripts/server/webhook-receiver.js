/**
 * Incoming Webhook Processing & HMAC-SHA256 Signature Verification
 */
const crypto = require('crypto');
const { SECRET, FORWARD_WEBHOOK_URL, formatDateTime } = require('./config');
const { recentMessages, stats, saveMessagesToDisk } = require('./store');
const { processTelecomIntelligence } = require('./telecom-ingest');
const { downloadMediaInBackground } = require('./media');
const { forwardWebhookToClient } = require('./forwarder');

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

  // Discard internal protocol handshake notifications or contentless messages
  if ((!text || text.trim() === '') && !hasMedia) {
    return;
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

module.exports = {
  verifySignature,
  processWebhookDelivery
};
