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

function sanitizeCampaignCtaLabel(raw, fallback = 'View details') {
  const t = String(raw == null ? '' : raw).trim().slice(0, 120).replace(/[<>]/g, '');
  return t || fallback;
}

function sanitizeRecipientGreeting(raw) {
  const t = String(raw == null ? '' : raw)
    .trim()
    .slice(0, 80)
    .replace(/[<>]/g, '');
  return t || 'there';
}

function escapeHtmlText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Official campaign email — personal greeting, text-style links (no promo button), minimal footer (Gmail Primary vs Promotions is ML-based, not guaranteed).
function buildCampaignEmailHtml(subject, body, recipientDisplay = 'Subscriber', headerImageUrl = null, ctaUrl = null, ctaLabel = null) {
  const content = String(body || '').replace(/\n/g, '<br>');
  const emailSubject = subject || 'Update from Andiamo Events';
  const greetingName = escapeHtmlText(sanitizeRecipientGreeting(recipientDisplay));
  const safeHeaderUrl = normalizeMarketingHeaderImageUrl(headerImageUrl);
  const headerImageBlock = safeHeaderUrl
    ? `<div class="campaign-header-image" style="text-align:center;margin:0 0 28px;">
  <img src="${escapeHtmlAttr(safeHeaderUrl)}" alt="" width="520" style="max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;border:0;outline:none;" />
</div>`
    : '';
  const safeCtaUrl = normalizeMarketingHeaderImageUrl(ctaUrl);
  const safeCtaLabel = safeCtaUrl ? sanitizeCampaignCtaLabel(ctaLabel, 'View details') : '';
  const ctaBlock = safeCtaUrl
    ? `<p style="margin:24px 0 0;font-size:16px;line-height:1.7;color:#333333 !important;">
  <a href="${escapeHtmlAttr(safeCtaUrl)}" target="_blank" rel="noopener noreferrer" style="color:#1a1a1a !important;font-weight:600;text-decoration:underline;">${escapeHtmlAttr(safeCtaLabel)}</a>
</p>`
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
      color: #333333 !important;
      background: #f2f2f2 !important;
      background-color: #f2f2f2 !important;
      background-image: linear-gradient(#f2f2f2, #f2f2f2) !important;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    a {
      color: #E57373 !important;
      text-decoration: none;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      background: #f2f2f2 !important;
      background-color: #f2f2f2 !important;
      background-image: linear-gradient(#f2f2f2, #f2f2f2) !important;
    }
    /* Table cell + linear-gradient: Gmail/iOS dark mode often strips div/bgcolor; gradient + bgcolor survives more reliably. */
    .campaign-card-pad { padding: 0 20px 30px !important; }
    .content-card {
      background: #f4f4f4 !important;
      background-color: #f4f4f4 !important;
      background-image: linear-gradient(#f4f4f4, #f4f4f4) !important;
      border-radius: 12px;
      padding: 36px 28px;
      border: 1px solid #e5e5e5 !important;
      color: #333333 !important;
    }
    .content-card table,
    .content-card td {
      background-color: transparent !important;
      background-image: none !important;
    }
    .title-section { margin-bottom: 28px; padding-bottom: 20px; text-align: center; border-bottom: 1px solid #e0e0e0; }
    .title { font-size: 22px; margin: 0 0 8px 0; text-align: center; color: #1a1a1a !important; }
    .subtitle { font-size: 15px; text-align: center; color: #666666 !important; }
    .message-content { font-size: 16px; color: #333333 !important; margin-bottom: 20px; line-height: 1.7; }
    .support-section {
      margin: 28px 0;
      background: #fcf1f1 !important;
      background-color: #fcf1f1 !important;
      border-left: 3px solid #e57373;
      border-radius: 6px;
      padding: 18px 20px;
    }
    .support-text { font-size: 14px; color: #555555 !important; line-height: 1.7; }
    .support-email { color: #E57373 !important; text-decoration: none; font-weight: 500; }
    .closing-section { margin: 36px 0 0; padding-top: 28px; border-top: 1px solid #e0e0e0; text-align: center; }
    .slogan { font-size: 22px; margin: 0 0 20px 0; color: #E57373 !important; font-style: italic; font-weight: 300; }
    .signature { color: #666666 !important; font-size: 16px; line-height: 1.7; }
    .footer {
      margin-top: 18px;
      padding: 20px 20px 26px;
      text-align: center;
      border-top: 1px solid #e0e0e0;
      background: #f4f4f4 !important;
      background-color: #f4f4f4 !important;
      background-image: linear-gradient(#f4f4f4, #f4f4f4) !important;
    }
    .footer-text {
      font-size: 12px;
      color: #666666 !important;
      margin-bottom: 10px;
      line-height: 1.6;
    }
    .footer-links {
      margin: 8px auto 0;
      text-align: center;
    }
    .footer-link {
      color: #888888 !important;
      text-decoration: none;
      font-size: 13px;
      margin: 0 8px;
    }
    table, td, div, p, section {
      color: #333333 !important;
    }
    .content-card div,
    .content-card p,
    .content-card section {
      color: #333333 !important;
    }
    .content-card .support-section,
    .content-card .support-section p,
    .content-card .support-text {
      color: #374151 !important;
    }
    table,
    td {
      background-color: #f2f2f2 !important;
      background-image: linear-gradient(#f2f2f2, #f2f2f2) !important;
    }
    /* Strongly prefer fixed colors in clients that try dark-mode overrides. */
    [data-ogsc] body, [data-ogsb] body,
    [data-ogsc] .email-wrapper, [data-ogsb] .email-wrapper {
      background: #f2f2f2 !important;
      background-color: #f2f2f2 !important;
      background-image: linear-gradient(#f2f2f2, #f2f2f2) !important;
      color: #333333 !important;
    }
    [data-ogsc] .email-wrapper, [data-ogsb] .email-wrapper {
      background: #f2f2f2 !important;
      background-color: #f2f2f2 !important;
    }
    [data-ogsc] .content-card, [data-ogsb] .content-card,
    [data-ogsc] .footer, [data-ogsb] .footer {
      background: #f4f4f4 !important;
      background-color: #f4f4f4 !important;
      background-image: linear-gradient(#f4f4f4, #f4f4f4) !important;
      border-color: #e5e5e5 !important;
      color: #333333 !important;
    }
    [data-ogsc] .support-section, [data-ogsb] .support-section {
      background: #fcf1f1 !important;
      background-color: #fcf1f1 !important;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #f2f2f2 !important;
        background-color: #f2f2f2 !important;
        background-image: linear-gradient(#f2f2f2, #f2f2f2) !important;
        color: #333333 !important;
      }
      .email-wrapper {
        background: #f2f2f2 !important;
        background-color: #f2f2f2 !important;
        background-image: linear-gradient(#f2f2f2, #f2f2f2) !important;
      }
      .content-card, .footer {
        background: #f4f4f4 !important;
        background-color: #f4f4f4 !important;
        background-image: linear-gradient(#f4f4f4, #f4f4f4) !important;
        border-color: #e5e5e5 !important;
        color: #333333 !important;
      }
      .content-card table, .content-card td { background-color: transparent !important; }
      .title { color: #1a1a1a !important; }
      .subtitle { color: #666666 !important; }
      .message-content { color: #333333 !important; }
      table, td {
        background-color: #f2f2f2 !important;
        background-image: linear-gradient(#f2f2f2, #f2f2f2) !important;
      }
      div, p, section { color: #333333 !important; }
      .content-card div, .content-card p, .content-card section { color: #333333 !important; }
      .support-section { background: #fcf1f1 !important; background-color: #fcf1f1 !important; }
      .content-card .support-section, .content-card .support-section p, .content-card .support-text { color: #555555 !important; }
      .signature { color: #666666 !important; }
      .footer-text { color: #666666 !important; }
      .footer-link { color: #888888 !important; }
      .slogan { color: #E57373 !important; }
      a, .support-email { color: #E57373 !important; }
    }
    @media only screen and (max-width: 600px) {
      .campaign-card-pad { padding: 0 12px 20px !important; }
      .content-card { padding: 28px 20px !important; }
    }
  </style>
</head>
<body
  bgcolor="#f2f2f2"
  style="margin:0;padding:0;background:#f2f2f2 !important;background-color:#f2f2f2 !important;background-image:linear-gradient(#f2f2f2,#f2f2f2) !important;color:#333333 !important;color-scheme:light !important;forced-color-adjust:none;-webkit-text-size-adjust:100%;"
>
  ${emailLogoHeaderHtml()}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f2f2" style="background:#f2f2f2 !important;background-color:#f2f2f2 !important;background-image:linear-gradient(#f2f2f2,#f2f2f2) !important;">
    <tr>
      <td align="center" bgcolor="#f2f2f2" style="padding:0;background:#f2f2f2 !important;background-color:#f2f2f2 !important;background-image:linear-gradient(#f2f2f2,#f2f2f2) !important;">
  <div class="email-wrapper" bgcolor="#f2f2f2" style="background:#f2f2f2 !important;background-color:#f2f2f2 !important;background-image:linear-gradient(#f2f2f2,#f2f2f2) !important;padding:0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;border:0;border-collapse:collapse;">
      <tr>
        <td class="campaign-card-pad" style="padding:0 20px 30px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f4f4f4" style="margin:0;border-collapse:separate;border:0;background:#f4f4f4 !important;background-color:#f4f4f4 !important;background-image:linear-gradient(#f4f4f4,#f4f4f4) !important;">
            <tr>
              <td class="content-card" bgcolor="#f4f4f4" style="background:#f4f4f4 !important;background-color:#f4f4f4 !important;background-image:linear-gradient(#f4f4f4,#f4f4f4) !important;border:1px solid #e5e5e5;border-radius:12px;padding:36px 28px;color:#333333 !important;">
      <div class="title-section" style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e0e0e0;">
        <p class="title" style="margin:0 0 6px;font-size:20px;font-weight:600;color:#1a1a1a !important;">${escapeHtmlText(emailSubject)}</p>
        <p class="subtitle" style="margin:0;font-size:14px;color:#666666 !important;">Andiamo Events</p>
      </div>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#333333 !important;">Dear <strong>${greetingName}</strong>,</p>
      ${headerImageBlock}
      <div class="message-content" style="font-size:16px;line-height:1.7;color:#333333 !important;">${content}</div>
      ${ctaBlock}
      <div
        class="support-section"
        bgcolor="#fcf1f1"
        style="margin-top:28px;border-left:3px solid #e57373;border-radius:6px;background:#fcf1f1 !important;background-color:#fcf1f1 !important;padding:20px 18px;"
      >
        <p class="support-text" style="margin:0;font-size:14px;line-height:1.7;color:#555555 !important;">Questions? Reply to this email or write to <a href="mailto:contact@andiamoevents.com" class="support-email" style="color:#1a1a1a !important;font-weight:500;text-decoration:underline;">contact@andiamoevents.com</a>.</p>
      </div>
      <div class="closing-section" style="margin:28px 0 0;padding-top:20px;border-top:1px solid #e0e0e0;">
        <p class="signature" style="margin:0;font-size:15px;line-height:1.7;color:#666666 !important;">Best regards,<br>The Andiamo Events Team</p>
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
