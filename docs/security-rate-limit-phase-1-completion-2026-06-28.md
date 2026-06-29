# Rate Limit Phase 1 — Completion Report (2026-06-28)

Phase 1 delivers shared Upstash-backed rate limiting for P0 routes on Vercel (source of truth) with `server.cjs` local-dev parity (PR-1e).

**Release gate run:** 2026-06-28 (final)  
**Verdict:** **PASS** (code + tests). Production deploy blocked until Vercel env vars below are set.

---

## Final protected route list

| Route | Policy | File |
|-------|--------|------|
| `POST /api/admin-login` | `LOGIN_ADMIN` | `api/admin-login.js` |
| `POST /api/ambassador-login` | `LOGIN_AMBASSADOR` | `api/misc.js` → `ambassador-routes.cjs` |
| `POST /api/scanner-login` | `LOGIN_SCANNER` | `api/scan.js` |
| `POST /api/pos/:slug/login` | `LOGIN_POS` | `api/pos.js` |
| `POST /api/academy-influencer/login` | `LOGIN_INFLUENCER` | `academy-influencer-routes.cjs` |
| `POST /api/clictopay-generate-payment` | `PAYMENT_GENERATE` | `api/clictopay-generate-payment.js` |
| `GET\|POST /api/clictopay-confirm-payment` | `PAYMENT_CONFIRM` | `api/clictopay-confirm-payment.js` |
| `POST /api/academy/clictopay-generate-payment` | `PAYMENT_ACADEMY_GENERATE` | `academyRoutes.cjs` |
| `GET\|POST /api/academy/clictopay-confirm-payment` | `PAYMENT_ACADEMY_CONFIRM` | `academyRoutes.cjs` |
| `POST /api/orders/create` | `ORDER_CREATE` | `api/orders-create.js` |
| Ambassador confirm-cash / cancel-order | `ORDER_AMBASSADOR_ACTION` | `ambassador-routes.cjs` |
| `POST /api/pos/:slug/orders/create` | `ORDER_POS_CREATE` | `api/pos.js` |
| `POST /api/send-email` | `EMAIL_SEND` | `api/misc.js` |
| `POST /api/send-sms` | `SMS_SEND` | `api/misc.js` |
| `POST /api/admin/bulk-sms/send` | `SMS_BULK` | `api/misc.js` |
| `POST /api/resend-order-completion-email` | `EMAIL_RESEND_TICKET` | `api/misc.js` |
| `POST /api/admin-resend-ticket-email` | `EMAIL_RESEND_TICKET` | `api/misc.js` |
| `GET /api/tickets/qr/:secureToken` | `QR_TICKET` | `api/_lib/ticket-qr-route.cjs` |

---

## Policies and dimensions

Defaults from `api/_lib/rate-limit/policies.cjs` (override via `RATE_LIMIT_{POLICY}_{DIM}_MAX` / `_WINDOW_SEC`):

| Policy | Dimensions (max / window) |
|--------|---------------------------|
| `LOGIN_ADMIN` | ip 10/900s, email 5/900s |
| `LOGIN_AMBASSADOR` | ip 10/900s, phone 5/900s |
| `LOGIN_SCANNER` | ip 10/900s, email 6/900s |
| `LOGIN_POS` | ip 10/900s, email 6/900s |
| `LOGIN_INFLUENCER` | ip 10/900s, email 6/900s |
| `PAYMENT_GENERATE` | ip 20/900s, order 5/900s |
| `PAYMENT_CONFIRM` | ip 30/900s, order 40/900s |
| `PAYMENT_ACADEMY_GENERATE` | ip 20/900s, registration 5/900s |
| `PAYMENT_ACADEMY_CONFIRM` | ip 30/900s, registration 40/900s |
| `ORDER_CREATE` | ip 10/3600s, email 5/3600s, device 3/600s (device bucket fail-open on Redis error) |
| `ORDER_AMBASSADOR_ACTION` | ambassador 30/3600s, order 10/3600s |
| `ORDER_POS_CREATE` | pos_user 120/3600s, outlet 500/3600s, ip 60/900s |
| `EMAIL_SEND` | admin 30/3600s, recipient 3/3600s |
| `SMS_SEND` | admin 20/3600s |
| `SMS_BULK` | admin 5/3600s, ip 10/900s |
| `EMAIL_RESEND_TICKET` | admin 20/3600s, order 5/3600s, recipient 3/3600s |
| `QR_TICKET` | ip 60/60s, token 30/3600s |

