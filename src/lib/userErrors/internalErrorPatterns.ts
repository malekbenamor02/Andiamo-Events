const INTERNAL_PATTERNS: RegExp[] = [
  /supabase/i,
  /service_role/i,
  /\.env\b/i,
  /pgrst/i,
  /restart the api/i,
  /clictopay_api/i,
  /missing database key/i,
  /not configured/i,
  /internal server error/i,
  /method not allowed/i,
  /cors policy/i,
  /\[object object\]/i,
  /at\s+\w+\s+\(/,
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  /vite_supabase/i,
  /ask the developer/i,
  /demandez au développeur/i,
  /open the event.*admin/i,
  /dans l'admin/i,
];

export function isLikelyInternalErrorText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return INTERNAL_PATTERNS.some((re) => re.test(t));
}

/** Map legacy free-text API errors to stable codes during migration. */
export function legacyTextToCode(text: string): string | undefined {
  const t = text.toLowerCase();
  if (t.includes('passes could not') || t.includes('failed to fetch passes')) {
    return 'passes_unavailable';
  }
  if (t.includes('too many orders') || t.includes('too many suggestions') || t.includes('too many attempts')) {
    return 'rate_limited';
  }
  if (t.includes('invalid promo')) return 'invalid_promo_code';
  if (t.includes('recaptcha')) return 'recaptcha_failed';
  if (t.includes('insufficient stock') || t.includes('only ') && t.includes('available')) {
    return 'insufficient_stock';
  }
  if (t.includes('event not available') || t.includes('pass sales are closed')) {
    return 'event_not_available';
  }
  if (t.includes('pass not available') || t.includes('no longer available')) return 'pass_not_available';
  if (t.includes('ambassador not found')) return 'ambassador_not_found';
  if (t.includes('ambassador cannot receive')) return 'ambassador_unavailable';
  if (t.includes('invalid access')) return 'invalid_access';
  if (t.includes('order not found')) return 'order_not_found';
  if (t.includes('registration expired') || t.includes('registration_expired')) {
    return 'registration_expired';
  }
  if (t.includes('academy_sold_out') || t.includes('sold out')) return 'academy_sold_out';
  if (t.includes('academy_closed') || t.includes('registrations closed')) return 'academy_closed';
  if (t.includes('duplicate') || t.includes('already exists')) return 'duplicate_application';
  if (t.includes('validation failed') || t.includes('missing required')) return 'validation_failed';
  if (t.includes('payment gateway') || t.includes('payment unavailable')) return 'payment_unavailable';
  if (t.includes('event not found')) return 'event_not_found';
  return undefined;
}
