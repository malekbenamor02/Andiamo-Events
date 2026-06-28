# Admin / Super Admin API AuthZ Coverage Audit

**Date:** 2026-06-28  
**Scope:** Full read-only backend route inventory — Vercel serverless, `server.cjs`, Express sub-apps, `vercel.json` rewrites.  
**Prior work:** [security-admin-jwt-auth-audit-2026-06-28.md](security-admin-jwt-auth-audit-2026-06-28.md), [security-admin-jwt-auth-fix-report-2026-06-28.md](security-admin-jwt-auth-fix-report-2026-06-28.md)

---

## 1. Executive Summary

**Overall verdict: NEEDS_FIX** (production Vercel has **CRITICAL** gaps)

| Metric | Count |
|--------|------:|
| Distinct `/api/*` paths reviewed (rewrites + native + `server.cjs`) | **~165** |
| Admin or super_admin-capable routes | **~95** |
| **PASS_AUTHZ** | **~58** |
| **PASS_PUBLIC** | **~28** |
| **PASS_WEBHOOK_INTERNAL** | **~8** |
| **NEEDS_REVIEW** | **~12** |
| **NEEDS_FIX** | **~22** |
| **CRITICAL** | **~8** |

**Direct findings:**

- Recent fixes (**POS**, **approve-order**, **SMS**, **presale**, **event-promo**, **admin-logs**, **logout invalidation**) are **PASS_AUTHZ** on their entrypoints.
- **`api/misc.js` inline handlers** remain the largest gap: many routes use **`verifyAdminAuth` only** (no `effectivePermissionDenied`) while **`server.cjs`** enforces `requireAdminPermission` for the same paths — **Vercel production is weaker**.
- **`vercel.json` rewrites to `misc.js` for routes with no handler in `api/`**: `POST /api/admin/cancel-order`, `POST /api/admin/reject-order`, `GET/PUT /api/admin/payment-options*`, `GET /api/admin/ambassador-sales/overview`, `GET /api/admin/ambassador-sales/logs` — **likely 404 or fall-through on Vercel**, only implemented on `server.cjs`.
- **`POST /api/admin/audit-log`**: any authenticated admin can write audit rows (service role); no permission key.
- **Media upload/delete**: `requireAdminAuth` only — no `settings:manage` / folder permission.
- **Scanner admin routes**: **Vercel `scan.js`** uses effective **`scanners:manage`**; **`server.cjs`** uses **`requireSuperAdmin`** — policy mismatch.
- **No backend route** trusts frontend `localStorage`/`sessionStorage` role or request-body role for authorization (frontend trust audit: **PASS**).
- **`hasPermission(role, …)`** for HTTP authorization: **not found** in API handlers after recent fixes (only in shared permission/tab modules).

---

## 2. Methodology

### Files scanned

- [vercel.json](vercel.json) — 100 `/api/*` rewrites + `functions` config
- Top-level serverless: [api/admin-login.js](api/admin-login.js), [api/admin-approve-order.js](api/admin-approve-order.js), [api/admin-pos.js](api/admin-pos.js), [api/misc.js](api/misc.js), [api/scan.js](api/scan.js), [api/presale.js](api/presale.js), [api/pos.js](api/pos.js), [api/media.js](api/media.js), [api/orders-create.js](api/orders-create.js), [api/passes-[eventId].js](api/passes-[eventId].js), [api/clictopay-generate-payment.js](api/clictopay-generate-payment.js), [api/clictopay-confirm-payment.js](api/clictopay-confirm-payment.js)
- [server.cjs](server.cjs) — all `app.get/post/patch/put/delete` registrations
- Route modules: [api/_lib/admin-data-routes.js](api/_lib/admin-data-routes.js), [api/_lib/admin-privileged-app.cjs](api/_lib/admin-privileged-app.cjs), [api/_lib/register-storage-security-routes.cjs](api/_lib/register-storage-security-routes.cjs), [api/_lib/register-media-routes.cjs](api/_lib/register-media-routes.cjs), [api/_lib/admin-*-routes.cjs](api/_lib/), [careerRoutes.cjs](careerRoutes.cjs), [academyRoutes.cjs](academyRoutes.cjs), [api/_lib/academy-influencer-routes.cjs](api/_lib/academy-influencer-routes.cjs), [api/_lib/presale-route-admin-codes.js](api/_lib/presale-route-admin-codes.js), [api/_lib/event-promo-route-admin.js](api/_lib/event-promo-route-admin.js), [api/_lib/admin-logs-route.js](api/_lib/admin-logs-route.js)

### Rewrite mapping

Each `vercel.json` `source` was mapped to its `destination` entrypoint. Production traffic for most admin APIs hits **`api/misc.js`** (dispatcher), not `server.cjs`.

### Search terms used

`verifyAdminAuth`, `verifyAdminSession`, `requireAdminAuth`, `requireAdminPermission`, `requireSuperAdmin`, `verifySuperAdmin`, `effectivePermissionDenied`, `hasEffectivePermission`, `hasPermission(`, `createAdminDbClient`, `createServiceRoleClient`, `path === '/api/`, `app.post('/api/`, `requireCronSecret`, `requireScannerAdminAuth`

