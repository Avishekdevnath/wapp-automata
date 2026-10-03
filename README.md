# WhatsApp Raw Collector

A lightweight, reliable Node.js/TypeScript service that captures raw WhatsApp messages, persists them safely to a local SQLite durable queue, and reliably dispatches them to a client webhook via HTTPS.

## Architecture

```text
                    VPS
                     │
              ┌──────▼──────┐
              │ Node.js App │
              │             │
              │ WhatsApp    │
              │ Adapter     │
              │     │       │
              │     ▼       │
              │  SQLite     │ (Durable queue & local persistence)
              │     │       │
              │     ▼       │
              │ Webhook     │ (Retry with exponential backoff)
              │ Worker      │
              └──────┬──────┘
                     │
                  HTTPS
                     │
                     ▼
              Client Webhook
```

## Deployment Model

- **Platform:** Native Node.js on Ubuntu Linux VPS
- **Process Manager:** PM2 (auto-restart, cluster/daemon management, log rotation)
- **Local Storage:** SQLite (zero-config, transactional local durability)
- **Docker:** Intentionally **not** included in the initial version to maintain simplicity and direct host resource access.

## Project Structure

```text
whatsapp-raw-collector/
├── src/               # Application source code
├── tests/             # Test suites
├── scripts/           # Operations and maintenance scripts
├── data/              # Runtime SQLite database (ignored in git)
├── .env.example       # Example environment configuration
├── .gitignore         # Git ignore configuration
├── package.json       # Project dependencies and npm scripts
├── tsconfig.json      # TypeScript compiler configuration
├── AGENTS.md          # Agent instructions and architectural guardrails
└── README.md          # Project overview and run guide
```

*Note: Project private context and architectural documentation reside in the uncommitted `./brain/` workspace.*

## Getting Started

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your specific webhook and runtime settings
   ```

3. **Development Mode:**
   ```bash
   npm run dev
   ```

4. **Production Build & PM2:**
   ```bash
   npm run build
   pm2 start dist/index.js --name whatsapp-collector
   pm2 save
   ```
