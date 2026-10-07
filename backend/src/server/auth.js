/**
 * Authentication & Persistent Session Management
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DASHBOARD_PASSWORD, SESSION_PATH } = require('./config');

function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (rc) {
    rc.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

function generateAuthToken() {
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const data = `${expiresAt}`;
  const sig = crypto.createHmac('sha256', DASHBOARD_PASSWORD).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [expiresAtStr, sig] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSig = crypto.createHmac('sha256', DASHBOARD_PASSWORD).update(expiresAtStr).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expectedSig, 'utf8'));
  } catch {
    return false;
  }
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  if (cookies.wapp_token && verifyAuthToken(cookies.wapp_token)) return true;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    return verifyAuthToken(token);
  }
  return false;
}

function getSessionState() {
  try {
    const stateFile = path.join(SESSION_PATH, 'session_state.json');
    if (fs.existsSync(stateFile)) {
      const content = fs.readFileSync(stateFile, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed.status === 'authenticated' && parsed.accountJid) {
        const rawId = parsed.accountJid.split('@')[0].split(':')[0];
        parsed.phone = '+' + rawId;
      }
      return parsed;
    }

    const credsFile = path.join(SESSION_PATH, 'creds.json');
    if (fs.existsSync(credsFile)) {
      const content = fs.readFileSync(credsFile, 'utf8');
      const creds = JSON.parse(content);
      if (creds && creds.me && creds.me.id) {
        const rawId = creds.me.id.split('@')[0].split(':')[0];
        return {
          status: 'authenticated',
          accountJid: creds.me.id,
          phone: '+' + rawId,
          name: creds.me.name || 'WhatsApp Account',
          updatedAt: Date.now()
        };
      }
    }
  } catch (err) {}

  return {
    status: 'disconnected',
    phone: null,
    name: null,
    qr: null,
    updatedAt: Date.now()
  };
}

module.exports = {
  parseCookies,
  generateAuthToken,
  verifyAuthToken,
  isAuthenticated,
  getSessionState
};
