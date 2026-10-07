/**
 * Server Configuration & Environment Variables
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Zero-dependency .env loader
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const HOST = process.env.HOST || '0.0.0.0';
const SECRET = process.env.WEBHOOK_SECRET || 'local_dev_webhook_secret_key_12345';
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'wapp2026';
const FORWARD_WEBHOOK_URL = process.env.FORWARD_WEBHOOK_URL || '';
const FORWARD_FORMAT = process.env.FORWARD_FORMAT || 'clean';
const MAX_HISTORY_MESSAGES = process.env.MAX_HISTORY_MESSAGES ? parseInt(process.env.MAX_HISTORY_MESSAGES, 10) : 10000;

const DATA_DIR = fs.existsSync('/opt/wapp-automata/data') 
  ? '/opt/wapp-automata/data' 
  : (fs.existsSync(path.join(__dirname, '..', '..', 'data')) ? path.join(__dirname, '..', '..', 'data') : './data');

const SESSION_PATH = process.env.SESSION_DATA_PATH || 
  (fs.existsSync('/opt/wapp-automata/data/.session') ? '/opt/wapp-automata/data/.session' : './.session');

const HISTORY_FILE = path.join(DATA_DIR, 'dashboard_history.json');
const SQLITE_FILE = process.env.SQLITE_DB_PATH || path.join(DATA_DIR, 'collector.sqlite');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'frontend', 'dist');
const MEDIA_DIR = path.join(DATA_DIR, 'media');




if (!fs.existsSync(MEDIA_DIR)) {
  try { fs.mkdirSync(MEDIA_DIR, { recursive: true }); } catch {}
}

function computeSignature(payloadString) {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(payloadString).digest('hex');
}

function formatDateTime(d) {
  const date = d ? new Date(d) : new Date();
  if (isNaN(date.getTime())) return String(d || '');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) + ' ' + date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

function setDashboardPassword(newPassword) {
  process.env.DASHBOARD_PASSWORD = newPassword;
  module.exports.DASHBOARD_PASSWORD = newPassword;
  try {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (/^DASHBOARD_PASSWORD=/m.test(content)) {
        content = content.replace(/^DASHBOARD_PASSWORD=.*$/m, `DASHBOARD_PASSWORD=${newPassword}`);
      } else {
        content += `\nDASHBOARD_PASSWORD=${newPassword}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
  } catch (err) {
    console.error('Failed to persist DASHBOARD_PASSWORD to .env:', err.message);
  }
}

module.exports = {
  PORT,
  HOST,
  SECRET,
  DASHBOARD_PASSWORD,
  setDashboardPassword,
  FORWARD_WEBHOOK_URL,
  FORWARD_FORMAT,
  DATA_DIR,
  SESSION_PATH,
  HISTORY_FILE,
  SQLITE_FILE,
  PUBLIC_DIR,
  MEDIA_DIR,
  MAX_HISTORY_MESSAGES,
  computeSignature,
  formatDateTime
};
