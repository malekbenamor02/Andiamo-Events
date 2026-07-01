# WIP Branch Review — `wip/dashboard-ambassador`

**Date:** 2026-07-01  
**Reviewer:** Automated branch review (read-only)  
**Base:** `origin/main` @ `a731466`  
**Branch:** `wip/dashboard-ambassador`  
**HEAD:** `d654a46` — *Add Vercel rewrite for dashboard activity API on Preview/production*  
**Prior WIP commit:** `f8af108` — *wip: dashboard overview activity and ambassador application email*

**Production:** Not touched. Phase 1 rate limiting remains live at `dpl_C43vSqydAbPxpuyUWQWWghbNjgjK` / `b5fbd54`.

---

## 1. Summary

| Metric | Value |
|--------|-------|
| Files changed vs `main` | **23** (+3,345 / −18 lines) |
| Added | 15 |
| Modified | 8 |
| Deleted | 0 |
| Renamed | 0 |
| Untracked (local only) | `preview-smoke-out.json`, `scripts/_check-pepper-presence.cjs`, `scripts/_preview-smoke-fast.cjs` |

This branch is **two parallel efforts**:

1. **Dashboard overview/activity** — largely implemented end-to-end (API + UI + Vercel rewrite + tests).
2. **Ambassador application email** — **helpers and tests exist, but production wiring is incomplete**. `Dashboard.tsx` still sends approval/rejection emails client-side via `/api/send-email` (`marketing:manage`), and `misc.js` was **not** updated to call the new server-side send helpers or expose the resend route.

---

## 2. Scope classification

| File | Group | Sensitive touch? |
|------|-------|------------------|
| `api/_lib/admin-dashboard-activity.cjs` | Dashboard overview/activity | Service-role Supabase reads |
| `api/_lib/admin-dashboard-activity.test.cjs` | Tests | — |
| `api/_lib/admin-data-routes.js` | API/backend route | `dashboard:view`, service-role |
| `src/pages/admin/components/OverviewTab.tsx` | Dashboard + UI | — |
| `src/pages/admin/Dashboard.tsx` | Dashboard + UI + partial email | Order email `newEmail` fix; **still client send-email for applications** |
| `src/lib/adminApi.ts` | API/backend route | Dashboard activity fetch |
| `src/lib/api-routes.ts` | UI-only | New route constant |
| `vercel.json` | Unexpected/out-of-scope (deploy config) | **Dashboard activity rewrite only** — not rate-limit |
| `server.cjs` | API/backend route | Forwards `dashboard/activity`, `site-logs`, `bootstrap` to misc — **not rate-limit** |
| `api/_lib/server-cjs-vercel-forward.cjs` | API/backend route | Local dev handler path resolution fix |
| `api/_lib/server-cjs-p0-rate-limit-parity.test.cjs` | Tests | Parity entries for new forwards |
| `api/_lib/admin-api-authz-coverage.test.cjs` | Tests + Auth | Dashboard activity authz assertion |
| `api/_lib/ambassador-application-approval-email.cjs` | Ambassador email + Email side effect | Service-role, SMTP, plaintext password in email |
| `api/_lib/ambassador-application-email-http.js` | Ambassador email + API | `applications:manage` gate |
| `api/_lib/ambassador-approval-email-html.cjs` | Ambassador email | HTML escape |
| `api/_lib/ambassador-rejection-email-html.cjs` | Ambassador email | HTML escape |
| `api/_lib/ambassador-application-email-permission.test.cjs` | Tests | **Assumes wiring not yet present** |
| `ambassador-application-email-permission-fix-2026-06-29.md` | Docs | Design notes |
| `docs/audits/*.md` (4 files) | Docs | Investigation write-ups |
| `academy.md` | Unexpected/out-of-scope | Minor unrelated edit |

**Not changed (but tests expect changes):**

