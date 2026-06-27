'use strict';

const crypto = require('crypto');
const {
  buildHashedUserData,
  normalizeEmail,
  normalizePhone,
  normalizeCity,
  splitFullName,
} = require('./user-data.cjs');
const {
  META_TICKET_CONTENT_CATEGORY,
  resolvePurchaseValue,
  buildCustomerFromOrder,
  buildContentsFromOrderPasses,
  buildContentIdsFromOrderPasses,
  resolvePromoCodeFromOrder,
} = require('./purchase-payload.cjs');
const {
  isValidFbc,
  isUsableClientIp,
  resolvePurchaseAttribution,
} = require('./attribution.cjs');

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
 * Ticket/pass orders eligible for Meta Purchase tracking.
 * external_app: no customer PAID confirmation route — not trackable at checkout.
 * TODO: Wire when external_app has a confirmed PAID signal.
 * @param {Record<string, unknown>} order
 */
function isTicketOrderTrackable(order) {
  if (!order || typeof order !== 'object') return false;
  const method = order.payment_method != null ? String(order.payment_method) : '';
  const status = order.status != null ? String(order.status) : '';

  if (method === 'ambassador_cash') return true;
  if (method === 'online' && status === 'PAID') return true;
  return false;
}

/**
 * @param {string} orderId
 * @param {Record<string, unknown>} attr
 */
function resolveEventId(orderId, attr) {
  const stored =
    attr.eventId != null
      ? String(attr.eventId)
      : attr.event_id != null
        ? String(attr.event_id)
        : null;
  if (stored) return stored.slice(0, 128);

  const randomPart = crypto.randomBytes(4).toString('hex');
  return `purchase_${orderId}_${Date.now()}_${randomPart}`.slice(0, 128);
}

/**
 * @param {string|undefined|null} value
 */
function parseOrderTimestamp(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor(d.getTime() / 1000);
}

/**
 * @param {Record<string, unknown>} order
 */
function resolvePurchaseEventTime(order) {
  const method = order.payment_method != null ? String(order.payment_method) : '';
  const isOnline = method === 'online';

  if (isOnline) {
    return (
      parseOrderTimestamp(order.approved_at) ||
      parseOrderTimestamp(order.updated_at) ||
      parseOrderTimestamp(order.created_at) ||
      Math.floor(Date.now() / 1000)
    );
  }

  return (
    parseOrderTimestamp(order.created_at) ||
    parseOrderTimestamp(order.updated_at) ||
    Math.floor(Date.now() / 1000)
  );
}

/**
 * @param {Record<string, unknown>} metadata
 */
function logPurchaseStructured(tag, metadata) {
  console.warn(JSON.stringify({ tag, ...metadata, timestamp: new Date().toISOString() }));
}

/**
 * @param {ReturnType<typeof buildCanonicalTicketPurchaseEvent>} canonical
 * @returns {string[]}
 */
function buildAttributionWarnings(canonical) {
  /** @type {string[]} */
  const warnings = [];
  if (!canonical?.fbc) warnings.push('missing_fbc');
  if (!canonical?.fbp) warnings.push('missing_fbp');
  if (!canonical?.clientIp) warnings.push('missing_ip');
  if (!canonical?.clientUserAgent) warnings.push('missing_user_agent');
  return warnings;
}

/**
 * @param {{
 *   order: Record<string, unknown>;
 *   orderPasses?: Array<Record<string, unknown>>|null;
 *   event?: Record<string, unknown>|null;
 *   promoCode?: string|null;
 *   req?: import('http').IncomingMessage|null;
 * }} params
 */
