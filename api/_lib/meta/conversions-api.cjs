'use strict';

const { buildHashedUserData } = require('./user-data.cjs');
const {
  buildPurchaseCustomData,
  buildCustomerFromOrder,
} = require('./purchase-payload.cjs');
const {
  buildAcademyPurchaseCustomData,
  buildCustomerFromRegistration,
  isAcademyRegistrationTrackable,
} = require('./academy-purchase-payload.cjs');

const GRAPH_API_VERSION = 'v21.0';

function isProductionEnv() {
  return process.env.NODE_ENV === 'production';
}

function isCapiConfigured() {
  return Boolean(
    process.env.META_PIXEL_ID?.trim() && process.env.META_CAPI_ACCESS_TOKEN?.trim()
  );
}

/**
 * Production: send real events when configured.
 * Non-production: send only when META_CAPI_TEST_EVENT_CODE is set (Test Events).
 */
function canSendCapiEvents() {
  if (!isCapiConfigured()) return false;
  if (isProductionEnv()) return true;
  return Boolean(process.env.META_CAPI_TEST_EVENT_CODE?.trim());
}

/**
 * @param {Record<string, unknown>|null|undefined} raw
 */
function parseMetaAttribution(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return parseMetaAttribution(JSON.parse(raw));
    } catch {
      return {};
    }
  }
  if (typeof raw !== 'object') return {};
  return raw;
}

/**
 * @param {{
 *   order: Record<string, unknown>;
 *   orderPasses?: Array<Record<string, unknown>>|null;
 *   event?: Record<string, unknown>|null;
 *   attribution?: Record<string, unknown>|null;
 *   req?: import('http').IncomingMessage|null;
 * }} params
 */
function buildCapiPurchaseEvent(params) {
  const { order, orderPasses, event, attribution, req } = params;
  const attr = parseMetaAttribution(attribution ?? order.meta_attribution);
  const customData = buildPurchaseCustomData({ order, orderPasses, event });
  const userData = buildHashedUserData(buildCustomerFromOrder(order));

  if (attr.fbp) userData.fbp = String(attr.fbp);
  if (attr.fbc) userData.fbc = String(attr.fbc);

  const clientIp =
    attr.clientIp != null
      ? String(attr.clientIp)
      : attr.client_ip != null
        ? String(attr.client_ip)
        : undefined;
  if (clientIp && clientIp !== 'unknown') {
    userData.client_ip_address = clientIp;
  }

  const clientUserAgent =
    attr.clientUserAgent != null
      ? String(attr.clientUserAgent)
      : attr.client_user_agent != null
        ? String(attr.client_user_agent)
        : req?.headers?.['user-agent']
          ? String(req.headers['user-agent'])
          : undefined;
  if (clientUserAgent) {
    userData.client_user_agent = clientUserAgent;
  }

  const eventId =
    attr.eventId != null
      ? String(attr.eventId)
      : attr.event_id != null
        ? String(attr.event_id)
        : `purchase_${order.id}`;

  const eventSourceUrl =
    attr.eventSourceUrl != null
      ? String(attr.eventSourceUrl)
      : attr.event_source_url != null
        ? String(attr.event_source_url)
        : undefined;

  /** @type {Record<string, unknown>} */
  const serverEvent = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    user_data: userData,
    custom_data: customData,
  };

  if (eventSourceUrl) {
    serverEvent.event_source_url = eventSourceUrl;
  }

  return serverEvent;
}

/**
 * @param {{
 *   registration: Record<string, unknown>;
 *   attribution?: Record<string, unknown>|null;
 *   req?: import('http').IncomingMessage|null;
 *   promoCode?: string|null;
 * }} params
 */
