import { Router } from 'express';
import { getDb } from '../storage/db.js';

export const aiRouter = Router();

const AI_CONFIG_ENDPOINTS = {
  deepseek: { url: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-chat' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o-mini' },
  grok: { url: 'https://api.x.ai/v1/chat/completions', defaultModel: 'grok-beta' },
  local: { url: 'http://localhost:11434/v1/chat/completions', defaultModel: 'llama3.2' },
};

// 1. Get AI Provider Settings
aiRouter.get('/ai/settings', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM system_settings WHERE key LIKE 'ai_%'").all();
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });

    res.json({
      provider: map.ai_provider || 'deepseek',
      deepseekKey: map.ai_deepseek_key || '',
      openaiKey: map.ai_openai_key || '',
      grokKey: map.ai_grok_key || '',
      hasConfiguredKey: Boolean(
        (map.ai_provider === 'deepseek' && map.ai_deepseek_key) ||
        (map.ai_provider === 'openai' && map.ai_openai_key) ||
        (map.ai_provider === 'grok' && map.ai_grok_key) ||
        (map.ai_provider === 'local')
      )
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Save AI Provider Settings
aiRouter.post('/ai/settings', (req, res) => {
  try {
    const { provider, deepseekKey, openaiKey, grokKey } = req.body || {};
    const db = getDb();

    if (provider) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ai_provider', ?)").run(provider);
    if (deepseekKey !== undefined) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ai_deepseek_key', ?)").run(deepseekKey);
    if (openaiKey !== undefined) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ai_openai_key', ?)").run(openaiKey);
    if (grokKey !== undefined) db.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES ('ai_grok_key', ?)").run(grokKey);

    res.json({ success: true, message: 'AI configuration saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Test AI Provider Connection
aiRouter.post('/ai/test', async (req, res) => {
  try {
    const { provider, apiKey } = req.body || {};
    const targetProvider = provider || 'deepseek';
    const config = AI_CONFIG_ENDPOINTS[targetProvider];

    if (!config) {
      return res.status(400).json({ success: false, status: 'error', error: 'Unknown AI provider' });
    }

    let effectiveKey = (apiKey && typeof apiKey === 'string') ? apiKey.trim() : '';
    if (!effectiveKey && targetProvider !== 'local') {
      try {
        const db = getDb();
        const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(`ai_${targetProvider}_key`);
        if (row && row.value) {
          effectiveKey = String(row.value).trim();
        }
      } catch (_) {}
    }

    if (targetProvider !== 'local' && !effectiveKey) {
      return res.status(400).json({ success: false, status: 'error', error: 'API key is required for testing. Please enter or save your key first.' });
    }

    const testPayload = {
      model: config.defaultModel,
      messages: [
        { role: 'system', content: 'Respond with exactly: OK' },
        { role: 'user', content: 'Ping' }
      ],
      max_tokens: 10,
      temperature: 0.1
    };

    const resp = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(effectiveKey ? { 'Authorization': `Bearer ${effectiveKey}` } : {})
      },
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(12000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({
        success: false,
        status: 'error',
        error: `Provider error (${resp.status}): ${errText.slice(0, 150)}`
      });
    }

    res.json({
      success: true,
      status: 'ok',
      message: `Successfully connected to ${targetProvider.toUpperCase()}!`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'error',
      error: `Connection failed: ${err.message}`
    });
  }
});

// 4. Knowledge Base Help Articles
aiRouter.get('/help/articles', (req, res) => {
  try {
    const { category, q } = req.query || {};
    const db = getDb();

    let query = 'SELECT * FROM knowledge_base';
    const params = [];
    const conditions = [];

    if (category && category !== 'all') {
      conditions.push('category = ?');
      params.push(category);
    }

    if (q && String(q).trim()) {
      const term = `%${String(q).trim()}%`;
      conditions.push('(question LIKE ? OR short_answer LIKE ? OR detailed_steps LIKE ? OR tags LIKE ?)');
      params.push(term, term, term, term);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY sort_order ASC, updated_at DESC';

    const rows = db.prepare(query).all(...params);
    const parsed = rows.map(r => ({
      ...r,
      detailedSteps: JSON.parse(r.detailed_steps || '[]'),
      tags: JSON.parse(r.tags || '[]'),
      categoryLabel: r.category_label,
      shortAnswer: r.short_answer,
      waitTime: r.wait_time,
      actionLink: r.action_label ? { label: r.action_label, action: r.action_type } : null
    }));

    res.json({ articles: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiRouter.post('/help/articles', (req, res) => {
  try {
    const { id, category, categoryLabel, question, shortAnswer, detailedSteps, waitTime, tags, actionLabel, actionType, sortOrder } = req.body || {};
    if (!question || !shortAnswer) {
      return res.status(400).json({ error: 'Question and short answer are required.' });
    }

    const db = getDb();
    const articleId = id || 'kb-' + Date.now();
    const stepsStr = typeof detailedSteps === 'string' ? detailedSteps : JSON.stringify(detailedSteps || []);
    const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags || []);

    db.prepare(`
      INSERT OR REPLACE INTO knowledge_base
      (id, category, category_label, question, short_answer, detailed_steps, wait_time, tags, action_label, action_type, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      articleId,
      category || 'troubleshooting',
      categoryLabel || 'Troubleshooting',
      question.trim(),
      shortAnswer.trim(),
      stepsStr,
      waitTime || null,
      tagsStr,
      actionLabel || null,
      actionType || null,
      Number(sortOrder) || 0,
      Date.now()
    );

    res.json({ success: true, id: articleId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

aiRouter.delete('/help/articles/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM knowledge_base WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Intelligent AI Concierge Assistant (RAG)
aiRouter.post('/help/ask', async (req, res) => {
  const { question } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const db = getDb();

    // 1. Perform SQLite Knowledge Base Retrieval (Database-driven RAG)
    const cleanQ = question.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const searchWords = cleanQ.split(/\s+/).filter(w => w.length >= 3);
    let matchedArticles = [];

    if (searchWords.length > 0) {
      const clauses = searchWords.map(() => '(question LIKE ? OR short_answer LIKE ? OR tags LIKE ?)').join(' OR ');
      const params = [];
      searchWords.forEach(w => {
        const term = `%${w}%`;
        params.push(term, term, term);
      });
      matchedArticles = db.prepare(`SELECT * FROM knowledge_base WHERE ${clauses} LIMIT 5`).all(...params);
    }

    if (matchedArticles.length === 0) {
      matchedArticles = db.prepare('SELECT * FROM knowledge_base ORDER BY sort_order ASC LIMIT 4').all();
    }

    const retrievedContext = matchedArticles.map((r, i) => {
      const steps = JSON.parse(r.detailed_steps || '[]');
      return `Article ${i + 1}: [${r.question}]\nCategory: ${r.category_label}\nSummary: ${r.short_answer}\nSteps:\n- ${steps.join('\n- ')}\nWait Time / Expectation: ${r.wait_time || 'N/A'}`;
    }).join('\n\n');

    // 2. Fetch AI credentials from DB
    const providerRow = db.prepare("SELECT value FROM system_settings WHERE key = 'ai_provider'").get();
    const provider = providerRow ? providerRow.value : 'deepseek';
    const keyRow = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(`ai_${provider}_key`);
    const apiKey = keyRow ? keyRow.value : '';

    const config = AI_CONFIG_ENDPOINTS[provider];
    if (!config || (provider !== 'local' && !apiKey)) {
      return res.json({
        mode: 'local',
        fallbackReason: 'AI provider not configured with API key. Falling back to knowledge base articles.',
        matchedArticleIds: matchedArticles.map(a => a.id)
      });
    }

    // 3. Dispatch to LLM
    const systemPrompt = `You are TELCIA AI Concierge, the official expert assistant for the TELCIA (Telecom Cognitive Intelligent Agent) terminal.
Help telecom trading desk operators and carriers resolve WhatsApp session questions, understand route matching, and troubleshoot issues.
Use the verified Knowledge Base articles below as your factual anchor:

${retrievedContext}

Format rules:
- Format your response cleanly using GitHub-flavored Markdown.
- Use bullet points, bold key terms, and step numbers.
- Be concise, direct, professional, and friendly.`;

    const payload = {
      model: config.defaultModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      max_tokens: 600,
      temperature: 0.3
    };

    const resp = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey.trim()}` } : {})
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.json({
        mode: 'local',
        fallbackReason: `AI Provider (${provider}) returned error: ${errText.slice(0, 100)}`,
        matchedArticleIds: matchedArticles.map(a => a.id)
      });
    }

    const data = await resp.json();
    const answer = data?.choices?.[0]?.message?.content || 'Unable to generate answer.';

    res.json({
      mode: 'ai',
      provider,
      answer,
      matchedArticleIds: matchedArticles.map(a => a.id)
    });
  } catch (err) {
    res.json({
      mode: 'local',
      fallbackReason: `AI query timed out or failed (${err.message}). Using database knowledge base.`
    });
  }
});
