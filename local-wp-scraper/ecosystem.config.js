module.exports = {
  apps: [{
    name: 'telcia-local-scraper',
    script: 'server.js',
    cwd: __dirname,
    watch: false,
    max_memory_restart: '500M',
    restart_delay: 2000,
    autorestart: true,
    env: {
      NODE_ENV: 'production',
      PORT: 5050
    }
  }]
};
