'use strict';

/**
 * Writes email-templates/previews/sample-tickets-design.pdf (demo data + stock poster).
 * Open via email-templates/email-gallery.html → "12 · Sample ticket design".
 *
 * Run: node email-templates/generate-sample-ticket-pdf.cjs
 */

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { buildTicketsPdfBuffer } = require(path.join(root, 'api/lib/ticket-pdf.cjs'));

(async () => {
  const buf = await buildTicketsPdfBuffer({
    customerName: 'Houssem Ben Mabrouk',
    eventName: 'SENIOR',
    eventDateIso: '2026-03-28T17:00:00.000Z',
    venue: 'BAR GOLF BRÄU, RUE DE LA TOURTERELLE',
    city: 'SOUSSE',
    posterUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1400&q=80',
    tickets: [
      { id: '1', secure_token: '15868bb8-3f09-4b1a-8c2d-ef1234567890', order_pass_id: 'p1' },
      { id: '2', secure_token: '25979cc9-4f10-5b2b-9d3e-f02345678901', order_pass_id: 'p1' },
    ],
    passes: [{ id: 'p1', pass_type: 'NORMAL', pass_detail: 'FIRST RELEASE' }],
  });
  const out = path.join(__dirname, 'previews', 'sample-tickets-design.pdf');
  fs.writeFileSync(out, buf);
  console.log('Wrote', out, '(' + buf.length + ' bytes)');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
