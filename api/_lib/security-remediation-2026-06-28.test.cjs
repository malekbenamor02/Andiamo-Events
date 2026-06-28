'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('ticket QR route security (phase 1)', () => {
  const src = read('api/_lib/ticket-qr-route.cjs');

  it('sets no-store cache and no-referrer on PNG responses', () => {
    assert.match(src, /Cache-Control['"],\s*['"]no-store, private['"]/);
    assert.match(src, /Referrer-Policy['"],\s*['"]no-referrer['"]/);
  });

  it('returns generic errors without token details', () => {
    assert.match(src, /Invalid token/);
    assert.match(src, /Not found/);
    assert.doesNotMatch(src, /console\.(log|error).*secure_token/);
  });

  it('includes rate limiting helper', () => {
    assert.match(src, /checkRateLimit/);
    assert.match(src, /429/);
  });
});

describe('legacy validate-ticket removal', () => {
  it('server.cjs does not register unauthenticated POST /api/validate-ticket', () => {
    const src = read('server.cjs');
    assert.doesNotMatch(src, /app\.post\s*\(\s*['"]\/api\/validate-ticket['"]/);
  });

  it('vercel.json does not rewrite /api/validate-ticket', () => {
    const vercel = read('vercel.json');
    assert.doesNotMatch(vercel, /\/api\/validate-ticket/);
  });

  it('api-routes.ts does not export legacy VALIDATE_TICKET constant', () => {
    const routes = read('src/lib/api-routes.ts');
    assert.doesNotMatch(routes, /VALIDATE_TICKET:\s*['"]\/api\/validate-ticket['"]/);
  });
});

describe('admin payment options read path', () => {
  it('PaymentOptionsManager uses fetchAllPaymentOptions from paymentService', () => {
    const mgr = read('src/components/admin/PaymentOptionsManager.tsx');
    assert.match(mgr, /fetchAllPaymentOptions/);
  });

  it('paymentService admin fetch uses ADMIN_PAYMENT_OPTIONS API', () => {
    const ps = read('src/lib/orders/paymentService.ts');
    assert.match(ps, /API_ROUTES\.ADMIN_PAYMENT_OPTIONS/);
    assert.match(ps, /apiFetch/);
    assert.doesNotMatch(ps, /fetchAllPaymentOptions[\s\S]*supabase\.from\(['"]payment_options['"]\)/);
  });

  it('admin GET handler requires settings:manage before DB', () => {
    const missing = read('api/_lib/admin-missing-routes-http.js');
    const block = missing.slice(
      missing.indexOf('async function handleAdminPaymentOptionsGet'),
      missing.indexOf('async function handleAdminPaymentOptionsPut'),
    );
    const gateIdx = block.indexOf("gateAdminPermission(req, res, 'settings:manage')");
    const dbIdx = block.indexOf('await createAdminDbClient');
    assert.ok(gateIdx >= 0 && dbIdx > gateIdx);
  });
});

describe('frontend route guards', () => {
  it('ScannerApp wraps protected routes with ProtectedScannerRoute', () => {
    const app = read('src/pages/scanner/ScannerApp.tsx');
    assert.match(app, /ProtectedScannerRoute/);
    assert.match(app, /path="\/login"/);
    assert.match(app, /path="\/\*"/);
  });

  it('App.tsx wraps influencer dashboard with ProtectedInfluencerRoute', () => {
    const app = read('src/App.tsx');
    assert.match(app, /ProtectedInfluencerRoute/);
    assert.match(app, /\/influencer\/dashboard/);
  });

  it('Careers.tsx sanitizes CMS HTML before dangerouslySetInnerHTML', () => {
    const careers = read('src/pages/Careers.tsx');
    assert.match(careers, /sanitizeCmsHtml/);
    assert.doesNotMatch(
      careers,
      /dangerouslySetInnerHTML=\{\{\s*__html:\s*\(domain as \{ benefits/,
    );
  });
});

describe('payment_options RLS migration', () => {
  it('migration tightens anon SELECT to enabled rows only', () => {
    const sql = read('supabase/migrations/20260628180000_tighten_payment_options_rls.sql');
    assert.match(sql, /DROP POLICY IF EXISTS "Public can view payment options"/);
    assert.match(sql, /DROP POLICY IF EXISTS "payment_options_anon_select_enabled"/);
    assert.match(sql, /payment_options_anon_select_enabled/);
    assert.match(sql, /enabled = true/);
  });
});

describe('EmailCampaignPreview HTML sanitization', () => {
  it('uses sanitizeCmsHtml before dangerouslySetInnerHTML', () => {
    const src = read('src/components/admin/marketing/EmailCampaignPreview.tsx');
    assert.match(src, /import \{ sanitizeCmsHtml \} from '@\/lib\/sanitizeHtml'/);
    assert.match(src, /sanitizeCmsHtml\(body\.replace/);
    assert.doesNotMatch(src, /dangerouslySetInnerHTML=\{\{\s*__html:\s*body/);
  });
});
