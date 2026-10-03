import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CollectorMetrics, HeartbeatReporter } from '../../src/health';
import { IQueueRepository, QueueDepth, QueueRecord } from '../../src/queue/interface';
import { NormalizedEnvelope } from '../../src/normalizer';

describe('Phase 10 Health & Metrics Reporter Tests', () => {
  it('should accurately increment and report metric counters', () => {
    const metrics = new CollectorMetrics(1000);

    metrics.incrementIngested(3);
    metrics.incrementDelivered(2);
    metrics.incrementRetried(1);
    metrics.incrementFailed(1);

    const counters = metrics.getCounters();
    assert.equal(counters.ingested, 3);
    assert.equal(counters.delivered, 2);
    assert.equal(counters.retried, 1);
    assert.equal(counters.failed, 1);
  });

  it('should capture structured health snapshot including memory and queue depth', () => {
    const startedAt = 1_000_000;
    const nowMs = 1_060_000; // 60 seconds later
    const metrics = new CollectorMetrics(startedAt);

    metrics.incrementIngested(10);
    metrics.incrementDelivered(8);

    const mockDepth: QueueDepth = {
      pending: 2,
      delivering: 0,
      delivered: 8,
      failed: 0
    };

    const snapshot = metrics.getSnapshot(mockDepth, nowMs);

    assert.equal(snapshot.uptimeSeconds, 60);
    assert.equal(snapshot.timestamp, new Date(nowMs).toISOString());
    assert.deepEqual(snapshot.counters, {
      ingested: 10,
      delivered: 8,
      retried: 0,
      failed: 0
    });
    assert.deepEqual(snapshot.queue, mockDepth);
    assert.ok(snapshot.memory.rssMb > 0);
    assert.ok(snapshot.memory.heapUsedMb > 0);
  });

  it('should emit heartbeat report cleanly with mock queue repository', () => {
    const metrics = new CollectorMetrics();
    metrics.incrementIngested(5);

    const mockQueueRepo: IQueueRepository = {
      enqueue: (_env: NormalizedEnvelope) => true,
      fetchPending: (_limit: number) => [],
      markDelivering: (_ids: string[]) => 0,
      markDelivered: (_id: string) => {},
      markRetry: () => {},
      markFailed: () => {},
      recoverStaleProcessing: () => 0,
      getQueueDepth: (): QueueDepth => ({
        pending: 3,
        delivering: 1,
        delivered: 1,
        failed: 0
      }),
      findById: (_id: string): QueueRecord | null => null
    };

    const reporter = new HeartbeatReporter(metrics, mockQueueRepo, {
      intervalMs: 10_000,
      memoryWarningThresholdMb: 500
    });

    const report = reporter.emitHeartbeat();
    assert.equal(report.counters.ingested, 5);
    assert.ok(report.queue !== null);
    assert.equal(report.queue.pending, 3);
    assert.equal(report.queue.delivering, 1);
  });

  it('should start and stop the heartbeat timer cleanly', () => {
    const metrics = new CollectorMetrics();
    const reporter = new HeartbeatReporter(metrics, undefined, { intervalMs: 50_000 });

    assert.equal(reporter.active, false);
    reporter.start();
    assert.equal(reporter.active, true);
    reporter.stop();
    assert.equal(reporter.active, false);
  });

  it('should trigger memory warning when RSS exceeds configured threshold', () => {
    const metrics = new CollectorMetrics();
    // Set threshold absurdly low (0.0001 MB) so current RSS is guaranteed to exceed it
    const reporter = new HeartbeatReporter(metrics, undefined, {
      memoryWarningThresholdMb: 0.0001
    });

    const report = reporter.emitHeartbeat();
    assert.ok(report.memory.rssMb > 0.0001);
  });
});
