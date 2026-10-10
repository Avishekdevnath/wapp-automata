import { Router } from 'express';
import { getDb } from '../storage/db.js';
import { getStats } from '../storage/storage.js';
import { getConfiguredPasswords } from './auth.routes.js';

export const settingsRouter = Router();

// 1. Storage & Collection Statistics
settingsRouter.get('/settings/stats', (req, res) => {
  try {
    const db = getDb();
    const routesRow = db.prepare('SELECT COUNT(*) as c FROM route_ticks').get();
    const newsRow = db.prepare('SELECT COUNT(*) as c FROM market_news').get();
    const vendorsRow = db.prepare('SELECT COUNT(*) as c FROM vendors').get();
    res.json({
      counts: {
        routes: routesRow ? routesRow.c : 0,
        aiTasks: 0,
        news: newsRow ? newsRow.c : 0,
        vendors: vendorsRow ? vendorsRow.c : 0
      },
      storage: {
        disk: {
          usedPercent: 15,
          usedGb: 4.5,
          totalGb: 30.0
        },
        media: {
          totalFiles: 0,
          totalSizeMb: 0
        }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Direct Messages (DM) Recording Toggle
settingsRouter.get('/settings/dms', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'record_direct_messages'").get();
    res.json({ record_direct_messages: row ? row.value === '1' : true });
  } catch (err) {
    res.json({ record_direct_messages: true });
  }
});

settingsRouter.post('/settings/dms', (req, res) => {
  try {
    const { record_direct_messages } = req.body || {};
    const db = getDb();
    const val = record_direct_messages ? '1' : '0';
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('record_direct_messages', ?)").run(val);
    res.json({ success: true, record_direct_messages: Boolean(record_direct_messages) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Portal Terminal Password
settingsRouter.post('/settings/password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters long.' });
    }
    const db = getDb();

    // Verify current password if provided
    if (currentPassword !== undefined && currentPassword !== null && currentPassword !== '') {
      let stored = null;
      try {
        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'terminal_password'").get();
        if (row && row.value) stored = row.value;
      } catch (_) {}
      const validPasswords = getConfiguredPasswords();
      if (stored && !validPasswords.includes(stored)) {
        validPasswords.unshift(stored);
      }

      if (!validPasswords.includes(currentPassword)) {
        return res.status(401).json({ error: 'Current password is incorrect. Please verify and try again.' });
      }
    }

    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('terminal_password', ?)").run(newPassword.trim());
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Data Retention Window
settingsRouter.get('/settings/retention', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'retention_days'").get();
    const stats = getStats();
    const oldestRow = db.prepare('SELECT timestamp FROM caught_messages ORDER BY timestamp ASC LIMIT 1').get();
    const newestRow = db.prepare('SELECT timestamp FROM caught_messages ORDER BY timestamp DESC LIMIT 1').get();
    res.json({
      retentionDays: row ? Number(row.value) : 180,
      totalMessages: stats.totalMessages || stats.total || 0,
      oldestTimestamp: oldestRow ? oldestRow.timestamp : null,
      newestTimestamp: newestRow ? newestRow.timestamp : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.post('/settings/retention', (req, res) => {
  try {
    const { retentionDays } = req.body || {};
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('retention_days', ?)").run(String(retentionDays || 180));
    res.json({ success: true, message: `Retention set to ${retentionDays} days` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Storage Pruning & Retention Trigger
settingsRouter.post('/storage/retention', (req, res) => {
  try {
    const days = Number(req.body?.days || 30);
    const cutoff = Date.now() - (days * 86400000);
    const db = getDb();
    const result = db.prepare('DELETE FROM caught_messages WHERE timestamp < ?').run(cutoff);
    res.json({ success: true, message: `Pruned ${result.changes} older messages` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.post('/storage/prune-percentage', (req, res) => {
  try {
    const percentage = Number(req.body?.percentage || 10);
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as c FROM caught_messages').get().c;
    const toDelete = Math.floor(total * (percentage / 100));
    if (toDelete > 0) {
      db.prepare(`
        DELETE FROM caught_messages WHERE id IN (
          SELECT id FROM caught_messages ORDER BY timestamp ASC LIMIT ?
        )
      `).run(toDelete);
    }
    res.json({ success: true, deleted: toDelete });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

settingsRouter.post('/storage/delete', (req, res) => {
  res.json({ success: true, deletedCount: 0, freedMb: 0 });
});

// 6. Selective Data Clear Action
settingsRouter.post('/data/clear', (req, res) => {
  try {
    const { target } = req.body || {};
    const db = getDb();
    if (target === 'routes') {
      db.prepare('DELETE FROM route_ticks').run();
      return res.json({ success: true, message: 'All wholesale routes deleted' });
    }
    if (target === 'news') {
      db.prepare('DELETE FROM market_news').run();
      return res.json({ success: true, message: 'All market news alerts cleared' });
    }
    if (target === 'all') {
      db.prepare('DELETE FROM route_ticks').run();
      db.prepare('DELETE FROM market_news').run();
      return res.json({ success: true, message: 'All telecom routes and news cleared' });
    }
    res.json({ success: true, message: 'Cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
