'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync, existsSync } = require('fs');
const { resolve, join, relative } = require('path');

const root = resolve(__dirname, '../..');

const SCAN_DIRS = ['api', 'lib', 'src', 'server.cjs'];

const STRICT_LOG_PATTERNS = [
  /\bsecure_token\b/,
  /\bsecureToken\b/,
  /\bqr_token\b/,
  /\bqrToken\b/,
];

const ENV_NAME_LOG_PATTERNS = [
  /\bJWT_SECRET\b/,
  /\bSUPABASE_SERVICE_ROLE_KEY\b/,
  /\badminToken\b/,
  /\bscannerToken\b/,
  /\bambassadorToken\b/,
  /\bposToken\b/,
  /\bacademyInfluencerToken\b/,
];

const DIAGNOSTIC_MSG_RE =
  /(required|Missing|not set|not configured|is required|fail closed|Warning:|WARNING:)/i;

const LOG_CALL_RE = /\b(console\.(log|error|warn|info|debug)|logger\.(log|error|warn|info|debug))\s*\(/g;

const ALLOW_PATH_MARKERS = [
  'maskTokenForLogs',
  'safe-ticket-log.cjs',
  'no-sensitive-token-logs.test.cjs',
  'sanitize.ts',
  'internalErrorPatterns',
  'ticket-qr-url.cjs',
  'token_preview',
  'secure_token_preview',
  'hasSecureToken',
  'ticketLogId',
  'scripts/security/',
  'scripts/fix-server-cjs-service-role.mjs',
  'not set — privileged routes will fail closed',
  'OK  tickets.secure_token:',
  'OK  payment_options:',
];

function walkFiles(base, acc = []) {
  if (!existsSync(base)) return acc;
  const st = statSync(base);
  if (st.isFile()) {
    if (/\.(js|cjs|mjs|ts|tsx)$/.test(base) && !/\.test\.(cjs|js|ts|tsx)$/.test(base)) {
      acc.push(base);
    }
    return acc;
  }
  for (const name of readdirSync(base)) {
    if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
    walkFiles(join(base, name), acc);
  }
  return acc;
}

function collectFiles() {
  const files = [];
  for (const entry of SCAN_DIRS) {
    walkFiles(resolve(root, entry), files);
  }
  return files;
}

function isAllowedContext(line, window, rel) {
  if (rel.startsWith('scripts/security/')) return true;
  if (rel === 'scripts/fix-server-cjs-service-role.mjs') return true;
  if (ALLOW_PATH_MARKERS.some((m) => window.includes(m) || line.includes(m))) return true;
  if (/\.select\s*\(\s*['"`][^'"`]*secure_token/.test(window)) return true;
  if (/\.eq\s*\(\s*['"`]secure_token['"`]/.test(window)) return true;
  if (/secure_token\s*:/.test(line) && !LOG_CALL_RE.test(line)) return true;
  if (/API_ROUTES\.TICKET_QR/.test(window)) return true;
  if (/buildTicketQrApiUrl/.test(window)) return true;
  if (/generateTicketQrPngBuffer/.test(window)) return true;
  if (/isValidSecureToken/.test(window)) return true;
  if (/p_secure_token/.test(window)) return true;
  if (/Missing Supabase environment/.test(window)) return true;
  if (/SUPABASE_SERVICE_ROLE_KEY is required/.test(line)) return true;
  return false;
}

function scanFileForUnsafeLogs(absPath) {
  const rel = relative(root, absPath).replace(/\\/g, '/');
  const content = readFileSync(absPath, 'utf8');
  const lines = content.split('\n');
  const hits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!LOG_CALL_RE.test(line)) continue;
    LOG_CALL_RE.lastIndex = 0;

    const window = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 4)).join('\n');
    if (isAllowedContext(line, window, rel)) continue;

    let flagged = false;
    for (const pat of STRICT_LOG_PATTERNS) {
      if (pat.test(line)) {
        hits.push({ rel, line: i + 1, pattern: pat.source, snippet: line.trim().slice(0, 120) });
        flagged = true;
        break;
      }
    }
    if (flagged) continue;

    for (const pat of ENV_NAME_LOG_PATTERNS) {
      if (!pat.test(line)) continue;
      if (DIAGNOSTIC_MSG_RE.test(line)) continue;
      hits.push({ rel, line: i + 1, pattern: pat.source, snippet: line.trim().slice(0, 120) });
      break;
    }
  }

  return hits;
}

describe('no sensitive token/secret logging', () => {
  it('source files must not log secure tokens or auth secrets', () => {
    const files = collectFiles();
    const allHits = [];
    for (const f of files) {
      allHits.push(...scanFileForUnsafeLogs(f));
    }
    assert.equal(
      allHits.length,
      0,
      allHits.map((h) => `${h.rel}:${h.line} (${h.pattern}) ${h.snippet}`).join('\n'),
    );
  });
});
