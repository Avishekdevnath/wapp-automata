import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../../');
const ACCOUNTS_ROOT = path.join(ROOT_DIR, 'accounts');

/**
 * Extract active account ID from CLI args, environment, or default fallback.
 */
function resolveInitialAccountId() {
  // 1. Check CLI flags: --account=xyz or --account xyz
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--account=')) {
      return arg.split('=')[1].trim();
    }
    if (arg === '--account' && process.argv[i + 1]) {
      return process.argv[i + 1].trim();
    }
  }

  // 2. Check environment variable
  if (process.env.ACCOUNT_ID && process.env.ACCOUNT_ID.trim()) {
    return process.env.ACCOUNT_ID.trim();
  }

  // 3. Safe production default (never defaults to private sandbox)
  return 'telcia-prod';
}

let currentAccountId = resolveInitialAccountId();

/**
 * Get account directory and required paths for a specific account ID.
 */
export function getAccountPaths(accountId = currentAccountId) {
  const accountDir = path.join(ACCOUNTS_ROOT, accountId);
  const dataDir = path.join(accountDir, 'data');
  const sessionDir = path.join(accountDir, 'session');
  const dbPath = path.join(dataDir, 'scraped.sqlite');
  const configPath = path.join(accountDir, 'config.json');
  const accountJsonPath = path.join(accountDir, 'account.json');

  return {
    accountId,
    accountDir,
    dataDir,
    sessionDir,
    dbPath,
    configPath,
    accountJsonPath,
  };
}

/**
 * Ensure account directories exist.
 */
export function ensureAccountDirs(accountId = currentAccountId) {
  const paths = getAccountPaths(accountId);
  if (!fs.existsSync(paths.accountDir)) {
    fs.mkdirSync(paths.accountDir, { recursive: true });
  }
  if (!fs.existsSync(paths.dataDir)) {
    fs.mkdirSync(paths.dataDir, { recursive: true });
  }
  if (!fs.existsSync(paths.sessionDir)) {
    fs.mkdirSync(paths.sessionDir, { recursive: true });
  }
  return paths;
}

/**
 * Load account metadata descriptor.
 */
export function getAccountMetadata(accountId = currentAccountId) {
  const paths = getAccountPaths(accountId);
  if (fs.existsSync(paths.accountJsonPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(paths.accountJsonPath, 'utf8'));
      return { id: accountId, ...data };
    } catch {
      // Fallback if invalid JSON
    }
  }
  return {
    id: accountId,
    name: accountId,
    role: accountId.includes('prod') ? 'client' : 'admin',
    description: `Workspace for ${accountId}`,
  };
}

/**
 * Load account runtime configuration (port, webhook, etc.).
 */
export function getAccountConfig(accountId = currentAccountId) {
  const paths = getAccountPaths(accountId);
  const defaults = {
    port: 5051,
    webhookUrl: '',
    webhookSecret: '',
    logLevel: 'info',
  };

  if (fs.existsSync(paths.configPath)) {
    try {
      const custom = JSON.parse(fs.readFileSync(paths.configPath, 'utf8'));
      return { ...defaults, ...custom };
    } catch (err) {
      console.warn(`[Account] Failed to parse config.json for ${accountId}:`, err.message);
    }
  }
  return defaults;
}

/**
 * List all available accounts by scanning the accounts directory.
 */
export function listAccounts() {
  if (!fs.existsSync(ACCOUNTS_ROOT)) {
    return [];
  }

  const entries = fs.readdirSync(ACCOUNTS_ROOT, { withFileTypes: true });
  const accounts = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const meta = getAccountMetadata(entry.name);
      accounts.push({
        ...meta,
        isActive: entry.name === currentAccountId,
      });
    }
  }

  return accounts;
}

/**
 * Get active account ID.
 */
export function getActiveAccountId() {
  return currentAccountId;
}

/**
 * Set active account ID at runtime.
 */
export function setActiveAccountId(accountId) {
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Invalid account ID');
  }
  const cleanId = accountId.trim();
  ensureAccountDirs(cleanId);
  currentAccountId = cleanId;
  return getAccountPaths(cleanId);
}

// Initial self-validation
ensureAccountDirs(currentAccountId);
