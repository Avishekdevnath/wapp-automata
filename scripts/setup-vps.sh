#!/usr/bin/env bash
# ==============================================================================
# wapp-automata: Ubuntu 24.04 VPS Initial Provisioning Script
# ==============================================================================
set -euo pipefail

echo ">>> [1/6] Updating system packages..."
sudo apt update && sudo apt upgrade -y

echo ">>> [2/6] Installing system prerequisites (curl, git, sqlite3, build tools)..."
sudo apt install -y curl git sqlite3 build-essential

echo ">>> [3/6] Setting up Node.js 20.x LTS via NodeSource..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
else
  echo "Node.js already installed: $(node -v)"
fi

echo ">>> [4/6] Installing PM2 and pm2-logrotate globally..."
sudo npm install -g pm2
sudo pm2 install pm2-logrotate
sudo pm2 set pm2-logrotate:max_size 20M
sudo pm2 set pm2-logrotate:retain 14
sudo pm2 set pm2-logrotate:compress true

echo ">>> [5/6] Creating deployment directories under /opt/wapp-automata..."
sudo mkdir -p /opt/wapp-automata/current
sudo mkdir -p /opt/wapp-automata/data/backups
sudo mkdir -p /opt/wapp-automata/data/.session

# Create system runner user if not exists
if ! id "apprunner" >/dev/null 2>&1; then
  sudo useradd -r -s /bin/false -d /opt/wapp-automata apprunner
fi

sudo chown -R apprunner:apprunner /opt/wapp-automata
sudo chmod 700 /opt/wapp-automata/data/.session

echo ">>> [6/6] Provisioning complete!"
echo "Next steps:"
echo "1. Clone repository to /opt/wapp-automata/current"
echo "2. Copy .env to /opt/wapp-automata/current/.env and set chmod 600"
echo "3. Run 'npm ci && npm run build'"
echo "4. Start via: pm2 start ecosystem.config.js --env production"
echo "5. Save startup config: pm2 save && sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u apprunner --hp /opt/wapp-automata"
