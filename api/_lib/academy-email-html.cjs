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

function paymentSummaryRows(reg) {
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
  return rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;color:#aaa;">${escapeHtml(label)}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(value)}</td></tr>`
    )
    .join('');
}

function wrapAcademyEmail({ title, subtitle, bodyHtml }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(title)}</title>
  <style>${transactionalEmailDarkStylesCss()}</style>
</head>
<body>
  ${academyEmailLogoHeaderHtml()}
  <div class="email-wrapper">
    <div class="content-card">
      <div class="title-section">
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="subtitle">${escapeHtml(subtitle)}</p>
      </div>
      ${bodyHtml}
      <p style="margin-top:24px;color:#888;font-size:13px;">Andiamo Academy — Event Management Training</p>
    </div>
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
    <p style="color:#e0e0e0;line-height:1.6;">Hello ${escapeHtml(firstName)},</p>
    <p style="color:#ccc;line-height:1.6;margin-top:12px;">
      Your online payment has been successfully confirmed by our payment provider. Thank you for registering for Andiamo Academy.
    </p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">${paymentSummaryRows(reg)}</table>
    <p style="color:#aaa;font-size:14px;line-height:1.5;">
      Your registration is being finalized. You will receive a separate confirmation once your place is officially approved.
    </p>`;
  return {
    subject: `Andiamo Academy — Payment confirmed (${reg.registration_number})`,
    html: wrapAcademyEmail({ title, subtitle, bodyHtml: body }),
  };
}

/** RIB / D17 — proof received, pending admin validation */
function buildAcademyManualPaymentReceivedEmailHtml(reg) {
  const firstName = (reg.full_name || '').trim().split(/\s+/)[0] || 'there';
  const title = 'Registration received';
  const subtitle = 'Payment under review';
  const methodLabel = reg.payment_method === 'd17' ? 'D17' : 'Bank transfer (RIB)';
  const body = `
    <p style="color:#e0e0e0;line-height:1.6;">Hello ${escapeHtml(firstName)},</p>
    <p style="color:#ccc;line-height:1.6;margin-top:12px;">
      We have received your academy registration and your payment proof. Our team will review your payment as soon as possible and confirm your place.
    </p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">${paymentSummaryRows(reg)}</table>
    <p style="color:#aaa;font-size:14px;"><strong>Payment method:</strong> ${escapeHtml(methodLabel)}</p>
    <p style="color:#888;font-size:13px;margin-top:16px;line-height:1.5;">
      You do not need to take any further action for now. We will contact you by email once your payment has been validated.
    </p>`;
  return {
    subject: `Andiamo Academy — Registration received (${reg.registration_number})`,
    html: wrapAcademyEmail({ title, subtitle, bodyHtml: body }),
  };
}

/** Admin approved registration */
function buildAcademyApprovedEmailHtml(reg) {
  const firstName = (reg.full_name || '').trim().split(/\s+/)[0] || 'there';
  const title = 'Place confirmed';
  const subtitle = 'Andiamo Academy';
  const body = `
    <p style="color:#e0e0e0;line-height:1.6;">Hello ${escapeHtml(firstName)},</p>
    <p style="color:#ccc;line-height:1.6;margin-top:12px;">
      Great news — your payment has been validated and your place at Andiamo Academy is now confirmed. We look forward to seeing you at the training.
    </p>
    <table style="width:100%;margin:20px 0;border-collapse:collapse;">${paymentSummaryRows(reg)}</table>
    <p style="color:#aaa;font-size:14px;">
      Reference: <strong>${escapeHtml(reg.registration_number)}</strong>
    </p>`;
  return {
    subject: `Andiamo Academy — Your place is confirmed (${reg.registration_number})`,
    html: wrapAcademyEmail({ title, subtitle, bodyHtml: body }),
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
  buildAcademyOnlineConfirmedEmailHtml,
  buildAcademyManualPaymentReceivedEmailHtml,
  buildAcademyApprovedEmailHtml,
};
