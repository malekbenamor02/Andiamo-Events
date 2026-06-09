/**
 * GET/POST /api/presale/session, POST /api/presale/session/clear
 */
import '../../lib/sentry-server.js';
import { createClient } from '@supabase/supabase-js';
import {
  parseCookie,
  PRESALE_COOKIE_NAME,
  PRESALE_CSRF_HEADER,
  fetchValidPresaleSessionRow,
  clearPresaleCookieHeader,
  loadPresaleCodeWithDiscountPolicy,
} from './presale-server.js';
import { presaleDiscountPolicyToApi } from './presale-discount.js';
import { presaleApiError, publicApiError, PUBLIC_ERROR_CODES } from './public-api-error.js';

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) corsUtils = await import('../../lib/cors.js');
  return corsUtils;
}

function requireServiceDb(res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    presaleApiError(res, 503, 'missing_service_role', 'Presale session: SUPABASE_SERVICE_ROLE_KEY missing');
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

export async function handlePresaleSession(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (handlePreflight(req, res, {
    methods: 'GET, POST, OPTIONS',
    headers: `Content-Type, ${PRESALE_CSRF_HEADER}`,
    credentials: true,
  })) return;
  if (!setCORSHeaders(res, req, {
    methods: 'GET, POST, OPTIONS',
    headers: `Content-Type, ${PRESALE_CSRF_HEADER}`,
    credentials: true,
  })) {
    if (req.headers.origin) {
      return publicApiError(res, 403, PUBLIC_ERROR_CODES.INVALID_ACCESS);
    }
  }

  const client = requireServiceDb(res);
  if (!client) return;

  const url = req.url || '';
  const isClear = url.includes('/session/clear') || url.endsWith('/clear');

  if (req.method === 'POST' && isClear) {
    const sessionId = parseCookie(req, PRESALE_COOKIE_NAME);
    if (!sessionId) {
      res.setHeader('Set-Cookie', clearPresaleCookieHeader());
      return res.status(200).json({ success: true });
    }
    const { data: row } = await client
      .from('presale_sessions')
      .select('id, invalidated_at')
      .eq('id', sessionId)
      .maybeSingle();
    if (row && !row.invalidated_at) {
      await client
        .from('presale_sessions')
        .update({ invalidated_at: new Date().toISOString(), invalidated_reason: 'gate_reset' })
        .eq('id', sessionId);
    }
    res.setHeader('Set-Cookie', clearPresaleCookieHeader());
    return res.status(200).json({ success: true });
  }

  async function sessionPayloadForRow(row, eventId, includeCsrf) {
    let discount_type = null;
    let discount_value = null;
    let discount_policy = null;
    try {
      const loaded = await loadPresaleCodeWithDiscountPolicy(client, row.presale_code_id);
      if (loaded) {
        discount_policy = presaleDiscountPolicyToApi(loaded.policy);
        if (loaded.policy.mode === 'uniform' && loaded.policy.uniform) {
          discount_type = loaded.policy.uniform.discount_type;
          discount_value = loaded.policy.uniform.discount_value;
        }
      }
    } catch (e) {
      console.error('presale-session discount lookup', e);
    }
    const base = {
      valid: true,
      eventId,
      presaleCodeId: row.presale_code_id,
      expiresAt: row.expires_at,
      discount_type,
      discount_value,
      discount_policy,
    };
    if (includeCsrf) {
      return { ...base, csrfToken: row.csrf_token };
    }
    return base;
  }

  if (req.method === 'POST' && !isClear) {
    try {
      const body = await readJsonBody(req);
      const eventId = body?.eventId ? String(body.eventId).trim() : '';
      if (!eventId) {
        return publicApiError(res, 400, PUBLIC_ERROR_CODES.VALIDATION_FAILED);
      }
      const sessionId = parseCookie(req, PRESALE_COOKIE_NAME);
      if (!sessionId) {
        return res.status(401).json({ valid: false });
      }
      const row = await fetchValidPresaleSessionRow(client, sessionId, eventId);
      if (!row) {
        return res.status(401).json({ valid: false });
      }
      res.setHeader('Cache-Control', 'no-store, private');
      const payload = await sessionPayloadForRow(row, eventId, true);
      return res.status(200).json(payload);
    } catch (e) {
      console.error('presale-session POST', e);
      return res.status(401).json({ valid: false });
    }
  }

  if (req.method !== 'GET') {
    return publicApiError(res, 405, PUBLIC_ERROR_CODES.INVALID_REQUEST);
  }

  try {
    const eventId = req.query?.eventId || new URL(req.url || '', 'http://localhost').searchParams.get('eventId');
    if (!eventId) {
      return publicApiError(res, 400, PUBLIC_ERROR_CODES.VALIDATION_FAILED);
    }

    const sessionId = parseCookie(req, PRESALE_COOKIE_NAME);
    if (!sessionId) {
      return res.status(401).json({ valid: false });
    }

    const row = await fetchValidPresaleSessionRow(client, sessionId, eventId);
    if (!row) {
      return res.status(401).json({ valid: false });
    }

    res.setHeader('Cache-Control', 'no-store, private');
    const payload = await sessionPayloadForRow(row, eventId, false);
    return res.status(200).json(payload);
  } catch (e) {
    console.error('presale-session', e);
    return res.status(401).json({ valid: false });
  }
}
