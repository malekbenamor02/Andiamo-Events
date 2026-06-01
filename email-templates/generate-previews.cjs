'use strict';

/**
 * Regenerates browser-preview HTML files under email-templates/previews/
 * from the same builders used in production (plus a few fixed-layout snapshots).
 *
 * Hand-maintained (this script does not overwrite): 12-premium-desktop-ticket.html, 13-premium-desktop-ticket-poster.html
 *
 * Run from repo root: node email-templates/generate-previews.cjs
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const previewsDir = path.join(__dirname, 'previews');
fs.mkdirSync(previewsDir, { recursive: true });

function write(name, html) {
  fs.writeFileSync(path.join(previewsDir, name), html, 'utf8');
  console.log('wrote', name);
}

const { buildOnlineTicketEmailHtml } = require(path.join(root, 'api/_lib/online-ticket-email-html.cjs'));
const { buildOrderConfirmationEmailHtml } = require(path.join(root, 'api/_lib/order-confirmation-email-html.cjs'));
const { createOfficialInvitationEmailHTML } = require(path.join(root, 'api/_lib/official-invitation-email-html.cjs'));
const { buildCampaignEmailHtml } = require(path.join(root, 'api/_lib/campaign-email-html.cjs'));
const { getBaseEmailHtml } = require(path.join(root, 'api/_lib/career-email-base-html.cjs'));
const { emailLogoHeaderHtml } = require(path.join(root, 'api/_lib/email-branding.cjs'));

const PLACEHOLDER_QR = 'https://placehold.co/280x280/png?text=QR+Preview';

const sampleEventDate = new Date('2026-06-15T21:00:00.000Z').toISOString();

// --- 01–02 Digital tickets (canonical template) ---
const ticketsMap = new Map();
ticketsMap.set('VIP', [
  { qr_code_url: PLACEHOLDER_QR, secure_token: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' },
]);
ticketsMap.set('Standard', [{ qr_code_url: PLACEHOLDER_QR, secure_token: 'ffffffff-1111-2222-3333-444444444444' }]);

write(
  '01-digital-tickets-online.html',
  buildOnlineTicketEmailHtml({
    customerName: 'Preview Customer',
    orderNumber: 1042,
    orderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    eventName: 'Summer Night Live',
    eventTime: sampleEventDate,
    venueName: 'Example Venue, Tunis',
    passes: [
      { passType: 'VIP', quantity: 1, price: 150 },
      { passType: 'Standard', quantity: 1, price: 80 },
    ],
    totalAmount: 230,
    feeAmount: 5,
    subtotalAmount: 225,
    ticketsByPassType: ticketsMap,
  })
);

write(
  '02-digital-tickets-online-no-fees.html',
  buildOnlineTicketEmailHtml({
    customerName: 'Preview Customer',
    orderNumber: 99,
    orderId: 'bbbbcccc-dddd-eeee-ffff-000000000001',
    eventName: 'Summer Night Live',
    eventTime: sampleEventDate,
    venueName: 'Example Venue',
    passes: [{ passType: 'GA', quantity: 2, price: 50 }],
    totalAmount: 100,
    ticketsByPassType: new Map([['GA', [{ qr_code_url: PLACEHOLDER_QR, secure_token: 'abc' }]]]),
  })
);

// --- 03–04 Order confirmation (client / ambassador) ---
const orderBase = {
  id: 'order-preview-id-0001',
  order_number: 1001,
  user_name: 'Client Name',
  user_phone: '+21612345678',
  total_price: 230,
  events: { name: 'Summer Night Live', date: sampleEventDate, venue: 'Example Venue' },
  ambassadors: {
    full_name: 'Ambassador Name',
    phone: '+21698765432',
    social_link: 'https://www.instagram.com/andiamo.events/',
  },
};
const passes = [
  { pass_type: 'VIP', quantity: 1, price: 150 },
  { pass_type: 'Standard', quantity: 1, price: 80 },
];

write('03-order-confirmation-client.html', buildOrderConfirmationEmailHtml(orderBase, passes, 'client'));
write('04-order-confirmation-ambassador.html', buildOrderConfirmationEmailHtml(orderBase, passes, 'ambassador'));

// --- 05 Official invitation ---
write(
  '05-official-invitation.html',
  createOfficialInvitationEmailHTML({
    guestName: 'Guest Name',
    guestPhone: '+216 12 345 678',
    guestEmail: 'guest@example.com',
    event: { name: 'Exclusive Event', date: sampleEventDate, venue: 'Main Hall', city: 'Tunis' },
    passType: 'VIP',
    invitationNumber: 'INV-2026-001',
    zoneName: 'VIP Zone',
    zoneDescription: 'Access to VIP area and dedicated entrance.',
    qrCodes: [{ qr_code_url: PLACEHOLDER_QR, secure_token: 'tok1' }],
  }).html
);

// --- 06 Marketing / standard campaign ---
write(
  '06-marketing-campaign.html',
  buildCampaignEmailHtml(
    'Important update from Andiamo Events',
    'We wanted to share an important update with you.\n\nThank you for being part of Andiamo Events.',
    'Subscriber',
    null,
    'https://www.andiamoevents.com',
    'Book now'
  )
);

// --- 07–08 Career (base layout) ---
write(
  '07-career-application-received.html',
  getBaseEmailHtml(
    'Application received – Andiamo Events',
    'Careers',
    'Hi <strong>Jane</strong>,',
    'We have received your application for <strong>Marketing Intern</strong>. We will review it and get back to you soon.'
  )
);
write(
  '08-career-application-approved.html',
  getBaseEmailHtml(
    'Your application has been approved',
    'Andiamo Events',
    'Hi <strong>Jane</strong>,',
    'Great news! Your application for <strong>Marketing Intern</strong> has been approved. We will contact you shortly to discuss the next steps.'
  )
);

// --- 09 Security alert (inline snapshot; matches server.cjs) ---
write(
  '09-security-alert.html',
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Security Alert Preview</title></head><body style="font-family:Arial,sans-serif;padding:0;margin:0;background:#101010;color:#F0F0F0;">
${emailLogoHeaderHtml()}
<div style="padding:24px;">
<h2 style="color:#fff;">Security Alert</h2>
<p><strong>Event Type:</strong> rate_limit_exceeded</p>
<p><strong>IP Address:</strong> 203.0.113.10</p>
<p><strong>Event Count:</strong> 42 (Threshold: 10)</p>
<p><strong>Time Window:</strong> Last 1 hour</p>
<p><em>This is an automated security alert. Please review the security audit logs.</em></p>
</div></body></html>`
);

// --- 10–11 COD pass purchase completion (snapshots from server routes) ---
write(
  '10-order-completion-cod-rich.html',
  `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Order Confirmation - Andiamo Events</title>
<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#E8E8E8;background:#101010;padding:0;margin:0}.container{max-width:600px;margin:0 auto;background:#1A1A1A;padding:30px;border-radius:10px;border:1px solid rgba(255,255,255,0.08)}.header{background:linear-gradient(135deg,#3d2a5c 0%,#4a2860 100%);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0;margin:-30px -30px 30px -30px}.order-info{background:#1E1E1E;padding:20px;border-radius:8px;margin:20px 0;border:1px solid rgba(255,255,255,0.08)}.order-info h3{margin-top:0;color:#E21836}</style></head><body>
${emailLogoHeaderHtml()}
<div style="padding:20px;"><div class="container"><div class="header"><h1>✅ Order Confirmed!</h1><p>Your Pass Purchase is Complete</p></div>
<p>Dear <strong>Preview Customer</strong>,</p>
<p>We're excited to confirm that your pass purchase has been successfully processed! Your payment has been received in cash by our ambassador, and your order is now fully validated.</p>
<div class="order-info"><h3>📋 Order Details</h3><p><strong>Event:</strong> Summer Night Live</p><p><strong>Delivered by:</strong> Ambassador Name</p></div>
<div class="order-info"><h3>🎫 Passes Purchased</h3><p>VIP ×1 — 150.00 TND</p></div>
</div></div></body></html>`
);

write(
  '11-order-completion-cod-simple.html',
  `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Order Confirmation - Andiamo Events</title>
<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#E8E8E8;background:#101010;padding:0;margin:0}.container{max-width:600px;margin:0 auto;background:#1A1A1A;padding:30px;border-radius:10px;border:1px solid rgba(255,255,255,0.08)}.header{background:linear-gradient(135deg,#3d2a5c 0%,#4a2860 100%);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0;margin:-30px -30px 30px -30px}</style></head><body>
${emailLogoHeaderHtml()}
<div style="padding:20px;"><div class="container"><div class="header"><h1>✅ Order Confirmed!</h1></div>
<p>Dear <strong>Preview Customer</strong>,</p>
<p>Your order <strong>#1001</strong> has been confirmed. Total: 230 TND</p>
<p><strong>Event:</strong> Summer Night Live</p>
</div></div></body></html>`
);

// --- Academy registration emails (English only) ---
// Relative path so previews work when opened from email-templates/previews/
process.env.ACADEMY_EMAIL_LOGO_URL = '../../public/assets/andiamo-academy-cropped.svg';

const {
  PREVIEW_FIXTURE,
  buildAcademyOnlineConfirmedEmailHtml,
  buildAcademyManualPaymentReceivedEmailHtml,
  buildAcademyApprovedEmailHtml,
} = require(path.join(root, 'api/_lib/academy-email-html.cjs'));

const academyManualFixture = {
  ...PREVIEW_FIXTURE,
  payment_method: 'd17',
  fee_amount_dt: 0,
  total_amount_dt: PREVIEW_FIXTURE.base_amount_dt,
};

write('14-academy-online-confirmed.html', buildAcademyOnlineConfirmedEmailHtml(PREVIEW_FIXTURE).html);
write(
  '15-academy-manual-payment-received.html',
  buildAcademyManualPaymentReceivedEmailHtml(academyManualFixture).html
);
write('16-academy-approved.html', buildAcademyApprovedEmailHtml(PREVIEW_FIXTURE).html);

const staleAcademyPreviews = [
  '14-academy-online-confirmed-en.html',
  '15-academy-online-confirmed-fr.html',
  '16-academy-manual-payment-received-en.html',
  '17-academy-manual-payment-received-fr.html',
  '18-academy-approved-en.html',
  '19-academy-approved-fr.html',
];
for (const name of staleAcademyPreviews) {
  const p = path.join(previewsDir, name);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log('removed', name);
  }
}

console.log('Done. Open email-templates/email-gallery.html to browse all previews in one page.');
console.log('Academy emails: email-templates/previews/14–16-academy-*.html');
