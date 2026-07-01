'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('ambassador application email — permission routing', () => {
  const misc = read('api/misc.js');
  const dashboard = read('src/pages/admin/Dashboard.tsx');
  const handler = read('api/_lib/ambassador-application-email-http.js');
  const approvalCjs = read('api/_lib/ambassador-application-approval-email.cjs');

  it('new resend route is gated by applications:manage', () => {
    const block = misc.slice(
      misc.indexOf("path === '/api/admin-ambassador-application-resend-email'"),
      misc.indexOf("path === '/api/ambassador-login'")
    );
    assert.match(block, /handleAmbassadorApplicationResendEmail/);
    assert.match(handler, /gateAdminPermission\(req, res, 'applications:manage'\)/);
  });

  it('/api/send-email remains gated by marketing:manage', () => {
    const block = misc.slice(
      misc.indexOf("path === '/api/send-email'"),
      misc.indexOf('// Admin Events CRUD')
    );
    assert.match(block, /gateAdminPermission\(req, res, 'marketing:manage'\)/);
  });

  it('admin-update-application sends approval email server-side on approve', () => {
    const block = misc.slice(
      misc.indexOf("path === '/api/admin-update-application'"),
      misc.indexOf("path === '/api/admin-ambassador-application-resend-email'")
    );
    assert.match(block, /sendAmbassadorApplicationApprovalEmail/);
    assert.match(block, /approvalEmailSent/);
    assert.match(block, /hasEffectivePermission\(authResult\.permissions.*applications:manage/);
  });

  it('admin-update-application sends rejection email server-side on reject', () => {
    const block = misc.slice(
      misc.indexOf("path === '/api/admin-update-application'"),
      misc.indexOf("path === '/api/admin-ambassador-application-resend-email'")
    );
    assert.match(block, /sendAmbassadorApplicationRejectionEmail/);
    assert.match(block, /rejectionEmailSent/);
    assert.match(block, /rejectionEmailError/);
    assert.match(block, /FORBIDDEN_CLIENT_EMAIL_FIELDS/);
  });

  it('resend handler rejects arbitrary email fields from client', () => {
    assert.match(handler, /FORBIDDEN_CLIENT_EMAIL_FIELDS/);
    assert.match(handler, /to.*subject.*html/);
    assert.doesNotMatch(handler, /bodyData\.html/);
  });

  it('approval email builder escapes HTML', () => {
    const { buildAmbassadorApprovalEmailHtml } = require('./ambassador-approval-email-html.cjs');
    const html = buildAmbassadorApprovalEmailHtml({
      fullName: '<script>alert(1)</script>',
      phone: '20000000',
      password: 'pass&word',
      loginUrl: 'https://www.andiamoevents.com/ambassador/auth',
    });
    assert.doesNotMatch(html, /<script>alert/);
    assert.match(html, /pass&amp;word/);
  });

  it('rejection email builder escapes HTML', () => {
    const { buildAmbassadorRejectionEmailHtml } = require('./ambassador-rejection-email-html.cjs');
    const html = buildAmbassadorRejectionEmailHtml({
      fullName: '<img onerror=alert(1)>',
      rejectionNote: 'Reason: <b>bad</b> & "late"',
    });
    assert.doesNotMatch(html, /<img onerror/);
    assert.match(html, /Reason: &lt;b&gt;bad&lt;\/b&gt; &amp; &quot;late&quot;/);
  });

  it('send helper requires approved application status', () => {
    assert.match(approvalCjs, /application\.status !== 'approved'/);
    assert.match(approvalCjs, /statusCode = 409/);
  });

  it('rejection send helper requires rejected application status', () => {
    assert.match(approvalCjs, /application\.status !== 'rejected'/);
    assert.match(approvalCjs, /sendAmbassadorApplicationRejectionEmail/);
  });
});

