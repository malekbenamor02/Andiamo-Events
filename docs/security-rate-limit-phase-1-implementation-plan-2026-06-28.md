# Phase 1 Rate Limiting — Implementation Plan (P0 Critical)

**Date:** 2026-06-28 (rev. 2 — pre-coding corrections)  
**Status:** Plan only — **do not implement until approved**  
**Scope:** Production Vercel P0 routes identified in [security-rate-limit-audit-2026-06-28.md](./security-rate-limit-audit-2026-06-28.md)  
**Out of scope for Phase 1:** verify-admin, exports, public scrape routes (passes/events), phone-subscribe, aio-events, CSP report  
**Urgent Phase 2 (next after Phase 1 merge):** `POST /api/scanner/validate-ticket`, `POST /api/scanner/lookup-ticket` — high abuse surface at live events; listed in §5b and §17

---

## 1. Goals and non-goals

### Goals

1. Introduce one **shared distributed rate-limit module** (Upstash Redis REST) used by all P0 routes on Vercel.
2. Centralize **safe IP extraction** (`getClientIp`) with trusted-proxy gating.
3. Replace or bypass **in-memory `Map` limiters** on P0 routes in production — in-memory may remain as dev-only fallback when Upstash is unset.
4. Keep **server.cjs** behavior aligned with Vercel (same helper, same limits).
5. Preserve existing auth, RLS, CSRF, CORS, payment fulfillment, and QR security — rate limits are additive only.

### Non-goals

- Vercel Edge Middleware / WAF (future Phase 3).
- Changing limit values for presale/promo Supabase RPC buckets (keep as-is).
- New npm dependency (`@upstash/ratelimit`) — use raw Upstash REST with **atomic Lua EVAL** (see §3.3), not unsafe separate INCR + EXPIRE.

### Prerequisites (manual, before deploy)

- [ ] Upstash Redis REST provisioned on Vercel (Marketplace or console).
- [ ] `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set on **Production** and **Preview**.
- [ ] Optional: `RATE_LIMIT_KEY_PEPPER` (32+ char secret) for hashing identifiers — falls back to `JWT_SECRET` slice if unset (document in `env.example` only during implementation).

---

## 2. Shared module — file layout

### Module format decision (resolve before coding — §2b)

**Primary implementation: CommonJS (`.cjs`)** for the entire `api/_lib/rate-limit/` tree.

| Consumer | Module system | Import pattern |
|----------|---------------|----------------|
| `api/misc.js` | ESM | `createRequire(import.meta.url)` → `require('./_lib/rate-limit/index.cjs')` |
| `api/scan.js` | ESM + CJS deps | Same `createRequire` pattern (already used for scanner-auth) |
| `api/pos.js` | ESM | Same `createRequire` pattern |
| `academyRoutes.cjs` | CJS | `require('./api/_lib/rate-limit/index.cjs')` or path via `requireFromRoot` |
| `ticket-qr-route.cjs` | CJS | `require('./rate-limit/index.cjs')` |
| `api/admin-login.js` | ESM | `createRequire` → `index.cjs` |
| `api/orders-create.js` | ESM | `createRequire` → `index.cjs` |
| `server.cjs` | CJS | `require('./api/_lib/rate-limit/index.cjs')` |

Do **not** ship ESM-only `.js` rate-limit files that CJS consumers cannot `require` without async import. Optional thin `index.js` ESM re-export is allowed **only if** it delegates to `.cjs` and is not required for merge.

### New files (create)

| File | Purpose |
|------|---------|
| `api/_lib/rate-limit/client-ip.cjs` | Canonical `getClientIp(req)`, `isTrustedProxyEnvironment()` |
| `api/_lib/rate-limit/hash-key.cjs` | `hashRateLimitSegment(value)`, `buildRateLimitKey(parts)` |
| `api/_lib/rate-limit/upstash.cjs` | Atomic `incrFixedWindow` via Lua EVAL (§3.3) |
| `api/_lib/rate-limit/policies.cjs` | Named policy constants + env override readers |
| `api/_lib/rate-limit/enforce.cjs` | `enforceRateLimits(ctx)` — multi-bucket AND logic |
| `api/_lib/rate-limit/respond.cjs` | `sendRateLimited(res, …)` — 429 JSON + headers |
| `api/_lib/rate-limit/audit.cjs` | `logRateLimitExceeded({ route, dimension, req })` — no PII |
| `api/_lib/rate-limit/emergency.cjs` | `RATE_LIMIT_GLOBAL_FAIL_OPEN`, production-safe disable guards (§13) |
| `api/_lib/rate-limit/index.cjs` | Public exports (single entry for all consumers) |
| `api/_lib/rate-limit/rate-limit.test.cjs` | Unit tests (mock fetch + Lua path) |
| `api/_lib/rate-limit/import-compat.test.cjs` | **Required gate:** proves module loads from all consumer contexts (§11) |

### Files to modify (integrate module)

| File | Change summary |
|------|----------------|
| `api/_lib/admin-login-upstash.js` | **Deprecate** — re-export from `rate-limit/` or delete after migration |
| `api/_lib/admin-login-rate-limit.js` | Remove in-memory Maps for production path; keep `_resetForTests` shims calling Upstash mocks in tests |
| `api/_lib/scanner-login-rate-limit.cjs` | Replace Map logic with `enforceRateLimits` wrapper |
| `api/_lib/academy-influencer-login-rate-limit.cjs` | Same |
| `api/misc.js` | Ambassador login limit, send-email, send-sms, bulk-sms, resend routes, ambassador confirm/cancel dispatch |
| `api/admin-login.js` | Use shared module; reorder checks (see §6) |
| `api/orders-create.js` | Replace in-memory IP/device Maps with distributed limits |
| `api/clictopay-generate-payment.js` | Add limits |
| `api/clictopay-confirm-payment.js` | Add limits before handler delegate |
| `api/_lib/clictopay-confirm-payment.cjs` | RL handled in entrypoint only — no duplicate inner guard |
| `academyRoutes.cjs` | Academy ClicToPay generate/confirm limits |
| `api/pos.js` | Login + order create limits |
| `api/scan.js` | Scanner login limits |
| `api/_lib/ticket-qr-route.cjs` | Distributed limits before DB |
| `api/_lib/ambassador-routes.cjs` | confirm-cash / cancel-order limits (post-auth) |
| `api/_lib/presale-server.js` | Re-export `getClientIp` from `rate-limit/client-ip.cjs` via `createRequire` in ESM wrapper (avoid duplication) |
| `server.cjs` | Import shared policies + enforce helper for parity routes |
| `env.example` | Document Upstash + `RATE_LIMIT_KEY_PEPPER` + policy env overrides |

### Files unchanged (reference only)

- Presale/promo Supabase RPC paths (`presale_redeem_rate_try`, etc.) — no change in Phase 1.
- `api/_lib/client-site-log.js` — not P0 in this plan.

---

## 3. Helper function API design

### 3.1 `getClientIp(req)` — `api/_lib/rate-limit/client-ip.cjs`

Move logic from `presale-server.js` (trusted-proxy aware). `presale-server.js` re-exports for backward compatibility via `createRequire`.

```js
export function isTrustedProxyEnvironment(): boolean
// VERCEL === '1' || TRUST_FORWARDED_IP === '1'

