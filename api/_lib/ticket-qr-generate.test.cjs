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

describe('ticket-qr-generate.cjs', () => {
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

  it('vercel.json includes qrcode for clictopay-confirm-payment', () => {
    const vercel = read('vercel.json');
    assert.match(
      vercel,
      /"api\/clictopay-confirm-payment\.js"[\s\S]*?"includeFiles": "\{api\/_lib\/\*\*,node_modules\/@sparticuz\/chromium\/\*\*,node_modules\/qrcode\/\*\*/
    );
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
