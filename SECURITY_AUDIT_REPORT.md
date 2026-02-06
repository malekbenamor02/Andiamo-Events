# Security Audit Report — andiamoevents.com

**Platform:** andiamoevents.com  
**Hosting:** Vercel (frontend & API)  
**Database:** Supabase  
**Domain:** Hosting.fr  
**Audit type:** Code and configuration review (no infrastructure or third-party access)  
**Date:** February 2, 2025  
**Scope:** No changes to code or infrastructure; analysis only.

---

## Executive Summary

This report summarizes the security posture of the Andiamo Events platform based on a review of the repository (Vercel config, API routes, Supabase migrations, CORS, auth, and env usage). It does **not** include access to Hosting.fr, Cloudflare, or Vercel/Supabase dashboards, so those areas are covered as checks you should perform and as recommendations.

**Overall:** The app has solid basics (security headers, CORS, JWT auth, RLS, env-based secrets). Main gaps: **admin login has no reCAPTCHA and no rate limiting on Vercel**, **CSP is report-only**, **no 2FA**, **cron and payment endpoints need hardening**, and **Flouci payment routes are only in `server.cjs` (not in Vercel API), which may break payment on Vercel-only deployments.**

---

## 1. Hosting Configuration (Hosting.fr)

**What was reviewed:** Only the codebase; no access to Hosting.fr.

**Findings:**

- **Firewall / ports:** Cannot be verified from code. You should confirm in Hosting.fr that only **80** and **443** are open and that other ports (SSH, FTP, DB, etc.) are closed or restricted.
- **Domain / DNS:** Domain is registered via Hosting.fr. Ensure:
  - No unintended subdomains point to internal or staging systems.
  - MX and other DNS records do not expose mail or other sensitive services to the whole internet unless intended.
- **Sensitive services:** Confirm that Hosting.fr is used only for DNS/domain and that no databases, admin panels, or dev tools are hosted there with public access.

**Recommended actions (no code change):**

1. In Hosting.fr, review firewall rules and ensure only 80/443 are open for web.
2. Review DNS for andiamoevents.com and www; remove or restrict any records that point to internal/staging/admin services.
3. If you use Hosting.fr for anything beyond domain/DNS, restrict admin and sensitive services by IP or VPN.

---

## 2. Cloudflare (WAF, Rate Limiting, Bot Protection)

**What was reviewed:** No access to Cloudflare; app does not implement WAF/rate limiting at the CDN level in repo.

**Findings:**

- **Cloudflare in front of Vercel:** If the domain is proxied through Cloudflare, WAF, rate limiting, and bot protection are configured in the Cloudflare dashboard, not in this repo.
- **“I’m Under Attack”:** Cannot be verified; enable only when under active attack (can increase false positives).
- **Rate limiting / WAF:** Application-level rate limiting exists only in `server.cjs` (see Section 6). Vercel serverless routes (`api/*.js`) do **not** use it, so production on Vercel has no app-level rate limiting unless you add it in each handler or via Cloudflare.

**Recommended actions (no code change):**

1. In Cloudflare: enable **WAF** (OWASP or custom rules) and **Bot Fight Mode** (or equivalent).
2. Add **rate limiting** in Cloudflare for:
   - `/api/admin-login` (e.g. 5–10 requests per 15 min per IP).
   - `/api/scanner-login`, `/api/ambassador-login`.
   - `/api/orders/create`, `/api/aio-events/save-submission`, form submissions.
3. Create **firewall rules** to block known bad IPs/countries if needed; consider challenge for suspicious traffic.
4. Optionally enable **“I’m Under Attack”** only during incidents; monitor for false positives.

---

## 3. Vercel Security Configuration

**What was reviewed:** `vercel.json`, headers, rewrites, and API routing.

### 3.1 Security Headers (Current)

