# Frontend Public Assets Audit — Follow-up Implementation

**Date:** 2026-06-28  
**Parent audit:** `security/frontend-public-assets-audit-2026-06-28.md`  
**Mode:** Targeted fixes only — no deploy, no commit, no CSP tightening

---

## Final verdict: **PASS**

All four approved follow-up items are implemented. Production `dist/` no longer contains the hardcoded Excel password, `SUPABASE_SERVICE_ROLE_KEY` toast copy, or diagnostic `/api/test*` path strings. Live `payment_options` RLS behavior matches the tightened migration intent.

**Remaining notes (out of scope / informational):** CSP `unsafe-inline` / `unsafe-eval` unchanged per instructions; optional `VITE_REPORTS_EXCEL_LOCK_PASSWORD` may be set in Vercel if casual sheet locking is desired (not a security boundary).

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/analytics/reportsExcelExport.ts` | Removed default password; optional env-only sheet protection |
| `src/components/admin/marketing/EmailCampaignEditor.tsx` | Generic admin toast copy (no env/migration names) |
| `src/lib/api-routes.ts` | Removed diagnostic routes from `API_ROUTES`; added dev-only `DEV_ONLY_API_ROUTES` |

---

## Exact fixes made

### 1. Excel sheet unlock password (`reportsExcelExport.ts`)

- Removed hardcoded default `AndiamoEventsReports`.
- `getWorkbookLockPassword()` now returns `string | null`; protection runs only when `VITE_REPORTS_EXCEL_LOCK_PASSWORD` is set at build time.
- Added comment: client-side Excel protection is **not** a security boundary.

### 2. Admin toast copy (`EmailCampaignEditor.tsx`)

Replaced operator-facing strings that named `SUPABASE_SERVICE_ROLE_KEY` and migration `20260421120000…` with:

- **EN:** “Institutional layout was not saved. Email campaign backend configuration is incomplete. Contact your administrator.”
- **FR:** “La mise en page institutionnelle n’a pas été enregistrée. La configuration du service e-mail est incomplète. Contactez votre administrateur.”

### 3. Diagnostic API constants (`api-routes.ts`)

- Removed `TEST`, `TEST_SUPABASE`, `SMS_TEST` from `API_ROUTES` (they were not imported elsewhere).
- Added `DEV_ONLY_API_ROUTES` gated with `import.meta.env.DEV` so production bundles tree-shake test paths.
- Local `server.cjs` diagnostics (`GET /api/test`, etc.) remain available in dev via literal URLs or `DEV_ONLY_API_ROUTES`.

### 4. `payment_options` production RLS

- Ran `npm run security:rls` against the linked Supabase project.
- Result: **`OK  payment_options: anon cannot read disabled rows`**
- Migration `20260628180000_tighten_payment_options_rls.sql` behavior is **confirmed live** (anon blocked on `enabled = false`; enabled-only checkout path intact).

---

## Commands run

```powershell
cd c:\Users\ASUS\Andiamo-Events
npm run build
npm run security:rls
npm run test:admin-api-authz-coverage
npm run security:admin-auth
npm run security:public-routes
node scripts/validate-csp-config.cjs
node scripts/verify-security-headers.js https://www.andiamoevents.com

rg -n "AndiamoEventsReports|SUPABASE_SERVICE_ROLE_KEY|/api/test|/api/test-supabase|/api/sms-test" dist src --glob "*.js" --glob "*.ts" --glob "*.tsx"
rg -n "service_role|SUPABASE_SERVICE_ROLE|sb_secret|JWT_SECRET|STRIPE_SECRET|STRIPE_WEBHOOK|RESEND_API_KEY|DATABASE_URL|CRON_SECRET|ADMIN_SECRET|PRIVATE_KEY|SECRET_KEY" dist public src api server.cjs vercel.json vite.config.ts
Get-ChildItem -Path dist,public -Recurse -Filter "*.map"
```

---

## Verification results

| Command | Result |
|---------|--------|
| `npm run build` | **PASS** |
| `npm run security:rls` | **PASS** — includes `payment_options: anon cannot read disabled rows` |
| `npm run test:admin-api-authz-coverage` | **PASS** — 36/36 |
| `npm run security:admin-auth` | **PASS** |
| `npm run security:public-routes` | **PASS** |
| `node scripts/validate-csp-config.cjs` | **PASS** |
| `node scripts/verify-security-headers.js` | **PASS** (CSP hardening warnings only) |
| `dist/**/*.map` | **0 files** |

---

## Before / after grep evidence

### Targeted audit strings

| Pattern | Before (`dist/`) | After (`dist/`) |
|---------|------------------|-----------------|
| `AndiamoEventsReports` | `dist/assets/CQjgB3nR.js` (1 hit) | **0 hits** |
| `SUPABASE_SERVICE_ROLE_KEY` | `dist/assets/B6GTmWag.js` (toast copy) | **0 hits** |
| `/api/test` | `dist/assets/C5EZhTeu.js` | **0 hits** |
| `/api/test-supabase` | `dist/assets/C5EZhTeu.js` | **0 hits** |
| `/api/sms-test` | `dist/assets/C5EZhTeu.js` | **0 hits** |

### Source-only (expected, not shipped)

| Pattern | `src/` only |
|---------|-------------|
| `/api/test*` | `src/lib/api-routes.ts` inside `DEV_ONLY_API_ROUTES` (`import.meta.env.DEV` branch) |
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/userErrors/mapPublicError.test.ts` (unit test fixture) |

### Broader secrets scan

- **`dist/`:** no matches for service role keys, JWT/Stripe/Resend/DB/cron secrets.
- **`api/` / `server.cjs`:** server-side env references only (unchanged, expected).

---

## RLS verification detail

From `npm run security:rls` (2026-06-28):

```
--- Anon payment_options (enabled only) ---
OK  payment_options: anon cannot read disabled rows
```

This confirms production policy behavior aligned with `payment_options_anon_select_enabled` (`USING (enabled = true)`). No migration apply was required — live DB already enforces the policy.

---

## Remaining notes

| Item | Status |
|------|--------|
| CSP `unsafe-inline` / `unsafe-eval` | Unchanged (explicitly out of scope); see `security/csp-tightening-plan-2026-06-28.md` |
| `VITE_REPORTS_EXCEL_LOCK_PASSWORD` | Optional; if unset, exports ship without sheet password (preferred secure default) |
| API path enumeration in admin bundle | Informational; server authZ unchanged and passing static tests |

---

## Safe to deploy (post-review)

- [x] No hardcoded Excel password in production bundle
- [x] No `SUPABASE_SERVICE_ROLE_KEY` in production bundle
- [x] No `/api/test*` strings in production bundle
- [x] `payment_options` RLS verified on linked production Supabase
- [x] Security regression scripts pass
- [ ] Awaiting human review of diff + report before commit/deploy

---

*No git commit or deployment performed.*
