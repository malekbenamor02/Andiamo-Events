# Frontend / Public Assets Security Audit

**Date:** 2026-06-28  
**Scope:** Production browser-delivered assets, env exposure, Supabase keys, admin/API boundaries, source maps, static files, security headers, build/deploy config  
**Mode:** Read-only — no code changes, commits, deploys, or key rotation  
**Repository:** `Andiamo-Events`

---

## Executive verdict: **PASS_WITH_NOTES**

No confirmed leak of server secrets, service-role keys, JWT secrets, webhook secrets, or production source maps in browser-delivered assets. Supabase exposure is limited to the **public anon key** and project URL (expected). Admin/private API paths are discoverable in minified bundles (normal for SPAs) and are backed by server-side authZ per static tests.

**Notes (non-blocking):** hardcoded default Excel sheet-unlock password in a client bundle; operator toast copy referencing `SUPABASE_SERVICE_ROLE_KEY` by name; diagnostic API path constants present in bundle though not routed on Vercel; CSP still allows `unsafe-inline` / `unsafe-eval` (documented hardening backlog).

---

## What is normal and expected

| Exposure | Why it is acceptable |
|----------|----------------------|
| `/assets/*.js`, `/assets/*.css`, hashed chunks (`C5EZhTeu.js`, etc.) | Standard Vite production output; required for the SPA to run |
| `/_vercel/*` (analytics, speed insights) | Vercel platform scripts |
| Supabase project URL + **anon** JWT in JS | Supabase browser client design; RLS must enforce data access |
| reCAPTCHA **site** key (`6LeE…`) | Public client key; secret stays server-side |
| Google Analytics ID (`G-ST4MWP7HDE`) | Public measurement ID |
| `/api/*` path strings in bundles | Attack surface **discovery** only; security must be server-side |
| `index.html` 200 for unknown paths (`/server.cjs`, `/security/*.md`) | SPA fallback rewrite — returns HTML shell, **not** repo files |
| No `*.map` in `dist` / 404 on production `*.js.map` | Source maps not publicly deployed (local build without Sentry upload) |

---

## Files and directories inspected

| Path | Role |
|------|------|
| `dist/` | Fresh `npm run build` output (primary audit target) |
| `public/` | Static assets copied into `dist` |
| `.vercel/output/static` | **Not present locally** — Vercel build artifact unavailable in workspace |
| `vite.config.ts` | Source map / chunk naming / Sentry upload policy |
| `vercel.json` | Headers, rewrites, API routing, SPA fallback |
| `lib/csp-policy.cjs` | Canonical CSP string |
| `server.cjs` | Local/dev server headers and diagnostic routes (not in `dist`) |
| `src/integrations/supabase/client.ts` | Browser Supabase client |
| `src/lib/api-routes.ts` | Centralized API path constants |
| `src/components/auth/Protected*.tsx` | Frontend route guards |
| `src/App.tsx` | Route map (admin, ambassador, scanner, POS, influencer) |
| `api/` | Server-side auth patterns (grep + static tests) |
| `scripts/verify-security-headers.js` | Live header verification |
| `scripts/validate-csp-config.cjs` | CSP parity validation |
| `scripts/security/check-admin-service-role-auth.mjs` | Admin service-role ordering scan |
| `scripts/security/check-public-service-role-routes.mjs` | Public route `select(*)` scan |
| `api/_lib/admin-api-authz-coverage.test.cjs` | Admin API authZ static coverage |

---

## Commands run

```powershell
cd c:\Users\ASUS\Andiamo-Events
npm run build

# Source maps
Get-ChildItem -Path dist,public,.vercel -Recurse -Filter "*.map" -ErrorAction SilentlyContinue

# Secret / env patterns (ripgrep)
rg -n "service_role|SUPABASE_SERVICE_ROLE|sb_secret|JWT_SECRET|STRIPE_SECRET|STRIPE_WEBHOOK|RESEND_API_KEY|DATABASE_URL|CRON_SECRET|ADMIN_SECRET|PRIVATE_KEY|SECRET_KEY" dist public src api server.cjs vercel.json vite.config.ts

rg -n "VITE_|import\.meta\.env|process\.env" src api server.cjs vite.config.ts vercel.json

rg -o "/api/[a-zA-Z0-9_./?=-]+" dist --glob "*.js" | Sort-Object -Unique

# Bundle-specific probes
rg -o "eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+" dist/assets/C5EZhTeu.js   # JWT decode → role: anon
rg -o ".{0,80}service_role.{0,80}" dist --glob "*.js"
rg -c "sourceMappingURL" dist
rg -c "AndiamoEventsReports" dist

# Security automation
npm run test:admin-api-authz-coverage
node scripts/validate-csp-config.cjs
npm run security:admin-auth
npm run security:public-routes
node scripts/verify-security-headers.js https://www.andiamoevents.com

# Production probes (read-only)
node -e "/* HEAD/GET probes for .map, /api/test, /server.cjs, /security/*.md, asset headers */"
```