| Header | Status | Notes |
|--------|--------|--------|
| **X-Frame-Options** | ✅ | `DENY` |
| **X-Content-Type-Options** | ✅ | `nosniff` |
| **Referrer-Policy** | ✅ | `strict-origin-when-cross-origin` |
| **Permissions-Policy** | ✅ | `geolocation=(), microphone=(), camera=(self), payment=()` |
| **Cross-Origin-Opener-Policy** | ✅ | `same-origin` |
| **Cross-Origin-Resource-Policy** | ✅ | `same-site` |
| **Strict-Transport-Security (HSTS)** | ✅ | `max-age=63072000; includeSubDomains` |
| **Content-Security-Policy** | ⚠️ | **Report-Only** (see below) |

### 3.2 Content-Security-Policy (CSP)

- **Current:** `Content-Security-Policy-Report-Only` is set in `vercel.json` with `report-uri /api/csp-report`.
- **Gap:** CSP is **not enforced**. Violations are reported only; blocked content can still run.
- **CSP content:** Includes `'unsafe-inline'` and `'unsafe-eval'` for scripts, which weakens XSS protection. `connect-src` allows `*.supabase.co`, `*.flouci.com`, `*.google.com`, etc., which is reasonable for the stack.
- **report-uri:** Handled by `/api/csp-report` → `api/misc.js`; logs to console and optionally to DB if `ENABLE_CSP_LOGGING=true`.

**Recommendations:**

1. **Enforce CSP:** After validating in report-only mode (e.g. 1–2 weeks with no critical false positives), switch to `Content-Security-Policy` (remove “-Report-Only”) in `vercel.json`.
2. **Tighten script-src:** Plan to remove `'unsafe-inline'` and `'unsafe-eval'` (e.g. nonces or hashes for scripts).
3. Keep **report-uri** (or **report-to**) and monitor; consider persisting reports (e.g. `ENABLE_CSP_LOGGING`) for analysis.

### 3.3 Edge / Serverless Functions

- **No Edge Middleware** was found; all API logic is in serverless functions under `api/`.
- **Sensitive logic:** Auth and business logic live in `api/admin-login.js`, `api/verify-admin.js`, `api/misc.js`, `api/scan.js`, `api/pos.js`, `api/orders-create.js`, etc. No obvious injection or auth bypass found in the reviewed paths; JWT and cookie handling are consistent.

### 3.4 Dependencies and Build

- **Node/React/Supabase:** Versions are in `package.json`; no outdated critical CVEs were flagged in this review. You should run `npm audit` and keep dependencies updated.
- **Secrets:** API routes use `process.env.*` only; no secrets hardcoded in the repo. `.vercelignore` excludes `.env` and `.env.*.local`.

---

## 4. Supabase Database Security

**What was reviewed:** Migrations under `supabase/migrations/` and API usage of Supabase keys.

### 4.1 Row-Level Security (RLS)

- **RLS is enabled** on the tables that were checked, including:  
  `admins`, `events`, `qr_tickets`, `orders`, `order_passes`, `event_passes`, `ambassadors`, `clients`, `ambassador_events`, `ambassador_performance`, `scanners`, `scan_system_config`, `scans`, `pos_outlets`, `pos_users`, `pos_pass_stock`, `pos_audit_log`, `admin_logs`, `aio_events_submissions`, `payment_options`, `security_audit_logs`, `qr_code_access_logs`, `email_delivery_logs`, `tickets`, `phone_subscribers`, `sms_logs`, `site_logs`, `newsletter_subscribers`, `site_content`, `gallery`, `sponsors`, `ambassador_applications`, `contact_messages`, `order_expiration_settings`, `official_invitations`, and others referenced in migrations.
- **admins table:** Policy `admins_select` uses `USING (true)`, so **any client using the anon key can SELECT all rows**. This is used for login (lookup by email); authentication is enforced in the API (password + JWT). Risk: if the anon key is leaked, admin emails/identifiers could be enumerated. Mitigation: strong key hygiene and, longer term, moving admin lookup behind an authenticated or server-only path.
- **Service role:** Used only in API server code (`process.env.SUPABASE_SERVICE_ROLE_KEY`); never in `src/` or client bundles. ✅