- `api/misc.js` — no resend route, no server-side approval/rejection email in `admin-update-application`
- `vercel.json` — no rewrite for `/api/admin-ambassador-application-resend-email`

**Phase 1 / rate-limit:** No accidental changes to `api/_lib/rate-limit/*`, `api/misc.js` QR dispatch, or payment confirm handlers.

---

## 3. Dashboard overview/activity findings

### What changed

- **New endpoint:** `GET /api/admin/dashboard/activity?event_id=&days=7`
  - Permission: `dashboard:view` (`PERM.DASHBOARD_BOOTSTRAP`)
  - **POS orders included only for `super_admin`** (`includePos`)
- **Bootstrap enhancement:** `GET /api/admin/dashboard/bootstrap` now returns `applicationStats` — exact counts per status via `count: 'exact'` (fixes PostgREST row-cap undercount).
- **Server aggregation:** `admin-dashboard-activity.cjs` builds UTC day buckets (1–30 days), counts paid online + COD + optional POS orders, revenue via shared report helpers, and parallel per-day application counts.
- **UI:** `Dashboard.tsx` fetches activity from API when overview tab accessible; **falls back** to legacy client-side 7-day aggregation on failure.
- **OverviewTab:** Application breakdown uses server `applicationStats` when present; adds **Paused (suspended)** and **Removed** bars.
- **Deploy:** `vercel.json` rewrite for `/api/admin/dashboard/activity` → `misc.js` (commit `d654a46`).
- **Local dev:** `server.cjs` forwards activity + bootstrap to `misc.js`.

### Safety assessment

| Area | Assessment |
|------|------------|
| Auth | **Good** — `requireAdmin` + `dashboard:view` before any DB work |
| POS data exposure | **Good** — POS revenue/orders gated to `super_admin` server-side |
| Timezone | **Documented UTC** — chart buckets are UTC calendar days; UI does not convert to local TZ |
| Fallback | **Safe** — API failure degrades to existing capped in-memory chart (no crash) |
| Data leak | **Low risk** — same admin session + permission as bootstrap; event-scoped orders |
| Performance | **Medium risk** — per-event order fetch paginates at 1000 but can be heavy for large events; application counts run **one HEAD count query per day** (up to 30 parallel). Monitor slow dashboards on big events. |
| Empty/error states | **Partial** — fetch failure logs warning and uses fallback; no dedicated user-visible “activity unavailable” banner |

### Tests

- `api/_lib/admin-dashboard-activity.test.cjs` — **PASS** (aggregation rules, POS gating, revenue)
- `api/_lib/admin-api-authz-coverage.test.cjs` — asserts activity route auth

---

## 4. Ambassador application email findings

### Intended design (from helpers + design doc)

- Approval/rejection emails built **server-side** from DB fields only
- Permissions: **`applications:manage`** (not `marketing:manage`)
- New route: `POST /api/admin-ambassador-application-resend-email`
- Client cannot pass `to`, `subject`, `html`, etc.
- HTML escaped in templates; passwords sent in approval email (by design)

### Actual branch state — **INCOMPLETE**

| Expected | On branch? |
|----------|------------|
| `misc.js` calls `sendAmbassadorApplicationApprovalEmail` on approve | **No** |
| `misc.js` calls `sendAmbassadorApplicationRejectionEmail` on reject | **No** |
| Resend route in `misc.js` | **No** |
| `vercel.json` rewrite for resend route | **No** |
| `adminApi.resendAmbassadorApplicationApprovalEmail()` | **No** |
| `Dashboard.tsx` uses server-side email flow | **No** — still `createApprovalEmail` + `sendEmail` / `sendEmailWithDetails` → **`/api/send-email`** |

### Current production behavior if merged as-is

- Admins with **`applications:manage` only** may **fail to send** approval/rejection emails (needs **`marketing:manage`** for `/api/send-email`).
- Passwords still flow through **client-built** email config (weaker than server-only template).
- New CJS/ESM email modules are **dead code** on Vercel until wired.

