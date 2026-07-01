/**
 * Stable public API error responses — user-safe message in prod; details only in dev.
 */

/** @typedef {import('express').Response} ExpressResponse */

export const PUBLIC_ERROR_CODES = {
  PASSES_UNAVAILABLE: 'passes_unavailable',
  EVENT_NOT_FOUND: 'event_not_found',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  INVALID_PROMO_CODE: 'invalid_promo_code',
  INSUFFICIENT_STOCK: 'insufficient_stock',
  PAYMENT_UNAVAILABLE: 'payment_unavailable',
  PRESALE_CODE_INVALID: 'presale_code_invalid',
  PRESALE_CODE_EXHAUSTED: 'presale_code_exhausted',
  PRESALE_UNAVAILABLE: 'presale_unavailable',
  PRESALE_ACCESS_REQUIRED: 'presale_access_required',
  RATE_LIMITED: 'rate_limited',
  VALIDATION_FAILED: 'validation_failed',
  RECAPTCHA_FAILED: 'recaptcha_failed',
  ORDER_NOT_FOUND: 'order_not_found',
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_UNKNOWN: 'payment_unknown',
  INVALID_REQUEST: 'invalid_request',
  EVENT_NOT_AVAILABLE: 'event_not_available',
  PASS_NOT_AVAILABLE: 'pass_not_available',
  PAYMENT_METHOD_NOT_ALLOWED: 'payment_method_not_allowed',
  AMBASSADOR_NOT_FOUND: 'ambassador_not_found',
  AMBASSADOR_UNAVAILABLE: 'ambassador_unavailable',
  TOO_MANY_ORDERS: 'too_many_orders',
  INVALID_ACCESS: 'invalid_access',
  ACADEMY_SOLD_OUT: 'academy_sold_out',
  ACADEMY_CLOSED: 'academy_closed',
  REGISTRATION_EXPIRED: 'registration_expired',
  REGISTRATION_NOT_FOUND: 'registration_not_found',
  SUBMISSION_FAILED: 'submission_failed',
  DUPLICATE_APPLICATION: 'duplicate_application',
  FORM_UNAVAILABLE: 'form_unavailable',
};

/** Default EN messages keyed by code (override per call when needed). */
export const PUBLIC_ERROR_MESSAGES_EN = {
  [PUBLIC_ERROR_CODES.PASSES_UNAVAILABLE]:
    "We couldn't load tickets for this event. Please refresh the page or try again later.",
  [PUBLIC_ERROR_CODES.EVENT_NOT_FOUND]: 'This event is no longer available.',
  [PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE]:
    'Something went wrong on our side. Please try again in a few minutes.',
  [PUBLIC_ERROR_CODES.INVALID_PROMO_CODE]: "This promo code isn't valid for your order.",
  [PUBLIC_ERROR_CODES.INSUFFICIENT_STOCK]: 'Not enough passes are left for your selection.',
  [PUBLIC_ERROR_CODES.PAYMENT_UNAVAILABLE]:
    "Online payment isn't available right now. Please try again or contact us.",
  [PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID]:
    "That presale code isn't valid. Check it and try again.",
  [PUBLIC_ERROR_CODES.PRESALE_CODE_EXHAUSTED]:
    'This presale code is no longer available. Please DM us on Instagram for a new code.',
  [PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE]:
    "Presale access isn't available right now. Please try again later.",
  [PUBLIC_ERROR_CODES.PRESALE_ACCESS_REQUIRED]:
    'Enter your presale code to unlock ticket selection.',
  [PUBLIC_ERROR_CODES.RATE_LIMITED]:
    'Too many attempts. Please wait a moment and try again.',
  [PUBLIC_ERROR_CODES.VALIDATION_FAILED]: 'Please check the form and try again.',
  [PUBLIC_ERROR_CODES.RECAPTCHA_FAILED]: 'Security verification failed. Please try again.',
  [PUBLIC_ERROR_CODES.ORDER_NOT_FOUND]: 'We could not find this order.',
  [PUBLIC_ERROR_CODES.PAYMENT_FAILED]:
    'Your payment could not be completed. Please try again or choose another payment method.',
  [PUBLIC_ERROR_CODES.PAYMENT_UNKNOWN]:
    'We could not confirm your payment. If you were charged, please wait for confirmation or contact us.',
  [PUBLIC_ERROR_CODES.INVALID_REQUEST]: 'This request could not be processed.',
  [PUBLIC_ERROR_CODES.EVENT_NOT_AVAILABLE]: 'Pass sales are closed for this event.',
  [PUBLIC_ERROR_CODES.PASS_NOT_AVAILABLE]: 'One or more selected passes are no longer available.',
  [PUBLIC_ERROR_CODES.PAYMENT_METHOD_NOT_ALLOWED]:
    'The selected payment method is not available for one of your passes.',
  [PUBLIC_ERROR_CODES.AMBASSADOR_NOT_FOUND]: 'The selected ambassador is no longer available.',
  [PUBLIC_ERROR_CODES.AMBASSADOR_UNAVAILABLE]:
    'The selected ambassador cannot receive new orders right now.',
  [PUBLIC_ERROR_CODES.TOO_MANY_ORDERS]: 'Too many orders. Please try again later.',
  [PUBLIC_ERROR_CODES.INVALID_ACCESS]: 'You do not have access to complete this action.',
  [PUBLIC_ERROR_CODES.ACADEMY_SOLD_OUT]: 'Academy registration is full.',
  [PUBLIC_ERROR_CODES.ACADEMY_CLOSED]: 'Academy registrations are currently closed.',
  [PUBLIC_ERROR_CODES.REGISTRATION_EXPIRED]:
    'Your registration was not completed in time. Please register again.',
  [PUBLIC_ERROR_CODES.REGISTRATION_NOT_FOUND]: 'We could not find this registration.',
  [PUBLIC_ERROR_CODES.SUBMISSION_FAILED]: 'Your submission could not be sent. Please try again.',
  [PUBLIC_ERROR_CODES.DUPLICATE_APPLICATION]:
    'An application with these details already exists for this position.',
  [PUBLIC_ERROR_CODES.FORM_UNAVAILABLE]: 'This form is not available right now.',
};

