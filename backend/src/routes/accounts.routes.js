import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import {
  listAccounts,
  getActiveAccountId,
  setActiveAccountId,
  ensureAccountDirs,
  getAccountPaths
} from '../storage/account.js';
import { getDb, closeDb } from '../storage/db.js';
import {
  getStatus,
  disconnectWhatsApp,
  connectWhatsApp,
  logoutWhatsApp
} from '../collector/whatsapp.js';
import { broadcastSse } from '../sse.js';
import { getConfiguredPasswords } from './auth.routes.js';

export const accountsRouter = Router();

// 1. List All Desks/Accounts
accountsRouter.get(['/', '/accounts'], (req, res) => {
  res.json({ accounts: listAccounts(), activeAccountId: getActiveAccountId() });
});

// 1.1 Fleet Status for Workspace Monitoring
accountsRouter.get(['/fleet', '/admin/fleet', '/admin/desks'], (req, res) => {
  const currentId = getActiveAccountId();
  const status = getStatus();
  const phone = status.user?.phone || (status.user?.id ? ('+' + status.user.id.split('@')[0].split(':')[0]) : null);
  const scopedFleet = [{
    accountId: currentId,
    status: status.status === 'connected' ? 'authenticated' : (status.status || 'disconnected'),
    phone,
    name: status.user?.name || `Desk ${currentId.toUpperCase()}`
  }];
  res.json({ status: 'ok', fleet: scopedFleet });
});

// 1.2 Restart Desk Companion Socket
accountsRouter.post(['/restart', '/admin/desks/restart', '/desks/restart'], async (req, res) => {
  try {
    const { restartWhatsApp } = await import('../collector/whatsapp.js');
    await restartWhatsApp();
    res.json({ success: true, message: 'Desk socket restarted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Create a New Trading Desk
accountsRouter.post(['/create', '/admin/desks'], (req, res) => {
  const { accountId, name } = req.body || {};
  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }
  const cleanId = accountId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const paths = ensureAccountDirs(cleanId);
  fs.writeFileSync(paths.accountJsonPath, JSON.stringify({
    id: cleanId,
    name: name || `Desk ${cleanId.toUpperCase()}`,
    createdAt: Date.now()
  }, null, 2));
  getDb(cleanId); // Initializes schema and sqlite file for the new desk
  res.json({ success: true, account: { id: cleanId, name: name || cleanId, isDefault: false } });
});

// 3. Switch Active Desk
accountsRouter.post('/switch', async (req, res) => {
  const { accountId, force } = req.body || {};
  if (!accountId) {
    return res.status(400).json({ error: 'accountId is required' });
  }

  const status = getStatus();
  if ((status.connected || status.status === 'authenticated') && !force) {
    return res.status(400).json({
      error: 'A WhatsApp session is currently connected. You must log out of the active WhatsApp account before switching desks.'
    });
  }

  try {
    console.log(`[Account] Switching from [${getActiveAccountId()}] to [${accountId}]...`);
    await disconnectWhatsApp();
    setActiveAccountId(accountId);
    getDb(accountId); // Initializes DB connection and schemas
    broadcastSse('account_switched', { accountId });
    // Reconnect socket for new account
    connectWhatsApp().catch(e => console.warn('[WhatsApp] Auto-connect error on switch:', e.message));
    res.json({ success: true, activeAccountId: accountId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Full Factory Reset for Active Account
accountsRouter.post(['/reset', '/wipe', '/account/wipe', '/account/reset', '/accounts/wipe', '/accounts/reset'], async (req, res) => {
  try {
    const currentId = getActiveAccountId();
    console.log(`⚠️ [Account] Full factory reset requested for [${currentId}]...`);

    // Preserve current terminal password across wipe
    let preservedPassword = null;
    try {
      const row = getDb(currentId).prepare("SELECT value FROM system_settings WHERE key = 'terminal_password'").get();
      if (row && row.value) preservedPassword = row.value;
    } catch (_) {}

    await logoutWhatsApp();
    closeDb();

    const paths = getAccountPaths(currentId);
    // Delete SQLite database files
    const sqliteFiles = [paths.dbPath, `${paths.dbPath}-wal`, `${paths.dbPath}-shm`];
    for (const file of sqliteFiles) {
      if (fs.existsSync(file)) {
        try { fs.unlinkSync(file); } catch (_) {}
      }
    }

    // Wipe session folder
    if (fs.existsSync(paths.sessionDir)) {
      try {
        fs.rmSync(paths.sessionDir, { recursive: true, force: true });
        fs.mkdirSync(paths.sessionDir, { recursive: true });
      } catch (_) {}
    }

    // Wipe downloaded media files
    const mediaDir = path.join(paths.dataDir, 'media');
    if (fs.existsSync(mediaDir)) {
      try {
        fs.rmSync(mediaDir, { recursive: true, force: true });
        fs.mkdirSync(mediaDir, { recursive: true });
      } catch (_) {}
    }

    // Re-initialize blank database with schemas and restore password
    const newDb = getDb(currentId);
    const envDefaults = getConfiguredPasswords();
    const targetPassword = preservedPassword || envDefaults[0] || null;
    if (targetPassword) {
      try {
        newDb.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('terminal_password', ?)").run(targetPassword);
      } catch (_) {}
    }

    broadcastSse('account_reset', { accountId: currentId });
    broadcastSse('cleared', { count: 0 });

    // Re-connect WhatsApp with fresh pairing QR code
    connectWhatsApp().catch(e => console.warn('[WhatsApp] Auto-connect error on reset:', e.message));

    res.json({ success: true, message: `Account [${currentId}] session and all data fully wiped from scratch.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
