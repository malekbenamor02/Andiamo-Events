'use strict';

const crypto = require('crypto');
const {
  buildHashedUserData,
  normalizeEmail,
  normalizePhone,
  splitFullName,
} = require('./user-data.cjs');
const {
  buildCustomerFromRegistration,
  isAcademyRegistrationTrackable,
  META_ACADEMY_CONTENT_CATEGORY,
} = require('./academy-purchase-payload.cjs');
const {
  getAcademyFormulaMeta,
  mapAcademyPaymentMethodForMeta,
} = require('./academy-catalog.cjs');
const {
  isMissingMetaColumnError,
  logMissingMetaColumnsWarning,
  updateAcademyRegistration,
} = require('../academy-meta-db.cjs');
const { logAcademyEvent } = require('../academy-db.cjs');

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
 * @param {string} registrationId
 * @param {Record<string, unknown>} attr
 */
function resolveEventId(registrationId, attr) {
  const stored =
    attr.eventId != null
      ? String(attr.eventId)
      : attr.event_id != null
        ? String(attr.event_id)
        : null;
  if (stored) return stored.slice(0, 128);

  const randomPart = crypto.randomBytes(4).toString('hex');
  return `academy_purchase_${registrationId}_${Date.now()}_${randomPart}`.slice(0, 128);
}

/**
 * @param {{
 *   registration: Record<string, unknown>;
 *   promoCode?: string|null;
 *   req?: import('http').IncomingMessage|null;
 * }} params
 */
function buildCanonicalAcademyPurchaseEvent(params) {
  const { registration, promoCode, req } = params;
  if (!isAcademyRegistrationTrackable(registration)) {
    return null;
  }

  const formula = getAcademyFormulaMeta(registration.formule);
  const paymentMethod = mapAcademyPaymentMethodForMeta(registration.payment_method);
  const value = Number(registration.total_amount_dt);
  if (!formula || !paymentMethod || !(value > 0)) {
    return null;
  }

  const attr = parseMetaAttribution(registration.meta_attribution);
  const registrationId = String(registration.id);
  const eventId = resolveEventId(registrationId, attr);

  const promo =
    promoCode != null
      ? String(promoCode).trim()
      : registration.promo_code != null
        ? String(registration.promo_code).trim()
        : '';

  const clientIp =
    attr.clientIp != null
      ? String(attr.clientIp)
      : attr.client_ip != null
        ? String(attr.client_ip)
        : registration.ip_address != null
          ? String(registration.ip_address)
          : undefined;

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

  const eventSourceUrl =
    attr.eventSourceUrl != null
      ? String(attr.eventSourceUrl)
      : attr.event_source_url != null
        ? String(attr.event_source_url)
        : undefined;

  return {
    eventId,
    eventName: 'Purchase',
    eventTime: Math.floor(Date.now() / 1000),
    registrationId,
    paymentMethod,
    value,
    currency: 'TND',
    contentCategory: META_ACADEMY_CONTENT_CATEGORY,
    contentId: formula.contentId,
    contentName: formula.contentName,
    contentIds: [formula.contentId],
    contents: [
      {
        id: formula.contentId,
        quantity: 1,
        item_price: formula.basePriceDt,
      },
    ],
    numItems: 1,
    ...(promo ? { promoCode: promo } : {}),
    ...(eventSourceUrl ? { eventSourceUrl } : {}),
    ...(attr.fbp ? { fbp: String(attr.fbp) } : {}),
    ...(attr.fbc ? { fbc: String(attr.fbc) } : {}),
    ...(clientIp && clientIp !== 'unknown' ? { clientIp } : {}),
    ...(clientUserAgent ? { clientUserAgent } : {}),
    customer: buildCustomerFromRegistration(registration),
    eventIdWasStored: Boolean(
      attr.eventId != null || attr.event_id != null
    ),
  };
}

/**
 * @param {ReturnType<typeof buildCanonicalAcademyPurchaseEvent>} canonical
 */
function buildPixelAdvancedMatchingFromCanonical(canonical) {
  const customer = canonical.customer || {};
  const { fn, ln } = splitFullName(customer.fullName);
  const em = normalizeEmail(customer.email);
  const ph = normalizePhone(customer.phone);

  /** @type {Record<string, string>} */
  const out = { country: 'tn' };
  if (em) out.em = em;
  if (ph) out.ph = ph;
  if (fn) out.fn = fn;
  if (ln) out.ln = ln;
  return out;
}

/**
 * @param {ReturnType<typeof buildCanonicalAcademyPurchaseEvent>} canonical
 */
function buildPixelPayloadFromCanonical(canonical) {
  if (!canonical) return null;

  return {
    eventId: canonical.eventId,
    orderId: canonical.registrationId,
    value: canonical.value,
    currency: canonical.currency,
    contentCategory: canonical.contentCategory,
    contentIds: canonical.contentIds,
    contentName: canonical.contentName,
    numItems: canonical.numItems,
    paymentMethod: canonical.paymentMethod,
    contents: canonical.contents,
    ...(canonical.promoCode ? { promoCode: canonical.promoCode } : {}),
    advancedMatching: buildPixelAdvancedMatchingFromCanonical(canonical),
  };
}

/**
 * @param {ReturnType<typeof buildCanonicalAcademyPurchaseEvent>} canonical
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
    order_id: canonical.registrationId,
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
 * @param {Record<string, unknown>} canonical
 */
