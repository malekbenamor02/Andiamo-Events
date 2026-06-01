'use strict';

const {
  emailLogoHeaderHtml,
  transactionalEmailDarkStylesCss,
  transactionalOrderStyleSupportAndClosingHtml,
  transactionalOrderStyleDeveloperFooterHtml,
  transactionalOrderStylePlainTextFooterLines,
} = require('./email-branding.cjs');
const {
  normalizeMarketingHeaderImageUrl,
  sanitizeCampaignCtaLabel,
  escapeHtmlAttr,
} = require('./campaign-email-html.cjs');

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeRecipientName(raw) {
  const t = String(raw == null ? '' : raw)
    .trim()
    .slice(0, 80)
    .replace(/[<>]/g, '');
  return t || 'there';
}

function wrapTransactionalCampaignEmail({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(title)}</title>
  <style>${transactionalEmailDarkStylesCss()}</style>
</head>
<body>
  ${emailLogoHeaderHtml()}
  <div class="email-wrapper">
    <div class="content-card">
      <div class="title-section">
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="subtitle">Andiamo Events</p>
      </div>
      ${bodyHtml}
      ${transactionalOrderStyleSupportAndClosingHtml()}
    </div>
    ${transactionalOrderStyleDeveloperFooterHtml()}
  </div>
</body>
</html>`;
}

/**
 * Standard campaign email — dark transactional layout aligned with order/ticket mail.
 * @param {{ subject?: string, body?: string, ctaUrl?: string|null, ctaLabel?: string|null }} opts
 */
function buildTransactionalCampaignEmailHtml(opts) {
  const subject = String(opts.subject || '').trim() || 'Update from Andiamo Events';
  const bodyHtml = escapeHtml(String(opts.body || '')).replace(/\n/g, '<br>');
  const safeCtaUrl = normalizeMarketingHeaderImageUrl(opts.ctaUrl);
  const safeCtaLabel = safeCtaUrl ? sanitizeCampaignCtaLabel(opts.ctaLabel, 'Book now') : '';
  const ctaBlock = safeCtaUrl
    ? `<div style="text-align:center;margin:32px 0 8px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;border-collapse:separate;">
    <tr>
      <td style="border-radius:10px;background:#E21836;">
        <a href="${escapeHtmlAttr(safeCtaUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;line-height:1.25;color:#FFFFFF !important;text-decoration:none;border-radius:10px;">${escapeHtml(safeCtaLabel)}</a>
      </td>
    </tr>
  </table>
</div>`
    : '';

  const inner = `
    <div class="message">${bodyHtml}</div>
    ${ctaBlock}`;

  return wrapTransactionalCampaignEmail({ title: subject, bodyHtml: inner });
}

function buildTransactionalCampaignEmailPlainText(subject, body, _recipientName, ctaUrl = null, ctaLabel = null) {
  const emailSubject = subject || 'Update from Andiamo Events';
  const safeCtaUrl = normalizeMarketingHeaderImageUrl(ctaUrl);
  const safeCtaLabel = safeCtaUrl ? sanitizeCampaignCtaLabel(ctaLabel, 'Book now') : '';
  const lines = [emailSubject, '', String(body || '').trim(), ''];
  if (safeCtaUrl) {
    lines.push(`${safeCtaLabel}: ${safeCtaUrl}`, '');
  }
  lines.push(...transactionalOrderStylePlainTextFooterLines());
  return lines.join('\n');
}

module.exports = {
  buildTransactionalCampaignEmailHtml,
  buildTransactionalCampaignEmailPlainText,
  sanitizeRecipientName,
};
