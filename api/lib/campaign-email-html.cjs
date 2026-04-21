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
      background: #EAF2FF !important;
      background-color: #EAF2FF !important;
      background-image: linear-gradient(#EAF2FF, #EAF2FF) !important;
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
      background: #EAF2FF !important;
      background-color: #EAF2FF !important;
      background-image: linear-gradient(#EAF2FF, #EAF2FF) !important;
    }
    /* Table cell + linear-gradient: Gmail/iOS dark mode often strips div/bgcolor; gradient + bgcolor survives more reliably. */
    .campaign-card-pad { padding: 0 20px 30px !important; }
    .content-card {
      background: #0000FF !important;
      background-color: #0000FF !important;
      background-image: linear-gradient(#0000FF, #0000FF) !important;
      border-radius: 12px;
      padding: 36px 28px;
      border: 1px solid rgba(255, 255, 255, 0.45) !important;
      color: #F0F4FF !important;
    }
    .content-card table,
    .content-card td {
      background-color: transparent !important;
      background-image: none !important;
    }
    .title-section { margin-bottom: 28px; padding-bottom: 20px; text-align: center; border-bottom: 1px solid rgba(255, 255, 255, 0.35); }
    .title { font-size: 22px; margin: 0 0 8px 0; text-align: center; color: #FFFFFE !important; }
    .subtitle { font-size: 15px; text-align: center; color: #C7D2FE !important; }
    .message-content { font-size: 16px; color: #F0F4FF !important; margin-bottom: 20px; line-height: 1.7; }
    .support-section {
      margin: 28px 0;
      background: #E2ECFF !important;
      background-color: #E2ECFF !important;
      border-left: 3px solid rgba(226, 24, 54, 0.3);
      border-radius: 6px;
      padding: 18px 20px;
    }
    .support-text { font-size: 14px; color: #555555 !important; line-height: 1.7; }
    .support-email { color: #E21836 !important; text-decoration: none; font-weight: 500; }
    .closing-section { margin: 36px 0 0; padding-top: 28px; border-top: 1px solid rgba(255, 255, 255, 0.35); text-align: center; }
    .slogan { font-size: 22px; margin: 0 0 20px 0; color: #FCA5A5 !important; font-style: italic; font-weight: 300; }
    .signature { color: #C7D2FE !important; font-size: 16px; line-height: 1.7; }
    .footer {
      margin-top: 18px;
      padding: 20px 20px 26px;
      text-align: center;
      border-top: 1px solid rgba(255, 255, 255, 0.35);
      background: #0000FF !important;
      background-color: #0000FF !important;
      background-image: linear-gradient(#0000FF, #0000FF) !important;
    }
    .footer-text {
      font-size: 12px;
      color: #C7D2FE !important;
      margin-bottom: 10px;
      line-height: 1.6;
    }
    .footer-links {
      margin: 8px auto 0;
      text-align: center;
    }
    .footer-link {
      color: #C7D2FE !important;
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
      color: #F0F4FF !important;
    }
    .content-card .support-section,
    .content-card .support-section p,
    .content-card .support-text {
      color: #374151 !important;
    }
    table,
    td {
      background-color: #EAF2FF !important;
      background-image: linear-gradient(#EAF2FF, #EAF2FF) !important;
    }
    /* Strongly prefer fixed colors in clients that try dark-mode overrides. */
    [data-ogsc] body, [data-ogsb] body,
    [data-ogsc] .email-wrapper, [data-ogsb] .email-wrapper {
      background: #EAF2FF !important;
      background-color: #EAF2FF !important;
      background-image: linear-gradient(#EAF2FF, #EAF2FF) !important;
      color: #111111 !important;
    }
    [data-ogsc] .email-wrapper, [data-ogsb] .email-wrapper {
      background: #EAF2FF !important;
      background-color: #EAF2FF !important;
    }
    [data-ogsc] .content-card, [data-ogsb] .content-card,
    [data-ogsc] .footer, [data-ogsb] .footer {
      background: #0000FF !important;
      background-color: #0000FF !important;
      background-image: linear-gradient(#0000FF, #0000FF) !important;
      border-color: rgba(255, 255, 255, 0.45) !important;
      color: #F0F4FF !important;
    }
    [data-ogsc] .support-section, [data-ogsb] .support-section {
      background: #E2ECFF !important;
      background-color: #E2ECFF !important;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #EAF2FF !important;
        background-color: #EAF2FF !important;
        background-image: linear-gradient(#EAF2FF, #EAF2FF) !important;
        color: #111111 !important;
      }
      .email-wrapper {
        background: #EAF2FF !important;
        background-color: #EAF2FF !important;
        background-image: linear-gradient(#EAF2FF, #EAF2FF) !important;
      }
      .content-card, .footer {
        background: #0000FF !important;
        background-color: #0000FF !important;
        background-image: linear-gradient(#0000FF, #0000FF) !important;
        border-color: rgba(255, 255, 255, 0.45) !important;
      }
      .content-card table, .content-card td { background-color: transparent !important; }
      .title { color: #FFFFFE !important; }
      .subtitle { color: #C7D2FE !important; }
      .message-content { color: #F0F4FF !important; }
      table, td {
        background-color: #EAF2FF !important;
        background-image: linear-gradient(#EAF2FF, #EAF2FF) !important;
      }
      div, p, section { color: #111111 !important; }
      .content-card div, .content-card p, .content-card section { color: #F0F4FF !important; }
      .support-section { background: #E2ECFF !important; background-color: #E2ECFF !important; }
      .content-card .support-section, .content-card .support-section p, .content-card .support-text { color: #374151 !important; }
      .signature { color: #C7D2FE !important; }
      .footer-text, .footer-link { color: #C7D2FE !important; }
      .slogan { color: #FCA5A5 !important; }
      a, .support-email { color: #E21836 !important; }
    }
    @media only screen and (max-width: 600px) {
      .campaign-card-pad { padding: 0 12px 20px !important; }
      .content-card { padding: 28px 20px !important; }
    }
  </style>
</head>
<body
  bgcolor="#EAF2FF"
  style="margin:0;padding:0;background:#EAF2FF !important;background-color:#EAF2FF !important;background-image:linear-gradient(#EAF2FF,#EAF2FF) !important;color:#111111 !important;color-scheme:light !important;forced-color-adjust:none;-webkit-text-size-adjust:100%;"
>
  ${emailLogoHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EAF2FF" style="background:#EAF2FF !important;background-color:#EAF2FF !important;background-image:linear-gradient(#EAF2FF,#EAF2FF) !important;">
    <tr>
      <td align="center" bgcolor="#EAF2FF" style="padding:0;background:#EAF2FF !important;background-color:#EAF2FF !important;background-image:linear-gradient(#EAF2FF,#EAF2FF) !important;">
  <div class="email-wrapper" bgcolor="#EAF2FF" style="background:#EAF2FF !important;background-color:#EAF2FF !important;background-image:linear-gradient(#EAF2FF,#EAF2FF) !important;padding:0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;border:0;border-collapse:collapse;">
      <tr>
        <td class="campaign-card-pad" style="padding:0 20px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0000FF" style="margin:0;border-collapse:separate;border:0;background:#0000FF !important;background-color:#0000FF !important;background-image:linear-gradient(#0000FF,#0000FF) !important;">
            <tr>
              <td class="content-card" bgcolor="#0000FF" style="background:#0000FF !important;background-color:#0000FF !important;background-image:linear-gradient(#0000FF,#0000FF) !important;border:1px solid rgba(255,255,255,0.45);border-radius:12px;padding:36px 28px;color:#F0F4FF !important;">
      <div class="title-section" style="text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.35);">
        <p class="title" style="margin:0 0 8px;font-size:22px;font-weight:600;color:#FFFFFE !important;">Andiamo Events</p>
        <p class="subtitle" style="margin:0;font-size:15px;color:#C7D2FE !important;">${emailSubject.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
      ${headerImageBlock}
      <div class="message-content" style="font-size:16px;line-height:1.7;color:#F0F4FF !important;">${content}</div>
      ${ctaBlock}
      <div
        class="support-section"
        bgcolor="#E2ECFF"
        style="margin-top:28px;border-left:3px solid rgba(226,24,54,0.3);border-radius:6px;background:#E2ECFF !important;background-color:#E2ECFF !important;padding:20px 18px;"
      >
        <p class="support-text" style="margin:0;font-size:14px;line-height:1.7;color:#4b5563 !important;">Need assistance? Contact us at <a href="mailto:Contact@andiamoevents.com" class="support-email" style="color:#E21836 !important;font-weight:500;text-decoration:none;">Contact@andiamoevents.com</a> or in our Instagram page <a href="https://www.instagram.com/andiamo.events/" target="_blank" rel="noopener noreferrer" class="support-email" style="color:#E21836 !important;font-weight:500;text-decoration:none;">@andiamo.events</a> or contact with <a href="tel:28070128" class="support-email" style="color:#E21836 !important;font-weight:500;text-decoration:none;">28070128</a>.</p>
      </div>
      <div class="closing-section" style="margin:36px 0 0;padding-top:28px;border-top:1px solid rgba(255,255,255,0.35);text-align:center;">
        <p class="slogan" style="margin:0 0 20px;font-size:22px;font-style:italic;font-weight:300;color:#FCA5A5 !important;">We Create Memories</p>
        <p class="signature" style="margin:0;font-size:16px;line-height:1.7;color:#C7D2FE !important;">Best regards,<br>The Andiamo Events Team</p>
      </div>
      <div class="footer" style="margin-top:28px;padding:22px 14px 18px;text-align:center;border-top:1px solid rgba(255,255,255,0.35);background:#0000FF !important;background-color:#0000FF !important;background-image:linear-gradient(#0000FF,#0000FF) !important;">
        <p class="footer-text" style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#C7D2FE !important;">Developed by <span style="color: #FCA5A5 !important;">Malek Ben Amor</span></p>
        <div class="footer-links" style="margin:8px auto 0;text-align:center;">
          <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" rel="noopener noreferrer" class="footer-link" style="color:#C7D2FE !important;text-decoration:none;font-size:13px;margin:0 8px;">Instagram</a>
          <span style="color: #C7D2FE !important;">&bull;</span>
          <a href="https://malekbenamor.dev/" target="_blank" rel="noopener noreferrer" class="footer-link" style="color:#C7D2FE !important;text-decoration:none;font-size:13px;margin:0 8px;">Website</a>
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
