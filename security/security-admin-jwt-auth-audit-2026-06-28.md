# Admin JWT Auth Audit

**Date:** 2026-06-28  
**Scope:** Read-only code audit of admin JWT login, logout, session verification, role/permission enforcement, and related tests.  
**Production entrypoints (Vercel):** `api/admin-login.js`, `api/misc.js` (`/api/verify-admin`, `/api/admin-logout`, admin data routes), `api/scan.js`, `api/admin-pos.js`, `api/admin-approve-order.js`, `api/presale.js`, `api/media.js`.

---

## 1. Executive Summary

**Overall: NEEDS FIX**

- Production admin login is **backend-mediated** via `POST /api/admin-login` (`api/admin-login.js`): bcrypt password check against `admins` table (service role), JWT signed with `JWT_SECRET`, stored in **`adminToken` HttpOnly cookie** (5h, `SameSite=Lax`, `Secure` in production).
- Session verification is **DB-backed** in `verifyAdminSession` (`api/_lib/admin-authorization.mjs`): JWT signature/expiry, then reload admin (`is_active`, `role`, `session_version`, `requires_password_change`), tab access, and **effective permissions** from DB — not JWT claims alone.
- **Logout only clears the browser cookie**; JWTs remain cryptographically valid until expiry (~5h) or `session_version` changes (password change). No server-side revocation table.
- **`session_version`** is embedded in JWT and bumped on password change (`/api/admin/change-password`); invalidates other sessions. Not bumped on logout, deactivate, or role/tab changes (role/deactivate handled by DB recheck on each request).
- **Authorization is inconsistent:** Express/admin-data routes use `hasEffectivePermission` (tab-aware); several Vercel handlers use **role-static** `hasPermission(role, …)` or **auth-only** checks — tab-restricted admins may bypass or be wrongly denied on some APIs.
- **Local dev (`server.cjs`) diverges from production:** login JWT omits `session_version`, does not check `is_active`, and uses a weaker cookie/production detection model.
- JWT is **not** in localStorage; only **sessionStorage** caches non-secret verify metadata (`src/lib/admin-verify-cache.ts`). Token is not exposed to JavaScript.
- **Test coverage is thin** for login/logout, DB recheck, password-change invalidation, permission enforcement, and forced-password-change gating.

---

## 2. Files Reviewed

