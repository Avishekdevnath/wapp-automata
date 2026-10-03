/**
 * WhatsApp Raw Collector
 * Service entry point (Phase 1 Stub)
 */

export const SERVICE_NAME = 'wapp-automata';
export const SERVICE_VERSION = '0.1.0';

export function getServiceInfo(): { name: string; version: string; status: string } {
  return {
    name: SERVICE_NAME,
    version: SERVICE_VERSION,
    status: 'initialized'
  };
}

if (require.main === module) {
  const info = getServiceInfo();
  // eslint-disable-next-line no-console
  console.log(`[${info.name} v${info.version}] Service stub initialized.`);
}
