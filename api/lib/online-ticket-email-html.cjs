/**
 * Official online ticket email HTML — regenerate browser preview: `node email-templates/generate-previews.cjs`
 * Used by ClicToPay success email, first-time ticket email, and admin resend ticket email.
 * (.cjs so require() works when package.json has "type": "module")
 */

const { emailLogoHeaderHtml, transactionalEmailDarkStylesCss } = require('./email-branding.cjs');

function formatEventTime(dateString) {
  if (!dateString) return 'TBA';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'TBA';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${dayName} · ${day} ${monthName} ${year} · ${hours}:${minutes}`;
  } catch (e) {
    return 'TBA';
  }
}

/**
 * @param {Object} opts
 * @param {string} opts.customerName
 * @param {string|number|null} opts.orderNumber
 * @param {string} opts.orderId
 * @param {string} opts.eventName
 * @param {string} [opts.eventTime] - formatted or raw date string
 * @param {string} [opts.venueName]
 * @param {{ passType: string, quantity: number, price: number }[]} opts.passes
 * @param {number} opts.totalAmount
 * @param {number} [opts.feeAmount]
 * @param {number} [opts.subtotalAmount]
 * @param {Map<string, { qr_code_url: string, secure_token: string }[]>} opts.ticketsByPassType - passType -> tickets
 */
function buildOnlineTicketEmailHtml(opts) {
  const {
    customerName,
    orderNumber,
    orderId,
    eventName,
    eventTime,
    venueName,
    passes,
    totalAmount,
    feeAmount,
    subtotalAmount,
    ticketsByPassType,
  } = opts;

  const orderDisplay = orderNumber !== null && orderNumber !== undefined ? `#${orderNumber}` : orderId.substring(0, 8).toUpperCase();
  const eventTimeFormatted = eventTime && typeof eventTime === 'string' && eventTime.includes('·') ? eventTime : formatEventTime(eventTime);
  const hasFees = typeof feeAmount === 'number' && !isNaN(feeAmount) && feeAmount > 0;
  const subtotal = hasFees && typeof subtotalAmount === 'number' ? subtotalAmount : totalAmount;
  const totalDisplay = Number(totalAmount).toFixed(2);

  const passesSummaryHtml = passes.map(
    (p) => `
    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
      <td style="padding: 12px 0; color: #E8E8E8; font-size: 15px; background-color: transparent !important;">${escapeHtml(p.passType)}</td>
      <td style="padding: 12px 0; color: #E8E8E8; font-size: 15px; text-align: center; background-color: transparent !important;">${p.quantity}</td>
      <td style="padding: 12px 0; color: #E8E8E8; font-size: 15px; text-align: right; background-color: transparent !important;">${Number(p.price).toFixed(2)} TND</td>
    </tr>`
  ).join('');

  const feeRowsHtml = hasFees
    ? `
    <tr class="total-row">
      <td colspan="2" style="text-align: right; padding-right: 20px; background-color: transparent !important;"><strong>Subtotal:</strong></td>
      <td style="text-align: right; background-color: transparent !important;"><strong>${Number(subtotal).toFixed(2)} TND</strong></td>
    </tr>
    <tr class="total-row">
      <td colspan="2" style="text-align: right; padding-right: 20px; background-color: transparent !important;"><strong>Payment Fees:</strong></td>
      <td style="text-align: right; background-color: transparent !important;"><strong>${Number(feeAmount).toFixed(2)} TND</strong></td>
    </tr>`
    : '';

  const ticketsHtml =
    ticketsByPassType && (ticketsByPassType instanceof Map ? ticketsByPassType.size > 0 : Array.isArray(ticketsByPassType) && ticketsByPassType.length > 0)
      ? (ticketsByPassType instanceof Map ? Array.from(ticketsByPassType.entries()) : ticketsByPassType).map((entry) => {
          const [passType, passTickets] = Array.isArray(entry) ? entry : [entry.passType, entry.tickets];
          const list = (passTickets || [])
            .filter((t) => t && t.qr_code_url)
            .map(
              (ticket, index) => `
            <div style="margin: 20px 0; padding: 20px; background: #252525; border-radius: 8px; text-align: center; border: 1px solid rgba(255, 255, 255, 0.1);">
              <h4 style="margin: 0 0 15px 0; color: #E21836; font-size: 16px; font-weight: 600;">${escapeHtml(passType)} - Ticket ${index + 1}</h4>
              <img src="${escapeHtml(ticket.qr_code_url)}" alt="QR Code for ${escapeHtml(passType)}" style="max-width: 250px; height: auto; border-radius: 8px; border: 2px solid rgba(226, 24, 54, 0.3); display: block; margin: 0 auto;" />
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #A8A8A8; font-family: 'Courier New', monospace;">Token: ${escapeHtml((ticket.secure_token || '').substring(0, 8))}...</p>
            </div>`
            )
            .join('');
          const count = (passTickets || []).filter((t) => t && t.qr_code_url).length;
          return `
          <div style="margin: 30px 0;">
            <h3 style="color: #E21836; margin-bottom: 15px; font-size: 18px; font-weight: 600;">${escapeHtml(passType)} Tickets (${count})</h3>
            ${list}
          </div>`;
        }).join('')
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Your Digital Tickets - Andiamo Events</title>
  <style>
${transactionalEmailDarkStylesCss()}
  </style>
</head>
<body>
  ${emailLogoHeaderHtml()}
  <div class="email-wrapper">
    <div class="content-card">
      <div class="title-section">
        <h1 class="title">Your Tickets Are Ready</h1>
        <p class="subtitle">Order Confirmation - Andiamo Events</p>
      </div>
      <p class="greeting">Dear <strong>${escapeHtml(customerName || 'Valued Customer')}</strong>,</p>
      <p class="message">We're excited to confirm that your order has been successfully processed! Your digital tickets with unique QR codes are shown below, and a printable PDF is attached (one page per ticket) so you can save or print them easily.</p>
      <div class="order-info-block">
        <div class="info-row">
          <div class="info-label">Order Number</div>
          <div class="info-value">${orderDisplay}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Event</div>
          <div style="font-size: 18px; color: #E21836; font-weight: 600;">${escapeHtml(eventName || 'Event')}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Event Time</div>
          <div style="font-size: 18px; color: #E21836; font-weight: 600;">${escapeHtml(eventTimeFormatted)}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Venue</div>
          <div style="font-size: 18px; color: #E21836; font-weight: 600;">${escapeHtml(venueName || 'Venue to be announced')}</div>
        </div>
      </div>
      <div class="order-info-block">
        <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Passes Purchased</h3>
        <table class="passes-table">
          <thead>
            <tr>
              <th>Pass Type</th>
              <th style="text-align: center;">Quantity</th>
              <th style="text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${passesSummaryHtml}
            ${feeRowsHtml}
            <tr class="total-row">
              <td colspan="2" style="text-align: right; padding-right: 20px; background-color: transparent !important;"><strong>Total Amount Paid:</strong></td>
              <td style="text-align: right; background-color: transparent !important;"><strong>${totalDisplay} TND</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="tickets-section">
        <h3 style="color: #E21836; margin-bottom: 20px; font-size: 18px; font-weight: 600;">Your Digital Tickets</h3>
        <p class="message" style="margin-bottom: 25px;">Please present these QR codes at the event entrance. Each ticket has a unique QR code for verification.</p>
        ${ticketsHtml}
      </div>
      <div class="support-section">
        <p class="support-text">Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a> or in our Instagram page <a href="https://www.instagram.com/andiamo.events/" target="_blank" class="support-email">@andiamo.events</a> or contact with <a href="tel:28070128" class="support-email">28070128</a>.</p>
      </div>
      <div class="closing-section">
        <p class="slogan">We Create Memories</p>
        <p class="signature">Best regards,<br>The Andiamo Events Team</p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
      <div class="footer-links">
        <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a>
        <span style="color: #888888;">•</span>
        <a href="https://malekbenamor.dev/" target="_blank" class="footer-link">Website</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str) {
  if (str == null) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { buildOnlineTicketEmailHtml, formatEventTime };
