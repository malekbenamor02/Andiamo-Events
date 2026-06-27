'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

const VALID_TOKEN = '11111111-1111-4111-8111-111111111111';

const {
  generateTicketQrPngBuffer,
  generateTicketQrDataUrl,
} = require('./ticket-qr-generate.cjs');

const { prepareTicketsByPassTypeForEmail } = require('./ticket-qr-email.cjs');
const {
  QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES,
  programmaticRuntimePackagesFromLockfile,
  QR_GENERATING_VERCEL_FUNCTIONS,
  TICKET_EMAIL_VERCEL_INCLUDE_FILES,
  MISC_TICKET_EMAIL_VERCEL_INCLUDE_FILES,
  VERCEL_INCLUDE_FILES_MAX_LENGTH,
  assertAllIncludeFilesWithinSchemaLimit,
  assertShortTicketEmailIncludeFiles,
  includeFilesForFunction,
} = require('./qrcode-runtime-deps.cjs');

const {
  TICKET_EMAIL_BUNDLE_HINT_PACKAGES,
  ensureTicketEmailRuntimeDepsAreTraceable,
} = require('./ticket-email-bundle-hints.cjs');

function readVercelJson() {
  return read('vercel.json');
}

describe('ticket-qr-generate.cjs', () => {
  it('require("qrcode") exposes toBuffer and toDataURL', async () => {
    const QRCode = require('qrcode');
    assert.equal(typeof QRCode.toBuffer, 'function');
    assert.equal(typeof QRCode.toDataURL, 'function');
    const buf = await QRCode.toBuffer('hello', { type: 'png', width: 64 });
    assert.ok(Buffer.isBuffer(buf));
    const dataUrl = await QRCode.toDataURL('hello', { type: 'png', width: 64 });
    assert.match(dataUrl, /^data:image\/png;base64,/);
  });

  it('loads with static require("qrcode") not dynamic import', () => {
    const src = read('api/_lib/ticket-qr-generate.cjs');
    assert.match(src, /const QRCode = require\(['"]qrcode['"]\)/);
    assert.doesNotMatch(src, /import\s*\(\s*['"]qrcode['"]\s*\)/);
  });

  it('generateTicketQrPngBuffer returns PNG magic bytes', async () => {
    const buf = await generateTicketQrPngBuffer(VALID_TOKEN);
    assert.ok(Buffer.isBuffer(buf));
    assert.ok(buf.length > 8);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
    assert.equal(buf[2], 0x4e);
    assert.equal(buf[3], 0x47);
  });

  it('generateTicketQrDataUrl returns data URL', async () => {
    const dataUrl = await generateTicketQrDataUrl(VALID_TOKEN);
    assert.match(dataUrl, /^data:image\/png;base64,/);
    assert.ok(dataUrl.length > 100);
  });

  it('rejects invalid secure token', async () => {
    await assert.rejects(() => generateTicketQrPngBuffer('not-a-uuid'), /Invalid secure token/);
  });
});

describe('ticket email QR attachments', () => {
  it('prepareTicketsByPassTypeForEmail produces non-empty qrAttachments', async () => {
    const ticketsByPassType = new Map([
      [
        'Standard',
        [{ id: 'ticket-a', secure_token: VALID_TOKEN, passType: 'Standard' }],
      ],
    ]);
    const { qrAttachments, ticketsByPassType: enriched } =
      await prepareTicketsByPassTypeForEmail(ticketsByPassType);
    assert.equal(qrAttachments.length, 1);
    assert.equal(qrAttachments[0].contentType, 'image/png');
    assert.ok(Buffer.isBuffer(qrAttachments[0].content));
    const list = enriched.get('Standard');
    assert.equal(list[0].qr_image_cid, qrAttachments[0].cid);
  });
});

describe('ClicToPay confirm QR bundling', () => {
  it('clictopay-confirm-payment.js does not dynamic-import qrcode', () => {
    const src = read('api/clictopay-confirm-payment.js');
    assert.doesNotMatch(src, /import\s*\(\s*['"]qrcode['"]\s*\)/);
  });

  it('lockfile qrcode programmatic runtime deps match bundle list', () => {
    const fromLock = programmaticRuntimePackagesFromLockfile();
    assert.deepEqual(fromLock.sort(), [...QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES].sort());
  });

  it('vercel.json includeFiles values respect 256-char schema limit', () => {
    const vercel = readVercelJson();
    assertAllIncludeFilesWithinSchemaLimit(vercel);
    for (const value of vercel.match(/"includeFiles":\s*"([^"]+)"/g) || []) {
      const inner = value.match(/"([^"]+)"$/)[1];
      assert.ok(
        inner.length <= VERCEL_INCLUDE_FILES_MAX_LENGTH,
        `includeFiles length ${inner.length} exceeds ${VERCEL_INCLUDE_FILES_MAX_LENGTH}`
      );
    }
  });

  it('vercel.json ticket-email functions use short includeFiles + chromium glob', () => {
    const vercel = readVercelJson();

    const confirm = includeFilesForFunction(vercel, 'api/clictopay-confirm-payment.js');
    assert.equal(confirm, TICKET_EMAIL_VERCEL_INCLUDE_FILES);
    assertShortTicketEmailIncludeFiles(confirm);

    const misc = includeFilesForFunction(vercel, 'api/misc.js');
    assert.equal(misc, MISC_TICKET_EMAIL_VERCEL_INCLUDE_FILES);
    assertShortTicketEmailIncludeFiles(misc);

    for (const fn of [
      'api/admin-approve-order.js',
      'api/admin-pos.js',
      'api/clictopay-confirm-payment.js',
      'api/misc.js',
    ]) {
      assertShortTicketEmailIncludeFiles(includeFilesForFunction(vercel, fn));
    }
  });

  it('ticket-email-bundle-hints.cjs statically references runtime packages', () => {
    const src = read('api/_lib/ticket-email-bundle-hints.cjs');
    for (const pkg of TICKET_EMAIL_BUNDLE_HINT_PACKAGES) {
      assert.match(src, new RegExp(`require\\(['"]${pkg.replace('/', '\\/')}['"]\\)`));
    }
  });

  it('QR/PDF/email API entrypoints call ensureTicketEmailRuntimeDepsAreTraceable', () => {
    for (const rel of QR_GENERATING_VERCEL_FUNCTIONS) {
      const src = read(rel);
      assert.match(src, /ticket-email-bundle-hints\.cjs/);
      assert.match(src, /ensureTicketEmailRuntimeDepsAreTraceable\(\)/);
    }
  });

  it('ensureTicketEmailRuntimeDepsAreTraceable loads without MODULE_NOT_FOUND', () => {
    ensureTicketEmailRuntimeDepsAreTraceable();
  });

  it('ticket email runtime smoke: nodemailer, chromium, follow-redirects load', () => {
    assert.equal(typeof require('nodemailer').createTransport, 'function');
    const followRedirects = require('follow-redirects');
    assert.ok(followRedirects && (followRedirects.http || followRedirects.https));
    const chromium = require('@sparticuz/chromium');
    assert.equal(typeof chromium.executablePath, 'function');
    assert.equal(typeof chromium.args, 'object');
  });

  it('PDF module loads without MODULE_NOT_FOUND for bundled deps', () => {
    const pdf = require('./render-premium-ticket-pdf.cjs');
    assert.equal(typeof pdf.tryBuildPremiumTicketsPdfAttachment, 'function');
    require('puppeteer-core');
    require('pdf-lib');
  });

  it('confirm fulfillment chain loads ticket-qr-generate without dynamic qrcode', () => {
    const fulfillment = require('./paid-order-fulfillment.cjs');
    assert.equal(typeof fulfillment.fulfillPaidOrderTicketsAndEmail, 'function');
    const email = require('./ticket-qr-email.cjs');
    assert.equal(typeof email.prepareTicketsByPassTypeForEmail, 'function');
    const pdf = require('./render-premium-ticket-pdf.cjs');
    assert.equal(typeof pdf.tryBuildPremiumTicketsPdfAttachment, 'function');
  });

  it('PDF QR prerequisite: generateTicketQrDataUrl succeeds for ticket token', async () => {
    const dataUrl = await generateTicketQrDataUrl(VALID_TOKEN);
    assert.match(dataUrl, /^data:image\/png;base64,/);
    const pdfSrc = read('api/_lib/render-premium-ticket-pdf.cjs');
    assert.match(pdfSrc, /require\s*\(\s*['"]\.\/ticket-qr-generate\.cjs['"]\s*\)/);
    assert.doesNotMatch(pdfSrc, /import\s*\(\s*['"]qrcode['"]\s*\)/);
  });
});

describe('API entrypoints avoid dynamic qrcode import', () => {
  for (const rel of [
    'api/admin-approve-order.js',
    'api/admin-pos.js',
    'api/misc.js',
  ]) {
    it(`${rel} has no await import('qrcode')`, () => {
      const src = read(rel);
      assert.doesNotMatch(src, /import\s*\(\s*['"]qrcode['"]\s*\)/);
    });
  }
});
