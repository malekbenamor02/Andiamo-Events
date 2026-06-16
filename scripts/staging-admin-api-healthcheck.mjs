#!/usr/bin/env node
/**
 * Staging admin API route health check.
 * Unauthenticated: expect 401/403 (route exists), not 404/500.
 *
 * Usage:
 *   node scripts/staging-admin-api-healthcheck.mjs https://staging.andiamoevents.com
 *   ADMIN_COOKIE="adminToken=..." node scripts/staging-admin-api-healthcheck.mjs https://staging.andiamoevents.com
 */

const baseUrl = (process.argv[2] || process.env.BASE_URL || '').replace(/\/$/, '');
const adminCookie = process.env.ADMIN_COOKIE || '';

if (!baseUrl) {
  console.error('Usage: node scripts/staging-admin-api-healthcheck.mjs <base-url>');
  process.exit(1);
}

/** @type {{ method: string; path: string; note?: string }[]} */
const ROUTES = [
  { method: 'GET', path: '/api/verify-admin' },
  { method: 'POST', path: '/api/admin/audit-log', note: 'POST body omitted — auth check only' },
  { method: 'GET', path: '/api/admin/audit-logs' },
  { method: 'GET', path: '/api/admin/admins' },
  { method: 'GET', path: '/api/admin/sponsors' },
  { method: 'GET', path: '/api/admin/team-members' },
  { method: 'GET', path: '/api/admin/orders/online' },
  { method: 'GET', path: '/api/admin/orders/chart' },
  { method: 'GET', path: '/api/admin/orders/pos-overview' },
  { method: 'GET', path: '/api/admin/analytics/orders' },
  { method: 'GET', path: '/api/admin/order-logs' },
  { method: 'GET', path: '/api/admin/passes/test-event-id' },
  { method: 'GET', path: '/api/admin/order-expiration-settings' },
  { method: 'GET', path: '/api/admin/logs' },
  { method: 'GET', path: '/api/admin/csp-reports' },
  { method: 'GET', path: '/api/admin/academy/settings' },
  { method: 'GET', path: '/api/admin/academy/registrations' },
  { method: 'GET', path: '/api/admin/academy/reports' },
  { method: 'GET', path: '/api/admin/academy/promo-codes' },
  { method: 'GET', path: '/api/admin/ambassador-sales/orders' },
];

function classifyStatus(status, authenticated) {
  if (status === 404) return { result: 'FAIL', reason: '404 — route not registered' };
  if (status >= 500) return { result: 'FAIL', reason: `${status} — server error` };
  if (status === 401 || status === 403) return { result: 'PASS', reason: 'auth gate (route exists)' };
  if (status === 200 || status === 201) {
    return authenticated
      ? { result: 'PASS', reason: 'OK (authenticated)' }
      : { result: 'WARN', reason: '200 without cookie — may be public' };
  }
  if (status === 400 || status === 405) return { result: 'PASS', reason: 'route reached' };
  return { result: 'WARN', reason: `HTTP ${status}` };
}

async function probeRoute({ method, path, note }) {
  const url = `${baseUrl}${path}`;
  const headers = {};
  if (adminCookie) headers.Cookie = adminCookie;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      redirect: 'manual',
    });
  } catch (err) {
    return {
      method,
      path,
      status: 'ERR',
      result: 'FAIL',
      reason: err instanceof Error ? err.message : String(err),
      note,
    };
  }

  const { result, reason } = classifyStatus(res.status, !!adminCookie);
  return {
    method,
    path,
    status: res.status,
    result,
    reason,
    note,
  };
}

async function main() {
  console.log(`\nAdmin API healthcheck — ${baseUrl}`);
  console.log(`Auth cookie: ${adminCookie ? 'yes' : 'no (unauthenticated probes)'}\n`);

  const rows = [];
  for (const route of ROUTES) {
    const row = await probeRoute(route);
    rows.push(row);
  }

  const col = (s, w) => String(s).padEnd(w);
  console.log(
    `${col('Result', 6)} ${col('Status', 8)} ${col('Method', 8)} Path`
  );
  console.log('-'.repeat(80));

  let fail = 0;
  let pass = 0;
  for (const r of rows) {
    if (r.result === 'FAIL') fail += 1;
    else if (r.result === 'PASS') pass += 1;
    console.log(`${col(r.result, 6)} ${col(r.status, 8)} ${col(r.method, 8)} ${r.path}${r.note ? ` (${r.note})` : ''}`);
    if (r.result === 'FAIL') console.log(`       └─ ${r.reason}`);
  }

  console.log('\nSummary:', { pass, fail, warn: rows.length - pass - fail, total: rows.length });
  process.exit(fail > 0 ? 1 : 0);
}

main();
