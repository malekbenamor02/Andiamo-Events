'use strict';

const { emailLogoHeaderHtml } = require('./email-branding.cjs');

function escapeHtmlAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

/** Accept only http(s) URLs for campaign header images and CTA links */
function normalizeMarketingHeaderImageUrl(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const u = raw.trim();
  if (u.length < 8 || u.length > 2048) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function sanitizeCampaignCtaLabel(raw, fallback = 'Book now') {
  const t = String(raw == null ? '' : raw).trim().slice(0, 120).replace(/[<>]/g, '');
  return t || fallback;
}

// Official campaign email template — structured for readability; lighter promo signals than heavy “deal” layouts (Primary vs Promotions is decided by Gmail).
function buildCampaignEmailHtml(subject, body, recipientDisplay = 'Subscriber', headerImageUrl = null, ctaUrl = null, ctaLabel = null) {
  const content = String(body || '').replace(/\n/g, '<br>');
  const emailSubject = subject || 'Newsletter Update';
  const safeHeaderUrl = normalizeMarketingHeaderImageUrl(headerImageUrl);
  const headerImageBlock = safeHeaderUrl
    ? `<div class="campaign-header-image" style="text-align:center;margin:0 0 28px;">
  <img src="${escapeHtmlAttr(safeHeaderUrl)}" alt="" width="520" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;border:0;outline:none;" />
</div>`
    : '';
  const safeCtaUrl = normalizeMarketingHeaderImageUrl(ctaUrl);
  const safeCtaLabel = safeCtaUrl ? sanitizeCampaignCtaLabel(ctaLabel, 'Book now') : '';
  const ctaBlock = safeCtaUrl
    ? `<div style="text-align:center;margin:28px 0 8px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;border-collapse:separate;">
    <tr>
      <td style="border-radius:10px;background-color:#E21836;mso-padding-alt:14px 32px;">
        <a href="${escapeHtmlAttr(safeCtaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.25;color:#ffffff !important;text-decoration:none;border-radius:10px;mso-line-height-rule:exactly;">${escapeHtmlAttr(safeCtaLabel)}</a>
      </td>
    </tr>
  </table>
</div>`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1A1A1A; background: #FFFFFF; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
    a { color: #E21836; text-decoration: underline; }
    .email-wrapper { max-width: 600px; margin: 0 auto; background: #FFFFFF; }
    .content-card { margin: 0 20px 30px; padding: 36px 28px; border: 1px solid #e8e8e8; border-radius: 8px; }
    .title-section { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #eee; text-align: center; }
    .title { font-size: 22px; font-weight: 600; color: #1A1A1A; margin: 0 0 8px 0; text-align: center; }
    .subtitle { font-size: 15px; color: #555; margin: 0; font-weight: 400; text-align: center; }
    .message-content { font-size: 16px; color: #333; margin-bottom: 20px; line-height: 1.7; }
    .support-section { background: #E8E8E8; border-left: 3px solid rgba(226,24,54,0.3); padding: 20px 25px; margin: 28px 0; border-radius: 4px; }
    .support-text { font-size: 14px; color: #666666; line-height: 1.7; margin: 0; }
    .support-email { color: #E21836 !important; text-decoration: none; font-weight: 500; }
    .closing-section { text-align: center; margin: 36px 0 0; padding-top: 28px; border-top: 1px solid #eee; }
    .slogan { font-size: 22px; font-style: italic; color: #E21836; font-weight: 300; margin: 0 0 20px 0; }
    .signature { font-size: 16px; color: #666666; line-height: 1.7; margin: 0; }
    .footer { margin-top: 50px; padding: 40px 20px 30px; text-align: center; border-top: 1px solid rgba(0,0,0,0.1); }
    .footer-text { font-size: 12px; color: #999999; margin-bottom: 20px; line-height: 1.6; }
    .footer-links { margin: 15px auto 0; text-align: center; }
    .footer-link { color: #999999; text-decoration: none; font-size: 13px; margin: 0 8px; }
    .footer-link:hover { color: #E21836 !important; }
    @media only screen and (max-width: 600px) { .content-card { margin: 0 12px 20px; padding: 28px 20px; } }
  </style>
</head>
<body>
  ${emailLogoHeaderHtml()}
  <div class="email-wrapper">
    <div class="content-card">
      <div class="title-section">
        <p class="title">Andiamo Events</p>
        <p class="subtitle">${emailSubject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
      ${headerImageBlock}
      <div class="message-content">${content}</div>
      ${ctaBlock}
      <div class="support-section">
        <p class="support-text">Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a> or in our Instagram page <a href="https://www.instagram.com/andiamo.events/" target="_blank" rel="noopener noreferrer" class="support-email">@andiamo.events</a> or contact with <a href="tel:28070128" class="support-email">28070128</a>.</p>
      </div>
      <div class="closing-section">
        <p class="slogan">We Create Memories</p>
        <p class="signature">Best regards,<br>The Andiamo Events Team</p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">You&apos;re receiving this email from Andiamo Events.<br />To stop these updates, reply to this message or email <a href="mailto:support@andiamoevents.com" class="support-email">support@andiamoevents.com</a>.</p>
      <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
      <div class="footer-links">
        <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" rel="noopener noreferrer" class="footer-link">Instagram</a>
        <span style="color: #999999;">&bull;</span>
        <a href="https://malekbenamor.dev/" target="_blank" rel="noopener noreferrer" class="footer-link">Website</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  escapeHtmlAttr,
  normalizeMarketingHeaderImageUrl,
  sanitizeCampaignCtaLabel,
  buildCampaignEmailHtml,
};
