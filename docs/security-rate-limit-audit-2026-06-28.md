# Rate Limiting Security Audit — Andiamo Events

**Date:** 2026-06-28  
**Scope:** Full static read-only audit of API rate-limiting coverage across Vercel serverless routes, `server.cjs` (local/dev), shared helpers, Supabase RPC/migrations, and edge functions.  
**Production target:** Vercel deployment (`vercel.json` rewrites) — **not** load-tested.  
**Changes made:** None (this file only).

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| **Overall verdict** | **PARTIAL** |
| **Main risk level** | **HIGH** |
| **Routes checked** | **~122** (100 `vercel.json` `/api/*` rewrites + 12 standalone handlers + grouped sub-routes) |
| **Strong rate limiting** | **~14** routes (distributed DB RPC or optional Upstash + defense-in-depth) |
| **Weak / partial rate limiting** | **~22** routes (in-memory / per-instance only) |
| **Missing rate limiting** | **~86** routes (auth-only or public with no throttle) |
| **Method** | Static code review, dependency scan, migration/RPC review, cross-check vs prior security audits |

### Top 5 urgent gaps

1. **Payment surfaces unthrottled on Vercel** — `POST /api/clictopay-generate-payment`, `POST/GET /api/clictopay-confirm-payment`, and academy ClicToPay routes have **no IP/order rate limits**; confirm relies on idempotent PAID short-circuit but still allows expensive gateway/DB work per call.
2. **`POST /api/phone-subscribe` missing limit in production** — `server.cjs` applies `express-rate-limit` (5/15 min/IP); **`api/misc.js` (Vercel) has none**.
3. **Email resend endpoints missing per-order limits on Vercel** — `server.cjs` limits `admin-resend-ticket-email` to 5/hour/order; **`api/misc.js` handlers have no equivalent**.
4. **Distributed limiter only on admin login** — Upstash Redis is wired for `POST /api/admin-login` only; all other login portals use in-memory Maps that **reset on cold start** and do not share state across Vercel instances.
5. **IP extraction inconsistency / spoofing risk** — Most handlers trust `X-Forwarded-For` first hop unconditionally; only `presale-server.js` `getClientIp()` gates on `VERCEL` / `TRUST_FORWARDED_IP`. Non-presale limits can be bypassed or mis-keyed off spoofed headers outside trusted proxy environments.

---

## 2. Existing Rate-Limit Architecture

### Where rate limiting is implemented

| Layer | Location | Routes covered |
|-------|----------|----------------|
| **Standalone Vercel functions** | `api/admin-login.js`, `api/orders-create.js`, `api/scan.js`, `api/pos.js`, `api/_lib/ticket-qr-route.cjs`, `api/_lib/client-site-log.js` | Admin login, order create, scanner login, POS login, ticket QR PNG, site logs |
| **Monolith dispatcher** | `api/misc.js` | Ambassador login/application, audience suggestions, career applications (via mini-Express), academy register (via `academyRoutes.cjs`) |
| **Presale / promo module** | `api/_lib/presale-route-redeem.js`, `api/_lib/event-promo-route-public.js`, `api/orders-create.js` (promo path) | Presale redeem, promo validate, promo order create |
| **Local dev only** | `server.cjs` (`express-rate-limit`) | Broad coverage when running Express locally; **disabled when `NODE_ENV !== 'production'` and not on Vercel** — but production traffic uses Vercel, not `server.cjs` |
| **Optional distributed** | `api/_lib/admin-login-upstash.js` | Admin login only (when `UPSTASH_REDIS_REST_*` set) |
| **Supabase RPC (strong)** | Migrations `20260505130000`, `20260602120000`, `20260609120000` | `presale_redeem_rate_try`, `event_promo_validate_rate_try`, `event_promo_order_create_rate_try` |

### Storage backend summary

| Backend | Used by | Serverless suitability |
|---------|---------|------------------------|
| **In-memory `Map`** | Most login limits, order IP/device, QR route, site-logs, misc ambassador/suggestions, academy register, POS login | **Weak** — per-instance, ephemeral, cold-start reset |
| **Upstash Redis REST** | Admin login (optional) | **Good** — distributed; **fails open** on errors |
| **Supabase Postgres RPC** | Presale redeem, event promo validate/order | **Good** — distributed, survives cold starts |
| **express-rate-limit** | `server.cjs` only | **Good on long-lived Express**; **not used on Vercel production path** |

### Keying strategy

| Key type | Routes |
|----------|--------|
| IP | Most public limits, login (partial), order create, QR, site-logs |
| IP + normalized email | Admin login, scanner login, academy influencer login |
| IP only (no identifier) | Ambassador login, POS login |
| Device header (`X-Device-Id`) | Order create (optional, client-supplied) |
| Order ID | `server.cjs` resend-ticket-email only |
| DB bucket (IP string) | Presale/promo RPCs |

### IP extraction method

| Helper | Trust model | Files |
|--------|-------------|-------|
| `presale-server.js` `getClientIp()` | **Trusted proxy aware** — uses `X-Forwarded-For` / `X-Real-IP` only when `VERCEL=1` or `TRUST_FORWARDED_IP=1`; else `socket.remoteAddress` | Presale, orders-create, event-promo public |
| `admin-login-rate-limit.js` `getAdminLoginClientIp()` | **Always trusts** first `X-Forwarded-For` hop | Admin login |
| `misc.js`, `ticket-qr-route.cjs`, `scan.js`, `academyRoutes.cjs`, `client-site-log.js` | **Always trusts** forwarded headers | Most other limits |
| `express-rate-limit` on `server.cjs` | Uses Express `req.ip` (trust proxy setting dependent) | Local dev |

### Serverless / Vercel suitability

Production API traffic is routed through **Vercel serverless functions** (`vercel.json` → `api/*.js`). In-memory limiters:

