/**
 * PM2 Process Supervisor Configuration
 * wapp-automata: WhatsApp Raw Message Collector
 */
module.exports = {
  apps: [
    {
      name: 'wapp-automata',
      script: './dist/index.js',
      instances: 1, // Strictly single instance: prevents SQLite WAL concurrent writer corruption & multiple WhatsApp socket conflicts
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '250M',
      watch: false,
      kill_timeout: 10000, // 10s grace period for graceful shutdown handlers
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'wapp-dashboard',
      script: './scripts/local-receiver.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      env: {
        PORT: 4000,
        NODE_ENV: 'production',
        WEBHOOK_SECRET: 'local_dev_webhook_secret_key_12345'
      }
    }
  ]
};