| Area | File | Purpose |
|------|------|---------|
| Login (Vercel) | `api/admin-login.js` | `POST /api/admin-login` — credential verify, JWT issue, Set-Cookie |
| Login (local dev) | `server.cjs` (~L1100–1289) | Duplicate `POST /api/admin-login` for `npm run server` |
| Session verify (core) | `api/_lib/admin-authorization.mjs` | `verifyAdminSession`, `parseAdminToken`, DB recheck, permissions/tabs |
| CJS bridge | `api/_lib/admin-authorization.cjs` | CommonJS loader for ESM module |
| Verify wrapper | `api/_lib/admin-verify.js` | `verifyAdminAuth` — thin wrapper for serverless handlers |
| Express middleware | `api/_lib/admin-authorization-express.cjs` | `requireAdminAuth`, `requireSuperAdmin`, `requireAdminPermission` |
| Verify HTTP | `api/_lib/verify-admin-http.js` | `GET /api/verify-admin` handler |
| Logout | `api/misc.js` (~L1781–1816) | `POST /api/admin-logout` — clear cookie |
| Logout (local) | `server.cjs` (~L1505–1508) | `POST /api/admin-logout` — `res.clearCookie` |
| Clear cookie helper | `api/_lib/clear-admin-token-cookie.js` | `applyClearAdminTokenCookie` for serverless responses |
| Admin data auth | `api/_lib/admin-data-route-helpers.js` | `requireAdmin`, password-change gate, `hasEffectivePermission` |
| Admin data routes | `api/_lib/admin-data-routes.js` | Tab-aware admin CRUD + `POST /api/admin/change-password` |
| Privileged Express app | `api/_lib/admin-privileged-app.cjs` | Express sub-app for site-content, admins, sponsors, orders, etc. |
| Permissions | `shared/admin/permissions.cjs`, `shared/admin/tabAccess.cjs` | Role defaults, tab-derived effective permissions |
| Tab definitions | `shared/admin/tabDefinitions.data.json` | Tab → permission mapping |
| Frontend login | `src/pages/admin/Login.tsx` | Form → `POST /api/admin-login`, `credentials: 'include'` |
| Frontend guard | `src/components/auth/ProtectedAdminRoute.tsx` | Calls `GET /api/verify-admin`, forced-password redirect |
| Frontend role hook | `src/hooks/useAdminRole.ts` | React Query → verify-admin |
| Verify cache | `src/lib/admin-verify-cache.ts` | sessionStorage metadata (not JWT) |
| Dashboard | `src/pages/admin/Dashboard.tsx` | Tab UI gating, logout, verify polling |
| CORS | `lib/cors.js` | Origin allowlist, `credentials: true` |
| Routing | `vercel.json` | Rewrites verify-admin/logout to misc; admin-login standalone |
| Scanner admin APIs | `api/scan.js`, `api/_lib/scanner-admin-auth.cjs` | Scanner routes; admin scanner mgmt via effective `scanners:manage` |
| POS admin APIs | `api/admin-pos.js` | Auth + **role-based** `hasPermission(role, 'pos:manage')` |
| Presale admin | `api/_lib/presale-route-admin-codes.js` | Auth + **role-based** `presale:manage` |
| Event promo admin | `api/_lib/event-promo-route-admin.js` | Auth + **role-based** `events:manage` |
| Order approve | `api/admin-approve-order.js` | Auth only — no `orders:manage` check |
| Security config | `scripts/check-security-config.js` | Warns if `JWT_SECRET` missing |
| Tests | `api/_lib/admin-authorization.test.cjs`, `api/_lib/admin-route-auth-order.test.cjs`, `api/_lib/admin-permission-routes.test.cjs`, `shared/admin/tabAccess.test.cjs` | Partial unit/static tests |

---

## 3. Login Flow

### Production (Vercel) — `api/admin-login.js`

1. **CORS preflight** — `lib/cors.js` `handlePreflight` / `setCORSHeaders` with `credentials: true`.
2. **Parse body** — `email`, `password`, `recaptchaToken`.
3. **Rate limits** — IP/email (`api/_lib/admin-login-rate-limit.js`) + distributed Upstash (`api/_lib/admin-login-upstash.js`).
4. **reCAPTCHA** — Required on Vercel production (`VERCEL_ENV === 'production'`) or `FORCE_ADMIN_RECAPTCHA=1`; verifies via Google siteverify API.
5. **DB lookup** — Service role Supabase client; `admins` select: `id, email, name, role, password, is_active, session_version, requires_password_change` filtered by normalized email.
6. **Inactive admin** — If `is_active === false`, dummy bcrypt compare (timing normalization) → `401 Invalid credentials`.
7. **Password** — `bcryptjs.compare(password, admin.password)`; failure → `401`.
8. **JWT** — `jsonwebtoken.sign` payload:
   ```js
   { id, email, role, session_version: admin.session_version ?? 1 }
   ```
   Options: `{ expiresIn: '5h' }` (default algorithm **HS256** when secret is a string — jsonwebtoken library default; not explicitly set in code).
9. **Secret** — `process.env.JWT_SECRET || 'fallback-secret-dev-only'`; production runtime blocks login if missing/fallback (`isProductionRuntime()`).
10. **Cookie** — Manual `Set-Cookie`: `adminToken=<jwt>; HttpOnly; Path=/; Max-Age=18000; Secure` (prod); `SameSite=Lax`; optional `Domain=${COOKIE_DOMAIN}` in production.
11. **Response body** — JSON `{ success, admin: { id, email, name, role }, requiresPasswordChange }` — **no JWT in body**.

### Frontend — `src/pages/admin/Login.tsx`