function buildCanonicalTicketPurchaseEvent(params) {
  const { order, orderPasses, event, promoCode, req } = params;
  if (!isTicketOrderTrackable(order)) {
    return null;
  }

  const passes = Array.isArray(orderPasses) ? orderPasses : [];
  const value = resolvePurchaseValue(order, passes);
  if (!(value > 0) || !passes.length) {
    return null;
  }

  const orderId = String(order.id);
  const attr = parseMetaAttribution(order.meta_attribution);
  const eventId = resolveEventId(orderId, attr);
  const resolved = resolvePurchaseAttribution(attr, req ?? null);

  const promo =
    promoCode != null
      ? String(promoCode).trim()
      : resolvePromoCodeFromOrder(order) || '';

  const paymentMethod =
    order.payment_method != null ? String(order.payment_method) : 'unknown';
  const contents = buildContentsFromOrderPasses(passes);
  const contentIds = buildContentIdsFromOrderPasses(passes);
  const numItems = passes.reduce((s, p) => s + (Number(p.quantity) || 0), 0);

  return {
    eventId,
    eventName: 'Purchase',
    eventTime: resolvePurchaseEventTime(order),
    orderId,
    orderStatus: order.status != null ? String(order.status) : undefined,
    paymentMethod,
    value,
    currency: 'TND',
    contentCategory: META_TICKET_CONTENT_CATEGORY,
    contentName: event?.name != null ? String(event.name) : undefined,
    contentIds,
    contents,
    numItems,
    ...(promo ? { promoCode: promo } : {}),
    ...(resolved.eventSourceUrl ? { eventSourceUrl: resolved.eventSourceUrl } : {}),
    ...(resolved.fbp ? { fbp: resolved.fbp } : {}),
    ...(resolved.fbc ? { fbc: resolved.fbc } : {}),
    ...(resolved.clientIp ? { clientIp: resolved.clientIp } : {}),
    ...(resolved.clientUserAgent ? { clientUserAgent: resolved.clientUserAgent } : {}),
    customer: buildCustomerFromOrder(order),
    eventIdWasStored: Boolean(attr.eventId != null || attr.event_id != null),
    resolvedAttribution: resolved,
  };
}

/**
 * @param {ReturnType<typeof buildCanonicalTicketPurchaseEvent>} canonical
 */
function buildPixelAdvancedMatchingFromCanonical(canonical) {
  const customer = canonical.customer || {};
  const { fn, ln } = splitFullName(customer.fullName);
  const em = normalizeEmail(customer.email);
  const ph = normalizePhone(customer.phone);
  const ct = normalizeCity(customer.city);

  /** @type {Record<string, string>} */
  const out = { country: 'tn' };
  if (em) out.em = em;
  if (ph) out.ph = ph;
  if (fn) out.fn = fn;
  if (ln) out.ln = ln;
  if (ct) out.ct = ct;
  return out;
}

/**
 * @param {ReturnType<typeof buildCanonicalTicketPurchaseEvent>} canonical
 */
function buildPixelPayloadFromCanonical(canonical) {
  if (!canonical) return null;

  return {
    eventId: canonical.eventId,
    orderId: canonical.orderId,
    value: canonical.value,
    currency: canonical.currency,
    contentCategory: canonical.contentCategory,
    contentIds: canonical.contentIds,
    contentName: canonical.contentName || '',
    numItems: canonical.numItems,
    paymentMethod: canonical.paymentMethod,
    contents: canonical.contents,
    ...(canonical.promoCode ? { promoCode: canonical.promoCode } : {}),
    advancedMatching: buildPixelAdvancedMatchingFromCanonical(canonical),
  };
}

/**
 * @param {ReturnType<typeof buildCanonicalTicketPurchaseEvent>} canonical
 */
function buildCapiServerEventFromCanonical(canonical) {
  if (!canonical) return null;

  const userData = buildHashedUserData(canonical.customer);
  if (canonical.fbp) userData.fbp = canonical.fbp;
  if (canonical.fbc) userData.fbc = canonical.fbc;
  if (canonical.clientIp) userData.client_ip_address = canonical.clientIp;
  if (canonical.clientUserAgent) userData.client_user_agent = canonical.clientUserAgent;

  /** @type {Record<string, unknown>} */
  const custom_data = {
    value: canonical.value,
    currency: canonical.currency,
    content_name: canonical.contentName,
    content_category: canonical.contentCategory,
    content_type: 'product',
    content_ids: canonical.contentIds,
    contents: canonical.contents,
    num_items: canonical.numItems,
    order_id: canonical.orderId,
    payment_method: canonical.paymentMethod,
  };
  if (canonical.promoCode) custom_data.promo_code = canonical.promoCode;

  /** @type {Record<string, unknown>} */
  const serverEvent = {
    event_name: canonical.eventName,
    event_time: canonical.eventTime,
    event_id: canonical.eventId,
    action_source: 'website',
    user_data: userData,
    custom_data,
  };

  if (canonical.eventSourceUrl) {
    serverEvent.event_source_url = canonical.eventSourceUrl;
  }

  return serverEvent;
}

/**
 * @param {ReturnType<typeof buildCanonicalTicketPurchaseEvent>} canonical
 * @param {Record<string, unknown>} capiResult
 */
