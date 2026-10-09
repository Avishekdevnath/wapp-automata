# Telcia WAPP Automata 📡
### Enterprise WhatsApp Companion Ingestion, Multi-Desk Collector & Real-Time Wholesale Intelligence Terminal

[![Node.js Version](https://img.shields.io/badge/Node.js-v22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v5.7+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![SQLite WAL](https://img.shields.io/badge/Storage-SQLite_WAL_Mode-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/UI-Tailwind_CSS_v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Deployment](https://img.shields.io/badge/Process_Manager-PM2-2B037A?logo=pm2&logoColor=white)](https://pm2.keymetrics.io/)
[![Zero Cloud Leakage](https://img.shields.io/badge/Security-Private_On--Premise_VPS-10B981)](#security--data-privacy)

---

## 📌 Executive Summary

**Telcia WAPP Automata** is an enterprise-grade, high-throughput WhatsApp companion terminal built specifically for wholesale telecom operators, VoIP trading desks, SMS aggregators, and commercial trade desks.

It functions as an autonomous companion device connected directly to WhatsApp Multi-Device infrastructure via [Baileys](https://github.com/WhiskeySockets/Baileys). It ingests high-volume group traffic, bilateral trading chats, and carrier broadcast lists in real-time, persists all incoming messages with zero loss into isolated local SQLite databases, renders rich message markdown, and provides instant market intelligence, rate extraction, and multi-desk isolation.

---

## 🏗️ Architecture Blueprint

```text
                  WhatsApp Multi-Device Cloud
                             │
            ┌────────────────▼────────────────┐
            │   Ubuntu 24 LTS VPS Host        │
            │                                 │
            │  ┌───────────────────────────┐  │
            │  │  Baileys Companion Engine │  │
            │  │  • Pairing Code / QR Auth │  │
            │  │  • Session Auto-Repair    │  │
            │  │  • 3-5m Sync Buffering    │  │
            │  └─────────────┬─────────────┘  │
            │                │                │
            │  ┌─────────────▼─────────────┐  │
            │  │ Multi-Desk Physical Layer │  │
            │  │ accounts/<id>/data/*.db   │  │
            │  │ accounts/<id>/session/*   │  │
            │  │ (SQLite 3 + WAL Mode)     │  │
            │  └─────────────┬─────────────┘  │
            │                │                │
            │  ┌─────────────▼─────────────┐  │
            │  │ Express REST & SSE Stream │  │
            │  │ • Server-Sent Events (SSE)│  │
            │  │ • Native WhatsApp OTP Auth│  │
            │  │ • Hybrid AI RAG Engine    │  │
            │  └─────────────┬─────────────┘  │
            └────────────────┼────────────────┘
                             │
                      HTTPS / WSS (Nginx)
                             │
            ┌────────────────▼────────────────┐
            │ Telcia Desktop / Mobile Client  │
            │ • React 19 + Tailwind v4 UI     │
            │ • WhatsApp Markdown Renderer    │
            │ • Real-Time Sound & Filters     │
            │ • Searchable Help & AI RAG      │
            └─────────────────────────────────┘
```

---

## 🌟 Core System Capabilities

### 1. Zero-Loss WhatsApp Companion Ingestion
- **Cryptographic Multi-Device Pairing**: Connect seamlessly via instant QR Code scanning or convenient 8-Digit Pairing Code (recommended for remote VPS).
- **Background Offline Catchup**: Automatically backfills messages received during network interruptions or server reboots.
- **Physical Session Isolation**: Each desk runs in independent session directories with automatic key rotation and pre-key repairs.

### 2. Multi-Desk Physical Data Separation
- **Multi-Tenant Workspaces**: Organize operations across multiple isolated desks (e.g. `telcia-prod` for Main Trading, `desk-2` for Sales, `sms-desk` for Aggregators).
- **Zero Cross-Contamination**: Each desk maintains its own dedicated directory structure:
  - `accounts/<desk-id>/data/scraped.sqlite` (Isolated message database)
  - `accounts/<desk-id>/session/` (Isolated cryptographic credentials)
- **Instant Workspace Switching**: Switch desks in 1 click from the top navigation bar without interrupting background scrapers.

### 3. Native WhatsApp Markdown Formatting & Detail Inspector
- **Rich WhatsApp Syntax**: Real-time rendering of bold (`*text*`), italic (`_text_`), strikethrough (`~text~`), inline code (`` `code` ``), syntax-highlighted code blocks (```` ```code``` ````), blockquotes (`> text`), lists (`* `, `1. `), and clickable auto-detected URLs.
- **Formatted vs. Raw Switcher**: Switch instantly between styled layout and verbatim raw characters with one click.
- **Verbatim Clipboard Copy**: 1-click copying of rate offers and wholesale proposals.

### 4. Native WhatsApp OTP Password Reset
- **No Third-Party Gateways Required**: 100% self-contained password recovery without Twilio, AWS SNS, or SMTP email servers.
- **Direct Companion Delivery**: Clicking *Forgot Password?* dispatches a cryptographically secure 6-digit OTP directly to the linked WhatsApp account's self-chat (`<phone>@s.whatsapp.net`).
- **Strict Security Controls**:
  - 60-second resend rate-limiting (HTTP 429).
  - 5-minute code expiration.
  - 5-attempt brute-force auto-lock.

### 5. Searchable Help & Dual-Mode Hybrid AI RAG
- **Zero-Config Instant Search**: Comprehensive 25+ topic knowledge base with real-time sub-millisecond client-side filtering (requires no external API keys).
- **AI-Powered RAG Concierge**: When an AI key (DeepSeek, OpenAI, Grok, or local Ollama) is configured in AI Settings, the Help Center activates conversational RAG, answering operational questions grounded strictly in Telcia's knowledge base.

---

## ⏱️ Operational Wait Times & Sync Expectations

When working with high-volume trading accounts on WhatsApp Multi-Device, keep these realistic durations in mind:

| Operational Action | Typical Wait Time | What Happens Behind the Scenes | User Guidance |
| :--- | :--- | :--- | :--- |
| **First-Time WhatsApp Pairing** | **3 – 5 minutes** | Cryptographic key exchange, pre-key verification, offline message buffering, and initial trading group indexing (`AwaitingInitialSync`). | Keep the primary phone screen unlocked and on Wi-Fi for 3–5 minutes. Do not close the app. |
| **Server / Desk Restart Catchup** | **30 – 60 seconds** | Companion reconnects to WhatsApp socket and processes unread messages from backlog. | Wait ~30s before refreshing stream rows. |
| **Password Reset OTP Delivery** | **5 – 15 seconds** | Direct Baileys socket push to linked companion self-chat. | Check your WhatsApp mobile app notifications. |
| **OTP Resend Cooldown** | **60 seconds** | Rate limit timer enforced on server and UI countdown. | Resend button reactivates after 60s. |
| **OTP Expiration** | **5 minutes** | Cryptographic security window for generated PIN. | Request fresh code if not submitted in 5m. |
| **New Desk Creation** | **2 – 3 seconds** | Physical folder generation and SQLite WAL schema initialization. | Immediate redirect to new desk workspace. |
| **Database Vacuum / Prune** | **5 – 15 seconds** | SQLite B-Tree defragmentation and WAL page compaction. | Run during low-traffic maintenance periods. |
| **AI Help Assistant Query** | **2 – 4 seconds** | Context retrieval + LLM synthesis. | Instant (0s) when using standard search mode. |

---

## 🚀 Quickstart & Setup Guide

### System Prerequisites
- **Node.js**: `v22.x` or higher recommended (compatible with Node 20+)
- **NPM**: `v10.x` or higher
- **OS**: Ubuntu 22.04/24.04 LTS (recommended for VPS) or Windows 11 / macOS for local dev
- **RAM**: Minimum 1 GB RAM (2 GB recommended for high message backlogs)

---

### Local Development Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Avishekdevnath/wapp-automata.git
   cd wapp-automata
   ```

2. **Install Root & Frontend Dependencies**:
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```

4. **Start Backend & Frontend Services**:
   ```bash
   # Terminal 1: Backend Server (Port 4000)
   npm run dev:backend

   # Terminal 2: Frontend Vite Dev Server (Port 5173)
   npm run dev:frontend
   ```

5. **Access the Terminal**:
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Production Deployment (Ubuntu VPS with PM2)

1. **Prepare Server Directory**:
   ```bash
   mkdir -p /opt/wapp-automata
   cd /opt/wapp-automata
   git clone https://github.com/Avishekdevnath/wapp-automata.git current
   cd current
   ```

2. **Install Dependencies & Build Frontend**:
   ```bash
   npm install
   cd frontend && npm install && cd ..
   npm run build
   ```

3. **Configure PM2 Process Manager**:
   ```bash
   npm install -g pm2
   pm2 start backend/src/server.js --name "wapp-automata" --time
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx Reverse Proxy & SSL (Certbot)**:
   ```nginx
   server {
       server_name telcia.bijoytel.network;

       location / {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           
           # SSE Streaming Support
           proxy_set_header Cache-Control 'no-cache';
           proxy_buffering off;
           proxy_read_timeout 86400s;
       }

       listen 443 ssl;
       # managed by Certbot SSL certificates...
   }
   ```

---

## 🛠️ Operations & Maintenance Cheat Sheet

### PM2 Process Controls
```bash
# Check service status and memory usage
pm2 status wapp-automata

# View real-time application logs
pm2 logs wapp-automata --lines 50

# Restart service cleanly
pm2 restart wapp-automata

# Clear PM2 log buffers
pm2 flush
```

### Git Updates & Zero-Downtime Rebuilds
```bash
cd /opt/wapp-automata/current
git pull origin main
npm run build
pm2 restart wapp-automata
```

### Database Backup & Location
Each desk’s SQLite database is completely self-contained in a single file:
```bash
# Main desk database
/opt/wapp-automata/current/accounts/telcia-prod/data/scraped.sqlite

# Secondary desks
/opt/wapp-automata/current/accounts/<desk-id>/data/scraped.sqlite

# Create a hot backup safely via SQLite online backup API:
sqlite3 /opt/wapp-automata/current/accounts/telcia-prod/data/scraped.sqlite ".backup '/opt/backups/backup_$(date +%F).sqlite'"
```

---

## 🔒 Security & Data Privacy

- **100% Private On-Premise Operation**: Zero third-party telemetry, zero cloud database replication. All scraped wholesale messages, rates, and numbers stay inside your private VPS.
- **Companion Safety**: Operates in official WhatsApp Web companion mode. Unlike aggressive spam bots that send thousands of unsolicited cold messages, Telcia acts as a passive, non-disruptive reader, keeping phone numbers safe from bans.
- **Physical Session Encryption**: Baileys cryptographic keys (`app-state-sync`, `creds.json`, pre-keys) are protected within strict Unix file permission directories.
- **Secure Password Storage**: Passwords and security credentials are kept in encrypted local storage and SQLite system tables.

---

## 📄 License & Ownership

Developed for **Bijoytel Network** and telecom trading operations. All rights reserved. Private enterprise deployment.