- `fetch(API_ROUTES.ADMIN_LOGIN, { method: 'POST', credentials: 'include', body: JSON.stringify({ email, password, recaptchaToken }) })`.
- On success: writes **sessionStorage** verify cache (admin profile + expiry hint), sets `ADMIN_SESSION_PENDING_KEY`, redirects to dashboard or change-password if `requiresPasswordChange`.

### Local dev — `server.cjs` `POST /api/admin-login` (~L1101)

**Differs from production:**

- Selects `*` from `admins` — **no `is_active` check**.
- JWT payload: `{ id, email, role }` only — **no `session_version`**.
- Uses `res.cookie('adminToken', …)` via cookie-parser; `Secure` only when `NODE_ENV === 'production'` **and** HTTPS forwarded.
- Triggered by `npm run server` / `npm run dev:full` (Vite + server.cjs), not Vercel.

---

## 4. JWT Claims

| Claim | Source | Purpose | Risk |
|-------|--------|---------|------|
| `id` | `admins.id` at login | Identify admin; DB lookup key | Low if verified against DB each request |
| `email` | `admins.email` at login | DB lookup match (`id` + `email`) | Low with DB recheck |
| `role` | `admins.role` at login | Quick role filter; **rechecked against DB** in `verifyAdminSession` | Medium if any API trusted JWT role alone — mitigated where `verifyAdminSession` is used |
| `session_version` | `admins.session_version` at login (Vercel only) | Invalidate sessions after password change | Low; effective when bumped |
| `iat` | jsonwebtoken auto | Issued-at | Info |
| `exp` | `expiresIn: '5h'` | Fixed 5-hour session | Medium — long window if token stolen; no server revoke on logout |
| `permissions` | **not in JWT** | Loaded from DB/tab config per request | Good — not over-embedded |
| `allowedTabs` | **not in JWT** | Loaded from DB per request | Good |
| `requires_password_change` | **not in JWT** | Loaded from DB per request | Good |

---

## 5. Token Storage / Transport

| Mechanism | Used? | Details |
|-----------|-------|---------|
| **httpOnly cookie** | **Yes (primary)** | Cookie name `adminToken`; set by `api/admin-login.js` and refreshed on change-password |
| Normal (non-HttpOnly) cookie | No | — |
| **Authorization header** | **No** | `parseAdminToken` only reads `Cookie` header regex `adminToken=([^;]+)` |
| localStorage | No | Not found in code for admin JWT |
| sessionStorage | Partial | `admin-verify-cache.ts` stores admin profile, permissions, tabs, expiry — **not the token** |
| Response body | No (token) | Response returns admin profile only |

**Security assessment**

- **Strengths:** HttpOnly + SameSite=Lax + Secure (production) keeps JWT out of JS and reduces XSS token theft vs localStorage. DB-backed verification on APIs is the right pattern.
- **CSRF:** Cookie-based auth on state-changing POST endpoints without CSRF tokens. `SameSite=Lax` blocks cross-site POST from third-party origins in modern browsers; same-site and top-level navigations remain a residual risk. No double-submit or custom CSRF header found.
- **CORS:** `lib/cors.js` uses explicit production origin allowlist (not `*` with credentials). Admin login/verify set `Access-Control-Allow-Credentials: true` when origin allowed.
- **XSS:** Token not in DOM/localStorage; sessionStorage cache could leak admin metadata (role, tabs) to XSS but not the signing secret or raw JWT.

---

## 6. Logout Flow

### Production — `api/misc.js` `POST /api/admin-logout` (~L1783)

1. No auth required to call logout.
2. Sets `Set-Cookie` clearing `adminToken`: empty value, `HttpOnly`, `Path=/`, `Max-Age=0`, `Expires=Thu, 01 Jan 1970…`, `SameSite=Lax`, `Secure` (production), optional `Domain`.
3. Returns `{ success: true, message: '…' }`.
4. **Does not** increment `session_version` or write to a revocation list.

### Frontend — `Dashboard.tsx` `handleLogout`

