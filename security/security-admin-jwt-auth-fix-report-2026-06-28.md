# Admin JWT Auth Fix Report

**Date:** 2026-06-28  
**Related audit:** [security-admin-jwt-auth-audit-2026-06-28.md](security-admin-jwt-auth-audit-2026-06-28.md)

---

## 1. Executive Summary

### What was fixed

- Introduced `effectivePermissionDenied()` in [api/_lib/admin-verify.js](api/_lib/admin-verify.js) and re-exported `hasEffectivePermission` for consistent DB-backed permission gates.
- Replaced role-static `hasPermission(auth.admin.role, …)` checks with effective permission checks on:
  - POS APIs (`pos:manage`)
  - Order approval (`orders:manage`)
  - SMS / bulk SMS / SMS balance (`marketing:manage`)
  - Presale admin codes (`events:manage` — presale is under Events tab; `presale:manage` was not defined)
  - Event promo admin codes (`events:manage`)
  - Admin logs route (`logs:view`)
  - Marketing path prefix gate in misc.js
- Implemented **global logout invalidation**: `POST /api/admin-logout` bumps `session_version` then clears cookie via [api/_lib/admin-logout-http.js](api/_lib/admin-logout-http.js).
- Aligned [server.cjs](server.cjs) local login with Vercel: `is_active` check, `session_version` in JWT, `requiresPasswordChange` in response; logout delegates to shared handler.
- Added unit and static source tests; extended `npm run test:admin-auth-order`.

### What remains intentionally unchanged

- HttpOnly `adminToken` cookie transport; no JWT in localStorage or response body.
- Core `verifyAdminSession` DB recheck (active admin, role, session_version, tab permissions).
- Express `requireAdminAuth` / `requireAdminPermission` middleware.
- Super-admin-only routes (`verifySuperAdmin`, `role !== 'super_admin'`) for official invitations, order QR tickets, etc.
- CSRF tokens (still mitigated by `SameSite=Lax` only).
- No `admin_sessions` table / per-device logout.
- Frontend UI and sessionStorage verify cache.

### Final verdict: **PASS** (with **NEEDS FOLLOW-UP** for CSRF only)

Authorization is now consistent on all audited high-risk routes. Logout invalidates all JWTs for the admin globally. Residual follow-up is CSRF hardening, not auth/permission bypass.

---

## 2. Files Changed

| File | Change | Security Impact |
|------|--------|-----------------|
| [api/_lib/admin-verify.js](api/_lib/admin-verify.js) | Added `effectivePermissionDenied`, export `hasEffectivePermission` | Single helper for tab-aware permission gates |
| [api/admin-pos.js](api/admin-pos.js) | `effectivePermissionDenied(auth, 'pos:manage')` | Tab-restricted admins cannot access POS APIs |
| [api/admin-approve-order.js](api/admin-approve-order.js) | `effectivePermissionDenied(authResult, 'orders:manage')` | Only admins with orders permission can approve |
| [api/misc.js](api/misc.js) | Marketing gate + SMS routes use effective `marketing:manage`; logout delegates to shared handler | SMS abuse blocked; global logout invalidation |
| [api/_lib/presale-route-admin-codes.js](api/_lib/presale-route-admin-codes.js) | `events:manage` effective gate (removed `presale:manage`) | Presale aligned with Events tab permissions |
| [api/_lib/event-promo-route-admin.js](api/_lib/event-promo-route-admin.js) | Renamed to `requireEventsManage`; effective `events:manage` | Tab-granted event admins can access promo APIs |
| [api/_lib/admin-logs-route.js](api/_lib/admin-logs-route.js) | `effectivePermissionDenied(authResult, 'logs:view')` | Logs require effective logs permission |
| [api/_lib/admin-logout-http.js](api/_lib/admin-logout-http.js) | **New** — session_version bump + cookie clear | Global session invalidation on logout |
| [server.cjs](server.cjs) | Login parity; shared logout handler | Local dev matches production auth semantics |
| [api/_lib/admin-effective-permission-gate.test.cjs](api/_lib/admin-effective-permission-gate.test.cjs) | **New** unit tests | Regression coverage for permission gate |
| [api/_lib/admin-logout-http.test.cjs](api/_lib/admin-logout-http.test.cjs) | **New** unit tests | Logout cookie clear + version bump |
| [api/_lib/server-cjs-admin-login-parity.test.cjs](api/_lib/server-cjs-admin-login-parity.test.cjs) | **New** static tests | server.cjs login/logout parity |
| [api/_lib/admin-permission-routes.test.cjs](api/_lib/admin-permission-routes.test.cjs) | Extended static effective-permission assertions | Prevents reintroduction of role-static checks |
| [package.json](package.json) | Extended `test:admin-auth-order` script | CI-friendly test entry point |

