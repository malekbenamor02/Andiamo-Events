#!/usr/bin/env node
/**
 * Static scan: public / privileged non-admin routes must not use select('*') on sensitive tables.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../..');

const PUBLIC_ROUTE_FILES = [
  'api/_lib/public-event-by-slug.js',
  'api/scan.js',
  'api/pos.js',
  'api/clictopay-generate-payment.js',
  'api/_lib/scanner-db.cjs',
];

const MISC_PUBLIC_ROUTE_PATHS = [
  '/api/clictopay-confirm-payment',
  '/api/aio-events/save-submission',
  '/api/ambassador-application',
  '/api/phone-subscribe',
];

const SENSITIVE_TABLES = [
  'orders',
  'admins',
  'ambassadors',
  'presale_codes',
  'event_promo_codes',
  'admin_logs',
  'qr_tickets',
  'order_passes',
  'tickets',
  'ambassador_applications',
  'phone_subscribers',
  'email_subscribers',
  'marketing_campaigns',
  'marketing_campaign_recipients',
  'career_applications',
  'pos_sessions',
  'pos_audit_log',
];

const SELECT_STAR_ON_TABLE = SENSITIVE_TABLES.map(
  (t) => new RegExp(`\\.from\\(['"]${t}['"]\\)[\\s\\S]{0,120}?\\.select\\(\\s*['"]\\*['"]`, 'g'),
);

function scanContent(rel, content) {
  const findings = [];
  for (const re of SELECT_STAR_ON_TABLE) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const line = content.slice(0, m.index).split('\n').length;
      const table = m[0].match(/from\(['"]([^'"]+)['"]\)/)?.[1] || 'unknown';
      findings.push({ rel, line, table, label: `select('*') on sensitive table ${table}` });
    }
  }
  return findings;
}

function extractMiscRouteBlock(content, routePath) {
  const needles = [
    `if (path === '${routePath}'`,
    `if ((path === '${routePath}'`,
    `path?.startsWith('${routePath}')`,
  ];
  let start = -1;
  for (const needle of needles) {
    const idx = content.indexOf(needle);
    if (idx >= 0 && (start < 0 || idx < start)) start = idx;
  }
  if (start < 0) return '';
  const rest = content.slice(start);
  const next = rest.search(/\n    \/\/ ={10,}\n    \/\/ /);
  const nextIf = rest.search(/\n    if \(path === '/);
  const end = [next, nextIf].filter((n) => n > 0).sort((a, b) => a - b)[0];
  return end > 0 ? rest.slice(0, end) : rest.slice(0, 12000);
}

function scanCareerPublicRoutes() {
  const rel = 'careerRoutes.cjs';
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  const content = readFileSync(abs, 'utf8');
  const adminSplit = content.indexOf("app.get('/api/admin/careers/settings'");
  const publicContent = adminSplit > 0 ? content.slice(0, adminSplit) : content;
  return scanContent(rel, publicContent);
}

function scanMiscPublicRoutes() {
  const rel = 'api/misc.js';
  const abs = join(root, rel);
  if (!existsSync(abs)) return [];
  const content = readFileSync(abs, 'utf8');
  const findings = [];
  for (const routePath of MISC_PUBLIC_ROUTE_PATHS) {
    const block = extractMiscRouteBlock(content, routePath);
    if (!block) continue;
    for (const f of scanContent(rel, block)) {
      findings.push({ ...f, rel: `${rel} (${routePath})` });
    }
  }
  return findings;
}

function main() {
  const allFindings = [];

  for (const rel of PUBLIC_ROUTE_FILES) {
    const abs = join(root, rel);
    if (!existsSync(abs)) continue;
    allFindings.push(...scanContent(rel, readFileSync(abs, 'utf8')));
  }

  allFindings.push(...scanCareerPublicRoutes());
  allFindings.push(...scanMiscPublicRoutes());

  console.log('=== Public service-role route select(*) scan ===');
  if (allFindings.length === 0) {
    console.log('OK: no select(*) on sensitive tables in scanned public routes.');
    return;
  }

  console.log(`FAIL: ${allFindings.length} finding(s):`);
  for (const f of allFindings) {
    console.log(`  ${f.rel}:${f.line} — ${f.label}`);
  }
  process.exit(1);
}

main();
