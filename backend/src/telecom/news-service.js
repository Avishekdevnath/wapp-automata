import { getDb } from '../storage/db.js';

export function getNews(limit = 100) {
  const db = getDb();
  const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  // Dual-Factor Priority & Recency Sorting Engine (ADR-023)
  const rows = db.prepare(`
    SELECT * FROM market_news 
    ORDER BY 
      CASE urgency 
        WHEN 'HIGH' THEN 1 
        WHEN 'MEDIUM' THEN 2 
        WHEN 'LOW' THEN 3 
        ELSE 4 
      END ASC,
      created_at DESC
    LIMIT ?
  `).all(cappedLimit);

  return {
    count: rows.length,
    news: rows
  };
}

export function clearNews() {
  const db = getDb();
  const info = db.prepare('DELETE FROM market_news').run();
  return info.changes;
}
