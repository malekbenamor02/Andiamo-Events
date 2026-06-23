'use strict';

const { buildHashedUserData } = require('./user-data.cjs');
const {
  getClientIp,
  parseAttributionFromBody,
} = require('./attribution.cjs');

const LEAD_CONTENT_NAME = 'Ambassador Application';
const LEAD_TYPE = 'ambassador_application';

function isLeadDebugEnabled() {
  return process.env.META_DEBUG_LEAD === 'true' || process.env.META_DEBUG_LEAD === '1';
}

/**
 * @param {Record<string, unknown>} payload
 */
function logStructured(payload) {
  console.warn(JSON.stringify({ ...payload, timestamp: new Date().toISOString() }));
}

/**
 * @param {Record<string, unknown>} serverEvent
 */
function redactServerEventForDebug(serverEvent) {
  const userData = serverEvent.user_data && typeof serverEvent.user_data === 'object'
    ? serverEvent.user_data
    : {};

  return {
    event_name: serverEvent.event_name,
    event_id: serverEvent.event_id,
    event_time: serverEvent.event_time,
    action_source: serverEvent.action_source,
    event_source_url: serverEvent.event_source_url,
    custom_data: serverEvent.custom_data,
    user_data: {
      fbp: userData.fbp,
      fbc: userData.fbc,
      client_ip_address: userData.client_ip_address ? '[present]' : undefined,
      client_user_agent: userData.client_user_agent ? '[present]' : undefined,
      em: userData.em ? '[hashed]' : undefined,
      ph: userData.ph ? '[hashed]' : undefined,
      fn: userData.fn ? '[hashed]' : undefined,
      ln: userData.ln ? '[hashed]' : undefined,
      ct: userData.ct ? '[hashed]' : undefined,
      country: userData.country ? '[hashed]' : undefined,
      external_id: userData.external_id ? '[hashed]' : undefined,
    },
  };
}

/**
 * @param {ReturnType<typeof buildCanonicalAmbassadorLeadEvent>} canonical
 * @returns {string[]}
 */