- `POST /api/admin-logout` with `credentials: 'include'`.
- Clears local React admin state; navigates to `/admin/login`.
- Logout API failure still navigates to login.

### Local — `server.cjs` `POST /api/admin-logout`

- `res.clearCookie('adminToken')` — minimal options (may differ from production cookie attributes).

**Old JWT usability:** A copied/stolen JWT remains valid until **`exp`** (~5h) or **`session_version` mismatch** (password change). Logout only removes cookie from that browser.

**Acceptability:** Acceptable for low-assurance admin panels if combined with short TTL and HTTPS; **not acceptable** if policy requires immediate session termination on logout or admin deactivation without waiting for next API call.

---

## 7. API Authentication Flow

### Core: `verifyAdminSession` (`api/_lib/admin-authorization.mjs`)

1. `parseAdminToken(req)` — cookie only.
2. Fail if no token → `401`.
3. `jwt.verify(token, JWT_SECRET)` — invalid/expired → `401`, optionally clear cookie via `applyClearAdminTokenCookie` / Express clearCookie.
4. Validate payload has `id`, `email`, `role`; role ∈ `{ admin, super_admin }`.
5. **DB recheck** (service role): `admins` where `id`, `email`, `is_active = true`.
6. Compare `decoded.session_version` vs `admin.session_version` (token missing version treated as `0`).
7. Compare `admin.role` vs `decoded.role`.
8. Load `admin_tab_access` rows; `resolveAdminEffectiveAccess` → `permissions`, `allowedTabs`, `mobileTabs`.
9. Return `requiresPasswordChange` from DB.

### Wrappers

| Helper | File | Usage |
|--------|------|-------|
| `verifyAdminAuth` | `api/_lib/admin-verify.js` | Serverless handlers in misc, presale, approve-order, logs, etc. |
| `requireAdminAuth` | `api/_lib/admin-authorization-express.cjs` | Express routes in privileged app, career, academy, media, server.cjs |
| `requireAdmin` | `api/_lib/admin-data-route-helpers.js` | `handleAdminDataRoutes` — auth + optional permission + service role client |
| `requireScannerAdminAuth` | `api/_lib/scanner-admin-auth.cjs` | `api/scan.js` admin scanner routes |

### Examples

- **`GET /api/verify-admin`** — `handleVerifyAdmin` → `verifyAdminSession`; returns full session including permissions/tabs.
- **`/api/admin/dashboard/bootstrap`** — `requireAdmin(..., 'dashboard:view')` in `admin-data-routes.js`.
- **`/api/admin/admins`** — Express `requireAdminAuth` + `requireAdminPermission('admins:manage')`.
- **`/api/admin/official-invitations/*`** — `verifySuperAdmin` in misc.js (role === `super_admin`).
- **`/api/admin/scan-*`** (Vercel) — `requireScannerAdminAuth` → effective `scanners:manage` (not strictly `super_admin` despite comments).

### Service role client

- `requireAdmin` / `createServiceRoleClient` / `createAdminDbClient` are invoked **after** `verifyAdminAuth` in audited paths (`admin-route-auth-order.test.cjs`).
- Login uses service role **before** auth (expected).

### Fail-closed behavior

- Missing/invalid/expired token → `401` with generic messages (`Invalid credentials`, `Invalid or expired token`, `Session invalidated`).
- Missing `JWT_SECRET` in production → `500` on verify/login.
- Some handlers return `details: error.message` on `500` in non-production only.

### Gaps (auth without sufficient permission check)

| Route / handler | Auth | Permission check |
|-----------------|------|------------------|
| `POST /api/admin-approve-order` | `verifyAdminAuth` | **None** — any authenticated admin |
| `POST /api/send-sms`, `GET /api/sms-balance` (misc.js) | `verifyAdminAuth` | **None** (server.cjs uses `marketing:manage`) |
| `POST /api/admin/bulk-sms/send` | `verifyAdminAuth` | **None** |
| `api/admin-pos.js` | `verifyAdminAuth` | `hasPermission(role, 'pos:manage')` — **role static, ignores tab restrictions** |
| `presale-route-admin-codes.js` | `verifyAdminAuth` | `hasPermission(role, 'presale:manage')` — **not in default admin role list** (effectively super_admin only) |
| `event-promo-route-admin.js` | `verifyAdminAuth` | `hasPermission(role, 'events:manage')` — **role static** (denies tab-granted `events:manage` for `admin` role) |

