'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'server.cjs');
let src = fs.readFileSync(file, 'utf8');

function norm(s) {
  return s.replace(/\r\n/g, '\n');
}

function spliceRoute(startNeedle, endMarker, replacement, label) {
  const start = src.indexOf(startNeedle);
  if (start < 0) throw new Error(`${label}: start not found: ${startNeedle.slice(0, 60)}`);
  const end = src.indexOf(endMarker, start + startNeedle.length);
  if (end < 0) throw new Error(`${label}: end not found: ${endMarker.slice(0, 60)}`);
  src = src.slice(0, start) + replacement + src.slice(end);
}

const requireBlock = `const { createVercelHandlerForward } = require('./api/_lib/server-cjs-vercel-forward.cjs');
const forwardAdminLogin = createVercelHandlerForward('./api/admin-login.js');
const forwardScanApi = createVercelHandlerForward('./api/scan.js');
const forwardMiscApi = createVercelHandlerForward('./api/misc.js');
const forwardOrdersCreate = createVercelHandlerForward('./api/orders-create.js');
const forwardClicToPayConfirm = createVercelHandlerForward('./api/clictopay-confirm-payment.js');

`;

if (!src.includes('server-cjs-vercel-forward.cjs')) {
  const anchor = "} = require('./api/_lib/ambassador-routes.cjs');";
  const idx = src.indexOf(anchor);
  if (idx < 0) throw new Error('ambassador-routes anchor not found');
  src = src.slice(0, idx + anchor.length) + '\n\n' + requireBlock + src.slice(idx + anchor.length);
}

if (src.includes("app.use('/api/send-email', emailLimiter);")) {
  src = src.replace(
    "app.use('/api/send-email', emailLimiter);\r\n\r\n",
    "// PR-1e: send-email rate limits live in api/misc.js (EMAIL_SEND)\r\n\r\n"
  );
  src = src.replace(
    "app.use('/api/send-email', emailLimiter);\n\n",
    "// PR-1e: send-email rate limits live in api/misc.js (EMAIL_SEND)\n\n"
  );
}

if (src.includes("app.post('/api/send-email', requireAdminAuth, async (req, res) => {")) {
  spliceRoute(
    "app.post('/api/send-email', requireAdminAuth, async (req, res) => {",
    '// Test endpoint to verify serverless function is working',
    "app.post('/api/send-email', forwardMiscApi);\r\n\r\n// Test endpoint to verify serverless function is working",
    'send-email'
  );
}

if (src.includes("app.post('/api/admin-login', authLimiter, async (req, res) => {")) {
  spliceRoute(
    "app.post('/api/admin-login', authLimiter, async (req, res) => {",
    '// Verify reCAPTCHA endpoint',
    "app.post('/api/admin-login', forwardAdminLogin);\r\n\r\n// Verify reCAPTCHA endpoint",
    'admin-login'
  );
}

if (src.includes("app.post('/api/scanner-login', scannerLoginLimiter, async (req, res) => {")) {
  spliceRoute(
    "app.post('/api/scanner-login', scannerLoginLimiter, async (req, res) => {",
    '// POST /api/scanner-logout',
    "app.post('/api/scanner-login', forwardScanApi);\r\n\r\n// POST /api/scanner-logout",
    'scanner-login'
  );
}

if (src.includes("app.post('/api/ambassador-login', authLimiter, async (req, res) => {")) {
  src = src.replace(
    "app.post('/api/ambassador-login', authLimiter, async (req, res) => {",
    "app.post('/api/ambassador-login', async (req, res) => {"
  );
}

if (src.includes("app.post('/api/send-sms', requireAdminAuth, requireAdminPermission('marketing:manage'), async (req, res) => {")) {
  spliceRoute(
    "app.post('/api/send-sms', requireAdminAuth, requireAdminPermission('marketing:manage'), async (req, res) => {",
    '// GET /api/sms-balance - Check WinSMS Account Balance',
    "app.post('/api/send-sms', forwardMiscApi);\r\n\r\n// ============================================\r\n// GET /api/sms-balance - Check WinSMS Account Balance",
    'send-sms'
  );
}

