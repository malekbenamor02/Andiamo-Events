'use strict';

/**
 * Static requires so Vercel Node File Trace bundles QR/PDF/SMTP runtime deps
 * without listing every hoisted package in includeFiles (256-char schema limit).
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
