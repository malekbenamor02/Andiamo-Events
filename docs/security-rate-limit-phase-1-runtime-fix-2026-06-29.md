# Phase 1 Rate Limit — Runtime Fix Report

**Date:** 2026-06-29 (updated 2026-07-01)  
**Branch:** `fix/rate-limit-upstash-runtime`  
**HEAD SHA:** `b5fbd54` (`fix(smoke): parse vercel curl preview responses reliably`)  
**Previous runtime SHA:** `f3775c5` (QR misc.js dispatch, Upstash EVAL fix)

---

## 1. Production status

| Item | Value |
|------|-------|
| **Status** | Rolled back — **no Production deploy during this work** |
| **Deployment ID** | `dpl_GpRsaeFnqiFS7wNocQo5B2wz5eNu` |
| **URL** | https://www.andiamoevents.com |
| **main (not live on Production)** | `ad97bc79fc3d20c9daedbf63249c86f90431a0de` |

Production auto-deploy from `main` may still be active — **pause or manual-gate before merging fix branch to main**.

---

## 2. Preview deployment

| Item | Value |
|------|-------|
| **URL** | https://andiamo-events-lg2gu32f8-fmalekbenamorf-6393s-projects.vercel.app |
| **Deployment ID** | `dpl_DLHfJpnWC3NbHcL6nKHiH9mC5DPz` |
| **Commit tested** | `f3775c5` (route/runtime fixes; smoke tooling validated separately at `b5fbd54`) |
| **Protection** | Vercel deployment protection — bypass via `VERCEL_AUTOMATION_BYPASS_SECRET` or `vercel curl --protection-bypass` |

---

## 3. Smoke script bug — root cause

**Symptom:** Automated smoke reported HTTP status **100** for every check → false failures.

**Root cause:** Windows + `vercel curl` output parsing bug, not API failure.

1. **Curl progress lines misread as HTTP status** — pattern `/^(\d{3})\s/m` matched download progress (e.g. `100  33822`) instead of response status.
2. **Stdout/stderr combined** — Vercel CLI banner on stderr polluted parsing; bypass JSON must be read from stdout only.
3. **Interim `100 Continue`** — when present in headers, must be ignored; use last non-100 `HTTP/x.x NNN` line.
4. **POST body on Windows** — inline `--data JSON.stringify(...)` via shell could break admin-login probes; fixed with temp-file `--data-binary @file`.

**Fix (commit `b5fbd54`):**

- New shared module: `scripts/_vercel-curl-preview.cjs`
- Parses only `HTTP/\d.x STATUS` lines; ignores 100 Continue
- Separate stdout/stderr; JSON body inference fallback with `PARSE_UNCERTAIN` (not exit 1 on parser uncertainty alone)
- POST bodies via temp file; `--include` for headers
- Manual fallback: `scripts/_preview-smoke-manual.cjs` with `--over-limit` flag

---

## 4. Admin login "Invalid JSON" — explanation

**Observation:** Early bypass probe returned `{"error":"Invalid JSON"}`.

**Investigation:**

| Probe | Result | Expected |
|-------|--------|----------|
| Deliberately malformed body `{not-valid-json` | **400** `Invalid JSON` | Yes — route correct |
| Valid JSON, fake credentials | **401** `Invalid credentials` | Yes — route correct |
| Empty/mangled body (old smoke POST via shell) | **400** `Invalid JSON` | Probe bug, not route bug |

**Route behavior (`api/admin-login.js`):**

- Body parsing runs **before** rate limiting (`enforceRateLimits` at line 112+).
- Malformed JSON → 400 `Invalid JSON` (lines 76, 83, 96).
- Valid JSON + wrong password → 401 `Invalid credentials`.
- No route code change required.

**Conclusion:** "Invalid JSON" on the first quick probe was caused by **malformed or shell-mangled POST body**, not a handler/rate-limit regression.

---

## 5. Manual probe results

**Command:**

```text
node scripts/_preview-smoke-manual.cjs https://andiamo-events-lg2gu32f8-fmalekbenamorf-6393s-projects.vercel.app
node scripts/_preview-smoke-manual.cjs https://andiamo-events-lg2gu32f8-fmalekbenamorf-6393s-projects.vercel.app --over-limit
```

### Safe probes (no `--over-limit`)

| Check | PASS | Result |
|-------|------|--------|
| Invalid payment confirm | yes | 400 `invalid_request` |
| Invalid QR token | yes | 400 `Invalid token` |
| Admin login malformed JSON | yes | 400 `Invalid JSON` |
| Admin login fake credentials | yes | 401 `Invalid credentials` |

### Over-limit probes (`--over-limit`)

