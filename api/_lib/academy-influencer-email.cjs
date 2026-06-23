'use strict';

const { getPublicSiteOrigin, escapeAttr } = require('./email-branding.cjs');
const { wrapAcademyEmail } = require('./academy-email-html.cjs');

const SUPPORT_EMAIL = 'contact@andiamoevents.com';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function influencerCredentialsBlockHtml(loginUrl, email, temporaryPassword) {
  return `<div class="order-info-block">
    <div class="info-row">
      <div class="info-label">Login URL</div>
      <div class="info-value">
        <a href="${escapeAttr(loginUrl)}" class="support-email" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;word-break:break-all;">${escapeHtml(loginUrl)}</a>
      </div>
    </div>
    <div class="info-row">
      <div class="info-label">Email</div>
      <div class="info-value">${escapeHtml(email)}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Temporary password</div>
      <div class="info-value">${escapeHtml(temporaryPassword)}</div>
    </div>
  </div>`;
}

function influencerInvitePlainTextFooterLines() {
  return [
    '',
    `Need assistance? ${SUPPORT_EMAIL}`,
    '',
    'We Create Memories',
    'The Andiamo Events Team',
    '',
    'Developed by Malek Ben Amor',
    'https://malekbenamor.dev',
    'https://www.instagram.com/malekbenamor.dev/',
  ];
}

function buildInfluencerInviteEmail({ fullName, email, temporaryPassword, loginPath = '/influencer/auth' }) {
  const origin = getPublicSiteOrigin().replace(/\/$/, '');
  const loginUrl = `${origin}${loginPath.startsWith('/') ? loginPath : `/${loginPath}`}`;
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there';

  const title = 'Dashboard access';
  const subtitle = 'Andiamo Academy — Influencer';
  const bodyHtml = `
    <p class="greeting">Hello <strong>${escapeHtml(firstName)}</strong>,</p>
    <p class="message">
      A super admin created an influencer account for you on Andiamo Academy. Use the credentials below
      to sign in and view academy registrations generated through your assigned promo codes.
    </p>
    ${influencerCredentialsBlockHtml(loginUrl, email, temporaryPassword)}
    <p class="message">
      <strong>Important:</strong> You will be asked to change this temporary password immediately after your first login.
    </p>
    <p class="message" style="font-size:13px;color:#888;">
      Your dashboard shows approved sales and pending registrations linked to your promo codes only — not customer contact details.
    </p>`;

  const subject = 'Your Andiamo Academy Influencer Dashboard Access';

  const html = wrapAcademyEmail({ title, subtitle, bodyHtml });

  const text = [
    subject,
    '',
    `Hello ${firstName},`,
    '',
    'A super admin created an influencer account for you on Andiamo Academy.',
    '',
    'Login URL: ' + loginUrl,
    'Email: ' + email,
    'Temporary password: ' + temporaryPassword,
    '',
    'You must change your password after first login.',
    '',
    'Your dashboard shows sales linked to your promo codes only — not customer contact details.',
    ...influencerInvitePlainTextFooterLines(),
  ].join('\n');

  return { subject, html, text };
}

module.exports = {
  buildInfluencerInviteEmail,
  SUPPORT_EMAIL,
};
