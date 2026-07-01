'use strict';

/**
 * Phase 1 Preview smoke checks via `vercel curl` (handles deployment protection).
 * Usage: node scripts/_preview-rate-limit-smoke.cjs <preview-base-url>
 * Does not print secrets or bypass tokens.
 */

const { resolveProtectionBypass, vercelCurl } = require('./_vercel-curl-preview.cjs');

const cliArgs = process.argv.slice(2);
const overLimit = cliArgs.includes('--over-limit');
const base = (cliArgs.find((a) => !a.startsWith('--')) || '').replace(/\/$/, '');
if (!base) {
  console.error('Usage: node scripts/_preview-rate-limit-smoke.cjs <preview-base-url> [--over-limit]');
  process.exit(2);
}

const VALID_UUID = '00000000-0000-4000-8000-000000000001';
const INVALID_TOKEN = 'not-a-valid-token';

function row(name, pass, detail, opts = {}) {
  return {
    name,
    pass,
    detail,
    skipped: !!opts.skipped,
    parseUncertain: !!opts.parseUncertain,
    meta: opts.meta || null,
  };
}

function isParseUncertain(r) {
  return r.parseCategory === 'parse_uncertain' || (r.status == null && !r.functionInvocationFailed);
}

function uncertainMeta(r) {
  return {
    parseCategory: r.parseCategory,
    path: r.path,
    stdoutLength: r.stdoutLength,
    stderrLength: r.stderrLength,
    firstSafeLine: r.firstSafeLine,
    httpStatusesSeen: r.httpStatusesSeen,
    remediation:
      'Re-run with VERCEL_AUTOMATION_BYPASS_SECRET set; verify vercel curl --include output; use scripts/_preview-smoke-manual.cjs',
  };
}

function expectStatus(r, allowed, label) {
  if (isParseUncertain(r)) {
    return row(label, null, `PARSE_UNCERTAIN status=${r.status}`, {
      parseUncertain: true,
      meta: uncertainMeta(r),
    });
  }
  const ok = allowed.includes(r.status);
  return row(label, ok, `status=${r.status} error=${r.json?.error ?? 'null'}`, {
    meta: r.functionInvocationFailed ? { functionInvocationFailed: true } : null,
  });
}

const results = [];

