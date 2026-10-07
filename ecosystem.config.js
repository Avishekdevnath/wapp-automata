/**
 * PM2 Process Supervisor Configuration
 * Enterprise Fault-Tolerant Setup for Hostinger VPS
 */
module.exports = {
  apps: [
    {
      name: 'wapp-automata',
      script: './backend/dist/index.js',
      instances: 1, // Strictly single instance: prevents SQLite WAL concurrent writer lock & Baileys socket collision
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',                     // Resets restart counter after 10s of stable execution
      exp_backoff_restart_delay: 200,        // Exponential backoff prevents rapid restart loops on network outage
      max_memory_restart: '250M',           // Cleanly recycle process if memory exceeds 250MB
      watch: false,
      kill_timeout: 10000,                  // 10s grace period for WAL checkpoint & socket closure
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'wapp-dashboard',
      script: './backend/src/server/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 20,
      min_uptime: '10s',
      exp_backoff_restart_delay: 200,
      max_memory_restart: '300M',
      watch: false,
      kill_timeout: 5000,
      env: {
        PORT: 4000,
        NODE_ENV: 'production',
        WEBHOOK_SECRET: 'local_dev_webhook_secret_key_12345'
      }
    }
  ]
};
