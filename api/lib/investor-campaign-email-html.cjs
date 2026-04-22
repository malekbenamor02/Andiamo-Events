'use strict';

const { getPublicSiteOrigin, escapeAttr, getEmailLogoBlackUrl } = require('./email-branding.cjs');
const {
  normalizeMarketingHeaderImageUrl,
  sanitizeCampaignCtaLabel,
} = require('./campaign-email-html.cjs');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function investorFooterSocialUrls() {
  const ig = (process.env.INVESTOR_EMAIL_SOCIAL_INSTAGRAM || 'https://www.instagram.com/andiamo.events/').trim();
  const li = (process.env.INVESTOR_EMAIL_SOCIAL_LINKEDIN || `${getPublicSiteOrigin().replace(/\/$/, '')}/`).trim();
  const web = (process.env.INVESTOR_EMAIL_SOCIAL_WEB || `${getPublicSiteOrigin().replace(/\/$/, '')}/`).trim();
  return { instagram: ig, linkedin: li, web };
}

function signatureAvatarUrl() {
  const u = process.env.INVESTOR_EMAIL_SIGNATURE_IMAGE_URL;
  if (u != null && String(u).trim() !== '') return normalizeMarketingHeaderImageUrl(String(u).trim());
  return null;
}

/**
 * Institutional investor email — table layout, inline styles (no Tailwind/JS in clients).
 */
