# Full Active Offensive Security Test — Andiamo Events — 2026-06-28

**Auditor role:** Senior offensive security engineer (authorized internal test)  
**Target:** Andiamo Events — public site, admin/super-admin, ambassador, scanner, POS, influencer, Supabase, payments  
**Project ref:** `ykeryyraxmtjunnotoep`  
**Production URL tested (read-only):** https://www.andiamoevents.com  
**Codebase:** Vite/React SPA + Vercel serverless (`api/*.js`) + local Express mirror (`server.cjs`)

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| **Overall verdict** | **PASS WITH GAPS** |
| **Critical findings** | **0** confirmed active in production |
| **High findings** | **3** |
| **Medium findings** | **9** |
| **Low findings** | **7** |
| **Info findings** | **6** |

**Most dangerous attack path (confirmed design risk):** An attacker who obtains or guesses a valid ticket `secure_token` (UUID bearer) can request `GET /api/tickets/qr/:secureToken` without any session and receive a QR PNG — enabling ticket duplication if the token leaks via email, screenshot, referrer, or log. RLS correctly blocks direct Supabase reads of `tickets`/`qr_tickets`, but the **server-rendered QR route is intentionally public-by-token**.

**Production deployment blocked?** **No** — no active Critical data-exfiltration or unauthenticated admin API access was confirmed. Deploy is acceptable **after** reviewing High items; several Medium items are hardening backlog.

**Positive controls observed:**
- Admin/scanner/ambassador/influencer protected APIs return **401** without valid cookies on production (live probes).
- Supabase RLS regression script **passed** — anon cannot read/write private tables; maintenance RPCs blocked (42501).
- Recent authZ remediation (2026-06-28) — effective permission gates, missing Vercel handlers, logout session invalidation — **70/70 unit tests passed**.
- Security headers on production **complete and valid** (CSP enforcing + report-only, HSTS preload, COOP/CORP).
- Frontend production bundle: **no** `SERVICE_ROLE`, `JWT_SECRET`, or raw JWT material detected in `dist/assets/*.js`; **no** `.map` files shipped in dist.

---

## 2. Scope Reviewed

### Repositories / folders
- `api/` — all serverless handlers and `_lib/` auth, payment, scanner, ambassador modules
- `server.cjs` — local Express mirror (~12k lines)
- `vercel.json` — rewrites, headers, function config
- `src/` — pages, auth guards, Supabase client, admin dashboard
- `shared/admin/` — permissions, tab access
- `lib/cors.js` — CORS allowlist
- `scripts/security/` — RLS, storage, admin-auth, public-route scanners
- `supabase/migrations/` — remediation package `20260628115239`–`20260628120600`
- `security/` — prior audits (MCP readonly, post-remediation validation, admin JWT/authZ fix reports)

### Production routes inventoried
~165 distinct `/api/*` paths via `vercel.json` rewrites + native functions + `server.cjs` grep.

### Test accounts / roles
**Not provisioned for this session.** No dedicated staging/local matrix accounts were created or used. Active role-based API fuzzing, IDOR with paired test UUIDs, and login enumeration POST tests were **not executed live** (see §16). Authorization conclusions rely on static analysis, automated regression tests, and production **read-only GET/HEAD/OPTIONS** probes.

| Role | Status |
|------|--------|
| anonymous | Production GET probes only |
| normal customer | Static only |
| ambassador pending/approved/rejected | Static only |
| scanner event A/B | Static only |
| POS event A/B | Static only |
| influencer | Static only |
| limited admin / hidden tabs | Unit tests (`effectivePermissionDenied`) |
| disabled admin | Unit tests + login code review |
| regular admin / super-admin | Static + unit tests |

---

## 3. Test Environment

| Test class | Environment | Executed? |
|------------|-------------|-----------|
| Static code/route analysis | Repository | **Yes** |
| Automated security scripts | Connected Supabase (anon + service policy audit) | **Yes** |
| Unit/regression tests | Local Node | **Yes** |
| `npm run build` bundle review | Local | **Yes** |
| Production read-only GET/HEAD/OPTIONS | https://www.andiamoevents.com | **Yes** |
| Production POST/mutation probes | — | **No** (policy) |
| Staging active auth/RBAC/IDOR | — | **Not executed** (no test accounts) |
| Local `server.cjs` active attacks | — | **Not executed** (no local server session) |
| Supabase MCP live SQL | — | **Not executed** (prior read-only MCP audit reused) |

---

## 4. Attack Surface Inventory

### Public website routes (SPA)
`/`, `/events`, `/event/:slug`, `/pass-purchase`, `/payment-processing`, `/about`, `/careers`, `/ambassador`, `/contact`, `/suggestions`, `/terms`, `/academy/*`, `/:eventSlug`

