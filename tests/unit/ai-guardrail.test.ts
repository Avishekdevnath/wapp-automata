import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import JS parser functions
const {
  extractNumericCandidates,
  verifyRatePresence
} = require('../../scripts/telecom-parser');
const {
  isLikelyTelecomMessage
} = require('../../scripts/server/ai-queue');

describe('Phase 1 & 2 AI Intelligence Guardrail Tests', () => {

  it('should extract numeric candidates accurately across carrier price formats', () => {
    const raw = 'Direct Colombia CC CLI $0.0062, USA .0070, BD 1.2c, EUR 0,045 at 500 ports capacity';
    const candidates = extractNumericCandidates(raw);

    assert.ok(candidates.includes(0.0062), 'Should extract standard decimal $0.0062');
    assert.ok(candidates.includes(0.007), 'Should extract dot-prefix decimal .0070');
    assert.ok(candidates.includes(0.012), 'Should extract cents 1.2c as 0.012');
    assert.ok(candidates.includes(0.045), 'Should extract comma decimal 0,045');
    assert.ok(candidates.includes(500), 'Should extract integer 500 ports');
  });

  it('should verify mathematically present rates and reject hallucinated rates', () => {
    const raw = 'USA CC CLI 1/1 at $0.0065 clean ANI passing';
    const candidates = extractNumericCandidates(raw);

    // Legitimate rate in text
    const validRate = verifyRatePresence(0.0065, candidates);
    assert.strictEqual(validRate, 0.0065, 'Real rate in message must pass verification');

    // Fabricated rate invented by AI
    const fakeRate = verifyRatePresence(0.0050, candidates);
    assert.strictEqual(fakeRate, null, 'Fabricated rate not in message must be rejected as null');

    // Ports capacity erroneously assigned to rate
    const portRate = verifyRatePresence(500, [500]);
    assert.strictEqual(portRate, null, 'Rates above sanity threshold (> $5.00) must be rejected');
  });

  it('should filter non-telecom chatter locally with zero API cost', () => {
    const noise1 = 'Good morning team, let us meet on Google Meet today';
    const noise2 = 'Please check payment receipt attached';
    const telco1 = 'USA CC CLI 1/1 500 ports needed urgent';
    const telco2 = 'Emergency outage on SEA-ME-WE fiber cut';
    const telco3 = '🇨🇴 Colombia direct voice routes open for test traffic';

    assert.strictEqual(isLikelyTelecomMessage(noise1), false, 'Chatter should be classified as non-telecom');
    assert.strictEqual(isLikelyTelecomMessage(noise2), false, 'Payment receipt chatter should be filtered');
    assert.strictEqual(isLikelyTelecomMessage(telco1), true, 'Carrier demand should be classified as telecom');
    assert.strictEqual(isLikelyTelecomMessage(telco2), true, 'Outage alert should be classified as telecom');
    assert.strictEqual(isLikelyTelecomMessage(telco3), true, 'Country flag route offer should be classified as telecom');
  });

  it('should atomically enqueue tasks into SQLite with priority lanes', () => {
    const { enqueueAiTask, getQueueStats } = require('../../scripts/server/ai-queue');
    const { getTradingDb } = require('../../scripts/server/db');

    const db = getTradingDb();
    assert.ok(db, 'Trading database must be active');

    const sampleMsg = {
      id: `test_msg_${Date.now()}`,
      sender_name: 'Test Carrier',
      sender_phone: '+18005550199',
      chat_name: 'Wholesale Group',
      chat_type: 'group',
      text: 'Direct Peru CC CLI 1/1 at $0.0055'
    };

    const taskId = enqueueAiTask(sampleMsg, 10); // VIP Priority 10
    assert.ok(taskId && taskId.startsWith('task_'), 'TaskId should be generated');

    const row = db.prepare('SELECT * FROM ai_tasks WHERE id = ?').get(taskId);
    assert.ok(row, 'Task must exist in SQLite ai_tasks');
    assert.strictEqual(row.priority, 10, 'Priority should be set to 10');
    assert.strictEqual(row.sender_name, 'Test Carrier');

    const stats = getQueueStats();
    assert.ok(typeof stats.pending === 'number', 'Queue stats pending should be a number');
  });

});