- Do **not** share counters across concurrent instances.
- **Reset entirely** on function cold start (attack window after deploy or idle period).
- Allow **horizontal bypass** by distributing requests (natural on serverless).

**Strongest production patterns today:** Supabase RPC rate buckets (presale/promo) and optional Upstash on admin login.

### Architectural weaknesses

1. **Dual stack drift** — `server.cjs` has richer `express-rate-limit` coverage that **does not apply on Vercel** (verify-admin, phone-subscribe, send-email, SMS, resend-ticket-email, order create middleware, etc.).
2. **Fail-open Upstash** — Admin distributed limits skip enforcement when Redis errors (`admin-login-upstash.js` returns `{ ok: true, skipped: true }`).
3. **Admin login limit order** — Rate limits run **after** reCAPTCHA verification (external HTTP call) — wasted work under abuse.
4. **Ambassador login IP-only** — No per-phone/email bucket; rotating phones from one IP still bounded, but one phone tryable from many IPs.
5. **No Vercel edge / WAF rate limits** documented in repo (only app-level).

---

## 3. Endpoint Inventory Table

**Legend — Current limiter:** `Strong` = distributed DB/Redis; `Weak` = in-memory; `Partial` = auth + business caps only; `Missing` = none; `Local-only` = `server.cjs` only.

**Verdict:** `PASS` meets CRITICAL bar; `PARTIAL` weak limit; `FAIL` none; `N/A` low-risk authenticated read.

