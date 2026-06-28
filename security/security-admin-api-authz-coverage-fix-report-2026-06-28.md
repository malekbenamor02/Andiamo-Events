# Admin / Super Admin API AuthZ Coverage Fix Report

**Date:** 2026-06-28  
**Prior audit:** [security-admin-api-authz-coverage-audit-2026-06-28.md](security-admin-api-authz-coverage-audit-2026-06-28.md)

---

## 1. Executive Summary

**Final verdict: PASS** (with CSRF follow-up noted below)

| Item | Count |
|------|------:|
| CRITICAL findings fixed | **6** (missing Vercel handlers) |
| NEEDS_FIX inline misc routes fixed | **~18** |
| NEEDS_REVIEW special routes fixed | **6** |
| Intentionally deferred | **CSRF** on state-changing admin POSTs (separate hardening track) |

Production Vercel (`api/misc.js` + sub-apps) and `server.cjs` now enforce **JWT admin authentication** plus **DB-backed effective permissions** (or documented super_admin / cron paths) before service-role access on all audited admin surfaces.

---

## 2. Files Changed

| File | Change | Security Impact |
|------|--------|-----------------|
| `api/_lib/admin-permission-gate-http.js` | **New** — `gateAdminPermission`, `authorizeCronOrAdminPermission` | Reusable auth + effective permission gates |
| `api/_lib/admin-missing-routes-http.js` | **New** — cancel/reject order, payment-options, ambassador-sales overview/logs | Closes CRITICAL Vercel 404 gaps |
| `api/_lib/release-order-stock.cjs` | **New** — shared stock release | Safe reuse from Vercel + server |
| `api/misc.js` | Permission gates on ~18 inline routes; cron auth; dispatch missing handlers | Tab-restricted admins cannot bypass on Vercel |
| `api/_lib/register-storage-security-routes.cjs` | Media routes + `settings:manage` | Blocks arbitrary admin uploads |
| `api/_lib/register-media-routes.cjs` | Requires `requireAdminPermission`; `settings:manage` on upload/delete | Same |
| `api/_lib/admin-audit-logs-routes.cjs` | `POST /api/admin/audit-log` → `admins:manage` | Prevents audit log forgery by any admin |
| `careerRoutes.cjs` | `GET applications/:id` → `careers:manage` | PII + signed URLs gated |
| `server.cjs` | Scanner `scanners:manage`; SMS/QR/cron parity; `releaseOrderStock` shared; sms-balance `marketing:manage` | Local dev matches Vercel policy |
| `api/_lib/admin-api-authz-coverage.test.cjs` | **New** — static coverage tests | Regression lock |
| `package.json` | Extended `test:admin-auth-order`; added `test:admin-api-authz-coverage` | CI gate |

---

## 3. Critical Vercel Handler Fixes

| Route | Old production behavior | New production behavior | Permission | Tests |
|-------|-------------------------|-------------------------|------------|-------|
| `POST /api/admin/cancel-order` | No handler (rewrite → misc 404) | `handleAdminMissingRoutes` → cancel + stock release | `orders:manage` | `admin-api-authz-coverage.test.cjs` |
| `POST /api/admin/reject-order` | No handler | Reject + stock release | `orders:manage` | same |
| `GET /api/admin/payment-options` | No handler | List **all** payment options (`select *`, incl. disabled + external app config) | `settings:manage` | same |
| `PUT /api/admin/payment-options/:type` | No handler | Update payment option | `settings:manage` | same |
| `GET /api/admin/ambassador-sales/overview` | No handler | Analytics overview | `ambassador_sales:manage` | same |
| `GET /api/admin/ambassador-sales/logs` | No handler | Order logs for ambassador cash | `reports:view` | same |

---

## 4. misc.js Inline Admin Route Fixes

| Route | Old auth | New authz | Permission |
|-------|----------|-----------|------------|
| `POST /api/send-email` | `verifyAdminAuth` only | `gateAdminPermission` | `marketing:manage` |
| `POST/PATCH/DELETE /api/admin/events*` | auth only | gate | `events:manage` |
| `/api/admin/passes/*` (create, GET, stock, payment-methods, description, activate) | auth only | gate | `events:manage` |
| `POST /api/admin-skip-ambassador-confirmation` | auth only | gate | `orders:manage` |
| `POST /api/admin/update-order-email` | auth only | gate | `orders:manage` |
| `POST /api/admin/update-order-notes` | auth only | gate | `orders:manage` |
| `POST /api/admin-resend-ticket-email`, `resend-order-completion-email` | auth only | gate | `orders:manage` |
| `POST /api/admin-remove-order` | auth only | gate | `orders:manage` |
| `GET /api/admin/ambassador-sales/orders` | auth only | gate | `ambassador_sales:manage` |
| `GET/POST /api/admin/order-expiration-*` | auth only | gate | `settings:manage` |
| `GET /api/admin/aio-events-submissions` | auth only | gate | `marketing:manage` |
| `GET /api/admin/consultation-inquiries` | auth only | gate | `consultation_inquiries:view` |
| `GET /api/admin/csp-reports` | auth only | gate | `logs:view` |
| `GET/POST /api/auto-reject-expired-orders` | CRON or **any** admin | `authorizeCronOrAdminPermission` | cron **or** `orders:manage` |
| `GET/POST /api/auto-fail-pending-online-orders` | same | same | cron **or** `orders:manage` |

---

## 5. Special Route Fixes

### Payment options (`GET /api/admin/payment-options`)

