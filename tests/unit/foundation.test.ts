import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SERVICE_NAME, SERVICE_VERSION, getServiceInfo } from '../../src/index';

describe('Phase 1 Foundation Verification', () => {
  it('should expose valid service metadata', () => {
    assert.equal(SERVICE_NAME, 'whatsapp-raw-collector');
    assert.equal(SERVICE_VERSION, '0.1.0');
  });

  it('should return service info with initialized status', () => {
    const info = getServiceInfo();
    assert.deepEqual(info, {
      name: 'whatsapp-raw-collector',
      version: '0.1.0',
      status: 'initialized'
    });
  });

  it('should verify node assert and test execution environment', () => {
    assert.ok(true, 'Test runner is operational');
    assert.equal(1 + 1, 2);
  });
});
