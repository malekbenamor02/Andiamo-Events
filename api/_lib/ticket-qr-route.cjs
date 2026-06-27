'use strict';

const { isValidSecureToken } = require('./ticket-qr-url.cjs');
const { generateTicketQrPngBuffer } = require('./ticket-qr-generate.cjs');

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 60;
const rateByIp = new Map();

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  let rec = rateByIp.get(ip);
  if (!rec || now > rec.resetAt) {
    rateByIp.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  rec.count += 1;
  return rec.count <= RATE_MAX;
}

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

async function handleTicketQrRequest(req, res, db) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secureToken = extractSecureTokenFromRequest(req);
  if (!isValidSecureToken(secureToken)) {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

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
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.status(200).send(png);
  } catch (err) {
    console.error('[ticket-qr] generate failed');
    return res.status(500).json({ error: 'Failed to generate QR code' });
  }
}

function registerTicketQrRoute(app, getServiceDb) {
  app.get('/api/tickets/qr/:secureToken', async (req, res) => {
    try {
      const db = typeof getServiceDb === 'function' ? getServiceDb() : getServiceDb;
      return handleTicketQrRequest(req, res, db);
    } catch (e) {
      console.error('[ticket-qr] route error', e.message);
      return res.status(500).json({ error: 'Server error' });
    }
  });
}

module.exports = {
  registerTicketQrRoute,
  handleTicketQrRequest,
  findActiveTicketByToken,
};
