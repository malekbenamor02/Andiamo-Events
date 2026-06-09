/**
 * GET /api/presale/required?eventId=
 * (Bundled into api/presale.js for Vercel Hobby serverless count.)
 */
import '../../lib/sentry-server.js';
import { createClient } from '@supabase/supabase-js';
import { publicApiError, PUBLIC_ERROR_CODES } from './public-api-error.js';

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) corsUtils = await import('../../lib/cors.js');
  return corsUtils;
}

function trimEnv(v) {
  if (v == null || typeof v !== 'string') return v;
  return v.trim().replace(/^["']|["']$/g, '');
}

function dbClient() {
  const url = trimEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const anon = trimEnv(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY);
  if (!url || !anon) return null;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(url, trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY));
  }
  return createClient(url, anon);
}

export async function handlePresaleRequired(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (handlePreflight(req, res, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) return;
  if (!setCORSHeaders(res, req, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
    if (req.headers.origin) return publicApiError(res, 403, PUBLIC_ERROR_CODES.INVALID_ACCESS);
  }

  if (req.method !== 'GET') {
    return publicApiError(res, 405, PUBLIC_ERROR_CODES.INVALID_REQUEST);
  }

  const client = dbClient();
  if (!client) {
    return publicApiError(res, 503, PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE, undefined, {
      logDetails: 'presale-required: Supabase not configured',
    });
  }

  const eventId =
    req.query?.eventId || new URL(req.url || '', 'http://localhost').searchParams.get('eventId');
  if (!eventId || !String(eventId).trim()) {
    return publicApiError(res, 400, PUBLIC_ERROR_CODES.VALIDATION_FAILED);
  }

  const { data, error } = await client
    .from('events')
    .select('presale_enabled')
    .eq('id', String(eventId).trim())
    .maybeSingle();

  if (error) {
    console.error('presale-required', error);
    const msg = error.message || String(error);
    const network = /fetch failed|ECONNREFUSED|ENOTFOUND|getaddrinfo|certificate/i.test(msg);
    return publicApiError(
      res,
      network ? 503 : 500,
      PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE,
      undefined,
      { logDetails: msg, details: msg },
    );
  }
  if (!data) {
    return res.status(404).json({ required: false, found: false });
  }

  return res.status(200).json({ required: !!data.presale_enabled, found: true });
}