**Build result:** succeeded (`dist/` populated, academy prerender HTML written).  
**`.vercel/output/static`:** not generated in this workspace (UNVERIFIED vs remote Vercel build tree; `dist/` is the configured Vite `outDir` and matches production chunk naming seen live).

---

## Findings table

| Severity | File / path | Evidence | Risk | Recommended fix |
|----------|-------------|----------|------|-----------------|
| **LOW** | `dist/assets/CQjgB3nR.js` (from `src/lib/analytics/reportsExcelExport.ts`) | Default workbook lock password `AndiamoEventsReports` inlined when `VITE_REPORTS_EXCEL_LOCK_PASSWORD` unset | Anyone can unprotect admin Excel export sheets in browser; not a server secret but weak client-side “protection” | Set a strong `VITE_REPORTS_EXCEL_LOCK_PASSWORD` in Vercel **or** move sheet protection to server-generated files only; avoid shipping default password in source |
| **LOW** | `dist/assets/B6GTmWag.js` (from `EmailCampaignEditor.tsx`) | Toast strings mention `SUPABASE_SERVICE_ROLE_KEY` and migration IDs | Informational ops leakage; no key value present | Rephrase user-facing errors without env var names |
| **INFO** | `dist/assets/C5EZhTeu.js` | ~150+ `/api/admin/*`, `/api/scanner/*`, cron paths as string literals | API enumeration aids targeted probing | Acceptable if server authZ holds (verified statically); optional: split admin bundle further (already lazy-loaded) |
| **INFO** | `dist/assets/C5EZhTeu.js` | `/api/test`, `/api/test-supabase`, `/api/sms-test` in `API_ROUTES` | Discovery of dev-only diagnostics | Remove from `API_ROUTES` or guard with `import.meta.env.DEV`; endpoints **404 on Vercel production** (verified) |
| **INFO** | `dist/assets/C5EZhTeu.js` | Embedded JWT payload `{"role":"anon","ref":"ykeryyraxmtjunnotoep"}` + `https://ykeryyraxmtjunnotoep.supabase.co` | Expected public Supabase browser credentials | Ensure RLS remains strict; never ship service role to client |
| **INFO** | `dist/assets/C5EZhTeu.js`, multiple chunks | reCAPTCHA site key `6LeEYhgsAAAAAEX8CtfuwSlpDnhGWyaFjgln40fc` | Public by design | None |
| **INFO** | `vercel.json` + live CSP | `script-src` includes `'unsafe-inline'` and `'unsafe-eval'` | Weakens XSS containment | Follow `security/csp-tightening-plan-2026-06-28.md` when dependency audit allows |
| **INFO** | `src/pages/admin/Dashboard.tsx` et al. | Direct `supabase` client reads/writes from admin UI | UI hiding ≠ security; relies on RLS + admin API for privileged ops | Keep privileged mutations on `/api/admin/*`; periodic RLS regression (`npm run security:rls`) |
| **PASS** | `vite.config.ts` | `sourcemap: false` unless Sentry prod upload; hash-only filenames in production | Prevents `.map` deploy and module path leakage | Keep current policy |
| **PASS** | Production `HEAD` `…/assets/C5EZhTeu.js.map` | HTTP **404** | No public source maps | No change required |
| **PASS** | Production `GET /server.cjs`, `/security/*.md` | HTTP 200 but `content-type: text/html` (SPA `index.html`) | False-positive path probe; files **not** exposed | No change required |
| **UNVERIFIED** | `supabase/migrations/20260628180000_tighten_payment_options_rls.sql` | Migration tightens `payment_options` to `enabled = true` for anon SELECT | If not applied in prod, disabled payment rows might be readable via anon client | Confirm migration applied on production DB (`npm run security:rls` or Supabase dashboard) |

---

## Secrets exposure result