| Category | Method | Route | File | Auth | Sensitive action | Current limiter | Limiter key | Storage | Verdict | Risk |
|----------|--------|-------|------|------|------------------|-----------------|-------------|---------|---------|------|
| **Admin auth** | POST | `/api/admin-login` | `api/admin-login.js` | Public | Login, bcrypt | IP+email in-memory + optional Upstash + reCAPTCHA | IP, email | memory + Redis | PARTIAL | CRITICAL |
| Admin auth | GET | `/api/verify-admin` | `api/misc.js` → `verify-admin-http.js` | Admin cookie | Session verify | **Missing** (Local-only: 30/15m) | — | — | FAIL | HIGH |
| Admin auth | POST | `/api/admin-logout` | `api/misc.js` | Admin | Session invalidate | **Missing** (Local-only: 10/15m) | — | — | FAIL | MEDIUM |
| Admin auth | POST | `/api/admin/change-password` | `api/misc.js` | Admin | Credential change | Missing | — | — | FAIL | HIGH |
| **Ambassador auth** | POST | `/api/ambassador-login` | `api/misc.js` → `ambassador-routes.cjs` | Public | Login | Weak IP 5/15m + reCAPTCHA | IP | memory | PARTIAL | CRITICAL |
| Ambassador auth | POST | `/api/ambassador-logout` | misc | Ambassador | Logout | Missing | — | — | FAIL | LOW |
| Ambassador auth | POST | `/api/ambassador-update-password` | misc | Ambassador | Password change | Missing | — | — | FAIL | HIGH |
| Ambassador auth | POST | `/api/ambassador-application` | misc | Public | Application + email | Weak IP 5/hr | IP | memory | PARTIAL | HIGH |
| **Scanner auth** | POST | `/api/scanner-login` | `api/scan.js` | Public | Login | Weak IP+email 6/15m (failures increment) | IP, email | memory | PARTIAL | CRITICAL |
| Scanner auth | POST | `/api/scanner-logout` | scan.js | Scanner | Logout | Missing | — | — | FAIL | LOW |
| Scanner ops | POST | `/api/scanner/validate-ticket` | scan.js | Scanner | QR validate + mutate | Missing | — | — | FAIL | HIGH |
| Scanner ops | POST | `/api/scanner/lookup-ticket` | scan.js | Supervisor | Ticket enum | Missing | — | — | FAIL | HIGH |
| Scanner ops | GET | `/api/scanner/inspect-detail` | scan.js | Supervisor | PII read | Missing | — | — | FAIL | MEDIUM |
| **POS auth** | POST | `/api/pos/:slug/login` | `api/pos.js` | Public | Login | Weak IP 6/15m | IP | memory | PARTIAL | CRITICAL |
| POS ops | POST | `/api/pos/:slug/orders/create` | pos.js | POS | Order + stock | Missing | — | — | FAIL | HIGH |
| **Influencer auth** | POST | `/api/academy-influencer/login` | misc → `academy-influencer-routes.cjs` | Public | Login | Weak IP+email 6/15m | IP, email | memory | PARTIAL | CRITICAL |
| Influencer auth | POST | `/api/academy-influencer/change-password` | academy-influencer-routes | Influencer | Password | Missing | — | — | FAIL | HIGH |
| **Orders** | POST | `/api/orders/create` | `api/orders-create.js` | Public | Order + stock + SR | Weak IP 10/hr + device 3/10m + reCAPTCHA; promo: **Strong** DB RPC | IP, device, IP (promo) | memory + DB | PARTIAL | CRITICAL |
| Orders | POST | `/api/ambassador/confirm-cash` | misc | Ambassador | Payment confirm | Missing | — | — | FAIL | CRITICAL |
| Orders | POST | `/api/ambassador/cancel-order` | misc | Ambassador | Cancel order | Missing | — | — | FAIL | HIGH |
| **Payments** | POST | `/api/clictopay-generate-payment` | `api/clictopay-generate-payment.js` | Public* | Gateway session | Missing | — | — | FAIL | CRITICAL |
| Payments | POST/GET | `/api/clictopay-confirm-payment` | `api/clictopay-confirm-payment.js` | Public* | Fulfillment + email | Missing (idempotent if PAID) | — | — | FAIL | CRITICAL |
| Payments | POST | `/api/academy/clictopay-generate-payment` | academyRoutes.cjs | Public | Academy pay | Missing | — | — | FAIL | CRITICAL |
| Payments | POST | `/api/academy/clictopay-confirm-payment` | academyRoutes.cjs | Public | Academy fulfill | Missing | — | — | FAIL | CRITICAL |
| Payments | POST | `/api/admin-approve-order` | `api/admin-approve-order.js` | Admin | Fulfillment | Missing | — | — | FAIL | HIGH |
| **QR / tickets** | GET | `/api/tickets/qr/:secureToken` | misc → `ticket-qr-route.cjs` | Public (token) | QR PNG + DB lookup | Weak 60/min/IP | IP | memory | PARTIAL | CRITICAL |
| QR / tickets | GET | `/api/admin/order-qr-tickets` | misc | Super admin | QR list | Missing | — | — | FAIL | HIGH |
| **Presale / promo** | POST | `/api/presale/redeem` | presale.js | Public | Code brute force | **Strong** 12/15m/IP RPC + reCAPTCHA | IP | Supabase DB | PASS | CRITICAL |
| Presale / promo | GET | `/api/presale/required`, `/api/presale/session*` | presale.js | Public / session | Read | Missing | — | — | FAIL | MEDIUM |
| Presale / promo | POST | `/api/event-promo/validate` | presale.js | Public | Code guess | **Strong** 25/15m/IP RPC | IP | Supabase DB | PASS | CRITICAL |
| Presale / promo | GET | `/api/event-promo/availability` | presale.js | Public | Scrape | Missing | — | — | FAIL | MEDIUM |
| **Email** | POST | `/api/send-email` | misc | Admin | Send email | **Missing** (Local-only: 10/15m) | — | — | FAIL | CRITICAL |
| Email | POST | `/api/admin-resend-ticket-email` | misc | Admin | Resend tickets | **Missing** (Local-only: 5/hr/order) | — | — | FAIL | CRITICAL |
| Email | POST | `/api/resend-order-completion-email` | misc | Admin | Resend tickets | Missing | — | — | FAIL | CRITICAL |
| Email | POST | `/api/admin/official-invitations/:id/resend` | misc | Super admin | Invite email | Missing | — | — | FAIL | HIGH |
| Email | POST | `/api/admin/pos-orders/:id/resend-*` | admin-pos.js | Admin | POS emails | Missing | — | — | FAIL | HIGH |
| Email | POST | `/api/marketing/campaigns/:id/send-batch` | misc | Admin | Bulk send | Partial (batch/daily caps) | campaign | DB | PARTIAL | HIGH |
| Email | GET/POST | `/api/marketing/cron/email-campaigns` | misc | Cron secret | Bulk send | Partial (batch caps) | cron | DB | PARTIAL | MEDIUM |
| **SMS** | POST | `/api/send-sms` | misc | Admin | Send SMS | Missing (Local-only SMS limiter on some routes) | — | — | FAIL | CRITICAL |
| SMS | POST | `/api/admin/bulk-sms/send` | misc | Admin | Bulk SMS | Missing | — | — | FAIL | CRITICAL |
| SMS | GET | `/api/sms-balance` | misc | Admin | Provider query | Missing | — | — | FAIL | LOW |
| **Public read** | GET | `/api/passes/:eventId` | `passes-[eventId].js` | Public | Pass/stock scrape | Missing | — | — | FAIL | MEDIUM |
| Public read | GET | `/api/events/by-slug/:slug`, `/by-id/:id` | misc | Public | Event data | Missing | — | — | FAIL | MEDIUM |
| Public read | GET | `/api/ambassadors/active` | misc | Public | PII (phone/email) | Missing | — | — | FAIL | HIGH |
| Public read | GET | `/api/payment-options` | server.cjs only† | Public | Config | Missing on Vercel rewrite | — | — | FAIL | LOW |
| Public read | GET | `/api/scan-system-status` | scan.js | Public | Config flag | Missing | — | — | FAIL | LOW |
| **Public write** | POST | `/api/phone-subscribe` | misc | Public | DB insert | **Missing** (Local-only: 5/15m) | — | — | FAIL | HIGH |
| Public write | POST | `/api/audience-suggestions` | misc | Public | DB insert | Weak 10/hr/IP (prod only) | IP | memory | PARTIAL | MEDIUM |
| Public write | POST | `/api/aio-events/save-submission` | misc | Public | Lead capture | Missing | — | — | FAIL | HIGH |
| Public write | POST | `/api/career-application` | misc (career app) | Public | Application | Weak 5/hr/IP | IP | memory | PARTIAL | HIGH |
| Public write | POST | `/api/site-logs` | misc → client-site-log.js | Public | SR insert | Weak 30/min/IP | IP | memory | PARTIAL | MEDIUM |
| Public write | POST | `/api/csp-report` | misc | Public | Log ingest | Missing | — | — | FAIL | MEDIUM |
| **Academy** | POST | `/api/academy/register` | academyRoutes.cjs | Public | Registration + proof | Weak 5/hr/IP | IP | memory | PARTIAL | HIGH |
| Academy | POST | `/api/academy/validate-promo` | academyRoutes | Public | Promo guess | Missing | — | — | FAIL | HIGH |
| **Admin exports** | GET | `/api/admin/reports/export` | admin-privileged-app | Admin | Excel export | Missing | — | — | FAIL | CRITICAL |
| Admin exports | GET | `/api/admin/analytics/export-orders` | admin-privileged-app | Admin | CSV/export | Missing | — | — | FAIL | CRITICAL |
| Admin exports | GET | `/api/admin/careers/applications/export` | misc (careers) | Admin | Export | Missing | — | — | FAIL | HIGH |
| **Admin bulk** | POST/PATCH/DELETE | `/api/admin/events*`, `/api/admin/passes/*` | misc | Admin | Price/stock/pass | Missing | — | — | FAIL | HIGH |
| Admin bulk | POST | `/api/admin-remove-order`, cancel/reject‡ | misc/server | Admin | Order mutate | Missing | — | — | FAIL | HIGH |
| Admin bulk | GET | `/api/admin/orders/*`, analytics | admin-privileged-app | Admin | Sensitive read | Missing | — | — | FAIL | MEDIUM |
| **Admin POS** | * | `/api/admin/pos-*` | admin-pos.js | Admin pos:manage | POS admin | Missing | — | — | FAIL | MEDIUM |
| **Cron / service** | GET/POST | `/api/auto-reject-expired-orders` | misc | Cron or admin | Batch mutate | Missing | — | — | FAIL | MEDIUM |
| Cron / service | GET/POST | `/api/auto-fail-pending-online-orders` | misc | Cron or admin | Batch mutate | Missing | — | — | FAIL | MEDIUM |
| Cron / service | GET/POST | `/api/auto-cancel-expired-academy-registrations` | misc | Cron | Batch mutate | Missing | — | — | FAIL | MEDIUM |
| **Media** | POST | `/api/media/upload`, `/api/admin/media/upload` | misc | Admin / auth | Upload | Missing | — | — | FAIL | HIGH |
| **Edge** | POST | Supabase `submit-consultation` | `supabase/functions/submit-consultation` | Public | Consultation insert | Honeypot + timing only | — | — | FAIL | MEDIUM |

