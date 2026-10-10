// Shared SSE (Server-Sent Events) Broadcaster for TELCIA
export const sseClients = new Set();

export function broadcastSse(type, payload) {
  const message = `data: ${JSON.stringify({ type, data: payload })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}