### Permission model

- **Regular admin:** DB-backed effective permissions via `verifyAdminSession` → `admin_tab_access` → `resolveAdminEffectiveAccess` ([shared/admin/tabAccess.cjs](shared/admin/tabAccess.cjs))
- **Super admin:** `role === 'super_admin'` after DB recheck, or effective `permissions` includes `*`

---

## 3. Auth Helpers Reference

| Helper | File | What it verifies | Suitable for | Notes |
|--------|------|------------------|--------------|-------|
| `verifyAdminSession` | [api/_lib/admin-authorization.mjs](api/_lib/admin-authorization.mjs) | Cookie JWT + DB admin + `session_version` + tabs → permissions | Core serverless | Single source of truth |
| `verifyAdminAuth` | [api/_lib/admin-verify.js](api/_lib/admin-verify.js) | Wrapper returning `{ valid, admin, permissions, … }` | Vercel handlers | Does not enforce permissions by itself |
| `effectivePermissionDenied` | [api/_lib/admin-verify.js](api/_lib/admin-verify.js) | `hasEffectivePermission(auth.permissions, key)` | Vercel permission gate | Returns 403 payload or null |
| `hasEffectivePermission` | [shared/admin/permissions.cjs](shared/admin/permissions.cjs) | Tab-derived permission array | Authorization checks | Correct for tab-restricted admins |
| `requireAdmin` | [api/_lib/admin-data-route-helpers.js](api/_lib/admin-data-route-helpers.js) | `verifyAdminAuth` + optional permission + service role client | admin-data-routes | Password-change gate unless `skipPasswordChangeGate` |
| `requireAdminAuth` | [api/_lib/admin-authorization-express.cjs](api/_lib/admin-authorization-express.cjs) | `verifyAdminSession` → `req.admin`, `req.adminPermissions` | Express sub-apps | DB-backed |
| `requireAdminPermission(key)` | [api/_lib/admin-authorization-express.cjs](api/_lib/admin-authorization-express.cjs) | `hasEffectivePermission(req.adminPermissions, key)` | Express routes | Correct pattern |
| `requireSuperAdmin` | [api/_lib/admin-authorization-express.cjs](api/_lib/admin-authorization-express.cjs) | `req.admin.role === 'super_admin'` (after `requireAdminAuth`) | Super-admin-only Express | DB role from session verify |
| `verifySuperAdmin(req)` | [api/misc.js](api/misc.js) ~L6034 | `verifyAdminAuth` + `role === 'super_admin'` | misc inline official-invitations | Inline helper |
| `requireScannerAdminAuth` | [api/_lib/scanner-admin-auth.cjs](api/_lib/scanner-admin-auth.cjs) | `verifyAdminSession` + `scanners:manage` effective | [api/scan.js](api/scan.js) admin scanner routes | **Not** `super_admin` on Vercel |
| `requireCronSecret` | [server.cjs](server.cjs) | `CRON_SECRET` header/query | Cron on local server | Stricter than misc cron fallback |
| `hasPermission(role, perm)` | [shared/admin/permissions.cjs](shared/admin/permissions.cjs) | Static role template | Tab defaults / UI only | **Not** for tab-restricted API auth |

---

## 4. Full Route Inventory

Routes are grouped by **production entrypoint**. Status applies to **Vercel/production** unless noted “server.cjs only”.

### 4.1 Native Vercel files (no rewrite)

| Status | Method | Path | File | Handler | Route Type | Auth Helper | Authorization | Permission / Role | Service Role After Auth? | Notes |
|--------|--------|------|------|---------|------------|-------------|---------------|-------------------|------------------------|-------|
| PASS_PUBLIC | POST | `/api/admin-login` | admin-login.js | default export | public login | none | public | — | yes (login only) | Issues HttpOnly JWT |
| PASS_AUTHZ | POST | `/api/admin-approve-order` | admin-approve-order.js | default ~L78 | admin | verifyAdminAuth | effectivePermissionDenied | orders:manage | yes | Fixed 2026-06-28 |

### 4.2 [api/admin-pos.js](api/admin-pos.js) — global gate ~L753

| Status | Method | Path | Auth | Authorization | Permission | Service Role After Auth? |
|--------|--------|------|------|---------------|------------|--------------------------|
| PASS_AUTHZ | GET/POST/PATCH/DELETE | `/api/admin/pos-outlets*` | verifyAdminAuth | effectivePermissionDenied | pos:manage | yes |
| PASS_AUTHZ | GET/POST/PATCH/DELETE | `/api/admin/pos-users*` | same | same | pos:manage | yes |
| PASS_AUTHZ | GET/POST/PATCH/PUT | `/api/admin/pos-stock*` | same | same | pos:manage | yes |
| PASS_AUTHZ | GET | `/api/admin/pos-audit-log` | same | same | pos:manage | yes |
| PASS_AUTHZ | GET | `/api/admin/pos-events` | same | same | pos:manage | yes |
| PASS_AUTHZ | GET | `/api/admin/pos-statistics` | same | same | pos:manage | yes |
| PASS_AUTHZ | GET/POST/PATCH | `/api/admin/pos-orders*` | same | same | pos:manage | yes |

