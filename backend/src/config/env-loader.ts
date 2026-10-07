import fs from 'node:fs';
import path from 'node:path';

/**
 * Lightweight, zero-dependency .env file parser.
 * Populates process.env with key-value pairs if not already defined.
 */
export function loadDotEnv(envFilePath?: string): void {
  let filePath = envFilePath || path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(filePath)) {
    const parentPath = path.resolve(process.cwd(), '..', '.env');
    if (fs.existsSync(parentPath)) {
      filePath = parentPath;
    } else {
      return;
    }
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines and comment lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, equalsIndex).trim();
      let value = trimmed.slice(equalsIndex + 1).trim();

      // Strip surrounding quotes if present
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Do not overwrite existing environment variables set by process supervisor / shell
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // If .env cannot be read, continue with existing process.env
    // Logger may not be initialized yet
  }
}