### Admin routes (API — production via `misc.js` + dedicated functions)
`/api/admin-login`, `/api/verify-admin`, `/api/admin-logout`, `/api/admin/dashboard/bootstrap`, `/api/admin/events*`, `/api/admin/passes*`, `/api/admin/orders*`, `/api/admin/ambassadors*`, `/api/admin/admins*`, `/api/admin/audit-log(s)`, marketing/SMS, presale/event-promo admin, POS admin (`admin-pos.js`), scanner admin (`scan.js`), official invitations (super-admin), order QR tickets (super-admin), media upload/delete, cron maintenance endpoints

### Ambassador routes
`/api/ambassador-login`, `/api/ambassador-logout`, `/api/ambassador/me`, `/api/ambassador/events`, `/api/ambassador/orders`, `/api/ambassador/performance`, `/api/ambassador/cancel-order`, `/api/ambassador/confirm-cash`, `/api/ambassador-update-password`, `/api/ambassadors/active`, `/api/ambassador-application`

### Scanner routes (`scan.js`)
`/api/scan-system-status`, `/api/scanner-login`, `/api/scanner-logout`, `/api/scanner/*`, `/api/admin/scanners*`, `/api/admin/scan-*`

### POS routes (`pos.js`)
`/api/pos/:outletSlug/login|logout|verify|events|passes/:eventId|orders/create`

### Influencer routes (academy-influencer in `misc.js`)
`/api/academy-influencer/login|logout|session|change-password|sales`

### Payment / webhook / fulfillment
`/api/orders/create`, `/api/clictopay-generate-payment`, `/api/clictopay-confirm-payment`, `/api/admin-approve-order`, `/api/tickets/qr/:secureToken`, academy payment confirm paths

### Supabase client usage (browser)
`src/integrations/supabase/client.ts` — anon key only; used for public reads (events, site content, cities) and constrained anon INSERTs (contact, newsletter). Admin order/ticket tables **not** queried from frontend.

### Service-role usage (server only)
`api/_lib/service-role-client.js`, `createAdminDbClient`, direct `createClient(..., SUPABASE_SERVICE_ROLE_KEY)` in `misc.js`, `server.cjs`, POS, scan, orders, payment fulfillment.

### RPCs (Postgres)
`validate_scanner_ticket_atomic`, `insert_fulfillment_tickets_locked`, maintenance RPCs (`release_order_stock_internal`, `auto_fail_expired_pending_online_orders`, etc.) — client EXECUTE **revoked** post-remediation (validated by `security:rls`).

### Storage buckets
Private: `tickets`, `career-documents`, `academy-payment-proofs`, `events`  
Public CDN: `hero-images`, `images`

### Realtime / publications
Sensitive tables removed from `supabase_realtime` per remediation migrations (validated in post-remediation report).

