/**
 * System Management, Session, Diagnostics, Storage & Media APIs
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { SESSION_PATH, MEDIA_DIR, SQLITE_FILE, FORWARD_WEBHOOK_URL, computeSignature } = require('./config');
const { recentMessages, stats, serverStartTime, saveMessagesToDisk } = require('./store');
const { getSessionState } = require('./auth');
const { getStorageStats, purgeMediaFiles, dismissStorageWarning } = require('./media');
const { processWebhookDelivery } = require('./webhook-receiver');
const { forwardWebhookToClient } = require('./forwarder');
const { getTradingDb, pruneRawPayloads } = require('./db');

const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
  '.bin': 'application/octet-stream'
};

async function handleSystemApi(req, res, pathname, parsedUrl) {
  if (req.method === 'GET' && pathname === '/api/session/status') {
    const state = getSessionState();
    if (state && state.qr && !state.qrDataUrl) {
      try {
        const QRCode = require('qrcode');
        state.qrDataUrl = await QRCode.toDataURL(state.qr, { margin: 2, scale: 6 });
      } catch (_) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state));
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

  if (req.method === 'POST' && pathname === '/api/session/pair-code') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch {}
      const phone = parsed.phone ? String(parsed.phone).replace(/[^0-9]/g, '') : '';
      if (!phone || phone.length < 8) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', error: 'Valid phone number required' }));
      }

      try {
        const pairReqFile = path.join(SESSION_PATH, 'pair_request.json');
        fs.writeFileSync(pairReqFile, JSON.stringify({ phone }), 'utf8');

        const stateFile = path.join(SESSION_PATH, 'session_state.json');
        let code = null;
        for (let i = 0; i < 14; i++) {
          await new Promise(r => setTimeout(r, 500));
          if (fs.existsSync(stateFile)) {
            try {
              const s = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
              if (s && s.pairingCode && s.pairingPhone === phone) {
                code = s.pairingCode;
                break;
              }
            } catch {}
          }
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'ok', pairingCode: code }));
        } else {
          res.writeHead(504, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'error', error: 'Timed out waiting for WhatsApp pairing code. Ensure collector is running.' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', error: err.message }));
      }
    });
    return true;
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
    return true;
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

  if (req.method === 'POST' && (pathname === '/api/messages/purge' || pathname === '/api/clear')) {
    recentMessages.length = 0;
    saveMessagesToDisk(recentMessages);

    stats.totalReceived = 0;
    stats.validSignatures = 0;
    stats.invalidSignatures = 0;
    stats.groupsCount.clear();
    stats.sendersCount.clear();

    let purgedCount = 0;
    const db = getTradingDb();
    if (db) {
      try {
        const info = db.prepare('DELETE FROM messages').run();
        purgedCount = info.changes;
        if (parsedUrl?.query?.all === 'true' || parsedUrl?.query?.dummy === 'true') {
          db.prepare('DELETE FROM route_ticks').run();
          db.prepare('DELETE FROM vendors').run();
          db.prepare('DELETE FROM market_news').run();
          db.prepare('DELETE FROM ai_tasks').run();
        }
        try { db.pragma('incremental_vacuum(100)'); } catch (_) {}
      } catch (err) {
        console.warn('[Purge Stream] SQLite messages table wipe notice:', err.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ 
      status: 'ok', 
      cleared: true, 
      purgedCount,
      message: 'Raw WhatsApp message stream permanently wiped. All dummy data cleared.' 
    }));
  }

  if (req.method === 'GET' && pathname === '/api/storage/status') {
    const s = getStorageStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      disk: s.disk,
      media: s.media,
      autoPurgeThresholdPercent: s.autoPurgeThresholdPercent,
      autoPurgeEvictPercent: s.autoPurgeEvictPercent,
      retentionPolicy: {
        active: true,
        days: 30,
        description: 'Auto-prunes raw WhatsApp envelopes older than 30–60 days, keeping parsed routes and carrier contacts forever'
      },
      warning: s.warning
    }));
  }

  if (req.method === 'POST' && pathname === '/api/storage/retention') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch {}
      const days = Number(parsed.days) || 30;
      const db = getTradingDb();
      const result = pruneRawPayloads(db, days);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        ...result,
        message: `Retention routine complete. Pruned ${result.prunedPayloads || 0} payloads (> ${days}d), purged ${result.deletedOldMessages || 0} delivered envelopes (> ${days * 2}d). Routes & vendors intact forever.`
      }));
    });
    return true;
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
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/storage/dismiss-warning') {
    dismissStorageWarning();
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
        sender_name: 'Telco Man Gateway',
        text: 'This is a test webhook verification from Telco Man to n8n.',
        has_media: false,
        media: null,
        reply_to: null,
        raw_payload: { ping: true }
      }
    };
    const bodyStr = JSON.stringify(testPayload);
    const sig = computeSignature(bodyStr);
    const startTime = Date.now();
    fetch(FORWARD_WEBHOOK_URL, {
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
    }).then(fRes => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        statusCode: fRes.status,
        latencyMs: Date.now() - startTime,
        url: FORWARD_WEBHOOK_URL
      }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'error',
        error: err.message,
        latencyMs: Date.now() - startTime,
        url: FORWARD_WEBHOOK_URL
      }));
    });
    return true;
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
    return true;
  }

  // Media download/serving
  if (req.method === 'GET' && pathname.startsWith('/api/media/')) {
    const msgId = pathname.replace('/api/media/', '').split('?')[0].trim();
    if (!msgId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Message ID is required' }));
    }

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
        if (row && row.raw_payload) rawPayload = JSON.parse(row.raw_payload);
      } catch (err) {}
    }

    if (rawPayload && (rawPayload.message || rawPayload.key)) {
      (async () => {
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
            const m = rawPayload.message || {};
            if (m.imageMessage) ext = '.jpg';
            else if (m.videoMessage) ext = '.mp4';
            else if (m.audioMessage) ext = '.ogg';
            else if (m.documentMessage) ext = '.pdf';

            const mime = MIME_TYPES[ext] || 'application/octet-stream';
            const savePath = path.join(MEDIA_DIR, `${msgId}${ext}`);
            try { fs.writeFileSync(savePath, buffer); } catch {}

            res.writeHead(200, {
              'Content-Type': mime,
              'Cache-Control': 'public, max-age=86400',
              'Content-Length': buffer.length
            });
            return res.end(buffer);
          }
        } catch (downloadErr) {}

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

        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Media not found or expired' }));
      })();
      return true;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Media not found' }));
  }

  return false;
}

module.exports = {
  handleSystemApi
};