† `GET /api/payment-options` is implemented in `server.cjs`; no matching Vercel rewrite found — frontend may use Supabase direct read instead.  
‡ Several admin order routes exist in `server.cjs` but are missing or divergent in `misc.js` per prior authz audit.

### Inventory notes

- **Grouped rows:** Dozens of authenticated admin CRUD routes under `api/misc.js`, `admin-privileged-app.cjs`, `admin-pos.js`, and `scan.js` share the same pattern: **JWT/session auth, no rate limit**. Risk is MEDIUM–HIGH depending on cost (exports = CRITICAL).
- **Standalone handlers not in misc:** `admin-login.js`, `orders-create.js`, `clictopay-*.js`, `passes-[eventId].js`, `presale.js`, `scan.js`, `pos.js`, `admin-pos.js`, `admin-approve-order.js`.
- **`api/media.js`:** Exists but Vercel rewrites media routes to `misc.js`.

---

## 4. Findings

### RL-001 — Payment gateway routes unthrottled (CRITICAL)

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Affected** | `api/clictopay-generate-payment.js`, `api/clictopay-confirm-payment.js`, `academyRoutes.cjs` ClicToPay handlers |
| **What is wrong** | No IP, orderId, or session rate limits before service-role DB reads and external ClicToPay API calls. |
| **Abuse scenario** | Attacker floods generate/confirm with valid or guessed `orderId` values → gateway API abuse, DB load, fulfillment/email side effects on successful confirms. |
| **Evidence** | Grep shows no `rate`, `429`, or limiter in clictopay entrypoints; confirm has PAID idempotency (`order.status === 'PAID'`) but still performs work. |
| **Recommended fix** | Distributed limiter: per-IP (strict), per-orderId (confirm: 10/15m), per-route; fail-closed on limiter outage for confirm. |
| **Backend** | Upstash Redis or Supabase rate bucket RPC (mirror presale pattern). |
| **Regression test** | `api/_lib/clictopay-rate-limit.test.cjs` — 429 after N calls same IP/order. |

### RL-002 — Phone subscribe missing limit on Vercel (CRITICAL)

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Affected** | `POST /api/phone-subscribe` in `api/misc.js` |
| **What is wrong** | No rate limit in production handler; duplicate of `server.cjs` `phoneSubscribeLimiter` (5/15m/IP) exists only locally. |
| **Abuse scenario** | Unlimited subscriber row inserts / DB spam from anonymous clients. |
| **Evidence** | `misc.js` lines ~2341–2412: validation + insert only; `server.cjs` ~7451–7459 applies `rateLimit`. |
| **Recommended fix** | Shared helper + Upstash or DB bucket; per-IP and per-phone. |
| **Backend** | Upstash or Supabase. |
| **Regression test** | 6th request from same IP → 429. |

### RL-003 — Ticket email resend unthrottled on Vercel (CRITICAL)

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Affected** | `POST /api/admin-resend-ticket-email`, `POST /api/resend-order-completion-email` in `api/misc.js` |
| **What is wrong** | Admin-authenticated but no per-order or per-admin send cap on Vercel. |
| **Abuse scenario** | Compromised admin cookie or insider triggers mass ticket emails / provider block / cost. |
| **Evidence** | `server.cjs` ~10467–10487 defines `resendTicketEmailLimiter`; `misc.js` ~4399+ has no equivalent. |
| **Recommended fix** | Per-orderId 5/hr + per-adminId 20/hr distributed limits before email pipeline. |
| **Backend** | Upstash or Supabase. |
| **Regression test** | Sixth resend same order → 429. |

### RL-004 — In-memory limiters ineffective on Vercel (CRITICAL)

| Field | Detail |
|-------|--------|
| **Severity** | CRITICAL |
| **Affected** | All `Map`-based limiters: admin-login (memory leg), ambassador, scanner, POS, influencer, orders, QR, site-logs, academy register, misc suggestions |
| **What is wrong** | Counters are per serverless instance; cold starts wipe state; attackers rotate across instances. |
| **Abuse scenario** | Brute-force login or order spam at scale despite “5/15m” code existing. |
| **Evidence** | Comments in `misc.js` ~216: “serverless best-effort; resets on cold start”; same pattern across `_lib/*-rate-limit*`. |
| **Recommended fix** | Standardize on Upstash or Supabase RPC for all CRITICAL-tier routes. |
| **Backend** | Upstash (REST, already integrated for admin) or Postgres. |
| **Regression test** | Parallel requests from multiple simulated instances share counter (integration test against Redis/DB). |