if (src.includes("app.post('/api/admin/bulk-sms/send', requireAdminAuth, requireAdminPermission('marketing:manage'), async (req, res) => {")) {
  spliceRoute(
    "app.post('/api/admin/bulk-sms/send', requireAdminAuth, requireAdminPermission('marketing:manage'), async (req, res) => {",
    '// POST /api/bulk-phones',
    "app.post('/api/admin/bulk-sms/send', forwardMiscApi);\r\n\r\n// POST /api/bulk-phones",
    'bulk-sms'
  );
}

if (src.includes("app.post('/api/resend-order-completion-email', requireAdminAuth, async (req, res) => {")) {
  spliceRoute(
    "app.post('/api/resend-order-completion-email', requireAdminAuth, async (req, res) => {",
    '// Get email delivery logs for an order (admin only)',
    "app.post('/api/resend-order-completion-email', forwardMiscApi);\r\n\r\n// Get email delivery logs for an order (admin only)",
    'resend-order-completion-email'
  );
}

if (src.includes('resendTicketEmailLimiter, logSecurityRequest, async (req, res) => {')) {
  spliceRoute(
    "app.post('/api/admin-resend-ticket-email', requireAdminAuth, requireAdminPermission('orders:manage'), resendTicketEmailLimiter, logSecurityRequest, async (req, res) => {",
    '// API info endpoint',
    "app.post('/api/admin-resend-ticket-email', forwardMiscApi);\r\n\r\n// API info endpoint",
    'admin-resend-ticket-email'
  );
}

if (src.includes("app.post('/api/orders/create', orderCreateLimiter, async (req, res) => {")) {
  spliceRoute(
    "app.post('/api/orders/create', orderCreateLimiter, async (req, res) => {",
    '// AIO EVENTS SUBMISSIONS',
    "app.post('/api/orders/create', forwardOrdersCreate);\r\n\r\n// ============================================\r\n// AIO EVENTS SUBMISSIONS",
    'orders/create'
  );
}

const oldConfirm = `async function handleClicToPayConfirm(req, res, next) {
  try {
    const miscHandler = (await import('./api/misc.js')).default;
    req.url = req.originalUrl || req.url;
    await miscHandler(req, res);
  } catch (e) {
    console.error('[/api/clictopay-confirm-payment]', e);
    next(e);
  }
}`;

const newConfirm = `async function handleClicToPayConfirm(req, res, next) {
  return forwardClicToPayConfirm(req, res, next);
}`;

if (src.includes(oldConfirm)) {
  src = src.replace(oldConfirm, newConfirm);
} else if (src.includes(norm(oldConfirm))) {
  src = src.replace(norm(oldConfirm), norm(newConfirm));
}

const deprecations = [
  ['const authLimiter = createRateLimiter({', '/** @deprecated P0 login routes delegate to Vercel handlers with shared rate-limit — non-P0 only */\nconst authLimiter = createRateLimiter({'],
  ['const emailLimiter = createRateLimiter({', '/** @deprecated P0 send-email delegates to misc.js (EMAIL_SEND) — unused on P0 path */\nconst emailLimiter = createRateLimiter({'],
  ['const scannerLoginLimiter = createRateLimiter({', '/** @deprecated P0 scanner-login delegates to api/scan.js (LOGIN_SCANNER) */\nconst scannerLoginLimiter = createRateLimiter({'],
  ['const orderCreateLimiter = createRateLimiter({', '/** @deprecated P0 orders/create delegates to api/orders-create.js (ORDER_CREATE) */\nconst orderCreateLimiter = createRateLimiter({'],
  ['const resendTicketEmailLimiter = createRateLimiter({', '/** @deprecated P0 resend routes delegate to misc.js (EMAIL_RESEND_TICKET) */\nconst resendTicketEmailLimiter = createRateLimiter({'],
];

for (const [needle, repl] of deprecations) {
  if (src.includes(needle) && !src.includes(repl.split('\n')[0])) {
    src = src.replace(needle, repl);
  }
}

fs.writeFileSync(file, src);
console.log('server.cjs PR-1e patch applied');
