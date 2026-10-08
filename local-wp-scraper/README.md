# Local WhatsApp Scraper & Message Catcher (Isolated Testing Suite)

A 100% standalone, isolated local environment for:
1. Logging into WhatsApp via QR Code or Phone Pairing Code.
2. Logging out and clearing session credentials on demand.
3. Catching, displaying, searching, and exporting WhatsApp messages in real time.
4. Testing pure message scraping logic with **plain HTML** and zero framework bloat.

---

## 🔒 Complete Isolation Guarantee

- **Separate Session Directory**: Stored in `./session/`. It does **not** touch or interfere with the main project's `.session/` or `/opt/wapp-automata/` session.
- **Separate Database**: Stored in `./data/scraped.sqlite`. It does **not** touch `collector.sqlite` or any main project tables.
- **Separate Port**: Runs on **Port 5050** (configurable via `PORT` env).
- **Plain HTML**: Built with pure vanilla HTML, CSS, and JavaScript. No React, no Vite, no compilation step needed.

---

## 🚀 How to Run Locally

From the root directory:

```bash
node local-wp-scraper/server.js
```

Or from inside the directory:

```bash
cd local-wp-scraper
npm start
```

Then open your browser at:
👉 **`http://localhost:5050/`**

---

## ✨ Features

- **Real-Time Stream**: Uses Server-Sent Events (SSE) to push incoming messages instantly to your browser without polling.
- **Login / QR Code**: Auto-renders QR code or gives an 8-digit phone pairing code.
- **Logout & Reset**: 1-click button to cleanly close Baileys socket and delete the `./session/` credentials.
- **Filters & Search**: Filter by *All*, *Groups Only*, *DMs Only*, or *With Media*. Instant search by message text, sender name, or phone.
- **Raw JSON Inspection**: Click *"View Raw JSON"* under any message to inspect the exact Baileys proto payload.
- **Export & Clear**: Download all messages as `scraped_messages.json` or clear the SQLite database with 1 click.
