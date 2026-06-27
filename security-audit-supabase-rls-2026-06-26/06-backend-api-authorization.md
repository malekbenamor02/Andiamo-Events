# 06 — Backend API Authorization

Routes mapped from `vercel.json` rewrites and `api/*.js` handlers.  
**No Next.js middleware** found in repository (grep `middleware*` — 0 files).

Authorization helpers:

- `verifyAdminAuth` → `api/_lib/admin-verify.js` → `api/_lib/admin-authorization.mjs`
- `hasPermission(role, permission)` — `shared/admin/permissions.mjs`

---

## Summary matrix (by handler file)

| Handler | Prefix / routes | Auth check | Role check | Service role | Key server-only | Risk |
|---------|-----------------|:----------:|:----------:|:------------:|:-----------------:|------|
| `api/admin-login.js` | POST login | N/A (public) | N/A | No (anon) | anon in env | Medium |
| `api/misc.js` | Most `/api/admin/*`, ambassador, public | Mixed | Partial | Often yes | Yes | Medium–High |
| `api/admin-approve-order.js` | Order approval | Yes (inlined verify) | Partial | Optional | Yes | Medium |
| `api/admin-pos.js` | `/api/admin/pos-*` | Yes | `pos:manage` | Fallback anon | Yes | Medium |
| `api/orders-create.js` | `/api/orders/create` | Public order flow | No | Preferred | Yes | Medium |
| `api/passes-[eventId].js` | `/api/passes/:eventId` | Public read | No | Optional | Yes | Low |
| `api/presale.js` | presale + admin presale | Admin routes yes | `presale:manage` | Required for sessions | Yes | Medium |
| `api/pos.js` | `/api/pos/*` | POS login | POS user | Service or anon | Yes | Medium |
| `api/scan.js` | scanner + admin scan | Mixed | Admin/scanner | Service or anon | Yes | Medium |
| `api/clictopay-generate-payment.js` | payment | Order token | No | Preferred | Yes | Medium |
| `api/media.js` | media upload/delete | Admin | Unknown | Unknown | Unknown | Not fully traced |

---

## /api/admin/* (via misc.js, admin-pos.js, presale.js, scan.js)

Representative routes — **most admin routes in `misc.js` call `verifyAdminAuth`** before processing.

| Route | File | Auth | Role/permission | Service role | Notes |
|-------|------|:----:|:---------------:|:------------:|-------|
| `/api/verify-admin` | misc.js ~1346 | Cookie JWT | Returns permissions | Yes/anon fallback | Session probe |
| `/api/admin-logout` | misc.js ~1655 | Optional | No | No | Clears cookie |
| `/api/admin-update-application` | misc.js ~1693 | Yes | No explicit permission | Yes optional | |
| `/api/admin/events` POST/PATCH/DELETE | misc.js ~2517 | Yes | Not verified per-route | **Required** | Creates events |
| `/api/admin/passes/create` | misc.js ~2685 | Yes | Not verified | **Required** | |
| `/api/admin/orders/*` (multiple) | misc.js | Yes | Not verified all | Often yes | Large surface |
| `/api/admin-resend-ticket-email` | misc.js ~4971 | Yes | Not verified | **Required** message in code | |
| `/api/admin/logs` | misc.js ~7506 | Via admin-logs-route | `logs:view` | Service preferred | |
| `/api/admin/admins` | misc.js | Yes | Not verified | Not verified | User management |
| `/api/admin/bulk-sms/send` | misc.js ~8611 | Yes | Not verified | Not verified | |
| `/api/admin/presale/codes*` | presale.js | Yes | `presale:manage` | Yes | |
| `/api/admin/event-promo/*` | presale.js | Yes | `events:manage` | Yes | |
| `/api/admin/pos-*` | admin-pos.js | Yes | `pos:manage` | Fallback | |
| `/api/admin/scanners*` | scan.js | Yes | Admin | Service | |
| `/api/admin/scan-system-config` | scan.js | Yes | Admin | Service | |