function buildSafeTrackingLogMetadata(canonical, capiResult) {
  const customer = canonical.customer || {};
  return {
    eventId: canonical.eventId,
    registrationId: canonical.registrationId,
    paymentMethod: canonical.paymentMethod,
    canonicalCreated: true,
    trackable: true,
    capiAttempted: Boolean(capiResult?.attempted),
    capiOk: Boolean(capiResult?.ok),
    capiSkipped: Boolean(capiResult?.skipped),
    ...(capiResult?.error ? { capiError: String(capiResult.error).slice(0, 256) } : {}),
    pixelExpected: true,
    hasEmail: Boolean(normalizeEmail(customer.email)),
    hasPhone: Boolean(normalizePhone(customer.phone)),
    hasFbp: Boolean(canonical.fbp),
    hasFbc: Boolean(canonical.fbc),
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} registrationId
 * @param {Record<string, unknown>} canonical
 * @param {Record<string, unknown>} capiResult
 */
async function writeTrackingLog(db, registrationId, canonical, capiResult) {
  const metadata = buildSafeTrackingLogMetadata(canonical, capiResult);
  console.warn('[Academy Meta Tracking]', JSON.stringify(metadata));
  try {
    await logAcademyEvent(db, {
      registrationId,
      eventType: 'meta_purchase_tracking',
      metadata,
    });
  } catch (err) {
    console.warn(
      '[Academy Meta Tracking] failed to write log:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Ensure canonical eventId is stored in meta_attribution for idempotent retries.
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} registrationId
 * @param {string} eventId
 * @param {Record<string, unknown>|null|undefined} registration
 */
async function ensureEventIdInAttribution(db, registrationId, eventId, registration) {
  const attr = parseMetaAttribution(registration?.meta_attribution);
  const stored =
    attr.eventId != null
      ? String(attr.eventId)
      : attr.event_id != null
        ? String(attr.event_id)
        : null;
  if (stored === eventId) return;

  const { error } = await updateAcademyRegistration(db, registrationId, {
    meta_attribution: { ...attr, eventId },
    updated_at: new Date().toISOString(),
  });

  if (error && isMissingMetaColumnError(error)) {
    logMissingMetaColumnsWarning('meta_attribution eventId persist');
  } else if (error) {
    console.warn('[Academy Meta Tracking] failed to persist eventId:', error.message);
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} registrationId
 * @param {{ req?: import('http').IncomingMessage|null }} [options]
 */
async function processConfirmedAcademyPurchaseTracking(db, registrationId, options = {}) {
  const { data: registration, error: regError } = await db
    .from('academy_registrations')
    .select('*, academy_promo_codes ( code )')
    .eq('id', registrationId)
    .single();

  if (regError || !registration) {
    console.warn('[Academy Meta Tracking] registration not found:', registrationId);
    return { trackable: false, pixel: null, capi: { attempted: false, ok: false, skipped: true } };
  }

  if (!isAcademyRegistrationTrackable(registration)) {
    const metadata = {
      registrationId,
      canonicalCreated: false,
      trackable: false,
      pixelExpected: false,
      capiAttempted: false,
      capiOk: false,
      capiSkipped: true,
    };
    console.warn('[Academy Meta Tracking]', JSON.stringify(metadata));
    try {
      await logAcademyEvent(db, {
        registrationId,
        eventType: 'meta_purchase_tracking',
        metadata,
      });
    } catch {
      // ignore
    }
    return { trackable: false, pixel: null, capi: { attempted: false, ok: false, skipped: true } };
  }

  const promoCode =
    registration.academy_promo_codes?.code != null
      ? String(registration.academy_promo_codes.code)
      : null;

  const canonical = buildCanonicalAcademyPurchaseEvent({
    registration,
    promoCode,
    req: options.req ?? null,
  });

  if (!canonical) {
    return { trackable: false, pixel: null, capi: { attempted: false, ok: false, skipped: true } };
  }

  await ensureEventIdInAttribution(db, registrationId, canonical.eventId, registration);

  const alreadySent = Boolean(registration.meta_purchase_sent_at);

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
              .from('academy_registrations')
              .update({ meta_purchase_sent_at: new Date().toISOString() })
              .eq('id', registrationId)
              .is('meta_purchase_sent_at', null);

            if (updateError) {
              if (isMissingMetaColumnError(updateError)) {
                logMissingMetaColumnsWarning('meta_purchase_sent_at update');
              } else {
                console.warn(
                  '[Academy Meta Tracking] failed to set meta_purchase_sent_at:',
                  updateError.message
                );
              }
            }
            await ensureEventIdInAttribution(db, registrationId, canonical.eventId, registration);
          }
        }
      } catch (err) {
        capiResult.error = err instanceof Error ? err.message : String(err);
        console.warn('[Academy Meta Tracking] CAPI send error:', capiResult.error);
      }
    }
  }

  if (!alreadySent) {
    await writeTrackingLog(db, registrationId, canonical, capiResult);
  }

  return {
    trackable: true,
    pixel: buildPixelPayloadFromCanonical(canonical),
    capi: capiResult,
  };
}

module.exports = {
  parseMetaAttribution,
  buildCanonicalAcademyPurchaseEvent,
  buildPixelPayloadFromCanonical,
  buildCapiServerEventFromCanonical,
  buildPixelAdvancedMatchingFromCanonical,
  buildSafeTrackingLogMetadata,
  processConfirmedAcademyPurchaseTracking,
};