### 4.3 [api/scan.js](api/scan.js)

| Status | Method | Path | Auth | Authorization | Permission / Role | Service Role After Auth? | Notes |
|--------|--------|------|------|---------------|-------------------|------------------------|-------|
| PASS_PUBLIC | GET | `/api/scan-system-status` | none | — | — | optional | Public `{ enabled }` |
| PASS_PUBLIC | POST | `/api/scanner-login` | scanner creds | — | — | yes | Issues scanner cookie |
| PASS_PUBLIC | POST | `/api/scanner-logout` | none | — | — | — | Clears cookie |
| PASS_AUTHZ | GET/PATCH | `/api/admin/scan-system-config` | requireScannerAdminAuth | hasEffectivePermission | scanners:manage | yes | Comments say super_admin; code uses permission |
| PASS_AUTHZ | GET/POST/PATCH/DELETE | `/api/admin/scanners*` | requireScannerAdminAuth | scanners:manage | scanners:manage | yes | |
| PASS_AUTHZ | GET | `/api/admin/scan-history`, `scan-statistics`, `scanners/:id/*` | requireScannerAdminAuth | scanners:manage | scanners:manage | yes | |
| PASS_WEBHOOK_INTERNAL | POST | `/api/scanner/validate-ticket` | requireScannerAuth | scanner session | — | yes | Not admin |
| PASS_WEBHOOK_INTERNAL | GET/POST | `/api/scanner/*` (events, scans, supervisor) | scanner (+ supervisor) | — | — | yes | Not admin |

### 4.4 [api/presale.js](api/presale.js)

| Status | Method | Path | Auth | Authorization | Permission | Service Role After Auth? |
|--------|--------|------|------|---------------|------------|--------------------------|
| PASS_PUBLIC | GET/POST | `/api/presale/required`, `redeem`, `session*` | none / session | — | — | yes/anon |
| PASS_AUTHZ | * | `/api/admin/presale/codes*` | verifyAdminAuth | effectivePermissionDenied | events:manage | yes |
| PASS_PUBLIC | GET/POST | `/api/event-promo/availability`, `validate` | none | — | — | yes |
| PASS_AUTHZ | * | `/api/admin/event-promo/*` | verifyAdminAuth | requireEventsManage | events:manage | yes |

### 4.5 [api/_lib/admin-data-routes.js](api/_lib/admin-data-routes.js) via misc `handleAdminDataRoutes`

| Status | Method | Path | Auth | Authorization | Permission | Service Role After Auth? |
|--------|--------|------|------|---------------|------------|--------------------------|
| PASS_AUTHZ | GET | `/api/admin/dashboard/bootstrap` | requireAdmin | hasEffectivePermission (sections) | dashboard:view + conditional | yes |
| PASS_AUTHZ | GET/POST/PATCH/DELETE | `/api/admin/ambassadors*` | requireAdmin | PERM.AMBASSADORS | ambassadors:manage | yes |
| PASS_AUTHZ | GET | `/api/admin/ambassador-applications` | requireAdmin | PERM.APPLICATIONS | applications:manage | yes |
| PASS_AUTHZ | GET/PATCH/DELETE | `/api/admin/contact-messages*` | requireAdmin | PERM.CONTACT_MESSAGES | contact:view | yes |
| PASS_AUTHZ | GET/PATCH/DELETE | `/api/admin/subscribers/phones*`, `newsletters*` | requireAdmin | PERM.SUBSCRIBERS | marketing:manage | yes |
| PASS_AUTHZ | GET/PATCH/DELETE | `/api/admin/audience-suggestions*` | requireAdmin | PERM.AUDIENCE_SUGGESTIONS | suggestions:manage | yes |
| PASS_AUTHZ | GET | `/api/admin/sms-logs`, `/api/admin/site-logs` | requireAdmin | PERM.LOGS | logs:view | yes |
| PASS_AUTHZ | GET | `/api/admin/order-passes` | requireAdmin | PERM.ORDER_PASSES | orders:manage | yes |
| PASS_AUTHZ | * | `/api/admin/application-selections*` | requireAdmin | PERM.APPLICATIONS | applications:manage | yes |
| PASS_AUTHZ | POST | `/api/admin/change-password` | requireAdmin (skipPasswordChangeGate) | auth only (intended) | — | yes |

### 4.6 [api/_lib/admin-privileged-app.cjs](api/_lib/admin-privileged-app.cjs) via misc `isAdminPrivilegedPath`