### 4.2 Database Access Control

- **Supabase project:** Direct DB access is controlled by Supabase (dashboard + connection string). The repo does not define network/IP restrictions; those are configured in Supabase (e.g. allow only Vercel IPs or your office/VPN if supported).
- **Recommendation:** In Supabase Dashboard, restrict database access (e.g. “Restrict connections to specific IPs”) if the product supports it, and ensure only necessary IPs (e.g. Vercel, your office/VPN) can connect.

### 4.3 API Keys and Environment Variables

- **Client (browser):** Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and other `VITE_*`) are used in `src/`. No service role or other secrets are exposed to the client. ✅
- **Server (API):** Uses `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `RECAPTCHA_SECRET_KEY`, `FLOUCI_SECRET_KEY`, etc., from `process.env` only. ✅
- **env.example:** Documents required and optional variables without real values. ✅

---

## 5. Authentication, Authorization, and API Security

### 5.1 Admin Login (`/api/admin-login`)

- **Auth:** Email + password; password checked with bcrypt; JWT issued with 1h expiry; cookie `adminToken` with HttpOnly, Secure (in prod), SameSite=Lax. ✅
- **Gaps:**
  1. **No reCAPTCHA:** Request body includes `recaptchaToken` but it is **never validated**. Ambassador login in `api/misc.js` does validate reCAPTCHA when present; admin login does not.
  2. **No rate limiting on Vercel:** `server.cjs` has `authLimiter` (e.g. 5 attempts per 15 min), but Vercel runs only the serverless handlers; `server.cjs` is not used there, so **admin login has no rate limiting in production on Vercel** → brute-force risk.
- **JWT_SECRET:** Env is checked in production; fallback `fallback-secret-dev-only` must not be used in prod.

**Recommendations:**

1. Add reCAPTCHA verification to `api/admin-login.js` (same pattern as ambassador login).
2. Add rate limiting inside the admin-login handler (e.g. by IP via `x-forwarded-for` / `x-real-ip`), or enforce it at Cloudflare.
3. Ensure `JWT_SECRET` is strong and unique in all environments.

### 5.2 Ambassador and Scanner Login

- **Ambassador login** (`/api/ambassador-login` in misc.js): Validates reCAPTCHA when token is present; no rate limiting in Vercel.
- **Scanner login** (`/api/scanner-login` in scan.js): No reCAPTCHA; no rate limiting; in-memory rate limit in `api/pos.js` for POS login (resets on cold start). Same recommendation: add rate limiting (in code or Cloudflare).

### 5.3 Sensitive and Cron Endpoints

- **Admin-only routes:** Protected by `verifyAdminAuth(req)` (cookie JWT + DB check). No IP whitelisting in code.
- **Cron:** `/api/auto-reject-expired-orders` supports optional `CRON_SECRET` (header `x-cron-secret` or body/query `secret`). If `CRON_SECRET` is not set, **anyone can call this endpoint** and trigger auto-rejection.
- **Recommendation:** Always set `CRON_SECRET` in production and use it in the Vercel Cron (or external scheduler) that calls this URL.

### 5.4 CORS (`api/utils/cors.js`)

- **Production origins:** Default allowlist is `https://www.andiamoevents.com`, `https://andiamoevents.com`; overridable via `ALLOWED_ORIGINS`.
- **Requests with no Origin:** Treated as allowed (e.g. same-origin, mobile apps, curl). This is common but allows server-to-server or scripted calls without an origin; combine with rate limiting and auth for sensitive endpoints.
- **Development:** All origins allowed when not on Vercel and `NODE_ENV !== 'production'`.

No change requested for CORS logic; ensure Cloudflare or app-level rate limiting covers high-risk endpoints.

### 5.5 Flouci Payment Endpoints (Critical for Vercel-only deploy)

- **In repo:** Flouci payment logic lives in **`server.cjs`** only:  
  `/api/flouci-webhook`, `/api/flouci-generate-payment`, `/api/flouci-verify-payment`, `/api/flouci-verify-payment-by-order`.
