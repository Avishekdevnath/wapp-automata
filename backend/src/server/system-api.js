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
const { getTradingDb, pruneRawPayloads, isDmRecordingEnabled, setDmRecordingEnabled } = require('./db');

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

  if (req.method === 'POST' && pathname === '/api/session/refresh') {
    try {
      const refreshReqFile = path.join(SESSION_PATH, 'refresh_request.json');
      fs.writeFileSync(refreshReqFile, JSON.stringify({ timestamp: Date.now() }), 'utf8');
    } catch (_) {}

    // Give a brief window for file update
    await new Promise(r => setTimeout(r, 400));

    const state = getSessionState();
    if (state && state.qr && !state.qrDataUrl) {
      try {
        const QRCode = require('qrcode');
        state.qrDataUrl = await QRCode.toDataURL(state.qr, { margin: 2, scale: 6 });
      } catch (_) {}
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', ...state }));
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

  if (req.method === 'POST' && pathname === '/api/session/restart') {
    exec('pm2 restart wapp-automata', (err) => {
      if (err) console.error('Error restarting PM2 wapp-automata:', err);
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', message: 'WhatsApp background collector restart initiated' }));
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
    const state = getSessionState();
    const isAuth = Boolean(state && state.status === 'authenticated');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (!isAuth) {
      return res.end(JSON.stringify([]));
    }
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
    const db = getTradingDb(req);
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
        description: 'Lifetime raw text messages preserved permanently in SQLite; bulky payloads pruned after 30 days.'
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
      const db = getTradingDb(req);
      const result = pruneRawPayloads(db, days, false);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        ...result,
        message: `Retention routine complete. Pruned ${result.prunedPayloads || 0} bulky payloads (> ${days}d). Lifetime raw message text preserved permanently.`
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

  // GET /api/settings/retention
  if (req.method === 'GET' && pathname === '/api/settings/retention') {
    const db = getTradingDb(req);
    let retentionDays = 180;
    let totalMessages = 0;
    let oldestTimestamp = null;
    let newestTimestamp = null;

    if (db) {
      try {
        db.exec('CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)');
        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'retention_period_days'").get();
        if (row && row.value !== undefined) {
          retentionDays = Number(row.value);
        }
        const statsRow = db.prepare("SELECT COUNT(*) as total, MIN(message_timestamp) as oldest, MAX(message_timestamp) as newest FROM messages").get();
        if (statsRow) {
          totalMessages = statsRow.total || 0;
          oldestTimestamp = statsRow.oldest || null;
          newestTimestamp = statsRow.newest || null;
        }
      } catch (err) {
        console.warn('[Retention API] Error reading retention settings:', err.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      retentionDays,
      totalMessages,
      oldestTimestamp,
      newestTimestamp
    }));
  }

  // POST /api/settings/retention
  if (req.method === 'POST' && pathname === '/api/settings/retention') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { retentionDays } = JSON.parse(body || '{}');
        const parsedDays = Number(retentionDays);
        if (isNaN(parsedDays)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Invalid retentionDays value' }));
        }

        const db = getTradingDb(req);
        if (db) {
          db.exec('CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)');
          db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('retention_period_days', ?)").run(String(parsedDays));
          if (parsedDays > 0) {
            pruneRawPayloads(db, parsedDays, false);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'ok',
          retentionDays: parsedDays,
          message: `Retention policy updated to ${parsedDays === 0 || parsedDays === -1 ? 'Unlimited (Manual Prune Only)' : parsedDays + ' Days'}.`
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return true;
  }

  // POST /api/storage/prune-percentage
  if (req.method === 'POST' && pathname === '/api/storage/prune-percentage') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { percentage } = JSON.parse(body || '{}');
        const num = Number(percentage);
        if (isNaN(num) || num <= 0 || num > 100) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Percentage must be a number between 1 and 100' }));
        }
        const pct = num;
        const db = getTradingDb(req);
        let deletedCount = 0;
        let remainingCount = 0;

        if (db) {
          const countRow = db.prepare('SELECT COUNT(*) as c FROM messages').get();
          const total = countRow?.c || 0;

          if (total > 0) {
            if (pct >= 100) {
              const delInfo = db.prepare('DELETE FROM messages').run();
              deletedCount = delInfo.changes;
              remainingCount = 0;
              recentMessages.length = 0;
            } else {
              const toDelete = Math.max(1, Math.floor(total * (pct / 100.0)));
              const delInfo = db.prepare(`
                DELETE FROM messages 
                WHERE id IN (
                  SELECT id FROM messages 
                  ORDER BY message_timestamp ASC, created_at ASC 
                  LIMIT ?
                )
              `).run(toDelete);
              deletedCount = delInfo.changes;
              remainingCount = Math.max(0, total - deletedCount);
              
              // Resync memory feed
              if (recentMessages.length > remainingCount) {
                recentMessages.splice(0, recentMessages.length - remainingCount);
              }
            }

            saveMessagesToDisk(recentMessages);
            try { db.pragma('incremental_vacuum(100)'); } catch (_) {}
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          status: 'ok',
          percentage: pct,
          deletedCount,
          remainingCount,
          message: `Successfully trimmed oldest ${pct}% (${deletedCount} raw chat messages). 100% of routes, rates, and vendors remain permanently preserved.`
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return true;
  }

  // Settings API: Password Change
  if (req.method === 'POST' && pathname === '/api/settings/password') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { currentPassword, newPassword } = JSON.parse(body || '{}');
        const { DASHBOARD_PASSWORD, setDashboardPassword } = require('./config');
        if (!currentPassword || currentPassword !== DASHBOARD_PASSWORD) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Current password does not match' }));
        }
        if (!newPassword || newPassword.length < 4) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'New password must be at least 4 characters long' }));
        }
        setDashboardPassword(newPassword);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ok', message: 'Password updated successfully' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    });
    return true;
  }

  // Settings API: Direct Message (DM) Recording Toggle (ADR-013)
  if (req.method === 'GET' && pathname === '/api/settings/dms') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      record_direct_messages: isDmRecordingEnabled()
    }));
  }

  if (req.method === 'POST' && pathname === '/api/settings/dms') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch {}
      const enabled = Boolean(parsed.record_direct_messages);
      const success = setDmRecordingEnabled(enabled);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: success ? 'ok' : 'error',
        record_direct_messages: isDmRecordingEnabled(),
        message: enabled
          ? 'Direct Message recording enabled. (Zero-Seen Guarantee: DMs will never be marked as read).'
          : 'Direct Message recording disabled. Only group chats will be ingested.'
      }));
    });
    return true;
  }

  // Settings API: Real-Time Intelligence & Storage Stats
  if (req.method === 'GET' && pathname === '/api/settings/stats') {
    const db = getTradingDb(req);
    let routesCount = 0;
    let aiTasksCount = 0;
    let newsCount = 0;
    let vendorsCount = 0;
    if (db) {
      try {
        routesCount = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get()?.c || 0;
        aiTasksCount = db.prepare('SELECT COUNT(*) as c FROM ai_tasks').get()?.c || 0;
        newsCount = db.prepare('SELECT COUNT(*) as c FROM market_news').get()?.c || 0;
        vendorsCount = db.prepare('SELECT COUNT(*) as c FROM vendors').get()?.c || 0;
      } catch (_) {}
    }
    const storage = getStorageStats();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      counts: {
        routes: routesCount,
        aiTasks: aiTasksCount,
        news: newsCount,
        vendors: vendorsCount,
        messages: recentMessages.length
      },
      storage: {
        disk: storage.disk,
        media: storage.media
      }
    }));
  }

  // Unified Data Clearance API
  if (req.method === 'POST' && pathname === '/api/data/clear') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch {}
      const target = parsed.target || 'all';
      const db = getTradingDb(req);
      const results = {};
      if (target === 'routes' || target === 'all') {
        if (db) {
          results.routes = db.prepare('DELETE FROM route_ticks').run().changes;
          try {
            db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
            db.prepare(`INSERT OR REPLACE INTO system_settings (key, value) VALUES ('user_cleared_routes', 'true')`).run();
          } catch (_) {}
        }
      }
      if (target === 'analysis' || target === 'all') {
        if (db) results.analysis = db.prepare('DELETE FROM ai_tasks').run().changes;
        try {
          const { clearPipelineData } = require('./pipeline-api');
          clearPipelineData();
        } catch (_) {}
      }
      if (target === 'news' || target === 'all') {
        if (db) results.news = db.prepare('DELETE FROM market_news').run().changes;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok', target, deleted: results }));
    });
    return true;
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
        sender_name: 'Telcia Gateway',
        text: 'This is a test webhook verification from Telcia to n8n.',
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