| Status | Method | Path | Auth | Authorization | Permission / Role | Service Role After Auth? |
|--------|--------|------|------|---------------|-------------------|------------------------|
| PASS_AUTHZ | PUT | `/api/admin/site-content/:key` | requireAdminAuth + requireAdminPermission | settings:manage | settings:manage | yes |
| PASS_AUTHZ | GET/POST/PATCH/DELETE | `/api/admin/admins*` | requireAdminAuth + requireAdminPermission | admins:manage | admins:manage | yes |
| PASS_AUTHZ | * | `/api/admin/sponsors*` | requireAdminPermission | sponsors:manage | sponsors:manage | yes |
| PASS_AUTHZ | * | `/api/admin/team-members*` | requireAdminPermission | team:manage | team:manage | yes |
| PASS_AUTHZ | GET/PATCH/POST | `/api/admin/orders/*`, analytics, order-logs | requireAdminPermission | orders:manage / reports:view / ambassador_sales:manage | per route | yes |
| NEEDS_REVIEW | POST | `/api/admin/audit-log` | requireAdminAuth only | **none** | any authenticated admin | yes |
| PASS_AUTHZ | GET | `/api/admin/audit-logs` | requireAdminPermission | admins:manage | admins:manage | yes |

### 4.7 Storage / media ([register-storage-security-routes.cjs](api/_lib/register-storage-security-routes.cjs), misc dispatch)

| Status | Method | Path | Auth | Authorization | Permission | Service Role After Auth? |
|--------|--------|------|------|---------------|------------|--------------------------|
| PASS_PUBLIC | GET | `/api/tickets/qr/:secureToken` | token in URL | — | — | yes |
| PASS_PUBLIC | POST | `/api/careers/upload-document` | none | — | — | yes |
| PASS_AUTHZ | GET | `/api/admin/careers/applications/:id/document-url` | requireAdminAuth + permission | careers:manage | careers:manage | yes |
| NEEDS_FIX | POST | `/api/admin/media/upload`, `/api/media/upload` | requireAdminAuth only | **none** | any admin | R2 |
| NEEDS_FIX | POST | `/api/admin/media/delete`, `/api/media/delete`, `favicon/cleanup` | requireAdminAuth only | **none** | any admin | R2 |

### 4.8 [careerRoutes.cjs](careerRoutes.cjs) via misc

Public: `GET /api/careers/*` (page-content, domains, city/gender options), `POST /api/career-application*`.

| Status | Method | Path | Auth | Authorization | Permission |
|--------|--------|------|------|---------------|------------|
| PASS_AUTHZ | * | `/api/admin/careers/*` (most) | requireAdminAuth + requireAdminPermission | careers:manage |
| NEEDS_REVIEW | GET | `/api/admin/careers/applications/:id` | requireAdminAuth **only** ~L1389 | **no careers:manage** | Reads PII + signed doc URLs |

### 4.9 Academy ([academyRoutes.cjs](academyRoutes.cjs), [academy-influencer-routes.cjs](api/_lib/academy-influencer-routes.cjs))

| Status | Method | Path | Auth | Authorization |
|--------|--------|------|------|---------------|
| PASS_PUBLIC | * | `/api/academy/status`, `register`, `validate-promo`, `clictopay-*`, `registration/:id/status` | none / payment | — |
| PASS_WEBHOOK_INTERNAL | GET/POST | `/api/auto-cancel-expired-academy-registrations` | requireCronSecret | CRON_SECRET |
| PASS_AUTHZ | * | `/api/admin/academy/*` | requireAdminAuth + requireAdminPermission | academy:manage |
| PASS_WEBHOOK_INTERNAL | * | `/api/academy-influencer/*` | influencer session auth | — |

### 4.10 [api/misc.js](api/misc.js) — inline handlers (selected; production-critical)

