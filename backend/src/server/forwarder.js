/**
 * Client Webhook Dispatcher (n8n Forwarding)
 */
const { FORWARD_WEBHOOK_URL, FORWARD_FORMAT } = require('./config');
const { recentMessages, saveMessagesToDisk } = require('./store');

function buildCleanPayload(record) {
  const host = process.env.PUBLIC_URL || 'https://telcia.bijoytel.network';
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

module.exports = {
  buildCleanPayload,
  forwardWebhookToClient
};
