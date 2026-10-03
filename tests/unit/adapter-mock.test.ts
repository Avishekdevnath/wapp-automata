import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockWhatsAppAdapter, CollectorStatus } from '../../src/adapter';

describe('Phase 3 WhatsApp Adapter & Mock Tests', () => {
  it('should initialize in disconnected state', () => {
    const adapter = new MockWhatsAppAdapter();
    const status = adapter.getStatus();

    assert.equal(status.state, 'disconnected');
    assert.equal(status.accountJid, null);
    assert.equal(status.uptimeSeconds, 0);
  });

  it('should transition to authenticated on start and disconnected on stop', async () => {
    const adapter = new MockWhatsAppAdapter();

    await adapter.start();
    const activeStatus = adapter.getStatus();
    assert.equal(activeStatus.state, 'authenticated');
    assert.equal(activeStatus.accountJid, 'mock-user@s.whatsapp.net');
    assert.ok(activeStatus.lastConnectedAt !== null);

    await adapter.stop();
    const stoppedStatus = adapter.getStatus();
    assert.equal(stoppedStatus.state, 'disconnected');
    assert.equal(stoppedStatus.accountJid, null);
    assert.ok(stoppedStatus.lastDisconnectedAt !== null);
  });

  it('should notify registered message handlers when raw message is emitted', async () => {
    const adapter = new MockWhatsAppAdapter();
    const receivedEvents: unknown[] = [];

    adapter.onMessage(async (rawEvent) => {
      receivedEvents.push(rawEvent);
    });

    const mockPayload = {
      key: { id: 'wamid_mock_001', remoteJid: 'group_123@g.us' },
      message: { conversation: 'Hello World' },
      messageTimestamp: 1727915000
    };

    await adapter.emitRawMessage(mockPayload);

    assert.equal(receivedEvents.length, 1);
    assert.deepEqual(receivedEvents[0], mockPayload);
  });

  it('should notify status handlers on connection state changes', () => {
    const adapter = new MockWhatsAppAdapter();
    const observedStates: string[] = [];

    adapter.onConnectionStatus((status: CollectorStatus) => {
      observedStates.push(status.state);
    });

    adapter.setConnectionState('connecting');
    adapter.setConnectionState('auth_required');
    adapter.setConnectionState('authenticated', 'active-user@s.whatsapp.net');
    adapter.setConnectionState('disconnected');

    assert.deepEqual(observedStates, [
      'connecting',
      'auth_required',
      'authenticated',
      'disconnected'
    ]);
  });
});
