/**
 * Durable SQLite AI Processing Task Queue
 * Provides zero-loss persistence, steady-state rate limiting,
 * SHA-256 deduplication, and automatic exponential backoff retry.
 */
const crypto = require('crypto');
const { getTradingDb, saveParsedTelecom } = require('./db');
const { extractTelecomWithAI, parseTelecomMessage, COUNTRY_MAP } = require('../telecom-parser');

function sendPipelineEvent(evt) {
  try {
    const { recordPipelineEvent } = require('./pipeline-api');
    if (typeof recordPipelineEvent === 'function') recordPipelineEvent(evt);
  } catch (_) {}
}

const CONCURRENCY_LIMIT = 2;
const POLL_INTERVAL_MS = 300;
const DEDUP_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours

let activeWorkers = 0;
let queueTimer = null;

function hashContent(text) {
  const normalized = (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Fast zero-latency pre-classifier to filter non-telecom chat chatter
 */
function isLikelyTelecomMessage(rawText) {
  if (!rawText || typeof rawText !== 'string') return false;
  const text = rawText.trim();
  if (text.length < 5) return false;

  const telecomRegex = /\b(cli|non-cli|cc|ivr|did|ani|pulse|rate|traffic|route|routes|gateway|carrier|telecom|voip|dialer|ports?|fas|asr|acd|wtb|wts|need|looking for|buying|selling|urgent|outage|fiber cut|maintenance|regulation)\b/i;
  if (telecomRegex.test(text)) return true;

  // Check if any recognized country flag or country name is present (with word boundaries to avoid 'us' matching 'USA')
  for (const c of COUNTRY_MAP) {
    for (const f of c.flags) {
      if (f.length <= 2) {
        if (new RegExp('(^|[^a-zA-Z0-9])' + f + '([^a-zA-Z0-9]|$)', '').test(text)) return true;
      } else {
        if (new RegExp('(^|[^a-zA-Z0-9])' + f + '([^a-zA-Z0-9]|$)', 'i').test(text)) return true;
      }
    }
  }
  return false;
}

/**
 * Atomically enqueues a message into the SQLite durable task queue
 */
function enqueueAiTask(record, priority = 1) {
  const db = getTradingDb();
  if (!db || !record || !record.text) return null;

  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const contentHash = hashContent(record.text);
  const now = Date.now();

  try {
    db.prepare(`
      INSERT INTO ai_tasks (
        id, message_id, sender_name, sender_phone, chat_name, chat_type,
        raw_text, content_hash, priority, status, retry_count, next_retry_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?, ?)
    `).run(
      taskId,
      record.id || `msg_${now}`,
      record.sender_name || 'Contact',
      record.sender_phone || '',
      record.chat_name || '',
      record.chat_type || 'direct',
      record.text,
      contentHash,
      priority,
      now,
      now
    );

    // Kick the queue worker to immediately check for pending jobs
    kickQueueWorker();
    return taskId;
  } catch (err) {
    console.error('[AI Queue] Failed to enqueue task:', err.message);
    return null;
  }
}

/**
 * Retrieves aggregate queue health and depth counters
 */
function getQueueStats() {
  const db = getTradingDb();
  if (!db) return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };

  try {
    const rows = db.prepare(`
      SELECT status, COUNT(*) as c FROM ai_tasks GROUP BY status
    `).all();

    const stats = { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
    for (const r of rows) {
      if (r.status === 'pending') stats.pending = r.c;
      else if (r.status === 'processing') stats.processing = r.c;
      else if (r.status === 'completed') stats.completed = r.c;
      else if (r.status === 'failed') stats.failed = r.c;
      else if (r.status.startsWith('skipped')) stats.skipped += r.c;
    }
    return stats;
  } catch (_) {
    return { pending: 0, processing: 0, completed: 0, failed: 0, skipped: 0 };
  }
}

/**
 * Worker loop to process one task with rate-limiting and deduplication
 */
async function processNextTask() {
  if (activeWorkers >= CONCURRENCY_LIMIT) return;

  const db = getTradingDb();
  if (!db) return;

  const now = Date.now();

  // Atomically select and lock the highest priority pending task whose retry timeout has elapsed
  let task = null;
  try {
    task = db.prepare(`
      SELECT * FROM ai_tasks 
      WHERE status = 'pending' AND next_retry_at <= ?
      ORDER BY priority DESC, created_at ASC 
      LIMIT 1
    `).get(now);

    if (!task) return;

    db.prepare(`
      UPDATE ai_tasks 
      SET status = 'processing', updated_at = ? 
      WHERE id = ?
    `).run(now, task.id);
  } catch (err) {
    console.warn('[AI Queue] Error claiming task:', err.message);
    return;
  }

  activeWorkers++;

  try {
    // 1. Zero-Cost Noise Check
    if (!isLikelyTelecomMessage(task.raw_text)) {
      const parsedNoise = { isTelecom: false, intent: 'WTS', company: null, vendor_name: task.sender_name, routes: [], news: null };
      db.prepare(`
        UPDATE ai_tasks 
        SET status = 'skipped_noise', latency_ms = 0, result_json = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(parsedNoise), Date.now(), task.id);

      sendPipelineEvent({
        id: task.message_id,
        sender_name: task.sender_name,
        sender_phone: task.sender_phone,
        chat_name: task.chat_name,
        chat_type: task.chat_type,
        raw_text: task.raw_text,
        latency_ms: 0,
        parsed: parsedNoise
      });
      return;
    }

    // 2. SHA-256 Deduplication Check (Last 6 hours)
    const existing = db.prepare(`
      SELECT result_json FROM ai_tasks 
      WHERE content_hash = ? AND status = 'completed' AND id != ? AND created_at >= ?
      LIMIT 1
    `).get(task.content_hash, task.id, now - DEDUP_WINDOW_MS);

    if (existing && existing.result_json) {
      let cachedParsed = null;
      try { cachedParsed = JSON.parse(existing.result_json); } catch {}
      if (cachedParsed) {
        db.prepare(`
          UPDATE ai_tasks 
          SET status = 'skipped_duplicate', latency_ms = 0, result_json = ?, updated_at = ?
          WHERE id = ?
        `).run(existing.result_json, Date.now(), task.id);

        if (cachedParsed.isTelecom) {
          saveParsedTelecom(db, cachedParsed, {
            id: task.message_id,
            sender_name: task.sender_name,
            sender_phone: task.sender_phone,
            created_at: task.created_at
          });
        }

        sendPipelineEvent({
          id: task.message_id,
          sender_name: task.sender_name,
          sender_phone: task.sender_phone,
          chat_name: task.chat_name,
          chat_type: task.chat_type,
          raw_text: task.raw_text,
          latency_ms: 0,
          parsed: cachedParsed
        });
        return;
      }
    }

    // 3. Execute AI Structured Extraction
    const start = Date.now();
    const parsed = await extractTelecomWithAI(task.raw_text, task.sender_phone, task.sender_name);
    const latencyMs = Date.now() - start;

    // Save to Market Database
    if (parsed && parsed.isTelecom) {
      saveParsedTelecom(db, parsed, {
        id: task.message_id,
        sender_name: task.sender_name,
        sender_phone: task.sender_phone,
        created_at: task.created_at
      });
    }

    // Record Telemetry Trace
    sendPipelineEvent({
      id: task.message_id,
      sender_name: task.sender_name,
      sender_phone: task.sender_phone,
      chat_name: task.chat_name,
      chat_type: task.chat_type,
      raw_text: task.raw_text,
      latency_ms: latencyMs,
      parsed
    });

    // Mark Task Completed
    db.prepare(`
      UPDATE ai_tasks 
      SET status = 'completed', latency_ms = ?, result_json = ?, updated_at = ?
      WHERE id = ?
    `).run(latencyMs, JSON.stringify(parsed), Date.now(), task.id);

  } catch (err) {
    console.error(`[AI Queue] Task ${task.id} failed:`, err.message);
    const retryCount = (task.retry_count || 0) + 1;
    if (retryCount <= 3) {
      const delayMs = Math.min(60000, 1000 * Math.pow(2, retryCount));
      db.prepare(`
        UPDATE ai_tasks 
        SET status = 'pending', retry_count = ?, next_retry_at = ?, error_message = ?, updated_at = ?
        WHERE id = ?
      `).run(retryCount, Date.now() + delayMs, err.message, Date.now(), task.id);
    } else {
      db.prepare(`
        UPDATE ai_tasks 
        SET status = 'failed', retry_count = ?, error_message = ?, updated_at = ?
        WHERE id = ?
      `).run(retryCount, err.message, Date.now(), task.id);
    }
  } finally {
    activeWorkers--;
    // Immediately attempt next task
    setImmediate(processNextTask);
  }
}

function kickQueueWorker() {
  if (activeWorkers < CONCURRENCY_LIMIT) {
    setImmediate(processNextTask);
  }
}

function startQueueWorker() {
  if (queueTimer) return;
  queueTimer = setInterval(() => {
    processNextTask();
  }, POLL_INTERVAL_MS);
  console.log('⚡ [AI Queue] Persistent SQLite background task worker started');
}

function stopQueueWorker() {
  if (queueTimer) {
    clearInterval(queueTimer);
    queueTimer = null;
  }
}

module.exports = {
  enqueueAiTask,
  getQueueStats,
  isLikelyTelecomMessage,
  startQueueWorker,
  stopQueueWorker,
  kickQueueWorker
};