### RL-005 — Admin verify-admin unthrottled on Vercel (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Affected** | `GET /api/verify-admin` → `api/_lib/verify-admin-http.js` |
| **What is wrong** | Dashboard polls session frequently; no limit on Vercel. Local `server.cjs` uses 30/15m. |
| **Abuse scenario** | Stolen/leaked admin cookie used for high-frequency session probing; DB load on `verifyAdminSession`. |
| **Evidence** | `verify-admin-http.js` has no limiter; `server.cjs` ~742–748, ~1533. |
| **Recommended fix** | Per-adminId + IP limit (generous for UX, e.g. 60/15m); stricter on invalid cookie. |
| **Backend** | Upstash. |
| **Regression test** | Exceed poll budget → 429 with retry-after. |

### RL-006 — Ambassador login IP-only (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Affected** | `checkAmbassadorLoginRateLimit` in `api/misc.js`, `ambassador-routes.cjs` |
| **What is wrong** | No per-phone identifier bucket (unlike admin/scanner/influencer). |
| **Abuse scenario** | Distributed IPs attempt same ambassador phone credentials without shared email/phone counter. |
| **Evidence** | `misc.js` ~222–231: key is `ip` only; `ambassador-routes.cjs` ~79. |
| **Recommended fix** | Add normalized phone key; distributed storage. |
| **Backend** | Upstash hashed phone key. |
| **Regression test** | Same phone from 10 IPs still blocked after N failures (if tracking failures) or attempts. |

### RL-007 — POS login IP-only; POS order create unlimited (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Affected** | `api/pos.js` login + `handleOrdersCreate` |
| **What is wrong** | Login: IP-only in-memory 6/15m. Order create: no throttle after auth. |
| **Abuse scenario** | Stolen POS session creates unlimited pending orders / stock reservation spam. |
| **Evidence** | `pos.js` ~143–163 login; ~574–575 orders/create without limit. |
| **Recommended fix** | Email key on login; per-outlet + per-user order create limits. |
| **Backend** | Upstash. |
| **Regression test** | POS session exceeds order create budget → 429. |

### RL-008 — Send-email and bulk SMS unthrottled on Vercel (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Affected** | `POST /api/send-email`, `POST /api/send-sms`, `POST /api/admin/bulk-sms/send` in misc |
| **What is wrong** | `server.cjs` wraps send-email with `emailLimiter`; Vercel misc does not. SMS limiter local only. |
| **Abuse scenario** | Admin session abuse → email/SMS provider exhaustion, cost, reputation damage. |
| **Evidence** | `misc.js` ~2530+ send-email; `server.cjs` ~734–844. |
| **Recommended fix** | Per-adminId + global provider caps; audit log on 429. |
| **Backend** | Upstash + existing marketing daily caps for bulk. |
| **Regression test** | Admin exceeds send budget → 429. |

### RL-009 — Admin exports and analytics unthrottled (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Affected** | `GET /api/admin/reports/export`, `GET /api/admin/analytics/export-orders`, careers export |
| **What is wrong** | Expensive Excel/CSV generation with service-role reads; auth only. |
| **Abuse scenario** | Scraping entire order/PII dataset via repeated exports. |
| **Evidence** | `reports-export-route.cjs` — no rate check before `loadReportsExportPayload`. |
| **Recommended fix** | 5 exports/hour/admin + 1 concurrent; optional async queue. |
| **Backend** | Upstash. |
| **Regression test** | Sixth export in window → 429. |

### RL-010 — Public ambassadors/active exposes PII without throttle (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Affected** | `GET /api/ambassadors/active` |
| **What is wrong** | Returns ambassador phone/email for COD picker; no scrape limit. |
| **Abuse scenario** | Harvest ambassador contact list by city rotation. |
| **Evidence** | `misc.js` ~2312+; prior audits note by-design PII exposure. |
| **Recommended fix** | IP rate limit + cache headers; consider masking phone. |
| **Backend** | Upstash or CDN edge cache. |
| **Regression test** | High-frequency city queries → 429. |

### RL-011 — QR ticket route in-memory 60/min weak for enumeration (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Affected** | `GET /api/tickets/qr/:secureToken` → `ticket-qr-route.cjs` |
| **What is wrong** | 60/min/IP in-memory; tokens are high-entropy but route does DB lookup before 404; limit resets on cold start. |
| **Abuse scenario** | Token leak + distributed IPs bypass per-instance cap; DB load from invalid token probes. |
| **Evidence** | `ticket-qr-route.cjs` ~6–25, ~76–78; `server.cjs` uses separate 20/15m limiter (local only). |
| **Recommended fix** | Distributed IP limit + per-token failure bucket; constant-time 404. |
| **Backend** | Upstash + signed URL TTL (separate hardening). |
| **Regression test** | 61st request/min/IP → 429 across instances. |

### RL-012 — IP header trust inconsistent (HIGH)

| Field | Detail |
|-------|--------|
| **Severity** | HIGH |
| **Affected** | `misc.js`, `admin-login-rate-limit.js`, `ticket-qr-route.cjs`, `scan.js`, `academyRoutes.cjs` vs `presale-server.js` |
| **What is wrong** | Most helpers always use first `X-Forwarded-For` hop; presale uses trusted-proxy gating. |
| **Abuse scenario** | On misconfigured proxy or local dev exposed to internet, spoofed XFF bypasses IP limits. |
| **Evidence** | `presale-server.js` ~23–47 `isTrustedProxyEnvironment()`; `misc.js` ~144–148 unconditional XFF. |
| **Recommended fix** | Centralize `getClientIp()` from presale-server everywhere; document Vercel-only trust. |
| **Backend** | Code consolidation (no new infra). |
| **Regression test** | Spoofed XFF ignored when `TRUST_FORWARDED_IP` unset. |