- **Vercel:** There are **no** rewrites in `vercel.json` and **no** handlers under `api/` for these paths. So when the app is deployed **only** on Vercel (no `server.cjs` running elsewhere), requests to `/api/flouci-*` will **404** and the payment flow will not work.
- **Conclusion:** Either (1) you run `server.cjs` (or equivalent) somewhere that serves these routes, or (2) you need to implement these handlers as Vercel serverless functions (e.g. in `api/`) and add the corresponding rewrites. Until then, Flouci payment on a Vercel-only deployment is broken.

**Recommendations:**

1. If production is Vercel-only: implement Flouci handlers in `api/` (e.g. `api/flouci-webhook.js`, `api/flouci-generate-payment.js`, `api/flouci-verify-payment.js`) and add rewrites in `vercel.json`.
2. For `/api/flouci-webhook`: verify webhook authenticity (e.g. signature or shared secret like `FLOUCI_WEBHOOK_SECRET`) if Flouci supports it; do not trust payloads without verification.
3. Keep Flouci secret key only in server env; never in client.

---

## 6. Rate Limiting and IDS (Fail2Ban / Monitoring)

**What was reviewed:** `server.cjs` and `api/*.js`.

**Findings:**

- **server.cjs** defines multiple rate limiters (auth, application, recaptcha, email, verify-admin, admin-logout, scanner-login, QR code access, SMS, etc.) and uses `express-rate-limit` with IP-based windows. It also logs rate-limit violations to `security_audit_logs` where applicable.
- **Vercel:** Production uses **only** the serverless functions in `api/`. **None of the `server.cjs` rate limiters run on Vercel**, so there is **no application-level rate limiting** in the current Vercel deployment for:
  - Admin login
  - Ambassador / scanner login
  - Orders create, form submissions, etc.
- **POS login** (`api/pos.js`): In-memory rate limit (e.g. 6 attempts per 15 min per IP); state is lost on cold start, so it is weak.
- **Fail2Ban / IDS:** Not present in the repo; hosting is serverless (Vercel), so traditional Fail2Ban is not applicable. Equivalent protection should come from Cloudflare (rate limiting, WAF, bot management) and/or rate limiting inside serverless handlers.

**Recommendations:**

1. Add rate limiting in Cloudflare for login and form endpoints (see Section 2).
2. Optionally add per-handler rate limiting inside Vercel functions (e.g. using a serverless-friendly store or Vercel’s own features if available).
3. Keep (or add) logging of failed logins and rate-limit events to `security_audit_logs` and, if needed, to an external SIEM or logging service for alerting.

---

## 7. Scanning (Nmap / Open Ports / Sensitive Services)

**What was reviewed:** Repo only; no live scanning was performed.

**Findings:**

- **Vercel:** Serves HTTPS (and typically HTTP→HTTPS). Open ports are managed by Vercel; the repo does not define them.
- **Sensitive URLs:** Admin and scanner dashboards are protected by cookie JWT; there is no IP whitelisting in code. Exposed paths include `/api/admin/*`, `/api/scanner/*`, `/api/pos/*`, `/api/scan-system-status` (public), etc.

**Recommended actions (no code change):**

1. Run an external Nmap (or similar) scan against andiamoevents.com (and www) to confirm only 80/443 are open and that no unexpected services are exposed.
2. Run OWASP ZAP or Burp Suite (or another scanner) against the main app and API to find vulnerabilities (e.g. OWASP Top 10).
3. Consider IP whitelisting or VPN for the most sensitive admin/scanner endpoints if your threat model requires it (would need to be implemented in code or at Cloudflare).

---

## 8. Traffic Monitoring and Anomaly Detection

**What was reviewed:** Repo only; no access to Vercel or Cloudflare analytics.

**Findings:**

