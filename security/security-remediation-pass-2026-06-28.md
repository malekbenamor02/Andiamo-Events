# Security Remediation Pass — Andiamo Events — 2026-06-28

## 1. Executive Summary

This pass addresses confirmed findings from `security/full-active-offensive-security-test-2026-06-28.md` with minimal, reviewable changes. **No production deploy or push was performed.**

**Fixed:** token logging (SEC-006), admin payment options read path + RLS migration applied (SEC-002), legacy local validate-ticket removal (SEC-004), CMS HTML sanitization including EmailCampaignPreview (SEC-011), scanner/influencer route guards (SEC-007/013), ticket QR phase-1 headers (SEC-001 partial), admin-auth scanner false positives (SEC-008), CSP review warnings (SEC-003 partial).

**Intentionally deferred:** signed QR URLs phase 2, CSP unsafe-inline/eval removal, CSRF tokens, JWT key separation, Supabase Auth dashboard toggles (checklist only), staging live role matrix.

**Production deployment allowed:** **Yes** — migration applied and full release gate passed.

---

## 2. Findings Addressed

| Finding ID | Severity | Before | After | Files changed | Tests added |
|------------|----------|--------|-------|---------------|-------------|
| SEC-20260628-006 | Medium | secure_token in logs | Safe ticket id / hasSecureToken only | admin-approve-order.js, misc.js, server.cjs, safe-ticket-log.cjs | no-sensitive-token-logs.test.cjs |
| SEC-20260628-002 | High | Admin reads via anon Supabase | Admin API + narrowed RLS **applied** | paymentService.ts, migration SQL | security-remediation-2026-06-28.test.cjs, check-supabase-rls.mjs |
| SEC-20260628-004 | Medium | Unauth local validate-ticket | Route removed | server.cjs, api-routes.ts | security-remediation-2026-06-28.test.cjs |
| SEC-20260628-011 | Medium | Raw CMS HTML | DOMPurify + fallback | Careers.tsx, EmailCampaignPreview.tsx, sanitizeHtml.ts | sanitizeHtml.test.ts |
| SEC-20260628-007 | Medium | Scanner UI unguarded | ProtectedScannerRoute | ScannerApp.tsx, ProtectedScannerRoute.tsx | security-remediation-2026-06-28.test.cjs |
| SEC-20260628-013 | Low | Influencer guard in component only | Router-level wrapper | App.tsx, Dashboard.tsx | security-remediation-2026-06-28.test.cjs |
| SEC-20260628-001 | High | QR cache/referrer | no-store, no-referrer | ticket-qr-route.cjs | security-remediation-2026-06-28.test.cjs |
| SEC-20260628-003 | High | CSP unsafe (unchanged) | Warnings in verify script | verify-security-headers.js | csp-tightening-plan doc |
| SEC-20260628-008 | Medium | 20 scanner false positives | 0 findings | check-admin-service-role-auth.mjs | admin-auth-scanner-triage doc |
| SEC-20260628-009 | Medium | Auth dashboard gaps | Manual checklist | — | supabase-auth-dashboard-hardening-checklist |

---

## 3. Files Changed

| File | Why |
|------|-----|
| `api/_lib/safe-ticket-log.cjs` | Central safe QR registry logging |
| `api/_lib/no-sensitive-token-logs.test.cjs` | Regression: no token logging |
| `api/_lib/security-remediation-2026-06-28.test.cjs` | Static security regression suite (+ EmailCampaignPreview) |
| `api/_lib/ticket-qr-route.cjs` | no-store, no-referrer, generic errors |
| `api/admin-approve-order.js` | Safe ticket logs |
| `api/misc.js` | Safe ticket logs |
| `server.cjs` | Safe logs; removed `/api/validate-ticket` |
| `src/lib/orders/paymentService.ts` | Admin fetch via API; public enabled-only via Supabase |
| `src/lib/sanitizeHtml.ts` | CMS HTML sanitizer |
| `src/lib/sanitizeHtml.test.ts` | XSS + email campaign formatting tests |
| `src/pages/Careers.tsx` | Sanitized dangerouslySetInnerHTML |
| `src/components/admin/marketing/EmailCampaignPreview.tsx` | Sanitized campaign body preview |
| `src/components/auth/ProtectedScannerRoute.tsx` | Scanner session guard |
| `src/pages/scanner/ScannerApp.tsx` | Login public; other routes protected |
| `src/App.tsx` | Influencer route wrapper |
| `src/pages/influencer/Dashboard.tsx` | Guard moved to router |
| `src/lib/api-routes.ts` | Removed legacy VALIDATE_TICKET |
| `supabase/migrations/20260628180000_tighten_payment_options_rls.sql` | Idempotent anon SELECT enabled rows only |
| `scripts/security/check-supabase-rls.mjs` | Disabled payment_options probe |
| `scripts/security/check-admin-service-role-auth.mjs` | gateAdminPermission recognition |
| `scripts/verify-security-headers.js` | CSP unsafe warnings |
| `package.json` | test:security-remediation script |
| `security/*.md` | Plans, checklists, triage, this report |

