/**
 * GET /api/events/by-slug/:slug — resolve one event for direct URL (includes presale).
 * Service role lookup; does not expose bulk presale enumeration via Supabase anon SELECT.
 */
import { createServiceRoleClient } from './service-role-client.js';

const PUBLIC_EVENT_COLUMNS =
  'id, name, description, date, venue, city, poster_url, slug, event_type, gallery_images, gallery_videos, event_status, is_test, presale_enabled, presale_active_from, presale_active_until, presale_hide_from_public_list, presale_pass_video_url, presale_pass_mux_playback_id, seating_chart_url, created_at, updated_at';

function generateSlug(text) {
  if (!text || typeof text !== 'string') return '';
  let slug = text.toLowerCase().trim();
  if (!slug) return '';
  slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  slug = slug.replace(/[\s_]+/g, '-');
  slug = slug.replace(/[^a-z0-9-]/g, '');
  slug = slug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return slug;
}

function matchesPublicUrlSlug(event, urlSlug) {
  const normalizedSlug = decodeURIComponent(urlSlug).toLowerCase().trim();
  const rawSlug = typeof event.slug === 'string' ? event.slug.trim() : '';
  if (rawSlug !== '' && rawSlug.toLowerCase() === normalizedSlug) return true;
  if (normalizedSlug.startsWith('event-') && normalizedSlug === `event-${event.id}`.toLowerCase()) {
    return true;
  }
  const fromName = generateSlug(event.name);
  return fromName !== '' && fromName.toLowerCase() === normalizedSlug;
}

function isProductionRuntime() {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_URL
  );
}

function isPresaleEnabled(event) {
  return !!event?.presale_enabled;
}

function eventAllowedForPublicDirectLink(event) {
  if (!event || event.event_status === 'cancelled') return false;
  const isProd = isProductionRuntime();
  if (isProd && event.is_test && !isPresaleEnabled(event)) return false;
  return true;
}

export async function handlePublicEventBySlug(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let slugParam = req.query?.slug;
  if (!slugParam && req.url) {
    const m = String(req.url).match(/\/api\/events\/by-slug\/([^/?]+)/);
    if (m) slugParam = m[1];
  }
  if (!slugParam) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  const normalizedSlug = decodeURIComponent(String(slugParam)).toLowerCase().trim();
  if (!normalizedSlug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  const db = await createServiceRoleClient();
  if (!db) {
    return res.status(503).json({ error: 'Service unavailable' });
  }

  let event = null;

  const { data: bySlug, error: slugErr } = await db
    .from('events')
    .select(PUBLIC_EVENT_COLUMNS)
    .eq('slug', normalizedSlug)
    .maybeSingle();

  if (slugErr) {
    console.error('public event by slug:', slugErr.code);
    return res.status(500).json({ error: 'Failed to load event' });
  }
  if (bySlug) event = bySlug;

  if (!event && normalizedSlug.startsWith('event-')) {
    const idCandidate = normalizedSlug.slice('event-'.length);
    const { data: byId } = await db
      .from('events')
      .select(PUBLIC_EVENT_COLUMNS)
      .eq('id', idCandidate)
      .maybeSingle();
    if (byId) event = byId;
  }

  if (!event) {
    const { data: candidates, error: listErr } = await db
      .from('events')
      .select(PUBLIC_EVENT_COLUMNS)
      .neq('event_status', 'cancelled');
    if (listErr) {
      console.error('public event slug fallback:', listErr.code);
      return res.status(500).json({ error: 'Failed to load event' });
    }
    event = (candidates || []).find((row) => matchesPublicUrlSlug(row, normalizedSlug)) || null;
  }

  if (!event || !eventAllowedForPublicDirectLink(event)) {
    return res.status(404).json({ error: 'Event not found' });
  }

  return res.status(200).json({ data: event });
}

export async function handlePublicEventById(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let eventId = req.query?.eventId;
  if (!eventId && req.url) {
    const m = String(req.url).match(/\/api\/events\/by-id\/([^/?]+)/);
    if (m) eventId = m[1];
  }
  if (!eventId) {
    return res.status(400).json({ error: 'Event ID is required' });
  }

  const db = await createServiceRoleClient();
  if (!db) {
    return res.status(503).json({ error: 'Service unavailable' });
  }

  const { data: event, error } = await db
    .from('events')
    .select(PUBLIC_EVENT_COLUMNS)
    .eq('id', String(eventId).trim())
    .maybeSingle();

  if (error) {
    console.error('public event by id:', error.code);
    return res.status(500).json({ error: 'Failed to load event' });
  }
  if (!event || !eventAllowedForPublicDirectLink(event)) {
    return res.status(404).json({ error: 'Event not found' });
  }

  return res.status(200).json({ data: event });
}