function buildCapiAcademyPurchaseEvent(params) {
  const { registration, attribution, req, promoCode } = params;
  if (!isAcademyRegistrationTrackable(registration)) {
    return null;
  }

  const attr = parseMetaAttribution(attribution ?? registration.meta_attribution);
  const customData = buildAcademyPurchaseCustomData(registration, { promoCode });
  if (!customData) return null;

  const userData = buildHashedUserData(buildCustomerFromRegistration(registration));

  if (attr.fbp) userData.fbp = String(attr.fbp);
  if (attr.fbc) userData.fbc = String(attr.fbc);

  const clientIp =
    attr.clientIp != null
      ? String(attr.clientIp)
      : attr.client_ip != null
        ? String(attr.client_ip)
        : registration.ip_address != null
          ? String(registration.ip_address)
          : undefined;
  if (clientIp && clientIp !== 'unknown') {
    userData.client_ip_address = clientIp;
  }

  const clientUserAgent =
    attr.clientUserAgent != null
      ? String(attr.clientUserAgent)
      : attr.client_user_agent != null
        ? String(attr.client_user_agent)
        : registration.user_agent != null
          ? String(registration.user_agent)
          : req?.headers?.['user-agent']
            ? String(req.headers['user-agent'])
            : undefined;
  if (clientUserAgent) {
    userData.client_user_agent = clientUserAgent;
  }

  const eventId =
    attr.eventId != null
      ? String(attr.eventId)
      : attr.event_id != null
        ? String(attr.event_id)
        : `academy_purchase_${registration.id}`;

  const eventSourceUrl =
    attr.eventSourceUrl != null
      ? String(attr.eventSourceUrl)
      : attr.event_source_url != null
        ? String(attr.event_source_url)
        : undefined;

  /** @type {Record<string, unknown>} */
  const serverEvent = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    user_data: userData,
    custom_data: customData,
  };

  if (eventSourceUrl) {
    serverEvent.event_source_url = eventSourceUrl;
  }

  return serverEvent;
}

/**
 * @param {{
 *   registration: Record<string, unknown>;
 *   req?: import('http').IncomingMessage|null;
 *   promoCode?: string|null;
 * }} params
 */
async function sendConfirmedAcademyPurchase(params) {
  if (!canSendCapiEvents()) {
    return { ok: false, skipped: true };
  }
  const serverEvent = buildCapiAcademyPurchaseEvent(params);
  if (!serverEvent) {
    return { ok: false, skipped: true, error: 'invalid_academy_registration' };
  }
  return postCapiEvent(serverEvent);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} dbClient
 * @param {string} registrationId
 * @param {{ req?: import('http').IncomingMessage|null }} [options]
 */
async function sendConfirmedAcademyPurchaseForRegistrationId(dbClient, registrationId, options = {}) {
  if (!canSendCapiEvents()) {
    return { ok: false, skipped: true };
  }

  const { data: registration, error: regError } = await dbClient
    .from('academy_registrations')
    .select('*, academy_promo_codes ( code )')
    .eq('id', registrationId)
    .single();

  if (regError || !registration) {
    console.warn('[Meta CAPI] Academy registration not found for Purchase:', registrationId);
    return { ok: false, error: 'registration_not_found' };
  }

  if (registration.meta_purchase_sent_at) {
    return { ok: true, skipped: true, reason: 'already_sent' };
  }

  const promoCode =
    registration.academy_promo_codes?.code != null
      ? String(registration.academy_promo_codes.code)
      : null;

  const result = await sendConfirmedAcademyPurchase({
    registration,
    promoCode,
    req: options.req ?? null,
  });

  if (result.ok) {
    const { error: updateError } = await dbClient
      .from('academy_registrations')
      .update({ meta_purchase_sent_at: new Date().toISOString() })
      .eq('id', registrationId)
      .is('meta_purchase_sent_at', null);

    if (updateError) {
      console.warn('[Meta CAPI] Failed to set academy meta_purchase_sent_at:', updateError.message);
    }
  }

  return result;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} dbClient
 * @param {string} registrationId
 * @param {{ req?: import('http').IncomingMessage|null }} [options]
 */
function scheduleConfirmedAcademyPurchaseCapi(dbClient, registrationId, options = {}) {
  sendConfirmedAcademyPurchaseForRegistrationId(dbClient, registrationId, options).catch((err) => {
    console.warn(
      '[Meta CAPI] scheduleConfirmedAcademyPurchaseCapi failed:',
      err instanceof Error ? err.message : err
    );
  });
}

/**
 * POST Purchase to Meta Conversions API.
 * @param {Record<string, unknown>} serverEvent
 * @returns {Promise<{ ok: boolean; skipped?: boolean; error?: string }>}
 */