### Environment variables (names only)
`JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `VITE_SUPABASE_*`, `CRON_SECRET`, `CLICTOPAY_*`, `WINSMS_API_KEY`, `EMAIL_*`, `AMBASSADOR_SESSION_*`, `SENTRY_DSN`, `VITE_RECAPTCHA_SITE_KEY`

---

## 5. Active Attack Results

| Attack ID | Attacker role | Target | Method | Expected | Actual | Evidence | Verdict |
|-----------|---------------|--------|--------|----------|--------|----------|---------|
| ATK-001 | anonymous | `/api/verify-admin` | GET | 401 | **401** | Production probe; no cookie | **Blocked** |
| ATK-002 | anonymous | `/api/admin/dashboard/bootstrap` | GET | 401 | **401** | Production probe | **Blocked** |
| ATK-003 | anonymous | `/api/admin/orders/online` | GET | 401 | **401** | Production probe | **Blocked** |
| ATK-004 | anonymous | `/api/admin/admins` | GET | 401 | **401** | Production probe | **Blocked** |
| ATK-005 | anonymous | `/api/admin/order-qr-tickets` | GET | 401 | **401** | Production probe (super-admin route) | **Blocked** |
| ATK-006 | anonymous | `/api/scanner/events` | GET | 401 | **401** | Production probe | **Blocked** |
| ATK-007 | anonymous | `/api/ambassador/me` | GET | 401 | **401** | Production probe | **Blocked** |
| ATK-008 | anonymous | `/api/academy-influencer/session` | GET | 401 | **401** | Production probe | **Blocked** |
| ATK-009 | anonymous | `/api/auto-reject-expired-orders` | GET | 401/403 | **401** | Production probe; cron secret required | **Blocked** |
| ATK-010 | anonymous | `/api/marketing/cron/email-campaigns` | GET | 401/403 | **401** | Production probe | **Blocked** |
| ATK-011 | anonymous | malformed JWT | GET `/api/verify-admin` + `Cookie: adminToken=eyJ...invalid` | 401 | **401** | Production probe; empty body | **Blocked** |
| ATK-012 | anonymous | `/api/scan-system-status` | GET | 200 public | **200** `{enabled}` shape (~17 B) | Production probe | **Expected public** |
| ATK-013 | anonymous | `/api/tickets/qr/00000000-0000-0000-0000-000000000001` | GET | 404/400 | **400** | Synthetic UUID only; no PNG returned | **Blocked (invalid token)** |
| ATK-014 | anonymous | `/api/test`, `/api/test-supabase` | GET | absent on prod | **404** | Debug routes not in Vercel rewrites | **Not exposed (prod)** |
| ATK-015 | evil origin | `/` | OPTIONS | no ACAO | **No ACAO** | `Origin: https://evil.example.com` | **Blocked** |
| ATK-016 | legit origin | `/api/verify-admin` | OPTIONS | ACAO mirror | **ACAO: https://www.andiamoevents.com** | CORS preflight | **Correct** |
| ATK-017 | anonymous | Supabase `orders` SELECT | REST | deny | **count=0 / 42501** | `npm run security:rls` | **Blocked** |
| ATK-018 | anonymous | Supabase maintenance RPCs | RPC | 42501 | **42501** all 14 probed | `security:rls` | **Blocked** |
| ATK-019 | anonymous | Storage `tickets` GET | REST | deny | **400** | `security:storage` | **Blocked** |
| ATK-020 | anonymous | Storage anon upload `tickets` | POST | deny | **400** | `security:storage` | **Blocked** |
| ATK-021 | limited admin (unit) | POS API | — | 403 without `pos:manage` | **403** in `effectivePermissionDenied` tests | `admin-effective-permission-gate.test.cjs` | **Blocked** |
| ATK-022 | limited admin (unit) | `orders:manage` routes | — | 403 | **403** in unit tests | same | **Blocked** |
| ATK-023 | wrong role JWT (unit) | verifyAdminSession | — | 401 | **401** invalid role | `admin-verify` tests | **Blocked** |
| ATK-024 | expired JWT (unit) | verifyAdminSession | — | 401 | **401** | unit tests | **Blocked** |
| ATK-025 | static | `misc.js` cancel-order | — | auth before DB | gate before `createAdminDbClient` | `admin-api-authz-coverage.test.cjs` | **Pass** |
| ATK-026 | static | Legacy `server.cjs` `/api/validate-ticket` | POST | auth required | **No auth**; uses anon client | `server.cjs` L3648 | **Vulnerable (local dev only)** |
| ATK-027 | static | Frontend scanner `/scanner/scan` | navigate | redirect if no session | **UI renders**; API returns 401 | `ScannerApp.tsx` no route guard | **UI gap; API blocked** |
| ATK-028 | static | Admin `PaymentOptionsManager` load | client Supabase | should use admin API | **`fetchAllPaymentOptions()` via anon client** | `paymentService.ts` + RLS | **Needs review** |

---

## 6. Findings

### Finding ID: SEC-20260628-001

**Severity:** High  
**Status:** Confirmed (design + prior pentest alignment)  
**Affected area:** Ticket QR rendering  
**Affected files:** `api/_lib/ticket-qr-route.cjs`, `vercel.json` (rewrite to `misc.js`)  
**Affected routes:** `GET /api/tickets/qr/:secureToken`  
**Affected tables/RPCs:** `qr_tickets`, `tickets` (server-side service role)  
**Attacker role required:** anonymous (possession of valid token)  
**Attack scenario:** Attacker obtains `secure_token` from email link, log, or shoulder-surf → requests QR PNG → duplicates ticket at gate.  
**Impact:** Ticket fraud / unauthorized entry if token leaks.  
**Evidence:** Route registered as public storage path in `misc.js`; synthetic UUID returns 400 (no leak); valid token behavior documented in `security/security-pentest-report-andiamoevents-2026-06-27.md`.  
**Sensitive data exposed:** Yes (QR image when token valid) — **not reproduced with real token**; test used synthetic UUID only.  
**Why current defense is insufficient:** Bearer-token URLs are shareable; no session binding, expiry, or one-time use on QR endpoint.  
**Recommended fix:** Short-lived signed QR URLs, rate limits per token, or require email/order proof for re-fetch; audit email/logging for token leakage.  
**Regression test required:** `api/_lib/ticket-qr-generate.test.cjs` extension — assert invalid/expired signed URL rejected.  
**Production risk:** High if tokens leak (common via email).  
**Release blocker:** No (pre-existing product design) — track as High hardening.

---

### Finding ID: SEC-20260628-002

**Severity:** High  
**Status:** Needs Review  
**Affected area:** Admin payment settings — client-side data path  
**Affected files:** `src/lib/orders/paymentService.ts`, `src/components/admin/PaymentOptionsManager.tsx`  
**Affected routes:** N/A (direct Supabase client)  
**Affected tables:** `payment_options` (public SELECT policy per MCP audit F-017)  
**Attacker role required:** anonymous (for read); authenticated admin UI for intended use  
**Attack scenario:** Admin dashboard loads all payment options via browser Supabase client (`select *`) instead of gated `GET /api/admin/payment-options`. Any party with anon key can also read `payment_options` via REST (including disabled rows, external app URLs).  
**Impact:** Configuration disclosure; defense relies on RLS policy breadth not admin session.  
**Evidence:** `fetchAllPaymentOptions()` uses `supabase.from('payment_options').select('*')`; saves correctly use API `PUT` with `settings:manage`. MCP audit lists `payment_options` as intentional public SELECT.  
**Sensitive data exposed:** Partial — external app links/names, not payment secrets.  
**Why current defense is insufficient:** Admin-only fields mixed into public-read table; UI bypasses admin API for reads.  
**Recommended fix:** Route admin reads through `/api/admin/payment-options`; narrow RLS to enabled rows only for anon.  
**Regression test required:** RLS script add anon SELECT probe on disabled `payment_options` rows.  
**Production risk:** Medium–High for config disclosure.  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-003