---

## 8. Super Admin Authorization

**Identification**

- DB column `admins.role === 'super_admin'`.
- JWT carries `role` at issuance; **rechecked against DB** on every `verifyAdminSession`.

**Enforcement patterns**

| Pattern | Where | DB-backed? |
|---------|-------|------------|
| `requireSuperAdmin` middleware | Express (`admin-authorization-express.cjs`), `server.cjs` scanner/official-invitations | Yes — uses `req.admin.role` from `requireAdminAuth` → DB |
| `verifySuperAdmin(req)` inline | `api/misc.js` official-invitations, order-qr-tickets | Yes — after `verifyAdminAuth` |
| `hasEffectivePermission(permissions, '*')` | Tab resolution for super_admin | Yes — permissions from DB session |
| `hasPermission(role, …)` | Some misc marketing gate, pos/presale/promo | **Role static** — super_admin always passes via `hasPermission` |

**Frontend:** `useAdminRole` / Dashboard `isSuperAdmin` from verify-admin response — **UI only**; sensitive routes re-check on server.

**Privilege escalation via client:** Editing sessionStorage verify cache or React state does not forge cookie JWT; APIs re-verify. Escalation risk is on **APIs that skip effective permission checks**, not on frontend role display.

---

## 9. Regular Admin Authorization

**Identification:** `admins.role === 'admin'`.

**Permission model**

1. **Default (no explicit tab rows):** `resolvePermissions('admin')` → static list in `ROLE_PERMISSIONS.admin` (subset of all tabs).
2. **Explicit tab config (`admin_tab_access` rows):** `permissionsFromTabs` — permissions derived only from allowed tabs (`resolveAdminEffectiveAccess` in `tabAccess.cjs`).

**API enforcement**

- **Strong:** `requireAdminPermission` / `requireAdmin` with `hasEffectivePermission(authResult.permissions, key)` — used in admin-data routes, Express privileged routes, scanner-admin-auth.
- **Weak:** Handlers using `hasPermission(auth.admin.role, key)` — ignores per-admin tab restrictions.

**Tab access**

- Loaded fresh from DB on each `verifyAdminSession` — **JWT tab changes do not require re-login**.
- Frontend `Dashboard.tsx` hides tabs via `allowedTabs` from verify-admin — **cosmetic**; must match API checks.

**Disabled/deleted admins**

- `verifyAdminSession` requires `is_active = true` — old JWT fails on next API call with `401 Admin not found or inactive`.
- **No `session_version` bump** on deactivate — relies on `is_active` filter.

**Role changes**

- JWT `role` vs DB `role` mismatch → `401 Admin role mismatch` (no version bump needed).

---

## 10. Password Change / Forced Password Change

### Forced change flag

- Column `admins.requires_password_change` set by super admin when creating/updating admins.
- Login returns `requiresPasswordChange: true` in JSON (not in JWT).
- `verifyAdminSession` returns `requiresPasswordChange` from DB.

### Gating

| Layer | Behavior |
|-------|----------|
| `ProtectedAdminRoute` | Redirects to `/admin/change-password` if `requiresPasswordChange` unless `allowPasswordChangeRequired` |
| `requireAdmin` (data routes) | Returns `403` `password_change_required` unless `skipPasswordChangeGate: true` |
| `GET /api/verify-admin` | Still returns `valid: true` with `requiresPasswordChange: true` — allows change-password page to verify |

### `POST /api/admin/change-password` (`admin-data-routes.js`)

