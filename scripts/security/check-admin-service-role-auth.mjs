#!/usr/bin/env node
/**
 * Static + optional HTTP checks: admin routes must not use anon/fallback DB clients,
 * and service-role usage must follow admin auth in source order where detectable.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

const ADMIN_PATH_MARKERS = [
  '/api/admin',
  '/api/admin-',
  'verifyAdminAuth',
  'requireAdminAuth',
  'requireSuperAdmin',
  'handlePresaleAdminCodes',
  'handleEventPromoAdminCodes',
  'handleAdminLogs',
  'registerAdminAdminsRoutes',
    'registerAdminOrdersRoutes',
    'requireServiceRoleDb',
    'getServiceRoleDbOrThrow',
  ];

const FORBIDDEN_IN_ADMIN = [
  { re: /supabaseService\s*\|\|\s*supabase/g, label: 'supabaseService || supabase' },
  { re: /supabase\s*\|\|\s*supabaseService/g, label: 'supabase || supabaseService' },
  {
    re: /SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*process\.env\.SUPABASE_ANON_KEY/g,
    label: 'SERVICE_ROLE_KEY || ANON_KEY fallback',
  },
  {
    re: /process\.env\.SUPABASE_ANON_KEY\s*\|\|\s*process\.env\.SUPABASE_SERVICE_ROLE_KEY/g,
    label: 'ANON_KEY || SERVICE_ROLE_KEY fallback',
  },
];

const SCAN_DIRS = ['api', 'careerRoutes.cjs'];

function walkFiles(base, acc = []) {
  if (!existsSync(base)) return acc;
  const st = statSync(base);
  if (st.isFile()) {
    if (/\.(js|cjs|mjs|ts)$/.test(base) && !/\.test\.(cjs|js|mjs)$/.test(base)) acc.push(base);
    return acc;
  }
  for (const name of readdirSync(base)) {
    if (name === 'node_modules' || name === '.git') continue;
    walkFiles(join(base, name), acc);
  }
  return acc;
}

function isLikelyAdminContext(content, index) {
  const windowStart = Math.max(0, index - 4000);
  const windowEnd = Math.min(content.length, index + 2000);
  const slice = content.slice(windowStart, windowEnd);
  if (slice.includes('requireServiceRoleDb') || slice.includes('getServiceRoleDbOrThrow')) return true;
  return ADMIN_PATH_MARKERS.some((m) => slice.includes(m));
}

function isPublicException(rel, content, index) {
  const windowStart = Math.max(0, index - 1500);
  const slice = content.slice(windowStart, index + 500);
  const publicMarkers = [
    'clictopay-confirm-payment',
    'aio-events/save-submission',
    'phone-subscribe',
    'sitemap',
    '/api/careers/',
    'ambassador-login',
    'ambassador-application',
    'public-event',
    'handlePublicEvent',
    'careerRoutes.cjs',
  ];
  if (publicMarkers.some((m) => slice.includes(m))) return true;
  // Career Express bootstrap: anon client for public career pages only
  if (rel.endsWith('api/misc.js') && slice.includes('getCareerApp')) return true;
  if (rel.endsWith('careerRoutes.cjs') && slice.includes("app.get('/api/careers/")) return true;
  return false;
}

function scanFile(absPath) {
  const rel = relative(root, absPath).replace(/\\/g, '/');
  const content = readFileSync(absPath, 'utf8');
  const findings = [];

  for (const { re, label } of FORBIDDEN_IN_ADMIN) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      if (!isLikelyAdminContext(content, m.index)) continue;
      if (isPublicException(rel, content, m.index)) continue;
      const line = content.slice(0, m.index).split('\n').length;
      findings.push({ rel, line, label, snippet: m[0] });
    }
  }

  // createClient(...ANON...) inside admin handlers
  const anonClientRe = /createClient\s*\(\s*[^)]*SUPABASE_ANON_KEY/g;
  let m;
  while ((m = anonClientRe.exec(content)) !== null) {
    if (!isLikelyAdminContext(content, m.index)) continue;
    if (isPublicException(rel, content, m.index)) continue;
    const line = content.slice(0, m.index).split('\n').length;
    findings.push({ rel, line, label: 'createClient with SUPABASE_ANON_KEY', snippet: 'createClient(...ANON...)' });
  }

  // Auth-before-DB heuristic for createAdminDbClient at call sites (not helper definitions)
  const dbClientCallRe = /(?<!async function makeDb\s*\([^)]*\)\s*\{\s*return )createAdminDbClient\s*\(/g;
  while ((m = dbClientCallRe.exec(content)) !== null) {
    if (!isLikelyAdminContext(content, m.index)) continue;
    if (isPublicException(rel, content, m.index)) continue;
    const before = content.slice(Math.max(0, m.index - 8000), m.index);
    const hasAuth =
      /verifyAdminAuth\s*\(/.test(before) ||
      /gateAdminPermission\s*\(/.test(before) ||
      /authorizeCronOrAdminPermission\s*\(/.test(before) ||
      /requireAdmin\s*\(/.test(before) ||
      /verifySuperAdmin\s*\(/.test(before) ||
      /requireAdminAuth/.test(before) ||
      /requireSuperAdmin/.test(before) ||
      /hasPermission\s*\(auth/.test(before) ||
      /if\s*\(\s*!auth\.valid\s*\)/.test(before) ||
      /if\s*\(\s*!authResult\.valid\s*\)/.test(before);
    if (!hasAuth) {
      const line = content.slice(0, m.index).split('\n').length;
      findings.push({
        rel,
        line,
        label: 'createAdminDbClient without preceding auth check (heuristic)',
        snippet: 'createAdminDbClient(',
      });
    }
  }

  return findings;
}

function collectFiles() {
  const files = new Set();
  for (const entry of SCAN_DIRS) {
    const abs = join(root, entry);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isFile()) files.add(abs);
    else walkFiles(abs).forEach((f) => files.add(f));
  }
  if (existsSync(join(root, 'server.cjs'))) files.add(join(root, 'server.cjs'));
  return [...files];
}

async function httpProbe(baseUrl) {
  const routes = [
    { method: 'GET', path: '/api/admin/orders' },
    { method: 'GET', path: '/api/admin/logs' },
    { method: 'GET', path: '/api/admin/careers/applications' },
    { method: 'POST', path: '/api/admin/approve-order', body: { orderId: '00000000-0000-4000-8000-000000000001' } },
    { method: 'GET', path: '/api/admin/presale/codes?eventId=00000000-0000-4000-8000-000000000001' },
    { method: 'GET', path: '/api/admin/admins' },
    { method: 'GET', path: '/api/admin/order-qr-tickets?orderId=00000000-0000-4000-8000-000000000001' },
    { method: 'GET', path: '/api/admin/official-invitations' },
    { method: 'POST', path: '/api/admin/bulk-sms/send', body: { phoneNumbers: [], message: 'probe' } },
  ];
  const failures = [];
  for (const r of routes) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}${r.path}`, {
        method: r.method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: r.body ? JSON.stringify(r.body) : undefined,
      });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* ignore */
      }
      if (res.status !== 401 && res.status !== 403) {
        failures.push(`${r.method} ${r.path} → ${res.status} (expected 401/403)`);
      }
      if (json && (Array.isArray(json.data) || Array.isArray(json.orders) || Array.isArray(json.logs))) {
        failures.push(`${r.method} ${r.path} returned data array without auth`);
      }
    } catch (e) {
      failures.push(`${r.method} ${r.path} probe error: ${e.message}`);
    }
  }
  return failures;
}

