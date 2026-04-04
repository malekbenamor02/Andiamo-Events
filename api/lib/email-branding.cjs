'use strict';

/**
 * Public site origin for absolute asset URLs in emails (images must be https in clients).
 * Set PUBLIC_SITE_URL (or VITE_SITE_URL) in production if different from default.
 */
function getPublicSiteOrigin() {
  const raw =
    process.env.PUBLIC_SITE_URL ||
    process.env.VITE_SITE_URL ||
    process.env.VITE_APP_URL ||
    process.env.VITE_API_URL ||
    process.env.API_URL ||
    'https://www.andiamoevents.com';
  const s = String(raw).trim();
  try {
    const withProto = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/\//, '')}`;
    const u = new URL(withProto);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'https://www.andiamoevents.com';
  }
}

/**
 * Absolute URL to the white logo (on dark header). Served from /public/email-assets/ in the web app.
 * For local HTML previews, generate-previews.cjs sets EMAIL_LOGO_URL=logo-white.png (same folder as previews).
 */
function getEmailLogoUrl() {
  const override = process.env.EMAIL_LOGO_URL;
  if (override != null && String(override).trim() !== '') {
    return String(override).trim();
  }
  const origin = getPublicSiteOrigin().replace(/\/$/, '');
  return `${origin}/email-assets/logo-white.png`;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

/** Full-width dark bar + white logo for top of HTML emails */
function emailLogoHeaderHtml() {
  const src = escapeAttr(getEmailLogoUrl());
  return `<div class="email-logo-bar" style="max-width:600px;margin:0 auto;background-color:#1A1A1A;text-align:center;padding:22px 16px 18px;line-height:0;">
  <img src="${src}" alt="Andiamo Events" width="200" style="max-width:200px;width:200px;height:auto;display:inline-block;border:0;outline:none;-ms-interpolation-mode:bicubic;" />
</div>`;
}

module.exports = {
  getPublicSiteOrigin,
  getEmailLogoUrl,
  emailLogoHeaderHtml,
  escapeAttr,
};
