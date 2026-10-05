import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { getExecutiveOutageBrief, generateFallbackBrief } = require('../../scripts/server/executive-summary');

describe('Phase 5 Telecom Executive Outage & Regulatory Summary Tests', () => {

  it('should synthesize critical disruptions and affected corridors in fallback brief', () => {
    const mockNews = [
      {
        category: 'OUTAGE',
        urgency: 'HIGH',
        headline: 'SEA-ME-WE 5 subsea fiber cut reported',
        affected_countries: 'Singapore, Malaysia, Indonesia',
        raw_text: 'Major subsea cable cut causing severe packet loss to Southeast Asia.'
      },
      {
        category: 'REGULATION',
        urgency: 'MEDIUM',
        headline: 'FCC enforcement on unregistered Robocall gateway',
        affected_countries: 'USA',
        raw_text: 'FCC orders tier 1 providers to block unregistered traffic.'
      }
    ];

    const brief = generateFallbackBrief(mockNews);

    assert.strictEqual(brief.status_level, 'CRITICAL_DISRUPTION');
    assert.strictEqual(brief.badge_color, 'rose');
    assert.strictEqual(brief.active_alerts_count, 2);
    assert.strictEqual(brief.high_urgency_count, 1);
    assert.ok(brief.corridors_at_risk.includes('Singapore'));
    assert.ok(brief.corridors_at_risk.includes('USA'));
    assert.ok(brief.routing_recommendations.length > 0);
    assert.ok(brief.routing_recommendations.some((r: string) => r.includes('secondary IP interconnects')));
    assert.ok(brief.regulatory_brief.includes('regulatory compliance notices active'));
  });

  it('should return stable status when no disruptions exist', () => {
    const brief = generateFallbackBrief([]);

    assert.strictEqual(brief.status_level, 'STABLE');
    assert.strictEqual(brief.badge_color, 'emerald');
    assert.strictEqual(brief.corridors_at_risk[0], 'Global Traffic Stable');
  });

  it('should resolve getExecutiveOutageBrief cleanly with structured schema', async () => {
    const brief = await getExecutiveOutageBrief(false);

    assert.ok(brief);
    assert.ok(typeof brief.headline === 'string');
    assert.ok(typeof brief.status_level === 'string');
    assert.ok(Array.isArray(brief.corridors_at_risk));
    assert.ok(Array.isArray(brief.routing_recommendations));
    assert.ok(typeof brief.regulatory_brief === 'string');
  });

});