---

## 3. Authorization Fixes

| Route / handler | Old behavior | New behavior | Required permission | Helper |
|-----------------|--------------|--------------|-------------------|--------|
| All `/api/admin/pos-*` ([api/admin-pos.js](api/admin-pos.js)) | `hasPermission(role, 'pos:manage')` — any `admin` role passed | `effectivePermissionDenied(auth, 'pos:manage')` | `pos:manage` (from DB tabs) | `verifyAdminAuth` + `effectivePermissionDenied` |
| `POST /api/admin-approve-order` | Auth only | `effectivePermissionDenied(authResult, 'orders:manage')` | `orders:manage` | `verifyAdminAuth` + `effectivePermissionDenied` |
| `POST /api/send-sms` | Auth only | `effectivePermissionDenied(authResult, 'marketing:manage')` | `marketing:manage` | `verifyAdminAuth` + `effectivePermissionDenied` |
| `POST /api/admin/bulk-sms/send` | Auth only | `effectivePermissionDenied(authResult, 'marketing:manage')` | `marketing:manage` | `verifyAdminAuth` + `effectivePermissionDenied` |
| `GET /api/sms-balance` | Auth only | `effectivePermissionDenied(authResult, 'marketing:manage')` | `marketing:manage` | `verifyAdminAuth` + `effectivePermissionDenied` |
| Marketing prefix routes in misc.js | `hasPermission(role, 'marketing:manage')` | `hasEffectivePermission(marketingAuth.permissions, 'marketing:manage')` | `marketing:manage` | `verifyAdminAuth` + `hasEffectivePermission` |
| `/api/admin/presale/codes*` | `hasPermission(role, 'presale:manage')` — undefined key; super_admin only in practice | `effectivePermissionDenied(auth, 'events:manage')` | `events:manage` | `verifyAdminAuth` + `effectivePermissionDenied` |
| `/api/admin/event-promo/codes*` | `hasPermission(role, 'events:manage')` — denied tab-granted admins | `requireEventsManage` → `effectivePermissionDenied(auth, 'events:manage')` | `events:manage` | `verifyAdminAuth` + `effectivePermissionDenied` |
| `GET /api/admin/logs` (admin-logs-route) | `hasPermission(role, 'logs:view')` | `effectivePermissionDenied(authResult, 'logs:view')` | `logs:view` | `verifyAdminAuth` + `effectivePermissionDenied` |

### Presale permission mapping (documented)

- `presale:manage` **does not exist** in [shared/admin/tabDefinitions.data.json](shared/admin/tabDefinitions.data.json) or [shared/admin/permissions.cjs](shared/admin/permissions.cjs).
- Presale UI is under the **Events** tab; bootstrap and data routes already gate presale-related data with `events:manage`.
- Fix uses **`events:manage`** — no new permission key added.

---

## 4. Logout Behavior

| Aspect | Behavior |
|--------|----------|
| **Cookie clearing** | `applyClearAdminTokenCookie(res)` — `adminToken` cleared with `HttpOnly`, `Path=/`, `Max-Age=0`, `SameSite=Lax`, `Secure` in production |
| **session_version bump** | **Yes** — when a valid token is present, `bumpAdminSessionVersionOnLogout()` increments `admins.session_version` |
| **Scope** | **All sessions for that admin** on all browsers/devices — not per-browser only |
| **Invalid/missing token** | Still returns `200 { success: true }`; cookie cleared; no error details leaked |
| **DB bump failure** | Logged server-side; cookie still cleared; user sees success |

