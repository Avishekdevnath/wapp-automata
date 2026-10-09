/**
 * Standalone Node.js Process Supervisor for Local WhatsApp Scraper
 * Keeps the server running 24/7, auto-restarting on crashes or unexpected exits.
 */
const { spawn } = require('child_process');
const path = require('path');

const SERVER_SCRIPT = path.join(__dirname, 'server.js');
let child = null;
let restartCount = 0;
let lastRestartTime = Date.now();
let isShuttingDown = false;

function startServer() {
  if (isShuttingDown) return;

  const now = Date.now();
  if (now - lastRestartTime < 10000) {
    restartCount++;
  } else {
    restartCount = 1;
  }
  lastRestartTime = now;

  let delay = 1500;
  if (restartCount > 5) {
    console.warn(`⚠️ [Supervisor] Rapid restarts detected (${restartCount} in 10s). Backing off for 10s...`);
    delay = 10000;
  }

  console.log(`\n🛡️ [Supervisor] Launching Local WhatsApp Scraper (PID check)...`);

  child = spawn(process.execPath, [SERVER_SCRIPT], {
    cwd: __dirname,
    stdio: 'inherit',
    env: process.env
  });

  child.on('error', (err) => {
    console.error(`❌ [Supervisor] Failed to spawn scraper process: ${err.message}`);
  });

  child.on('exit', (code, signal) => {
    console.warn(`⚠️ [Supervisor] Scraper process exited (Code: ${code}, Signal: ${signal}).`);
    child = null;
    if (!isShuttingDown) {
      console.log(`🔄 [Supervisor] Auto-restarting scraper in ${delay}ms...`);
      setTimeout(startServer, delay);
    }
  });
}

function handleShutdown(signal) {
  console.log(`\n🛑 [Supervisor] Received ${signal}. Shutting down scraper cleanly...`);
  isShuttingDown = true;
  if (child) {
    child.kill(signal);
  }
  setTimeout(() => process.exit(0), 4000);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startServer();
