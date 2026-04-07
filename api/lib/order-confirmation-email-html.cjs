'use strict';

const { formatEventTime } = require('./online-ticket-email-html.cjs');
const { emailLogoHeaderHtml, transactionalEmailDarkStylesCss } = require('./email-branding.cjs');

function buildOrderConfirmationEmailHtml(order, orderPasses, recipientType = 'client') {
  const orderNumber = order.order_number !== null && order.order_number !== undefined 
    ? `#${order.order_number}` 
    : order.id.substring(0, 8).toUpperCase();
  
  const eventTime = formatEventTime(order.events?.date);
  const venue = order.events?.venue || 'Venue to be announced';
  
  // Determine title and subtitle based on recipient type
  const title = recipientType === 'client' ? 'Payment Processing' : 'New Order';
  const subtitle = recipientType === 'client' ? 'Payment Processing – Andiamo Events' : 'New Order - Andiamo Events';
  
  // Determine greeting message based on recipient type
  const greetingMessage = recipientType === 'client' 
    ? 'Thank you for your order with Andiamo Events!<br><br>One of our official Andiamo Events ambassadors, ' + (order.ambassadors?.full_name || 'your assigned ambassador') + ', will be contacting you shortly to complete the delivery process and assist you if needed.<br><br>Once the payment process is fully completed, you will receive a final confirmation email with all the necessary details.'
    : 'We\'re excited to confirm that a new order has been successfully processed!<br><br>Please contact the client as soon as possible to confirm availability, coordinate delivery, and provide assistance if needed.<br><br>Timely communication is essential to ensure a smooth experience for the client.<br><br>Thank you for your cooperation.';
  
  // Helper function to extract Instagram username from URL
  const getInstagramUsername = (url) => {
    if (!url) return null;
    // Handle both https://www.instagram.com/username and https://instagram.com/username
    const match = url.match(/instagram\.com\/([^\/\?]+)/);
    return match ? match[1] : null;
  };
  
  // Helper function to ensure Instagram URL is properly formatted
  const formatInstagramUrl = (url) => {
    if (!url) return 'https://www.instagram.com/andiamo.events/';
    // If it's already a full URL, return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // If it's just a username, add the full URL
    return `https://www.instagram.com/${url.replace('@', '')}/`;
  };
  
  // Get ambassador Instagram username and URL
  const ambassadorInstagramUrl = order.ambassadors?.social_link 
    ? formatInstagramUrl(order.ambassadors.social_link)
    : 'https://www.instagram.com/andiamo.events/';
  const ambassadorInstagramUsername = getInstagramUsername(ambassadorInstagramUrl) || 'andiamo.events';
  
    // Build passes summary
  const passesSummaryHtml = orderPasses.map(p => `
    <tr>
      <td>${p.pass_type}</td>
      <td style="text-align: center;">${p.quantity}</td>
      <td style="text-align: right;">${parseFloat(p.price).toFixed(2)} TND</td>
    </tr>
  `).join('');
  
  const supportUrl = `${process.env.VITE_API_URL || process.env.API_URL || 'https://andiamoevents.com'}/contact`;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="dark">
      <meta name="supported-color-schemes" content="dark">
      <title>Order Confirmation - Andiamo Events</title>
      <style>
${transactionalEmailDarkStylesCss()}
      </style>
    </head>
    <body>
      ${emailLogoHeaderHtml()}
      <div class="email-wrapper">
        <div class="content-card">
          <div class="title-section">
            <h1 class="title">${title}</h1>
            <p class="subtitle">${subtitle}</p>
          </div>
          
          <p class="greeting">Dear <strong>${recipientType === 'client' ? (order.user_name || 'Valued Customer') : (order.ambassadors?.full_name || 'Ambassador')}</strong>,</p>
          
          <p class="message">
            ${greetingMessage}
          </p>
          
          <div class="order-info-block">
            <div class="info-row">
              <div class="info-label">Order Number</div>
              <div class="info-value">${orderNumber}</div>
            </div>
            ${recipientType === 'client' ? `
            ${order.ambassadors ? `
            <div class="info-row">
              <div class="info-label">Delivered by</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.ambassadors.full_name}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Ambassador Phone</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.ambassadors.phone || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Ambassador Instagram</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">
                <a href="${ambassadorInstagramUrl}" target="_blank" style="color: #E21836 !important; text-decoration: none;">@${ambassadorInstagramUsername}</a>
              </div>
            </div>
            ` : ''}
            ` : `
            <div class="info-row">
              <div class="info-label">Client Name</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.user_name || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Client Phone</div>
              <div style="font-size: 18px; color: #E21836; font-weight: 600;">${order.user_phone || 'N/A'}</div>
            </div>
            `}
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
                <tr class="total-row">
                  <td colspan="2" style="text-align: right; padding-right: 20px;"><strong>${recipientType === 'client' ? 'Total Amount Paid:' : 'Total Amount:'}</strong></td>
                  <td style="text-align: right;"><strong>${parseFloat(order.total_price).toFixed(2)} TND</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="support-section">
            ${recipientType === 'client' ? `
        <p class="support-text">Need assistance? Contact us at 
          <a href="mailto:Contact@andiamoevents.com" style="color: #E21836 !important; text-decoration: none; font-weight: 500;">Contact@andiamoevents.com</a> or in our Instagram page 
          <a href="https://www.instagram.com/andiamo.events/" target="_blank" style="color: #E21836 !important; text-decoration: none; font-weight: 500;">@andiamo.events</a> or contact with 
          <a href="tel:28070128" style="color: #E21836 !important; text-decoration: none; font-weight: 500;">28070128</a>.
        </p>
            ` : `
            <p class="support-text">Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a>.</p>
            `}
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
    </html>
  `;
}

module.exports = { buildOrderConfirmationEmailHtml };