**Fail mode (Vercel):** fail-closed → 503 when Upstash missing/down (except `ORDER_CREATE` device dimension fail-open on Redis error). **Local dev:** fail-open when Redis not configured.

---

## Route coverage matrix (release gate)

| Route | File | Policy | Limiter dimensions | Handler order | Fail mode | Tests |
|-------|------|--------|-------------------|---------------|-----------|-------|
| Admin login | `admin-login.js` | `LOGIN_ADMIN` | ip, email | RL → reCAPTCHA → DB | fail-closed (Vercel) | `enforce-login.test.cjs`, `admin-login-rate-limit.test.cjs`, `server-cjs-admin-login-parity.test.cjs` |
| Ambassador login | `ambassador-routes.cjs` | `LOGIN_AMBASSADOR` | ip, phone | IP RL → parse phone → phone RL → auth | fail-closed | `ambassador-login-rate-limit.test.cjs`, `enforce-login.test.cjs` |
| Scanner login | `scan.js` | `LOGIN_SCANNER` | ip, email | RL every attempt → auth | fail-closed | `scanner-login-rate-limit.test.cjs`, `enforce-login.test.cjs` |
| POS login | `pos.js` | `LOGIN_POS` | ip, email | IP RL → email RL → auth | fail-closed | `pos-login-rate-limit.test.cjs`, `enforce-login.test.cjs` |
| Influencer login | `academy-influencer-routes.cjs` | `LOGIN_INFLUENCER` | ip, email | RL → auth | fail-closed | `enforce-login.test.cjs` |
| ClicToPay generate | `clictopay-generate-payment.js` | `PAYMENT_GENERATE` | ip, order | parse orderId → RL → service-role | fail-closed | `payment-confirm.test.cjs`, `payment-fulfillment.test.cjs` |
| ClicToPay confirm | `clictopay-confirm-payment.js` | `PAYMENT_CONFIRM` | ip, order | IP RL → validate UUID → order RL → fulfillment | fail-closed | `payment-confirm.test.cjs`, `payment-fulfillment.test.cjs` |
| Academy pay generate | `academyRoutes.cjs` | `PAYMENT_ACADEMY_GENERATE` | ip, registration | validate UUID → RL → service-role | fail-closed | `academy-payment` suite |
| Academy pay confirm | `academyRoutes.cjs` | `PAYMENT_ACADEMY_CONFIRM` | ip, registration | IP RL → registration RL → fulfillment | fail-closed | `academy-payment` suite |
| Orders create | `orders-create.js` | `ORDER_CREATE` | ip, email, device | parse 256KB → RL → service-role | fail-closed (device fail-open on Redis err) | `orders-create.test.cjs`, `admin-auth-order` |
| Ambassador actions | `ambassador-routes.cjs` | `ORDER_AMBASSADOR_ACTION` | ambassador, order | auth → UUID → RL → mutation | fail-closed | `ambassador-order-action-rate-limit.test.cjs` |
| POS order create | `pos.js` | `ORDER_POS_CREATE` | ip (pre-auth), pos_user, outlet | IP RL → outlet → auth → pos_user+outlet RL → create | fail-closed | `pos-order-create-rate-limit.test.cjs` |
| Send email | `misc.js` | `EMAIL_SEND` | admin, recipient | admin auth → RL → send | fail-closed | `email-sms-qr-rate-limit.test.cjs` |
| Send SMS | `misc.js` | `SMS_SEND` | admin | admin auth → RL → send | fail-closed | `email-sms-qr-rate-limit.test.cjs` |
| Bulk SMS | `misc.js` | `SMS_BULK` | admin, ip | admin auth → RL → send | fail-closed | `email-sms-qr-rate-limit.test.cjs` |
| Resend ticket | `misc.js` | `EMAIL_RESEND_TICKET` | admin, order, recipient | admin auth → RL → send | fail-closed | `email-sms-qr-rate-limit.test.cjs` |
| Ticket QR | `ticket-qr-route.cjs` | `QR_TICKET` | ip, token | validate token → RL → DB | fail-closed | `email-sms-qr-rate-limit.test.cjs`, `security-remediation-2026-06-28.test.cjs` |

