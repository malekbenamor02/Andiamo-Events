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
 * Build ambassador approval email HTML (server-side trusted template).
 * @param {{
 *   fullName: string;
 *   phone: string;
 *   password: string;
 *   loginUrl: string;
 *   ambassadorId?: string;
 *   trackingOrigin?: string;
 * }} params
 */
function buildAmbassadorApprovalEmailHtml(params) {
  const fullName = escapeHtml(params.fullName);
  const phone = escapeHtml(params.phone);
  const password = escapeHtml(params.password);
  const loginUrl = escapeHtml(params.loginUrl);

  let trackingPixel = '';
  const ambassadorId = params.ambassadorId && String(params.ambassadorId).trim();
  const origin = (params.trackingOrigin || 'https://www.andiamoevents.com').replace(/\/$/, '');
  if (ambassadorId) {
    const trackingUrl = `${origin}/api/track-email?ambassador_id=${encodeURIComponent(ambassadorId)}&email_type=approval`;
    trackingPixel = `<img src="${escapeHtml(trackingUrl)}" width="1" height="1" style="display:none;" />`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Ambassador Approved - Andiamo Events</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; background: #FFFFFF; }
    a { color: #E21836 !important; text-decoration: none; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
    .content-card { background: #F5F5F5; margin: 0 20px 30px; border-radius: 12px; padding: 50px 40px; border: 1px solid rgba(0, 0, 0, 0.1); }
    .title-section { text-align: center; margin-bottom: 40px; padding-bottom: 30px; border-bottom: 1px solid rgba(0, 0, 0, 0.1); }
    .title { font-size: 32px; font-weight: 700; color: #1A1A1A; margin-bottom: 12px; }
    .subtitle { font-size: 16px; color: #666666; }
    .greeting { font-size: 18px; color: #1A1A1A; margin-bottom: 30px; line-height: 1.7; }
    .greeting strong { color: #E21836; font-weight: 600; }
    .message { font-size: 16px; color: #666666; margin-bottom: 25px; line-height: 1.7; }
    .credentials-block { background: #E8E8E8; border: 1px solid rgba(0, 0, 0, 0.15); border-radius: 8px; padding: 30px; margin: 40px 0; }
    .credential-row { margin-bottom: 25px; }
    .credential-row:last-child { margin-bottom: 0; }
    .credential-label { font-size: 11px; color: #999999; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 10px; font-weight: 600; }
    .credential-value { font-family: 'Courier New', 'Monaco', monospace; font-size: 18px; color: #1A1A1A; font-weight: 500; word-break: break-all; }
    .cta-button { display: block; width: 100%; max-width: 320px; margin: 40px auto; padding: 16px 32px; background: #E21836; color: #FFFFFF !important; text-decoration: none; text-align: center; font-size: 16px; font-weight: 600; border-radius: 8px; }
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
        <h1 class="title">Approval Confirmed</h1>
        <p class="subtitle">Welcome to the Andiamo Events Ambassador Program</p>
      </div>
      <p class="greeting">Dear <strong>${fullName}</strong>,</p>
      <p class="message">Thank you for filling out the form and for your interest in working with Andiamo.</p>
      <p class="message">We are pleased to inform you that you have been selected to collaborate with us.</p>
      <p class="message">You will soon be added to a private Instagram group where we will share further details and discuss the upcoming event.</p>
      <div class="credentials-block">
        <div class="credential-row">
          <div class="credential-label">Phone Number</div>
          <div class="credential-value">${phone}</div>
        </div>
        <div class="credential-row">
          <div class="credential-label">Temporary Password</div>
          <div class="credential-value">${password}</div>
        </div>
      </div>
      <a href="${loginUrl}" class="cta-button">Access Ambassador Dashboard</a>
      <div class="support-section">
        <p class="support-text">Need assistance? Contact us at <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a></p>
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
  ${trackingPixel}
</body>
</html>`;
}

const APPROVAL_EMAIL_SUBJECT = 'Welcome to Andiamo Events - Ambassador Approved';
const APPROVAL_EMAIL_FROM = '"Andiamo Events" <contact@andiamoevents.com>';

module.exports = {
  buildAmbassadorApprovalEmailHtml,
  APPROVAL_EMAIL_SUBJECT,
  APPROVAL_EMAIL_FROM,
};
