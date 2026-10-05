/**
 * Telecom Intelligence Extraction & Ingestion Pipeline
 */
const { extractTelecomWithAI } = require('../telecom-parser');
const { getTradingDb, saveParsedTelecom } = require('./db');
const { recordPipelineEvent } = require('./pipeline-api');

async function processTelecomIntelligence(record) {
  if (!record || !record.text) return;
  const startTime = Date.now();
  try {
    const parsed = await extractTelecomWithAI(record.text, record.sender_phone, record.sender_name);
    const latencyMs = Date.now() - startTime;

    if (parsed && parsed.isTelecom) {
      const db = getTradingDb();
      if (db) saveParsedTelecom(db, parsed, record);
      if (parsed.routes && parsed.routes.length > 0) {
        console.log(`📈 [Trading Terminal] Extracted ${parsed.routes.length} routes from ${record.sender_name || record.sender_phone} (${latencyMs}ms)`);
      }
    }

    // Record real-time trace in Pipeline Inspector
    recordPipelineEvent({
      id: record.id,
      sender_name: record.sender_name,
      sender_phone: record.sender_phone,
      chat_name: record.chat_name,
      chat_type: record.chat_type,
      raw_text: record.text,
      latency_ms: latencyMs,
      parsed
    });
  } catch (err) {
    console.error('Error in processTelecomIntelligence:', err.message);
  }
}

module.exports = {
  processTelecomIntelligence
};