- **Vercel Analytics / Speed Insights:** Referenced in the app (`@vercel/analytics`, `@vercel/speed-insights`); usage is configured in the frontend. Dashboards are in Vercel/Cloudflare, not in the repo.
- **Logging:** API code logs errors and some security events (e.g. CSP reports, optional CSP DB logging, rate-limit violations in server.cjs). There is no centralized anomaly-detection logic in the repo.
- **Env:** `SECURITY_ALERT_EMAIL` and `ENABLE_SECURITY_LOGGING` are optional in `env.example`; useful for alerting and audit trails.

**Recommendations:**

1. In Vercel and Cloudflare, enable analytics and set up alerts for unusual traffic (e.g. spikes, many 4xx/5xx, high request rate to login/order endpoints).
2. Use Supabase (and optional external logging) for security-related events (failed logins, rate limits, CSP reports) and define simple alerts (e.g. threshold of failures per IP or per minute).
3. Consider a dedicated security/monitoring service (e.g. Sentry, LogRocket, or a SIEM) for critical paths (auth, payments, admin).

---

## 9. IP Whitelisting and VPN for Admin / APIs

**What was reviewed:** All admin and scanner API handlers.

**Findings:**

- **No IP whitelisting** is implemented in the codebase. Admin and scanner access rely on cookie JWT only.
- **No VPN requirement** is enforced in code; that would be a policy and/or infrastructure choice (e.g. Cloudflare Access, corporate VPN, or custom middleware checking IP against a list).

**Recommendations:**

1. If you need stricter access: add middleware (or Cloudflare rules) that allow only certain IPs for `/api/admin/*` and/or `/api/scanner/*`, and document VPN usage for admins.
2. For cron: ensure only the scheduler (or a known IP) can call `/api/auto-reject-expired-orders` by using `CRON_SECRET` and, if possible, IP allowlisting at Cloudflare or Vercel.

---

## 10. SSL/TLS and Additional Security Measures

**What was reviewed:** Headers, env, and CORS/CSP.

**Findings:**

- **HSTS:** Enabled in `vercel.json` with long max-age and includeSubDomains. ✅
- **TLS:** Provided by Vercel (and Cloudflare if proxied). Certificate management is not in the repo; use Vercel/Cloudflare defaults or a trusted CA (e.g. Let’s Encrypt) as per your DNS/hosting setup.
- **CORS:** Restrictive in production (allowlist of domains); see Section 5.4.
- **CSP:** Report-only; see Section 3.2.

**Recommendations:**

1. Ensure TLS 1.2+ and strong ciphers in Vercel/Cloudflare (usually default).
2. Enforce CSP and tighten script-src when feasible (Section 3.2).
3. Keep dependencies and Node/Runtime versions updated; run `npm audit` and fix high/critical issues.

---

## 11. Two-Factor Authentication (2FA)

**What was reviewed:** Auth flows and UI components.

**Findings:**

- **No 2FA/MFA** is implemented for admin, ambassador, or scanner login. The `input-otp` component in the repo is a generic UI component, not used for 2FA.
- **Risk:** Stolen or guessed passwords alone grant full access for that role.

**Recommendation:**

- Plan to add 2FA (TOTP or similar) for at least admin (and optionally scanner) accounts; store 2FA secrets securely (e.g. in Supabase or a dedicated auth service) and enforce at login.

---

## 12. Test and Diagnostic Endpoints

**What was reviewed:** `server.cjs`, `api/`, and `vercel.json`.

**Findings:**

- **server.cjs** exposes: `/api/test`, `/api/test-supabase`, `/api/sms-test`. These are **not** implemented in `api/` and are **not** in `vercel.json` rewrites, so they **do not exist on Vercel** (they would 404). They exist only when running `server.cjs` locally.
- **Recommendation:** Ensure these (or equivalent) are never deployed on a public URL in production; if you add similar routes in `api/`, restrict them (e.g. by env or IP) and do not expose them in production.

---

## Prioritized Recommendations

### P0 – Critical (fix soon)