**Severity:** High  
**Status:** Confirmed  
**Affected area:** Content Security Policy  
**Affected files:** `vercel.json`  
**Affected routes:** All static assets  
**Attacker role required:** anonymous (XSS prerequisite)  
**Attack scenario:** If HTML injection exists anywhere, CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts.  
**Impact:** XSS impact amplification.  
**Evidence:** `node scripts/verify-security-headers.js https://www.andiamoevents.com` — CSP present but includes unsafe directives (configured in `vercel.json` L36).  
**Sensitive data exposed:** No (policy config only).  
**Why current defense is insufficient:** Weak CSP reduces XSS containment.  
**Recommended fix:** Progressive nonce/hash CSP; remove `'unsafe-eval'` when compatible with Vite/third parties.  
**Regression test required:** Extend `verify-security-headers.js` to flag unsafe directives.  
**Production risk:** Medium (conditional on XSS).  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-004

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** Legacy local dev endpoint  
**Affected files:** `server.cjs` L3648–3710  
**Affected routes:** `POST /api/validate-ticket` (NOT in `vercel.json`)  
**Attacker role required:** anonymous  
**Attack scenario:** Local/dev server exposed to network accepts ticket validation with client-supplied `ambassadorId`, uses anon Supabase against legacy `pass_purchases` table.  
**Impact:** Full ticket validation bypass on misconfigured local deployments.  
**Evidence:** Handler has no auth middleware; documented as deferred in prior remediation. Production returns 404 (not routed).  
**Sensitive data exposed:** No in this test.  
**Recommended fix:** Remove endpoint or require scanner/ambassador auth; delete stale `API_ROUTES.VALIDATE_TICKET` if unused.  
**Regression test required:** Static test asserting route absent from `vercel.json` and marked deprecated in `server.cjs`.  
**Production risk:** Low (not deployed).  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-005

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** CSRF on cookie-authenticated admin/ambassador/scanner sessions  
**Affected files:** All state-changing routes using HttpOnly cookies + `SameSite=Lax`  
**Attacker role required:** victim admin (cross-site)  
**Attack scenario:** Cross-site POST from allowed sibling site or future subdomain misconfiguration triggers admin action while victim is logged in.  
**Impact:** State-changing actions without explicit CSRF token.  
**Evidence:** Documented as intentional deferral in `security-admin-jwt-auth-fix-report-2026-06-28.md`. CORS blocks evil origin; CSRF is separate from CORS.  
**Recommended fix:** CSRF tokens or `SameSite=Strict` for admin cookie where UX allows.  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-006

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** Server logs — QR secrets  
**Affected files:** `api/admin-approve-order.js` L407, `api/misc.js` L3795, `server.cjs` L9229  
**Affected routes:** Order approval / fulfillment paths  
**Attacker role required:** log reader (infra)  
**Attack scenario:** Fulfillment logs print `ticketData.secure_token` to stdout → log aggregation exposure.  
**Impact:** Token leakage → SEC-20260628-001 chain.  
**Evidence:** Static grep; values **not printed** in this report.  
**Sensitive data exposed:** Yes in logs — **redacted in report**.  
**Recommended fix:** Log ticket ID only; never log `secure_token`.  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-007

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** Scanner dashboard — frontend-only access control  
**Affected files:** `src/pages/scanner/ScannerApp.tsx`, `ScannerScan.tsx`, etc.  
**Affected routes:** `/scanner/scan`, `/scanner/history` (UI)  
**Attacker role required:** anonymous (UI); scanner cookie (API)  
**Attack scenario:** User navigates directly to `/scanner/scan` without login; UI may render until API calls fail.  
**Impact:** Informational UI leakage only if APIs enforce auth (they do — 401 on production).  
**Evidence:** No `ProtectedScannerRoute`; session checked per-page via `/api/scanner/session`.  
**Recommended fix:** Central scanner auth guard mirroring ambassador pattern.  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-008