### RL-013 — Admin login Upstash fails open (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Affected** | `api/_lib/admin-login-upstash.js` |
| **What is wrong** | Redis/network errors return `{ ok: true, skipped: true }` — no enforcement. |
| **Abuse scenario** | Redis outage removes distributed leg; only weak in-memory remains. |
| **Evidence** | Lines ~47–48, ~67–68. |
| **Recommended fix** | Fail-closed for login when Upstash configured but unreachable; alert on skip. |
| **Backend** | Upstash + monitoring. |
| **Regression test** | Mock Redis down → 503 or in-memory-only with alert flag. |

### RL-014 — Admin login rate limit after reCAPTCHA (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Affected** | `api/admin-login.js` |
| **What is wrong** | Limits at ~195 run after Google reCAPTCHA HTTP call (~122–193). |
| **Abuse scenario** | reCAPTCHA API cost/latency abuse before 429. |
| **Evidence** | Order of checks in handler. |
| **Recommended fix** | Cheap IP limit before reCAPTCHA; reCAPTCHA before password bcrypt. |
| **Backend** | Reorder only. |
| **Regression test** | Blocked IP never hits recaptcha verify mock. |

### RL-015 — aio-events save-submission unthrottled (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Affected** | `POST /api/aio-events/save-submission` |
| **What is wrong** | Public lead capture with service-role insert; no limit. |
| **Abuse scenario** | Spam submissions filling `aio_events_submissions`. |
| **Evidence** | `misc.js` ~1608–1669. |
| **Recommended fix** | IP + email limits; reCAPTCHA. |
| **Backend** | Upstash. |
| **Regression test** | Burst POSTs → 429. |

### RL-016 — Public passes/events scrape unlimited (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Affected** | `GET /api/passes/:eventId`, `GET /api/events/by-slug/*`, `by-id/*` |
| **What is wrong** | No anonymous scrape protection. |
| **Abuse scenario** | Aggressive inventory/pricing scraping. |
| **Evidence** | `passes-[eventId].js` — no limiter. |
| **Recommended fix** | CDN cache + IP limit 120/min on API. |
| **Backend** | Vercel edge or Upstash. |
| **Regression test** | Scrape burst → 429. |

### RL-017 — CSP report endpoint unthrottled (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Affected** | `POST /api/csp-report` |
| **What is wrong** | Browsers may send reports; no cap on malicious POST volume. |
| **Abuse scenario** | Log/DB noise DoS. |
| **Evidence** | `misc.js` ~6635+. |
| **Recommended fix** | 100/min/IP; size limit. |
| **Backend** | In-memory minimum; Upstash preferred. |
| **Regression test** | Flood → 429. |

### RL-018 — Route duplication server.cjs vs Vercel (MEDIUM)

| Field | Detail |
|-------|--------|
| **Severity** | MEDIUM |
| **Affected** | Many routes in both stacks |
| **What is wrong** | `server.cjs` limiters do not apply on Vercel; QR limits differ (20/15m vs 60/1m); scanner login limit exists locally but Vercel uses custom in-memory in `scan.js`. |
| **Abuse scenario** | Developers assume local hardening equals production. |
| **Evidence** | `server.cjs` limiters vs Vercel handlers; prior parity test `server-cjs-admin-login-parity.test.cjs` covers admin login only. |
| **Recommended fix** | Extract shared limit middleware; single source of truth. |
| **Backend** | Shared `_lib/rate-limit/` module. |
| **Regression test** | Parity test suite for all limited routes. |

### RL-019 — OPTIONS/preflight bypass (LOW)

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Affected** | CORS handlers across API |
| **What is wrong** | Preflight returns early without counting toward limits (standard CORS). |
| **Abuse scenario** | OPTIONS flood (usually low impact). |
| **Evidence** | `handlePreflight` patterns in handlers. |
| **Recommended fix** | Edge-level OPTIONS rate limit if abused. |
| **Backend** | Vercel firewall. |
| **Regression test** | Monitor OPTIONS rate. |

### RL-020 — Device ID header client-controlled (LOW)

| Field | Detail |
|-------|--------|
| **Severity** | LOW |
| **Affected** | `POST /api/orders/create` `X-Device-Id` |
| **What is wrong** | Attacker rotates device IDs to bypass 3/10m device cap. |
| **Evidence** | `orders-create.js` ~98–116. |
| **Recommended fix** | Treat device id as hint only; rely on distributed IP + email limits. |
| **Backend** | Upstash. |
| **Regression test** | Rotating device header does not bypass IP limit. |

### Finding counts

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 8 |
| MEDIUM | 6 |
| LOW | 2 |
| **Total** | **20** |

---

## 5. Missing Coverage by Category

### Admin login/auth
- **Present (partial):** IP + email in-memory; optional Upstash; reCAPTCHA on Vercel prod.
- **Missing:** verify-admin, admin-logout, change-password limits on Vercel; fail-closed Upstash; limit before reCAPTCHA.

### Ambassador login/auth
- **Present (partial):** IP 5/15m in-memory; reCAPTCHA.
- **Missing:** Per-phone limit; distributed storage; post-login action limits (confirm-cash, cancel-order).

### Scanner login/auth
- **Present (partial):** IP + email 6/15m in-memory on failed attempts pattern.
- **Missing:** Distributed limiter; validate-ticket / lookup rate limits; supervisor inspect throttles.

### POS login/auth
- **Present (partial):** IP 6/15m in-memory.
- **Missing:** Per-email limit; distributed storage; order-create limits.

### Influencer login/auth
- **Present (partial):** IP + email in-memory.
- **Missing:** Distributed storage; change-password throttle.

