/**
 * Single Vercel serverless entry for presale + checkout promo code routes
 * (Hobby plan: max 12 serverless functions — do not add a separate event-promo.js).
 */
import '../lib/sentry-server.js';
import { handlePresaleRequired } from './_lib/presale-route-required.js';
import { handlePresaleSession } from './_lib/presale-route-session.js';
import { handlePresaleRedeem } from './_lib/presale-route-redeem.js';
import { handlePresaleAdminCodes } from './_lib/presale-route-admin-codes.js';
import { handleEventPromoAdminCodes } from './_lib/event-promo-route-admin.js';
import {
  handleEventPromoAvailability,
  handleEventPromoValidate,
} from './_lib/event-promo-route-public.js';

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

  if (path.startsWith('/api/event-promo/')) {
    if (path === '/api/event-promo/availability' || path.startsWith('/api/event-promo/availability/')) {
      return handleEventPromoAvailability(req, res);
    }
    if (path === '/api/event-promo/validate' || path.startsWith('/api/event-promo/validate/')) {
      return handleEventPromoValidate(req, res);
    }
    return res.status(404).json({ error: 'Not found' });
  }
  if (path.startsWith('/api/admin/event-promo/')) {
    return handleEventPromoAdminCodes(req, res);
  }

  return res.status(404).json({ error: 'Not found' });
}
