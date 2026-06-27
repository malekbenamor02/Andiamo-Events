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
  QRCODE_VERCEL_NODE_MODULES,
  QRCODE_PROGRAMMATIC_RUNTIME_PACKAGES,
  programmaticRuntimePackagesFromLockfile,
  QR_GENERATING_VERCEL_FUNCTIONS,
  TICKET_EMAIL_VERCEL_INCLUDE_FILES,
  MISC_TICKET_EMAIL_VERCEL_INCLUDE_FILES,
  REQUIRED_TICKET_EMAIL_RUNTIME_GLOBS,
  TICKET_EMAIL_VERCEL_NODE_MODULES,
  ticketEmailNodeModuleGlobsFromLockfile,
  assertIncludeFilesCoversTicketEmailRuntime,
} = require('./qrcode-runtime-deps.cjs');

function includeFilesForFunction(vercelJson, functionPath) {
  const block = new RegExp(
    `"${functionPath.replace(/\//g, '\\/')}"[\\s\\S]*?"includeFiles":\\s*"([^"]+)"`
  ).exec(vercelJson);
  assert.ok(block, `includeFiles block not found for ${functionPath}`);
  return block[1];
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

  it('vercel.json QR-generating functions include full qrcode runtime tree', () => {
    const vercel = read('vercel.json');
    for (const fn of QR_GENERATING_VERCEL_FUNCTIONS) {
      const includeFiles = includeFilesForFunction(vercel, fn);
      for (const glob of QRCODE_VERCEL_NODE_MODULES) {
        assert.match(
          includeFiles,
          new RegExp(glob.replace(/\//g, '\\/').replace(/\*\*/g, '\\*\\*')),
          `${fn} missing ${glob}`
        );
      }
    }
  });

  it('vercel.json ticket-email functions match lockfile-derived bundle list', () => {
    const vercel = read('vercel.json');
    const expectedGlobs = ticketEmailNodeModuleGlobsFromLockfile();
    assert.deepEqual(TICKET_EMAIL_VERCEL_NODE_MODULES, expectedGlobs);

    const confirm = includeFilesForFunction(vercel, 'api/clictopay-confirm-payment.js');
    assert.equal(confirm, TICKET_EMAIL_VERCEL_INCLUDE_FILES);

    const misc = includeFilesForFunction(vercel, 'api/misc.js');
    assert.equal(misc, MISC_TICKET_EMAIL_VERCEL_INCLUDE_FILES);

    for (const fn of [
      'api/admin-approve-order.js',
      'api/admin-pos.js',
      'api/clictopay-confirm-payment.js',
    ]) {
      assertIncludeFilesCoversTicketEmailRuntime(includeFilesForFunction(vercel, fn));
    }
    assertIncludeFilesCoversTicketEmailRuntime(includeFilesForFunction(vercel, 'api/misc.js'));
  });

  it('vercel.json includes required QR/PDF/SMTP runtime packages', () => {
    const vercel = read('vercel.json');
    for (const fn of QR_GENERATING_VERCEL_FUNCTIONS) {
      const includeFiles = includeFilesForFunction(vercel, fn);
      for (const glob of REQUIRED_TICKET_EMAIL_RUNTIME_GLOBS) {
        assert.match(
          includeFiles,
          new RegExp(glob.replace(/\//g, '\\/').replace(/\*\*/g, '\\*\\*')),
          `${fn} missing ${glob}`
        );
      }
    }
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
