/**
 * Clear admin JWT cookie on plain Node http.ServerResponse (Vercel serverless).
 * Express's res.clearCookie() is not available outside Express.
 */
export function applyClearAdminTokenCookie(res) {
  if (!res || typeof res.setHeader !== 'function') return;
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    !!process.env.VERCEL_URL;
  const cookieParts = [
    'adminToken=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    isProduction ? 'Secure' : '',
    'SameSite=Lax',
  ].filter(Boolean);
  if (isProduction && process.env.COOKIE_DOMAIN) {
    cookieParts.push(`Domain=${process.env.COOKIE_DOMAIN}`);
  }
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}