async function main() {
  const files = collectFiles();
  const allFindings = [];
  for (const f of files) {
    allFindings.push(...scanFile(f));
  }

  const apiFindings = allFindings.filter((f) => !f.rel.startsWith('server.cjs'));
  const serverFindings = allFindings.filter((f) => f.rel.startsWith('server.cjs'));

  console.log('=== Admin service-role auth static scan (api/) ===');
  if (apiFindings.length === 0) {
    console.log('OK: no forbidden admin DB patterns in api/.');
  } else {
    console.log(`FAIL: ${apiFindings.length} finding(s):`);
    for (const f of apiFindings) {
      console.log(`  ${f.rel}:${f.line} — ${f.label}`);
    }
  }

  if (serverFindings.length) {
    console.log(`\nFAIL: ${serverFindings.length} finding(s) in server.cjs (local dev must match api/):`);
    for (const f of serverFindings) {
      console.log(`  ${f.rel}:${f.line} — ${f.label}`);
    }
  } else {
    console.log('\nOK: server.cjs has no forbidden admin DB patterns.');
  }

  const baseUrl = process.env.ADMIN_AUTH_PROBE_BASE_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`);
  if (baseUrl) {
    console.log('\n=== HTTP unauthenticated admin probe ===');
    const httpFails = await httpProbe(baseUrl);
    if (httpFails.length === 0) {
      console.log(`OK: unauthenticated probes against ${baseUrl} returned 401/403.`);
    } else {
      console.log('FAIL:');
      httpFails.forEach((x) => console.log(`  ${x}`));
    }
    if (httpFails.length) process.exit(1);
  } else {
    console.log('\n(skip HTTP probe: set ADMIN_AUTH_PROBE_BASE_URL to run live 401 checks)');
  }

  if (apiFindings.length) process.exit(1);
  if (serverFindings.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
