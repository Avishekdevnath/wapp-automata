import { Router } from 'express';
import { getDb } from '../storage/db.js';
import { getStatus, sendSelfNotification } from '../collector/whatsapp.js';

export const authRouter = Router();

// In-memory OTP state for password recovery
const passwordResetState = {
  code: null,
  expiresAt: 0,
  attempts: 0,
  lastRequestedAt: 0
};

export function maskPhoneNumber(phone) {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9]/g, '');
  if (clean.length < 8) return phone;
  const start = clean.slice(0, 5);
  const end = clean.slice(-3);
  return `+${start} •••• ${end}`;
}

export function getConfiguredPasswords() {
  const envList = [
    process.env.DASHBOARD_PASSWORDS,
    process.env.DASHBOARD_PASSWORD,
    process.env.TERMINAL_PASSWORD
  ]
    .filter(Boolean)
    .flatMap(s => s.split(','))
    .map(p => p.trim())
    .filter(Boolean);

  return envList.length > 0 ? Array.from(new Set(envList)) : [];
}

// 1. Terminal Login
authRouter.post('/login', (req, res) => {
  const { password } = req.body || {};
  const db = getDb();
  let stored = null;
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'terminal_password'").get();
    if (row && row.value) stored = row.value;
  } catch (_) {}

  const validPasswords = getConfiguredPasswords();
  if (stored && !validPasswords.includes(stored)) {
    validPasswords.unshift(stored);
  }

  if (validPasswords.length === 0) {
    return res.status(500).json({ success: false, error: 'Terminal password not configured. Please contact administrator.' });
  }

  if (!password || !validPasswords.includes(password)) {
    return res.status(401).json({ success: false, error: 'Invalid password. Please check your credentials.' });
  }

  res.json({ success: true, token: 'telcia_auth_token_' + Date.now() });
});

// 2. OTP Status
authRouter.get('/otp-status', (req, res) => {
  const status = getStatus();
  const isConnected = Boolean(status.connected);
  const cooldownRemaining = Math.max(0, Math.ceil((passwordResetState.lastRequestedAt + 60000 - Date.now()) / 1000));

  res.json({
    connected: isConnected,
    phone: isConnected ? maskPhoneNumber(status.phone) : null,
    cooldownSeconds: cooldownRemaining,
    hasActiveCode: Boolean(passwordResetState.code && Date.now() < passwordResetState.expiresAt)
  });
});

// 3. Request OTP via WhatsApp
authRouter.post('/request-otp', async (req, res) => {
  const status = getStatus();
  if (!status.connected) {
    return res.status(400).json({ error: 'WhatsApp Companion is currently disconnected. Cannot deliver OTP message.' });
  }

  const now = Date.now();
  if (now - passwordResetState.lastRequestedAt < 60000) {
    const remaining = Math.ceil((60000 - (now - passwordResetState.lastRequestedAt)) / 1000);
    return res.status(429).json({ error: `Please wait ${remaining}s before requesting a new code.` });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  passwordResetState.code = code;
  passwordResetState.expiresAt = now + (5 * 60 * 1000); // 5 minutes
  passwordResetState.attempts = 0;
  passwordResetState.lastRequestedAt = now;

  const notificationText = `🔐 *Telcia Terminal Security Alert*\n\nYour 6-digit password reset verification code is:\n\n*${code}*\n\n⏱️ This code will expire in 5 minutes.\nIf you did not request this password reset, please ignore this alert.`;

  try {
    await sendSelfNotification(notificationText);
    res.json({
      success: true,
      message: 'Verification code sent directly to your linked WhatsApp device.',
      phone: maskPhoneNumber(status.phone)
    });
  } catch (err) {
    passwordResetState.code = null;
    res.status(500).json({ error: `Failed to deliver WhatsApp message: ${err.message}` });
  }
});

// 4. Verify OTP & Reset Password
authRouter.post('/verify-otp', (req, res) => {
  const { code, newPassword } = req.body || {};
  if (!code || !newPassword) {
    return res.status(400).json({ error: 'Both verification code and new password are required.' });
  }

  const now = Date.now();
  if (!passwordResetState.code || now > passwordResetState.expiresAt) {
    return res.status(400).json({ error: 'Verification code has expired. Please request a fresh code.' });
  }

  passwordResetState.attempts += 1;
  if (passwordResetState.attempts > 5) {
    passwordResetState.code = null;
    return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new code.' });
  }

  if (passwordResetState.code !== String(code).trim()) {
    const remaining = 5 - passwordResetState.attempts;
    return res.status(400).json({ error: `Invalid verification code. ${remaining} attempt(s) remaining.` });
  }

  // Code verified! Store new password in SQLite
  try {
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('terminal_password', ?)").run(newPassword.trim());
    passwordResetState.code = null;
    passwordResetState.expiresAt = 0;

    const token = 'telcia_auth_token_' + Date.now();
    res.json({
      success: true,
      message: 'Password reset successfully! Logging you in...',
      token
    });
  } catch (err) {
    res.status(500).json({ error: `Database error: ${err.message}` });
  }
});