1. **Flouci on Vercel:** If production is Vercel-only, add Flouci handlers and rewrites so payment works and webhook is secured (Section 5.5).
2. **Admin login:** Add reCAPTCHA and rate limiting (in handler or Cloudflare) (Section 5.1).
3. **Cron secret:** Set and use `CRON_SECRET` for `/api/auto-reject-expired-orders` (Section 5.3).

### P1 – High

4. **CSP:** Move from report-only to enforced CSP after validation; then tighten script-src (Section 3.2).
5. **Cloudflare:** Enable WAF, rate limiting, and bot protection for login and form endpoints (Section 2).
6. **Webhook verification:** Verify Flouci webhook payloads (signature or secret) if supported (Section 5.5).

### P2 – Medium

7. **2FA:** Implement for admin (and optionally scanner) (Section 11).
8. **Supabase:** Restrict DB access by IP if supported (Section 4.2).
9. **Hosting.fr:** Verify firewall and DNS (Section 1).
10. **Monitoring:** Alerts on failed logins, rate limits, and traffic anomalies (Section 8).

### P3 – Lower

11. **Admins RLS:** Consider reducing anon-key SELECT on `admins` (e.g. move login lookup behind a server-only or authenticated path) (Section 4.1).
12. **IP whitelisting / VPN:** For admin/scanner if required by policy (Section 9).
13. **Regular:** Dependency updates, `npm audit`, and periodic ZAP/Burp scans (Sections 3.4, 7).

---

## Immediate Actions (No Code Changes)

These can be done in dashboards and config only:

1. **Cloudflare:** Turn on WAF, rate limiting for `/api/admin-login`, `/api/orders/create`, and other sensitive paths; enable bot protection.
2. **Vercel:** Confirm env vars (e.g. `JWT_SECRET`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, Flouci keys) are set for production and not using dev defaults.
3. **Supabase:** Check RLS is enabled on all tables; restrict DB access by IP if available.
4. **Hosting.fr:** Verify only 80/443 open and DNS does not expose internal services.
5. **Cron:** If you use Vercel Cron (or similar) for auto-reject-expired-orders, set `CRON_SECRET` and pass it in the request.
6. **Monitoring:** Configure alerts in Vercel/Cloudflare (and optionally Supabase/logging) for errors and unusual traffic.

---

## Additional Tools and Measures

- **Vulnerability scanning:** Run OWASP ZAP or Burp Suite regularly against staging/production; fix findings.
- **Dependency scanning:** Use `npm audit` and Dependabot (or similar) for automated updates and CVE alerts.
- **CSP:** Use report-only phase to tune policy, then enforce; consider a CSP reporting service for analysis.
- **Secrets:** Rotate `JWT_SECRET`, Supabase keys, and Flouci keys periodically; use different values per environment.
- **Backups:** Ensure Supabase backups and retention meet your RTO/RPO; test restore.
- **Incident response:** Document how to revoke admin/scanner sessions, rotate keys, and disable compromised accounts.

---

## Summary Table

| Area | Status | Notes |
|------|--------|--------|
| Security headers (Vercel) | ✅ | HSTS, X-Frame-Options, etc. |
| CSP | ⚠️ | Report-only; not enforced |
| CORS | ✅ | Allowlist in production |
| Admin auth | ⚠️ | No reCAPTCHA; no rate limit on Vercel |
| Ambassador/Scanner auth | ⚠️ | Ambassador has reCAPTCHA; no rate limit on Vercel |
| RLS (Supabase) | ✅ | Enabled on reviewed tables |
| Secrets (client vs server) | ✅ | Service role/secret key only server-side |
| Rate limiting (Vercel) | ❌ | Only in server.cjs; not used on Vercel |
| Flouci on Vercel | ❌ | Handlers only in server.cjs; 404 on Vercel |
| Cron secret | ⚠️ | Optional; should be required in prod |
| 2FA | ❌ | Not implemented |
| IP whitelisting | ❌ | Not in code |
| Hosting.fr / Cloudflare | — | Not verifiable from repo; manual check |

---

*End of report. No modifications were made to the codebase or infrastructure; this document is for analysis and planning only.*
