// GET /api/tickets/qr/:secureToken
// Dedicated Vercel function (do not route through misc.js rewrite — path dispatch breaks on rewrite).

import { createRequire } from 'module';
import nodePath from 'path';
import { fileURLToPath } from 'url';

const __dirname = nodePath.dirname(fileURLToPath(import.meta.url));
const requireFromRoot = createRequire(import.meta.url);

const { handleTicketQrRequest } = requireFromRoot(
  nodePath.join(__dirname, '..', '..', '_lib', 'ticket-qr-route.cjs')
);
const { getServiceDb } = requireFromRoot(
  nodePath.join(__dirname, '..', '..', '_lib', 'register-storage-security-routes.cjs')
);

export default async function handler(req, res) {
  try {
    const tokenFromQuery = req.query?.secureToken;
    if (tokenFromQuery && !req.params?.secureToken) {
      req.params = { ...(req.params || {}), secureToken: String(tokenFromQuery) };
    }
    await handleTicketQrRequest(req, res, getServiceDb);
  } catch (err) {
    console.error('[tickets-qr] handler error', err instanceof Error ? err.message : 'unknown');
    if (res.headersSent) return;
    if (typeof res.status === 'function' && typeof res.json === 'function') {
      return res.status(503).json({ error: 'service_unavailable' });
    }
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'service_unavailable' }));
  }
}