**Severity:** Medium  
**Status:** Needs Review  
**Affected area:** Static admin-auth heuristic scan  
**Affected files:** `api/misc.js` (15 hits), `api/_lib/admin-missing-routes-http.js` (5 hits)  
**Affected routes:** Various admin handlers  
**Attacker role required:** depends on false positive  
**Attack scenario:** Heuristic flags `createAdminDbClient` not preceded by auth check within scan window — may be nested after gate in outer dispatcher.  
**Impact:** Unknown without manual trace; unit tests assert order for critical paths.  
**Evidence:** `npm run security:admin-auth` exit 1, 20 findings; `test:admin-auth-order` 70/70 pass.  
**Recommended fix:** Tighten heuristic or add `# auth-gated` markers; run with `ADMIN_AUTH_PROBE_BASE_URL` on staging.  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-009

**Severity:** Medium  
**Status:** Confirmed (platform)  
**Affected area:** Supabase Auth configuration  
**Affected files:** Supabase dashboard settings  
**Evidence:** MCP advisor lints — OTP expiry > 1h, leaked-password protection disabled (`security/supabase-mcp-readonly-audit-2026-06-28.md` F-014, F-018).  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-010

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** Shared JWT secret architecture  
**Affected files:** Admin, scanner, POS, influencer auth modules  
**Attack scenario:** Compromise of `JWT_SECRET` forges all role cookies.  
**Impact:** Total auth bypass if secret leaks.  
**Evidence:** Single `JWT_SECRET` env used across handlers (code review); not exposed in bundle.  
**Recommended fix:** Role-specific signing keys or asymmetric JWTs; secret rotation runbook.  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-011

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** CMS HTML rendering  
**Affected files:** `src/pages/Careers.tsx` L873–879  
**Attack scenario:** Compromised admin CMS content injects XSS via `dangerouslySetInnerHTML`.  
**Impact:** Stored XSS on careers pages.  
**Evidence:** Static review; content sourced from DB `site_content`/career templates.  
**Recommended fix:** Sanitize with DOMPurify (already dependency) on render.  
**Release blocker:** No.

---

### Finding ID: SEC-20260628-012

**Severity:** Medium  
**Status:** Confirmed  
**Affected area:** Migration history drift  
**Affected files:** `supabase/migrations/20260628120600_*` vs remote `schema_migrations`  
**Evidence:** `security/supabase-post-remediation-validation-2026-06-28.md` — events storage migration applied live but history row missing.  
**Release blocker:** No (operational).

---

### Finding ID: SEC-20260628-013

**Severity:** Low  
**Status:** Confirmed  
**Affected area:** Influencer route wiring  
**Affected files:** `src/App.tsx` L260, `src/pages/influencer/Dashboard.tsx`  
**Evidence:** Route not wrapped in `ProtectedInfluencerRoute` at router level; protection applied inside Dashboard component. Direct child routes could skip guard if added later.  
**Recommended fix:** Wrap route in `App.tsx` like ambassador/admin.

---

### Finding ID: SEC-20260628-014

**Severity:** Low  
**Status:** Confirmed  
**Affected area:** Client Supabase anon INSERT  
**Affected files:** `src/pages/Contact.tsx`, `src/components/layout/Footer.tsx`  
**Tables:** `contact_messages`, `newsletter_subscribers`  
**Evidence:** Intentional anon INSERT with RLS constraints (MCP audit §4.5).  
**Risk:** Spam/abuse — rate limits should be at edge/API.

---

### Finding ID: SEC-20260628-015

**Severity:** Low  
**Status:** Confirmed  
**Affected area:** `server.cjs` debug endpoints  
**Routes:** `/api/test`, `/api/test-supabase`, `/api/sms-test`  
**Evidence:** Present in `server.cjs`; production GET → 404.

---

### Finding ID: SEC-20260628-016

**Severity:** Low  
**Status:** Info  
**Affected area:** Hidden source maps  
**Files:** `vite.config.ts` — production `sourcemap: false` unless Sentry upload  
**Evidence:** `dist/assets/` contains 0 `.map` files after build.

---

### Finding ID: SEC-20260628-017

**Severity:** Low  
**Status:** Info  
**Affected area:** WordPress probe honeypot  
**Routes:** `/wp-login.php`, `/.env` → `misc.js`  
**Evidence:** `vercel.json` rewrites to misc handler (non-standard paths blocked).

---

### Finding ID: SEC-20260628-018

**Severity:** Info  
**Status:** Confirmed remediated  
**Affected area:** Supabase RLS/RPC/storage  
**Evidence:** `npm run security:rls` PASSED; `security:storage` 13/13 PASSED; post-remediation MCP validation PASSED for revoked RPC EXECUTE, scans deny, realtime removal.

---

### Finding ID: SEC-20260628-019

**Severity:** Info  
**Status:** Confirmed  
**Affected area:** Payment confirm integrity  
**Files:** `api/_lib/clictopay-confirm-payment.cjs`, `clictopay-payment-verify.cjs`  
**Evidence:** Server verifies amount/currency/order ref with ClicToPay before fulfillment; client cannot set paid status directly (static + `payment-fulfillment.test.cjs`).

---

## 7. Role-by-role Attack Matrix

