'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '../..');

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8');
}

const {
  buildTicketLabel,
  mapAdminQrPreviewRow,
  MAX_PREVIEW_TICKETS,
} = require('./admin-order-qr-tickets.cjs');

const VALID_TOKEN = '11111111-1111-4111-8111-111111111111';

describe('admin-order-qr-tickets.cjs', () => {
  it('buildTicketLabel uses pass_sequence when present', () => {
    assert.equal(buildTicketLabel('VIP', 2, 0), 'VIP #3');
    assert.equal(buildTicketLabel(null, 0, 4), 'Ticket #1');
    assert.equal(buildTicketLabel('Standard', null, 1), 'Standard #2');
  });

  it('mapAdminQrPreviewRow returns preview data URL without exposing secure_token', async () => {
    const row = await mapAdminQrPreviewRow(
      {
        id: 'ticket-a',
        secure_token: VALID_TOKEN,
        generated_at: '2026-06-27T00:00:00.000Z',
        scan_status: 'VALID',
        generation_status: null,
      },
      { passType: 'Standard', index: 0, passSequence: 0 }
    );

    assert.equal(row.id, 'ticket-a');
    assert.equal(row.label, 'Standard #1');
    assert.equal(row.pass_type, 'Standard');
    assert.equal(row.scan_status, 'VALID');
    assert.equal(row.qr_preview_available, true);
    assert.match(row.qr_preview_data_url, /^data:image\/png;base64,/);
    assert.equal('secure_token' in row, false);
    assert.equal('qr_display_url' in row, false);
    assert.equal('qr_code_url' in row, false);
  });

  it('mapAdminQrPreviewRow marks preview unavailable for invalid token without leaking token', async () => {
    const row = await mapAdminQrPreviewRow(
      {
        id: 'ticket-b',
        secure_token: 'not-a-uuid',
        generated_at: null,
        scan_status: 'VALID',
        generation_status: null,
      },
      { passType: 'Standard', index: 0 }
    );

    assert.equal(row.qr_preview_available, false);
    assert.equal(row.qr_preview_data_url, null);
    assert.equal('secure_token' in row, false);
  });
});

describe('misc.js order-qr-tickets route security', () => {
  it('super_admin check runs before createAdminDbClient', () => {
    const src = read('api/misc.js');
    const blockStart = src.indexOf("path === '/api/admin/order-qr-tickets'");
    assert.ok(blockStart >= 0);
    const blockEnd = src.indexOf('// GET /api/email-delivery-logs', blockStart);
    const block = src.slice(blockStart, blockEnd > blockStart ? blockEnd : blockStart + 3500);
    const roleIdx = block.indexOf("role !== 'super_admin'");
    const dbIdx = block.indexOf('createAdminDbClient(res)');
    assert.ok(roleIdx >= 0 && dbIdx > roleIdx);
  });

  it('uses loadAdminOrderQrTicketPreviews helper (read-only preview path)', () => {
    const src = read('api/misc.js');
    assert.match(src, /loadAdminOrderQrTicketPreviews/);
    const blockStart = src.indexOf("path === '/api/admin/order-qr-tickets'");
    const blockEnd = src.indexOf('// GET /api/email-delivery-logs', blockStart);
    const block = src.slice(blockStart, blockEnd > blockStart ? blockEnd : blockStart + 3500);
    assert.doesNotMatch(block, /\.update\s*\(/);
    assert.doesNotMatch(block, /\.insert\s*\(/);
    assert.doesNotMatch(block, /\.delete\s*\(/);
  });

  it('response mapping does not expose secure_token or public QR URLs', () => {
    const modSrc = read('api/_lib/admin-order-qr-tickets.cjs');
    assert.doesNotMatch(modSrc, /secure_token:\s*row\.secure_token/);
    assert.doesNotMatch(modSrc, /qr_display_url/);
    assert.doesNotMatch(modSrc, /qr_code_url/);
    assert.ok(MAX_PREVIEW_TICKETS > 0 && MAX_PREVIEW_TICKETS <= 100);
  });
});

describe('AdminOrderQrTicketsSection frontend', () => {
  it('does not build QR URLs from secure_token client-side', () => {
    const src = read('src/pages/admin/components/AdminOrderQrTicketsSection.tsx');
    assert.doesNotMatch(src, /TICKET_QR/);
    assert.doesNotMatch(src, /secure_token/);
    assert.doesNotMatch(src, /qr_display_url/);
    assert.match(src, /qr_preview_data_url/);
    assert.match(src, /bg-white/);
  });
});