function validateLeadConsistency(canonical) {
  /** @type {string[]} */
  const warnings = [];
  if (!canonical?.eventId) {
    warnings.push('missing_event_id');
  }
  if (!canonical?.fbp && !canonical?.fbc) {
    warnings.push('missing_fbp_and_fbc');
  }
  if (!canonical?.customer?.email && !canonical?.customer?.phone) {
    warnings.push('missing_email_and_phone');
  }
  return warnings;
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
 * @param {Record<string, unknown>} application
 */
function buildCustomerFromApplication(application) {
  return {
    email: application.email != null ? String(application.email) : null,
    phone: application.phone_number != null ? String(application.phone_number) : null,
    fullName: application.full_name != null ? String(application.full_name) : null,
    city: application.city != null ? String(application.city) : null,
    country: 'tn',
  };
}

/**
 * @param {{
 *   application: Record<string, unknown>;
 *   attribution?: Record<string, unknown>|null;
 * }} params
 */
function buildCanonicalAmbassadorLeadEvent(params) {
  const { application, attribution } = params;
  if (!application || typeof application !== 'object') return null;

  const attr = parseMetaAttribution(attribution ?? application.meta_attribution);
  const eventId =
    attr.eventId != null
      ? String(attr.eventId).slice(0, 128)
      : attr.event_id != null
        ? String(attr.event_id).slice(0, 128)
        : null;

  if (!eventId) return null;

  const customer = buildCustomerFromApplication(application);
  if (!customer.email && !customer.phone) return null;

  const eventSourceUrl =
    attr.eventSourceUrl != null
      ? String(attr.eventSourceUrl)
      : attr.event_source_url != null
        ? String(attr.event_source_url)
        : undefined;

  const clientIp =
    attr.clientIp != null
      ? String(attr.clientIp)
      : attr.client_ip != null
        ? String(attr.client_ip)
        : undefined;

  const clientUserAgent =
    attr.clientUserAgent != null
      ? String(attr.clientUserAgent)
      : attr.client_user_agent != null
        ? String(attr.client_user_agent)
        : undefined;

  return {
    eventName: 'Lead',
    eventId,
    eventTime: Math.floor(Date.now() / 1000),
    applicationId: String(application.id),
    customer,
    fbp: attr.fbp != null ? String(attr.fbp) : undefined,
    fbc: attr.fbc != null ? String(attr.fbc) : undefined,
    eventSourceUrl,
    clientIp: clientIp && clientIp !== 'unknown' ? clientIp : undefined,
    clientUserAgent,
  };
}

/**
 * @param {ReturnType<typeof buildCanonicalAmbassadorLeadEvent>} canonical
 */
function buildCapiLeadServerEvent(canonical) {
  if (!canonical) return null;

  const userData = buildHashedUserData(canonical.customer);
  if (canonical.fbp) userData.fbp = canonical.fbp;
  if (canonical.fbc) userData.fbc = canonical.fbc;
  if (canonical.clientIp) userData.client_ip_address = canonical.clientIp;
  if (canonical.clientUserAgent) userData.client_user_agent = canonical.clientUserAgent;

  /** @type {Record<string, unknown>} */
  const serverEvent = {
    event_name: canonical.eventName,
    event_time: canonical.eventTime,
    event_id: canonical.eventId,
    action_source: 'website',
    user_data: userData,
    custom_data: {
      content_name: LEAD_CONTENT_NAME,
      lead_type: LEAD_TYPE,
    },
  };

  if (canonical.eventSourceUrl) {
    serverEvent.event_source_url = canonical.eventSourceUrl;
  }

  return serverEvent;
}

/**
 * @param {ReturnType<typeof buildCanonicalAmbassadorLeadEvent>} canonical
 */
function logLeadConsistencyWarnings(canonical) {
  const warnings = validateLeadConsistency(canonical);
  for (const reason of warnings) {
    logStructured({
      tag: 'META_LEAD_CAPI_WARNING',
      event_id: canonical?.eventId,
      application_id: canonical?.applicationId,
      reason,
      fbp_present: Boolean(canonical?.fbp),
      fbc_present: Boolean(canonical?.fbc),
    });
  }
  return warnings;
}

/**
 * @param {{
 *   canonical: ReturnType<typeof buildCanonicalAmbassadorLeadEvent>;
 *   applicationId: string;
 * }} params
 * @returns {Promise<{ attempted: boolean; ok: boolean; skipped: boolean; error?: string; reason?: string }>}
 */
async function sendAmbassadorLeadCapiSafe(params) {
  const { canonical, applicationId } = params;

  /** @type {{ attempted: boolean; ok: boolean; skipped: boolean; error?: string; reason?: string }} */
  const result = { attempted: false, ok: false, skipped: true };

  if (!canonical) {
    result.error = 'invalid_canonical';
    result.reason = 'invalid_canonical';
    logStructured({
      tag: 'META_LEAD_CAPI_FAILED',
      event_id: undefined,
      application_id: applicationId,
      error: result.error,
      reason: result.reason,
      fbp_present: false,
      fbc_present: false,
    });
    return result;
  }

  logLeadConsistencyWarnings(canonical);

  const { postCapiEvent, canSendCapiEvents } = require('./conversions-api.cjs');

  if (!canSendCapiEvents()) {
    result.reason = 'capi_not_configured_or_blocked';
    logStructured({
      tag: 'META_LEAD_CAPI_SKIPPED',
      event_id: canonical.eventId,
      application_id: applicationId,
      reason: result.reason,
      fbp_present: Boolean(canonical.fbp),
      fbc_present: Boolean(canonical.fbc),
    });
    return result;
  }

  result.attempted = true;
  result.skipped = false;

  try {
    const serverEvent = buildCapiLeadServerEvent(canonical);
    if (!serverEvent) {
      result.error = 'invalid_server_event';
      result.reason = 'invalid_server_event';
      logStructured({
        tag: 'META_LEAD_CAPI_FAILED',
        event_id: canonical.eventId,
        application_id: applicationId,
        error: result.error,
        reason: result.reason,
        fbp_present: Boolean(canonical.fbp),
        fbc_present: Boolean(canonical.fbc),
      });
      return result;
    }

    if (isLeadDebugEnabled()) {
      logStructured({
        tag: 'META_LEAD_CAPI_DEBUG',
        phase: 'pre_send',
        event_id: canonical.eventId,
        application_id: applicationId,
        payload: redactServerEventForDebug(serverEvent),
      });
    }

    const postResult = await postCapiEvent(serverEvent);
    result.ok = Boolean(postResult.ok);
    result.skipped = Boolean(postResult.skipped);
    if (postResult.error) {
      result.error = String(postResult.error);
      result.reason = String(postResult.error);
    }

    if (isLeadDebugEnabled()) {
      logStructured({
        tag: 'META_LEAD_CAPI_DEBUG',
        phase: 'post_send',
        event_id: canonical.eventId,
        application_id: applicationId,
        response: {
          ok: postResult.ok,
          skipped: postResult.skipped,
          error: postResult.error ? String(postResult.error) : undefined,
        },
      });
    }

    if (postResult.ok) {
      logStructured({
        tag: 'META_LEAD_CAPI_SUCCESS',
        event_id: canonical.eventId,
        application_id: applicationId,
        fbp_present: Boolean(canonical.fbp),
        fbc_present: Boolean(canonical.fbc),
      });
    } else {
      logStructured({
        tag: 'META_LEAD_CAPI_FAILED',
        event_id: canonical.eventId,
        application_id: applicationId,
        error: result.error || 'capi_send_failed',
        reason: result.reason || 'capi_send_failed',
        fbp_present: Boolean(canonical.fbp),
        fbc_present: Boolean(canonical.fbc),
      });
    }

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.error = message;
    result.reason = 'capi_exception';
    logStructured({
      tag: 'META_LEAD_CAPI_FAILED',
      event_id: canonical.eventId,
      application_id: applicationId,
      error: message,
      reason: result.reason,
      fbp_present: Boolean(canonical.fbp),
      fbc_present: Boolean(canonical.fbc),
    });
    return result;
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} applicationId
 */
async function isLeadAlreadySent(db, applicationId) {
  const { data, error } = await db
    .from('ambassador_applications')
    .select('meta_lead_sent_at')
    .eq('id', applicationId)
    .maybeSingle();

  if (error) {
    console.warn(
      '[Ambassador Meta Tracking] failed to read meta_lead_sent_at:',
      error.message
    );
    return false;
  }

  return Boolean(data?.meta_lead_sent_at);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} applicationId
 */
async function markLeadSentAt(db, applicationId) {
  const { error: updateError } = await db
    .from('ambassador_applications')
    .update({ meta_lead_sent_at: new Date().toISOString() })
    .eq('id', applicationId)
    .is('meta_lead_sent_at', null);

  if (updateError) {
    console.warn(
      '[Ambassador Meta Tracking] failed to set meta_lead_sent_at:',
      updateError.message
    );
    return false;
  }

  return true;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} db
 * @param {string} applicationId
 * @param {{ req?: import('http').IncomingMessage|null; attribution?: Record<string, unknown>|null }} [options]
 */
async function processAmbassadorLeadTracking(db, applicationId, options = {}) {
  try {
    const { data: application, error: loadError } = await db
      .from('ambassador_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (loadError || !application) {
      logStructured({
        tag: 'META_LEAD_CAPI_FAILED',
        event_id: options.attribution?.eventId,
        application_id: applicationId,
        error: 'application_not_found',
        reason: 'application_not_found',
        fbp_present: Boolean(options.attribution?.fbp),
        fbc_present: Boolean(options.attribution?.fbc),
      });
      return { trackable: false, capi: { attempted: false, ok: false, skipped: true, error: 'application_not_found' } };
    }

    if (await isLeadAlreadySent(db, applicationId)) {
      const attr = parseMetaAttribution(options.attribution ?? application.meta_attribution);
      const eventId =
        attr.eventId != null
          ? String(attr.eventId)
          : attr.event_id != null
            ? String(attr.event_id)
            : undefined;

      logStructured({
        tag: 'META_LEAD_CAPI_SKIPPED',
        event_id: eventId,
        application_id: applicationId,
        reason: 'already_sent',
        fbp_present: Boolean(attr.fbp),
        fbc_present: Boolean(attr.fbc),
      });

      return {
        trackable: true,
        capi: { attempted: false, ok: true, skipped: true, error: 'already_sent', reason: 'already_sent' },
      };
    }

    const attribution = options.attribution ?? application.meta_attribution;
    const canonical = buildCanonicalAmbassadorLeadEvent({ application, attribution });

    if (!canonical) {
      logStructured({
        tag: 'META_LEAD_CAPI_FAILED',
        event_id: options.attribution?.eventId,
        application_id: applicationId,
        error: 'invalid_lead',
        reason: 'missing_event_id_or_customer',
        fbp_present: Boolean(options.attribution?.fbp),
        fbc_present: Boolean(options.attribution?.fbc),
      });
      return {
        trackable: false,
        capi: { attempted: false, ok: false, skipped: true, error: 'invalid_lead', reason: 'missing_event_id_or_customer' },
      };
    }

    const capiResult = await sendAmbassadorLeadCapiSafe({ canonical, applicationId });

    if (capiResult.ok) {
      const marked = await markLeadSentAt(db, applicationId);
      if (!marked) {
        logStructured({
          tag: 'META_LEAD_CAPI_WARNING',
          event_id: canonical.eventId,
          application_id: applicationId,
          reason: 'meta_lead_sent_at_update_failed',
          fbp_present: Boolean(canonical.fbp),
          fbc_present: Boolean(canonical.fbc),
        });
      }
    }

    return { trackable: true, capi: capiResult };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logStructured({
      tag: 'META_LEAD_CAPI_FAILED',
      event_id: options.attribution?.eventId,
      application_id: applicationId,
      error: message,
      reason: 'process_exception',
      fbp_present: Boolean(options.attribution?.fbp),
      fbc_present: Boolean(options.attribution?.fbc),
    });
    return {
      trackable: false,
      capi: { attempted: false, ok: false, skipped: true, error: message, reason: 'process_exception' },
    };
  }
}

module.exports = {
  getClientIp,
  parseAttributionFromBody,
  parseMetaAttribution,
  buildCanonicalAmbassadorLeadEvent,
  buildCapiLeadServerEvent,
  validateLeadConsistency,
  redactServerEventForDebug,
  sendAmbassadorLeadCapiSafe,
  processAmbassadorLeadTracking,
};