---

## 4. Database / Migration Changes

**Migration applied:** **Yes**

**File:** `supabase/migrations/20260628180000_tighten_payment_options_rls.sql`

**Applied via:** Supabase MCP `apply_migration` (`tighten_payment_options_rls`) to project `ykeryyraxmtjunnotoep`

**SQL effect:**

- Drops `"Public can view payment options"` (broad USING true).
- Drops and recreates `"payment_options_anon_select_enabled"` (idempotent).
- Grants anon + authenticated SELECT only where `enabled = true`.
- Does **not** add client write policies; admin CRUD remains service-role API only (`GET/PUT /api/admin/payment-options` with `settings:manage`).

**Verified:** `npm run security:rls` — `OK payment_options: anon cannot read disabled rows`

---

## 5. API / Route Changes

| Route | Change |
|-------|--------|
| `GET /api/admin/payment-options` | Gated (`settings:manage`); frontend uses this for admin reads |
| `POST /api/validate-ticket` | **Removed** from `server.cjs` (never on Vercel) |
| `GET /api/tickets/qr/:token` | Response headers hardened (no-store, no-referrer) |

---

## 6. Frontend Changes

- **PaymentOptionsManager** — loads via `fetchAllPaymentOptions()` → admin API.
- **Careers** — CMS HTML sanitized before render.
- **EmailCampaignPreview** — campaign body sanitized via `sanitizeCmsHtml()` before `dangerouslySetInnerHTML`.
- **Scanner** — unauthenticated users redirected to `/scanner/login` for all routes except login.
- **Influencer** — `ProtectedInfluencerRoute` at router level in `App.tsx`.

---

## 7. Tests Run (Release Gate — Final)

| Command | Result | Notes |
|---------|--------|-------|
| `npm run test:security-remediation` | **PASS** (15/15) | Includes EmailCampaignPreview + idempotent migration |
| `npm run test:admin-auth-order` | **PASS** (70/70) | |
| `npm run test:login-security` | **PASS** (16/16) | |
| `npm run test:supabase-remediation` | **PASS** (15/15) | |
| `npx vitest run src/lib/sanitizeHtml.test.ts` | **PASS** (6/6) | Includes email campaign cases |
| `npm run build` | **PASS** | |
| `npm run security:check` | **PASS** | |
| `npm run security:admin-auth` | **PASS** (0 findings) | |
| `npm run security:storage` | **PASS** (13/13) | |
| `npm run security:public-routes` | **PASS** | |
| `npm run security:rls` | **PASS** | Migration applied; disabled rows blocked |

---

## 8. Deferred Items

- **SEC-001 phase 2:** Signed/expiring QR URLs — `security/ticket-qr-signed-url-hardening-plan-2026-06-28.md`
- **SEC-003 phase 2:** Remove CSP unsafe-inline/unsafe-eval — `security/csp-tightening-plan-2026-06-28.md`
- **SEC-005:** CSRF tokens for cookie-auth admin POSTs
- **SEC-010:** JWT secret segregation / rotation
- **SEC-009:** Supabase Auth dashboard settings — manual checklist (`security/supabase-auth-dashboard-hardening-checklist-2026-06-28.md`)
- Staging live role matrix IDOR/RBAC POST tests
- FORCE RLS / grant cleanup on Postgres

---

## 9. Production Deployment Verdict

| Question | Answer |
|----------|--------|
| **Migration applied?** | **Yes** — `20260628180000_tighten_payment_options_rls.sql` |
| **`npm run security:rls`?** | **PASS** |
| **EmailCampaignPreview sanitized?** | **Yes** |
| **All release gate commands?** | **PASS** |
| **Production deploy allowed?** | **Yes** |
| **Blockers remaining** | None for this remediation pass |
| **Rollback** | Revert app deploy; re-create `"Public can view payment options"` policy only if checkout breaks (unlikely) |

**Remaining unfixed by design:** Bearer-token QR URLs (SEC-001 phase 2); CSP unsafe directives until dependency audit; Supabase Auth dashboard manual settings.

---

*Updated 2026-06-28 (release gate). No secrets printed. No deploy/push performed.*
