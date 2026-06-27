# Security Login Systems Audit — Andiamo Events

**Date:** 2026-06-27  
**Scope:** Read-only defensive audit of custom login/session/auth for ambassadors, scanners, POS users, academy influencers, and related systems  
**Production target:** https://www.andiamoevents.com  
**Method:** Static code review, Supabase read-only SQL (RLS/schema), safe unauthenticated HTTP status checks (no brute force, no data extraction)  
**Changes made:** None (no code, DB, deploy, or key rotation)

---

## 1. Executive Summary

### Overall verdict

Custom portal authentication is **generally sound for production** after recent RLS hardening: sensitive tables (`ambassadors`, `orders`, `qr_tickets`, `ambassador_sessions`, `pos_users`, `academy_influencers`) have RLS enabled with deny-all or service-role-only policies, and **all privileged data access for these portals goes through server-side API routes** using the Supabase service role. Frontend uses **anon key only**; no service role or JWT secrets were found in client bundles.

The architecture uses **five parallel custom auth stacks** (not Supabase Auth): admin, ambassador, scanner, POS, academy influencer, plus a short-lived **presale session** gate for pass purchase.

**No Critical vulnerabilities were confirmed** in production runtime checks (unauthenticated access to protected APIs returned 401/404/400 as expected). **No emergency production fix is required** before normal operations, but **scanner ticket validation** and **session invalidation gaps** should be prioritized before a formal pentest retest.

### Highest risks

| Priority | Finding |
|----------|---------|
| High | Scanner `validate-ticket` trusts JWT only — deactivated scanners remain able to mark tickets used until JWT expiry (~8h) |
| High | Duplicate-scan race on concurrent `validate-ticket` requests (check-then-update, no transaction/unique constraint) |
| High | `api/scan.js` and `api/pos.js` fall back to `SUPABASE_ANON_KEY` if service role missing (misconfiguration footgun) |
| Medium | Single shared `JWT_SECRET` for admin, scanner, POS, and influencer JWT cookies |
| Medium | Admin routes inside `scan.js` use JWT-only verify (no `session_version` DB check) |
| Medium | No scanner login rate limiting |
| Medium | Admin ambassador password reset does not revoke existing ambassador sessions |

### Systems reviewed

- Ambassadors  
- Scanners (including supervisor role)  
- POS (point de vente / cashier)  
- Academy influencers  
- Presale session (related custom session, not a user portal)  
- Admin auth (comparison baseline only)

---

## 2. Systems Inventory

| System | Login page | Login API | DB table(s) | Session type | Risk level |
|--------|------------|-----------|-------------|--------------|------------|
| **Ambassadors** | `/ambassador/auth` — `src/pages/ambassador/Auth.tsx` | `POST /api/ambassador-login` — `api/_lib/ambassador-routes.cjs` | `ambassadors.password` (bcrypt), `ambassador_sessions.token_hash` | HttpOnly opaque cookie + HMAC-hashed DB session | **Low–Medium** |
| **Scanners** | `/scanner/login` — `src/pages/scanner/ScannerLogin.tsx` | `POST /api/scanner-login` — `api/scan.js` | `scanners.password_hash` (bcrypt) | HttpOnly JWT cookie `scannerToken` (8h) | **Medium–High** |
| **POS users** | `/pos/:slug/login` — `src/pages/pos/PosLogin.tsx` | `POST /api/pos/:slug/login` — `api/pos.js` | `pos_users.password_hash` (bcrypt) | HttpOnly JWT cookie `posToken` (8h) | **Medium** |
| **Academy influencers** | `/influencer/auth` — `src/pages/influencer/Auth.tsx` | `POST /api/academy-influencer/login` — `api/_lib/academy-influencer-routes.cjs` | `academy_influencers.password_hash` (bcrypt) | HttpOnly JWT cookie `influencerToken` (8h) | **Low–Medium** |
| **Presale gate** | N/A (redeem on event page) | `POST /api/presale/redeem` | `presale_sessions` | HttpOnly cookie `andm_ps` + CSRF header (~5.5 min TTL) | **Low** (Info) |
| **Admin** (baseline) | `/admin/login` | `POST /api/admin-login` | `admins.password` (bcrypt) | HttpOnly JWT `adminToken` + `session_version` DB check | **Low–Medium** |

**Note:** No dedicated `SCANNER_SECRET`, `POS_SECRET`, `INFLUENCER_SECRET`, or `AMBASSADOR_JWT_SECRET` exist. Ambassador sessions use `AMBASSADOR_SESSION_PEPPER` (HMAC pepper, server-only).

---

## 3. Ambassador Auth Review

### Login flow

