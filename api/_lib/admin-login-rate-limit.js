/**
 * @deprecated PR-1b — use api/_lib/rate-limit/index.cjs via createRequire in admin-login.js.
 * Kept for import-compat tests only; no in-memory Maps.
 */
import { createRequire } from 'module';

const requireCjs = createRequire(import.meta.url);
const rl = requireCjs('./rate-limit/index.cjs');

export const getAdminLoginClientIp = rl.getClientIp;

/** @deprecated no-op — production uses enforceRateLimits */
export function checkAdminLoginIpRateLimit() {
  return true;
}

/** @deprecated no-op — production uses enforceRateLimits */
export function checkAdminLoginEmailRateLimit() {
  return true;
}