/** User-safe presale redeem messages keyed by reason (frontend maps reason too). */
export const PRESALE_REASON_MESSAGES = {
  missing_service_role: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE],
  captcha_failed: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.RECAPTCHA_FAILED],
  presale_off: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE],
  event_not_found: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.EVENT_NOT_FOUND],
  presale_dates_missing: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE],
  presale_not_started: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE],
  presale_ended: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE],
  code_not_found: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID],
  code_not_active_yet: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID],
  code_expired: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_CODE_INVALID],
  code_exhausted: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_CODE_EXHAUSTED],
  session_create_failed: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE],
  server_error: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE],
  rate_limited: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.RATE_LIMITED],
  missing_fields: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.VALIDATION_FAILED],
  server_misconfigured: PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.PRESALE_UNAVAILABLE],
};

/**
 * Presale redeem/session failure — keeps `reason` for client mapping.
 */
export function presaleApiError(res, status, reason, logDetails) {
  if (logDetails !== undefined) {
    console.error(`[presale-api-error] ${reason} (${status}):`, logDetails);
  }
  const message =
    PRESALE_REASON_MESSAGES[reason] ||
    PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE];
  const body = { success: false, reason, message, error: reason };
  if (process.env.NODE_ENV !== 'production' && logDetails !== undefined) {
    body.details = logDetails;
  }
  return res.status(status).json(body);
}

/**
 * @param {ExpressResponse | import('http').ServerResponse} res
 * @param {number} status
 * @param {string} code
 * @param {string} [messageOverride]
 * @param {{ logDetails?: unknown; details?: unknown; extra?: Record<string, unknown> }} [opts]
 */
export function publicApiError(res, status, code, messageOverride, opts = {}) {
  const { logDetails, details, extra } = opts;
  const message =
    messageOverride ||
    PUBLIC_ERROR_MESSAGES_EN[code] ||
    PUBLIC_ERROR_MESSAGES_EN[PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE];

  if (logDetails !== undefined) {
    console.error(`[public-api-error] ${code} (${status}):`, logDetails);
  }

  /** @type {Record<string, unknown>} */
  const body = { error: code, message, ...extra };

  if (process.env.NODE_ENV !== 'production' && details !== undefined) {
    body.details = details;
  }

  return res.status(status).json(body);
}

/**
 * Map legacy order-create error strings to stable codes (server-side).
 * @param {string} errorKey
 * @param {string} [details]
 * @returns {{ code: string; message: string }}
 */