| Status | Method | Path | Auth | Authorization | Expected permission | Service Role After Auth? |
|--------|--------|------|------|---------------|-------------------|------------------------|
| PASS_PUBLIC | POST | `/api/site-logs` | none | — | — | anon |
| PASS_AUTHZ | GET | `/api/verify-admin` | handleVerifyAdmin → verifyAdminSession | returns permissions | — | yes (read) |
| PASS_PUBLIC | GET | `/api/events/by-slug/*`, `by-id/*` | public handlers | — | — | anon |
| PASS_PUBLIC | POST | `/api/admin-logout` | handleAdminLogout | session_version bump | — | yes |
| PASS_AUTHZ | POST | `/api/admin-update-application` | verifyAdminAuth | hasEffectivePermission | applications:manage | yes |
| NEEDS_FIX | POST | `/api/send-email` | verifyAdminAuth only ~L2514 | **none** | marketing or dedicated | no DB |
| NEEDS_FIX | POST/PATCH/DELETE | `/api/admin/events*` ~L2660 | verifyAdminAuth only | **none** | events:manage | yes |
| NEEDS_FIX | POST | `/api/admin/passes/create` ~L2828 | verifyAdminAuth only | **none** | events:manage | yes |
| NEEDS_FIX | GET | `/api/admin/passes/:eventId` ~L2912 | verifyAdminAuth only | **none** | events:manage | yes |
| NEEDS_FIX | POST/PATCH/PUT/DELETE | passes stock/payment-methods/description/activate ~L3066+ | verifyAdminAuth only | **none** | events:manage | yes |
| NEEDS_FIX | POST | `/api/admin-skip-ambassador-confirmation` ~L3548 | verifyAdminAuth only | **none** | orders:manage | yes |
| NEEDS_FIX | POST | `/api/admin/update-order-email` ~L4127 | verifyAdminAuth only | **none** | orders:manage | yes |
| NEEDS_FIX | POST | `/api/admin/update-order-notes` ~L4242 | verifyAdminAuth only | **none** | orders:manage | yes |
| PASS_AUTHZ | GET | `/api/admin/order-qr-tickets` ~L4350 | verifyAdminAuth | role === super_admin | super_admin | yes |
| NEEDS_FIX | POST | `/api/admin-resend-ticket-email`, `resend-order-completion-email` ~L4463 | verifyAdminAuth only | **none** | orders:manage | yes |
| NEEDS_REVIEW | GET/POST | `/api/auto-reject-expired-orders` ~L4848 | CRON_SECRET **or any admin** | **no permission** | cron / orders:manage | yes |
| NEEDS_REVIEW | GET/POST | `/api/auto-fail-pending-online-orders` ~L4970 | same pattern | **no permission** | cron | yes |
| NEEDS_FIX | GET | `/api/admin/ambassador-sales/orders` ~L5105 | verifyAdminAuth only | **none** | ambassador_sales:manage | yes |
| NEEDS_FIX | POST | `/api/admin-remove-order` ~L5277 | verifyAdminAuth only | **none** | orders:manage | yes |
| NEEDS_FIX | GET/POST/DELETE | `/api/admin/order-expiration-*` ~L5506+ | verifyAdminAuth only | **none** | settings:manage | yes |
| NEEDS_FIX | GET | `/api/admin/aio-events-submissions` ~L5858 | verifyAdminAuth only | **none** | aio_events:view | yes |
| NEEDS_FIX | GET | `/api/admin/consultation-inquiries` ~L5983 | verifyAdminAuth only | **none** | consultation_inquiries:view | yes |
| PASS_AUTHZ | GET | `/api/admin/official-invitations*` | verifySuperAdmin | super_admin | super_admin | yes |
| PASS_AUTHZ | POST | `/api/admin/official-invitations/create` | verifySuperAdmin | super_admin | super_admin | yes |
| PASS_AUTHZ | GET | `/api/admin/logs` | handleAdminLogs | effectivePermissionDenied | logs:view | yes |
| NEEDS_REVIEW | GET | `/api/admin/csp-reports` ~L6767 | verifyAdminAuth only | **none** | logs:view? | yes |
| PASS_AUTHZ | GET/PUT | marketing paths (phone/email/investor) | pre-gate verifyAdminAuth | hasEffectivePermission | marketing:manage | yes |
| PASS_AUTHZ | POST/GET | `/api/send-sms`, `bulk-sms/send`, `sms-balance` | verifyAdminAuth | effectivePermissionDenied | marketing:manage | yes |
| PASS_WEBHOOK_INTERNAL | GET/POST | `/api/marketing/cron/email-campaigns` ~L7985 | CRON_SECRET required | — | — | yes |
| PASS_AUTHZ | * | `/api/marketing/campaigns*` | marketing pre-gate | marketing:manage | marketing:manage | yes |
| PASS_AUTHZ | POST | `/api/aio-events/save-submission` | public + rate limit | — | — | yes if configured |
| PASS_PUBLIC | * | ambassador-login, application, phone-subscribe, etc. | ambassador/public | — | — | varies |

### 4.11 CRITICAL — `vercel.json` → `misc.js` but **no handler in `api/`**

Grep across `api/` found **no** implementation for:

| Status | Method | Path | vercel.json | server.cjs | Notes |
|--------|--------|------|-------------|------------|-------|
| **CRITICAL** | POST | `/api/admin/cancel-order` | → misc.js | requireAdminPermission orders:manage ~L5369 | **Missing on Vercel** |
| **CRITICAL** | POST | `/api/admin/reject-order` | → misc.js | requireAdminPermission orders:manage ~L5674 | **Missing on Vercel** |
| **CRITICAL** | GET | `/api/admin/payment-options` | → misc.js | requireAdminAuth ~L5259 | **Missing on Vercel** |
| **CRITICAL** | PUT | `/api/admin/payment-options/:type` | → misc.js | settings:manage ~L5283 | **Missing on Vercel** |
| **CRITICAL** | GET | `/api/admin/ambassador-sales/overview` | → misc.js | ambassador_sales:manage ~L6709 | **Missing on Vercel** |
| **CRITICAL** | GET | `/api/admin/ambassador-sales/logs` | → misc.js | reports:view ~L6870 | **Missing on Vercel** |

### 4.12 Other entrypoints

| Status | Method | Path | File | Auth | Notes |
|--------|--------|------|------|------|-------|
| PASS_PUBLIC | POST | `/api/orders/create` | orders-create.js | IP rate limit | Service role; public checkout |
| PASS_PUBLIC | GET | `/api/passes/:eventId` | passes-[eventId].js | none | Public pass list |
| PASS_PUBLIC | POST | `/api/clictopay-*` | clictopay-*.js | none | Payment fulfillment |
| PASS_WEBHOOK_INTERNAL | * | `/api/pos/:outletSlug/*` | pos.js | POS session | Not admin |
| PASS_PUBLIC | GET | `/api/payment-options` | server.cjs only ~L5234 | none | Public enabled methods |
| INFO | * | [api/media.js](api/media.js) | standalone file | same as storage routes | **Rewrites point to misc.js**, not media.js |

