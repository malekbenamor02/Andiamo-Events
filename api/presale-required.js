/**
 * GET /api/presale/required?eventId=
 * Authoritative presale flag from DB (same source as /api/passes gating).
 * Public read — events.presale_enabled is readable with anon RLS; service role preferred when set.
 */
import '../lib/sentry-server.js';
import { createClient } from '@supabase/supabase-js';

let corsUtils = null;
async function getCorsUtils() {
  if (!corsUtils) corsUtils = await import('../lib/cors.js');
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

export default async function handler(req, res) {
  const { setCORSHeaders, handlePreflight } = await getCorsUtils();
  if (handlePreflight(req, res, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) return;
  if (!setCORSHeaders(res, req, { methods: 'GET, OPTIONS', headers: 'Content-Type', credentials: true })) {
    if (req.headers.origin) return res.status(403).json({ error: 'Invalid access' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const client = dbClient();
  if (!client) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const eventId =
    req.query?.eventId || new URL(req.url || '', 'http://localhost').searchParams.get('eventId');
  if (!eventId || !String(eventId).trim()) {
    return res.status(400).json({ error: 'eventId required' });
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
    return res.status(network ? 503 : 500).json({
      error: network ? 'supabase_unreachable' : 'query failed',
      details: msg,
    });
  }
  if (!data) {
    return res.status(404).json({ required: false, found: false });
  }

  return res.status(200).json({ required: !!data.presale_enabled, found: true });
}