### Orders
- **Present (partial):** IP 10/hr + device 3/10m in-memory; reCAPTCHA; promo DB RPC.
- **Missing:** Per-email/phone/event limits; distributed IP; ambassador COD confirm limits; POS create limits.

### Payments/COD
- **Present:** PAID idempotency on confirm; business validation.
- **Missing:** All rate limits on generate/confirm; academy payment routes; per-order confirm caps.

### QR/tickets/tokens
- **Present (partial):** QR PNG 60/min/IP in-memory.
- **Missing:** Distributed limits; per-token buckets; admin QR bulk fetch limits.

### Email sending
- **Present (partial):** Marketing batch/daily caps in DB logic.
- **Missing:** send-email, resend routes on Vercel; official invitation resend; POS resend email limits.

### Public APIs
- **Present (partial):** audience-suggestions, site-logs, career application, presale/promo RPCs.
- **Missing:** passes, events, ambassadors/active, phone-subscribe, aio-events, academy validate-promo, payment-options.

### Admin exports/bulk actions
- **Missing:** reports export, analytics export, careers export, bulk SMS, marketing campaign launch bursts (beyond daily cap).

### Webhooks/cron/service routes
- **Present:** CRON_SECRET gates on auto-* and marketing cron.
- **Missing:** Rate limits on cron endpoints (secret leak = unbounded batch ops); no per-invocation caps beyond marketing batch size.

---

## 6. Recommended Standard Design (do not implement yet)

### Distributed backend
- **Primary:** Upstash Redis REST (already in `env.example`, used by admin login) for all CRITICAL/HIGH routes.
- **Secondary:** Supabase RPC rate buckets (proven for presale/promo) for routes already using service role.
- **Avoid** in-memory Maps for any CRITICAL tier on Vercel.

### Limit dimensions
| Dimension | Apply to |
|-----------|----------|
| **Per-IP** | All public write/login routes (strict on login/payment) |
| **Per-identifier** | Email (admin), phone (ambassador), email (POS/influencer/scanner) — hashed keys |
| **Per-authenticated-user** | Admin/ambassador/scanner/POS/influencer session actions |
| **Per-route/action** | Export, resend email, bulk SMS, payment confirm |
| **Per-order/token** | Payment confirm, email resend, QR fetch failures |

### Stricter tiers (suggested defaults)
| Route class | IP window | Identifier window |
|-------------|-----------|-------------------|
| Login (all portals) | 10 / 15 min | 5 / 15 min |
| Payment generate | 20 / 15 min | 5 / 15 min per orderId |
| Payment confirm | 30 / 15 min | 10 / 15 min per orderId |
| Order create | 10 / hour | 3 / hour per email |
| QR fetch | 30 / min | 10 / hour per token (failures) |
| Email send (admin) | — | 30 / hour per adminId |
| Export | — | 5 / hour per adminId |

### Safe IP extraction for Vercel
- Use single `getClientIp(req)` from `presale-server.js` (trust forwarded headers only when `VERCEL=1` or `TRUST_FORWARDED_IP=1`).
- Prefer `x-real-ip` from Vercel when documented; take leftmost **trusted** hop only.
- Never rate-limit on client-supplied `X-Device-Id` alone.

### Fail-open vs fail-closed
| Route type | Recommendation |
|------------|----------------|
| Login, payment, export, email send | **Fail-closed** when distributed limiter configured |
| Public read (events/passes) | Fail-open with in-memory fallback acceptable if monitored |
| verify-admin | Fail-open with generous defaults to avoid dashboard lockout |

### Logging / audit
- Log `rate_limit_exceeded` to `security_audit_logs` (pattern exists in `server.cjs` QR/SMS handlers).
- Include: route, IP hash, identifier hash, limit name, count — **never** log secrets/tokens.

