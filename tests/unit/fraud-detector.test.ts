import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { evaluateRouteFraudRisk, MARKET_FLOORS } = require('../../backend/src/server/fraud-detector');

describe('Phase 3 FAS & Fraud Anomaly Risk Detector Tests', () => {

  it('should flag severe price floor violations as High FAS trap risk', () => {
    // USA CC CLI floor is 0.0040. An offer at 0.0010 is 75% below floor.
    const result = evaluateRouteFraudRisk({
      country: 'USA',
      route_type: 'CC CLI',
      rate_per_min: 0.0010,
      billing_pulse: '1/1',
      raw_text: 'Offering USA CC CLI at $0.0010 direct route'
    });

    assert.ok(result.risk_score >= 70, `Risk score should be elevated (got ${result.risk_score})`);
    assert.strictEqual(result.risk_level, 'CRITICAL', 'Should be rated CRITICAL');
    assert.strictEqual(result.color, 'rose');
    assert.ok(result.flags.some((f: string) => f.includes('below viable floor')), 'Should have floor warning flag');
  });

  it('should verify healthy market corridor rates as safe', () => {
    // Colombia CLI floor is 0.0045. An offer at 0.0062 is healthy.
    const result = evaluateRouteFraudRisk({
      country: 'Colombia',
      route_type: 'CLI',
      rate_per_min: 0.0062,
      billing_pulse: '1/1',
      raw_text: 'Colombia direct CLI 1/1 at $0.0062 with 100% FAS Free SLA'
    });

    assert.ok(result.risk_score < 30, `Healthy route should have low risk score (got ${result.risk_score})`);
    assert.strictEqual(result.risk_level, 'LOW', 'Should be rated LOW');
    assert.strictEqual(result.color, 'emerald');
    assert.ok(result.flags.some((f: string) => f.includes('matches healthy commercial corridor')), 'Should match corridor');
    assert.ok(result.flags.some((f: string) => f.includes('0% FAS commercial guarantee')), 'Should note 0% FAS SLA');
  });

  it('should detect explicit FAS complaints and alerts in offer text', () => {
    const result = evaluateRouteFraudRisk({
      country: 'India',
      route_type: 'CLI',
      rate_per_min: 0.0070,
      quality_notes: 'Experiencing high fas on current upstream provider, looking for alternative'
    });

    assert.ok(result.risk_score >= 65, 'FAS complaint should raise risk score');
    assert.ok(result.flags.some((f: string) => f.includes('explicit FAS warnings')), 'Should flag FAS warning');
  });

  it('should detect spoofed or randomized ANI passing', () => {
    const result = evaluateRouteFraudRisk({
      country: 'United Kingdom',
      route_type: 'CC CLI',
      rate_per_min: 0.0055,
      raw_text: 'UK route available, random ANI / spoof ANI accepted'
    });

    assert.ok(result.risk_score >= 40, 'Randomized ANI should add penalty');
    assert.ok(result.flags.some((f: string) => f.includes('unregistered or randomized ANI')), 'Should flag ANI spoofing');
  });

  it('should reward verified clean ANI formats', () => {
    const result = evaluateRouteFraudRisk({
      country: 'USA',
      route_type: 'CLI',
      rate_per_min: 0.0045,
      ani_pass: 'Clean 86xx / 1xx passing'
    });

    assert.ok(result.flags.some((f: string) => f.includes('Verified ANI format passing')), 'Should recognize ANI format');
  });

  it('should flag unrealistic ACD claims on dialer traffic', () => {
    const result = evaluateRouteFraudRisk({
      country: 'Bangladesh',
      route_type: 'CC CLI',
      rate_per_min: 0.0120,
      raw_text: 'Bangladesh CC CLI 100% ACD guaranteed on high cps'
    });

    assert.ok(result.flags.some((f: string) => f.includes('Unrealistic ACD claim')), 'Should flag 100% ACD claim');
  });

  it('should penalize 60/60 billing pulse on short-duration CC dialer traffic', () => {
    const result = evaluateRouteFraudRisk({
      country: 'USA',
      route_type: 'CC CLI',
      billing_pulse: '60/60',
      rate_per_min: 0.0050
    });

    assert.ok(result.flags.some((f: string) => f.includes('60/60 pulse is non-standard')), 'Should flag 60/60 CC pulse penalty');
  });

});
