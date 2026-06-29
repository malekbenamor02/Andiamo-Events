'use strict';

/**
 * Phase 1 Preview smoke checks via `vercel curl` (handles deployment protection).
 * Usage: node scripts/_preview-rate-limit-smoke.cjs <preview-base-url>
 * Does not print secrets or bypass tokens.
 */

const { spawnSync } = require('child_process');

const base = (process.argv[2] || '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: node scripts/_preview-rate-limit-smoke.cjs <preview-base-url>');
  process.exit(2);
}

const VALID_UUID = '00000000-0000-4000-8000-000000000001';
const INVALID_TOKEN = 'not-a-valid-token';

function vercelCurl(path, opts = {}) {
  const method = opts.method || 'GET';
  const args = [
    'vercel@latest',
    'curl',
    '--deployment',
    base,
    '--yes',
    '-X',
    method,
    '-w',
    '\n__HTTP_STATUS__:%{http_code}\n',
    '-s',
    '-D',
    '-',
  ];
  if (opts.body != null) {
    args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(opts.body));
  }
  args.push(path.startsWith('/') ? path : `/${path}`);

  const r = spawnSync('npx', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    shell: process.platform === 'win32',
  });
  if (r.error) throw r.error;
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const statusMatch = out.match(/__HTTP_STATUS__:(\d{3})/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;
  const headerBlock = out.split('\r\n\r\n')[0] || out.split('\n\n')[0] || '';
  const retryAfter = (headerBlock.match(/^retry-after:\s*(.+)$/im) || [])[1]?.trim() || null;
  const policy = (headerBlock.match(/^x-ratelimit-policy:\s*(.+)$/im) || [])[1]?.trim() || null;
  const bodyRaw = out.replace(/__HTTP_STATUS__:\d{3}\s*$/, '').split('\r\n\r\n').pop() || '';
  const jsonBody = bodyRaw.split('\n\n').pop()?.trim() || '';
  let json = null;
  try {
    const start = jsonBody.indexOf('{');
    json = start >= 0 ? JSON.parse(jsonBody.slice(start)) : null;
  } catch {
    json = { _raw: jsonBody.slice(0, 120) };
  }
  return { status, retryAfter, policy, json, exitCode: r.status };
}

function row(name, pass, detail, skipped = false) {
  return { name, pass, detail, skipped: !!skipped };
}

const results = [];

async function main() {
  // Sanity: deployment reachable (not 302/0)
  const ping = vercelCurl('/api/clictopay-confirm-payment');
  if (ping.status === 0 || ping.status === 302) {
    console.log(
      JSON.stringify(
        {
          base,
          blocked: true,
          detail: `Deployment not reachable via vercel curl (status=${ping.status})`,
          results: [],
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  // 1. Admin login over-limit
  {
    let last = null;
    for (let i = 0; i < 12; i++) {
      last = vercelCurl('/api/admin-login', {
        method: 'POST',
        body: {
          email: `smoke-${i}@example.com`,
          password: 'wrong-password-smoke',
          recaptchaToken: 'localhost-bypass-token',
        },
      });
      if (last.status === 429) break;
    }
    const ok =
      last.status === 429 &&
      last.json?.error === 'rate_limited' &&
      last.retryAfter != null;
    results.push(
      row(
        'Admin login over-limit → 429 rate_limited + Retry-After',
        ok,
        `lastStatus=${last.status} error=${last.json?.error} retryAfter=${last.retryAfter}`
      )
    );
  }

  // 2. Payment confirm missing/invalid orderId → 400
  {
    const missing = vercelCurl('/api/clictopay-confirm-payment');
    const invalid = vercelCurl('/api/clictopay-confirm-payment?orderId=not-a-uuid');
    const ok =
      missing.status === 400 &&
      invalid.status === 400 &&
      missing.json?.error === 'invalid_request' &&
      invalid.json?.error === 'invalid_request';
    results.push(
      row(
        'Payment confirm missing/invalid orderId → 400',
        ok,
        `missing=${missing.status} invalid=${invalid.status}`
      )
    );
  }

  // 3. Payment confirm repeat same orderId
  {
    const oid = '11111111-1111-4111-8111-111111111111';
    const a = vercelCurl(`/api/clictopay-confirm-payment?orderId=${oid}`);
    const b = vercelCurl(`/api/clictopay-confirm-payment?orderId=${oid}`);
    const ok = a.status === b.status && a.status !== 500 && a.status !== 503;
    results.push(
      row(
        'Payment confirm repeat same orderId → stable status',
        ok,
        `first=${a.status} second=${b.status} (paid-order idempotency needs known PAID order in staging DB)`
      )
    );
  }

  // 4. Order create over-limit
  {
    let sawNon429BeforeLimit = false;
    let last = null;
    for (let i = 0; i < 12; i++) {
      last = vercelCurl('/api/orders/create', {
        method: 'POST',
        body: { customerInfo: { email: `order-smoke-${i}@example.com` } },
      });
      if (last.status !== 429) sawNon429BeforeLimit = true;
      if (last.status === 429) break;
    }
    const ok =
      last.status === 429 &&
      last.json?.error === 'rate_limited' &&
      sawNon429BeforeLimit;
    results.push(
      row(
        'Order create over-limit → 429 before service-role insert',
        ok,
        `lastStatus=${last.status} error=${last.json?.error} sawEarlierNon429=${sawNon429BeforeLimit}`
      )
    );
  }

  // 5. QR invalid token → 400
  {
    const r = vercelCurl(`/api/tickets/qr/${INVALID_TOKEN}`);
    const ok = r.status === 400 && r.json?.error === 'Invalid token';
    results.push(row('QR invalid token → 400', ok, `status=${r.status} error=${r.json?.error}`));
  }

  // 6. QR valid token over-limit → 429 (IP bucket 60/min)
  {
    let last = null;
    for (let i = 0; i < 65; i++) {
      last = vercelCurl(`/api/tickets/qr/${VALID_UUID}`);
      if (last.status === 429) break;
    }
    const ok = last.status === 429 && last.json?.error === 'rate_limited';
    results.push(
      row(
        'QR valid token over-limit → 429',
        ok,
        `lastStatus=${last.status} error=${last.json?.error}`
      )
    );
  }

  // 7. Resend ticket — requires admin session (manual)
  {
    const r = vercelCurl('/api/admin-resend-ticket-email', {
      method: 'POST',
      body: { orderId: '22222222-2222-4222-8222-222222222222' },
    });
    const ok = r.status === 401 || r.status === 403;
    results.push(
      row(
        'Resend ticket 6th attempt same order → 429',
        null,
        `NOT FULLY EXECUTED — unauthenticated status=${r.status}; needs admin JWT + known order (manual)`,
        true
      )
    );
  }

  // 8. Missing Upstash — destructive to shared Preview env
  results.push(
    row(
      'Missing Upstash on Preview → 503',
      null,
      'NOT EXECUTED — requires temporarily removing Preview Upstash vars; unit tests cover fail-closed on Vercel',
      true
    )
  );

  console.log(JSON.stringify({ base, results }, null, 2));
  const failed = results.filter((r) => r.pass === false);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
