/**
 * PM2 Process Supervisor Configuration
 * Single Modular Monolith Process on VPS (Port 5051)
 */
module.exports = {
  apps: [
    {
      name: 'wapp-automata',
      script: './backend/src/server.js',
      instances: 1, // Single instance: prevents SQLite WAL concurrent writer lock & Baileys socket collision
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      exp_backoff_restart_delay: 200,
      max_memory_restart: '250M',
      watch: false,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        ACCOUNT_ID: 'telcia-prod',
        PORT: 4000
      }
    }
  ]
};