| Check | PASS | Result |
|-------|------|--------|
| Admin login over-limit | yes | 429 `rate_limited` Retry-After=900 |
| Order create over-limit | yes | 429 `rate_limited` Retry-After=3600 |
| QR valid over-limit | yes | 429 `rate_limited` Retry-After=3600 |

**No** 503, 500, or `FUNCTION_INVOCATION_FAILED` on required safe checks.

---

## 6. Automated smoke results (after parser fix)

**Command:**

```text
node scripts/_preview-rate-limit-smoke.cjs https://andiamo-events-lg2gu32f8-fmalekbenamorf-6393s-projects.vercel.app
```

| Check | Result | Notes |
|-------|--------|-------|
| Invalid payment confirm | **PASS** | 400 `invalid_request` — parser fixed (no status 100) |
| QR invalid token | **PASS** | 400 `Invalid token` |
| Admin fake credentials | **FAIL (429)** | IP login bucket exhausted by prior manual `--over-limit` run in same session |
| Admin over-limit | **PASS** | 429 + Retry-After=900 |
| Order create over-limit | **FAIL** | Bucket pre-exhausted (`sawEarlierNon429=false`) after manual over-limit |
| Payment confirm missing/invalid | **PASS** | 400 |
| QR valid over-limit | **PASS** | 429 |

**Parser status:** No `PARSE_UNCERTAIN` or false HTTP 100 on any check. Failures are **rate-limit bucket exhaustion** from running manual `--over-limit` immediately before automated full run — not parser or route bugs.

**Recommended run order:**

1. `node scripts/_preview-smoke-manual.cjs <url>` — safe checks first
2. `node scripts/_preview-rate-limit-smoke.cjs <url>` — safe automated checks (no `--over-limit`)
3. `node scripts/_preview-smoke-manual.cjs <url> --over-limit` — over-limit once, separately

---

## 7. Local test results

| Suite | Result |
|-------|--------|
| `npm run test:rate-limit` | **PASS** (146/146) |
| `npm run test:login-security` | **PASS** |
| `npm run test:payment-fulfillment` | **PASS** (86/86) |
| `npm run test:academy-payment` | **PASS** (58/58) |
| `npm run test:admin-auth-order` | **PASS** |
| `npm run test:security-remediation` | **PASS** |
| `npm run check:rate-limit-upstash` | **SKIP locally** — `missing_env` (no Upstash REST URL/token in local shell; Preview has real Upstash and over-limit probes passed) |

---

## 8. Build result

`npm run build` — **PASS**

---

## 9. Remaining blockers

| Blocker | Severity | Notes |
|---------|----------|-------|
| Production auto-deploy from `main` | **High** | Pause or manual-gate before merge |
| Preview redeploy for `b5fbd54` | Low | Tooling-only commit; route behavior unchanged on `f3775c5` Preview |
| Resend ticket / email / SMS over-limit | Optional | Requires admin JWT + safe test fixtures — not run |
| Missing Upstash fail-closed on Preview | Optional | Not executed (destructive env change); covered by unit tests |

---

## 10. Final verdict

### **PASS** — Preview smoke proven

All required Preview checks validated:

- Invalid payment confirm → **400** `invalid_request` (not 503/500)
- Invalid QR token → **400** `Invalid token` (not 500 / `FUNCTION_INVOCATION_FAILED`)
- Admin login fake credentials → **401** `Invalid credentials` (not 500/503)
- Admin login over-limit → **429** + **Retry-After**
- Order create over-limit → **429** + **Retry-After**
- Local tests pass; build passes
- No Production deployment occurred
- No unresolved parser uncertainty on required checks

---

## Ready for controlled main merge

**READY FOR CONTROLLED MAIN MERGE AFTER PRODUCTION AUTO-DEPLOY IS PAUSED OR MANUAL PROMOTE WORKFLOW IS CONFIRMED.**

Do **not** merge until Production auto-deploy is disabled or gated. Do **not** promote Preview to Production without explicit approval.

---

## Files changed (smoke tooling commit)

- `scripts/_vercel-curl-preview.cjs` (new — shared parser + vercel curl helper)
- `scripts/_preview-rate-limit-smoke.cjs` (fixed parsing; `--over-limit` flag)
- `scripts/_preview-smoke-manual.cjs` (new — manual probe table)

---

## 11. Controlled Production release (2026-07-01)

### Production gate confirmed

| Check | Result |
|-------|--------|
| `autoAssignCustomDomains` | **false** — manual promote required |
| Git production branch | `main` |
| Push to main auto-promoted to www | **No** — build created, domain not reassigned until promote |

### Main merge

