'use strict';

/**
 * Public site origin for absolute asset URLs in emails (images must be https in clients).
 * Set PUBLIC_SITE_URL (or VITE_SITE_URL) in production if different from default.
 */
function getPublicSiteOrigin() {
  const raw =
    process.env.PUBLIC_SITE_URL ||
    process.env.VITE_SITE_URL ||
    process.env.VITE_APP_URL ||
    process.env.VITE_API_URL ||
    process.env.API_URL ||
    'https://www.andiamoevents.com';
  const s = String(raw).trim();
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/\//, '')}`;
    const u = new URL(withProto);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'https://www.andiamoevents.com';
  }
}

/**
 * Absolute URL to the white logo (on dark header). Served from /public/email-assets/ in the web app.
 * For local HTML previews, generate-previews.cjs sets EMAIL_LOGO_URL=logo-white.png (same folder as previews).
 */
function getEmailLogoUrl() {
  const override = process.env.EMAIL_LOGO_URL;
  if (override != null && String(override).trim() !== '') {
    return String(override).trim();
  }
  const origin = getPublicSiteOrigin().replace(/\/$/, '');
  return `${origin}/email-assets/logo-white.png`;
}

/** Black logo for light backgrounds (e.g. investor institutional template). Override with EMAIL_LOGO_BLACK_URL or INVESTOR_EMAIL_LOGO_URL. */
function getEmailLogoBlackUrl() {
  const override =
    process.env.INVESTOR_EMAIL_LOGO_URL || process.env.EMAIL_LOGO_BLACK_URL;
  if (override != null && String(override).trim() !== '') {
    return String(override).trim();
  }
  const origin = getPublicSiteOrigin().replace(/\/$/, '');
  return `${origin}/email-assets/logo-black.png`;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

/** Shared dark layout for transactional HTML emails (body, card, tables, footer). */
function transactionalEmailDarkStylesCss() {
  return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #F0F0F0;
          background: #101010;
          padding: 0;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        a {
          color: #E21836 !important;
          text-decoration: none;
        }
        .email-wrapper {
          max-width: 600px;
          margin: 0 auto;
          background: #101010;
        }
        .content-card {
          background: #1A1A1A;
          margin: 0 20px 30px;
          border-radius: 12px;
          padding: 50px 40px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .title-section {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 30px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .title {
          font-size: 32px;
          font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }
        .subtitle {
          font-size: 16px;
          color: #B8B8B8;
          font-weight: 400;
        }
        .greeting {
          font-size: 18px;
          color: #F0F0F0;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        .greeting strong {
          color: #E21836;
          font-weight: 600;
        }
        .message {
          font-size: 16px;
          color: #B8B8B8;
          margin-bottom: 25px;
          line-height: 1.7;
        }
        .order-info-block {
          background: #1E1E1E;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        .info-row {
          margin-bottom: 20px;
        }
        .info-row:last-child {
          margin-bottom: 0;
        }
        .info-label {
          font-size: 11px;
          color: #888888;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        .info-value {
          font-family: 'Courier New', 'Monaco', monospace;
          font-size: 18px;
          color: #F5F5F5;
          font-weight: 500;
          word-break: break-all;
          letter-spacing: 0.5px;
        }
        .passes-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .passes-table th {
          text-align: left;
          padding: 12px 0;
          color: #E21836;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid rgba(226, 24, 54, 0.3);
          background: transparent !important;
        }
        .passes-table td {
          padding: 12px 0;
          color: #E8E8E8;
          font-size: 15px;
          background: transparent !important;
        }
        .total-row {
          border-top: 2px solid rgba(226, 24, 54, 0.3);
          margin-top: 10px;
          padding-top: 15px;
        }
        .total-row td {
          font-weight: 700;
          font-size: 18px;
          color: #E21836;
          padding-top: 15px;
        }
        .tickets-section {
          background: #1E1E1E;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        .support-section {
          background: #1E1E1E;
          border-left: 3px solid rgba(226, 24, 54, 0.3);
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        .support-text {
          font-size: 14px;
          color: #B8B8B8;
          line-height: 1.7;
        }
        .support-email {
          color: #E21836 !important;
          text-decoration: none;
          font-weight: 500;
        }
        .closing-section {
          text-align: center;
          margin: 50px 0 40px;
          padding-top: 40px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .slogan {
          font-size: 24px;
          font-style: italic;
          color: #E21836;
          font-weight: 300;
          letter-spacing: 1px;
          margin-bottom: 30px;
        }
        .signature {
          font-size: 16px;
          color: #B8B8B8;
          line-height: 1.7;
        }
        .footer {
          margin-top: 50px;
          padding: 40px 20px 30px;
          text-align: center;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .footer-text {
          font-size: 12px;
          color: #888888;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        .footer-links {
          margin: 15px auto 0;
          text-align: center;
        }
        .footer-link {
          color: #888888;
          text-decoration: none;
          font-size: 13px;
          margin: 0 8px;
        }
        .footer-link:hover {
          color: #E21836 !important;
        }
        @media only screen and (max-width: 600px) {
          .content-card {
            margin: 0 15px 20px;
            padding: 35px 25px;
          }
          .title {
            font-size: 26px;
          }
          .order-info-block, .tickets-section {
            padding: 25px 20px;
          }
        }
  `.trim();
}

/** Official invitation + shared blocks (extends transactional base with invitation-specific classes). */
function invitationEmailDarkStylesCss() {
  return (
    transactionalEmailDarkStylesCss() +
    `
        .info-block {
          background: #1E1E1E;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        .event-details-block {
          background: #1E1E1E;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 30px;
          margin: 40px 0;
        }
        .event-details-title {
          font-size: 18px;
          color: #E21836;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .event-detail-row {
          margin-bottom: 15px;
        }
        .event-detail-row:last-child {
          margin-bottom: 0;
        }
        .event-detail-label {
          font-size: 11px;
          color: #888888;
          text-transform: uppercase;
          letter-spacing: 1.2px;
          margin-bottom: 5px;
          font-weight: 600;
        }
        .event-detail-value {
          font-size: 16px;
          color: #F0F0F0;
          font-weight: 500;
        }
        .qr-code-section {
          text-align: center;
          margin: 40px 0;
          padding: 30px;
          background: #181818;
          border: 2px solid #E21836;
          border-radius: 12px;
        }
        .qr-code-title {
          font-size: 20px;
          color: #FFFFFF;
          font-weight: 600;
          margin-bottom: 15px;
        }
        .qr-code-instruction {
          font-size: 15px;
          color: #B8B8B8;
          margin-bottom: 25px;
          line-height: 1.6;
        }
        .rules-section {
          background: #221c14;
          border-left: 3px solid #E21836;
          padding: 20px 25px;
          margin: 35px 0;
          border-radius: 4px;
        }
        .rules-title {
          font-size: 16px;
          color: #E21836;
          font-weight: 600;
          margin-bottom: 15px;
        }
        .rules-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .rules-list li {
          font-size: 14px;
          color: #B8B8B8;
          line-height: 1.8;
          margin-bottom: 10px;
          padding-left: 25px;
          position: relative;
        }
        .rules-list li:before {
          content: "⚠️";
          position: absolute;
          left: 0;
        }
        .rules-list li:last-child {
          margin-bottom: 0;
        }
        .arrival-note {
          font-size: 14px;
          color: #B8B8B8;
          margin-top: 15px;
          line-height: 1.7;
        }
        .support-contact {
          font-size: 14px;
          color: #B8B8B8;
          line-height: 1.8;
        }
  `
  ).trim();
}

/** Top-of-email header block (logo intentionally omitted). */
function emailLogoHeaderHtml() {
  return '';
}

/** Support + closing inside content-card (matches order confirmation emails). */
function transactionalOrderStyleSupportAndClosingHtml() {
  return `
      <div class="support-section">
        <p class="support-text">Need assistance? Contact us at
          <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a> or in our Instagram page
          <a href="https://www.instagram.com/andiamo.events/" target="_blank" class="support-email">@andiamo.events</a> or contact with
          <a href="tel:28070128" class="support-email">28070128</a>.
        </p>
      </div>
      <div class="closing-section">
        <p class="slogan">We Create Memories</p>
        <p class="signature">Best regards,<br>The Andiamo Events Team</p>
      </div>`;
}

/** Developer footer below content-card (matches order confirmation emails). */
function transactionalOrderStyleDeveloperFooterHtml() {
  return `
        <div class="footer">
          <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
          <div class="footer-links">
            <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a>
            <span style="color: #888888;">&bull;</span>
            <a href="https://malekbenamor.dev/" target="_blank" class="footer-link">Website</a>
          </div>
        </div>`;
}

function transactionalOrderStylePlainTextFooterLines() {
  return [
    'Need assistance? Contact@andiamoevents.com — Instagram @andiamo.events — 28070128',
    '',
    'We Create Memories',
    '',
    'Best regards,',
    'The Andiamo Events Team',
    '',
    'Developed by Malek Ben Amor — https://www.instagram.com/malekbenamor.dev/ — https://malekbenamor.dev/',
  ];
}

module.exports = {
  getPublicSiteOrigin,
  getEmailLogoUrl,
  getEmailLogoBlackUrl,
  emailLogoHeaderHtml,
  transactionalEmailDarkStylesCss,
  invitationEmailDarkStylesCss,
  escapeAttr,
  transactionalOrderStyleSupportAndClosingHtml,
  transactionalOrderStyleDeveloperFooterHtml,
  transactionalOrderStylePlainTextFooterLines,
};
