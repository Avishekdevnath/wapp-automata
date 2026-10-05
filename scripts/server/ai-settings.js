/**
 * AI Intelligence & Multi-Provider Settings Engine (DeepSeek, OpenAI, Grok, Local Regex)
 */
const { getTradingDb } = require('./db');

const PROVIDER_CONFIGS = {
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY'
  },
  openai: {
    name: 'OpenAI (ChatGPT)',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    keyEnv: 'OPENAI_API_KEY'
  },
  grok: {
    name: 'xAI Grok',
    endpoint: 'https://api.x.ai/v1/chat/completions',
    defaultModel: 'grok-beta',
    keyEnv: 'GROK_API_KEY'
  },
  local: {
    name: 'Local Regex Engine',
    endpoint: null,
    defaultModel: 'regex-v1',
    keyEnv: null
  }
};

function initSettingsTable(db) {
  if (!db) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

function getSetting(key, defaultVal = '') {
  const db = getTradingDb();
  if (!db) return process.env[key] || defaultVal;
  initSettingsTable(db);
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    if (row && row.value) return row.value;
  } catch (_) {}
  return process.env[key] || defaultVal;
}

function setSetting(key, val) {
  const db = getTradingDb();
  if (!db) return;
  initSettingsTable(db);
  try {
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at) 
      VALUES (?, ?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, String(val), Date.now());
  } catch (err) {
    console.warn(`[Settings] Failed to save setting ${key}:`, err.message);
  }
}

function maskKey(keyStr) {
  if (!keyStr || typeof keyStr !== 'string') return '';
  const trimmed = keyStr.trim();
  if (trimmed.length <= 8) return '••••••••';
  return trimmed.slice(0, 3) + '••••••••' + trimmed.slice(-4);
}

function getAiSettingsState() {
  const provider = getSetting('AI_PROVIDER', process.env.AI_PROVIDER || 'deepseek');
  const deepseekKey = getSetting('DEEPSEEK_API_KEY', process.env.DEEPSEEK_API_KEY || '');
  const openaiKey = getSetting('OPENAI_API_KEY', process.env.OPENAI_API_KEY || '');
  const grokKey = getSetting('GROK_API_KEY', process.env.GROK_API_KEY || '');

  return {
    provider,
    providers: ['deepseek', 'openai', 'grok', 'local'],
    deepseek: {
      hasKey: Boolean(deepseekKey),
      maskedKey: maskKey(deepseekKey),
      model: getSetting('DEEPSEEK_MODEL', 'deepseek-chat')
    },
    openai: {
      hasKey: Boolean(openaiKey),
      maskedKey: maskKey(openaiKey),
      model: getSetting('OPENAI_MODEL', 'gpt-4o-mini')
    },
    grok: {
      hasKey: Boolean(grokKey),
      maskedKey: maskKey(grokKey),
      model: getSetting('GROK_MODEL', 'grok-beta')
    }
  };
}

async function testProviderConnection(provider, testKey, model) {
  if (provider === 'local') {
    return {
      success: true,
      provider: 'local',
      model: 'regex-v1',
      latencyMs: 1,
      message: 'Local Regex engine operational (Offline, 0ms latency)'
    };
  }

  const cfg = PROVIDER_CONFIGS[provider];
  if (!cfg) throw new Error(`Unknown AI provider "${provider}"`);

  const keyToUse = testKey || getSetting(cfg.keyEnv, process.env[cfg.keyEnv] || '');
  if (!keyToUse) {
    throw new Error(`Missing API key for ${cfg.name}. Please enter your API key first.`);
  }

  const modelToUse = model || cfg.defaultModel;
  const sampleMessage = "USA CC CLI 1/1 at $0.0055 clean ASR 45% ACD 4m from Telco Direct (+12065550192)";

  const prompt = `You are a Wholesale Telecom Route Analyst. Extract structured data from this message into JSON.
Format required:
{
  "isTelecom": true,
  "intent": "WTS",
  "routes": [
    {
      "country": "USA",
      "route_type": "CC CLI",
      "billing_pulse": "1/1",
      "rate_per_min": 0.0055
    }
  ]
}
Return ONLY valid JSON.`;

  const startTime = Date.now();
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${keyToUse}`
    },
    body: JSON.stringify({
      model: modelToUse,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: sampleMessage }
      ],
      response_format: { type: 'json_object' }
    }),
    signal: AbortSignal.timeout(10000)
  });

  const latencyMs = Date.now() - startTime;

  if (!res.ok) {
    const errText = await res.text();
    let parsedErr = errText;
    try {
      const errObj = JSON.parse(errText);
      parsedErr = errObj.error?.message || errText;
    } catch (_) {}
    throw new Error(`${cfg.name} API returned HTTP ${res.status}: ${parsedErr}`);
  }

  const data = await res.json();
  const textContent = data.choices?.[0]?.message?.content || '{}';
  const extracted = JSON.parse(textContent);

  return {
    success: true,
    provider,
    model: modelToUse,
    latencyMs,
    extracted
  };
}

function handleAiSettingsApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/settings/ai') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(getAiSettingsState()));
  }

  if (req.method === 'POST' && pathname === '/api/settings/ai') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (payload.provider) {
          setSetting('AI_PROVIDER', payload.provider);
          process.env.AI_PROVIDER = payload.provider;
        }
        if (payload.deepseek_key) {
          setSetting('DEEPSEEK_API_KEY', payload.deepseek_key.trim());
          process.env.DEEPSEEK_API_KEY = payload.deepseek_key.trim();
        }
        if (payload.openai_key) {
          setSetting('OPENAI_API_KEY', payload.openai_key.trim());
          process.env.OPENAI_API_KEY = payload.openai_key.trim();
        }
        if (payload.grok_key) {
          setSetting('GROK_API_KEY', payload.grok_key.trim());
          process.env.GROK_API_KEY = payload.grok_key.trim();
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', settings: getAiSettingsState() }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/settings/ai/test') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const provider = payload.provider || getSetting('AI_PROVIDER', 'deepseek');
        const testKey = payload.key || '';
        const model = payload.model || '';

        const result = await testProviderConnection(provider, testKey, model);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return true;
  }

  return false;
}

module.exports = {
  PROVIDER_CONFIGS,
  getSetting,
  setSetting,
  getAiSettingsState,
  testProviderConnection,
  handleAiSettingsApi
};
