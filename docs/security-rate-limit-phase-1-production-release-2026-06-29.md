# Phase 1 Rate Limiting — Production Release Report (2026-06-29)

**Final verdict: ROLLED BACK — BLOCKED (not promoted)**

Phase 1 was merged to `main` and briefly auto-deployed to Production. P0 routes returned `503 service_unavailable` (rate-limit fail-closed / Redis). Production was rolled back to the previous known-good deployment. **Phase 1 is on `main` but not live on Production.**

---

## 1. Branches and commit SHAs

| Item | SHA / ref |
|------|-----------|
| Source branch | `wip/rate-limit-phase-1` |
| Target branch | `main` |
| Merge commit | `ad97bc79fc3d20c9daedbf63249c86f90431a0de` |
| Merge message | `Merge Phase 1 rate limiting into main` |
| Pre-merge `main` tip | `31781b7` |
| WIP tip (pre-merge) | `3277503` |

Unrelated local work was **stashed** before merge (`ambassador-email-wip-unrelated`) and not included in the merge commit.

---

## 2. Merge summary

- `git merge wip/rate-limit-phase-1` completed with **no manual conflicts** (ort auto-merge).
- Auto-merged: `api/_lib/reports-export-route.test.cjs`, `api/misc.js`.
- **64 files changed**, +5852 / −2673 lines (shared `api/_lib/rate-limit/*`, P0 route wiring, `server.cjs` parity forwards, docs, tests).
- Pushed: `git push origin main` (`31781b7..ad97bc7`).

---

## 3. Conflict resolutions

None required. Git auto-merge succeeded on all files.

---

## 4. Files changed (high level)

| Area | Files |
|------|--------|
| Shared RL module | `api/_lib/rate-limit/*` (new) |
| P0 routes | `admin-login.js`, `scan.js`, `pos.js`, `orders-create.js`, `clictopay-*.js`, `misc.js`, `ambassador-routes.cjs`, `academyRoutes.cjs`, `ticket-qr-route.cjs` |
| Local parity | `server.cjs`, `api/_lib/server-cjs-vercel-forward.cjs` |
| Tests | `api/_lib/rate-limit/*.test.cjs`, `*-rate-limit*.test.cjs`, `server-cjs-p0-rate-limit-parity.test.cjs` |
| Docs | `docs/security-rate-limit-*.md` |
| Tooling | `scripts/_preview-rate-limit-smoke.cjs`, `env.example`, `package.json` |

**Not merged / not staged:** ambassador application email WIP files, `.env`, local helper scripts.

---

## 5. Environment presence (names only — no values)

Checked via `vercel env ls` and `vercel env pull` (encrypted values not readable via pull).

| Variable | Preview | Production |
|----------|---------|------------|
| `UPSTASH_REDIS_REST_URL` | Present | Present |
| `UPSTASH_REDIS_REST_TOKEN` | Present | Present |
| `RATE_LIMIT_KEY_PEPPER` | Present (name listed) | Present (name listed) |

**Note:** `vercel env pull` shows variable **names** but empty decrypted values (expected for encrypted secrets). **Length ≥32 and randomness of `RATE_LIMIT_KEY_PEPPER` could not be verified via CLI without exposing secrets.** Ops should confirm in Vercel dashboard that pepper is a dedicated random string ≥32 chars, not `JWT_SECRET`.

**Runtime finding:** Phase 1 Preview and brief Production deploy both returned `{"error":"service_unavailable"}` on P0 routes → **Upstash REST calls failing or env not effective at runtime** (fail-closed). This must be fixed before any re-promotion.

---

## 6. Local test results (post-merge on `main`)

| Command | Result |
|---------|--------|
| `npm run test:rate-limit` | **126/126 pass** |
| `npm run test:login-security` | **35/35 pass** |
| `npm run test:payment-fulfillment` | **86/86 pass** |
| `npm run test:academy-payment` | **58/58 pass** |
| `npm run test:admin-auth-order` | **92/92 pass** |
| `npm run test:security-remediation` | **15/15 pass** |
| `npm run build` | **Success** |

**Total: 412 tests, 0 failures.**

---

## 7. Static grep results (P0 classification)

| Finding | Classification |
|---------|----------------|
| `ticket-qr-route.cjs` uses `enforceRateLimits` (no `rateByIp`) | **P0 clean** |
| `admin-login.js` does not import `admin-login-upstash` directly | **P0 clean** |
| `upstash.cjs` uses atomic Lua `EVAL` (INCR+EXPIRE in script) | **P0 clean** |
| P0 `server.cjs` routes use `forward*` (no express limiter on registrations) | **P0 clean** |
| `express-rate-limit` definitions remain; used on non-P0 e.g. `ambassador-update-password` | **non-P0 legacy** |
| `academyRoutes.cjs` `checkIpRate` on `/api/academy/register` only | **non-P0 legacy** |
| `misc.js` `ambassadorApplicationAttempts` / `suggestionsAttempts` Maps | **non-P0 legacy** |
| `client-site-log.js` `rateBuckets` Map | **non-P0 legacy** |
| `admin-login-upstash.js` deprecated wrapper (tests only reference) | **test-only / deprecated** |
| Data-structure `Map()` in reports/fulfillment | **unrelated** |

**No P0 static blockers** in source on `main`.

---

## 8. Preview deployment

| Field | Value |
|-------|--------|
| URL | `https://andiamo-events-64a6nl3vq-fmalekbenamorf-6393s-projects.vercel.app` |
| Deployment ID | `dpl_57kKePSuxCPmdM1okqgCtXyEjRq4` |
| Environment | Preview |
| Status | Ready |
| Local `main` SHA | `ad97bc79fc3d20c9daedbf63249c86f90431a0de` |
| Deploy method | `npx vercel@latest deploy --yes` from merged `main` |