| Item | Detail |
|------|--------|
| Login page | `src/pages/ambassador/Auth.tsx` |
| Login API | `POST /api/ambassador-login` → `handleAmbassadorLogin` in `api/_lib/ambassador-routes.cjs` |
| DB table | `ambassadors` — credential column `password` (bcrypt hash) |
| Password hashing | bcrypt cost **10** via `bcryptjs.compare` / `bcryptjs.hash` |
| Server-side compare | **Yes** — login handler compares plaintext password to `ambassadors.password` |
| Browser receives hash | **No** — `pickSafeAmbassador()` strips password; response is safe profile fields only |
| Service role | **Yes, server-only** — `createAmbassadorDbClient()` requires `SUPABASE_SERVICE_ROLE_KEY` |
| Direct browser table login | **No** — dashboard uses API routes with cookie session |
| Inactive/disabled blocked | **Yes** — `status` checked: `pending`, `rejected`, `suspended`, non-`approved` return 403 |
| Role/status re-checked on session | **Yes** — `requireAmbassadorAuth()` reloads ambassador and revokes session if status invalid |
| User enumeration | **Partial mitigation** — same error message for bad phone/password (`Invalid phone number or password`) |
| Rate limiting | In-memory IP limit 5/15min via `checkAmbassadorLoginRateLimit` in `api/misc.js` (resets on cold start) |
| Bot protection | reCAPTCHA v3 on login; bypass token accepted when `RECAPTCHA_SECRET_KEY` unset or localhost |

### Session model

