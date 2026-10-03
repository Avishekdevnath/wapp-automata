import fs from 'node:fs';
import path from 'node:path';
import { rootLogger } from '../../logging';

const logger = rootLogger.forModule('baileys-session');

/**
 * Initializes and verifies the local session directory for storing
 * multi-device cryptographic key pairs and credentials.
 */
export function initSessionDirectory(sessionDir: string): string {
  const resolvedPath = path.resolve(sessionDir);

  if (!fs.existsSync(resolvedPath)) {
    logger.info('Creating session directory for WhatsApp credentials', { sessionDir: resolvedPath });
    fs.mkdirSync(resolvedPath, { recursive: true, mode: 0o700 });
  }

  return resolvedPath;
}