**Gap:** Many routes check authentication but **not** fine-grained `hasPermission` — any valid admin JWT may access broad endpoints.

---

## /api/auth/*

No dedicated `/api/auth/*` routes. Admin auth is `/api/admin-login` (separate file) and `/api/verify-admin`.

---

## /api/orders/*

| Route | File | Auth | Role | Service role | Risk |
|-------|------|:----:|:----:|:------------:|------|
| `/api/orders/create` | orders-create.js | Public + validations | No | Preferred | Medium — business logic not RLS |
| `/api/clictopay-generate-payment` | clictopay-generate-payment.js | Order context | No | Yes/anon | Medium |
| `/api/clictopay-confirm-payment` | misc.js ~4091 | Webhook/secret | No | Yes | Medium |

---

## /api/tickets/*

Ticket operations primarily in `misc.js`, `admin-approve-order.js`, `admin-pos.js`, `scan.js` — all admin/scanner authenticated paths **when invoked via API**.

**RLS gap:** Direct Supabase client access bypasses these routes entirely.

---

## /api/events/*

| Route | File | Auth | Notes |
|-------|------|:----:|-------|
| `/api/passes/:eventId` | passes-[eventId].js | Public | Pass listing |
| `/api/admin/events` | misc.js | Yes | CRUD |
| `/api/admin/passes/*` | misc.js | Yes | Pass management |

---

## /api/ambassador/*

| Route | File | Auth | Notes |
|-------|------|:----:|-------|
| `/api/ambassador-login` | misc.js ~1805 | Public | Issues ambassador session |
| `/api/ambassador/me` | misc.js ~1816 | Ambassador session | |
| `/api/ambassador/orders` | misc.js ~5799 | Ambassador | |
| `/api/ambassador/cancel-order` | misc.js ~1837 | Ambassador | |
| `/api/ambassadors/active` | misc.js ~2144 | Public GET | Review if should be public |

---

## Cron / automation routes

| Route | Auth mechanism | Risk |
|-------|----------------|------|
| `/api/auto-reject-expired-orders` | Secret query param (~8839 misc.js) | Medium — verify CRON_SECRET |
| `/api/marketing/cron/email-campaigns` | CRON_SECRET | Medium |
| `/api/auto-fail-pending-online-orders` | Secret | Medium |

**Not verified:** Whether secrets are rotatable and rate-limited.

---

## Authorization helper files

| File | Purpose |
|------|---------|
| `api/_lib/admin-authorization.mjs` | JWT + DB admin verify |
| `api/_lib/admin-verify.js` | Thin wrapper |
| `api/_lib/verify-admin-http.js` | HTTP helper |
| `api/_lib/admin-logs-route.js` | Logs + permission |
| `shared/admin/permissions.mjs` | Role → permission map |
| `api/_lib/clear-admin-token-cookie.js` | Logout cookie |

---

## Service role key usage

**Pattern:** Server routes prefer `SUPABASE_SERVICE_ROLE_KEY` when set; many fall back to `SUPABASE_ANON_KEY` if missing (e.g. `admin-authorization.mjs` lines 103–107, `admin-pos.js` line 45).

| Concern | Assessment |
|---------|------------|
| Exposed to frontend? | **No** — only `VITE_SUPABASE_ANON_KEY` in client |
| Server-only? | **Yes** — `SUPABASE_SERVICE_ROLE_KEY` in `env.example` without VITE prefix |
| Fallback to anon on server | **Risk** — server uses same broken RLS when service key missing |

---

## Overall API layer assessment

- API routes are **generally protected** for admin operations via HttpOnly JWT.
- **Database RLS does not enforce** the same boundaries for direct PostgREST access.
- Permission granularity is **inconsistent** — many routes lack `hasPermission` checks.
- **No middleware** — each handler responsible for its own auth.
