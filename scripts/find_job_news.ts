import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';
import path from 'path';

async function main() {
  const sessionDir = path.join(__dirname, '..', '.session');
  console.log('[*] Loading session from:', sessionDir);

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('[QR] QR Code received - need scan');
    }
    if (connection === 'close') {
      console.log('[CONN] Connection closed:', lastDisconnect?.error?.message);
    }
    if (connection === 'open') {
      console.log('[CONN] WhatsApp connected successfully!');
      try {
        const groups = await sock.groupFetchAllParticipating();
        console.log(`[GROUPS] Found ${Object.keys(groups).length} groups:`);
        for (const [jid, metadata] of Object.entries(groups)) {
          console.log(`  - "${metadata.subject}" (JID: ${jid})`);
        }
      } catch (err) {
        console.error('[ERROR] fetching groups:', err);
      } finally {
        sock.end(undefined);
        process.exit(0);
      }
    }
  });
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
