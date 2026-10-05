/**
 * Telecom Intelligence Extraction & Ingestion Pipeline
 */
const { extractTelecomWithAI } = require('../telecom-parser');
const { getTradingDb, saveParsedTelecom } = require('./db');

async function processTelecomIntelligence(record) {
  if (!record || !record.text) return;
  try {
    const parsed = await extractTelecomWithAI(record.text, record.sender_phone, record.sender_name);
    if (!parsed || !parsed.isTelecom) return;
    const db = getTradingDb();
    if (!db) return;
    saveParsedTelecom(db, parsed, record);
    if (parsed.routes && parsed.routes.length > 0) {
      console.log(`📈 [Trading Terminal] Extracted ${parsed.routes.length} routes from ${record.sender_name || record.sender_phone}`);
    }
  } catch (err) {
    console.error('Error in processTelecomIntelligence:', err.message);
  }
}

module.exports = {
  processTelecomIntelligence
};