export function getClientIp(req): string
// If trusted: first X-Forwarded-For hop, else X-Real-IP, else socket.remoteAddress (strip ::ffff:)
// Max 128 chars; return 'unknown' if empty
// NEVER log raw IP in rate-limit audit — use hashRateLimitSegment(ip) in audit only
```

### 3.2 `hashRateLimitSegment(value)` — `api/_lib/rate-limit/hash-key.cjs`

```js
export function getRateLimitPepper(): string
// RATE_LIMIT_KEY_PEPPER || first 32 chars of JWT_SECRET || static dev-only fallback (non-Vercel only)

export function hashRateLimitSegment(value: string): string
// SHA-256(pepper + ':' + normalizedValue) → hex slice(0, 32)
// normalizedValue rules:
//   email → trim().toLowerCase()
//   phone → digits only (ambassador normalizePhone equivalent)
//   uuid (orderId, registrationId, adminId) → lowercase trim, validate UUID format; if invalid use hash of raw anyway
//   secure_token → lowercase trim UUID only; non-UUID → hash raw without storing token in key string

export function buildRateLimitKey({ route, dimension, segmentHash }): string
// Returns: `ae:rl:v1:${route}:${dimension}:${segmentHash}` truncated to 200 chars
```

**Never put in Redis keys or logs:** raw email, phone, `secure_token`, JWT, session cookie, gateway secrets, `order_number`, recipient email.

### 3.3 `incrFixedWindow(key, max, ttlSeconds, options)` — `api/_lib/rate-limit/upstash.cjs`

**Requirement: atomic fixed-window increment + TTL.** The existing `admin-login-upstash.js` pattern (separate REST `INCR` then conditional `EXPIRE`) is **not safe** — a crash or race between calls can leave keys without TTL (Redis memory leak) or allow ambiguous window boundaries.

#### Approved implementation: single Lua script via Upstash REST `EVAL`

Upstash Redis REST supports [`EVAL`](https://upstash.com/docs/redis/sdks/ts/commands/eval). Use one atomic script per increment:

```lua
-- KEYS[1] = rate limit key
-- ARGV[1] = ttl seconds (integer string)
-- Returns: current count after INCR
local c = redis.call('INCR', KEYS[1])
if c == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return c
```

REST call shape (implementation detail):

```http
POST {UPSTASH_REDIS_REST_URL}/eval
Authorization: Bearer {token}
Body: ["<lua>", "1", "<redisKey>", "<ttlSec>"]
```

Alternative if `EVAL` unavailable in a given environment (must be documented in code comment and tested):

- **`MULTI` / `EXEC` transaction** via Upstash pipeline with `INCR` + conditional `EXPIRE` in one atomic batch — only acceptable if the pipeline is documented as atomic by Upstash for that command sequence. **Prefer Lua.**

Do **not** ship Phase 1 with non-atomic separate INCR + EXPIRE.

#### Safest fallback hierarchy (document in `upstash.cjs` header comment)

1. **Lua EVAL** (default, required for merge)
2. If EVAL fails at runtime with “unknown command” (should not happen on Upstash): log `rate_limit_eval_unsupported`, treat as **Redis error** → apply route `onRedisError` policy (fail-closed for P0)
3. **`@upstash/ratelimit` npm package** — acceptable alternative if team prefers maintained sliding/fixed window library **only if** it uses atomic Redis primitives; adds dependency — defer unless EVAL blocked
4. **Supabase RPC rate bucket** — already used for presale/promo; viable for new policies but Phase 1 standardizes on Upstash for consistency with admin login migration

```js
/**
 * @param {object} options
 * @param {'fail-open'|'fail-closed'} options.onRedisMissing — when env vars unset
 * @param {'fail-open'|'fail-closed'} options.onRedisError — when network/Redis/Lua error
 * @returns {Promise<{
 *   allowed: boolean,
 *   count: number,
 *   skipped: boolean,
 *   reason?: 'over_limit'|'redis_missing'|'redis_error'
 * }>}
 */
async function incrFixedWindow(key, max, ttlSeconds, options)
```

- Compare `count > max` → `allowed: false`.
- On Lua success, count is always consistent with TTL on first hit.

### 3.4 `enforceRateLimits(ctx)` — `api/_lib/rate-limit/enforce.cjs`

```js
/**
 * @typedef {object} RateLimitBucket
 * @property {string} route        — e.g. 'login.admin', 'payment.confirm'
 * @property {string} dimension    — 'ip' | 'email' | 'phone' | 'order' | 'registration' | 'admin' | 'ambassador' | 'token' | 'recipient'
 * @property {string} segment      — raw value BEFORE hash (hashed internally)
 * @property {number} max
 * @property {number} windowSec
 * @property {'fail-open'|'fail-closed'} [onRedisMissing]
 * @property {'fail-open'|'fail-closed'} [onRedisError]
 */

/**
 * @param {object} ctx
 * @param {import('http').IncomingMessage} ctx.req
 * @param {string} ctx.policyId     — key into policies.js (e.g. 'LOGIN_ADMIN')
 * @param {RateLimitBucket[]} ctx.buckets — explicit buckets (overrides policy partials)
 * @param {boolean} [ctx.consume=true] — if false, peek-only (not needed Phase 1; always consume)
 * @returns {Promise<{ allowed: true } | { allowed: false, statusCode: 429, retryAfterSec: number, dimension: string }>}
 */