| Item | Detail |
|------|--------|
| Mechanism | Opaque random token (32 bytes) → HMAC-SHA256 with `AMBASSADOR_SESSION_PEPPER` → stored in `ambassador_sessions.token_hash` |
| Cookie | `__Host-andiamo_ambassador_session` (prod HTTPS) / `andiamo_ambassador_session` (dev HTTP) |
| Flags | **HttpOnly**, **Path=/**, **SameSite=Lax**, **Secure** (prod/HTTPS) |
| Idle expiry | Default **90 days** (`AMBASSADOR_SESSION_IDLE_DAYS`) |
| Absolute max | Default **180 days** (`AMBASSADOR_SESSION_ABSOLUTE_DAYS`) |
| Rotation | Default every **7 days** (`AMBASSADOR_SESSION_ROTATE_DAYS`) |
| Refresh | Rolling `expires_at` updated on each authenticated request |
| Logout | `POST /api/ambassador-logout` — revokes session row + clears cookie |
| Forgery resistance | Raw token never stored in DB; HMAC with server pepper |
| Password reset invalidates sessions | **Self-service only** — `handleAmbassadorUpdatePassword` calls `revokeAllAmbassadorSessions`. **Admin password reset does not revoke sessions.** |
| Frontend storage | **No localStorage/sessionStorage** for ambassador auth |

Implementation: `api/_lib/ambassador-auth.cjs`, migration `supabase/migrations/20260624120000_ambassador_sessions.sql`.

### API authorization

Protected routes use `requireAmbassadorAuth()`:

- `GET /api/ambassador/me`
- `GET /api/ambassador/events`, `/orders`, `/performance`
- `POST /api/ambassador/confirm-cash`, `/cancel-order`, `/ambassador-update-password`

Ownership checks:

- Orders/performance: `ambassadorId` query param must match session ambassador or is ignored (server uses `auth.ambassador.id`)
- Cancel/confirm-cash: verifies `order.ambassador_id === auth.ambassador.id`

Route guard: `src/components/auth/ProtectedAmbassadorRoute.tsx` → `GET /api/ambassador/me`.

### Frontend Supabase access

| File | Table | Operation | Risk |
|------|-------|-----------|------|
| `src/pages/ambassador/Application.tsx` | `site_content` | SELECT (application open/closed banner) | **Low** — public CMS content |
| Dashboard, Auth | — | API-only | **None** |

No browser reads of `ambassadors`, `orders`, or `ambassador_sessions`.

### Password handling

- bcrypt cost 10 on `ambassadors.password`
- Min length **6** on self-service change (weak vs influencer rules)
- Admin can set/generate password via `PATCH /api/admin/ambassadors/:id`
- Approval flow emails **temporary plaintext password** (`createApprovalEmail` in email templates)
- **`requires_password_change` column exists on `ambassadors`** (confirmed in production schema) but **login and session handlers do not enforce it** — admin API references the field but portal has no forced-change flow
- **No live forgot-password API** — `createPasswordResetEmail` template exists but is never wired to a route

### Event/order visibility

- **Events:** All non-cancelled, non-gallery upcoming events visible to every approved ambassador (no per-ambassador event assignment). Test events hidden unless `?includeTest=1`.
- **Orders:** Scoped to `ambassador_id = session.ambassador.id` only — ambassadors cannot read each other's orders via API.
- **Performance/commission:** Calculated from own orders only (~10% revenue in app code); no payout API.

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| AMB-01 | Medium | Admin password reset does not revoke ambassador sessions |
| AMB-02 | Medium | `requires_password_change` column present but not enforced at login |
| AMB-03 | Medium | Temporary passwords sent in plaintext email on approval |
| AMB-04 | Low | Min password length 6 |
| AMB-05 | Low | In-memory login rate limit weak on serverless cold starts |
| AMB-06 | Low | 500 responses may include `error.message` (`handleAmbassadorLogin` catch block) |
| AMB-07 | Info | Public `GET /api/ambassadors/active?city=…` returns approved ambassador phone/email for COD picker (by design) |
| AMB-08 | Info | Strongest session design in the codebase (opaque + DB revocation + rotation) |

---

## 4. Scanner Auth Review

### Login flow

| Item | Detail |
|------|--------|
| Login page | `src/pages/scanner/ScannerLogin.tsx` |
| Login API | `POST /api/scanner-login` — `api/scan.js` |
| DB table | `scanners.password_hash` (bcrypt) |
| Server-side compare | **Yes** |
| Browser receives hash | **No** |
| Service role | Intended yes; **falls back to anon key** if `SUPABASE_SERVICE_ROLE_KEY` missing |
| Direct browser login | **No** |
| Inactive blocked at login | **Yes** — `is_active` required |
| Rate limiting | **None** on scanner login |
| Roles | `scanner` \| `supervisor` stored in JWT claim `scannerRole` |

### Session model

| Item | Detail |
|------|--------|
| Cookie | `scannerToken` — JWT signed with `JWT_SECRET`, **8h** expiry |
| Flags | HttpOnly, Path=/, SameSite=Lax, Secure when prod+HTTPS |
| DB revalidation | **Partial** — `GET /api/scanner/session` checks `is_active`; **`POST /api/scanner/validate-ticket` does not** |
| Logout | Clears cookie only (no server-side JWT revocation list) |
| Frontend storage | `localStorage.scanner_selected_event` — event metadata only, not credentials |

### API authorization

| Route | Auth | Notes |
|-------|------|-------|
| `GET /api/scan-system-status` | Public | Returns `{ enabled: bool }` |
| `POST /api/scanner/validate-ticket` | Scanner JWT | Mutates `qr_tickets`, inserts `scans` |
| `GET /api/scanner/events` | Scanner JWT | All upcoming events (no per-scanner assignment) |
| `GET /api/scanner/scans`, `/statistics` | Scanner JWT | Own scans only |
| Supervisor routes | Scanner JWT + `role === supervisor` | lookup, inspect, event-wide activity |
| Admin scanner CRUD | `adminToken` JWT-only in `scan.js` | **Weaker than** `verifyAdminSession` |

### QR validation

- Primary: `POST /api/scanner/validate-ticket`
- Requires scanner auth + global `scan_system_config.scan_enabled`
- Looks up ticket by `secure_token`; validates `event_id` match
- Sets `qr_tickets.ticket_status = 'USED'` on success
- `scanner_id` taken from JWT only (never from body)
- **Race:** concurrent valid scans can both pass `existing` check before update (lines 570–582 in `api/scan.js`)

### Event scoping

- No scanner-to-event assignment in DB
- Any authenticated scanner sees all upcoming events
- Wrong-event tickets rejected at scan time via `event_id` parameter

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| SCN-01 | **High** | Deactivated/downgraded scanners can validate tickets until JWT expires (~8h) |
| SCN-02 | **High** | Duplicate-scan race on concurrent validation |
| SCN-03 | **High** | Anon key fallback in `getDb()` if service role missing |
| SCN-04 | Medium | No scanner login rate limiting |
| SCN-05 | Medium | Admin auth in `scan.js` is JWT-only (no `session_version`) |
| SCN-06 | Medium | No per-scanner event ACL (operational over-permission) |
| SCN-07 | Low | Password policy asymmetry: login accepts ≥6 chars, creation requires ≥8 |
| SCN-08 | Info | Supervisor inspect endpoints expose buyer PII by design |

---

## 5. POS Auth Review

### Login flow

| Item | Detail |
|------|--------|
| Login page | `src/pages/pos/PosLogin.tsx` |
| Login API | `POST /api/pos/:outletSlug/login` — `api/pos.js` |
| DB table | `pos_users.password_hash` |
| Outlet identity | **From URL slug only** — never trusted from request body |
| Server-side compare | **Yes** (bcrypt) |
| Rate limiting | 6 attempts / 15 min / IP (in-memory) |
| Inactive/paused | Blocked at login and on every request |

### Session model

| Item | Detail |
|------|--------|
| Cookie | `posToken` — JWT `{ pos_user_id, pos_outlet_id, email, role: 'pos' }`, 8h |
| Flags | HttpOnly, Secure (prod), SameSite=Lax, optional `COOKIE_DOMAIN` |
| DB revalidation | **Yes** — `requirePosAuth()` on every protected route |
| Outlet match | JWT `pos_outlet_id` must equal resolved outlet.id |

### Permissions

| Action | POS user | Admin (`pos:manage`) |
|--------|----------|----------------------|
| Create order | Yes — `PENDING_ADMIN_APPROVAL`, reserves stock | — |
| Approve/reject/remove | **No** | Yes — `api/admin-pos.js` |
| Refund | **No dedicated API** | Reject/remove releases stock |
| Modify prices | **No** — prices from `event_passes` | Stock limits via admin |
| Customer data | Collected on order create (name, phone, email) | Full order management |
| Audit log | `pos_audit_log` on order create | Full POS audit via admin |

POS users **cannot** access admin routes.

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| POS-01 | **High** | Same anon key fallback as scanner if service role missing |
| POS-02 | Medium | Shared `JWT_SECRET`; no server-side JWT revocation beyond deactivating user |
| POS-03 | Low | In-memory login rate limit resets on serverless cold start |
| POS-04 | Info | Strong per-request DB revalidation and outlet scoping |

---

## 6. Influencer Auth Review

### Login flow

| Item | Detail |
|------|--------|
| Login page | `src/pages/influencer/Auth.tsx` |
| Login API | `POST /api/academy-influencer/login` |
| DB table | `academy_influencers.password_hash` |
| Server-side compare | **Yes** |
| Rate limiting | IP + email in-memory (`academy-influencer-login-rate-limit.cjs`) |
| Temp password expiry | **Yes** — 7-day TTL; expired temp password returns 403 |
| Force password change | **`must_change_password`** enforced via `ProtectedInfluencerRoute` |

### Session model

| Item | Detail |
|------|--------|
| Cookie | `influencerToken` — JWT `{ type: 'academy_influencer', influencerId, email }`, 8h |
| DB revalidation | **Yes** — `requireAcademyInfluencerAuth` verifies JWT + `is_active` on every route |
| Logout | Clears cookie |

### Data visibility

- `GET /api/academy-influencer/sales` — registration counts/revenue for attributed academy registrations
- **No payout, referral link edit, or commission withdrawal APIs**
- Promo codes assigned by admin; influencer cannot self-assign
- Admin audit via `writeAcademyInfluencerAudit` for admin CRUD actions

### Findings

| ID | Severity | Finding |
|----|----------|---------|
| INF-01 | Medium | Shared `JWT_SECRET` with other JWT portals |
| INF-02 | Medium | Temporary passwords emailed in plaintext on invite |
| INF-03 | Low | In-memory rate limits on serverless |
| INF-04 | Info | Good force-password-change flow with route guard |

---

## 7. Other Auth Systems Found

### Presale session (pass purchase gate)

- **Not a user type** — short-lived access after presale code redeem
- Cookie: `andm_ps`; CSRF: `x-presale-csrf`; TTL ~5.5 minutes
- Requires `SUPABASE_SERVICE_ROLE_KEY` (no anon fallback)
- Files: `api/_lib/presale-server.js`, `presale-route-redeem.js`, `presale-route-session.js`

### Admin (comparison baseline)

- JWT + **`session_version`** DB invalidation — strongest JWT model
- reCAPTCHA required on Vercel production
- Optional Upstash distributed rate limits

### Legacy `server.cjs` endpoints

- `/api/validate-ticket` — **unauthenticated**, trusts client `ambassadorId` — **not deployed via Vercel rewrites** but dangerous if local `server.cjs` is exposed
- Constant `API_ROUTES.VALIDATE_TICKET` still exists in `src/lib/api-routes.ts` (unused by current scanner UI)

### Commission / payout

- **No `referral` or `payout` API routes** found in repository
- Ambassador commission is display-only analytics; influencer sales are academy registration metrics

---

## 8. API Route Authorization Matrix

| Route | File | System | Auth required | Role/permission | Ownership/event scoping | Service role | Risk | Notes |
|-------|------|--------|---------------|-----------------|-------------------------|--------------|------|-------|
| `POST /api/ambassador-login` | `ambassador-routes.cjs` | Ambassador | No | — | — | Yes | Low | reCAPTCHA + rate limit |
| `GET /api/ambassador/me` | `ambassador-routes.cjs` | Ambassador | Yes | Approved ambassador | Session-bound | Yes | Low | |
| `GET /api/ambassador/events` | `ambassador-routes.cjs` | Ambassador | Yes | Approved | All events (no assignment) | Yes | Low | |
| `GET /api/ambassador/orders` | `ambassador-routes.cjs` | Ambassador | Yes | Approved | Own `ambassador_id` | Yes | Low | |
| `POST /api/ambassador/confirm-cash` | `ambassador-routes.cjs` | Ambassador | Yes | Approved | Own order | Yes | Low | Writes `order_logs` |
| `POST /api/ambassador/cancel-order` | `ambassador-routes.cjs` | Ambassador | Yes | Approved | Own order | Yes | Low | |
| `GET /api/ambassadors/active` | `active-ambassadors-handler.cjs` | Public COD | No | — | City/ville filter | Yes | Info | Exposes phone/email |
| `POST /api/scanner-login` | `scan.js` | Scanner | No | — | — | Yes* | Medium | *Anon fallback |
| `POST /api/scanner/validate-ticket` | `scan.js` | Scanner | Yes | JWT scanner | Event ID param | Yes* | **High** | No DB revalidation |
| `GET /api/scanner/events` | `scan.js` | Scanner | Yes | JWT | All events | Yes* | Medium | |
| `GET /api/scanner/session` | `scan.js` | Scanner | Yes | JWT | — | Yes* | Low | Re-checks `is_active` |
| `GET /api/scan-system-status` | `scan.js` | Public | No | — | — | Yes* | Info | |
| `POST /api/pos/:slug/login` | `pos.js` | POS | No | — | Outlet slug | Yes* | Medium | Rate limited |
| `GET /api/pos/:slug/verify` | `pos.js` | POS | Yes | JWT + outlet | Outlet match | Yes* | Low | |
| `POST /api/pos/:slug/orders/create` | `pos.js` | POS | Yes | JWT + outlet | Stock limits | Yes* | Medium | Audit log |
| `GET /api/admin/pos-orders` | `admin-pos.js` | Admin | Yes | `pos:manage` | Admin | Yes | Low | |
| `POST /api/admin/pos-orders/:id/approve` | `admin-pos.js` | Admin | Yes | `pos:manage` | — | Yes | Low | Generates tickets |
| `POST /api/academy-influencer/login` | `academy-influencer-routes.cjs` | Influencer | No | — | — | Yes | Low | Rate limited |
| `GET /api/academy-influencer/session` | `academy-influencer-routes.cjs` | Influencer | Yes | JWT + active DB | — | Yes | Low | |
| `GET /api/academy-influencer/sales` | `academy-influencer-routes.cjs` | Influencer | Yes | JWT + active DB | Own attribution | Yes | Low | |
| `GET /api/admin/scanners` | `scan.js` | Admin | Yes | JWT super_admin | — | Yes* | Medium | JWT-only admin |
| `GET /api/tickets/qr/:token` | `misc.js` | Public QR image | No | — | Token in URL | Yes | Medium | QR image endpoint separate from validation |
| `POST /api/presale/redeem` | `presale-route-redeem.js` | Presale | No | Code + rate limit | Event-scoped | Yes | Low | Creates short session |

---

## 9. Frontend Storage/Session Review

| File | Storage | Stored data | Risk | Fix recommendation |
|------|---------|-------------|------|-------------------|
| `src/pages/scanner/ScannerEvents.tsx` | localStorage | `scanner_selected_event` (event id/name/date) | **Low** | Acceptable — not auth; server validates event_id on scan |
| `src/pages/scanner/ScannerScan.tsx` | localStorage read | Selected event | **Low** | Same |
| `src/integrations/supabase/client.ts` | localStorage | Supabase Auth session (default client config) | **Info** | Custom portals do not use Supabase Auth; only public table reads |
| `src/lib/admin-verify-cache.ts` | sessionStorage | Admin verify cache metadata | **Low** | Admin only; not used by ambassador/scanner/POS/influencer |
| Ambassador/POS/Influencer pages | — | HttpOnly cookies only | **None** | Maintain current pattern |

**No JWT, password hash, or role token stored in localStorage for custom portals.**

---

## 10. Direct Supabase Access Review

Browser `supabase.from()` usage is limited to **public or CMS tables** with RLS allowing anon read:

| File | Table | Operation | Client | Risk | Notes |
|------|-------|-----------|--------|------|-------|
| `src/hooks/useEvents.ts` | `events`, `event_passes` | SELECT | Browser/anon | **Low** | Public event listings |
| `src/pages/ambassador/Application.tsx` | `site_content` | SELECT | Browser/anon | **Low** | Banner settings |
| `src/pages/admin/Dashboard.tsx` | `site_content` | SELECT/WRITE | Browser/anon | **Medium** | Admin UI — should use admin API post-RLS (admin concern) |
| `src/pages/Contact.tsx` | `contact_messages` | INSERT | Browser/anon | **Low** | Public contact form |
| `src/lib/orders/paymentService.ts` | `payment_options` | SELECT | Browser/anon | **Low** | Public payment options |

**No browser access to:** `ambassadors`, `orders`, `qr_tickets`, `scanners`, `pos_users`, `academy_influencers`, `ambassador_sessions`.

Post-RLS migration (`20260627120000_fix_critical_rls_exposure.sql`):

- `ambassadors` → `ambassadors_deny_all`
- `orders` → `orders_deny_all`
- `qr_tickets` → `qr_tickets_deny_all`

Direct browser queries to these tables **would fail** under anon key (confirmed policy names in production SQL).

**Legacy note:** `scans` table still has policies named "Ambassadors can insert/view their own scans" — vestigial from old ambassador scan flow; current scanner system uses service-role API. Risk is **Low** if no client code writes scans directly (none found for ambassadors in current UI).

---

## 11. Password and Reset Security

| Control | Ambassadors | Scanners | POS | Influencers |
|---------|-------------|----------|-----|-------------|
| Algorithm | bcrypt (10) | bcrypt (10) | bcrypt (10) | bcrypt (10) |
| Hash in browser | No | No | No | No |
| Min length | 6 (weak) | 6 login / 8 create | Admin-set | Stronger rules via `validateNewPassword` |
| Temp passwords | Email on approval (plaintext) | Admin-set on create | Admin-set | Email invite (plaintext), 7-day expiry |
| Force reset | Column exists, **not enforced** | No | No | **`must_change_password` enforced** |
| Self change route | `POST /api/ambassador-update-password` | Admin only | Admin only | `POST /api/academy-influencer/change-password` |
| Forgot-password | **Not implemented** | No | No | Contact admin |
| 2FA/MFA | **None** | None | None | None |
| Account lockout | Rate limit only | **None** | Rate limit only | Rate limit only |

**Argon2:** Not used anywhere; bcrypt only.

---

## 12. Session/Cookie Security

| System | HttpOnly | Secure | SameSite | Path | Max-Age | Signed | Secret server-only |
|--------|----------|--------|----------|------|---------|--------|-------------------|
| Ambassador | Yes | Prod/HTTPS | Lax | / | Rolling (up to 90d idle) | HMAC + random token | Yes (`AMBASSADOR_SESSION_PEPPER`) |
| Scanner | Yes | Prod+HTTPS | Lax | / | 28800 (8h) | JWT (`JWT_SECRET`) | Yes |
| POS | Yes | Prod | Lax | / | 28800 | JWT | Yes |
| Influencer | Yes | Prod+HTTPS | Lax | / | 8h | JWT | Yes |
| Admin | Yes | Prod | Lax | / | 5h | JWT + session_version | Yes |

**JWT invalidation after password change:**

- Ambassador self-change: **Yes** (all sessions revoked)
- Admin password change: session_version bump
- Scanner/POS/Influencer JWT: valid until expiry unless user deactivated (POS/influencer re-check on each request; scanner validate-ticket does not)

---

## 13. Scanner/POS Critical Action Review

### Ticket validation

- Auth required on production `validate-ticket` (runtime: **401** unauthenticated)
- Global kill switch via `scan_system_config.scan_enabled`
- Event mismatch → `wrong_event` result
- Replay handling: checks existing valid scan — **race condition under concurrency**
- Offline mode: **None**

### POS sales/orders/refunds

- POS creates pending orders only; admin approval generates tickets
- No POS refund endpoint; admin reject/remove releases stock
- `pos_audit_log` written on order create (`api/pos.js`)

### Audit logging gaps

| Action | Logged? |
|--------|---------|
| Scanner login/logout | **No** dedicated audit table |
| Ticket scan (valid/invalid) | `scans` table rows |
| POS order create | `pos_audit_log` |
| Ambassador login | **No** |
| Ambassador order cancel/confirm cash | `order_logs` (best-effort) |
| Influencer login | `last_login` column update only |
| Influencer admin actions | `writeAcademyInfluencerAudit` |

---

## 14. Environment and Secret Exposure

### Keys searched

| Variable | Frontend exposure | Finding |
|----------|-------------------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | **No** in `src/` | Server-only; referenced in admin help text only |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | **Not found** | — |
| `JWT_SECRET` | **No** | Server-only; shared across JWT portals |
| `AMBASSADOR_SESSION_PEPPER` | **No** | Required on Vercel; not in `env.example` (document gap) |
| `SCANNER_SECRET` / `POS_SECRET` / `INFLUENCER_SECRET` | **Not found** | — |
| `SESSION_SECRET` / `TOKEN_PEPPER` | **No** | Fallback aliases for ambassador pepper |
| `CRON_SECRET` | **No** | Server cron auth |
| `PRESALE_CODE_PEPPER` | **No** | Presale code hashing |
| `VITE_SUPABASE_ANON_KEY` | **Yes** (expected) | Publishable anon key only |

**Hardcoded secrets in frontend:** None found.

**Dev fallbacks (server):** `fallback-secret-dev-only`, `dev-only-ambassador-session-pepper-change-me`, `localhost-bypass-token` for reCAPTCHA.

---

## 15. Logs and Auditability

### What is logged

- Ambassador order cancel/confirm → `order_logs` (non-fatal on failure)
- POS order create → `pos_audit_log`
- Influencer admin CRUD → academy influencer audit helper
- All scans → `scans` table with result type
- Influencer `last_login` timestamp

### Missing or weak

- Login success/failure for ambassador, scanner, POS (console.error only on some errors)
- Logout events (except ambassador session revocation row)
- Scanner admin actions audit trail
- Centralized security audit for portal logins (admin has `security_audit_logs` for some admin actions)

### Sensitive log risk

- `handleAmbassadorLogin` catch may log full error to server console (may include internal details — review log redaction policies)

---

## 16. Safe Runtime Checks Performed

Production base URL: `https://www.andiamoevents.com`  
Method: Single unauthenticated request per endpoint; status code only; no cookies with real sessions; no brute force.

| Endpoint | Expected | Actual | Pass |
|----------|----------|--------|------|
| `GET /api/ambassador/me` | 401 | 401 | ✅ |
| `GET /api/ambassador/events` | 401 | 401 | ✅ |
| `GET /api/ambassador/orders` | 401 | 401 | ✅ |
| `GET /api/scanner/session` | 401 | 401 | ✅ |
| `POST /api/scanner/validate-ticket` | 401 | 401 | ✅ |
| `GET /api/scanner/events` | 401 | 401 | ✅ |
| `GET /api/scan-system-status` | 200 | 200 | ✅ (public metadata) |
| `GET /api/academy-influencer/session` | 401 | 401 | ✅ |
| `GET /api/academy-influencer/sales` | 401 | 401 | ✅ |
| `GET /api/pos/test-outlet/verify` | 401/404 | 404 | ✅ (unknown outlet) |
| `GET /api/pos/test-outlet/events` | 401/404 | 404 | ✅ |
| `POST /api/pos/test-outlet/orders/create` | 401/404 | 404 | ✅ |
| `GET /api/admin/pos-orders` | 401 | 401 | ✅ |
| `GET /api/admin/scanners` | 401 | 401 | ✅ |
| `GET /api/ambassadors/active` (no city) | 400 | 400 | ✅ |
| `GET /api/ambassadors/active?city=Tunis` | 200 | 200 | ✅ (public by design) |
| `GET /api/verify-admin` | 401 | 401 | ✅ |
| `POST /api/scanner-login` (empty body) | 400 | 400 | ✅ |
| `POST /api/ambassador-login` (empty body) | 400 | 400 | ✅ |
| `POST /api/academy-influencer/login` (empty body) | 400 | 400 | ✅ |
| `GET /api/tickets/qr/invalid-token-test` | 4xx | 400 | ✅ (no ticket leaked) |

No PII or response bodies captured in this audit artifact.

---

## 17. Findings Register

| ID | Severity | System | Finding | Evidence | Impact | Recommended fix | Priority |
|----|----------|--------|---------|----------|--------|-----------------|----------|
| F-01 | **High** | Scanner | JWT-only auth on `validate-ticket` — no live `is_active`/role check | `api/scan.js` `requireScannerAuth` vs `GET /scanner/session` | Deactivated scanner can mark tickets used for up to 8h | Revalidate scanner row on every mutating route | P1 |
| F-02 | **High** | Scanner | Duplicate-scan race | `api/scan.js` lines 570–582 check-then-update | Same ticket validated twice under concurrency | DB transaction or unique partial index on valid scans per ticket | P1 |
| F-03 | **High** | Scanner/POS | Service role → anon fallback | `getDb()` / `getSupabase()` in `scan.js`, `pos.js` | If env misconfigured, anon+RLS bugs could expose data | Fail fast in production when service role missing | P1 |
| F-04 | Medium | All JWT portals | Shared `JWT_SECRET` | `scan.js`, `pos.js`, `academy-influencer-auth.cjs`, `admin-login.js` | Single secret compromise affects all JWT cookies | Separate secrets per role or migrate scanners to opaque sessions | P2 |
| F-05 | Medium | Scanner admin | Weak admin verify in `scan.js` | `requireAdminAuth` JWT-only | Invalidated admin session may manage scanners until JWT expiry | Use `verifyAdminSession` from `admin-authorization.mjs` | P2 |
| F-06 | Medium | Scanner | No login rate limit | `POST /api/scanner-login` | Credential stuffing | Mirror POS/admin rate limits | P2 |
| F-07 | Medium | Ambassador | Admin password reset doesn't revoke sessions | `admin-data-routes.js` vs `revokeAllAmbassadorSessions` in self-change only | Old sessions remain valid after admin reset | Call `revokeAllAmbassadorSessions` on admin password update | P2 |
| F-08 | Medium | Ambassador | `requires_password_change` not enforced | DB column exists; login handler skips it | Temp passwords usable indefinitely | Enforce at login + route guard like influencer | P2 |
| F-09 | Medium | Ambassador/Influencer | Plaintext temp passwords in email | Email templates / invite flow | Interception exposes credentials | One-time setup links or forced reset on first login only | P2 |
| F-10 | Medium | Scanner | No per-event scanner assignment | All scanners see all events | Scanner at Event A can scan Event B tickets | Optional event-scoped ACL if business requires | P3 |
| F-11 | Low | Ambassador | Min password length 6 | `handleAmbassadorUpdatePassword` | Weak passwords | Align with influencer rules (≥8 + complexity) | P3 |
| F-12 | Low | All | In-memory rate limits on serverless | misc.js, pos.js, influencer rate limit | Cold start resets counters | Upstash/Redis like admin login | P3 |
| F-13 | Low | Legacy | `server.cjs` `/api/validate-ticket` unauthenticated | `server.cjs`, `API_ROUTES.VALIDATE_TICKET` | Local misdeploy risk | Remove or require auth; delete stale constant | P3 |
| F-14 | Low | Scans RLS | Legacy ambassador scan policies remain | Production `pg_policies` on `scans` | Theoretical anon insert if client regresses | Drop unused ambassador scan policies | P3 |
| F-15 | Info | Public API | `/api/ambassadors/active` exposes phone/email | `active-ambassadors-handler.cjs` | Intentional COD UX; privacy consideration | Document; consider masking phone in UI | P4 |
| F-16 | Info | Architecture | No payout/referral APIs | Repo-wide search | No financial payout attack surface | N/A | — |

---

## 18. Recommended Fix Plan

### Emergency fixes (before pentest if scanner is in scope)

1. Add DB revalidation (`is_active`, `role`) to scanner mutating routes, especially `validate-ticket`.
2. Wrap ticket validation in a transaction or add `UNIQUE (qr_ticket_id) WHERE scan_result = 'valid'` partial index.
3. Remove anon key fallback in `scan.js` and `pos.js` for production (`VERCEL=1` / `NODE_ENV=production`).

### Short-term fixes

4. Revoke all ambassador sessions when admin resets ambassador password.
5. Enforce `requires_password_change` for ambassadors (login redirect + API block).
6. Add scanner login rate limiting.
7. Switch `scan.js` admin routes to `verifyAdminSession`.
8. Replace plaintext temp password emails with time-limited setup tokens.
9. Raise ambassador minimum password length to match influencer policy.

### Long-term architecture

10. Consider migrating scanner/POS from shared JWT to opaque DB sessions (ambassador model) for instant revocation.
11. Per-scanner event assignments if operational model requires it.
12. Centralized portal login audit table (success/failure, IP, user agent) for all custom auth systems.
13. Evaluate 2FA for admin and supervisor scanner roles.

### Tests to add

- Unauthenticated 401 matrix (automated CI smoke)
- Deactivated scanner cannot validate ticket (integration test with mock JWT + DB state)
- Concurrent double-scan returns exactly one valid scan
- Admin password reset invalidates ambassador sessions
- Production config test: service role required, no anon fallback

---

## 19. Final Go / No-Go

### Are login systems secure?

**Conditionally yes** for production operation: RLS deny-all on sensitive tables, API-first architecture, HttpOnly cookies, bcrypt passwords, and runtime tests confirm protected routes reject unauthenticated access. **Scanner validation and session invalidation are the weakest links** and should be fixed before calling the posture "pentest-ready."

### Can a pentester retest?

**Yes**, with the understanding that retest should focus on:

- Scanner JWT persistence after deactivation
- Concurrent scan race
- POS/scanner service-role misconfiguration scenarios
- Ambassador session survival after admin password reset
- Public ambassador picker data exposure (`/api/ambassadors/active`)

### What must be fixed first?

1. Scanner DB revalidation on `validate-ticket` (F-01)  
2. Duplicate-scan race (F-02)  
3. Production fail-fast for missing service role on scan/POS (F-03)

### What remains unknown?

- Whether production env always has `SUPABASE_SERVICE_ROLE_KEY` and `JWT_SECRET` set (assumed yes based on working site; not verified directly)
- Whether `AMBASSADOR_SESSION_PEPPER` is set on Vercel (required by code; sessions would fail if missing — site works, so likely configured)
- Full pentest of authenticated flows (order manipulation, IDOR with valid sessions) — out of scope for this read-only audit
- Legacy `scans` ambassador RLS policies — whether any external client still depends on them

---

**Report path:** `security-login-systems-audit-2026-06-27.md`  
**Audit modifications:** None — no code, database, RLS, keys, passwords, deploy, or git changes were made.