### Code smell in resend handler (when wired)

```javascript
regeneratePassword: regeneratePassword || true  // always true — password always regenerated
```

Likely bug: should be `regeneratePassword === true` or default `true` only when omitted intentionally.

---

## 5. Security findings

| ID | Severity | Finding |
|----|----------|---------|
| S1 | **High** | Ambassador approve/reject/resend still use client `/api/send-email` (`marketing:manage`) while tests/docs claim `applications:manage` server path — **permission mismatch / broken workflow for non-marketing admins** |
| S2 | **High** | Server-side email modules not wired — **security fix is not live** |
| S3 | **Medium** | Plaintext temporary passwords in approval emails (existing product pattern; server module continues it) |
| S4 | **Low** | `regeneratePassword \|\| true` forces password rotation on every resend |
| S5 | **Low** | Dashboard activity loads full order rows for an event (admin-only; acceptable but watch payload size) |
| S6 | **Info** | Order email edit fix uses `newEmail` instead of `email` in JSON body — aligns with API contract (good) |

**Not found:** service-role in frontend, IDOR on new routes, SQL injection, unescaped template output (unit tests verify escape), QR/payment/rate-limit regressions in this diff.

---

## 6. Permission / authz impact

| Route / action | Permission | Status |
|----------------|------------|--------|
| `GET /api/admin/dashboard/activity` | `dashboard:view` | Implemented |
| `GET /api/admin/dashboard/bootstrap` + stats | `dashboard:view` | Implemented |
| Approve/reject application (intended email) | `applications:manage` | Route auth OK; **email still via `marketing:manage`** |
| Resend approval email (new) | `applications:manage` | **Route not registered** |
| Marketing test/bulk email | `marketing:manage` | Unchanged |

---

## 7. Email side-effect risks

- **Duplicate emails:** Client approve flow can still retry/resend independently of server idempotency; no server-side “already sent” guard in wired path (not wired yet).
- **Failure handling:** Server helpers throw typed errors (`409` wrong status, `404` no ambassador); `misc.js` approve path does not yet catch/log `approvalEmailSent` / `rejectionEmailSent` flags promised by tests.
- **Rejection note:** Server rejection template supports `rejectionNote`; client `handleReject` may not pass it through until integrated.

---

## 8. Database / migration impact

- **No migrations** in this branch.
- Read-only queries on `orders`, `ambassador_applications`, `ambassadors` (email module).
- Application stats use `count: 'exact'` — no schema change.

---

## 9. Test results

| Suite | Result |
|-------|--------|
| `npm run test:admin-auth-order` | **PASS** (93/93) |
| `npm run test:security-remediation` | **PASS** (15/15) |
| `api/_lib/admin-dashboard-activity.test.cjs` | **PASS** |
| `api/_lib/ambassador-application-email-permission.test.cjs` | **FAIL** (11 pass / **12 fail**) |
| `npm run build` | **PASS** |

### Ambassador email test failures (expected — wiring missing)

- Resend route not in `misc.js`
- `admin-update-application` does not call server send helpers
- `Dashboard.tsx` still uses `createApprovalEmail`, `sendEmail`, `sendEmailWithDetails`
- No `resendAmbassadorApplicationApprovalEmail` in `adminApi.ts`
- Toast mojibake test fails (string still present or pattern mismatch)

---

## 10. Build result

`npm run build` — **PASS** (Vite + academy prerender)

---

## 11. Required fixes before merge

### Blockers

1. **Wire ambassador email end-to-end**
   - `misc.js`: server-side approval/rejection send in `admin-update-application`; add resend route + import handler
   - `vercel.json`: rewrite for `/api/admin-ambassador-application-resend-email`
   - `adminApi.ts`: `resendAmbassadorApplicationApprovalEmail()`
   - `Dashboard.tsx`: remove client `sendEmail` / `createApprovalEmail` / `createRejectionEmail` from application workflows; use API response flags (`approvalEmailSent`, etc.)