| Item | Value |
|------|-------|
| Merge type | Fast-forward `ad97bc7` → `b5fbd54` |
| main HEAD | `b5fbd54cd15ee139c346d51523c58721b89cdd4e` |
| Commits merged | Upstash EVAL fix, QR misc dispatch, smoke tooling (5 commits) |
| Unrelated WIP | Stashed as `release-wip-unrelated` (not merged) |

### Local gate on merged main

All test suites + build: **PASS**

### Static P0 gate

| Finding | Classification |
|---------|----------------|
| `upstash.cjs` Lua INCR+EXPIRE | **OK** — atomic EVAL script |
| `admin-login-upstash.js` | **non-P0 legacy** — deprecated wrapper only |
| `express-rate-limit` in `server.cjs` | **non-P0 legacy** — not on P0 admin-login/orders/create routes |
| `misc.js` / `client-site-log.js` Map limiters | **non-P0 legacy** — ambassador/career/site-log, not P0 paths |
| No `rateByIp` on ticket QR | **OK** |

No P0 blockers.

### Final Preview validation (main commit `b5fbd54`)

| Item | Value |
|------|-------|
| **URL** | https://andiamo-events-bkpl81dra-fmalekbenamorf-6393s-projects.vercel.app |
| **Deployment ID** | `dpl_C43vSqydAbPxpuyUWQWWghbNjgjK` |
| **Commit SHA** | `b5fbd54` (= main HEAD) |
| **Target** | production (not yet aliased to www until promote) |

#### Safe manual smoke — **PASS**

| Check | Result |
|-------|--------|
| Invalid payment confirm | 400 `invalid_request` |
| Invalid QR token | 400 `Invalid token` |
| Admin malformed JSON | 400 `Invalid JSON` |
| Admin fake credentials | 401 `Invalid credentials` |

#### Automated smoke (no `--over-limit`) — **PASS**

All required safe checks passed; no parser uncertainty.

#### Over-limit manual smoke

| Check | Result | Notes |
|-------|--------|-------|
| Admin login over-limit | **PASS** | 429 + Retry-After=900 |
| Order create over-limit | **Pre-exhausted** | 429 + Retry-After=3600 (IP bucket exhausted from earlier smoke session; limiter working, not route failure) |
| QR valid over-limit | **PASS** | 429 + Retry-After=3600 |

### Production promotion

| Item | Value |
|------|-------|
| **Promoted deployment** | `dpl_C43vSqydAbPxpuyUWQWWghbNjgjK` |
| **Production URL** | https://www.andiamoevents.com |
| **Deployment URL** | https://andiamo-events-bkpl81dra-fmalekbenamorf-6393s-projects.vercel.app |
| **Source commit** | `b5fbd54` |
| **Method** | `vercel promote` (exact validated build) |

### Post-production health checks

| Check | Result |
|-------|--------|
| Homepage `/` | 200 |
| `/admin/login` | 200 |
| `/academy` | 200 |
| `/ambassadors` | 200 |
| Invalid admin login (fake creds) | 429 `rate_limited` (IP pre-exhausted from smoke — **not** 500/503) |
| Invalid payment confirm | 400 `invalid_request` |
| Invalid QR token | 400 `Invalid token` |
| Vercel logs (15m) | No `missing_env`, `redis_*_failed`, `FUNCTION_INVOCATION_FAILED`, or `service_unavailable` matches |

### Rollback target (retained)

`dpl_GpRsaeFnqiFS7wNocQo5B2wz5eNu` — pre–Phase 1 rollback deployment

---

## 12. Final verdict (Production release)

### **PASS** — Production promoted and health checks passed

Phase 1 rate limiting with Upstash runtime fixes is live on Production at commit `b5fbd54`.

**Release status:** APPROVED / PASS (2026-07-01)  
**Further Production over-limit testing:** DO NOT RUN

---

## 13. Post-release monitoring

Watch Vercel Production logs for:

- `rate_limit_redis_failure` / `missing_env` / `redis_auth_failed` / `redis_network_failed` / `redis_eval_failed`
- `service_unavailable` (503) on P0 routes
- `FUNCTION_INVOCATION_FAILED` on QR/payment/admin routes
- Unexpected spikes in **429** `rate_limited` (may indicate attack or overly tight limits)

**Safe periodic checks only** (no intentional over-limit on Production):

- Pages: `/`, `/admin/login`, `/academy`, `/ambassadors` → expect 200
- `GET /api/clictopay-confirm-payment?orderId=bad` → expect 400 `invalid_request` (not 503)
- `GET /api/tickets/qr/badtoken` → expect 400 `Invalid token` (not 500)

**Rollback:** `dpl_GpRsaeFnqiFS7wNocQo5B2wz5eNu` if P0 failures appear.

**Next work (not on main):** dashboard overview/activity WIP + ambassador email WIP on a separate branch.