1. `requireAdmin(..., null, { skipPasswordChangeGate: true })`.
2. Verify current password with bcrypt.
3. Update: new hash, `requires_password_change: false`, **`session_version: nextVersion`**.
4. Issue **new JWT** with updated `session_version`; set new `adminToken` cookie.

**Other sessions:** Old JWTs fail `session_version` check immediately.

**Logout after password change:** N/A — version bump handles invalidation.

**No `password_version` claim separate from `session_version`** — single field used for invalidation.

---

## 11. Security Findings

| Severity | Finding | Evidence | Risk | Recommended Fix |
|----------|---------|----------|------|-----------------|
| **HIGH** | Tab-restricted admins can access POS APIs via role-static check | `api/admin-pos.js` L753–756: `hasPermission(auth.admin?.role, 'pos:manage')` — `pos:manage` is in default `ROLE_PERMISSIONS.admin` | Admin stripped of POS tab can still call all `/api/admin/pos-*` endpoints | Use `hasEffectivePermission(auth.permissions, 'pos:manage')` |
| **HIGH** | Any authenticated admin can approve orders | `api/admin-approve-order.js` L80–88: only `verifyAdminAuth`, no `orders:manage` | Tab-restricted or low-privilege admin can approve orders | Add `hasEffectivePermission` check for `orders:manage` |
| **HIGH** | SMS endpoints lack `marketing:manage` on Vercel | `api/misc.js` send-sms (~L8897), bulk-sms (~L7823), sms-balance (~L9023): auth only; marketing gate (~L1560) excludes these paths | Any logged-in admin can send SMS / read balance | Enforce `hasEffectivePermission(..., 'marketing:manage')` consistently |
| **MEDIUM** | Logout does not invalidate JWT server-side | `api/misc.js` admin-logout; no `session_version` increment | Stolen token usable until expiry | Bump `session_version` on logout or maintain server-side session/denylist |
| **MEDIUM** | `server.cjs` login diverges from production | `server.cjs` L1227–1228: no `session_version`, no `is_active` check | Local/testing tokens behave differently; weaker dev sessions | Align server.cjs with `api/admin-login.js` or document dev-only bypass |
| **MEDIUM** | Mixed permission models (role vs effective) | `presale-route-admin-codes.js`, `event-promo-route-admin.js`, misc marketing gate use `hasPermission(role, …)` | Tab-granted access denied (events) or bypassed (pos); presale effectively super_admin-only | Standardize on `hasEffectivePermission` from `verifyAdminAuth` |
| **MEDIUM** | CSRF tokens absent for cookie auth | Cookie + POST mutations without CSRF middleware | Cross-site request risk under SameSite exceptions | Add CSRF token or `SameSite=Strict` for admin mutations where compatible |
| **LOW** | JWT fallback secret in non-production | `api/admin-login.js` L253; `admin-authorization.mjs` L33 | Weak signing if `JWT_SECRET` unset outside prod detection | Fail closed in all deployed environments; remove fallback string |
| **LOW** | `verify-admin` comment in server.cjs says 1h session | `server.cjs` L1511–1512 comment vs 5h JWT | Documentation drift | Fix comment |
| **INFO** | Scanner admin routes use permission not super_admin | `scanner-admin-auth.cjs` checks `scanners:manage`; comments in `scan.js` say super_admin | Behavior differs from `server.cjs` `requireSuperAdmin` for same paths | Align policy and comments |
| **INFO** | Admin metadata in sessionStorage | `admin-verify-cache.ts` | XSS can read role/tabs metadata, not JWT | Keep as-is; avoid storing secrets |

---

## 12. Correct Architecture Recommendation

For Andiamo Events admin (long but safe sessions):