describe('Dashboard — no application workflow via /api/send-email', () => {
  const dashboard = read('src/pages/admin/Dashboard.tsx');

  it('does not call createApprovalEmail', () => {
    assert.doesNotMatch(dashboard, /createApprovalEmail/);
  });

  it('does not call createRejectionEmail', () => {
    assert.doesNotMatch(dashboard, /createRejectionEmail/);
  });

  it('handleReject does not call sendEmail or sendEmailWithDetails', () => {
    const rejectBlock = dashboard.slice(
      dashboard.indexOf('const handleReject = async'),
      dashboard.indexOf('const handleSaveEvent = async')
    );
    assert.doesNotMatch(rejectBlock, /sendEmailWithDetails/);
    assert.doesNotMatch(rejectBlock, /sendEmail\(/);
    assert.doesNotMatch(rejectBlock, /API_ROUTES\.SEND_EMAIL/);
    assert.match(rejectBlock, /rejectionEmailSent/);
  });

  it('resend uses adminApi.resendAmbassadorApplicationApprovalEmail', () => {
    assert.match(dashboard, /resendAmbassadorApplicationApprovalEmail/);
  });

  it('handleApprove uses approvalEmailSent from updateApplication response', () => {
    assert.match(dashboard, /approvalEmailSent/);
    assert.doesNotMatch(
      dashboard,
      /handleApprove[\s\S]{0,2500}sendEmail\(/
    );
  });

  it('toast strings avoid mojibake error prefix', () => {
    assert.doesNotMatch(dashboard, /âŒ Email Failed to Send/);
    assert.match(dashboard, /Email failed to send/);
  });
});

describe('Remaining sendEmailWithDetails — classification', () => {
  const dashboard = read('src/pages/admin/Dashboard.tsx');

  it('sendEmailWithDetails is only used in handleAddAdmin (admin credentials)', () => {
    const matches = [...dashboard.matchAll(/sendEmailWithDetails/g)];
    assert.equal(matches.length, 2, 'import + single call site expected');
    const addAdminBlock = dashboard.slice(
      dashboard.indexOf('const handleAddAdmin = async'),
      dashboard.indexOf('const handleEditAdmin = async')
    );
    assert.match(addAdminBlock, /sendEmailWithDetails/);
    assert.match(addAdminBlock, /createAdminCredentialsEmail/);
    assert.doesNotMatch(addAdminBlock, /createApprovalEmail|createRejectionEmail/);
  });

  it('application workflows do not call sendEmailWithDetails', () => {
    for (const fn of ['handleApprove', 'handleReject', 'resendEmail']) {
      const start = dashboard.indexOf(`const ${fn} = async`);
      assert.ok(start >= 0, `missing ${fn}`);
      const end = dashboard.indexOf('\n  const ', start + 1);
      const block = dashboard.slice(start, end > start ? end : start + 4000);
      assert.doesNotMatch(block, /sendEmailWithDetails/);
      assert.doesNotMatch(block, /sendEmail\(/);
      assert.doesNotMatch(block, /API_ROUTES\.SEND_EMAIL/);
      assert.doesNotMatch(block, /fetch\(['"]\/api\/send-email/);
    }
  });

  it('manual ambassador create uses resendAmbassadorApplicationApprovalEmail not send-email', () => {
    const block = dashboard.slice(
      dashboard.indexOf("setProcessingId('new-ambassador')"),
      dashboard.indexOf('const handleDeleteAmbassador = async')
    );
    assert.match(block, /resendAmbassadorApplicationApprovalEmail/);
    assert.doesNotMatch(block, /sendEmailWithDetails\(/);
    assert.doesNotMatch(block, /sendEmail\(/);
    assert.doesNotMatch(block, /fetch\(['"]\/api\/send-email/);
  });

  it('marketing test/bulk email uses direct fetch to /api/send-email', () => {
    const testBlock = dashboard.slice(
      dashboard.indexOf('const handleSendTestEmail = async'),
      dashboard.indexOf('const handleSendBulkEmails = async')
    );
    const bulkBlock = dashboard.slice(
      dashboard.indexOf('const handleSendBulkEmails = async'),
      dashboard.indexOf('const handleSendTestSms')
    );
    assert.match(testBlock, /fetch\('\/api\/send-email'/);
    assert.match(testBlock, /campaignTemplate:\s*true/);
    assert.match(bulkBlock, /fetch\('\/api\/send-email'/);
    assert.match(dashboard, /activeTab === "marketing"/);
    assert.match(dashboard, /canAccessTab\("marketing"\)/);
  });
});

describe('gateAdminPermission — permission denied does not clear cookie', () => {
  it('403 effective permission branch has no applyClearAdminTokenCookie', async () => {
    const gateSrc = read('api/_lib/admin-permission-gate-http.js');
    const deniedBlock = gateSrc.slice(
      gateSrc.indexOf('const denied = effectivePermissionDenied'),
      gateSrc.indexOf('return authResult;')
    );
    assert.doesNotMatch(deniedBlock, /applyClearAdminTokenCookie/);
  });
});
