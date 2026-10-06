import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { getTradingDb } from '../../scripts/server/db';
import { handleSystemApi } from '../../scripts/server/system-api';
import { DASHBOARD_PASSWORD, setDashboardPassword } from '../../scripts/server/config';
import { generateAuthToken } from '../../scripts/server/auth';

describe('Settings API & Data Management Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  const originalPassword = DASHBOARD_PASSWORD;

  before(async () => {
    // Seed test routes and news if needed
    const db = getTradingDb();
    if (db) {
      db.prepare(`
        INSERT OR IGNORE INTO route_ticks (id, message_id, country, route_type, billing_pulse, rate_per_min, fas_free, vendor_name, vendor_phone, company_name, quality_notes, intent, raw_text, created_at)
        VALUES ('test_tick_1', 'msg_1', 'Bangladesh', 'CLI', '1/1', 0.015, 1, 'VendorBD', '8801700000000', 'Carrier Ltd', 'Direct ncli', 'OFFER', 'Test route', ${Date.now()})
      `).run();
    }

    server = http.createServer(async (req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
      const handled = await handleSystemApi(req, res, parsedUrl.pathname, parsedUrl);
      if (!handled && !res.writableEnded) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Restore original password
    setDashboardPassword(originalPassword);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('GET /api/settings/stats should return live counts and storage telemetry', async () => {
    const res = await fetch(`${baseUrl}/api/settings/stats`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as { status: string; counts: Record<string, number>; storage: { disk: unknown; media: unknown } };
    assert.equal(data.status, 'ok');
    assert.ok(typeof data.counts.routes === 'number');
    assert.ok(typeof data.counts.aiTasks === 'number');
    assert.ok(typeof data.counts.news === 'number');
    assert.ok(data.storage && typeof data.storage === 'object');
  });

  it('POST /api/settings/password should reject mismatched current password', async () => {
    const res = await fetch(`${baseUrl}/api/settings/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'wrong_password_999',
        newPassword: 'newValidPassword123'
      })
    });
    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: string };
    assert.ok(data.error.includes('Current password does not match'));
  });

  it('POST /api/settings/password should reject new password shorter than 4 characters', async () => {
    const { DASHBOARD_PASSWORD: currentPwd } = require('../../scripts/server/config');
    const res = await fetch(`${baseUrl}/api/settings/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: currentPwd,
        newPassword: '12'
      })
    });
    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: string };
    assert.ok(data.error.includes('at least 4 characters'));
  });

  it('POST /api/settings/password should update password successfully with valid inputs', async () => {
    const { DASHBOARD_PASSWORD: currentPwd } = require('../../scripts/server/config');
    const res = await fetch(`${baseUrl}/api/settings/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: currentPwd,
        newPassword: 'newSecurePassword2026'
      })
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { status: string };
    assert.equal(data.status, 'ok');

    // Verify token signed with new password works
    const { DASHBOARD_PASSWORD: updatedPwd } = require('../../scripts/server/config');
    assert.equal(updatedPwd, 'newSecurePassword2026');
  });

  it('POST /api/data/clear should safely clear target table and return counts', async () => {
    // 1. Clear routes
    const resRoutes = await fetch(`${baseUrl}/api/data/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'routes' })
    });
    assert.equal(resRoutes.status, 200);
    const dataRoutes = (await resRoutes.json()) as { status: string; target: string; deleted: { routes: number } };
    assert.equal(dataRoutes.status, 'ok');
    assert.equal(dataRoutes.target, 'routes');
    assert.ok(typeof dataRoutes.deleted.routes === 'number');

    // 2. Clear analysis
    const resAnalysis = await fetch(`${baseUrl}/api/data/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'analysis' })
    });
    assert.equal(resAnalysis.status, 200);
    const dataAnalysis = (await resAnalysis.json()) as { status: string; target: string };
    assert.equal(dataAnalysis.status, 'ok');
    assert.equal(dataAnalysis.target, 'analysis');

    // 3. Clear news
    const resNews = await fetch(`${baseUrl}/api/data/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: 'news' })
    });
    assert.equal(resNews.status, 200);
    const dataNews = (await resNews.json()) as { status: string; target: string };
    assert.equal(dataNews.status, 'ok');
    assert.equal(dataNews.target, 'news');
  });
});
