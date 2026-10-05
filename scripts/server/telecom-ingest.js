/**
 * Telecom Intelligence Extraction & Ingestion Pipeline
 * Persists inbound carrier messages into the durable SQLite task queue
 * for steady-state rate-limited AI extraction with zero data loss.
 */
const { enqueueAiTask } = require('./ai-queue');

function processTelecomIntelligence(record) {
  if (!record || !record.text) return;
  enqueueAiTask(record, 1);
}

module.exports = {
  processTelecomIntelligence
};
