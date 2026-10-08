import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { generateTradePitch, generateFallbackPitches } = require('../../backend/src/server/pitch-generator');

describe('Phase 4 Trade Negotiation Pitch Generator Tests', () => {

  it('should generate 3 deterministic fallback trading pitches with deal specifics', () => {
    const params = {
      destination: 'Colombia',
      routeType: 'CC CLI',
      currentRate: 0.0055,
      targetRate: 0.0048,
      pulse: '1/1',
      vendorName: 'GlobalCom Direct',
      volume: '300 ports (50k min/day)'
    };

    const pitches = generateFallbackPitches(params);

    assert.strictEqual(Array.isArray(pitches), true, 'Pitches must be an array');
    assert.strictEqual(pitches.length, 3, 'Must produce 3 distinct strategy pitches');

    // Strategy 1: Aggressive Counter-Offer
    const p1 = pitches[0];
    assert.strictEqual(p1.title, 'Aggressive Counter-Offer');
    assert.ok(p1.text.includes('GlobalCom Direct'), 'Should mention vendor name');
    assert.ok(p1.text.includes('Colombia CC CLI'), 'Should mention destination and route type');
    assert.ok(p1.text.includes('$0.0055'), 'Should cite offered rate');
    assert.ok(p1.text.includes('$0.0048'), 'Should cite target counter rate');
    assert.ok(p1.text.includes('1/1'), 'Should cite billing pulse');

    // Strategy 2: Quality & FAS Assurance
    const p2 = pitches[1];
    assert.strictEqual(p2.title, 'Quality & FAS Assurance');
    assert.ok(p2.text.includes('0% FAS SLA'), 'Should emphasize FAS guarantee');

    // Strategy 3: Quick Interconnect Knock
    const p3 = pitches[2];
    assert.strictEqual(p3.title, 'Quick Interconnect Knock');
    assert.ok(p3.text.includes('SIP signalling IP'), 'Should request interconnect test IPs');
  });

  it('should handle missing or empty parameters safely without crashing', () => {
    const pitches = generateFallbackPitches({});

    assert.strictEqual(pitches.length, 3);
    for (const p of pitches) {
      assert.ok(p.title, 'Every pitch must have a title');
      assert.ok(p.strategy, 'Every pitch must have a strategy description');
      assert.ok(p.text, 'Every pitch must have ready-to-send text');
    }
  });

  it('generateTradePitch should resolve safely with valid structured pitches', async () => {
    const pitches = await generateTradePitch({
      destination: 'USA',
      routeType: 'CLI',
      currentRate: 0.0040,
      targetRate: 0.0035,
      vendorName: 'DirectVoIP'
    });

    assert.strictEqual(Array.isArray(pitches), true, 'Pitches must be an array');
    assert.strictEqual(pitches.length, 3, 'Must produce 3 strategy pitches');
    for (const p of pitches) {
      assert.ok(typeof p.title === 'string' && p.title.length > 0, 'Pitch must have title');
      assert.ok(typeof p.strategy === 'string' && p.strategy.length > 0, 'Pitch must have strategy');
      assert.ok(typeof p.text === 'string' && p.text.length > 20, 'Pitch must have detailed text');
    }
  });

});