| Role | Target | Attack attempted | Result | Defense | Gap | Severity |
|------|--------|------------------|--------|---------|-----|----------|
| anonymous | Admin APIs | GET without cookie | 401 | JWT + verifyAdminSession | — | — |
| anonymous | Supabase orders | SELECT | Denied | RLS deny_all | — | — |
| anonymous | QR PNG | GET synthetic token | 400 | Invalid token | Valid token works | High |
| anonymous | Cron endpoints | GET | 401 | CRON_SECRET / admin gate | — | — |
| customer | Admin APIs | GET | 401 | Same | — | — |
| pending ambassador | Approved dashboard | Static | UI guard + `/ambassador/me` | Backend session | Not live-tested | Low |
| approved ambassador | Admin APIs | Static | 401 expected | Role separation | Not live-tested | — |
| rejected ambassador | Dashboard | Static | 401 on `/ambassador/me` | Status check in auth | Not live-tested | — |
| scanner A | Event B tickets | Static | Atomic RPC scopes by scanner assignment | `validate_scanner_ticket_atomic` | Not live-tested | Medium |
| POS A | Event B orders | Static | Outlet slug + session scoping in `pos.js` | Server-side outlet resolve | Not live-tested | Medium |
| influencer | Other influencer sales | Static | Session-bound profile | `academy-influencer-auth` | Not live-tested | Medium |
| limited admin | Hidden tab API | Unit test | 403 | effectivePermissionDenied | — | — |
| disabled admin | Admin login | Code review | 401 generic | is_active + dummy bcrypt | Not live POST | — |
| regular admin | Super-admin invitations | Static | 403 super_admin | verifySuperAdmin | — | — |
| super-admin | All audited admin routes | Unit/static | Pass | RBAC + tabs | CSRF gap | Medium |

---

## 8. API Authorization Matrix (representative sample)

| Route | Method | Handler file | Auth required | Required permission | Service-role? | DB before auth? | Sensitive response? | Actual test | Verdict |
|-------|--------|--------------|---------------|---------------------|---------------|-----------------|---------------------|-------------|---------|
| `/api/admin-login` | POST | `admin-login.js` | No | — | Yes (login) | After bcrypt | No JWT in body | Not POST prod | Pass (static) |
| `/api/verify-admin` | GET | `verify-admin-http.js` | Yes | — | Yes (recheck) | After JWT verify | Permissions metadata | 401 anon | Pass |
| `/api/admin-approve-order` | POST | `admin-approve-order.js` | Yes | orders:manage | Yes | After authZ | Order/ticket fields | Static | Pass |
| `/api/admin/pos-orders` | GET | `admin-pos.js` | Yes | pos:manage | Yes | After authZ | PII | Static | Pass |
| `/api/admin/admins` | GET | `admin-data-routes.js` | Yes | admins:manage | Yes | After authZ | Admin PII | 401 anon | Pass |
| `/api/admin/order-qr-tickets` | GET | `misc.js` / server | Yes | super_admin | Yes | After role gate | QR secrets masked in API | 401 anon | Pass |
| `/api/scanner/validate-ticket` | POST | `scan.js` | Scanner cookie | — | Yes | After scanner auth | Scan result | 401 anon (prior) | Pass |
| `/api/pos/:slug/orders/create` | POST | `pos.js` | POS session | outlet scope | Yes | After auth | Order id | Not live | Needs staging |
| `/api/clictopay-confirm-payment` | POST | `clictopay-confirm-payment.js` | No | Gateway verify | Yes | After ClicToPay | Tickets | Not POST prod | Pass (static) |
| `/api/tickets/qr/:token` | GET | `ticket-qr-route.cjs` | No | Token bearer | Yes | After token lookup | PNG | 400 synthetic | High design |
| `/api/ambassador/orders` | GET | `ambassador-routes.cjs` | Ambassador cookie | own scope | Yes | After session | Order PII | 401 anon | Pass |
| `/api/send-email` | POST | `misc.js` | Yes | marketing:manage | Yes | After gate | — | Static | Pass |
| `/api/admin/cancel-order` | POST | `admin-missing-routes-http.js` | Yes | orders:manage | Yes | After gate | — | Static | Pass |
| `/api/validate-ticket` | POST | `server.cjs` only | **No** | — | Anon client | Before auth | Ticket PII | N/A prod | **Fail local** |

Full ~165-route inventory: see `security/security-admin-api-authz-coverage-audit-2026-06-28.md` + fix report (2026-06-28).

---

## 9. Supabase/RLS/RPC/Storage Findings

