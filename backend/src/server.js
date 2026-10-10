import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { getAccountConfig, getActiveAccountId } from './storage/account.js';
import { closeDb } from './storage/db.js';
import {
  connectWhatsApp,
  disconnectWhatsApp,
  addEventListener as addWhatsAppListener
} from './collector/whatsapp.js';
import { broadcastSse } from './sse.js';

// Domain Routers
import { authRouter } from './routes/auth.routes.js';
import { whatsappRouter } from './routes/whatsapp.routes.js';
import { accountsRouter } from './routes/accounts.routes.js';
import { messagesRouter } from './routes/messages.routes.js';
import { telecomRouter } from './routes/telecom.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { aiRouter } from './routes/ai.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../');
const FRONTEND_DIST = path.join(ROOT_DIR, 'frontend', 'dist');

// Native .env file loader for Telcia
try {
  const envPath = path.resolve(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (_) {}

const app = express();
const config = getAccountConfig();
const PORT = process.env.PORT || config.port || 5051;

app.use(cors());
app.use(express.json());

// Forward WhatsApp internal events to SSE clients
addWhatsAppListener((type, data) => {
  broadcastSse(type, data);
});

// Mount Domain Routers (with full backwards compatibility)
app.use('/api/auth', authRouter);
app.use('/api', authRouter);
app.use('/api', whatsappRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/account', accountsRouter);
app.use('/api/admin', accountsRouter);
app.use('/api', accountsRouter);
app.use('/api', messagesRouter);
app.use('/api', telecomRouter);
app.use('/api', settingsRouter);
app.use('/api', aiRouter);

// JSON 404 Fallback for any unhandled /api requests (avoids HTML error responses)
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `API route ${req.method} ${req.originalUrl} not found`, status: 'not_found' });
});

// Dedicated Authentic WhatsApp Web UI route
const CHAT_UI_PATH = path.join(ROOT_DIR, 'backend', 'public', 'chat.html');
app.use((req, res, next) => {
  if ((req.method === 'GET' || req.method === 'HEAD') && (req.path === '/chat' || req.path.startsWith('/chat/') || req.path === '/wp' || req.path.startsWith('/wp/'))) {
    if (fs.existsSync(CHAT_UI_PATH)) {
      return res.sendFile(CHAT_UI_PATH);
    }
    return res.status(404).send('WhatsApp Web UI not found at backend/public/chat.html');
  }
  next();
});

// Static assets from backend/public
app.use(express.static(path.join(ROOT_DIR, 'backend', 'public')));

// SPA Frontend Hosting
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api') && !req.path.startsWith('/chat') && !req.path.startsWith('/wp')) {
      return res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
    }
    next();
  });
}

// Start Server & Auto-connect active account
const server = app.listen(PORT, () => {
  console.log(`\n🚀 [Server] TELCIA running at http://localhost:${PORT}`);
  console.log(`📁 [Server] Active Account: [${getActiveAccountId()}]`);

  // Connect WhatsApp session for the active account
  connectWhatsApp().catch(err => {
    console.warn('[WhatsApp] Startup connection error:', err.message);
  });
});

// Graceful Shutdown
function handleShutdown(signal) {
  console.log(`\n🛑 [Server] Received ${signal}. Shutting down cleanly...`);
  disconnectWhatsApp().then(() => {
    closeDb();
    server.close(() => {
      console.log('👋 [Server] Process terminated cleanly.');
      process.exit(0);
    });
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export { app, server };