### 4.13 [server.cjs](server.cjs) — local dev (representative; ~100+ routes)

Most admin routes use **`requireAdminAuth` + `requireAdminPermission`** or **`requireSuperAdmin`**. Scanner admin routes use **`requireSuperAdmin`** (stricter than Vercel `scan.js`).

Notable **server-only** or **divergent** routes:

| Status | Method | Path | Notes |
|--------|--------|------|-------|
| NEEDS_FIX (server) | GET | `/api/sms-balance` ~L4115 | auth only — no marketing:manage (Vercel misc fixed) |
| CRITICAL (server) | POST | `/api/send-order-confirmation-sms` ~L4199 | **no auth** |
| CRITICAL (server) | POST | `/api/send-ambassador-order-sms` ~L4334 | **no auth** |
| CRITICAL (server) | POST | `/api/generate-qr-code` | **no auth** (if still present) |
| PASS_AUTHZ | POST | `/api/admin/cancel-order`, `reject-order` | orders:manage — **not on Vercel** |

---

## 5. Admin Routes Passing

Routes with **PASS_AUTHZ** (auth + correct effective permission or DB-backed super_admin):

- Entire [api/admin-pos.js](api/admin-pos.js) surface (`pos:manage`)
- [api/admin-approve-order.js](api/admin-approve-order.js) (`orders:manage`)
- [api/_lib/admin-data-routes.js](api/_lib/admin-data-routes.js) (all `requireAdmin` routes)
- [api/_lib/admin-privileged-app.cjs](api/_lib/admin-privileged-app.cjs) except `POST /api/admin/audit-log`
- Presale/event-promo admin ([api/presale.js](api/presale.js) → `events:manage`)
- [api/_lib/admin-logs-route.js](api/_lib/admin-logs-route.js) (`logs:view`)
- misc: `admin-update-application`, `verify-admin`, marketing-gated paths, SMS trio, official-invitations (super_admin), `admin/logs` delegate
- [api/scan.js](api/scan.js) admin scanner routes (`scanners:manage` effective)
- Career admin routes (except `GET applications/:id`)
- Academy admin routes (`academy:manage`)

---

## 6. Super Admin Routes Passing

| Method | Path | File | Enforcement | DB-backed? |
|--------|------|------|-------------|------------|
| GET | `/api/admin/order-qr-tickets` | misc.js ~L4360 | `authResult.admin?.role !== 'super_admin'` after verifyAdminAuth | yes (role from DB via verify) |
| GET/POST/DELETE | `/api/admin/official-invitations*` | misc.js | `verifySuperAdmin(req)` → role check | yes |
| GET/POST/PATCH/DELETE | `/api/admin/scanners*` etc. | server.cjs only | `requireSuperAdmin` | yes |
| GET/PATCH | `/api/admin/scan-system-config` | server.cjs | `requireSuperAdmin` | yes |

**Note:** Vercel production scanner admin uses **`scanners:manage`** effective permission, not `super_admin` — see parity section.

---

## 7. Public Routes Confirmed Safe

Intentionally public (no admin JWT); sensitive mutation either absent or expected:

- `POST /api/admin-login` — credential gate + bcrypt
- `GET /api/scan-system-status`, `GET /api/passes/:eventId`, `GET /api/payment-options` (server)
- `GET /api/events/by-slug/*`, `by-id/*`
- Presale/event-promo public validate/redeem/session
- `POST /api/orders/create` — public checkout (service role; business requirement)
- `POST /api/clictopay-*` — payment callbacks
- Ambassador application/login, `GET /api/ambassadors/active`
- `POST /api/phone-subscribe`, `POST /api/audience-suggestions` (rate limited)
- `GET /api/tickets/qr/:secureToken` — opaque token
- `POST /api/careers/upload-document` — public application flow
- Academy public registration/status endpoints

---

## 8. Webhook / Internal Routes

| Method | Path | Verification | Notes |
|--------|------|--------------|-------|
| GET/POST | `/api/marketing/cron/email-campaigns` | `CRON_SECRET` (misc ~L7985) | Fails closed without secret |
| GET/POST | `/api/auto-cancel-expired-academy-registrations` | `requireCronSecret` | Academy |
| GET/POST | `/api/auto-reject-expired-orders` | CRON_SECRET **or any admin JWT** (misc) | Weaker than server `requireCronSecret` |
| GET/POST | `/api/auto-fail-pending-online-orders` | same | Weaker than strict cron-only |
| POST | `/api/scanner-login` | scanner password | Issues scannerToken |
| POST | `/api/pos/:slug/login` | POS credentials | POS session |

---

## 9. Findings

