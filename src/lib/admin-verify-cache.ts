/** One-shot cache so Dashboard can skip an immediate duplicate VERIFY_ADMIN after route verify or login. */

export const ADMIN_VERIFY_CACHE_KEY = "andiamo_admin_verify_cache_v1";

export type AdminVerifyCacheAdmin = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type AdminVerifyCachePayload = {
  t: number;
  admin: AdminVerifyCacheAdmin;
  sessionExpiresAt?: number | null;
  sessionTimeRemaining?: number | null;
};

export function writeAdminVerifyCache(
  payload: Omit<AdminVerifyCachePayload, "t"> & { t?: number },
): void {
  try {
    const entry: AdminVerifyCachePayload = {
      t: typeof payload.t === "number" ? payload.t : Date.now(),
      admin: payload.admin,
      sessionExpiresAt: payload.sessionExpiresAt,
      sessionTimeRemaining: payload.sessionTimeRemaining,
    };
    sessionStorage.setItem(ADMIN_VERIFY_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // private mode / quota
  }
}

/** Returns cached payload if fresh (<= maxAgeMs) and removes it (one-shot). */
export function peekAndConsumeAdminVerifyCache(maxAgeMs = 8000): AdminVerifyCachePayload | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_VERIFY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminVerifyCachePayload;
    if (!parsed?.t || !parsed?.admin?.id) return null;
    if (Date.now() - parsed.t > maxAgeMs) {
      sessionStorage.removeItem(ADMIN_VERIFY_CACHE_KEY);
      return null;
    }
    sessionStorage.removeItem(ADMIN_VERIFY_CACHE_KEY);
    return parsed;
  } catch {
    return null;
  }
}