export async function enforceRateLimits(ctx)
```

- All buckets in one call must pass (AND).
- On first failure: call `logRateLimitExceeded`, return 429 via caller.
- Parallel `incrFixedWindow` via `Promise.all` for performance.

### 3.5 `sendRateLimited(res, opts)` — `api/_lib/rate-limit/respond.cjs`

```js
export function sendRateLimited(res, { retryAfterSec = 60, route = 'unknown' })
// res.status(429)
// Body: { error: 'rate_limited', retryAfter: retryAfterSec }  — matches PUBLIC_ERROR_CODES.RATE_LIMITED
// Headers: Retry-After, RateLimit-Limit (optional), X-RateLimit-Policy: route
// No bucket values or identifiers in body
```

### 3.6 Convenience wrappers (optional thin helpers in `index.cjs`)

```js
export async function enforceLoginLimits({ req, route, ip, identifier, identifierDimension })
export async function enforcePaymentConfirmLimits({ req, orderId, registrationId })
export async function enforcePaymentGenerateLimits({ req, orderId, registrationId })
export async function enforceOrderCreateLimits({ req, ip, deviceId, email })
export async function enforceAmbassadorOrderActionLimits({ req, ambassadorId, orderId })
export async function enforceEmailSendLimits({ req, adminId, orderId, recipientEmail })
export async function enforceQrFetchLimits({ req, ip, secureToken })
```

---

## 4. Redis / Upstash key format

### Prefix and versioning

```
ae:rl:v1:{route}:{dimension}:{segmentHash}
```

| Segment | Example route slug | dimension | segmentHash input |
|---------|-------------------|-------------|-------------------|
| Admin login IP | `login.admin` | `ip` | hash(`203.0.113.5`) |
| Admin login email | `login.admin` | `email` | hash(`admin@example.com`) |
| Ambassador login phone | `login.ambassador` | `phone` | hash(normalized phone) |
| Scanner login | `login.scanner` | `ip` / `email` | hash |
| POS login | `login.pos` | `ip` / `email` | hash |
| Influencer login | `login.influencer` | `ip` / `email` | hash |
| Payment generate (orders) | `payment.generate` | `ip` | hash(ip) |
| Payment generate (orders) | `payment.generate` | `order` | hash(orderUuid) |
| Payment confirm | `payment.confirm` | `ip` | hash(ip) |
| Payment confirm | `payment.confirm` | `order` | hash(orderUuid) |
| Academy payment generate | `payment.academy.generate` | `ip` / `registration` | hash |
| Academy payment confirm | `payment.academy.confirm` | `ip` / `registration` | hash |
| Order create | `order.create` | `ip` / `email` / `device` | hash — device from X-Device-Id |
| Ambassador confirm/cancel | `order.ambassador.action` | `ambassador` / `order` | hash |
| POS order create | `order.pos.create` | `pos_user` / `outlet` / `ip` | hash |
| Send email | `email.send` | `admin` / `recipient` | hash |
| Resend ticket email | `email.resend.ticket` | `admin` / `order` / `recipient` | hash |
| Bulk SMS | `sms.bulk` | `admin` / `ip` | hash |
| QR PNG | `qr.ticket` | `ip` / `token` | hash(secureToken uuid) |

**TTL:** Set atomically inside Lua on first increment (`count == 1` → `EXPIRE`).

**UUID validation helper** (shared in `hash-key.cjs` or `enforce.cjs`):

```js
function isValidUuid(value) // RFC4122 v1–v5 regex, same as ticket-qr-url.cjs
```

Used to decide whether order/registration buckets apply (§6.2).

**Hashed always:** IP, email, phone, order UUID, registration UUID, admin UUID, ambassador UUID, pos_user UUID, outlet UUID, secure_token UUID, recipient email, device id string.

**Never hashed into key from client secrets:** passwords, JWTs, cookies, gateway response bodies.

---

## 5. Per-route limits, windows, fail mode

Env override pattern (implementation): **required from day one** for POS and scanner login policies.

```
RATE_LIMIT_{POLICY}_{DIMENSION}_MAX=<integer>
RATE_LIMIT_{POLICY}_{DIMENSION}_WINDOW_SEC=<integer>
```

Examples:

```
RATE_LIMIT_ORDER_POS_CREATE_POS_USER_MAX=120
RATE_LIMIT_ORDER_POS_CREATE_OUTLET_MAX=500
RATE_LIMIT_ORDER_POS_CREATE_IP_MAX=60
RATE_LIMIT_LOGIN_SCANNER_IP_MAX=15
RATE_LIMIT_LOGIN_SCANNER_EMAIL_MAX=8
```

Defaults below; **POS order create defaults are starting points** — tune per live event without code deploy.

| Policy ID | Route(s) | Bucket | Default max | Default window | Env override keys | fail-closed when Upstash configured? |
|-----------|----------|--------|-------------|----------------|-------------------|-------------------------------------|
| `LOGIN_ADMIN` | POST `/api/admin-login` | ip | 10 | 900s | `RATE_LIMIT_LOGIN_ADMIN_IP_MAX`, `_WINDOW_SEC` | **Yes** |
| | | email | 5 | 900s | `RATE_LIMIT_LOGIN_ADMIN_EMAIL_MAX`, `_WINDOW_SEC` | **Yes** |
| `LOGIN_AMBASSADOR` | POST `/api/ambassador-login` | ip | 10 | 900s | `RATE_LIMIT_LOGIN_AMBASSADOR_IP_MAX`, … | **Yes** |
| | | phone | 5 | 900s | `RATE_LIMIT_LOGIN_AMBASSADOR_PHONE_MAX`, … | **Yes** |
| `LOGIN_SCANNER` | POST `/api/scanner-login` | ip | 10 | 900s | `RATE_LIMIT_LOGIN_SCANNER_IP_MAX`, … | **Yes** |
| | | email | 6 | 900s | `RATE_LIMIT_LOGIN_SCANNER_EMAIL_MAX`, … | **Yes** |
| `LOGIN_POS` | POST `/api/pos/:slug/login` | ip | 10 | 900s | `RATE_LIMIT_LOGIN_POS_IP_MAX`, … | **Yes** |
| | | email | 6 | 900s | `RATE_LIMIT_LOGIN_POS_EMAIL_MAX`, … | **Yes** |
| `LOGIN_INFLUENCER` | POST `/api/academy-influencer/login` | ip | 10 | 900s | `RATE_LIMIT_LOGIN_INFLUENCER_IP_MAX`, … | **Yes** |
| | | email | 6 | 900s | `RATE_LIMIT_LOGIN_INFLUENCER_EMAIL_MAX`, … | **Yes** |
| `PAYMENT_GENERATE` | POST `/api/clictopay-generate-payment` | ip | 20 | 900s | `RATE_LIMIT_PAYMENT_GENERATE_IP_MAX`, … | **Yes** |
| | | order | 5 | 900s | `RATE_LIMIT_PAYMENT_GENERATE_ORDER_MAX`, … | **Yes** |
| `PAYMENT_CONFIRM` | GET/POST `/api/clictopay-confirm-payment` | ip | 30 | 900s | `RATE_LIMIT_PAYMENT_CONFIRM_IP_MAX`, … | **Yes** |
| | | order | **40** | 900s | `RATE_LIMIT_PAYMENT_CONFIRM_ORDER_MAX`, … | **Yes** — see §7 |
| `PAYMENT_ACADEMY_GENERATE` | POST `/api/academy/clictopay-generate-payment` | ip | 20 | 900s | … | **Yes** |
| | | registration | 5 | 900s | … | **Yes** |
| `PAYMENT_ACADEMY_CONFIRM` | POST `/api/academy/clictopay-confirm-payment` | ip | 30 | 900s | … | **Yes** |
| | | registration | **40** | 900s | … | **Yes** |
| `ORDER_CREATE` | POST `/api/orders/create` | ip | 10 | 3600s | `RATE_LIMIT_ORDER_CREATE_IP_MAX`, … | **Yes** |
| | | email | 5 | 3600s | `RATE_LIMIT_ORDER_CREATE_EMAIL_MAX`, … | **Yes** |
| | | device | 3 | 600s | `RATE_LIMIT_ORDER_CREATE_DEVICE_MAX`, … | fail-open (hint only) |
| `ORDER_AMBASSADOR_ACTION` | POST confirm-cash, cancel-order | ambassador | 30 | 3600s | … | **Yes** |
| | | order | 10 | 3600s | … | **Yes** |
| `ORDER_POS_CREATE` | POST `/api/pos/:slug/orders/create` | pos_user | **120** | 3600s | `RATE_LIMIT_ORDER_POS_CREATE_POS_USER_MAX`, … | **Yes** |
| | | outlet | **500** | 3600s | `RATE_LIMIT_ORDER_POS_CREATE_OUTLET_MAX`, … | **Yes** |
| | | ip | **60** | 900s | `RATE_LIMIT_ORDER_POS_CREATE_IP_MAX`, … | **Yes** |
| `EMAIL_SEND` | POST `/api/send-email` | admin | 30 | 3600s | … | **Yes** |
| | | recipient | 3 | 3600s | … | **Yes** |
| `SMS_SEND` | POST `/api/send-sms` | admin | 20 | 3600s | … | **Yes** |
| `SMS_BULK` | POST `/api/admin/bulk-sms/send` | admin | 5 | 3600s | … | **Yes** |
| | | ip | 10 | 900s | … | **Yes** |
| `EMAIL_RESEND_TICKET` | POST admin-resend + resend-order-completion | admin | 20 | 3600s | … | **Yes** |
| | | order | 5 | 3600s | … | **Yes** |
| | | recipient | 3 | 3600s | … | **Yes** |
| `QR_TICKET` | GET `/api/tickets/qr/:secureToken` | ip | 60 | 60s | … | **Yes** |
| | | token | 30 | 3600s | … | **Yes** |

### 5b. Urgent Phase 2 — scanner ticket validation (not Phase 1)

| Policy ID (planned) | Route | Buckets (draft) | Rationale |
|---------------------|-------|-----------------|-----------|
| `SCANNER_VALIDATE` | POST `/api/scanner/validate-ticket` | per `scannerId` 300/min + per `ip` 120/min | Gate-day throughput; prevent token guessing via authenticated scanner compromise |
| `SCANNER_LOOKUP` | POST `/api/scanner/lookup-ticket` | per `scannerId` 60/min | Supervisor enumeration |

Implement immediately after Phase 1 merge; do not defer beyond first production event post-deploy.

**Note:** Prior defaults `pos_user 60`, `outlet 200` raised to **120 / 500** for live event traffic; override via env without redeploy.

**When Upstash env vars are missing:**

| Environment | Behavior |
|-------------|----------|
| `VERCEL=1` (production/preview) | **Fail-closed** with 503 `{ error: 'service_unavailable' }` and log `rate_limit_redis_missing` — forces ops to configure Redis before deploy. Alternative (if preferred after review): fail-closed only on `VERCEL_ENV=production`, fail-open on preview. **Default recommendation: fail-closed on all Vercel.** |
| Local `server.cjs` dev | fail-open with console warn (developer ergonomics) |

**When Upstash errors (timeout, 5xx):**

| Route class | onRedisError |
|-------------|--------------|
| Login, payment, email/SMS, QR, order create, ambassador/POS actions | **fail-closed** → 503 `{ error: 'service_unavailable' }` |
| Device bucket on order create | fail-open (skip bucket) |

---

## 6. Handler integration order (before / after auth, parse, DB)

Legend: **RL** = enforceRateLimits, **CORS** = preflight, **Parse** = body/query, **Auth** = session/JWT, **DB** = Supabase/service role.

### 6.1 Login routes

#### POST `/api/admin-login` — `api/admin-login.js`

| Step | Action |
|------|--------|
| 1 | CORS / method check |
| 2 | Parse body (minimal — need email for identifier bucket) |
| 3 | Validate email/password present |
| 4 | **RL (ip + email)** ← move **before** reCAPTCHA HTTP call |
| 5 | reCAPTCHA verify (external) |
| 6 | DB bcrypt + session issue |
| 7 | On success: do **not** decrement counters (consumption model — every attempt counts) |

Remove dependency on `admin-login-rate-limit.js` Maps in production.

#### POST `/api/ambassador-login` — `misc.js` → `ambassador-routes.cjs`

| Step | Action |
|------|--------|
| 1 | CORS / method |
| 2 | **RL (ip)** — cheap first line |
| 3 | Parse body |
| 4 | Normalize phone → **RL (phone)** |
| 5 | reCAPTCHA |
| 6 | DB lookup + bcrypt |

Replace `checkAmbassadorLoginRateLimit` Map in `misc.js`.

#### POST `/api/scanner-login` — `api/scan.js`

| Step | Action |
|------|--------|
| 1 | CORS / method |
| 2 | Parse body |
| 3 | Extract ip, email → **RL (ip + email)** before DB |
| 4 | DB + bcrypt |
| 5 | On failure: increment already consumed via enforce (every attempt counts — align with admin) |

Replace `scanner-login-rate-limit.cjs` Map usage.

#### POST `/api/pos/:slug/login` — `api/pos.js`

| Step | Action |
|------|--------|
| 1 | CORS / method |
| 2 | **RL (ip)** |
| 3 | Parse body → normalize email → **RL (email)** |
| 4 | Resolve outlet by slug (DB) |
| 5 | bcrypt |

#### POST `/api/academy-influencer/login` — `academy-influencer-routes.cjs`

| Step | Action |
|------|--------|
| 1 | CORS / method |
| 2 | Parse body |
| 3 | **RL (ip + email)** before DB |
| 4 | DB + bcrypt |

---

### 6.2 Payment routes

#### POST `/api/clictopay-generate-payment` — `api/clictopay-generate-payment.js`

| Step | Action |
|------|--------|
| 1 | CORS / method |
| 2 | Parse body → extract `orderId` |
| 3 | **RL (ip)** — before service-role client |
| 4 | Validate orderId UUID → **RL (order)** |
| 5 | createServiceRoleClient + order fetch + gateway call |

#### GET/POST `/api/clictopay-confirm-payment` — `api/clictopay-confirm-payment.js` + `clictopay-confirm-payment.cjs`

| Step | Action |
|------|--------|
| 1 | CORS / method (GET + POST) |
| 2 | **RL (ip only)** — before parse |
| 3 | Parse: POST body or GET query → extract `orderId` / `order_id` |
| 4 | **If missing or invalid UUID:** return **400** `{ error: 'invalid_request' }` (generic — no “order not found”, no orderId echo). **Do not** increment order bucket. **Do not** call `createServiceRoleClient` or any DB lookup. IP bucket already consumed in step 2. |
| 5 | **RL (order bucket only)** — valid UUID only |
| 6 | `createServiceRoleClient` + `loadOrderForConfirm` |
| 7 | Existing idempotent PAID / gateway / fulfillment logic unchanged |

**Malformed-request rules (mandatory):**

| Condition | IP bucket | Order bucket | DB | Response |
|-----------|-----------|--------------|-----|----------|
| Missing `orderId` | ✅ consume | ❌ skip | ❌ none | 400 generic |
| Invalid UUID format | ✅ consume | ❌ skip | ❌ none | 400 generic |
| Valid UUID, order not found | ✅ consume | ✅ consume | ✅ lookup | 404 (existing) |

Same rules for **academy confirm** with `registrationId` instead of `orderId` (400 generic `{ error: 'invalid_request' }`, no registration bucket on invalid/missing).

Remove optional “inner guard” in `clictopay-confirm-payment.cjs` if entrypoint handles all RL — avoid double counting.

#### POST `/api/academy/clictopay-generate-payment` — `academyRoutes.cjs`

| Step | Action |
|------|--------|
| 1 | **RL (ip)** at handler top |
| 2 | Parse `registrationId` from body |
| 3 | **RL (registration)** |
| 4 | DB + gateway |

#### POST `/api/academy/clictopay-confirm-payment` — `academyRoutes.cjs`

| Step | Action |
|------|--------|
| 1 | **RL (ip only)** |
| 2 | Parse `registrationId` |
| 3 | Missing/invalid UUID → **400 generic**, no registration bucket, **no DB** |
| 4 | Valid UUID → **RL (registration)** — 40/15m |
| 5 | DB + gateway + idempotent approved/paid paths |

---

### 6.3 Orders / COD

#### POST `/api/orders/create` — `api/orders-create.js`

**Required handler order** (fix: service-role client must not be created before cheap parse + RL):

| Step | Action |
|------|--------|
| 1 | CORS / method check |
| 2 | **Parse body with size limit** — max **256 KB** JSON (reject 413/400 before DB); extract `customerInfo.email`, `X-Device-Id` header |
| 3 | `getClientIp(req)` → extract IP, device id, normalize email (trim/lowercase; if missing email skip email bucket until validated later) |
| 4 | **RL (ip + email if present + device)** — distributed; replace in-memory Maps |
| 5 | If RL pass → **`createServiceRoleClient()`** (first Supabase/service-role touch) |
| 6 | reCAPTCHA verification (external HTTP) |
| 7 | Field validation, forbidden keys, promo RPC `tryEventPromoOrderCreateRate` (Supabase — additive) |
| 8 | Stock reservation + order insert |

If email invalid after parse, fail 400 **before** email bucket if email was empty/omitted in step 4; if malformed email string present, email bucket may still consume (abuse signal).

**Anti-pattern (current code — remove):** creating service-role client at line ~218 before body parse/RL.

#### POST `/api/ambassador/confirm-cash` — `ambassador-routes.cjs`

| Step | Action |
|------|--------|
| 1 | **Auth** (`requireAmbassadorAuth`) — first |
| 2 | Parse body → `orderId` |
| 3 | **RL (ambassador + order)** using `auth.ambassador.id` |
| 4 | Ownership check + DB update |

#### POST `/api/ambassador/cancel-order` — `ambassador-routes.cjs`

Same order as confirm-cash.

#### POST `/api/pos/:slug/orders/create` — `api/pos.js` `handleOrdersCreate`

| Step | Action |
|------|--------|
| 1 | **Auth** (`requirePosAuth`) |
| 2 | **RL (pos_user + outlet + ip)** |
| 3 | Parse body + stock reservation + insert |

---

### 6.4 Email / SMS

#### POST `/api/send-email` — `misc.js`

| Step | Action |
|------|--------|
| 1 | **Auth** (`gateAdminPermission` marketing:manage) |
| 2 | Parse body → `to` email |
| 3 | **RL (admin + recipient)** |
| 4 | SMTP send |

#### POST `/api/send-sms` — `misc.js`

| Step | Action |
|------|--------|
| 1 | Auth marketing:manage |
| 2 | Parse destination phone |
| 3 | **RL (admin)** — recipient phone hashed bucket optional Phase 1b if single-recipient; for now admin-only bucket |

#### POST `/api/admin/bulk-sms/send` — `misc.js`

| Step | Action |
|------|--------|
| 1 | Auth marketing:manage |
| 2 | **RL (admin + ip)** before batch processing |
| 3 | Existing batch logic |

#### POST `/api/admin-resend-ticket-email` + `/api/resend-order-completion-email` — `misc.js`

| Step | Action |
|------|--------|
| 1 | Auth orders:manage |
| 2 | Parse orderId |
| 3 | Load order email from DB (after auth) |
| 4 | **RL (admin + order + recipient)** — recipient from order.user_email hash |
| 5 | Email pipeline |

Mirror `server.cjs` `resendTicketEmailLimiter` semantics (5/hr/order) via distributed order bucket.

---

### 6.5 QR / token route

#### GET `/api/tickets/qr/:secureToken` — `ticket-qr-route.cjs`

| Step | Action |
|------|--------|
| 1 | Method check |
| 2 | Extract token from URL |
| 3 | **`isValidSecureToken(token)`** — reject 400 if malformed (no DB) |
| 4 | **RL (ip + token)** — **before** `createServiceRoleClient` / DB lookup |
| 5 | `findActiveTicketByToken` + PNG generate |

Remove in-memory `rateByIp` Map.

---

## 7. Avoiding false positives on legitimate ClicToPay confirm redirects

### User journey

1. User completes payment at ClicToPay → browser lands on payment-processing page.
2. Frontend calls **GET or POST** `/api/clictopay-confirm-payment?orderId=…` (possibly retries on slow gateway).
3. Same user may refresh; multiple tabs; mobile network retries.

### Mitigations in this plan

1. **Per-order bucket is primary** (40 attempts / 15 min) — much higher than per-IP for confirm policies.
2. **Per-IP bucket is secondary** (30 / 15 min) — stops distributed attack, allows normal retry storm from one NAT (e.g. event venue Wi‑Fi) via order bucket.
3. **Idempotent PAID path unchanged** — already returns 200 without re-fulfillment; RL still consumes counters but high ceiling prevents lockout.
4. **Do not rate-limit on gateway reference or query params other than orderId** — only validated UUID.
5. **GET and POST share same policy** — same buckets (order hash identical).
6. **Frontend guidance (no code in Phase 1, document for Phase 1b):** exponential backoff on 429; show “processing” UI for UNKNOWN gateway status without hammering.
7. **Optional manual review:** if analytics show 429 on confirm after deploy, raise `PAYMENT_CONFIRM` order max to 60 via env without code change.

### Academy confirm

Same pattern with `registrationId` instead of `orderId`; payment-processing page for academy uses POST confirm.

---

## 8. Logging and privacy

### Allowed in logs / `security_audit_logs`

```json
{
  "event_type": "rate_limit_exceeded",
  "endpoint": "POST /api/clictopay-confirm-payment",
  "request_method": "POST",
  "request_path": "/api/clictopay-confirm-payment",
  "ip_address": "<hashed or truncated /24 only if needed — prefer omit>",
  "details": {
    "policy": "PAYMENT_CONFIRM",
    "dimension": "order",
    "route": "payment.confirm"
  },
  "severity": "medium"
}
```

### Forbidden in logs and Redis keys

- Raw email, phone, `secure_token`, JWT, cookie values
- Full `orderId` in logs — use `hashRateLimitSegment(orderId)` prefix `ord:abcd…wxyz` (first 4 + last 4 of hash, not UUID)
- Gateway `payment_gateway_reference`
- Request body dumps on 429

Reuse pattern from `ticket-qr-url.cjs` `maskTokenForLogs` for any debug behind `DEBUG_RATE_LIMIT=1`.

---

## 9. server.cjs parity (secondary to Vercel)

During implementation, for each route in §6:

1. Replace `express-rate-limit` middleware on P0 routes with shared `enforceRateLimits` in route handler **or** thin Express middleware wrapper calling same helper.
2. Keep `createRateLimiter` no-op in local dev **only if** `UPSTASH_REDIS_REST_*` unset; when unset on Vercel → 503 (see §5).
3. Routes to wire in `server.cjs`: admin-login, ambassador-login, scanner-login, phone-subscribe (not P0 but easy win), send-email, resend-ticket-email, order create, clictopay handlers if duplicated locally.

**Priority:** Ship Vercel handlers first; server.cjs parity in same PR but Vercel paths are merge gate.

---

## 10. Migration from existing code

| Existing | Action |
|----------|--------|
| `admin-login-upstash.js` | Replace with `rate-limit/upstash.cjs` Lua EVAL; delete or thin re-export |
| `admin-login-rate-limit.js` Maps | Remove from prod path; file becomes test helpers or deleted |
| `misc.js` ambassador Map | Remove |
| `scanner-login-rate-limit.cjs` Maps | Replace with enforce wrapper |
| `academy-influencer-login-rate-limit.cjs` | Replace |
| `orders-create.js` Maps | Replace |
| `ticket-qr-route.cjs` Map | Replace |
| `pos.js` login Map | Replace |
| `presale-server.js` `getClientIp` | Re-export from `rate-limit/client-ip.cjs` |

**Login failure counting:** Phase 1 uses **every-attempt consumes** (consistent with current admin/ambassador in-memory behavior). Scanner currently increments only failures — **change to every-attempt** for parity and simpler reasoning.

---

## 11. Tests to add

| File | Scenarios |
|------|-----------|
| `api/_lib/rate-limit/rate-limit.test.cjs` | Key hashing; **Lua EVAL atomic** mock (INCR+EXPIRE never called separately); over limit; fail-closed on Redis error |
| `api/_lib/rate-limit/import-compat.test.cjs` | **Merge gate:** `require('…/index.cjs')` from contexts simulating misc (ESM createRequire), scan, pos, academyRoutes, ticket-qr-route |
| `api/_lib/rate-limit/payment-confirm.test.cjs` | Missing orderId → IP only consumed, order bucket not called, no DB mock; invalid UUID → 400 generic; valid UUID → order bucket |
| `api/_lib/rate-limit/orders-create.test.cjs` | Service-role client **not** constructed when RL fails; parse before DB; IP + email buckets; device fail-open |
| `api/_lib/rate-limit/client-ip.test.cjs` | Vercel trusts XFF; local ignores spoofed XFF; IPv6 normalization |
| `api/_lib/rate-limit/enforce-login.test.cjs` | All login policies: 429 when second bucket exceeded |
| `api/_lib/rate-limit/emergency.test.cjs` | `RATE_LIMIT_GLOBAL_FAIL_OPEN` skips limits; `RATE_LIMIT_DISABLED` rejected in prod without reason |
| `api/_lib/rate-limit/qr-route.test.cjs` | Invalid token → 400 without Redis incr; valid token → RL before DB mock |
| `api/_lib/rate-limit/email-resend.test.cjs` | admin + order + recipient dimensions |
| `api/_lib/rate-limit/no-pii-in-keys.test.cjs` | Scan key strings for `@`, phone patterns, UUID plaintext |
| Update `api/_lib/scanner-login-rate-limit.test.cjs` | Mock Upstash instead of Map |
| Update `api/_lib/academy-influencer-hardening.test.cjs` | Same |
| Update `api/_lib/server-cjs-admin-login-parity.test.cjs` | Extend to shared module imports |

Add npm script (implementation PR):

```json
"test:rate-limit": "node --test api/_lib/rate-limit/**/*.test.cjs api/_lib/rate-limit/*.test.cjs"
```

### `import-compat.test.cjs` — required assertions

Each test case `require()`s `api/_lib/rate-limit/index.cjs` and calls one exported function (`hashRateLimitSegment('test')` or `getClientIp(mockReq)`):

1. **misc.js path** — `createRequire` from a `.mjs` shim (same as `api/misc.js` pattern)
2. **scan.js path** — ESM file + `createRequire(import.meta.url)`
3. **pos.js path** — same as scan
4. **academyRoutes.cjs** — direct `require('../api/_lib/rate-limit/index.cjs')`
5. **ticket-qr-route.cjs** — direct `require('./rate-limit/index.cjs')` relative to `_lib`

Failure of any case blocks merge.

---

## 12. Verification commands (post-implementation)

Run locally with Upstash **test instance** env vars (never production keys in CI logs):

```bash
# Unit tests
npm run test:rate-limit

