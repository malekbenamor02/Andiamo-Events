'use strict';

/**
 * Manual Preview probe table — safe single-shot checks by default.
 * Usage:
 *   node scripts/_preview-smoke-manual.cjs <preview-base-url>
 *   node scripts/_preview-smoke-manual.cjs <preview-base-url> --over-limit
 */

const { resolveProtectionBypass, vercelCurl } = require('./_vercel-curl-preview.cjs');

const args = process.argv.slice(2);
const overLimit = args.includes('--over-limit');
const base = (args.find((a) => !a.startsWith('--')) || '').replace(/\/$/, '');

if (!base) {
  console.error('Usage: node scripts/_preview-smoke-manual.cjs <preview-base-url> [--over-limit]');
  process.exit(2);
}

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

function summarize(r) {
  if (r.parseCategory === 'parse_uncertain' || r.status == null) {
    return 'PARSE_UNCERTAIN';
  }
  const bits = [`${r.status}`];
  if (r.json?.error) bits.push(String(r.json.error));
  if (r.retryAfter) bits.push(`Retry-After=${r.retryAfter}`);
  if (r.functionInvocationFailed) bits.push('FUNCTION_INVOCATION_FAILED');
  return bits.join(' ');
}

function check(name, pass, r, note = '') {
  return { name, pass, result: summarize(r), note, parseUncertain: r.parseCategory === 'parse_uncertain' };
}

function printTable(rows) {
  const wName = Math.max(4, ...rows.map((r) => r.name.length));
  const wPass = 5;
  const wResult = Math.max(6, ...rows.map((r) => r.result.length));
  console.log(`${'Check'.padEnd(wName)}  ${'PASS'.padEnd(wPass)}  ${'Result'.padEnd(wResult)}  Note`);
  console.log(`${'-'.repeat(wName)}  ${'-'.repeat(wPass)}  ${'-'.repeat(wResult)}  ${'-'.repeat(20)}`);
  for (const r of rows) {
    const passCol =
      r.parseUncertain ? 'UNCERT' : r.pass === null ? 'SKIP' : r.pass ? 'yes' : 'NO';
    console.log(
      `${r.name.padEnd(wName)}  ${passCol.padEnd(wPass)}  ${r.result.padEnd(wResult)}  ${r.note || ''}`
    );
  }
}

const rows = [];

// 1. Invalid payment confirm
{
  const r = vercelCurl(base, '/api/clictopay-confirm-payment?orderId=bad');
  const uncertain = r.parseCategory === 'parse_uncertain' || r.status == null;
  rows.push(
    check(
      'Invalid payment confirm',
      uncertain
        ? null
        : r.status === 400 &&
            r.json?.error === 'invalid_request' &&
            r.status !== 503 &&
            r.status !== 500,
      r,
      uncertain ? 'parser could not read HTTP status' : 'expect 400 invalid_request'
    )
  );
}

// 2. Invalid QR token
{
  const r = vercelCurl(base, '/api/tickets/qr/badtoken');
  const uncertain = r.parseCategory === 'parse_uncertain' || r.status == null;
  rows.push(
    check(
      'Invalid QR token',
      uncertain
        ? null
        : (r.status === 400 || r.status === 404) &&
            r.status !== 500 &&
            !r.functionInvocationFailed,
      r,
      uncertain ? 'parser uncertain' : 'expect 400/404, not 500'
    )
  );
}

// 3. Admin login malformed JSON
{
  const r = vercelCurl(base, '/api/admin-login', {
    method: 'POST',
    rawBody: '{not-valid-json',
  });
  const uncertain = r.parseCategory === 'parse_uncertain' || r.status == null;
  rows.push(
    check(
      'Admin login malformed JSON',
      uncertain ? null : r.status === 400 && r.json?.error === 'Invalid JSON',
      r,
      'deliberately malformed body; expect 400 Invalid JSON'
    )
  );
}

// 4. Admin login invalid credentials (valid JSON)
{
  const r = vercelCurl(base, '/api/admin-login', {
    method: 'POST',
    body: {
      email: 'fake-smoke@example.com',
      password: 'wrong-password-smoke',
      recaptchaToken: 'localhost-bypass-token',
    },
  });
  const uncertain = r.parseCategory === 'parse_uncertain' || r.status == null;
  rows.push(
    check(
      'Admin login fake credentials',
      uncertain
        ? null
        : (r.status === 401 || r.status === 400) && r.status !== 500 && r.status !== 503,
      r,
      uncertain ? 'parser uncertain' : 'expect 401 Invalid credentials or safe 400'
    )
  );
}

if (overLimit) {
  {
    let last = null;
    for (let i = 0; i < 12; i++) {
      last = vercelCurl(base, '/api/admin-login', {
        method: 'POST',
        body: {
          email: `rl-manual-${i}@example.com`,
          password: 'wrong-password',
          recaptchaToken: 'localhost-bypass-token',
        },
      });
      if (last.status === 429) break;
    }
    const uncertain = last.parseCategory === 'parse_uncertain' || last.status == null;
    rows.push(
      check(
        'Admin login over-limit',
        uncertain
          ? null
          : last.status === 429 && last.json?.error === 'rate_limited' && last.retryAfter != null,
        last,
        '--over-limit'
      )
    );
  }

  {
    let last = null;
    let sawOther = false;
    for (let i = 0; i < 12; i++) {
      last = vercelCurl(base, '/api/orders/create', {
        method: 'POST',
        body: { customerInfo: { email: `oc-manual-${i}@example.com` } },
      });
      if (last.status !== 429) sawOther = true;
      if (last.status === 429) break;
    }
    const uncertain = last.parseCategory === 'parse_uncertain' || last.status == null;
    rows.push(
      check(
        'Order create over-limit',
        uncertain
          ? null
          : last.status === 429 && last.json?.error === 'rate_limited' && last.retryAfter != null && sawOther,
        last,
        '--over-limit'
      )
    );
  }

  {
    let last = null;
    for (let i = 0; i < 65; i++) {
      last = vercelCurl(base, `/api/tickets/qr/${VALID_UUID}`);
      if (last.status === 429) break;
    }
    const uncertain = last.parseCategory === 'parse_uncertain' || last.status == null;
    rows.push(
      check(
        'QR valid over-limit',
        uncertain ? null : last.status === 429 && last.json?.error === 'rate_limited',
        last,
        'optional --over-limit'
      )
    );
  }
} else {
  rows.push({
    name: 'Over-limit probes',
    pass: null,
    result: 'skipped',
    note: 'pass --over-limit to run rate-limit loops',
    parseUncertain: false,
  });
}

console.log(`Preview: ${base}`);
console.log(`Bypass configured: ${resolveProtectionBypass() ? 'yes' : 'no'}`);
console.log('');
printTable(rows);

const failed = rows.filter((r) => r.pass === false);
const uncertain = rows.filter((r) => r.parseUncertain);
process.exit(failed.length || uncertain.length ? 1 : 0);