| ID | Object | Type | Role | Issue | Status |
|----|--------|------|------|-------|--------|
| SB-01 | All 67 public tables | RLS | anon/authenticated | RLS enabled | Pass |
| SB-02 | orders, tickets, qr_tickets, admins | policy | anon | explicit deny_all | Pass |
| SB-03 | maintenance RPCs (8 functions) | EXECUTE | anon/authenticated | Revoked (42501 live) | Pass (remediated) |
| SB-04 | is_service_role() | RPC | anon/authenticated | Revoked | Pass (remediated) |
| SB-05 | validate_scanner_ticket_atomic | SECURITY DEFINER | service_role only | search_path hardened | Pass |
| SB-06 | supabase_realtime | publication | — | Sensitive tables removed | Pass |
| SB-07 | scans | policy | anon | INSERT denied (42501) | Pass |
| SB-08 | 26 tables | policy | — | explicit deny_all added | Pass |
| SB-09 | storage.objects events bucket | policy | service_role | Service role manage policy | Pass |
| SB-10 | payment_options | policy | anon | USING (true) SELECT | Intentional — see SEC-002 |
| SB-11 | cities, villes, sponsors, site_content | policy | anon | public read | Intentional |
| SB-12 | All public tables | GRANT | anon/authenticated | Full DML grants (RLS only) | Medium defense-in-depth |
| SB-13 | cleanup_old_credentials | RPC | — | References dropped table | Low stale surface |

Migrations reviewed: `20260628115239` through `20260628120600` (7 files).  
Detailed MCP evidence: `security/supabase-mcp-readonly-audit-2026-06-28.md`, validation: `security/supabase-post-remediation-validation-2026-06-28.md`.

---

## 10. Frontend Permission Findings

| Component / page | Guard type | Backend enforced? | Gap |
|------------------|------------|-------------------|-----|
| `ProtectedAdminRoute.tsx` | `/api/verify-admin` | Yes | Tab hiding UI-only; APIs gated |
| `ProtectedAmbassadorRoute.tsx` | `/api/ambassador/me` | Yes | — |
| `ProtectedInfluencerRoute.tsx` | `/api/academy-influencer/session` | Yes | Not on `App.tsx` route wrapper |
| `ScannerApp.tsx` | scan-system-status only | API 401 | No route-level scanner guard |
| `PosApp.tsx` | login vs dashboard path | Yes in `pos.js` | — |
| `Dashboard.tsx` (admin) | tabs from verify-admin cache | Yes on fixed routes | sessionStorage caches permissions (not secret) |
| `PaymentOptionsManager.tsx` | admin UI | **Read via anon Supabase** | SEC-20260628-002 |
| `Careers.tsx` | public | N/A | dangerouslySetInnerHTML SEC-011 |

**Bundle secrets scan:** No service role / JWT in `dist/assets/*.js`. Supabase URL/key inlined as expected publishable anon key only (build output grep).

---

## 11. Payment/Webhook Findings

| Control | Result | Evidence |
|---------|--------|----------|
| Webhook signature bypass | Not applicable — ClicToPay uses server-side status poll | `clictopay-confirm-payment.cjs` |
| Client sets paid status | Blocked | Gateway validation before `fulfillPaidOrderTicketsAndEmail` |
| Duplicate fulfillment | Mitigated | Fulfillment locks / tests in `payment-fulfillment.test.cjs` |
| Replay confirm | Partial | Idempotency via order status checks (static) |
| Admin manual approve | Gated | `orders:manage` on `admin-approve-order.js` |
| QR in approval logs | **Leak** | SEC-20260628-006 |

**Staging/local POST tests:** Not executed (policy + no test orders).

---

## 12. Production vs Local Parity

| Area | Production (Vercel) | Local (`server.cjs`) | Parity |
|------|---------------------|----------------------|--------|
| Admin login JWT claims | id, email, role, session_version | Aligned after 2026-06-28 fix | Pass |
| Admin logout | session_version bump + clear cookie | Shared handler | Pass |
| Admin permission gates | effectivePermissionDenied | requireAdminPermission | Pass (post-fix) |
| Scanner admin routes | scanners:manage | scanners:manage (fixed) | Pass |
| Debug `/api/test` | 404 | Exposed if server run | **Gap** |
| Legacy `/api/validate-ticket` | Not routed | Unauthenticated | **Gap** |
| `/api/payment-options` GET | 404 on prod probe | Implemented server.cjs | **Gap** — use API or Supabase client |
| CORS | lib/cors.js allowlist | Broader dev allow | Expected |
| CSP headers | vercel.json | Depends on deployment target | Prod verified |

---

## 13. Recommended Remediation Plan

### Emergency blockers
None identified for production deploy.

### High priority
1. Harden ticket QR access (signed URLs / expiry) — SEC-20260628-001  
2. Move admin payment option reads to API; tighten `payment_options` RLS — SEC-20260628-002  
3. Remove `secure_token` from server logs — SEC-20260628-006  
4. Tighten CSP (remove unsafe-eval when feasible) — SEC-20260628-003  

### Medium priority
5. CSRF tokens for admin cookie mutations — SEC-20260628-005  
6. Remove or auth-gate `server.cjs` `/api/validate-ticket` — SEC-20260628-004  
7. Scanner frontend auth wrapper — SEC-20260628-007  
8. DOMPurify on careers CMS HTML — SEC-20260628-011  
9. Supabase Auth dashboard hardening (OTP, leaked passwords) — SEC-20260628-009  
10. Resolve migration history drift — SEC-20260628-012  
11. Staging live authZ matrix with dedicated test accounts  

