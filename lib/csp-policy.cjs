'use strict';

/**
 * Canonical Content-Security-Policy for Andiamo Events.
 * Used by server.cjs and vercel.json (both Content-Security-Policy headers).
 *
 * Each directive name is followed by TWO ASCII spaces before the first source.
 * Live production has returned enforcing headers with merged tokens such as
 * script-src'self' when only a single TAB or single space was used.
 */
const CSP_SEP = '  ';

const CSP_POLICY =
  `default-src${CSP_SEP}'self'; ` +
  `base-uri${CSP_SEP}'self'; ` +
  `object-src${CSP_SEP}'none'; ` +
  `frame-ancestors${CSP_SEP}'none'; ` +
  `img-src${CSP_SEP}'self' https: data:; ` +
  `font-src${CSP_SEP}'self' https: data:; ` +
  `style-src${CSP_SEP}'self' 'unsafe-inline' https:; ` +
  `script-src${CSP_SEP}'self' 'unsafe-inline' 'unsafe-eval' https: https://www.clarity.ms https://scripts.clarity.ms; ` +
  `worker-src${CSP_SEP}'self' blob:; ` +
  `connect-src${CSP_SEP}'self' https: wss: *.supabase.co *.supabase.in *.google.com *.gstatic.com *.vercel-analytics.com *.vercel-insights.com *.sentry.io *.ingest.sentry.io *.clarity.ms https://c.bing.com *.clictopay.com test.clictopay.com; ` +
  `frame-src${CSP_SEP}'self' https: *.google.com *.clictopay.com test.clictopay.com; ` +
  'report-uri /api/csp-report;';

const SOURCE_DIRECTIVES = new Set([
  'default-src',
  'base-uri',
  'object-src',
  'frame-ancestors',
  'img-src',
  'font-src',
  'style-src',
  'script-src',
  'worker-src',
  'connect-src',
  'frame-src',
]);

/** Known merged-token patterns from live enforcing-header corruption. */
const MERGED_TOKEN_PATTERNS = [
  /style-src'self'/i,
  /script-src'self'/i,
  /connect-src'self'/i,
  /font-src'self'/i,
  /img-src'self'/i,
  /worker-src'self'/i,
  /frame-src'self'/i,
  /default-src'self'/i,
  /object-src'none'/i,
  /base-uri'self'/i,
];

function parseDirectiveSegments(value) {
  return String(value || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseDirectiveSegment(segment) {
  const match = segment.match(/^([a-z-]+)(\s*)(.*)$/i);
  if (!match) return null;
  return { name: match[1].toLowerCase(), whitespace: match[2], value: match[3] };
}

/** True when a directive name is immediately followed by a source token (no whitespace). */
function hasMalformedCspSpacing(value) {
  if (!value || typeof value !== 'string') return true;

  for (const pattern of MERGED_TOKEN_PATTERNS) {
    if (pattern.test(value)) return true;
  }

  for (const segment of parseDirectiveSegments(value)) {
    const parsed = parseDirectiveSegment(segment);
    if (!parsed) continue;

    if (parsed.name === 'report-uri') {
      if (parsed.value && parsed.whitespace.length === 0) return true;
      continue;
    }

    if (!SOURCE_DIRECTIVES.has(parsed.name)) continue;
    if (!parsed.value || parsed.whitespace.length === 0) return true;
  }

  return false;
}

function isValidCspPolicy(value) {
  if (!value || typeof value !== 'string') return false;
  if (!value.includes('report-uri')) return false;
  if (hasMalformedCspSpacing(value)) return false;
  if (!/;\s+/.test(value)) return false;

  const required = ['default-src', 'style-src', 'script-src', 'connect-src'];
  const seen = new Set();

  for (const segment of parseDirectiveSegments(value)) {
    const parsed = parseDirectiveSegment(segment);
    if (!parsed) return false;

    seen.add(parsed.name);

    if (!SOURCE_DIRECTIVES.has(parsed.name)) continue;
    if (!parsed.value || parsed.whitespace.length === 0) return false;
  }

  return required.every((name) => seen.has(name));
}

function normalizeCspPolicy(value) {
  return String(value || '')
    .replace(/\r?\n[\s\t]+/g, ' ')
    .replace(/[\s\t]+/g, ' ')
    .trim();
}

function cspPoliciesAreIdentical(a, b) {
  if (a === b) return true;
  return normalizeCspPolicy(a) === normalizeCspPolicy(b);
}

module.exports = {
  CSP_POLICY,
  CSP_SEP,
  hasMalformedCspSpacing,
  isValidCspPolicy,
  normalizeCspPolicy,
  cspPoliciesAreIdentical,
  parseDirectiveSegments,
  parseDirectiveSegment,
};
