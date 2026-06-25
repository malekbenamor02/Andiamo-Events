'use strict';

const {
  getPublicSiteOrigin,
  transactionalEmailDarkStylesCss,
  escapeAttr,
} = require('./email-branding.cjs');

const ACADEMY_LOGO_ASSET_PATH = '/assets/andiamo-academy-cropped.svg';

const FORMULA_LABELS = {
  essentielle: 'Essential',
  pro: 'Pro',
  premium: 'Premium',
};

function getAcademyEmailLogoUrl() {
  const override = process.env.ACADEMY_EMAIL_LOGO_URL;
  if (override != null && String(override).trim() !== '') {
    return String(override).trim();
  }
  const origin = getPublicSiteOrigin().replace(/\/$/, '');
  return `${origin}${ACADEMY_LOGO_ASSET_PATH}`;
}

function academyEmailLogoHeaderHtml() {
  const url = getAcademyEmailLogoUrl();
  return `
  <div style="text-align:center;padding:28px 20px 12px;background:#101010;">
    <img
      src="${escapeAttr(url)}"
      alt="Andiamo Academy"
      width="240"
      style="display:block;margin:0 auto;max-width:240px;width:100%;height:auto;border:0;outline:none;text-decoration:none;"
    />
  </div>`;
}

function fmtDt(n) {
  return `${Number(n).toFixed(2)} DT`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paymentSummaryBlockHtml(reg) {
  const formulaLabel = FORMULA_LABELS[reg.formule] || reg.formule;
  const rows = [
    ['Registration', reg.registration_number],
    ['Formula', formulaLabel],
    ['Base amount', fmtDt(reg.base_amount_dt)],
  ];
  if (Number(reg.discount_amount_dt) > 0) {
    rows.push(['Discount', `-${fmtDt(reg.discount_amount_dt)}`]);
  }
  if (Number(reg.fee_amount_dt) > 0) {
    rows.push(['Online processing fee', fmtDt(reg.fee_amount_dt)]);
  }
  rows.push(['Total', fmtDt(reg.total_amount_dt)]);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
      <div class="info-row">
        <div class="info-label">${escapeHtml(label)}</div>
        <div class="info-value">${escapeHtml(value)}</div>
      </div>`
    )
    .join('');

  return `<div class="order-info-block">${rowsHtml}</div>`;
}

function academyEmailClosingFooterHtml() {
  return `
      <div class="support-section">
        <p class="support-text">
          Need assistance? Contact us at
          <a href="mailto:Contact@andiamoevents.com" class="support-email">Contact@andiamoevents.com</a>.
        </p>
      </div>
      <div class="closing-section">
        <p class="slogan">We Create Memories</p>
        <p class="signature">
          Best regards,<br>
          The Andiamo Events Team
        </p>
      </div>
    </div>
    <div class="footer">
      <p class="footer-text">Developed by <span style="color: #E21836 !important;">Malek Ben Amor</span></p>
      <div class="footer-links">
        <a href="https://www.instagram.com/malekbenamor.dev/" target="_blank" class="footer-link">Instagram</a>
        <span style="color: #888888;">&bull;</span>
        <a href="https://malekbenamor.dev" target="_blank" class="footer-link">Website</a>
      </div>
    </div>`;
}

function academyPlainTextLines(reg, lines) {
  const formulaLabel = FORMULA_LABELS[reg.formule] || reg.formule;
  return [
    ...lines,
    '',
    `Registration: ${reg.registration_number}`,
    `Formula: ${formulaLabel}`,
    `Base amount: ${fmtDt(reg.base_amount_dt)}`,
    ...(Number(reg.discount_amount_dt) > 0 ? [`Discount: -${fmtDt(reg.discount_amount_dt)}`] : []),
    ...(Number(reg.fee_amount_dt) > 0 ? [`Online processing fee: ${fmtDt(reg.fee_amount_dt)}`] : []),
    `Total: ${fmtDt(reg.total_amount_dt)}`,
    '',
    'Need assistance? Contact@andiamoevents.com',
    '',
    'We Create Memories',
    'The Andiamo Events Team',
    '',
    'Developed by Malek Ben Amor',
    'https://malekbenamor.dev',
    'https://www.instagram.com/malekbenamor.dev/',
  ].join('\n');
}

function wrapAcademyEmail({ title, subtitle, bodyHtml, includeLogo = true }) {
  const logoHeader = includeLogo ? academyEmailLogoHeaderHtml() : '';
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
  ${logoHeader}
  <div class="email-wrapper">
    <div class="content-card">
      <div class="title-section">
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
      </div>
      ${bodyHtml}
      ${academyEmailClosingFooterHtml()}
  </div>
</body>
</html>`;
}

/** After gateway confirms online payment */
function buildAcademyOnlineConfirmedEmailHtml(reg) {
  const firstName = (reg.full_name || '').trim().split(/\s+/)[0] || 'there';
  const title = 'Payment confirmed';
  const subtitle = 'Andiamo Academy — Registration';
  const body = `
    <p class="greeting">Hello <strong>${escapeHtml(firstName)}</strong>,</p>
    <p class="message">
      Your online payment has been successfully confirmed. Your place at Andiamo Academy is now confirmed.
      We look forward to seeing you at the training.
    </p>
    ${paymentSummaryBlockHtml(reg)}`;
  const firstNamePlain = (reg.full_name || '').trim().split(/\s+/)[0] || 'there';
  return {
    subject: `Your Andiamo Academy payment is confirmed (${reg.registration_number})`,
    html: wrapAcademyEmail({ title, subtitle, bodyHtml: body }),
    text: academyPlainTextLines(reg, [
      `Hello ${firstNamePlain},`,
      '',
      'Your online payment has been successfully confirmed. Your place at Andiamo Academy is now confirmed.',
      'We look forward to seeing you at the training.',
    ]),
  };
}

/** RIB / D17 — proof received, pending admin validation */
function buildAcademyManualPaymentReceivedEmailHtml(reg) {
  const firstName = (reg.full_name || '').trim().split(/\s+/)[0] || 'there';
  const title = 'Registration received';
  const subtitle = 'Andiamo Academy — Registration';
  const methodLabel = reg.payment_method === 'd17' ? 'D17' : 'Bank transfer (RIB)';
  const body = `
    <p class="greeting">Hello <strong>${escapeHtml(firstName)}</strong>,</p>
    <p class="message">
      We have received your academy registration and your payment proof. Our team will review your payment
      as soon as possible and confirm your place.
    </p>
    ${paymentSummaryBlockHtml(reg)}
    <p class="message" style="font-size:14px;">
      <strong>Payment method:</strong> ${escapeHtml(methodLabel)}
    </p>
    <p class="message" style="font-size:13px;color:#888;">
      You do not need to take any further action for now. We will contact you by email once your payment has been validated.
    </p>`;
  const firstNamePlain = (reg.full_name || '').trim().split(/\s+/)[0] || 'there';
  return {
    subject: `Your Andiamo Academy registration is received (${reg.registration_number})`,
    html: wrapAcademyEmail({ title, subtitle, bodyHtml: body }),
    text: academyPlainTextLines(reg, [
      `Hello ${firstNamePlain},`,
      '',
      'We have received your academy registration and your payment proof. Our team will review your payment as soon as possible and confirm your place.',
      `Payment method: ${methodLabel}`,
      '',
      'You do not need to take any further action for now. We will email you once your payment has been validated.',
    ]),
  };
}

/** Admin approved registration */
function buildAcademyApprovedEmailHtml(reg) {
  const firstName = (reg.full_name || '').trim().split(/\s+/)[0] || 'there';
  const title = 'Place confirmed';
  const subtitle = 'Andiamo Academy';
  const body = `
    <p class="greeting">Hello <strong>${escapeHtml(firstName)}</strong>,</p>
    <p class="message">
      Your payment has been validated and your place at Andiamo Academy is now confirmed.
      We look forward to seeing you at the training.
    </p>
    ${paymentSummaryBlockHtml(reg)}`;
  const firstNamePlain = (reg.full_name || '').trim().split(/\s+/)[0] || 'there';
  return {
    subject: `Your Andiamo Academy place is confirmed (${reg.registration_number})`,
    html: wrapAcademyEmail({ title, subtitle, bodyHtml: body }),
    text: academyPlainTextLines(reg, [
      `Hello ${firstNamePlain},`,
      '',
      'Your payment has been validated and your place at Andiamo Academy is now confirmed.',
      'We look forward to seeing you at the training.',
    ]),
  };
}

const PREVIEW_FIXTURE = {
  id: '00000000-0000-4000-8000-000000000001',
  registration_number: 'ACA-00042',
  full_name: 'Amira Ben Salah',
  email: 'amira@example.com',
  phone: '+21655123456',
  formule: 'pro',
  payment_method: 'card',
  base_amount_dt: 1100,
  discount_amount_dt: 0,
  fee_amount_dt: 55,
  total_amount_dt: 1155,
  status: 'approved',
};

module.exports = {
  PREVIEW_FIXTURE,
  getAcademyEmailLogoUrl,
  academyEmailLogoHeaderHtml,
  wrapAcademyEmail,
  buildAcademyOnlineConfirmedEmailHtml,
  buildAcademyManualPaymentReceivedEmailHtml,
  buildAcademyApprovedEmailHtml,
};