### Residual risk

- Stolen JWT remains valid until logout **or** password change **if** DB bump fails silently.
- Per-device logout without invalidating other devices would require an `admin_sessions` table (not implemented).

---

## 5. Local Dev Login Parity

[server.cjs](server.cjs) `POST /api/admin-login` now matches [api/admin-login.js](api/admin-login.js):

- Selects `id, email, name, role, password, is_active, session_version, requires_password_change` (not `*`)
- Rejects `is_active === false` with generic `401 Invalid credentials` (dummy bcrypt for timing)
- JWT payload includes `session_version: admin.session_version ?? 1`
- Response includes `requiresPasswordChange: !!admin.requires_password_change`
- Cookie behavior unchanged: `httpOnly`, `sameSite: 'lax'`, conditional `secure` for LAN HTTP

[server.cjs](server.cjs) `POST /api/admin-logout` dynamically imports `handleAdminLogout` from `api/_lib/admin-logout-http.js`.

---

## 6. Tests Added / Updated

| File | Scenarios |
|------|-----------|
| [api/_lib/admin-effective-permission-gate.test.cjs](api/_lib/admin-effective-permission-gate.test.cjs) | pos:manage pass/fail; marketing denied when only pos; super_admin `*`; tab-restricted denied orders/events/marketing |
| [api/_lib/admin-logout-http.test.cjs](api/_lib/admin-logout-http.test.cjs) | Missing token → 200 + Set-Cookie clear; `bumpAdminSessionVersionOnLogout` increments version 4→5 |
| [api/_lib/server-cjs-admin-login-parity.test.cjs](api/_lib/server-cjs-admin-login-parity.test.cjs) | JWT `session_version`; `is_active` check; `requiresPasswordChange`; shared logout handler |
| [api/_lib/admin-permission-routes.test.cjs](api/_lib/admin-permission-routes.test.cjs) | Static: pos, approve-order, SMS×3, presale→events, event-promo, logs use effective gates; no role-static `hasPermission` on auth.admin.role |
| [api/_lib/admin-authorization.test.cjs](api/_lib/admin-authorization.test.cjs) | (existing) no token, expired JWT, invalid role |

---

## 7. Commands Run

```bash
npm run test:admin-auth-order
```

**Result:** 34 tests, 11 suites, **0 failures** (pass 34)

```bash
npm run build
```

**Result:** **Exit code 0** — Vite build + academy prerender succeeded

Lint/typecheck: not run (no TS changes in API handlers; existing ESLint scope unchanged).

---

## 8. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| **CSRF** | MEDIUM | Cookie-based auth without CSRF tokens; mitigated by `SameSite=Lax` only |
| **Logout DB failure** | LOW | Bump failure logged; stolen token may work until JWT `exp` if bump fails |
| **Global logout side effect** | INFO | Logout on one device ends all admin sessions — intentional per security policy |
| **server.cjs duplication** | LOW | Login logic duplicated vs Vercel handler; behavior aligned, not shared module |
| **JWT 5h TTL** | INFO | Unchanged; stolen token window until logout/password change/expiry |

---

## 9. Final Gate

| Question | Answer |
|----------|--------|
| **Is JWT login secure now?** | **Yes** for production (Vercel) and aligned local dev — HttpOnly cookie, DB recheck, `session_version`, inactive admin blocked. |
| **Is logout secure enough?** | **Yes** for the chosen model — global `session_version` bump + cookie clear. Acceptable unless per-device sessions are required. |
| **Are admin APIs now consistently permission-protected?** | **Yes** on all routes identified in the audit plus admin-logs and marketing prefix gate. Express/admin-data routes were already correct. |
| **Can a tab-restricted admin bypass permissions?** | **No** on fixed routes — APIs use `auth.permissions` from `verifyAdminSession`, not JWT role or frontend state. |
| **Is anything required before production?** | Ensure `JWT_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are set in Vercel env. Optional follow-up: CSRF tokens for cookie-based mutations. |

---

*Implementation completed 2026-06-28. No database schema migrations. No env file changes.*
