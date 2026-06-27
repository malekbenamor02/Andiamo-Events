'use strict';

/**
 * Local smoke helper for ticket-email runtime deps (not used by serverless entrypoints).
 * Vercel Node File Trace requires bare imports in api/*.js entrypoints — see those files.
 */
const TICKET_EMAIL_BUNDLE_HINT_PACKAGES = [
  'qrcode',
  'dijkstrajs',
  'pngjs',
  'pdf-lib',
  'puppeteer-core',
  '@sparticuz/chromium',
  'follow-redirects',
  'nodemailer',
];

function ensureTicketEmailRuntimeDepsAreTraceable() {
  require('qrcode');
  require('dijkstrajs');
  require('pngjs');
  require('pdf-lib');
  require('puppeteer-core');
  require('@sparticuz/chromium');
  require('follow-redirects');
  require('nodemailer');
}

module.exports = {
  TICKET_EMAIL_BUNDLE_HINT_PACKAGES,
  ensureTicketEmailRuntimeDepsAreTraceable,
};
