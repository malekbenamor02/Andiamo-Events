'use strict';

const { emailLogoHeaderHtml, transactionalEmailDarkStylesCss } = require('./email-branding.cjs');

function getBaseEmailHtml(title, subtitle, greeting, message) {
  const supportUrl = process.env.VITE_API_URL || process.env.API_URL || 'https://www.andiamoevents.com';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${title}</title>
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
      <p class="greeting">${greeting}</p>
      <p class="message">${message}</p>
      <div class="support-section">
        <p class="support-text">
          Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a> or visit <a href="${supportUrl}/contact" class="support-email">our support page</a>.
        </p>
      </div>
      <div class="closing-section">
        <p class="slogan">We Create Memories</p>
        <p class="signature">
          Best regards,<br>
          The Andiamo Events Team
        </p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
      <div class="footer-links">
        <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a>
        <span style="color: #888888;">&bull;</span>
        <a href="https://malekbenamor.dev" target="_blank" class="footer-link">Website</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}


module.exports = { getBaseEmailHtml };
