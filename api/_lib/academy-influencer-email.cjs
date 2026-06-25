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

function influencerCredentialsBlockHtml(email, temporaryPassword) {
  return `<div class="order-info-block">
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

function influencerLoginButtonHtml(loginUrl) {
  return `<a href="${escapeAttr(loginUrl)}" class="cta-button">Access Your Dashboard</a>`;
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

  const title = 'Welcome to your dashboard';
  const subtitle = 'Andiamo Academy — Influencer Program';
  const bodyHtml = `
    <p class="greeting">Hello <strong>${escapeHtml(firstName)}</strong>,</p>
    <p class="message">
      You have been invited to join the Andiamo Academy influencer program. Your personal dashboard
      lets you track academy registrations generated through your assigned promo codes.
    </p>
    ${influencerCredentialsBlockHtml(email, temporaryPassword)}
    ${influencerLoginButtonHtml(loginUrl)}
    <p class="message">
      <strong>Important:</strong> For your security, you will be asked to set a new password immediately after your first sign-in.
    </p>
    <p class="message" style="font-size:13px;color:#888;">
      Your dashboard shows approved sales and pending registrations linked to your promo codes only — not customer contact details.
    </p>`;

  const subject = 'Welcome to Your Andiamo Academy Influencer Dashboard';

  const html = wrapAcademyEmail({ title, subtitle, bodyHtml, includeLogo: false });

  const text = [
    subject,
    '',
    `Hello ${firstName},`,
    '',
    'You have been invited to join the Andiamo Academy influencer program.',
    'Your dashboard lets you track registrations generated through your assigned promo codes.',
    '',
    'Sign in: ' + loginUrl,
    'Email: ' + email,
    'Temporary password: ' + temporaryPassword,
    '',
    'For your security, you must set a new password after your first sign-in.',
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
