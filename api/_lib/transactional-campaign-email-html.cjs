'use strict';

const { emailLogoHeaderHtml, transactionalEmailDarkStylesCss } = require('./email-branding.cjs');
const {
  normalizeMarketingHeaderImageUrl,
  sanitizeCampaignCtaLabel,
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

function transactionalCampaignClosingFooterHtml() {
  return `
      <div class="support-section">
        <p class="support-text">
          Questions? Reply to this email or contact us at
          <a href="mailto:contact@andiamoevents.com" class="support-email">contact@andiamoevents.com</a>.
        </p>
      </div>
      <div class="closing-section">
        <p class="signature">
          Best regards,<br>
          The Andiamo Events Team
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
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
      ${transactionalCampaignClosingFooterHtml()}`;
}

/**
 * Standard campaign email — same dark transactional layout as order/ticket mail.
 * @param {{ subject?: string, body?: string, recipientName?: string, ctaUrl?: string|null, ctaLabel?: string|null }} opts
 */
function buildTransactionalCampaignEmailHtml(opts) {
  const subject = String(opts.subject || '').trim() || 'Update from Andiamo Events';
  const recipientName = sanitizeRecipientName(opts.recipientName);
  const bodyHtml = escapeHtml(String(opts.body || '')).replace(/\n/g, '<br>');
  const safeCtaUrl = normalizeMarketingHeaderImageUrl(opts.ctaUrl);
  const safeCtaLabel = safeCtaUrl ? sanitizeCampaignCtaLabel(opts.ctaLabel, 'View details') : '';
  const ctaBlock = safeCtaUrl
    ? `<p class="message" style="margin-top:24px;">
  <a href="${escapeHtml(safeCtaUrl)}" target="_blank" rel="noopener noreferrer" style="color:#E21836 !important;font-weight:600;text-decoration:underline;">${escapeHtml(safeCtaLabel)}</a>
</p>`
    : '';

  const inner = `
    <p class="greeting">Dear <strong>${escapeHtml(recipientName)}</strong>,</p>
    <div class="message">${bodyHtml}</div>
    ${ctaBlock}`;

  return wrapTransactionalCampaignEmail({ title: subject, bodyHtml: inner });
}

function buildTransactionalCampaignEmailPlainText(subject, body, recipientName = 'there', ctaUrl = null, ctaLabel = null) {
  const emailSubject = subject || 'Update from Andiamo Events';
  const name = sanitizeRecipientName(recipientName);
  const safeCtaUrl = normalizeMarketingHeaderImageUrl(ctaUrl);
  const safeCtaLabel = safeCtaUrl ? sanitizeCampaignCtaLabel(ctaLabel, 'View details') : '';
  const lines = [emailSubject, '', `Dear ${name},`, '', String(body || '').trim(), ''];
  if (safeCtaUrl) {
    lines.push(`${safeCtaLabel}: ${safeCtaUrl}`, '');
  }
  lines.push(
    'Questions? Reply to this email or contact@andiamoevents.com',
    '',
    'Best regards,',
    'The Andiamo Events Team'
  );
  return lines.join('\n');
}

module.exports = {
  buildTransactionalCampaignEmailHtml,
  buildTransactionalCampaignEmailPlainText,
  sanitizeRecipientName,
};
