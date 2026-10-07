import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { WASocket } from '@whiskeysockets/baileys';
import { rootLogger } from '../../logging';

const logger = rootLogger.forModule('baileys-session-mgr');

/**
 * Generates an instant base64 PNG data URL for the pairing QR string.
 */
export async function generateQrDataUrl(qr: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
  } catch (err) {
    logger.debug('Failed to generate QR data URL', { error: err });
    return null;
  }
}

/**
 * Atomically writes session connection state to session_state.json.
 */
export function writeSessionState(sessionPath: string, state: Record<string, unknown>): void {
  try {
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }
    fs.writeFileSync(
      path.join(sessionPath, 'session_state.json'),
      JSON.stringify(state, null, 2),
      'utf8'
    );
  } catch (err) {
    logger.debug('Could not write session state file', { error: err });
  }
}

/**
 * Cleans multi-file authentication keys while preserving state and caches.
 */
export function purgeSessionFiles(sessionPath: string): void {
  try {
    if (fs.existsSync(sessionPath)) {
      const files = fs.readdirSync(sessionPath);
      for (const file of files) {
        if (file !== 'session_state.json' && file !== 'lid_cache.json' && file !== 'archived_chats.json') {
          fs.rmSync(path.join(sessionPath, file), { recursive: true, force: true });
        }
      }
    }
  } catch (cleanErr) {
    logger.error('Failed to clean session directory', { error: cleanErr });
  }
}

/**
 * Checks for user 8-digit phone pairing requests and handles WhatsApp pairing code generation.
 */
export async function processPairCodeRequest(
  resolvedSessionDir: string,
  sock: WASocket,
  lastQR: string | null,
  isRegistered: boolean,
  onCodeGenerated: (state: Record<string, unknown>) => void
): Promise<void> {
  try {
    const pairFile = path.join(resolvedSessionDir, 'pair_request.json');
    if (fs.existsSync(pairFile)) {
      const raw = fs.readFileSync(pairFile, 'utf8');
      fs.rmSync(pairFile, { force: true });
      const parsed = JSON.parse(raw);
      if (parsed && parsed.phone && !isRegistered) {
        let clean = String(parsed.phone).replace(/[^0-9]/g, '');
        if (clean.startsWith('00')) clean = clean.substring(2);
        // Normalize Bangladeshi local prefix (01XXXXXXXXX -> 8801XXXXXXXXX)
        if (clean.startsWith('01') && clean.length === 11) {
          clean = '880' + clean.substring(1);
        }
        if (clean.length >= 8) {
          logger.info('Requesting WhatsApp 8-digit pairing code', { phone: clean });
          const code = await sock.requestPairingCode(clean);
          logger.info('Generated WhatsApp pairing code:', { code });
          onCodeGenerated({
            status: 'scan_qr',
            qr: lastQR,
            pairingCode: code,
            pairingPhone: clean,
            updatedAt: Date.now()
          });
        }
      }
    }
  } catch (err) {
    logger.error('Error handling pairing code request', { error: String(err) });
  }
}
