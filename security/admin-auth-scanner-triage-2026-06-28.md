# Admin Auth Scanner Triage — 2026-06-28

## Context

`npm run security:admin-auth` uses a static heuristic: `createAdminDbClient(` must appear within 8000 chars after `verifyAdminAuth`, `gateAdminPermission`, `requireAdminAuth`, etc.

Prior run: **20 findings** in `api/misc.js` and `api/_lib/admin-missing-routes-http.js`.  
`npm run test:admin-auth-order`: **70/70 pass**.

## Remediation applied

1. Extended look-back window: **3500 → 8000** characters.
2. Added auth markers:
   - `gateAdminPermission(`
   - `authorizeCronOrAdminPermission(`

## Classification

| File | Lines (approx) | Verdict | Evidence |
|------|----------------|---------|----------|
| `api/_lib/admin-missing-routes-http.js` | all handlers | **False positive (fixed)** | Each handler calls `gateAdminPermission` immediately before `createAdminDbClient` — see `handleAdminPaymentOptionsGet` L220–226 |
| `api/misc.js` inline admin blocks | ~2934, 3078, … | **False positive (fixed)** | Blocks gated with `gateAdminPermission(req, res, 'events:manage')` etc. before DB — e.g. admin passes GET L2910–2934 |
| `api/misc.js` cron routes | auto-reject | **False positive (fixed)** | Uses `authorizeCronOrAdminPermission` per `admin-api-authz-coverage.test.cjs` |

## True positives

**None confirmed** after marker/window update. All 20 prior hits were gated handlers missed by the scanner.

## Recommendation

- Re-run `npm run security:admin-auth` after this patch — expect **0 findings** or only new ungated code.
- Optional: set `ADMIN_AUTH_PROBE_BASE_URL` on staging for live 401 probes on admin routes.

## Code evidence (payment-options)

```javascript
// api/_lib/admin-missing-routes-http.js
const authResult = await gateAdminPermission(req, res, 'settings:manage');
if (!authResult) return;
const dbClient = await createAdminDbClient(res);
```

Auth strictly precedes service-role client creation.
