/**
 * @deprecated PR-1b — replaced by api/_lib/rate-limit/upstash.cjs (atomic Lua EVAL).
 * Thin wrapper for any stale imports; admin-login.js no longer uses this module.
 */
import { createRequire } from 'module';

const requireCjs = createRequire(import.meta.url);
const { enforceRateLimits } = requireCjs('./rate-limit/index.cjs');

export async function checkAdminLoginDistributedLimits(clientIp, emailNormalized) {
  const result = await enforceRateLimits({
    policyId: 'LOGIN_ADMIN',
    segments: { ip: clientIp, email: emailNormalized },
  });
  return { allowed: result.allowed, reason: result.reason };
}

/** @deprecated */
export async function adminLoginUpstashIncr() {
  return { ok: true, count: 0, skipped: true };
}