1. **Transport:** Keep `adminToken` as **HttpOnly, Secure, SameSite=Lax** (or Strict for admin-only subdomain) cookie; never return JWT in JSON or store in localStorage.
2. **JWT contents (minimal):** `sub`/`id`, `email`, `role`, `session_version`, `exp` only — no permissions in token.
3. **TTL:** 4–8h fixed `exp` acceptable if combined with server invalidation; consider sliding sessions only with server-side session store.
4. **Server session version:** Keep `admins.session_version`; bump on **password change, logout, deactivate, role change, and optional “sign out all devices”**.
5. **Every admin API:** `verifyAdminSession` → load fresh admin + tab permissions → `hasEffectivePermission` before service-role DB access.
6. **Super admin:** Enforce `role === 'super_admin'` from DB for destructive/sensitive routes (official invitations, order QR, admin CRUD) — not permission aliases named `requireSuperAdmin` that check unrelated keys.
7. **Forced password change:** Keep DB flag + API 403 gate on all routes except change-password and verify-admin; optionally embed `requires_password_change` check inside `verifyAdminSession` for stricter fail-closed.
8. **Logout:** Increment `session_version` (or delete server session row) so old JWTs die immediately.
9. **CSRF:** For cookie-based POST/PATCH/DELETE from browser, use CSRF double-submit cookie or custom header required by CORS.
10. **Dev/prod parity:** Single login implementation (`api/admin-login.js`) or shared module used by `server.cjs`.
11. **Secrets:** `JWT_SECRET` ≥ 32 random bytes; never in frontend; `scripts/check-security-config.js` should fail CI if unset.

---

## 13. Test Coverage Gaps

**Existing tests**

- `api/_lib/admin-authorization.test.cjs` — no cookie, expired JWT, invalid role (no DB mock integration).
- `api/_lib/admin-route-auth-order.test.cjs` — static ordering: auth before service-role client.
- `api/_lib/admin-permission-routes.test.cjs` — static super_admin ordering in misc.js / admin-admins-routes.
- `shared/admin/tabAccess.test.cjs` — tab/permission resolution logic.

**Missing tests (not found in code)**

| Area | Missing |
|------|---------|
| Login | Happy path, inactive admin, wrong password, JWT claims, cookie attributes, production JWT_SECRET guard |
| Logout | Cookie cleared; **old JWT still accepted** until expiry |
| JWT verification | `session_version` mismatch, `is_active=false`, role mismatch, DB failure |
| Middleware | `requireAdminPermission`, `requireSuperAdmin`, `requireAdmin` password-change gate |
| Super admin | End-to-end denial for `admin` role on official-invitations, order-qr-tickets |
| Regular admin | Tab-restricted admin denied on pos/approve-order/SMS APIs (regression for findings above) |
| Forced password change | 403 on protected routes; change-password issues new cookie; old JWT rejected |
| Expired/invalid token | API middleware responses; cookie clearing |
| CSRF / cookie security | Not tested |
| server.cjs vs Vercel parity | Not tested |

---

## 14. Final Verdict

| Question | Answer |
|----------|--------|
| **Is the current JWT login/logout implementation correct?** | **Partially.** Production login (Vercel) is sound: HttpOnly cookie, bcrypt, service-role lookup, `session_version` in JWT. Logout is **client cookie clear only** — not full session revocation. Local `server.cjs` login is **out of date**. |
| **Is JWT usage in APIs correct?** | **Mostly for authentication, uneven for authorization.** `verifyAdminSession` DB recheck is correct and fail-closed. Several high-impact routes skip effective permission checks or use role-static `hasPermission`. |
| **Is super_admin/admin authorization safe?** | **Safe on Express/privileged and admin-data paths** that use effective permissions and explicit super_admin checks. **Unsafe/inconsistent** on POS, order approve, SMS, and some promo/presale handlers. Frontend role/tabs are not a security boundary. |
| **What must be fixed before production?** | (1) Enforce **effective permissions** on all admin mutating routes (POS, approve-order, SMS). (2) Decide logout policy — if immediate revoke required, **bump `session_version` on logout**. (3) Ensure **`JWT_SECRET` set** in all deployed envs (already blocked at login in prod). (4) Align **`server.cjs`** with Vercel login or restrict local dev to non-sensitive data. (5) Add integration tests for session invalidation and permission denials. |

---

*Audit performed read-only against repository source on 2026-06-28. No code, migrations, or environment files were modified.*
