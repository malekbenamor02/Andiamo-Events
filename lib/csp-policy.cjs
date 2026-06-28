'use strict';

/**
 * Canonical Content-Security-Policy for Andiamo Events.
 * Used by server.cjs and vercel.json (both Content-Security-Policy headers).
 *
 * Directive names are followed by TAB (not space) before the first source token.
 * Vercel's edge has been observed stripping ASCII spaces in the enforcing
 * Content-Security-Policy header only (style-src'self'), while Report-Only is
 * left intact. TAB is valid CSP whitespace and survives that transform.
 */
const CSP_POLICY =
  "default-src\t'self'; " +
  "base-uri\t'self'; " +
  "object-src\t'none'; " +
  "frame-ancestors\t'none'; " +
  "img-src\t'self' https: data:; " +
  "font-src\t'self' https: data:; " +
  "style-src\t'self' 'unsafe-inline' https:; " +
  "script-src\t'self' 'unsafe-inline' 'unsafe-eval' https: https://www.clarity.ms https://scripts.clarity.ms; " +
  "worker-src\t'self' blob:; " +
  "connect-src\t'self' https: wss: *.supabase.co *.supabase.in *.google.com *.gstatic.com *.vercel-analytics.com *.vercel-insights.com *.sentry.io *.ingest.sentry.io *.clarity.ms https://c.bing.com *.clictopay.com test.clictopay.com; " +
  "frame-src\t'self' https: *.google.com *.clictopay.com test.clictopay.com; " +
  'report-uri /api/csp-report;';

/** Malformed patterns seen when spaces are stripped after directive names. */
function hasMalformedCspSpacing(value) {
  if (!value || typeof value !== 'string') return true;
  if (/style-src'self'/i.test(value)) return true;
  if (/connect-src'self'/i.test(value)) return true;
  if (/[a-z-]+src'(?:self|none|unsafe)/i.test(value)) return true;
  if (/[a-z-]+uri'/.test(value)) return true;
  return false;
}

function isValidCspPolicy(value) {
  if (!value || typeof value !== 'string') return false;
  if (!value.includes('report-uri')) return false;
  if (hasMalformedCspSpacing(value)) return false;
  if (!/default-src[\s\t]+'self'/i.test(value)) return false;
  if (!/style-src[\s\t]+'self'/i.test(value)) return false;
  if (!/connect-src[\s\t]+'self'/i.test(value)) return false;
  if (!/;\s+/.test(value)) return false;
  return true;
}

function normalizeCspPolicy(value) {
  return String(value || '')
    .replace(/\r?\n[\s\t]+/g, ' ')
    .replace(/[\s\t]+/g, ' ')
    .trim();
}

function cspPoliciesAreIdentical(a, b) {
  return normalizeCspPolicy(a) === normalizeCspPolicy(b);
}

module.exports = {
  CSP_POLICY,
  hasMalformedCspSpacing,
  isValidCspPolicy,
  normalizeCspPolicy,
  cspPoliciesAreIdentical,
};