async function postCapiEvent(serverEvent) {
  if (!canSendCapiEvents()) {
    if (!isCapiConfigured()) {
      return { ok: false, skipped: true, error: 'Meta CAPI not configured' };
    }
    return {
      ok: false,
      skipped: true,
      error: 'Meta CAPI blocked outside production (set META_CAPI_TEST_EVENT_CODE for test events)',
    };
  }

  const pixelId = process.env.META_PIXEL_ID.trim();
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN.trim();
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE?.trim();

  /** @type {Record<string, unknown>} */
  const body = {
    data: [serverEvent],
  };
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        data?.error?.message ||
        data?.error?.error_user_msg ||
        `HTTP ${res.status}`;
      console.warn('[Meta CAPI] Purchase send failed:', msg);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[Meta CAPI] Purchase send error:', msg);
    return { ok: false, error: msg };
  }
}

/**
 * Send confirmed Purchase via CAPI (fire-and-forget safe wrapper).
 * @param {{
 *   order: Record<string, unknown>;
 *   orderPasses?: Array<Record<string, unknown>>|null;
 *   event?: Record<string, unknown>|null;
 *   req?: import('http').IncomingMessage|null;
 * }} params
 */
async function sendConfirmedPurchase(params) {
  if (!canSendCapiEvents()) {
    return { ok: false, skipped: true };
  }
  const serverEvent = buildCapiPurchaseEvent(params);
  return postCapiEvent(serverEvent);
}

/**
 * Load order relations and send CAPI Purchase once (idempotent via meta_purchase_sent_at).
 * @param {import('@supabase/supabase-js').SupabaseClient} dbClient
 * @param {string} orderId
 * @param {{ req?: import('http').IncomingMessage|null }} [options]
 */
async function sendConfirmedPurchaseForOrderId(dbClient, orderId, options = {}) {
  if (!canSendCapiEvents()) {
    return { ok: false, skipped: true };
  }

  const { data: order, error: orderError } = await dbClient
    .from('orders')
    .select('*, events ( id, name )')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.warn('[Meta CAPI] Order not found for Purchase:', orderId);
    return { ok: false, error: 'order_not_found' };
  }

  if (order.meta_purchase_sent_at) {
    return { ok: true, skipped: true, reason: 'already_sent' };
  }

  const { data: orderPasses, error: passesError } = await dbClient
    .from('order_passes')
    .select('*')
    .eq('order_id', orderId);

  if (passesError) {
    console.warn('[Meta CAPI] Failed to load order_passes:', passesError.message);
    return { ok: false, error: passesError.message };
  }

  const event = order.events || null;
  const result = await sendConfirmedPurchase({
    order,
    orderPasses: orderPasses || [],
    event,
    req: options.req ?? null,
  });

  if (result.ok) {
    const { error: updateError } = await dbClient
      .from('orders')
      .update({ meta_purchase_sent_at: new Date().toISOString() })
      .eq('id', orderId)
      .is('meta_purchase_sent_at', null);

    if (updateError) {
      console.warn('[Meta CAPI] Failed to set meta_purchase_sent_at:', updateError.message);
    }
  }

  return result;
}

/**
 * Fire-and-forget: never throws, never blocks order flow.
 * @param {import('@supabase/supabase-js').SupabaseClient} dbClient
 * @param {string} orderId
 * @param {{ req?: import('http').IncomingMessage|null }} [options]
 */
function scheduleConfirmedPurchaseCapi(dbClient, orderId, options = {}) {
  sendConfirmedPurchaseForOrderId(dbClient, orderId, options).catch((err) => {
    console.warn(
      '[Meta CAPI] scheduleConfirmedPurchaseCapi failed:',
      err instanceof Error ? err.message : err
    );
  });
}

module.exports = {
  isCapiConfigured,
  canSendCapiEvents,
  buildCapiPurchaseEvent,
  buildCapiAcademyPurchaseEvent,
  postCapiEvent,
  sendConfirmedPurchase,
  sendConfirmedPurchaseForOrderId,
  scheduleConfirmedPurchaseCapi,
  sendConfirmedAcademyPurchase,
  sendConfirmedAcademyPurchaseForRegistrationId,
  scheduleConfirmedAcademyPurchaseCapi,
};