2. **Make permission tests pass** (12 failing static/integration tests)

3. **Fix `regeneratePassword` logic** in resend handler

### Recommended (non-blocking)

4. Dashboard activity: user-visible message when API fallback is active  
5. Performance: consider single SQL/RPC for application day counts instead of N HEAD queries  
6. Align `server.cjs` `POST /api/admin-update-application` with `misc.js` email behavior for local dev parity  
7. Remove or relocate unrelated `academy.md` tweak from this branch if splitting PRs

---

## 12. Recommended next prompt / action

```
On branch wip/dashboard-ambassador, complete ambassador application email wiring:

1. misc.js — integrate sendAmbassadorApplicationApprovalEmail / RejectionEmail in admin-update-application; register POST /api/admin-ambassador-application-resend-email
2. vercel.json — add resend rewrite
3. adminApi.ts — resendAmbassadorApplicationApprovalEmail
4. Dashboard.tsx — remove client send-email from handleApprove, handleReject, resendEmail, manual ambassador create; use server flags
5. Fix regeneratePassword default in ambassador-application-email-http.js
6. Run: node --test api/_lib/ambassador-application-email-permission.test.cjs && npm run test:admin-auth-order && npm run build
Do not merge to main. Do not touch Phase 1 rate-limit files.
```

---

## 13. Final verdict

### **READY_FOR_PATCH** — review complete, fixes needed

**Dashboard activity work** is close to mergeable after normal QA (permissions, UTC labeling, performance spot-check).

**Ambassador email work** is **not merge-ready**: server modules and tests exist, but **integration is missing** and current UI still depends on `marketing:manage` client email — a functional and permission regression relative to the stated goal.

**Do not merge** until ambassador email wiring is complete and `ambassador-application-email-permission.test.cjs` passes.

---

## 14. Patch — ambassador email wiring (2026-07-01)

### 14.1 Root cause

Server-side email modules (`ambassador-application-approval-email.cjs`, `ambassador-application-email-http.js`) were added on `f8af108` but **never integrated** into `misc.js`, `vercel.json`, `adminApi.ts`, or `Dashboard.tsx`. The UI continued to call `createApprovalEmail` / `createRejectionEmail` → `sendEmail` / `sendEmailWithDetails` → `POST /api/send-email`, which requires **`marketing:manage`**. Admins with only **`applications:manage`** could approve applications but not send credentials emails.

### 14.2 Files changed (patch)

| File | Change |
|------|--------|
| `api/misc.js` | Import send helpers + resend handler; `FORBIDDEN_CLIENT_EMAIL_FIELDS` on approve/reject; server-side approval/rejection email after DB update; `POST /api/admin-ambassador-application-resend-email` route |
| `api/_lib/ambassador-application-email-http.js` | Fix `regeneratePassword` — default regenerate on resend unless explicitly `false` |
| `api/_lib/ambassador-application-approval-email.cjs` | Explicit `shouldRegeneratePassword` logic (`false` + known plaintext does not rotate) |
| `vercel.json` | Rewrite `/api/admin-ambassador-application-resend-email` → `misc.js` |
| `server.cjs` | Local dev forward for resend route |
| `src/lib/api-routes.ts` | `ADMIN_AMBASSADOR_APPLICATION_RESEND_EMAIL` constant |
| `src/lib/adminApi.ts` | Typed `updateApplication` response; `resendAmbassadorApplicationApprovalEmail()` |
| `src/pages/admin/Dashboard.tsx` | `handleApprove` / `handleReject` / `resendEmail` / manual create use server endpoints; removed client marketing email helpers from application flows; fixed mojibake toasts |

### 14.3 Permission model after patch

