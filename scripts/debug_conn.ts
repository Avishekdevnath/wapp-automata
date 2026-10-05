import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';

async function main() {
  const sessionDir = path.join(__dirname, '..', '.session');
  console.log('[*] Session dir:', sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'debug' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('[QR] New QR needed');
    }
    if (connection) {
      console.log('[STATE]', connection);
    }
    if (connection === 'close') {
      const err = lastDisconnect?.error;
      console.log('[CLOSE ERROR]', err);
      console.log('[STATUS CODE]', (err as any)?.output?.statusCode);
    }
    if (connection === 'open') {
      console.log('[SUCCESS] Connected to WhatsApp!');
    }
  });
}

main().catch(console.error);
