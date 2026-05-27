/**
 * Single Vercel serverless entry for all presale + admin presale-code routes
 * (Hobby plan: 12 function limit).
 */
import '../lib/sentry-server.js';
import { handlePresaleRequired } from './_lib/presale-route-required.js';
import { handlePresaleSession } from './_lib/presale-route-session.js';
import { handlePresaleRedeem } from './_lib/presale-route-redeem.js';
import { handlePresaleAdminCodes } from './_lib/presale-route-admin-codes.js';

function getPathname(req) {
  const raw = String(req.url || req.path || '');
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw).pathname || '/';
    } catch {
      return '/';
    }
  }
  return raw.split('?')[0] || '';
}

export default async function handler(req, res) {
  const path = getPathname(req);

  if (path === '/api/presale/required' || path.startsWith('/api/presale/required/')) {
    return handlePresaleRequired(req, res);
  }
  if (path === '/api/presale/redeem' || path.startsWith('/api/presale/redeem/')) {
    return handlePresaleRedeem(req, res);
  }
  if (path.startsWith('/api/presale/session')) {
    return handlePresaleSession(req, res);
  }
  if (path.startsWith('/api/admin/presale/codes')) {
    return handlePresaleAdminCodes(req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}