async function main() {
  const ping = vercelCurl(base, '/api/clictopay-confirm-payment?orderId=bad');
  if (ping.blockedByCheckpoint) {
    console.log(
      JSON.stringify(
        {
          base,
          blocked: true,
          detail: 'Vercel Security Checkpoint blocked vercel curl',
          bypassConfigured: !!resolveProtectionBypass(),
          results: [],
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  // Required: invalid payment confirm
  {
    const r = vercelCurl(base, '/api/clictopay-confirm-payment?orderId=bad');
    if (isParseUncertain(r)) {
      results.push(
        row('Invalid payment confirm → 400 invalid_request', null, 'PARSE_UNCERTAIN', {
          parseUncertain: true,
          meta: uncertainMeta(r),
        })
      );
    } else {
      const ok =
        r.status === 400 &&
        r.json?.error === 'invalid_request' &&
        r.status !== 503 &&
        r.status !== 500 &&
        !r.functionInvocationFailed;
      results.push(
        row(
          'Invalid payment confirm → 400 invalid_request',
          ok,
          `status=${r.status} error=${r.json?.error}`
        )
      );
    }
  }

  // Required: invalid QR token
  {
    const r = vercelCurl(base, `/api/tickets/qr/${INVALID_TOKEN}`);
    if (isParseUncertain(r)) {
      results.push(
        row('QR invalid token → 400/404', null, 'PARSE_UNCERTAIN', {
          parseUncertain: true,
          meta: uncertainMeta(r),
        })
      );
    } else {
      const ok =
        (r.status === 400 || r.status === 404) &&
        r.status !== 500 &&
        !r.functionInvocationFailed;
      results.push(
        row('QR invalid token → 400/404', ok, `status=${r.status} error=${r.json?.error}`)
      );
    }
  }

  // Required: admin login fake credentials (valid JSON)
  {
    const r = vercelCurl(base, '/api/admin-login', {
      method: 'POST',
      body: {
        email: 'fake-smoke@example.com',
        password: 'wrong-password-smoke',
        recaptchaToken: 'localhost-bypass-token',
      },
    });
    if (isParseUncertain(r)) {
      results.push(
        row('Admin login fake credentials → 401/400', null, 'PARSE_UNCERTAIN', {
          parseUncertain: true,
          meta: uncertainMeta(r),
        })
      );
    } else {
      const ok =
        (r.status === 401 || r.status === 400) &&
        r.status !== 500 &&
        r.status !== 503 &&
        !r.functionInvocationFailed;
      results.push(
        row(
          'Admin login fake credentials → 401/400',
          ok,
          `status=${r.status} error=${r.json?.error}`
        )
      );
    }
  }

  if (overLimit) {
    // Required: admin login over-limit (run after safe checks; do not hammer before fake-credentials probe)
    {
      let last = null;
      for (let i = 0; i < 12; i++) {
        last = vercelCurl(base, '/api/admin-login', {
          method: 'POST',
          body: {
            email: `smoke-${i}@example.com`,
            password: 'wrong-password-smoke',
            recaptchaToken: 'localhost-bypass-token',
          },
        });
        if (last.status === 429) break;
      }
      if (isParseUncertain(last)) {
        results.push(
          row('Admin login over-limit → 429 rate_limited + Retry-After', null, 'PARSE_UNCERTAIN', {
            parseUncertain: true,
            meta: uncertainMeta(last),
          })
        );
      } else {
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
    }

    // Required: order create over-limit
    {
      let sawNon429BeforeLimit = false;
      let last = null;
      for (let i = 0; i < 12; i++) {
        last = vercelCurl(base, '/api/orders/create', {
          method: 'POST',
          body: { customerInfo: { email: `order-smoke-${i}@example.com` } },
        });
        if (last.status !== 429) sawNon429BeforeLimit = true;
        if (last.status === 429) break;
      }
      if (isParseUncertain(last)) {
        results.push(
          row('Order create over-limit → 429 before service-role insert', null, 'PARSE_UNCERTAIN', {
            parseUncertain: true,
            meta: uncertainMeta(last),
          })
        );
      } else {
        const ok =
          last.status === 429 &&
          last.json?.error === 'rate_limited' &&
          last.retryAfter != null &&
          sawNon429BeforeLimit;
        results.push(
          row(
            'Order create over-limit → 429 before service-role insert',
            ok,
            `lastStatus=${last.status} error=${last.json?.error} sawEarlierNon429=${sawNon429BeforeLimit} retryAfter=${last.retryAfter}`
          )
        );
      }
    }
  } else {
    results.push(
      row(
        'Over-limit probes (admin login, order create, QR valid)',
        null,
        'NOT EXECUTED — pass --over-limit (run safe checks first; avoid back-to-back over-limit with manual script)',
        { skipped: true }
      )
    );
  }

  // Optional / extended checks
  {
    const missing = vercelCurl(base, '/api/clictopay-confirm-payment');
    const invalid = vercelCurl(base, '/api/clictopay-confirm-payment?orderId=not-a-uuid');
    if (isParseUncertain(missing) || isParseUncertain(invalid)) {
      results.push(
        row('Payment confirm missing/invalid orderId → 400', null, 'PARSE_UNCERTAIN', {
          parseUncertain: true,
        })
      );
    } else {
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
  }

  {
    const oid = '11111111-1111-4111-8111-111111111111';
    const a = vercelCurl(base, `/api/clictopay-confirm-payment?orderId=${oid}`);
    const b = vercelCurl(base, `/api/clictopay-confirm-payment?orderId=${oid}`);
    const ok = !isParseUncertain(a) && !isParseUncertain(b) && a.status === b.status && a.status !== 500 && a.status !== 503;
    results.push(
      row(
        'Payment confirm repeat same orderId → stable status',
        isParseUncertain(a) || isParseUncertain(b) ? null : ok,
        `first=${a.status} second=${b.status}`,
        isParseUncertain(a) || isParseUncertain(b) ? { parseUncertain: true } : {}
      )
    );
  }

  if (overLimit) {
    let last = null;
    for (let i = 0; i < 65; i++) {
      last = vercelCurl(base, `/api/tickets/qr/${VALID_UUID}`);
      if (last.status === 429) break;
    }
    const uncertain = isParseUncertain(last);
    results.push(
      row(
        'QR valid token over-limit → 429',
        uncertain ? null : last.status === 429 && last.json?.error === 'rate_limited',
        uncertain ? 'PARSE_UNCERTAIN' : `lastStatus=${last.status} error=${last.json?.error}`,
        { parseUncertain: uncertain, skipped: false }
      )
    );
  }

  results.push(
    row(
      'Resend ticket 6th attempt same order → 429',
      null,
      'NOT FULLY EXECUTED — needs admin JWT + known order (manual)',
      { skipped: true }
    )
  );

  results.push(
    row(
      'Missing Upstash on Preview → 503',
      null,
      'NOT EXECUTED — requires temporarily removing Preview Upstash vars',
      { skipped: true }
    )
  );

  console.log(
    JSON.stringify(
      {
        base,
        bypassConfigured: !!resolveProtectionBypass(),
        results,
      },
      null,
      2
    )
  );

  const failed = results.filter((r) => r.pass === false);
  const uncertainRequired = results.filter(
    (r) => r.parseUncertain && !r.skipped && r.name.match(/→/)
  );
  process.exit(failed.length || uncertainRequired.length ? 1 : 0);
}

main().catch((e) => {
  console.error(String(e?.message || e));
  process.exit(1);
});