| Action | Permission | Endpoint |
|--------|------------|----------|
| Approve + send credentials email | `applications:manage` | `POST /api/admin-update-application` (server sends after status update) |
| Reject + notification email | `applications:manage` | `POST /api/admin-update-application` |
| Resend approval/credentials email | `applications:manage` | `POST /api/admin-ambassador-application-resend-email` |
| Marketing test/bulk campaigns | `marketing:manage` | `POST /api/send-email` (unchanged) |
| Admin credentials email | `admins:manage` | `POST /api/send-email` via `handleAddAdmin` only |

### 14.4 Frontend flow after patch

1. **Approve** — `adminApi.updateApplication({ status: 'approved', temporaryPassword })` → server provisions ambassador, updates status, sends email → UI reads `approvalEmailSent` / `approvalEmailError`.
2. **Reject** — `adminApi.updateApplication({ status: 'rejected' })` → server sends rejection email → UI reads `rejectionEmailSent` / `rejectionEmailError`.
3. **Resend** — `adminApi.resendAmbassadorApplicationApprovalEmail({ applicationId })` — no client `to`/`subject`/`html`.
4. **Manual ambassador create** — after `createAmbassador`, finds linked application row and calls resend endpoint.
5. **Marketing tab** — still uses `fetch('/api/send-email')` for test/bulk campaigns.

### 14.5 Backend flow after patch

- Client email fields (`to`, `subject`, `html`, etc.) rejected with **400** on approve/reject and resend.
- Templates built server-side from DB application + ambassador records; recipient validated against stored application email.
- Email failure returns controlled flags (`approvalEmailError` / `rejectionEmailError`) **without rolling back** the already-committed status change (auditable partial success).
- Resend defaults to password regeneration (plaintext not stored); `regeneratePassword: false` skips rotation when explicitly requested.

### 14.6 `regeneratePassword` fix

**Before:** `regeneratePassword: regeneratePassword || true` — always `true`.

**After:**

- Resend handler: `const regeneratePassword = !explicitNoRegenerate` (default regenerate unless `false`/`'false'`/`0`).
- Send helper: `shouldRegeneratePassword = regeneratePassword === true || (regeneratePassword !== false && !plainPassword)`.

### 14.7 Test results (post-patch)

| Suite | Result |
|-------|--------|
| `api/_lib/ambassador-application-email-permission.test.cjs` | **PASS** (20/20) |
| `api/_lib/admin-dashboard-activity.test.cjs` | **PASS** (3/3) |
| `npm run test:admin-auth-order` | **PASS** (93/93) |
| `npm run test:security-remediation` | **PASS** (15/15) |

### 14.8 Build result

`npm run build` — **PASS** (after removing orphaned syntax from `resendEmail` refactor).

### 14.9 Static grep (application email paths)

| Pattern | Application workflows | Allowed elsewhere |
|---------|----------------------|-------------------|
| `createApprovalEmail` / `createRejectionEmail` | **Not in Dashboard.tsx** | `src/lib/email.ts` (library) |
| `sendEmail(` | **Not in application handlers** | — |
| `sendEmailWithDetails` | **Not in application handlers** | `handleAddAdmin` only |
| `/api/send-email` | **Not in approve/reject/resend/manual create** | Marketing test/bulk (`handleSendTestEmail`, `handleSendBulkEmails`) |

### 14.10 Remaining risks

- Email send failure after successful DB status update leaves application approved/rejected without email — admin must use Resend (documented in toasts).
- Manual ambassador create resend regenerates password (by design); UI-stored credentials may be stale until admin resends or re-approves.
- `server.cjs` inline `POST /api/admin-update-application` handler still lacks server-side email parity for pure local-dev paths that bypass `misc.js` (low risk if dev uses `forwardMiscApi` pattern).
- Dashboard activity performance (N parallel count queries) unchanged — monitor on large events.

### 14.11 Final verdict (post-patch)

### **READY_FOR_PR_REVIEW**

Ambassador application email workflow is wired end-to-end with correct `applications:manage` gating. Dashboard overview/activity work retained. **Do not merge to `main` until human PR review** — no Production deploy from this report.