# Regression suites touching auth/payment/login
npm run test:login-security
npm run test:payment-fulfillment
npm run test:academy-payment
npm run test:admin-auth-order
npm run test:security-remediation

# Full unit suite (if time permits)
npm test
```

**Manual staging checks (no production load):**

1. Admin login: 6th bad attempt → 429 JSON `{ error: 'rate_limited' }`.
2. ClicToPay confirm: complete real test payment once; refresh processing page 5× → still 200.
3. Resend ticket: 6th resend same order in 1h → 429.
4. QR: burst 61 requests/min same IP → 429 before 503 DB errors.
5. Unset Upstash on preview → P0 route returns 503 (if fail-closed policy approved).
6. Payment confirm with missing `orderId` → 400 generic, confirm DB mock **not** called.
7. Payment confirm with `orderId=not-a-uuid` → 400 generic, order bucket **not** incremented (mock assertion).

**Vercel preview deploy:** confirm env vars present via dashboard (do not print values).

---

## 13. Rollback and emergency controls

### Primary emergency: `RATE_LIMIT_GLOBAL_FAIL_OPEN=1`

**Use for Redis outages or limiter bugs** — preferred over full disable.

| Behavior | Detail |
|----------|--------|
| When set | `enforceRateLimits()` returns `{ allowed: true, skipped: true, reason: 'global_fail_open' }` for all buckets |
| Logging | **One `console.error` per cold start** + insert `security_audit_logs` event `rate_limit_global_fail_open` with severity **high** |
| Scope | Rate limits only — **does not** disable auth, CSRF, presale CSRF, RLS, payment idempotency, reCAPTCHA, or QR token validation |
| Production | Allowed temporarily; requires runbook ticket; alert if enabled > 1 hour |

### Secondary: `RATE_LIMIT_DISABLED=1` (discouraged, production-guarded)

**Full skip of all `enforceRateLimits` calls** — use only when fail-open insufficient (e.g. limiter code crash loop).

| Guard | Requirement |
|-------|-------------|
| Production block | If `VERCEL_ENV=production` **and** `RATE_LIMIT_DISABLED=1` **without** `RATE_LIMIT_DISABLED_REASON` (non-empty, min 10 chars) → **ignore disable**, log `rate_limit_disable_rejected`, limits **remain active** |
| Loud logging | Every cold start while active: `console.error('[SECURITY] RATE_LIMIT_DISABLED active', { reason, env, timestamp })` |
| Audit | `security_audit_logs`: `event_type: 'rate_limit_disabled'`, severity **critical** |
| Never disables | Auth, CSRF, RLS, payment fulfillment idempotency, signed URLs, bcrypt, session cookies |
| Runbook | Requires named approver + incident ID in `RATE_LIMIT_DISABLED_REASON` |

**Preference order:** fix Redis → `RATE_LIMIT_GLOBAL_FAIL_OPEN=1` → Vercel rollback → `RATE_LIMIT_DISABLED` (last resort).

### Other rollback steps

1. **Revert deploy:** standard Vercel promotion rollback to previous deployment.
2. **Tune limits:** adjust `RATE_LIMIT_*_MAX` env vars without code revert.
3. **Data cleanup:** Redis keys auto-expire via Lua TTL; no migration rollback needed.

---

## 14. Risks and unknowns — manual review required

| ID | Risk | Review question |
|----|------|-----------------|
| R1 | **Fail-closed without Upstash on Vercel** breaks preview deploys if Redis not provisioned | Confirm all Vercel envs have Upstash before merge, or restrict fail-closed to `VERCEL_ENV=production` only |
| R2 | **ClicToPay confirm 429** blocks paid users on retry | Monitor 429 rate on `payment.confirm`; tune order max; confirm frontend backoff |
| R3 | **Shared NAT at events** — IP bucket on order create may affect many users | Order email bucket is backstop; consider raising IP max if Tunisia mobile carrier NAT is aggressive |
| R4 | **Academy routes in Express sub-app** inside `misc.js` | Ensure `enforceRateLimits` works when mounted via `registerAcademyRoutes(app)` — may need to pass `req,res` from Vercel handler |
| R5 | **Login every-attempt vs failure-only** for scanner | Product decision: stricter every-attempt (recommended) may lock out typo users faster |
| R6 | **Recipient bucket on resend** uses order email — Brevo prefetch / multiple admins | 3/hr/recipient may be tight if support team resends; tune via env |
| R7 | **Device bucket fail-open** | Attackers can rotate `X-Device-Id`; IP+email are real enforcement |
| R8 | **503 vs 429 on Redis down** | Support playbooks must distinguish infrastructure vs abuse |
| R9 | **Rate limit before reCAPTCHA** on admin login | May increase bot traffic hitting reCAPTCHA after IP blocked — acceptable tradeoff |
| R10 | **CJS/ESM interop** | **Resolved in plan:** all rate-limit code in `.cjs`; `import-compat.test.cjs` is merge gate |
| R11 | **Cron/marketing routes** not in Phase 1 | Ensure bulk SMS limit doesn't block legitimate campaign launch — admin bucket 5/hr may need raise after first production campaign |
| R12 | **Double counting** | Order create hits both new Redis limits and existing promo Supabase RPC — intentional defense in depth; watch false positives on promo checkout |
| R13 | **Lua EVAL on Upstash** | Confirm `/eval` endpoint works with project Redis version in staging before prod |
| R14 | **Scanner validate-ticket** deferred to Phase 2 | **Urgent** — schedule within days of Phase 1 deploy, not weeks |

---

## 15. Implementation sequence (suggested PR order)

Single PR preferred for consistency; if split:

1. **PR-1a:** `api/_lib/rate-limit/*.cjs` + Lua EVAL + `import-compat.test.cjs` + `env.example` (no route wiring).
2. **PR-1b:** Login routes (admin, ambassador, scanner, POS, influencer) + migrate `admin-login-upstash.js`.
3. **PR-1c:** Payment + order create + ambassador/POS actions.
4. **PR-1d:** Email/SMS/resend + QR route.
5. **PR-1e:** `server.cjs` parity + remove dead Map limiters.

**Merge gate:** `test:rate-limit` (includes `import-compat`) + `test:login-security` + `test:payment-fulfillment` green; staging manual checks §12 complete.

---

## 16. Approval checklist (before coding)

- [ ] Upstash provisioned on production + preview
- [ ] Fail-closed scope agreed (all Vercel vs production-only)
- [ ] **Lua EVAL atomic increment** verified against staging Upstash instance
- [ ] Payment confirm malformed-request rules approved (IP only, no DB on bad UUID)
- [ ] Payment confirm limits (40/order/15m) approved
- [ ] Admin resend limits (5/order/hr) approved
- [ ] POS order create defaults (120/500/60) approved or env overrides documented for events team
- [ ] **`RATE_LIMIT_GLOBAL_FAIL_OPEN`** documented as primary emergency (not full disable)
- [ ] **`RATE_LIMIT_DISABLED`** production guard + `RATE_LIMIT_DISABLED_REASON` approved
- [ ] Scanner login every-attempt consumption approved
- [ ] **Phase 2 scanner validate-ticket** scheduled as urgent follow-up
- [ ] **`import-compat.test.cjs`** included in merge gate
- [ ] No objection to removing in-memory Maps on P0 routes

---

## 17. Final coding checklist (use during implementation)

### Module foundation

- [ ] All files under `api/_lib/rate-limit/` are **`.cjs`**
- [ ] `index.cjs` exports: `getClientIp`, `enforceRateLimits`, `sendRateLimited`, policy readers, `hashRateLimitSegment`, emergency flags
- [ ] `incrFixedWindow` uses **single Lua EVAL** — no separate INCR + EXPIRE in production path
- [ ] `import-compat.test.cjs` passes for misc/scan/pos/academy/ticket-qr import paths

### Per-route wiring

- [ ] Admin login: RL before reCAPTCHA; Upstash not legacy split INCR/EXPIRE
- [ ] Ambassador/scanner/POS/influencer login: IP + identifier buckets; env overrides work
- [ ] Payment generate: IP + order(registration) after UUID validation
- [ ] Payment confirm: **IP → parse → UUID check → 400 no DB if bad → order bucket → DB**
- [ ] Orders create: **parse (256KB) → RL → service role → reCAPTCHA → validate → insert**
- [ ] Ambassador confirm/cancel: auth → RL → DB
- [ ] POS order create: auth → RL (env-tunable defaults) → DB
- [ ] Email/SMS/resend: auth → RL (admin + order + recipient where applicable)
- [ ] QR: format check → RL → DB

### Safety

- [ ] No raw email/phone/token/JWT in Redis keys or rate-limit logs
- [ ] `RATE_LIMIT_GLOBAL_FAIL_OPEN` logs loudly; does not touch auth/CSRF/RLS/idempotency
- [ ] `RATE_LIMIT_DISABLED` blocked in prod without reason
- [ ] P0 routes do not use in-memory `Map` on Vercel when Upstash configured
- [ ] Existing presale/promo Supabase RPC limits unchanged

### Verification

- [ ] `npm run test:rate-limit` green
- [ ] `npm run test:login-security` + `test:payment-fulfillment` green
- [ ] Staging manual checks §12 (incl. malformed confirm → 400, no DB)
- [ ] `env.example` documents Upstash, pepper, `RATE_LIMIT_*` overrides, emergency flags

---

*Plan only — no application code modified.*
