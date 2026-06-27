/** One-shot cache so Dashboard can skip an immediate duplicate VERIFY_ADMIN after route verify or login. */

export const ADMIN_VERIFY_CACHE_KEY = "andiamo_admin_verify_cache_v1";

/** After successful login, set so ProtectedAdminRoute retries verify while the HttpOnly cookie is established. */
export const ADMIN_SESSION_PENDING_KEY = "andiamo_admin_session_pending_v1";

export type AdminVerifyCacheAdmin = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export type AdminVerifyCachePayload = {
  t: number;
  admin: AdminVerifyCacheAdmin;
  permissions?: string[];
  allowedTabs?: string[];
  mobileTabs?: string[];
  sessionExpiresAt?: number | null;
  sessionTimeRemaining?: number | null;
  requiresPasswordChange?: boolean;
};

export function writeAdminVerifyCache(
  payload: Omit<AdminVerifyCachePayload, "t"> & { t?: number },
): void {
  try {
    const entry: AdminVerifyCachePayload = {
      t: typeof payload.t === "number" ? payload.t : Date.now(),
      admin: payload.admin,
      permissions: payload.permissions,
      allowedTabs: payload.allowedTabs,
      mobileTabs: payload.mobileTabs,
      sessionExpiresAt: payload.sessionExpiresAt,
      sessionTimeRemaining: payload.sessionTimeRemaining,
      requiresPasswordChange: payload.requiresPasswordChange,
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