- **Permission:** `settings:manage` on Vercel and `server.cjs` (aligned with `PUT`).
- **Rationale:** Unlike public `GET /api/payment-options` (enabled rows only), the admin route returns the full `payment_options` row set — disabled methods, `app_name`, `external_link`, `app_image`. That is site payment configuration consumed by `PaymentOptionsManager` on the **Settings** tab (`settings:manage` in `tabDefinitions.data.json`).

### AIO events submissions (`GET /api/admin/aio-events-submissions`)

- **Permission:** `marketing:manage` (replaces invalid `aio_events:view`).
- **Rationale:** No `aio_events:view` tab exists in `tabDefinitions.data.json`, so regular tab-restricted admins could never receive that key. Submission PII is already used as a **marketing** bulk SMS/email source (`aio_events_submissions` in `BulkSmsSelector` / `BulkEmailSelector`); gating with `marketing:manage` matches product use and tab access.

### audit-log (`POST /api/admin/audit-log`)

- **Decision:** Require `admins:manage`. Actor fields always taken from `req.admin` (session), not request body — no spoofing.
- **Rationale:** Writing audit rows is a privileged admin action; viewing audit logs already requires `admins:manage`.

### Media upload/delete

- **Permission:** `settings:manage` on `/api/admin/media/*` and `/api/media/*` in both `register-storage-security-routes.cjs` and `register-media-routes.cjs`.

### Career application detail

- **Route:** `GET /api/admin/careers/applications/:id`
- **Permission:** `careers:manage` (aligned with other career admin routes).

### Cron / internal

- **Vercel:** `authorizeCronOrAdminPermission` — valid `CRON_SECRET` **or** admin with `orders:manage` for manual dashboard triggers.
- **server.cjs:** `requireCronSecretOrAdminPermission('orders:manage')` on auto-reject GET/POST.

### server.cjs SMS / QR (local only)

- `POST /api/send-order-confirmation-sms`, `send-ambassador-order-sms`, `generate-qr-code` → `requireCronSecretOrAdminPermission('orders:manage')`.
- Internal order-create `fetch` now sends `x-cron-secret` when `CRON_SECRET` is set.
- `GET /api/sms-balance` → `marketing:manage` (Vercel parity).

### Scanner policy

- **Chosen policy:** **`scanners:manage` effective permission** (delegatable via admin tab access).
- **Vercel:** unchanged (`api/scan.js` + `requireScannerAdminAuth`).
- **server.cjs:** scanner admin routes changed from `requireSuperAdmin` → `requireAdminPermission('scanners:manage')`.
- **Preserved super_admin:** official-invitations, order-qr-tickets, academy super_admin routes unchanged.

---

## 6. Service Role Ordering

- Missing-route handlers: `gateAdminPermission` → then `createAdminDbClient`.
- misc inline routes: `gateAdminPermission` before `createAdminDbClient` / `createClient(SERVICE_ROLE)`.
- Shared `release-order-stock.cjs` only called after authz in cancel/reject handlers.
- Static tests in `admin-api-authz-coverage.test.cjs` and existing `admin-route-auth-order.test.cjs` assert ordering on representative paths.

---

## 7. Tests Added / Updated

| File | Scenarios |
|------|-----------|
| `api/_lib/admin-api-authz-coverage.test.cjs` | Missing handlers exist; misc permission keys; audit/media/career; server parity; no role-static `hasPermission` |
| `package.json` | `test:admin-api-authz-coverage`; extended `test:admin-auth-order` |

**Results:** `npm run test:admin-auth-order` → **70/70 pass** (includes **36** coverage tests in `test:admin-api-authz-coverage`)

---

## 8. Commands Run

```text
npm run test:admin-api-authz-coverage  → 36/36 pass (standalone)
npm run test:admin-auth-order          → 70/70 pass (full admin auth suite)
npm run build                          → success (vite build + academy prerender)
```

---

## 9. Remaining Risks

| Risk | Status |
|------|--------|
| **CSRF** on cookie-authenticated admin POST/PATCH/DELETE | **Not addressed** in this patch — recommend double-submit token or SameSite=Strict review |
| **Internal SMS without CRON_SECRET in dev** | Order-create SMS `fetch` only sends secret when env set; without it, internal calls need admin cookie or env `CRON_SECRET` |

---

## 10. Pre-deploy consistency fixes (2026-06-28 follow-up)

| Item | Resolution |
|------|------------|
| `GET /api/admin/payment-options` auth-only vs full admin config | **Fixed** — requires `settings:manage` on Vercel (`admin-missing-routes-http.js`) and `server.cjs` |
| `aio_events:view` not in tab definitions | **Fixed** — route uses `marketing:manage` on Vercel + `server.cjs` |

---

## 11. Final Gate

| Question | Answer |
|----------|--------|
| **Do all admin APIs have authentication now?** | **Yes** on all implemented audited routes. |
| **Do all admin APIs have authorization now?** | **Yes** — effective permissions or documented super_admin/cron paths. |
| **Do all super_admin APIs enforce super_admin or documented delegated permission?** | **Yes** — super_admin routes unchanged; scanners use delegated `scanners:manage`. |
| **Is Vercel production aligned with server.cjs?** | **Yes** for this audit scope (inline misc, missing handlers, cron, SMS, scanner, sms-balance). |
| **Can a tab-restricted admin bypass any admin route?** | **No** on fixed routes — gates use `effectivePermissionDenied` / Express `requireAdminPermission`. |
| **Is this safe to deploy?** | **Yes** for AuthZ coverage fixes. Schedule **CSRF** hardening as follow-up before treating admin surface as fully hardened. |