### HTTP response
- Status **429 Too Many Requests**
- Body: `{ "error": "rate_limited", "retryAfter": <seconds> }` (align with `PUBLIC_ERROR_CODES.RATE_LIMITED`)
- Headers: `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (RFC 9110 style)

---

## 7. Priority Fix Plan

### Phase 1 — Critical login / order / payment / QR / email
1. Add distributed limits to `clictopay-generate-payment.js`, `clictopay-confirm-payment.js`, academy ClicToPay.
2. Fix `phone-subscribe`, `admin-resend-ticket-email`, `resend-order-completion-email` on Vercel.
3. Migrate login limiters (ambassador, scanner, POS, influencer) to shared Upstash module.
4. Harden QR route with distributed IP + token failure buckets.
5. Centralize `getClientIp()` — remove spoofable paths.

### Phase 2 — Admin / ambassador / scanner / POS / influencer APIs
1. verify-admin, send-email, send-sms, bulk-sms limits.
2. Ambassador confirm-cash/cancel-order; POS order create.
3. Admin exports (reports, analytics, careers).
4. Scanner validate-ticket / lookup reasonable per-scanner limits (high ceiling for event day).

### Phase 3 — Public API scraping controls
1. passes, events by slug/id, ambassadors/active.
2. aio-events, academy validate-promo, csp-report.
3. CDN caching for read-heavy public routes.

### Phase 4 — Tests and monitoring
1. Shared rate-limit unit + integration tests.
2. server.cjs / Vercel parity tests.
3. Dashboards on 429 rate, Upstash errors, presale/promo bucket growth.
4. Alert when Upstash fail-open triggers on login.

---

## 8. Exact Files Likely Needing Changes Later

**New shared modules (likely)**
- `api/_lib/rate-limit/index.js` (or `.cjs`)
- `api/_lib/rate-limit/upstash.js`
- `api/_lib/rate-limit/get-client-ip.js`

**Entrypoints / handlers**
- `api/admin-login.js`
- `api/admin-login.js`
- `api/orders-create.js`
- `api/clictopay-generate-payment.js`
- `api/clictopay-confirm-payment.js`
- `api/clictopay-confirm-payment.cjs` (if logic moved)
- `api/passes-[eventId].js`
- `api/scan.js`
- `api/pos.js`
- `api/misc.js`
- `api/admin-pos.js`
- `api/admin-approve-order.js`
- `academyRoutes.cjs`

**Existing limit helpers (extend/replace)**
- `api/_lib/admin-login-rate-limit.js`
- `api/_lib/admin-login-upstash.js`
- `api/_lib/scanner-login-rate-limit.cjs`
- `api/_lib/academy-influencer-login-rate-limit.cjs`
- `api/_lib/ticket-qr-route.cjs`
- `api/_lib/client-site-log.js`
- `api/_lib/presale-server.js`
- `api/_lib/ambassador-routes.cjs`
- `api/_lib/verify-admin-http.js`
- `api/_lib/reports-export-route.cjs`
- `api/_lib/admin-privileged-app.cjs`

**Local dev parity**
- `server.cjs`

**Config / env docs**
- `env.example`
- `vercel.json` (optional edge middleware)

**Migrations (if DB buckets extended)**
- New migration under `supabase/migrations/` for payment/order/email rate RPCs

**Tests**
- `api/_lib/scanner-login-rate-limit.test.cjs`
- `api/_lib/academy-influencer-hardening.test.cjs`
- `api/_lib/server-cjs-admin-login-parity.test.cjs`
- New files listed in §9

---

## 9. Tests to Add Later

| Test file | Scenarios |
|-----------|-----------|
| `api/_lib/rate-limit-upstash.test.cjs` | INCR/TTL, fail-closed vs fail-open, key hashing |
| `api/_lib/rate-limit-client-ip.test.cjs` | Vercel vs non-Vercel XFF trust, IPv6 normalization |
| `api/_lib/clictopay-rate-limit.test.cjs` | generate/confirm 429 per IP and orderId |
| `api/_lib/orders-create-rate-limit.test.cjs` | IP + promo RPC interaction, device rotation |
| `api/_lib/misc-phone-subscribe-rate.test.cjs` | 6th subscribe → 429 on Vercel handler |
| `api/_lib/resend-ticket-email-rate.test.cjs` | per-order cap on misc handler |
| `api/_lib/verify-admin-rate.test.cjs` | poll budget enforcement |
| `api/_lib/ticket-qr-route.security.test.cjs` | extend existing — cross-instance limit mock |
| `api/_lib/server-vercel-rate-parity.test.cjs` | every route with server.cjs limiter has Vercel equivalent |
| `api/_lib/ambassador-login-rate.test.cjs` | IP + phone dual keys |

---

## 10. Final Checklist (implementation approval)

Use before merging rate-limit work:

- [ ] **Inventory:** Every CRITICAL route in §3 has Strong or explicit waiver documented.
- [ ] **Distributed:** No CRITICAL route relies solely on in-memory `Map` on Vercel.
- [ ] **IP trust:** All limiters use shared trusted-proxy `getClientIp()`.
- [ ] **Login:** IP + identifier limits run **before** bcrypt and external CAPTCHA where cheap pre-check exists.
- [ ] **Payment:** generate + confirm have per-IP and per-orderId limits; confirm fails closed if limiter down.
- [ ] **Email/SMS:** Resend and send routes capped per admin and per order/recipient.
- [ ] **Exports:** Hard hourly cap per admin with audit log.
- [ ] **Parity:** Vercel handlers match or exceed `server.cjs` limits (phone-subscribe, verify-admin, resend, send-email).
- [ ] **429 contract:** Consistent JSON + `Retry-After` + optional `RateLimit-*` headers.
- [ ] **Audit:** `rate_limit_exceeded` events for CRITICAL routes.
- [ ] **Secrets:** Rate-limit keys hashed; no PII in Redis keys in plaintext.
- [ ] **Tests:** Phase 1 routes covered by automated tests.
- [ ] **Monitoring:** Alerts on Upstash skip/fail-open and 429 spikes.
- [ ] **Docs:** `env.example` updated for required Upstash vars in production.
- [ ] **Regression:** No load tests against production; staging verification only.

---

## Appendix A — Dependencies scanned

From `package.json`:
- `express-rate-limit` ^8.0.1 (server.cjs only in practice)
- No `@upstash/ratelimit` package — admin Upstash uses raw REST in `admin-login-upstash.js`
- No Redis client beyond Upstash REST

## Appendix B — Bypass vectors checked

| Vector | Status |
|--------|--------|
| IP spoofing via XFF | **Risk** on non-presale helpers |
| Email case variation | Mitigated where normalized (admin, scanner, influencer) |
| User-Agent rotation | Does not affect IP-keyed limits |
| Multiple routes | **Risk** — payment vs order vs promo separate buckets |
| Malformed JSON | Handlers return 400; still consumes limit if checked after parse (varies) |
| OPTIONS preflight | Not counted (expected) |
| Local vs prod handler split | **Risk** — server.cjs limits not on Vercel |
| Direct Supabase client | RLS deny-all on sensitive tables; rate limits are API-layer concern |
| Auth before limiter | Most routes limit before auth (good for login); admin exports limit after auth only (needs post-auth cap) |
| Limiter after expensive work | **Risk** — admin login after reCAPTCHA; payment confirm before limit |

## Appendix C — Strong implementations (reference patterns)

1. **`presale_redeem_rate_try`** — Postgres atomic bucket, 12 attempts / 15 min / IP (`supabase/migrations/20260505130000_presale_security_hardening.sql`).
2. **`event_promo_validate_rate_try`** — 25 / 15 min / IP.
3. **`event_promo_order_create_rate_try`** — order create with promo code.
4. **`admin-login-upstash.js`** — optional distributed admin login (extend this pattern project-wide).

---

*End of audit report. No application code, migrations, env files, or configs were modified during this audit.*
