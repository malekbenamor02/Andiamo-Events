'use strict';

const { isValidSecureToken } = require('./ticket-qr-url.cjs');
const { generateTicketQrPngBuffer } = require('./ticket-qr-generate.cjs');
const {
  getClientIp,
  enforceRateLimits,
  respondToRateLimit,
} = require('./rate-limit/index.cjs');

async function findActiveTicketByToken(db, secureToken) {
  const { data: ticket } = await db
    .from('tickets')
    .select('id, secure_token, status, ticket_status')
    .eq('secure_token', secureToken)
    .maybeSingle();
  if (ticket) {
    const status = String(ticket.status || ticket.ticket_status || '').toUpperCase();
    if (status && ['VOID', 'CANCELLED', 'REVOKED', 'INVALID'].includes(status)) {
      return null;
    }
    return ticket;
  }

  const { data: qrTicket } = await db
    .from('qr_tickets')
    .select('id, secure_token, ticket_status, status')
    .eq('secure_token', secureToken)
    .maybeSingle();
  if (!qrTicket) return null;
  const st = String(qrTicket.ticket_status || qrTicket.status || '').toUpperCase();
  if (st && ['VOID', 'CANCELLED', 'REVOKED', 'INVALID'].includes(st)) {
    return null;
  }
  return qrTicket;
}

function extractSecureTokenFromRequest(req) {
  const fromParams = req.params?.secureToken;
  if (fromParams) return String(fromParams).trim();
  const raw = String(req.url || req.path || '').split('?')[0];
  const prefix = '/api/tickets/qr/';
  const idx = raw.indexOf(prefix);
  if (idx >= 0) return decodeURIComponent(raw.slice(idx + prefix.length)).trim();
  const fromQuery = req.query?.token;
  return fromQuery ? String(fromQuery).trim() : '';
}

async function handleTicketQrRequest(req, res, getServiceDb) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secureToken = extractSecureTokenFromRequest(req);
  if (!isValidSecureToken(secureToken)) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const ip = getClientIp(req);
  const rl = await enforceRateLimits({
    req,
    policyId: 'QR_TICKET',
    segments: { ip, token: secureToken },
  });
  if (respondToRateLimit(res, rl)) return;

  const db = typeof getServiceDb === 'function' ? getServiceDb() : getServiceDb;
  if (!db) {
    return res.status(503).json({ error: 'Service unavailable' });
  }

  const row = await findActiveTicketByToken(db, secureToken);
  if (!row) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const png = await generateTicketQrPngBuffer(secureToken);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(png);
  } catch {
    console.error('[ticket-qr] generate failed');
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
}

function registerTicketQrRoute(app, getServiceDb) {
  app.get('/api/tickets/qr/:secureToken', async (req, res) => {
    try {
      return handleTicketQrRequest(req, res, getServiceDb);
    } catch {
      console.error('[ticket-qr] route error');
      return res.status(500).json({ error: 'Server error' });
    }
  });
}

module.exports = {
  registerTicketQrRoute,
  handleTicketQrRequest,
  findActiveTicketByToken,
};