function buildSafeTrackingLogMetadata(canonical, capiResult) {
  const customer = canonical.customer || {};
  return {
    orderId: canonical.orderId,
    eventId: canonical.eventId,
    paymentMethod: canonical.paymentMethod,
    orderStatus: canonical.orderStatus,
    canonicalCreated: true,
    trackable: true,
    capiAttempted: Boolean(capiResult?.attempted),
    capiOk: Boolean(capiResult?.ok),
    capiSkipped: Boolean(capiResult?.skipped),
    ...(capiResult?.error ? { capiError: String(capiResult.error).slice(0, 256) } : {}),
    pixelReturned: true,
    hasEventId: Boolean(canonical.eventId),
    hasEmail: Boolean(normalizeEmail(customer.email)),
    hasPhone: Boolean(normalizePhone(customer.phone)),
    hasFbp: Boolean(canonical.fbp),
    hasFbc: Boolean(canonical.fbc),
    hasIp: Boolean(canonical.clientIp),
    hasUserAgent: Boolean(canonical.clientUserAgent),
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} orderId
 * @param {string} eventId
 * @param {Record<string, unknown>|null|undefined} order
 */
async function ensureEventIdInAttribution(db, orderId, eventId, order) {
  const attr = parseMetaAttribution(order?.meta_attribution);
  const stored =
    attr.eventId != null
      ? String(attr.eventId)
      : attr.event_id != null
        ? String(attr.event_id)
        : null;
  if (stored === eventId) return;

  const { error } = await db
    .from('orders')
    .update({
      meta_attribution: { ...attr, eventId },
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.warn('[Ticket Meta Tracking] failed to persist eventId:', error.message);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} orderId
 * @param {Record<string, unknown>|null|undefined} order
 * @param {ReturnType<typeof resolvePurchaseAttribution>} resolved
 */
async function backfillResolvedAttribution(db, orderId, order, resolved) {
  if (!resolved || typeof resolved !== 'object') return;

  const attr = parseMetaAttribution(order?.meta_attribution);
  const patch = { ...attr };
  let changed = false;

  if (resolved.fbp && !attr.fbp) {
    patch.fbp = resolved.fbp;
    changed = true;
  }

  const storedFbcValid =
    attr.fbc != null && isValidFbc(String(attr.fbc));
  if (resolved.fbc && isValidFbc(resolved.fbc) && !storedFbcValid) {
    patch.fbc = resolved.fbc;
    changed = true;
  }

  const storedIpUsable = isUsableClientIp(
    attr.clientIp != null ? String(attr.clientIp) : attr.client_ip != null ? String(attr.client_ip) : undefined
  );
  if (resolved.clientIp && isUsableClientIp(resolved.clientIp) && !storedIpUsable) {
    patch.clientIp = resolved.clientIp;
    changed = true;
  }

  if (resolved.clientUserAgent && !attr.clientUserAgent && !attr.client_user_agent) {
    patch.clientUserAgent = resolved.clientUserAgent;
    changed = true;
  }

  if (!changed) return;

  const { error } = await db
    .from('orders')
    .update({
      meta_attribution: patch,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    console.warn('[Ticket Meta Tracking] failed to backfill meta_attribution:', error.message);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} orderId
 * @param {Record<string, unknown>} canonical
 * @param {Record<string, unknown>} capiResult
 */
async function writeTrackingLog(db, orderId, canonical, capiResult) {
  const metadata = buildSafeTrackingLogMetadata(canonical, capiResult);
  const warnings = buildAttributionWarnings(canonical);
  if (warnings.length) {
    logPurchaseStructured('META_PURCHASE_ATTRIBUTION_WARNING', {
      ...metadata,
      warnings,
    });
  }
  if (capiResult?.skipped && capiResult?.error === 'already_sent') {
    logPurchaseStructured('META_PURCHASE_CAPI_SKIPPED', metadata);
  } else if (capiResult?.ok) {
    logPurchaseStructured('META_PURCHASE_CAPI_SUCCESS', metadata);
  } else if (capiResult?.attempted) {
    logPurchaseStructured('META_PURCHASE_CAPI_FAILED', metadata);
  } else if (capiResult?.skipped) {
    logPurchaseStructured('META_PURCHASE_CAPI_SKIPPED', metadata);
  }
  try {
    await db.from('order_logs').insert({
      order_id: orderId,
      action: 'meta_purchase_tracking',
      performed_by: null,
      performed_by_type: 'system',
      details: metadata,
    });
  } catch (err) {
    console.warn(
      '[Ticket Meta Tracking] failed to write order_logs:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} orderId
 * @param {{ req?: import('http').IncomingMessage|null }} [options]
 */
async function processConfirmedTicketPurchaseTracking(db, orderId, options = {}) {
  const { data: order, error: orderError } = await db
    .from('orders')
    .select('*, events ( id, name ), event_promo_codes ( label )')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    console.warn('[Ticket Meta Tracking] order not found:', orderId);
    return { trackable: false, pixel: null, capi: { attempted: false, ok: false, skipped: true } };
  }

  if (!isTicketOrderTrackable(order)) {
    logPurchaseStructured('META_PURCHASE_CAPI_SKIPPED', {
      orderId,
      canonicalCreated: false,
      trackable: false,
      pixelReturned: false,
      capiAttempted: false,
      capiOk: false,
      hasEventId: false,
      orderStatus: order.status != null ? String(order.status) : undefined,
      paymentMethod: order.payment_method != null ? String(order.payment_method) : undefined,
    });
    return { trackable: false, pixel: null, capi: { attempted: false, ok: false, skipped: true } };
  }

  const { data: orderPasses, error: passesError } = await db
    .from('order_passes')
    .select('*')
    .eq('order_id', orderId);

  if (passesError) {
    console.warn('[Ticket Meta Tracking] failed to load order_passes:', passesError.message);
    return { trackable: false, pixel: null, capi: { attempted: false, ok: false, skipped: true } };
  }

  const event = order.events || null;
  const promoCode =
    order.event_promo_codes?.label != null
      ? String(order.event_promo_codes.label)
      : null;

  const canonical = buildCanonicalTicketPurchaseEvent({
    order,
    orderPasses: orderPasses || [],
    event,
    promoCode,
    req: options.req ?? null,
  });

  if (!canonical) {
    return { trackable: false, pixel: null, capi: { attempted: false, ok: false, skipped: true } };
  }

  await ensureEventIdInAttribution(db, orderId, canonical.eventId, order);

  const alreadySent = Boolean(order.meta_purchase_sent_at);

  /** @type {{ attempted: boolean; ok: boolean; skipped: boolean; error?: string }} */
  let capiResult = { attempted: false, ok: false, skipped: true };

  if (alreadySent) {
    capiResult = { attempted: false, ok: true, skipped: true, error: 'already_sent' };
  } else {
    const { postCapiEvent, canSendCapiEvents } = require('./conversions-api.cjs');
    if (canSendCapiEvents()) {
      capiResult = { attempted: true, ok: false, skipped: false };
      try {
        const serverEvent = buildCapiServerEventFromCanonical(canonical);
        if (serverEvent) {
          const postResult = await postCapiEvent(serverEvent);
          capiResult.ok = Boolean(postResult.ok);
          capiResult.skipped = Boolean(postResult.skipped);
          if (postResult.error) capiResult.error = String(postResult.error);

          if (postResult.ok) {
            const { error: updateError } = await db
              .from('orders')
              .update({ meta_purchase_sent_at: new Date().toISOString() })
              .eq('id', orderId)
              .is('meta_purchase_sent_at', null);

            if (updateError) {
              console.warn(
                '[Ticket Meta Tracking] failed to set meta_purchase_sent_at:',
                updateError.message
              );
            }
            await ensureEventIdInAttribution(db, orderId, canonical.eventId, order);
            if (canonical.resolvedAttribution) {
              await backfillResolvedAttribution(
                db,
                orderId,
                order,
                canonical.resolvedAttribution
              );
            }
          }
        }
      } catch (err) {
        capiResult.error = err instanceof Error ? err.message : String(err);
        console.warn('[Ticket Meta Tracking] CAPI send error:', capiResult.error);
      }
    }
  }

  const pixel = buildPixelPayloadFromCanonical(canonical);
  if (pixel) {
    logPurchaseStructured('META_PURCHASE_PIXEL_PAYLOAD_PREPARED', {
      ...buildSafeTrackingLogMetadata(canonical, capiResult),
      pixelReturned: true,
    });
  }

  if (!alreadySent) {
    await writeTrackingLog(db, orderId, canonical, capiResult);
  } else {
    logPurchaseStructured('META_PURCHASE_CAPI_SKIPPED', buildSafeTrackingLogMetadata(canonical, capiResult));
  }

  return {
    trackable: true,
    pixel,
    capi: capiResult,
  };
}

module.exports = {
  parseMetaAttribution,
  isTicketOrderTrackable,
  resolvePurchaseEventTime,
  buildCanonicalTicketPurchaseEvent,
  buildPixelPayloadFromCanonical,
  buildCapiServerEventFromCanonical,
  buildPixelAdvancedMatchingFromCanonical,
  buildSafeTrackingLogMetadata,
  backfillResolvedAttribution,
  processConfirmedTicketPurchaseTracking,
};