---

## Shared module

- `api/_lib/rate-limit/index.cjs` — policies, atomic Lua EVAL (Upstash), hashed keys, emergency flags, `respondToRateLimit` / `sendRateLimited`
- Atomic path: single `EVAL` script in `upstash.cjs` (INCR + conditional EXPIRE in one round trip — not separate REST INCR/EXPIRE)

---

## Files changed (PR-1a → PR-1e)

| PR | Scope | Key files |
|----|-------|-----------|
| **PR-1a** | Foundation | `api/_lib/rate-limit/*`, `env.example`, `package.json` (`test:rate-limit`) |
| **PR-1b** | Login | `admin-login.js`, `scan.js`, `pos.js`, `ambassador-routes.cjs`, `academy-influencer-routes.cjs`, legacy wrappers |
| **PR-1c** | Payment + orders | `clictopay-*.js`, `orders-create.js`, `academyRoutes.cjs`, `ambassador-routes.cjs`, `pos.js` |
| **PR-1d** | Email/SMS/QR | `misc.js`, `ticket-qr-route.cjs` |
| **PR-1e** | server.cjs parity | `server.cjs`, `api/_lib/server-cjs-vercel-forward.cjs`, parity tests |

Tests: `api/_lib/rate-limit/*.test.cjs`, `api/_lib/*-rate-limit*.test.cjs`, `server-cjs-*-parity.test.cjs`

---

## PR-1e server.cjs parity

P0 routes in local dev delegate to the same Vercel ESM handlers via `api/_lib/server-cjs-vercel-forward.cjs`:

- `forwardAdminLogin` → `api/admin-login.js`
- `forwardScanApi` → `api/scan.js`
- `forwardMiscApi` → `api/misc.js`
- `forwardOrdersCreate` → `api/orders-create.js`
- `forwardClicToPayConfirm` → `api/clictopay-confirm-payment.js`
- Ambassador/POS/academy/QR: `ambassador-routes.cjs`, `api/pos.js`, `academyRoutes.cjs`, `registerStorageSecurityRoutes`

Express `authLimiter` / `emailLimiter` / `scannerLoginLimiter` / `orderCreateLimiter` / `resendTicketEmailLimiter` are **defined but not registered** on P0 routes. Non-P0 routes (e.g. `ambassador-update-password`) may still use legacy express limiters locally.

---

## Legacy limiters

| Module | Status |
|--------|--------|
| `admin-login-rate-limit.js` | Deprecated wrapper (no-op Maps) |
| `admin-login-upstash.js` | Deprecated wrapper → `enforceRateLimits` (not imported by P0 routes) |
| `scanner-login-rate-limit.cjs` | Thin wrapper → shared module |
| `ticket-qr-route.cjs` in-memory Map | **Removed** (PR-1d) |

---

## Release gate — environment readiness

`env.example` documents:

- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_KEY_PEPPER`
- `RATE_LIMIT_GLOBAL_FAIL_OPEN`, `RATE_LIMIT_DISABLED`, `RATE_LIMIT_DISABLED_REASON`
- Policy override examples (`RATE_LIMIT_LOGIN_ADMIN_*`, etc.)

**Local `.env` (presence only, no values printed):**

| Variable | Set locally |
|----------|-------------|
| `.env` file | yes |
| `UPSTASH_REDIS_REST_URL` | yes |
| `UPSTASH_REDIS_REST_TOKEN` | yes |
| `RATE_LIMIT_KEY_PEPPER` | no (falls back to `JWT_SECRET` prefix locally per `env.example`) |

**Deploy requirement:** Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `RATE_LIMIT_KEY_PEPPER` (≥32 chars) on **Vercel Production and Preview** before deploy. Without them, P0 routes return **503** on Vercel (fail-closed).

---

## Release gate — static grep findings

| Check | P0 production path | Result |
|-------|-------------------|--------|
| In-memory `Map` limiter | P0 Vercel handlers + `ticket-qr-route.cjs` | **Clean** |
| Non-atomic INCR + EXPIRE | `upstash.cjs` uses single Lua EVAL | **Clean** |
| Legacy `admin-login-upstash.js` direct import | P0 route entrypoints | **Clean** (wrapper exists; routes use shared module) |
| `express-rate-limit` on P0 `server.cjs` registrations | P0 forwards only | **Clean** (limiters defined, not attached to P0) |

**Non-P0 legacy (Phase 2 / out of scope — not blockers):**

- `academyRoutes.cjs`: in-memory `checkIpRate` on `POST /api/academy/register` only — **not** on academy ClicToPay P0 paths
- `misc.js`: `ambassadorApplicationAttempts`, `suggestionsAttempts` Maps
- `client-site-log.js`: `rateBuckets` Map
- `server.cjs`: deprecated express limiter definitions retained for non-P0 local routes

**Phase 2 routes not modified in Phase 1:** scanner validate/lookup-ticket, verify-admin, exports, public scrape APIs, phone-subscribe, aio-events, CSP report.

---

## Release gate — tests run (2026-06-28)

| Command | Result |
|---------|--------|
| `npm run test:rate-limit` | **126/126 pass** |
| `npm run test:login-security` | **35/35 pass** |
| `npm run test:payment-fulfillment` | **86/86 pass** |
| `npm run test:academy-payment` | **58/58 pass** |
| `npm run test:admin-auth-order` | **91/91 pass** |
| `npm run test:security-remediation` | **15/15 pass** (after QR test updated for shared RL) |
| `npm run build` | **Success** |

**Total automated:** 411 tests pass, 0 fail.

---

## Staging smoke checklist (manual — do not load-test production)

Run against **Preview/staging** only, with Upstash configured:

1. **Admin login over-limit** — 11+ attempts from same IP within 15m → **429** `rate_limited`, `Retry-After` header.
2. **Payment confirm missing orderId** — `GET/POST` without valid UUID → **400**, no DB mutation.
3. **Payment confirm valid paid order** — repeat confirm → idempotent (no duplicate fulfillment).
4. **Order create rate limit** — exceed IP/email limits → **429** before service-role client / insert.
5. **QR invalid token** — malformed token → **400** `Invalid token`, no DB query for invalid format.
6. **QR valid token over-limit** — exceed token/IP bucket → **429** before DB lookup.
7. **Resend ticket 6th attempt** — same order within window → **429** on order dimension.
8. **Redis missing on Vercel** — temporarily unset Upstash vars on Preview → any P0 route → **503** `service_unavailable` (not fail-open).

---

## Production deploy requirements

1. Vercel **Production** and **Preview**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_KEY_PEPPER`
2. Confirm Upstash database in same region as primary traffic where possible
3. Run staging smoke checklist above on Preview after env vars applied
4. Monitor rate-limit audit logs / 429 and 503 rates first 24h

---

## Emergency rollback flags

| Flag | Effect |
|------|--------|
| `RATE_LIMIT_GLOBAL_FAIL_OPEN=1` | Skip all rate limits (logged). Prefer fixing Redis over leaving on. |
| `RATE_LIMIT_DISABLED=1` + `RATE_LIMIT_DISABLED_REASON` (≥10 chars, production) | Disable all limits (discouraged; reason required on production) |

Per-policy tuning without disabling: `RATE_LIMIT_{POLICY}_{DIM}_MAX` / `_WINDOW_SEC`.

---

## Known remaining gaps (Phase 2 priority)

1. `POST /api/scanner/validate-ticket`
2. `POST /api/scanner/lookup-ticket`
3. `verify-admin`
4. Admin exports
5. Public scrape APIs
6. `phone-subscribe` / `aio-events` / CSP report

Also: `server.cjs` duplicate inline handlers for many non-P0 routes; legacy express limiters on non-P0 local paths (`verify-recaptcha`, applications, phone-subscribe, legacy `/api/qr-codes/:accessToken`). Academy registration still uses in-memory IP limiter (non-P0).

---

## Behavior notes

- **Vercel production:** fail-closed when Upstash missing/down for P0 policies (503 via `respondToRateLimit`)
- **Local dev without Upstash:** fail-open per policy defaults (except explicit fail-closed dimensions)
- **No raw PII/UUIDs** in Redis keys or rate-limit audit logs (SHA-256 hashed segments)
