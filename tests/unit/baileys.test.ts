import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { BaileysAdapter } from '../../src/adapter/baileys';
import { initSessionDirectory } from '../../src/adapter/baileys/session';

describe('Phase 13 Baileys WhatsApp Adapter Tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baileys-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should initialize session directory with proper structure and permissions', () => {
    const sessionDir = path.join(tempDir, 'sub', '.session');
    assert.equal(fs.existsSync(sessionDir), false);

    const resolved = initSessionDirectory(sessionDir);
    assert.equal(fs.existsSync(resolved), true);
    assert.equal(fs.statSync(resolved).isDirectory(), true);

    // Calling it again on an existing directory should be idempotent
    const resolvedAgain = initSessionDirectory(sessionDir);
    assert.equal(resolvedAgain, resolved);
  });

  it('should report initial disconnected state with zero uptime', () => {
    const sessionPath = path.join(tempDir, '.session');
    const adapter = new BaileysAdapter({
      sessionPath,
      printQRInTerminal: false,
      reconnectIntervalMs: 1000
    });

    const status = adapter.getStatus();
    assert.equal(status.state, 'disconnected');
    assert.equal(status.uptimeSeconds, 0);
    assert.equal(status.lastConnectedAt, null);
    assert.equal(status.lastDisconnectedAt, null);
    assert.equal(status.accountJid, null);
  });

  it('should allow registering message and status handlers without error', () => {
    const sessionPath = path.join(tempDir, '.session');
    const adapter = new BaileysAdapter({
      sessionPath,
      printQRInTerminal: false
    });

    let messageHandled = false;
    let statusHandled = false;

    adapter.onMessage(async (_raw) => {
      messageHandled = true;
    });

    adapter.onConnectionStatus((_status) => {
      statusHandled = true;
    });

    assert.equal(messageHandled, false);
    assert.equal(statusHandled, false);
  });

  it('should cleanly stop an adapter instance that was not started', async () => {
    const sessionPath = path.join(tempDir, '.session');
    const adapter = new BaileysAdapter({
      sessionPath,
      printQRInTerminal: false
    });

    await adapter.stop();
    assert.equal(adapter.getStatus().state, 'disconnected');
  });
});
