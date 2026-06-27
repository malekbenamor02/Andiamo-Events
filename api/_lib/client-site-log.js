/**
 * Public client activity log ingest — service role insert, rate limited, field allowlist.
 */
import { createServiceRoleClient } from './service-role-client.js';
import { pickAllowedFields, findUnexpectedFields, SITE_LOG_CLIENT_FIELDS } from './admin-data-route-helpers.js';

const rateBuckets = new Map();
const WINDOW_MS = 60_000;
const MAX_PER_IP = 30;

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.length > 0) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    rateBuckets.set(ip, { start: now, count: 1 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_PER_IP;
}

const BLOCKED_MESSAGE_PATTERNS = [
  /password/i,
  /bearer\s+/i,
  /adminToken/i,
  /service_role/i,
  /\$2[aby]\$/,
];

function sanitizeClientLogPayload(body, req) {
  const unexpected = findUnexpectedFields(body, SITE_LOG_CLIENT_FIELDS);
  if (unexpected.length > 0) {
    return { error: 'Unexpected fields in request body' };
  }
  const row = pickAllowedFields(body, SITE_LOG_CLIENT_FIELDS);
  if (!row.log_type || !row.message) {
    return { error: 'log_type and message are required' };
  }
  const msg = String(row.message);
  for (const pattern of BLOCKED_MESSAGE_PATTERNS) {
    if (pattern.test(msg)) {
      return { error: 'Message rejected' };
    }
  }
  if (row.details && typeof row.details === 'object') {
    const detailsStr = JSON.stringify(row.details);
    for (const pattern of BLOCKED_MESSAGE_PATTERNS) {
      if (pattern.test(detailsStr)) {
        return { error: 'Details rejected' };
      }
    }
  }
  row.user_agent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent'].slice(0, 512)
      : null;
  const ip = getClientIp(req);
  if (ip && ip !== 'unknown') {
    row.ip_address = ip.slice(0, 64);
  }
  return { row };
}

export async function handleClientSiteLog(req, res, parseBody) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many log requests' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const sanitized = sanitizeClientLogPayload(body, req);
  if (sanitized.error) {
    return res.status(400).json({ error: sanitized.error });
  }

  const db = await createServiceRoleClient();
  if (!db) {
    return res.status(503).json({ error: 'Logging unavailable' });
  }

  const { error } = await db.from('site_logs').insert(sanitized.row);
  if (error) {
    console.error('client site_log insert failed:', error.code);
    return res.status(500).json({ error: 'Failed to record log' });
  }

  return res.status(204).end();
}

export { SITE_LOG_CLIENT_FIELDS };
