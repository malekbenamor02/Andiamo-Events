/**
 * POST /api/presale/redeem
 * Body: { eventId, code, recaptchaToken }
 */
import '../lib/sentry-server.js';
import { createClient } from '@supabase/supabase-js';
import {
  getClientIp,
  hashPresaleCode,
  newCsrfToken,
  presaleCookieHeaderValue,
  requirePresalePepperOr503,
} from './lib/presale-server.js';

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) corsUtils = await import('../lib/cors.js');
  return corsUtils;
}

async function verifyRecaptcha(recaptchaToken) {
  const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
  if (!RECAPTCHA_SECRET_KEY) return true;
  if (!recaptchaToken || recaptchaToken === 'localhost-bypass-token') return true;
  const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${RECAPTCHA_SECRET_KEY}&response=${encodeURIComponent(recaptchaToken)}`,
  });
  const verifyData = await verifyResponse.json();
  return !!verifyData.success;
}

function requireServiceDb(res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    res.status(503).json({
      success: false,
      reason: 'missing_service_role',
      message:
        'Presale requires SUPABASE_SERVICE_ROLE_KEY on the API server (RLS blocks anon reads on presale_codes).',
    });
    return null;
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export default async function handler(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (handlePreflight(req, res, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, X-Presale-CSRF',
    credentials: true,
  })) return;
  if (!setCORSHeaders(res, req, {
    methods: 'POST, OPTIONS',
    headers: 'Content-Type, X-Presale-CSRF',
    credentials: true,
  })) {
    if (req.headers.origin) {
      return res.status(403).json({ error: 'Invalid access' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const client = requireServiceDb(res);
    if (!client) return;
    if (!requirePresalePepperOr503(res)) return;

    const ip = getClientIp(req);
    const { data: rateRows, error: rateErr } = await client.rpc('presale_redeem_rate_try', {
      p_ip_key: ip,
    });
    if (rateErr) {
      console.error('presale_redeem_rate_try', rateErr);
      return res.status(503).json({
        success: false,
        reason: 'server_error',
        message: 'Could not apply rate limit. Ensure database migrations are applied.',
      });
    }
    const rateRow = Array.isArray(rateRows) ? rateRows[0] : rateRows;
    if (!rateRow?.allowed) {
      return res.status(429).json({
        success: false,
        reason: 'rate_limited',
        message: 'Too many attempts. Try again later.',
      });
    }

    let body = {};
    if (req.body) body = req.body;
    else {
      let raw = '';
      for await (const chunk of req) raw += chunk.toString();
      if (raw) body = JSON.parse(raw);
    }

    const { eventId, code, recaptchaToken } = body;
    if (!eventId || !code) {
      return res.status(400).json({ success: false, reason: 'missing_fields', message: 'eventId and code required' });
    }

    const okCaptcha = await verifyRecaptcha(recaptchaToken);
    if (!okCaptcha) {
      return res.status(403).json({ success: false, reason: 'captcha_failed', message: 'Verification failed' });
    }

    const { data: event, error: evErr } = await client
      .from('events')
      .select('id, presale_enabled')
      .eq('id', eventId)
      .single();

    if (evErr || !event) {
      return res.status(403).json({ success: false, reason: 'event_not_found', message: 'Event not found' });
    }
    if (!event.presale_enabled) {
      return res.status(403).json({
        success: false,
        reason: 'presale_off',
        message:
          'Presale is not enabled for this event. In admin, open the event, enable presale (code gate), and save.',
      });
    }

    const now = new Date();

    const codeHash = hashPresaleCode(eventId, code);

    const { data: matched, error: codeErr } = await client
      .from('presale_codes')
      .select('*')
      .eq('event_id', eventId)
      .eq('code_hash', codeHash)
      .is('revoked_at', null)
      .is('paused_at', null)
      .maybeSingle();

    if (codeErr) {
      console.error('presale redeem codes query', codeErr);
      return res.status(500).json({ success: false, reason: 'server_error', message: 'Could not verify code' });
    }

    const logAttempt = async (presaleCodeId, success, failureReason) => {
      try {
        await client.from('presale_code_attempts').insert({
          presale_code_id: presaleCodeId,
          event_id: eventId,
          ip_address: ip,
          success,
          failure_reason: failureReason,
        });
      } catch (e) {
        console.error('presale attempt log', e);
      }
    };

    if (!matched) {
      await logAttempt(null, false, 'no_match');
      return res.status(403).json({ success: false, reason: 'code_not_found', message: 'Code not recognized' });
    }

    if (matched.active_from && new Date(matched.active_from) > now) {
      await logAttempt(matched.id, false, 'window');
      return res.status(403).json({ success: false, reason: 'code_not_active_yet', message: 'This code is not active yet' });
    }
    if (matched.active_until && new Date(matched.active_until) < now) {
      await logAttempt(matched.id, false, 'window');
      return res.status(403).json({ success: false, reason: 'code_expired', message: 'This code has expired' });
    }

    if (matched.usage_mode === 'single_use' && (matched.successful_order_count || 0) >= 1) {
      await logAttempt(matched.id, false, 'exhausted');
      return res.status(403).json({ success: false, reason: 'code_exhausted', message: 'This code has already been used' });
    }

    if (
      matched.max_total_redemptions != null
      && (matched.successful_order_count || 0) >= matched.max_total_redemptions
    ) {
      await logAttempt(matched.id, false, 'exhausted');
      return res.status(403).json({
        success: false,
        reason: 'code_exhausted',
        message: 'This code has reached its maximum number of orders',
      });
    }

    const csrf = newCsrfToken();
    const PRESALE_SESSION_DB_TTL_MS = 8 * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + PRESALE_SESSION_DB_TTL_MS).toISOString();

    const { data: sessionRow, error: sessErr } = await client
      .from('presale_sessions')
      .insert({
        event_id: eventId,
        presale_code_id: matched.id,
        csrf_token: csrf,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (sessErr || !sessionRow) {
      console.error('presale session insert', sessErr);
      return res.status(500).json({
        success: false,
        reason: 'session_create_failed',
        message: 'Could not start presale session',
      });
    }

    await logAttempt(matched.id, true, null);

    res.setHeader('Set-Cookie', presaleCookieHeaderValue(sessionRow.id));
    return res.status(200).json({
      success: true,
      csrfToken: csrf,
      expiresAt,
      presaleCodeId: matched.id,
      discount_type: matched.discount_type,
      discount_value: matched.discount_value != null ? Number(matched.discount_value) : null,
    });
  } catch (e) {
    console.error('presale-redeem', e);
    return res.status(500).json({ success: false, reason: 'server_error', message: 'Unexpected error' });
  }
}