| Check | Result |
|-------|--------|
| Service role key in `dist/` | **NOT FOUND** (only env-var **name** in admin toast copy) |
| JWT secret / Stripe / Resend / cron / DB URL / MCP creds in `dist/` | **NOT FOUND** |
| `service_role` string in bundles | Present only in **public error-code mapping** and **log-sanitization regexes** — not credentials |
| `localhost:8082` / `VITE_API_TARGET` in `dist/` | **NOT FOUND** |
| Supabase JWT in bundle | **Present** — decoded payload role = **`anon`** (expected) |
| Sentry DSN in local `dist/` build | **NOT FOUND** (likely unset at build time) |

**Conclusion:** No proven secret leak in frontend bundles from this audit.

---

## Source map result

| Item | Result |
|------|--------|
| `vite.config.ts` production `build.sourcemap` | `false` unless `VERCEL_ENV=production` + Sentry auth env → then `"hidden"` with post-upload delete |
| `dist/**/*.map` after local prod build | **0 files** |
| `sourceMappingURL` in `dist` JS | **0 matches** |
| Live `https://www.andiamoevents.com/assets/C5EZhTeu.js.map` | **404** |

**Conclusion:** Production source maps are **not publicly exposed** under current config.

---

## Supabase anon / service role result

| Check | Result |
|-------|--------|
| Frontend `createClient` | Only in `src/integrations/supabase/client.ts` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` |
| Service-role `createClient` in `src/` | **None** |
| Service role usage | Confined to `api/`, `server.cjs` (grep confirmed) |
| `npm run security:admin-auth` | **PASS** — no forbidden admin DB patterns before auth in `api/` |
| Browser JWT role | **`anon`** (decoded from `dist/assets/C5EZhTeu.js`) |

**Conclusion:** Supabase key exposure matches intended public-browser model.

---

## Admin / API authorization result

### Frontend routes (UI guards — not security boundaries)

| Area | Path prefix | Guard |
|------|-------------|-------|
| Admin | `/admin`, `/admin/change-password` | `ProtectedAdminRoute` → `GET /api/verify-admin` + cookie |
| Ambassador | `/ambassador/dashboard` | `ProtectedAmbassadorRoute` → `GET /api/ambassador/me` |
| Influencer | `/influencer/dashboard` | `ProtectedInfluencerRoute` → `GET /api/academy-influencer/session` |
| Scanner | `/scanner/*` (except login) | `ProtectedScannerRoute` → `GET /api/scanner/session` |
| POS | `/pos/:outletSlug/*` | Per-page `GET /api/pos/:slug/verify` |

### Server-side verification (repository evidence)

| Test / script | Result |
|---------------|--------|
| `npm run test:admin-api-authz-coverage` | **36/36 PASS** — permission gates before `createAdminDbClient`; cron routes use `authorizeCronOrAdminPermission` |
| `npm run security:public-routes` | **PASS** — no `select('*')` on sensitive tables in scanned public routes |
| Direct API bypass | Intended model: cookies/JWT + DB-backed permissions on non-public routes; frontend hiding irrelevant |

### API path classification (bundle discovery — sample)

| Class | Examples in `dist` | Server protection (repo) |
|-------|-------------------|---------------------------|
| **public-safe** | `/api/events/by-slug/`, `/api/passes/`, `/api/presale/required`, `/api/careers/domains` | Public handlers + RLS |
| **authenticated user** | `/api/clictopay-*`, `/api/orders/create` | Order/payment handlers |
| **ambassador** | `/api/ambassador/*`, `/api/ambassador-login` | `ambassador-auth.cjs` session/JWT |
| **scanner** | `/api/scanner/*`, `/api/scanner-login` | `scan.js` + scanner JWT |
| **POS** | `/api/pos/` | `pos.js` outlet session |
| **influencer** | `/api/academy-influencer/*` | Academy influencer session |
| **admin** | `/api/admin/*`, `/api/admin-*` | `verifyAdminAuth` + `gateAdminPermission` |
| **cron / internal** | `/api/auto-reject-expired-orders`, `/api/marketing/cron/email-campaigns` | Cron secret or admin permission (static tests) |
| **dev / diagnostic** | `/api/test`, `/api/test-supabase`, `/api/sms-test` | In `server.cjs` only; **404 on Vercel production** |

Full unique path count extracted from `dist` JS: **233** string occurrences (includes placeholder image paths).

---

## Static / public folder result

| Check | Result |
|-------|--------|
| `public/` contents | SVG/PNG assets, `robots.txt`, `sitemap.xml`, `manifest.json`, `.well-known/security.txt`, `sounds/README.md` — **no** `.env`, `.sql`, `.zip`, audit packs |
| `dist/` after build | Browser assets + prerendered academy HTML — **no** `server.cjs`, `api/`, `security/*.md`, migrations |
| `dist/sounds/README.md` | Harmless developer note (313 bytes) |
| Repo `security/*.md` | **Not** in `dist/`; production URL returns SPA HTML only |
| Accidental deploy of audit zips | **Not found** in `public/` or `dist/` |

---

## Security headers result

| Header | `vercel.json` | Live `https://www.andiamoevents.com` | Live `/assets/C5EZhTeu.js` |
|--------|---------------|----------------------------------------|----------------------------|
| Content-Security-Policy | Present, matches `lib/csp-policy.cjs` | Valid | Present (same policy) |
| Content-Security-Policy-Report-Only | Identical to enforcing | Valid | Present |
| X-Content-Type-Options | `nosniff` | OK | `nosniff` |
| X-Frame-Options | `DENY` | OK | `DENY` |
| Referrer-Policy | `strict-origin-when-cross-origin` | OK | OK |
| Permissions-Policy | Restrictive | OK | OK |
| HSTS | preload | OK | OK |
| Static asset weakening | Image/svg rule sets `Cross-Origin-Resource-Policy: cross-origin` only for image extensions | N/A | JS keeps `same-site` CORP |

`node scripts/validate-csp-config.cjs` → **PASS**  
`node scripts/verify-security-headers.js https://www.andiamoevents.com` → **All required headers valid** (CSP hardening warnings only).

---

## Build / deploy config result

| Item | Finding |
|------|---------|
| Vite `outDir` | `dist/` — standard static output |
| Chunk naming | Production uses `[hash].js` only (reduces path leakage) |
| `esbuild.drop` | Removes `console` / `debugger` in production |
| `vercel.json` rewrite | `/((?!api)(?!assets).*)` → `index.html` — API and assets excluded from SPA fallback |
| Sensitive path probes | `/server.cjs`, `/security/*.md` serve SPA shell, not source files |
| Server files in static output | **None** in `dist/` |
| Sentry sourcemaps | Upload only on Vercel production with tokens; maps deleted after upload when enabled |

---

## Required fixes (approval needed before implementation)

None are **CRITICAL** or blocking deploy based on this audit. Recommended follow-ups:

1. **LOW:** Remove or replace default Excel lock password `AndiamoEventsReports` in client bundle (`reportsExcelExport.ts`).
2. **LOW:** Sanitize admin toast copy in `EmailCampaignEditor.tsx` to avoid naming `SUPABASE_SERVICE_ROLE_KEY`.
3. **INFO:** Remove dev diagnostic constants (`TEST`, `TEST_SUPABASE`, `SMS_TEST`) from shipped `API_ROUTES` or dev-gate them.
4. **INFO:** Continue CSP tightening per `security/csp-tightening-plan-2026-06-28.md`.
5. **UNVERIFIED:** Confirm `20260628180000_tighten_payment_options_rls.sql` applied in production.

---

## Safe-to-deploy checklist

- [x] Production build completes; `dist/assets/*` contains only expected browser assets
- [x] No `*.map` files in local production `dist/`
- [x] Production `*.js.map` URLs return 404
- [x] No service-role / server secrets in `dist/` grep scans
- [x] Supabase browser JWT is **anon** role only
- [x] Admin API authZ static tests pass (36/36)
- [x] CSP valid and consistent between enforcing and report-only
- [x] Live site security headers verified
- [x] `security/` docs and `server.cjs` not served as static files (SPA fallback only)
- [ ] Optional: set `VITE_REPORTS_EXCEL_LOCK_PASSWORD` if Excel export protection matters
- [ ] Optional: confirm payment_options RLS migration applied in production DB

---

## UNVERIFIED items (what is needed)

| Item | Why unverified | How to verify |
|------|----------------|---------------|
| Remote Vercel build output tree | `.vercel/output/static` not present locally | Compare Vercel deployment file list or CI artifact to `dist/` |
| `VITE_*` values at Vercel production build | Local build uses workspace env; some vars may be empty | Inspect Vercel project env (no secrets in report) and rebuild preview |
| `payment_options` RLS on production | Migration file exists; apply status not checked live | `npm run security:rls` against production or Supabase SQL policy inspect |
| Live unauthenticated admin API probe | `ADMIN_AUTH_PROBE_BASE_URL` not set for HTTP 401 sweep | Set env and run `npm run security:admin-auth` probe |
| Sentry hidden maps on Vercel production deploy | Only when `VERCEL_ENV=production` + Sentry tokens | Confirm maps deleted post-upload in Vercel build logs |

---

*End of read-only audit. No repository files were modified except creation of this report.*
