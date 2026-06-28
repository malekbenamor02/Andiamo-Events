'use strict';

/**
 * Canonical Content-Security-Policy for Andiamo Events.
 * Used by server.cjs; vercel.json must use the identical string for both
 * Content-Security-Policy and Content-Security-Policy-Report-Only.
 */
const CSP_POLICY =
  "default-src 'self'; " +
  "base-uri 'self'; " +
  "object-src 'none'; " +
  "frame-ancestors 'none'; " +
  "img-src 'self' https: data:; " +
  "font-src 'self' https: data:; " +
  "style-src 'self' 'unsafe-inline' https:; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://www.clarity.ms https://scripts.clarity.ms; " +
  "worker-src 'self' blob:; " +
  "connect-src 'self' https: wss: *.supabase.co *.supabase.in *.google.com *.gstatic.com *.vercel-analytics.com *.vercel-insights.com *.sentry.io *.ingest.sentry.io *.clarity.ms https://c.bing.com *.clictopay.com test.clictopay.com; " +
  "frame-src 'self' https: *.google.com *.clictopay.com test.clictopay.com; " +
  'report-uri /api/csp-report;';

/** Reject malformed directives like style-src'self' (missing space after directive name). */
function isValidCspPolicy(value) {
  if (!value || typeof value !== 'string') return false;
  if (!value.includes('report-uri')) return false;
  if (/[a-z-]+src'/.test(value)) return false;
  if (/[a-z-]+uri'/.test(value)) return false;
  if (!/default-src\s+'self'/.test(value)) return false;
  if (!/style-src\s+'self'/.test(value)) return false;
  if (!/connect-src\s+'self'/.test(value)) return false;
  if (!/;\s+/.test(value)) return false;
  return true;
}

module.exports = { CSP_POLICY, isValidCspPolicy };
