'use strict';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {{ fullName: string; rejectionNote?: string | null }} params
 */
function buildAmbassadorRejectionEmailHtml(params) {
  const fullName = escapeHtml(params.fullName);
  const noteBlock =
    params.rejectionNote && String(params.rejectionNote).trim()
      ? `<p class="message">${escapeHtml(String(params.rejectionNote).trim())}</p>`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Application Update - Andiamo Events</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; background: #FFFFFF; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
    .content-card { background: #F5F5F5; margin: 0 20px 30px; border-radius: 12px; padding: 50px 40px; border: 1px solid rgba(0, 0, 0, 0.1); }
    .title-section { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); }
    .title { font-size: 32px; font-weight: 700; color: #1A1A1A; margin-bottom: 12px; }
    .subtitle { font-size: 16px; color: #666666; }
    .greeting { font-size: 18px; color: #1A1A1A; margin-bottom: 30px; line-height: 1.7; }
    .greeting strong { color: #E21836; font-weight: 600; }
    .message { font-size: 16px; color: #666666; margin-bottom: 25px; line-height: 1.7; }
    .support-section { background: #E8E8E8; border-left: 3px solid rgba(226, 24, 54, 0.3); padding: 20px 25px; margin: 35px 0; border-radius: 4px; }
    .support-text { font-size: 14px; color: #666666; line-height: 1.7; }
    .closing-section { text-align: center; margin: 50px 0 40px; padding-top: 40px; border-top: 1px solid rgba(0, 0, 0, 0.1); }
    .slogan { font-size: 24px; font-style: italic; color: #E21836; font-weight: 300; letter-spacing: 1px; margin-bottom: 30px; }
    .signature { font-size: 16px; color: #666666; line-height: 1.7; }
    .footer { margin-top: 50px; padding: 40px 20px 30px; text-align: center; border-top: 1px solid rgba(0, 0, 0, 0.1); }
    .footer-text { font-size: 12px; color: #999999; margin-bottom: 20px; line-height: 1.6; }
    .footer-link { color: #999999; text-decoration: none; font-size: 13px; margin: 0 8px; }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="content-card">
      <div class="title-section">
        <h1 class="title">Application Update</h1>
        <p class="subtitle">Andiamo Events Ambassador Program</p>
      </div>
      <p class="greeting">Dear <strong>${fullName}</strong>,</p>
      <p class="message">Thank you for filling out the form and for your interest in our event.</p>
      <p class="message">Unfortunately, we are unable to accept your participation this time.</p>
      ${noteBlock}
      <p class="message">Your details are registered in our database, and we may contact you to collaborate on a future event. We hope to see you soon.</p>
      <div class="support-section">
        <p class="support-text">Questions? Contact us at <a href="mailto:support@andiamoevents.com">support@andiamoevents.com</a></p>
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
        <span style="color: #999999;">•</span>
        <a href="https://malekbenamor.dev/" target="_blank" class="footer-link">Website</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

const REJECTION_EMAIL_SUBJECT = 'Andiamo Events - Application Update';
const REJECTION_EMAIL_FROM = '"Andiamo Events" <contact@andiamoevents.com>';

module.exports = {
  buildAmbassadorRejectionEmailHtml,
  REJECTION_EMAIL_SUBJECT,
  REJECTION_EMAIL_FROM,
};
