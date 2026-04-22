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
  const li = (
    process.env.INVESTOR_EMAIL_SOCIAL_LINKEDIN || 'https://www.linkedin.com/company/andiamoevents/'
  ).trim();
  const ig = (
    process.env.INVESTOR_EMAIL_SOCIAL_INSTAGRAM || 'https://www.instagram.com/andiamo.events/'
  ).trim();
  const web = (process.env.INVESTOR_EMAIL_SOCIAL_WEB || 'https://www.andiamoevents.com/').trim();
  return { instagram: ig, linkedin: li, web };
}

function investorSocialIconSrc(filename) {
  const origin = getPublicSiteOrigin().replace(/\/$/, '');
  return `${origin}/email-assets/${filename}`;
}

/**
 * Institutional investor email — table layout, inline styles (no Tailwind/JS in clients).
 * Styling kept calm (system fonts, minimal “marketing” patterns) to reduce Gmail Promotions signals.
 */
function buildInvestorVanguardEmailHtml(opts) {
  const subjectRaw = String(opts.subject || '').trim();
  const subject = subjectRaw || 'Andiamo Events';
  const bodyHtml = esc(String(opts.body || '')).replace(/\n/g, '<br>');
  const safeHeader = normalizeMarketingHeaderImageUrl(opts.headerImageUrl);
  const safeCta = normalizeMarketingHeaderImageUrl(opts.ctaUrl);
  const ctaLabel = safeCta ? sanitizeCampaignCtaLabel(opts.ctaLabel, 'Learn more') : '';
  const year = new Date().getUTCFullYear();
  const { instagram, linkedin, web } = investorFooterSocialUrls();
  const logoBlackUrl = normalizeMarketingHeaderImageUrl(getEmailLogoBlackUrl());
  const iconLi = investorSocialIconSrc('social-linkedin.svg');
  const iconIg = investorSocialIconSrc('social-instagram.svg');
  const iconWeb = investorSocialIconSrc('social-web.svg');
  const devUrl = (process.env.INVESTOR_EMAIL_DEV_URL || 'https://malekbenamor.dev').trim();
  const devName = (process.env.INVESTOR_EMAIL_DEV_NAME || 'Malek Ben Amor').trim();

  const logoBlock = logoBlackUrl
    ? `<tr><td align="center" style="padding:28px 40px 20px 40px;">
  <img src="${escapeAttr(logoBlackUrl)}" alt="Andiamo Events" width="200" style="max-width:200px;height:auto;display:block;margin:0 auto;border:0;" />
</td></tr>`
    : `<tr><td align="center" style="padding:28px 40px 20px 40px;">
  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:600;color:#18181b;">Andiamo Events</p>
</td></tr>`;

  const heroBlock = safeHeader
    ? `<tr><td style="padding:20px 40px 0 40px;">
  <img src="${escapeAttr(safeHeader)}" alt="" width="520" style="max-width:100%;height:auto;display:block;border-radius:8px;border:1px solid #e4e4e7;" />
</td></tr>`
    : '';

  const ctaRow = safeCta
    ? `<tr><td style="padding:28px 40px 0 40px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
    <td style="border-radius:4px;background-color:#18181b;">
      <a href="${escapeAttr(safeCta)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#fafafa !important;text-decoration:none;border-radius:4px;">${esc(ctaLabel)}</a>
    </td>
  </tr></table>
</td></tr>`
    : '';

  const socialRow = `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">
  <tr>
    <td style="padding:0 12px;"><a href="${escapeAttr(linkedin)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><img src="${escapeAttr(iconLi)}" alt="LinkedIn" width="28" height="28" style="display:block;border:0;" /></a></td>
    <td style="padding:0 12px;"><a href="${escapeAttr(instagram)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><img src="${escapeAttr(iconIg)}" alt="Instagram" width="28" height="28" style="display:block;border:0;" /></a></td>
    <td style="padding:0 12px;"><a href="${escapeAttr(web)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;"><img src="${escapeAttr(iconWeb)}" alt="Website" width="28" height="28" style="display:block;border:0;" /></a></td>
  </tr>
</table>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light only">
  <meta name="x-apple-disable-message-reformatting">
  <title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f5;">
    <tr><td align="center" style="padding:32px 16px 48px 16px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden;">
        <tr><td style="height:4px;line-height:4px;background-color:#09090b;font-size:0;">&nbsp;</td></tr>
        ${logoBlock}
        <tr><td style="padding:0 40px;"><div style="height:1px;background-color:#e4e4e7;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
        ${heroBlock}
        <tr><td style="padding:36px 40px 12px 40px;font-family:Arial,Helvetica,sans-serif;">
          <h1 style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;font-weight:600;color:#09090b;">
            ${esc(subject)}
          </h1>
          <div style="margin:0;font-size:16px;line-height:1.65;color:#3f3f46;">${bodyHtml}</div>
        </td></tr>
        ${ctaRow}
        <tr><td style="padding:28px 40px 32px 40px;font-family:Arial,Helvetica,sans-serif;">
          <p style="margin:0;font-size:14px;line-height:1.65;color:#52525b;">
            <a href="mailto:contact@andiamoevents.com" style="color:#09090b;text-decoration:underline;">contact@andiamoevents.com</a>
            <span style="color:#a1a1aa;"> · </span>
            <a href="tel:+21628070128" style="color:#09090b;text-decoration:underline;">+216&nbsp;28&nbsp;070&nbsp;128</a>
          </p>
        </td></tr>
        <tr><td align="center" style="padding:32px 40px 28px 40px;background-color:#09090b;">
          ${socialRow}
          <p style="margin:20px 0 0 0;font-size:11px;line-height:1.5;color:#737373;font-family:Arial,Helvetica,sans-serif;">
            © ${year} Andiamo Events
          </p>
          <p style="margin:14px 0 0 0;font-size:11px;line-height:1.5;color:#525252;font-family:Arial,Helvetica,sans-serif;">
            Developed by <a href="${escapeAttr(devUrl)}" target="_blank" rel="noopener noreferrer" style="color:#a3a3a3;text-decoration:underline;">${esc(devName)}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildInvestorVanguardEmailPlainText(subject, body, ctaUrl = null, ctaLabel = null) {
  const subj = String(subject || '').trim() || 'Andiamo Events';
  const safeCta = normalizeMarketingHeaderImageUrl(ctaUrl);
  const safeLabel = safeCta ? sanitizeCampaignCtaLabel(ctaLabel, 'Learn more') : '';
  const { instagram, linkedin, web } = investorFooterSocialUrls();
  const devUrl = (process.env.INVESTOR_EMAIL_DEV_URL || 'https://malekbenamor.dev').trim();
  const devName = (process.env.INVESTOR_EMAIL_DEV_NAME || 'Malek Ben Amor').trim();
  const lines = [subj, '', String(body || '').trim(), ''];
  if (safeCta) lines.push(`${safeLabel}: ${safeCta}`, '');
  lines.push(
    `contact@andiamoevents.com · +216 28 070 128`,
    `LinkedIn: ${linkedin}`,
    `Instagram: ${instagram}`,
    `Web: ${web}`,
    '',
    `Developed by ${devName}: ${devUrl}`
  );
  return lines.join('\n');
}

module.exports = {
  buildInvestorVanguardEmailHtml,
  buildInvestorVanguardEmailPlainText,
};