| Severity | Status | Method | Path | File | Finding | Evidence | Risk | Recommended Fix |
|----------|--------|--------|------|------|---------|----------|------|-----------------|
| CRITICAL | CRITICAL | POST | `/api/admin/cancel-order` | vercel.json → misc.js | **No handler in api/** | grep `api/` no matches; server.cjs L5369 | Order cancel broken or unhandled on Vercel | Implement in misc with `orders:manage` or forward to shared module |
| CRITICAL | CRITICAL | POST | `/api/admin/reject-order` | vercel.json → misc.js | **No handler in api/** | server.cjs L5674 | COD reject unavailable on Vercel | Same |
| CRITICAL | CRITICAL | GET/PUT | `/api/admin/payment-options*` | vercel.json → misc.js | **No handler in api/** | server.cjs L5259–5283 | Admin payment config broken on Vercel | Port handlers to misc or privileged app |
| CRITICAL | CRITICAL | GET | `/api/admin/ambassador-sales/overview` | vercel.json → misc.js | **No handler** | server.cjs L6709 only | Dashboard metrics 404 on Vercel | Add handler + `ambassador_sales:manage` |
| CRITICAL | CRITICAL | GET | `/api/admin/ambassador-sales/logs` | vercel.json → misc.js | **No handler** | server.cjs L6870 only | Reports 404 on Vercel | Add handler + `reports:view` |
| HIGH | NEEDS_FIX | POST/PATCH/DELETE | `/api/admin/events*` | misc.js L2660 | Auth only, no `events:manage` | verifyAdminAuth then service role insert | Any logged-in admin mutates events on Vercel | Add `effectivePermissionDenied(..., 'events:manage')` |
| HIGH | NEEDS_FIX | POST/GET/PATCH… | `/api/admin/passes/*` | misc.js L2828+ | Auth only | same pattern | Pass/stock mutation by any admin | `events:manage` effective gate |
| HIGH | NEEDS_FIX | POST | `/api/admin-remove-order` | misc.js L5277 | Auth only | server has orders:manage | Order deletion by any admin | `orders:manage` |
| HIGH | NEEDS_FIX | GET | `/api/admin/ambassador-sales/orders` | misc.js L5105 | Auth only | server L6801 has permission | Sales data leak to any admin | `ambassador_sales:manage` |
| HIGH | NEEDS_FIX | POST | `/api/send-email` | misc.js L2512 | Auth only | arbitrary email send | Phishing/abuse | Permission or dedicated allowlist |
| MEDIUM | NEEDS_FIX | POST | `/api/admin/media/upload`, delete | register-storage-security | requireAdminAuth only | L80+ register-media | Any admin uploads to R2 | `settings:manage` or media permission |
| MEDIUM | NEEDS_REVIEW | POST | `/api/admin/audit-log` | admin-audit-logs-routes.cjs L10 | Auth only | inserts admin_logs | Log forgery | `logs:view` or `admins:manage` |
| MEDIUM | NEEDS_REVIEW | GET | `/api/admin/careers/applications/:id` | careerRoutes.cjs L1389 | Auth only | PII + signed URLs | careers:manage |
| MEDIUM | NEEDS_REVIEW | GET/POST | `/api/auto-reject-expired-orders` | misc.js L4854 | Wrong cron secret → **any admin** | bulk order reject | Restrict to cron secret only |
| MEDIUM | INFO | * | Scanner admin | scan.js vs server.cjs | `scanners:manage` vs `super_admin` | policy drift | Align product policy |
| HIGH | CRITICAL | POST | `/api/send-order-confirmation-sms` | server.cjs ~L4199 | **No auth** (local) | SMS send | Block or sign on Vercel if exposed |
| LOW | INFO | GET | `/api/sms-balance` | server.cjs L4115 | Auth only on local | Vercel fixed | Align server.cjs with misc |

---

## 10. Service Role Access Audit

| File | Function / area | Uses service role? | Auth before service role? | Verdict | Notes |
|------|-----------------|-------------------|---------------------------|---------|-------|
| admin-login.js | login | yes | N/A (login) | PASS | Expected |
| admin-approve-order.js | approve | yes | yes + orders:manage | PASS | |
| admin-pos.js | all | yes | yes + pos:manage | PASS | |
| admin-data-routes.js | requireAdmin | yes | yes + permission | PASS | |
| admin-privileged-app.cjs | Express routes | yes | requireAdminAuth first | PASS | except audit-log POST |
| misc.js events block | L2675 | yes | verifyAdminAuth only | **NEEDS_FIX** | Permission missing |
| misc.js missing routes | cancel/reject/payment | yes on server | N/A on Vercel | **CRITICAL** | Handlers absent |
| orders-create.js | checkout | yes | public | PASS_PUBLIC | By design |
| clictopay-confirm | payment | yes | public/webhook | PASS_WEBHOOK_INTERNAL | |
| presale admin | codes | yes | yes + events:manage | PASS | |

---

## 11. Role-static Check Audit

| Location | Pattern | Verdict |
|----------|---------|---------|
| [shared/admin/permissions.cjs](shared/admin/permissions.cjs) `hasPermission(role, …)` | Role template for default tabs | **Safe** — not HTTP handler |
| [api/_lib/admin-authorization.cjs](api/_lib/admin-authorization.cjs) | CJS bridge export | **Safe** — wrapper only |
| API HTTP handlers (post 2026-06-28 fix) | `hasPermission(auth.admin.role, …)` | **Not found** in route handlers |
| misc.js order-qr-tickets | `role !== 'super_admin'` | **Safe** — explicit super_admin after verifyAdminAuth |
| misc.js official-invitations | `verifySuperAdmin` | **Safe** — DB-backed role |

---

## 12. Frontend Trust Audit

| Trust vector | Backend usage | Verdict |
|--------------|---------------|---------|
| Frontend role in request body | not found in admin API handlers | **PASS** |
| Frontend tabs/permissions in body | not found | **PASS** |
| Query param `role` | not found for authorization | **PASS** |
| localStorage / sessionStorage | not read server-side | **PASS** (UI-only cache in [src/lib/admin-verify-cache.ts](src/lib/admin-verify-cache.ts)) |
| JWT claims alone for permissions | mitigated by `verifyAdminSession` DB reload | **PASS** where verifyAdminAuth used |

---

## 13. server.cjs vs Vercel Parity

| Area | server.cjs | Vercel production | Mismatch |
|------|------------|-------------------|----------|
| Admin login | session_version, is_active (aligned) | admin-login.js | **Aligned** (post fix) |
| Admin logout | handleAdminLogout | misc.js same | **Aligned** |
| Events/passes CRUD | `events:manage` | auth only in misc | **Vercel weaker** |
| Order cancel/reject | implemented | **missing** | **CRITICAL** |
| Payment options admin | implemented | **missing** | **CRITICAL** |
| Ambassador-sales overview/logs | implemented | **missing** | **CRITICAL** |
| SMS balance | auth only | marketing:manage | server weaker |
| Scanner admin | `requireSuperAdmin` | `scanners:manage` | **Policy differs** |
| Auto-reject cron | `requireCronSecret` | cron OR any admin | **Vercel weaker** |
| Admin approve order | `orders:manage` | admin-approve-order.js | **Aligned** |
| POS | app.use → admin-pos.js | admin-pos.js | **Aligned** |

---

## 14. Test Coverage Recommendation

| Route / area | Suggested test |
|--------------|----------------|
| misc.js events/passes | Static: `effectivePermissionDenied(..., 'events:manage')` after verifyAdminAuth |
| cancel-order / reject-order | Integration: rewrite path returns 401 without auth, 403 without orders:manage, 200 with permission — after implementation |
| payment-options | Same pattern with `settings:manage` |
| ambassador-sales overview/logs/orders | Permission gates per server.cjs mapping |
| POST /api/admin/audit-log | Deny without `admins:manage` or allow only self-action |
| Media upload | Deny without `settings:manage` |
| auto-reject-expired-orders | Deny admin JWT when cron secret wrong; allow only with secret |
| scan.js vs server scanner policy | Documented contract test for role vs permission |
| HTTP probe script | Extend [scripts/security/check-admin-service-role-auth.mjs](scripts/security/check-admin-service-role-auth.mjs) with missing paths |

---

## 15. Final Verdict

| Question | Answer |
|----------|--------|
| **Do all admin APIs have authentication?** | **No.** Most do; **missing handlers** on Vercel are not auth failures but **broken/exposed routing**; some **server.cjs-only** public SMS routes have **no auth**. |
| **Do all admin APIs have authorization?** | **No.** **`api/misc.js` inline admin handlers** (~20 routes) use **auth only** on Vercel while `server.cjs` enforces permissions. Fixed entrypoints (POS, approve-order, SMS, presale, promo, logs) are correct. |
| **Do all super_admin APIs enforce super_admin?** | **Mostly yes** where implemented (official-invitations, order-qr-tickets). Scanner admin on **Vercel uses `scanners:manage`**, not super_admin. |
| **Is service-role access always after auth?** | **Yes** for implemented handlers except **login** and **intentional public** checkout/payment. **Concern:** auth-without-permission routes still reach service role after weak auth. |
| **Can a tab-restricted admin bypass permissions anywhere?** | **Yes on Vercel** for misc inline routes (events, passes, orders, ambassador-sales orders, expiration settings, etc.) — any authenticated admin with a valid JWT. **No** on admin-data-routes, privileged-app, admin-pos, fixed SMS/presale/promo. |
| **What must be fixed before production?** | 1) **Implement missing Vercel handlers** (cancel/reject order, payment-options, ambassador-sales overview/logs). 2) Add **`effectivePermissionDenied`** to all misc.js inline admin mutators to match server.cjs. 3) Fix **audit-log POST**, **media upload**, **careers application GET :id** permissions. 4) Align **cron** endpoints to secret-only. 5) Resolve **scanner admin** policy (super_admin vs scanners:manage). 6) Remove or protect **server.cjs unauthenticated SMS** routes if ever deployed. |

---

*Read-only audit. No source code, migrations, or environment files were modified.*