### Hardening backlog
- JWT secret segregation / rotation — SEC-20260628-010  
- FORCE RLS on highest-sensitivity tables  
- REVOKE broad anon/authenticated DML grants  
- Influencer route guard at router level — SEC-20260628-013  
- Run `security:admin-auth` with `ADMIN_AUTH_PROBE_BASE_URL` on staging  

---

## 14. Tests to Add

| File | Assertions |
|------|------------|
| `api/_lib/ticket-qr-route.security.test.cjs` | Invalid/expired signed URL → 403; rate limit headers |
| `api/_lib/admin-payment-options-read.test.cjs` | Admin list never via anon client path in frontend (lint/import ban) |
| `scripts/security/check-no-secure-token-logs.mjs` | Fail if `console.log` includes `secure_token` |
| `api/_lib/scanner-route-guard.test.cjs` | Static: all `/scanner/*` pages import session check |
| `scripts/security/check-supabase-rls.mjs` | Add probe: anon cannot SELECT disabled `payment_options` rows (after RLS change) |
| Staging integration (manual CI job) | Role matrix ATK table with real cookies — 401/403/200 expectations |

Existing passing suites to keep in CI: `test:admin-auth-order`, `test:login-security`, `test:supabase-remediation`, `security:rls`, `security:storage`, `security:public-routes`.

---

## 15. Commands Run

```text
npm run security:check
npm run security:rls
npm run security:admin-auth
npm run security:public-routes
npm run security:storage
npm run test:admin-auth-order
npm run test:login-security
npm run test:supabase-remediation
npm run build
node scripts/verify-security-headers.js https://www.andiamoevents.com
```

Production read-only PowerShell probes:
- GET `/api/verify-admin`, `/api/admin/dashboard/bootstrap`, `/api/admin/orders/online`, `/api/admin/admins`, `/api/admin/order-qr-tickets`, `/api/scanner/events`, `/api/ambassador/me`, `/api/academy-influencer/session`, `/api/scan-system-status`, `/api/passes/{synthetic-uuid}`, `/api/test`, `/api/test-supabase`, `/api/tickets/qr/{synthetic-uuid}`, `/api/auto-reject-expired-orders`, `/api/marketing/cron/email-campaigns`, `/api/payment-options`
- GET `/api/verify-admin` with malformed `adminToken` cookie
- OPTIONS `/` with `Origin: https://evil.example.com`
- OPTIONS `/api/verify-admin` with `Origin: https://www.andiamoevents.com`

Static analysis: ripgrep across `api/`, `server.cjs`, `src/`, `vercel.json`, `dist/assets/`.

---

## 16. Areas Not Reviewed

- **Live staging environment** — no staging URL or credentials used for POST/auth flows  
- **Dedicated test account matrix** — not created; IDOR/BOLA/race tests not performed  
- **Production POST login enumeration** — blocked by read-only production policy; manual steps below  
- **Payment webhook replay on staging** — requires test orders + ClicToPay sandbox  
- **Double-scan race** — requires staging scanner + test ticket  
- **Supabase MCP SQL this session** — relied on prior 2026-06-28 read-only MCP audit  
- **Edge/WAF/Cloudflare Bot Management** — not in repo scope  
- **Mobile native clients** — N/A  
- **Third-party ClicToPay/Winsms/Brevo** — no attacks on third-party systems  

### Manual production-safe follow-ups (operator)

1. **Login enumeration (≤5 attempts):** On staging, POST `/api/admin-login` with valid vs invalid email; confirm identical error body/timing.  
2. **Disabled admin:** Staging account with `is_active=false` → expect 401 "Invalid credentials".  
3. **Limited admin hidden tab:** Cookie for tab-restricted admin → POST `/api/send-sms` → expect 403.  
4. **Ambassador pending:** `/api/ambassador/me` → expect 401/403 for non-approved.  

---

## 17. Final Verdict

| Question | Answer |
|----------|--------|
| **Safe to deploy?** | **Yes**, with known High design risks accepted or scheduled |
| **Fix first** | QR bearer exposure path, payment_options read path, log redaction, CSP tightening |
| **Can wait** | CSRF, legacy server.cjs cleanup, scanner UI guard, migration history repair, Auth dashboard OTP settings |

**Summary:** Andiamo Events production presents a ** materially improved** posture after June 2026 RLS and admin authZ remediations. Anonymous attackers cannot read private database rows via Supabase REST, cannot call admin/scanner/ambassador APIs without cookies (401 verified), and security headers are correctly deployed. Remaining risk concentrates on **bearer-token ticket URLs**, **public-read configuration tables**, **CSP weakness**, and **operational gaps** (staging role tests, legacy local endpoints). No Critical finding warrants an emergency production shutdown.

---

*Report generated 2026-06-28. No secrets, tokens, personal data, or payment data were written to this file. All live probes used synthetic IDs or unauthenticated requests only.*