function buildInvestorVanguardEmailHtml(opts) {
  const subject = String(opts.subject || 'Update from Andiamo Events').trim() || 'Update from Andiamo Events';
  const bodyHtml = esc(String(opts.body || '')).replace(/\n/g, '<br>');
  const safeHeader = normalizeMarketingHeaderImageUrl(opts.headerImageUrl);
  const safeCta = normalizeMarketingHeaderImageUrl(opts.ctaUrl);
  const ctaLabel = safeCta ? sanitizeCampaignCtaLabel(opts.ctaLabel, 'Learn more') : '';
  const year = new Date().getUTCFullYear();
  const { instagram, linkedin, web } = investorFooterSocialUrls();
  const avatarUrl = signatureAvatarUrl();
  const logoBlackUrl = normalizeMarketingHeaderImageUrl(getEmailLogoBlackUrl());
  const logoBlock = logoBlackUrl
    ? `<tr><td align="center" style="padding:28px 40px 20px 40px;">
  <img src="${escapeAttr(logoBlackUrl)}" alt="Andiamo Events" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;border:0;" />
</td></tr>`
    : `<tr><td align="center" style="padding:28px 40px 20px 40px;">
  <p style="margin:0;font-family:'Cabinet Grotesk',Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.02em;text-transform:uppercase;color:#18181b;">Andiamo Events</p>
</td></tr>`;

  const heroBlock = safeHeader
    ? `<tr><td style="padding:20px 40px 0 40px;">
  <img src="${escapeAttr(safeHeader)}" alt="" width="520" style="max-width:100%;height:auto;display:block;border-radius:8px;border:1px solid #e4e4e7;" />
</td></tr>`
    : '';

  const ctaRow = safeCta
    ? `<tr><td style="padding:28px 40px 0 40px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
    <td style="border-radius:4px;background-color:#18181b;mso-padding-alt:16px 36px;">
      <a href="${escapeAttr(safeCta)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:16px 36px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#fafafa !important;text-decoration:none;border-radius:4px;">${esc(ctaLabel)}&nbsp;&nbsp;→</a>
    </td>
  </tr></table>
</td></tr>`
    : '';

  const avatarInner = avatarUrl
    ? `<img src="${escapeAttr(avatarUrl)}" alt="" width="48" height="48" style="display:block;width:48px;height:48px;border-radius:9999px;object-fit:cover;border:1px solid #f4f4f5;" />`
    : `<span style="display:block;width:48px;height:48px;border-radius:9999px;background-color:#e4e4e7;border:1px solid #f4f4f5;"></span>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="x-apple-disable-message-reformatting">
  <title>${esc(subject)}</title>
  <style type="text/css">
    @import url('https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,500,700&f[]=satoshi@400,500&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:32px 16px 48px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
        <tr><td style="height:4px;line-height:4px;background-color:#09090b;font-size:0;">&nbsp;</td></tr>
        ${logoBlock}
        <tr><td style="padding:0 40px;"><div style="height:1px;background-color:#e4e4e7;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
        ${heroBlock}
        <tr><td style="padding:36px 40px 12px 40px;font-family:'Satoshi',Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 20px 0;font-family:'Cabinet Grotesk',Arial,Helvetica,sans-serif;font-size:28px;line-height:1.12;font-weight:700;letter-spacing:-0.03em;color:#09090b;">
            ${esc(subject)}
          </h1>
          <p style="margin:0;font-size:17px;line-height:1.72;color:#3f3f46;">${bodyHtml}</p>
        </td></tr>
        ${ctaRow}
        <tr><td style="padding:28px 40px 36px 40px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fafafa;border:1px solid #e4e4e7;border-left:4px solid #09090b;border-radius:6px;">
            <tr><td style="padding:22px 26px;font-family:'Satoshi',Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 10px 0;font-family:'Cabinet Grotesk',Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#52525b;">Need assistance?</p>
              <p style="margin:0;font-size:14px;line-height:1.7;color:#52525b;">Contact us at <a href="mailto:Contact@andiamoevents.com" style="color:#09090b;font-weight:500;text-decoration:none;">Contact@andiamoevents.com</a> · Instagram <a href="${escapeAttr(instagram)}" style="color:#09090b;font-weight:500;text-decoration:none;">@andiamo.events</a> · <a href="tel:28070128" style="color:#09090b;font-weight:500;text-decoration:none;">28070128</a></p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 40px 40px 40px;border-top:1px solid #e4e4e7;">
          <p style="margin:28px 0 14px 0;font-size:13px;color:#71717a;font-family:'Satoshi',Arial,Helvetica,sans-serif;">Respectfully,</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="vertical-align:middle;padding-right:16px;">${avatarInner}</td>
            <td style="vertical-align:middle;font-family:'Cabinet Grotesk',Arial,Helvetica,sans-serif;">
              <p style="margin:0;font-size:16px;font-weight:700;color:#09090b;line-height:1.25;">Mouayed Chakir</p>
              <p style="margin:6px 0 0 0;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#a1a1aa;font-weight:600;">Co-founder</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td align="center" style="padding:36px 40px 40px 40px;background-color:#09090b;">
          <p style="margin:0 0 18px 0;font-family:'Satoshi',Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.06em;">
            <a href="${escapeAttr(linkedin)}" style="color:#d4d4d8;text-decoration:none;padding:0 8px;" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <span style="color:#525252;">·</span>
            <a href="${escapeAttr(instagram)}" style="color:#d4d4d8;text-decoration:none;padding:0 8px;" target="_blank" rel="noopener noreferrer">Instagram</a>
            <span style="color:#525252;">·</span>
            <a href="${escapeAttr(web)}" style="color:#d4d4d8;text-decoration:none;padding:0 8px;" target="_blank" rel="noopener noreferrer">Website</a>
          </p>
          <p style="margin:0;font-size:10px;line-height:1.65;letter-spacing:0.12em;text-transform:uppercase;color:#737373;font-family:'Satoshi',Arial,Helvetica,sans-serif;">
            © ${year} Andiamo Events — All rights reserved
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildInvestorVanguardEmailPlainText(subject, body, ctaUrl = null, ctaLabel = null) {
  const subj = String(subject || '').trim() || 'Update from Andiamo Events';
  const safeCta = normalizeMarketingHeaderImageUrl(ctaUrl);
  const safeLabel = safeCta ? sanitizeCampaignCtaLabel(ctaLabel, 'Learn more') : '';
  const lines = [subj, '', String(body || '').trim(), ''];
  if (safeCta) lines.push(`${safeLabel}: ${safeCta}`, '');
  lines.push(
    'Need assistance? Contact@andiamoevents.com — @andiamo.events — 28070128',
    getPublicSiteOrigin(),
    '',
    'Respectfully,',
    'Mouayed Chakir, Co-founder — Andiamo Events'
  );
  return lines.join('\n');
}

module.exports = {
  buildInvestorVanguardEmailHtml,
  buildInvestorVanguardEmailPlainText,
};
