const { execSync } = require('child_process');

const VPS_HOST = process.env.VPS_HOST || '201.18.215.195';
const VPS_USER = process.env.VPS_USER || 'root';
const VPS_DIR = process.env.VPS_DIR || '/opt/wapp-automata/current';

console.log('=====================================================');
console.log('🚀 Telcia • Telecom Intelligent Agent Deployment');
console.log(`📡 Target: ${VPS_USER}@${VPS_HOST}:${VPS_DIR}`);
console.log('=====================================================\n');

try {
  // 1. Check local git status
  console.log('🔍 Checking git status...');
  const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
  if (status) {
    console.warn('⚠️  Notice: You have uncommitted local changes:\n' + status);
    console.warn('Please commit and push your changes before deploying so Hostinger receives them.\n');
  }

  // 2. Run remote pull, build & restart on VPS
  console.log('🔄 Executing remote pull, build, and restart on VPS...');
  const remoteCmd = `cd ${VPS_DIR} && git pull && npm run build && pm2 restart all --update-env && pm2 status`;
  
  execSync(`ssh ${VPS_USER}@${VPS_HOST} "${remoteCmd}"`, {
    stdio: 'inherit'
  });

  console.log('\n=====================================================');
  console.log('✅ Deployment to Hostinger VPS Completed Successfully!');
  console.log(`🌐 Live Dashboard: http://${VPS_HOST}:4000/`);
  console.log('=====================================================');
} catch (err) {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
}
