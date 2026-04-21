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
  const emailSubject = subject || 'Update from Andiamo Events';
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
      <td style="border-radius:10px;background:#E21836 !important;background-color:#E21836 !important;mso-padding-alt:14px 32px;">
        <a href="${escapeHtmlAttr(safeCtaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.25;color:#FFFFFE !important;text-decoration:none;border-radius:10px;mso-line-height-rule:exactly;">${escapeHtmlAttr(safeCtaLabel)}</a>
      </td>
    </tr>
  </table>
</div>`
    : '';
  return `<!DOCTYPE html>
<!-- andiamo:campaign-email -->
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" style="color-scheme:light only;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light">
  <meta name="x-apple-disable-message-reformatting">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #111111 !important;
      background: #fcfcfc !important;
      background-color: #fcfcfc !important;
      background-image: linear-gradient(#fcfcfc, #fcfcfc) !important;
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
      background: #fcfcfc !important;
      background-color: #fcfcfc !important;
      background-image: linear-gradient(#fcfcfc, #fcfcfc) !important;
    }
    /* Table cell + linear-gradient: Gmail/iOS dark mode often strips div/bgcolor; gradient + bgcolor survives more reliably. */
    .campaign-card-pad { padding: 0 20px 30px !important; }
    .content-card {
      background: #bbbbc4 !important;
      background-color: #bbbbc4 !important;
      background-image: linear-gradient(#bbbbc4, #bbbbc4) !important;
      border-radius: 12px;
      padding: 36px 28px;
      border: 1px solid rgba(0, 0, 0, 0.12) !important;
      color: #111111 !important;
    }
    .content-card table,
    .content-card td {
      background-color: transparent !important;
      background-image: none !important;
    }
    .title-section { margin-bottom: 28px; padding-bottom: 20px; text-align: center; border-bottom: 1px solid rgba(0, 0, 0, 0.12); }
    .title { font-size: 22px; margin: 0 0 8px 0; text-align: center; color: #111111 !important; }
    .subtitle { font-size: 15px; text-align: center; color: #555555 !important; }
    .message-content { font-size: 16px; color: #111111 !important; margin-bottom: 20px; line-height: 1.7; }
    .support-section {
      margin: 28px 0;
      background: #e8e9ed !important;
      background-color: #e8e9ed !important;
      border-left: 3px solid rgba(226, 24, 54, 0.3);
      border-radius: 6px;
      padding: 18px 20px;
    }
    .support-text { font-size: 14px; color: #555555 !important; line-height: 1.7; }
    .support-email { color: #E21836 !important; text-decoration: none; font-weight: 500; }
    .closing-section { margin: 36px 0 0; padding-top: 28px; border-top: 1px solid rgba(0, 0, 0, 0.12); text-align: center; }
    .slogan { font-size: 22px; margin: 0 0 20px 0; color: #E21836 !important; font-style: italic; font-weight: 300; }
    .signature { color: #555555 !important; font-size: 16px; line-height: 1.7; }
    .footer {
      margin-top: 18px;
      padding: 20px 20px 26px;
      text-align: center;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      background: #bbbbc4 !important;
      background-color: #bbbbc4 !important;
      background-image: linear-gradient(#bbbbc4, #bbbbc4) !important;
    }
    .footer-text {
      font-size: 12px;
      color: #555555 !important;
      margin-bottom: 10px;
      line-height: 1.6;
    }
    .footer-links {
      margin: 8px auto 0;
      text-align: center;
    }
    .footer-link {
      color: #555555 !important;
      text-decoration: none;
      font-size: 13px;
      margin: 0 8px;
    }
    table, td, div, p, section {
      color: #111111 !important;
    }
    .content-card div,
    .content-card p,
    .content-card section {
      color: #111111 !important;
    }
    .content-card .support-section,
    .content-card .support-section p,
    .content-card .support-text {
      color: #374151 !important;
    }
    table,
    td {
      background-color: #fcfcfc !important;
      background-image: linear-gradient(#fcfcfc, #fcfcfc) !important;
    }
    /* Strongly prefer fixed colors in clients that try dark-mode overrides. */
    [data-ogsc] body, [data-ogsb] body,
    [data-ogsc] .email-wrapper, [data-ogsb] .email-wrapper {
      background: #fcfcfc !important;
      background-color: #fcfcfc !important;
      background-image: linear-gradient(#fcfcfc, #fcfcfc) !important;
      color: #111111 !important;
    }
    [data-ogsc] .email-wrapper, [data-ogsb] .email-wrapper {
      background: #fcfcfc !important;
      background-color: #fcfcfc !important;
    }
    [data-ogsc] .content-card, [data-ogsb] .content-card,
    [data-ogsc] .footer, [data-ogsb] .footer {
      background: #bbbbc4 !important;
      background-color: #bbbbc4 !important;
      background-image: linear-gradient(#bbbbc4, #bbbbc4) !important;
      border-color: rgba(0, 0, 0, 0.12) !important;
      color: #111111 !important;
    }
    [data-ogsc] .support-section, [data-ogsb] .support-section {
      background: #e8e9ed !important;
      background-color: #e8e9ed !important;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #fcfcfc !important;
        background-color: #fcfcfc !important;
        background-image: linear-gradient(#fcfcfc, #fcfcfc) !important;
        color: #111111 !important;
      }
      .email-wrapper {
        background: #fcfcfc !important;
        background-color: #fcfcfc !important;
        background-image: linear-gradient(#fcfcfc, #fcfcfc) !important;
      }
      .content-card, .footer {
        background: #bbbbc4 !important;
        background-color: #bbbbc4 !important;
        background-image: linear-gradient(#bbbbc4, #bbbbc4) !important;
        border-color: rgba(0, 0, 0, 0.12) !important;
        color: #111111 !important;
      }
      .content-card table, .content-card td { background-color: transparent !important; }
      .title { color: #111111 !important; }
      .subtitle { color: #555555 !important; }
      .message-content { color: #111111 !important; }
      table, td {
        background-color: #fcfcfc !important;
        background-image: linear-gradient(#fcfcfc, #fcfcfc) !important;
      }
      div, p, section { color: #111111 !important; }
      .content-card div, .content-card p, .content-card section { color: #111111 !important; }
      .support-section { background: #e8e9ed !important; background-color: #e8e9ed !important; }
      .content-card .support-section, .content-card .support-section p, .content-card .support-text { color: #374151 !important; }
      .signature { color: #555555 !important; }
      .footer-text, .footer-link { color: #555555 !important; }
      .slogan { color: #E21836 !important; }
      a, .support-email { color: #E21836 !important; }
    }
    @media only screen and (max-width: 600px) {
      .campaign-card-pad { padding: 0 12px 20px !important; }
      .content-card { padding: 28px 20px !important; }
    }
  </style>
</head>
<body
  bgcolor="#fcfcfc"
  style="margin:0;padding:0;background:#fcfcfc !important;background-color:#fcfcfc !important;background-image:linear-gradient(#fcfcfc,#fcfcfc) !important;color:#111111 !important;color-scheme:light !important;forced-color-adjust:none;-webkit-text-size-adjust:100%;"
>
  ${emailLogoHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#fcfcfc" style="background:#fcfcfc !important;background-color:#fcfcfc !important;background-image:linear-gradient(#fcfcfc,#fcfcfc) !important;">
    <tr>
      <td align="center" bgcolor="#fcfcfc" style="padding:0;background:#fcfcfc !important;background-color:#fcfcfc !important;background-image:linear-gradient(#fcfcfc,#fcfcfc) !important;">
  <div class="email-wrapper" bgcolor="#fcfcfc" style="background:#fcfcfc !important;background-color:#fcfcfc !important;background-image:linear-gradient(#fcfcfc,#fcfcfc) !important;padding:0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;border:0;border-collapse:collapse;">
      <tr>
        <td class="campaign-card-pad" style="padding:0 20px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#bbbbc4" style="margin:0;border-collapse:separate;border:0;background:#bbbbc4 !important;background-color:#bbbbc4 !important;background-image:linear-gradient(#bbbbc4,#bbbbc4) !important;">
            <tr>
              <td class="content-card" bgcolor="#bbbbc4" style="background:#bbbbc4 !important;background-color:#bbbbc4 !important;background-image:linear-gradient(#bbbbc4,#bbbbc4) !important;border:1px solid rgba(0,0,0,0.12);border-radius:12px;padding:36px 28px;color:#111111 !important;">
      <div class="title-section" style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(0,0,0,0.12);">
        <p class="title" style="margin:0 0 8px;font-size:22px;font-weight:600;color:#111111 !important;">Andiamo Events</p>
        <p class="subtitle" style="margin:0;font-size:15px;color:#555555 !important;">${emailSubject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
      ${headerImageBlock}
      <div class="message-content" style="font-size:16px;line-height:1.7;color:#111111 !important;">${content}</div>
      ${ctaBlock}
      <div
        class="support-section"
        bgcolor="#e8e9ed"
        style="margin-top:28px;border-left:3px solid rgba(226,24,54,0.3);border-radius:6px;background:#e8e9ed !important;background-color:#e8e9ed !important;padding:20px 18px;"
      >
        <p class="support-text" style="margin:0;font-size:14px;line-height:1.7;color:#4b5563 !important;">Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email" style="color:#E21836 !important;font-weight:500;text-decoration:none;">Contact@andiamoevents.com</a> or in our Instagram page <a href="https://www.instagram.com/andiamo.events/" target="_blank" rel="noopener noreferrer" class="support-email" style="color:#E21836 !important;font-weight:500;text-decoration:none;">@andiamo.events</a> or contact with <a href="tel:28070128" class="support-email" style="color:#E21836 !important;font-weight:500;text-decoration:none;">28070128</a>.</p>
      </div>
      <div class="closing-section" style="margin:36px 0 0;padding-top:28px;border-top:1px solid rgba(0,0,0,0.12);text-align:center;">
        <p class="slogan" style="margin:0 0 20px;font-size:22px;font-style:italic;font-weight:300;color:#E21836 !important;">We Create Memories</p>
        <p class="signature" style="margin:0;font-size:16px;line-height:1.7;color:#555555 !important;">Best regards,<br>The Andiamo Events Team</p>
      </div>
      <div class="footer" style="margin-top:28px;padding:22px 14px 18px;text-align:center;border-top:1px solid rgba(0,0,0,0.12);background:#bbbbc4 !important;background-color:#bbbbc4 !important;background-image:linear-gradient(#bbbbc4,#bbbbc4) !important;">
        <p class="footer-text" style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#555555 !important;">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
        <div class="footer-links" style="margin:8px auto 0;text-align:center;">
          <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" rel="noopener noreferrer" class="footer-link" style="color:#555555 !important;text-decoration:none;font-size:13px;margin:0 8px;">Instagram</a>
          <span style="color: #555555 !important;">&bull;</span>
          <a href="https://malekbenamor.dev/" target="_blank" rel="noopener noreferrer" class="footer-link" style="color:#555555 !important;text-decoration:none;font-size:13px;margin:0 8px;">Website</a>
        </div>
      </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  escapeHtmlAttr,
  normalizeMarketingHeaderImageUrl,
  sanitizeCampaignCtaLabel,
  buildCampaignEmailHtml,
};