**Commit SHA on deployment:** Vercel inspect does not expose git SHA in CLI output; deploy was triggered from current `main` immediately after push (same tree as `ad97bc7`).

---

## 9. Preview smoke results

Preview has **Deployment Protection** (302 without bypass). Smoke used `npx vercel@latest curl --deployment <url>`.

| Check | Result | Notes |
|-------|--------|-------|
| Admin login over-limit → 429 | **FAIL** | Automated script could not parse status on Windows (`status=0`); manual curl shows issues |
| Invalid payment confirm → 400 | **FAIL** | Manual: `{"error":"service_unavailable"}` — **503, not 400** |
| Order create over-limit → 429 | **FAIL** | Not reached; Redis fail-closed |
| Invalid QR → 400 | **FAIL** | Not verified (tooling / 503) |
| QR valid over-limit → 429 | **FAIL** | Not verified |
| Resend ticket 6th → 429 | **SKIPPED** | Requires admin JWT + order |
| Email/SMS over-limit → 429 | **SKIPPED** | Requires admin JWT; no real sends |

**Preview smoke: FAILED** — primary blocker is `503 service_unavailable` on rate-limited routes (Upstash/Redis not working in deployment).

---

## 10. Production deployment (brief — rolled back)

| Field | Value |
|-------|--------|
| Auto-deploy URL (Phase 1) | `https://andiamo-events-my5rqrovb-fmalekbenamorf-6393s-projects.vercel.app` |
| Auto-deploy ID | `dpl_E8xSpHhR4dEy3bBoGTjrVrcBfSWu` |
| Trigger | `git push origin main` (Git integration auto-production) |
| Duration live | ~minutes before rollback |

**P0 failures observed on Production (Phase 1 build):**

| Route | Status | Body |
|-------|--------|------|
| `POST /api/admin-login` | 503 | `service_unavailable` |
| `POST /api/orders/create` | 503 | `service_unavailable` |
| `GET /api/clictopay-confirm-payment?orderId=bad` | 503 | `service_unavailable` |
| `GET /api/tickets/qr/badtoken` | 500 | `FUNCTION_INVOCATION_FAILED` |

**Production was not intentionally load-tested.** Single safe probes only.

**Promotion:** Did not meet criteria (Preview smoke failed). Auto-deploy occurred **before** smoke completed (process violation).

---

## 11. Rollback

| Action | Detail |
|--------|--------|
| Rolled back to | `https://andiamo-events-2ziaxw9z6-fmalekbenamorf-6393s-projects.vercel.app` |
| Rollback deployment ID | `dpl_GpRsaeFnqiFS7wNocQo5B2wz5eNu` |
| Command | `npx vercel@latest rollback andiamo-events-2ziaxw9z6-... --yes` |
| Time | 2026-06-29 (during release session) |

**Post-rollback Production health:**

| Check | Result |
|-------|--------|
| Homepage `/` | 200 |
| `/admin/login` | 200 |
| Invalid payment confirm (single probe) | 500 (legacy path — pre–orderId validation); **not 503** |

Production is on **pre–Phase 1** code again.

---

## 12. Post-production health (after rollback)

- Homepage and admin login page load (**200**).
- Valid admin login not tested (no credentials in automation).
- Invalid login not re-tested after rollback.
- **No intentional over-limit testing on Production.**

**Risk:** `main` still contains Phase 1; the **next push to `main` will auto-deploy Phase 1 again** unless Git/Vercel deploy is paused or Redis is fixed first.

---

## 13. Root cause hypothesis (503)

Phase 1 fail-closed on Vercel returns `503` when:

- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` missing at runtime, or
- Upstash REST `EVAL` fails (auth, network, wrong DB, empty token).

Env **names** exist in Vercel project settings; runtime failure suggests **empty/invalid values**, **wrong Upstash instance**, or **REST token permissions**. Verify in Upstash console + Vercel dashboard (re-save vars, redeploy Preview only).

---

## 14. Emergency flags (if rollback insufficient)

| Flag | Use |
|------|-----|
| `RATE_LIMIT_GLOBAL_FAIL_OPEN=1` | Skip all limits during Redis outage (logged) |
| `RATE_LIMIT_DISABLED=1` + `RATE_LIMIT_DISABLED_REASON` (≥10 chars) | Disable limits (discouraged) |

Not applied during this release.

---

## 15. Phase 2 (unchanged / not modified)

- scanner validate/lookup-ticket, verify-admin, exports, public scrape, phone-subscribe, aio-events, CSP report — **not touched**.

---

## 16. Required actions before re-attempt

1. **Fix Upstash on Preview** — confirm REST URL/token work; test `EVAL` from Upstash console; ensure pepper is set (≥32 chars, dedicated).
2. **Re-run Preview smoke** until all mandatory checks pass (disable Preview protection for QA or use `vercel curl`).
3. **Pause auto-production** on `main` or use manual promote-only workflow until smoke passes.
4. **Re-deploy Preview from `ad97bc7`**, smoke pass, then **promote that exact deployment** to Production.
5. Consider fixing QR `FUNCTION_INVOCATION_FAILED` separately (500 on invalid token during Phase 1 deploy).

---

## 17. Stashed unrelated work

`git stash` entry: `ambassador-email-wip-unrelated` (misc/server/dashboard/vercel local edits). Restore with `git stash pop` when ready.

---

**Signed off by:** automated release gate session  
**Date:** 2026-06-29