export function mapOrderCreateError(errorKey, details) {
  const key = String(errorKey || '').toLowerCase();
  const det = String(details || '');

  const M = PUBLIC_ERROR_MESSAGES_EN;

  if (key.includes('too many orders')) {
    return { code: PUBLIC_ERROR_CODES.TOO_MANY_ORDERS, message: M[PUBLIC_ERROR_CODES.TOO_MANY_ORDERS] };
  }
  if (key.includes('invalid promo')) {
    return { code: PUBLIC_ERROR_CODES.INVALID_PROMO_CODE, message: M[PUBLIC_ERROR_CODES.INVALID_PROMO_CODE] };
  }
  if (key.includes('recaptcha')) {
    return { code: PUBLIC_ERROR_CODES.RECAPTCHA_FAILED, message: M[PUBLIC_ERROR_CODES.RECAPTCHA_FAILED] };
  }
  if (key.includes('insufficient stock') || det.toLowerCase().includes('available')) {
    const stockMsg = det && !looksInternal(det) ? det : M[PUBLIC_ERROR_CODES.INSUFFICIENT_STOCK];
    return { code: PUBLIC_ERROR_CODES.INSUFFICIENT_STOCK, message: stockMsg };
  }
  if (key.includes('event not available') || key.includes('pass sales are closed')) {
    return {
      code: PUBLIC_ERROR_CODES.EVENT_NOT_AVAILABLE,
      message: det && !looksInternal(det) ? det : M[PUBLIC_ERROR_CODES.EVENT_NOT_AVAILABLE],
    };
  }
  if (key.includes('pass not available') || key.includes('no longer available')) {
    const passMsg = det && !looksInternal(det) ? det : M[PUBLIC_ERROR_CODES.PASS_NOT_AVAILABLE];
    return { code: PUBLIC_ERROR_CODES.PASS_NOT_AVAILABLE, message: passMsg };
  }
  if (key.includes('payment method not allowed')) {
    return {
      code: PUBLIC_ERROR_CODES.PAYMENT_METHOD_NOT_ALLOWED,
      message: M[PUBLIC_ERROR_CODES.PAYMENT_METHOD_NOT_ALLOWED],
    };
  }
  if (key.includes('ambassador not found')) {
    return { code: PUBLIC_ERROR_CODES.AMBASSADOR_NOT_FOUND, message: M[PUBLIC_ERROR_CODES.AMBASSADOR_NOT_FOUND] };
  }
  if (key.includes('ambassador cannot receive')) {
    return {
      code: PUBLIC_ERROR_CODES.AMBASSADOR_UNAVAILABLE,
      message: M[PUBLIC_ERROR_CODES.AMBASSADOR_UNAVAILABLE],
    };
  }
  if (key.includes('invalid access')) {
    return { code: PUBLIC_ERROR_CODES.INVALID_ACCESS, message: M[PUBLIC_ERROR_CODES.INVALID_ACCESS] };
  }
  if (
    key.includes('missing required') ||
    key.includes('invalid pass') ||
    key.includes('invalid email') ||
    key.includes('invalid phone') ||
    key.includes('invalid payment method') ||
    key.includes('validation')
  ) {
    const valMsg = det && !looksInternal(det) ? det : M[PUBLIC_ERROR_CODES.VALIDATION_FAILED];
    return { code: PUBLIC_ERROR_CODES.VALIDATION_FAILED, message: valMsg };
  }

  return {
    code: PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE,
    message: M[PUBLIC_ERROR_CODES.SERVICE_UNAVAILABLE],
  };
}

/**
 * Convenience wrapper: map legacy error string + return publicApiError.
 */
export function publicApiErrorFromLegacy(res, status, errorKey, details, logDetails) {
  const mapped = mapOrderCreateError(errorKey, details);
  return publicApiError(res, status, mapped.code, mapped.message, {
    logDetails: logDetails ?? details,
    details: logDetails ?? details,
  });
}

/** @param {string} text */
function looksInternal(text) {
  const t = text.toLowerCase();
  return (
    t.includes('supabase') ||
    t.includes('service_role') ||
    t.includes('pgrst') ||
    t.includes('.env') ||
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text) ||
    t.includes('clictopay_api') ||
    t.includes('stack')
  );
}
