/**
 * Public event promo: availability + validate (preview only; server authority).
 */
import '../../lib/sentry-server.js';
import { createClient } from '@supabase/supabase-js';
import { getClientIp } from './presale-server.js';
import {
  buildValidatePassLines,
  isEventPromoCheckoutAvailable,
  previewCheckoutTotals,
} from './event-promo-pricing.js';
import { normalizeEventPromoCode } from './event-promo-code.js';
import { resolveEventPromoForValidate } from './event-promo-server.js';
import { requireEventPromoPepperOr503 } from './event-promo-hash.js';
import { publicApiError, PUBLIC_ERROR_CODES } from './public-api-error.js';

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) corsUtils = await import('../../lib/cors.js');
  return corsUtils;
}

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

function requireServiceDb(res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    publicApiError(res, 503, PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE, undefined, {
      logDetails: 'Promo API: SUPABASE_SERVICE_ROLE_KEY missing',
    });
    return null;
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk.toString();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getQueryParam(req, name) {
  const raw = String(req.url || '');
  try {
    const base = /^https?:\/\//i.test(raw) ? raw : `http://localhost${raw.startsWith('/') ? raw : `/${raw}`}`;
    return new URL(base).searchParams.get(name);
  } catch {
    return null;
  }
}

async function logPromoAttempt(db, { eventId, promoCodeId, ip, success, failureReason }) {
  try {
    await db.from('event_promo_attempts').insert({
      event_id: eventId,
      promo_code_id: promoCodeId || null,
      ip_address: ip?.slice(0, 128) || null,
      success: !!success,
      failure_reason: failureReason || null,
    });
  } catch (e) {
    console.error('event_promo_attempts insert', e);
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function handleEventPromoAvailability(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (
    handlePreflight(req, res, {
      methods: 'GET, OPTIONS',
      headers: 'Content-Type',
    })
  ) {
    return;
  }
  if (
    !setCORSHeaders(res, req, {
      methods: 'GET, OPTIONS',
      headers: 'Content-Type',
    })
  ) {
    if (req.headers.origin) return res.status(403).json({ error: 'Invalid access' });
  }

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const db = requireServiceDb(res);
    if (!db) return;

    const eventId = getQueryParam(req, 'eventId');
    if (!eventId || !UUID_RE.test(eventId)) {
      return res.status(200).json({ available: false });
    }

    const available = await isEventPromoCheckoutAvailable(db, eventId);
    return res.status(200).json({ available: !!available });
  } catch (e) {
    console.error('handleEventPromoAvailability', e);
    return res.status(200).json({ available: false });
  }
}

export async function handleEventPromoValidate(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (
    handlePreflight(req, res, {
      methods: 'POST, OPTIONS',
      headers: 'Content-Type',
    })
  ) {
    return;
  }
  if (
    !setCORSHeaders(res, req, {
      methods: 'POST, OPTIONS',
      headers: 'Content-Type',
    })
  ) {
    if (req.headers.origin) return res.status(403).json({ error: 'Invalid access' });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!requireEventPromoPepperOr503(res)) return;

    const db = requireServiceDb(res);
    if (!db) return;

    const ip = getClientIp(req);
    const { data: rateRows, error: rateErr } = await db.rpc('event_promo_validate_rate_try', {
      p_ip_key: ip,
    });
    if (rateErr) {
      console.error('event_promo_validate_rate_try', rateErr);
      return res.status(503).json({ valid: false, reason: 'invalid' });
    }
    const rateRow = Array.isArray(rateRows) ? rateRows[0] : rateRows;
    if (!rateRow?.allowed) {
      return res.status(429).json({ valid: false, reason: 'invalid' });
    }

    const body = await readJsonBody(req);
    const eventId = body.eventId != null ? String(body.eventId) : '';
    const paymentMethod = body.paymentMethod != null ? String(body.paymentMethod) : '';
    const promoRaw = body.promoCode ?? body.code;

    if (!eventId || !UUID_RE.test(eventId)) {
      await logPromoAttempt(db, { eventId: eventId || '00000000-0000-4000-8000-000000000000', ip, success: false, failureReason: 'bad_event' });
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    const normalized = normalizeEventPromoCode(promoRaw);
    if (!normalized) {
      await logPromoAttempt(db, { eventId, ip, success: false, failureReason: 'bad_code' });
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    const passesIn = Array.isArray(body.passes) ? body.passes : [];
    if (!passesIn.length) {
      await logPromoAttempt(db, { eventId, ip, success: false, failureReason: 'no_passes' });
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    const totalQty = passesIn.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    if (totalQty > 10) {
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    const passIds = passesIn.map((p) => (p?.passId != null ? String(p.passId) : '')).filter(Boolean);
    const { data: eventPasses, error: passesErr } = await db
      .from('event_passes')
      .select('id, name, price, is_active, event_id')
      .in('id', passIds)
      .eq('event_id', eventId)
      .eq('is_active', true);

    if (passesErr || !eventPasses?.length) {
      await logPromoAttempt(db, { eventId, ip, success: false, failureReason: 'passes' });
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    const lines = buildValidatePassLines(eventPasses, passesIn);
    if (!lines.length) {
      await logPromoAttempt(db, { eventId, ip, success: false, failureReason: 'lines' });
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    const result = await resolveEventPromoForValidate(db, {
      eventId,
      promoCodeRaw: normalized,
      validatedPasses: lines,
      paymentMethod,
    });

    if (!result.valid) {
      await logPromoAttempt(db, { eventId, ip, success: false, failureReason: 'resolve' });
      return res.status(200).json({ valid: false, reason: 'invalid' });
    }

    const feePreview = previewCheckoutTotals(result.discountedSubtotal, paymentMethod);

    await logPromoAttempt(db, {
      eventId,
      promoCodeId: result.promoCodeId,
      ip,
      success: true,
      failureReason: null,
    });

    return res.status(200).json({
      valid: true,
      code: result.code,
      discountAmount: result.discountAmount,
      discountLabel: result.discountLabel,
      subtotalBeforePromo: result.subtotalBeforePromo,
      discountedSubtotal: result.discountedSubtotal,
      feeAmount: feePreview.feeAmount,
      totalWithFees: feePreview.totalWithFees,
    });
  } catch (e) {
    console.error('handleEventPromoValidate', e);
    return res.status(200).json({ valid: false, reason: 'invalid' });
  }
}
