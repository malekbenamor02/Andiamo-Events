# Server-side Excel export — final production gate

**Date:** 2026-06-28  
**Scope:** Pre-deploy hardening review for `/api/admin/reports/export` and related notes from the initial security report.  
**Verdict:** **PASS**

---

## Summary

All three prior notes were reviewed. One code fix was applied (server payment fee parity). Permission model and legacy endpoint were inspected; no new permission key or endpoint removal was applied (approval required for those). All verification commands and security gates passed.

---

## 1. Permission decision: `reports:view` **accepted** (intentional)

### Model

| Layer | Behavior |
|-------|----------|
| **Tab registry** | `tickets` tab requires `reports:view` (`shared/admin/tabDefinitions.data.json`) |
| **Session permissions** | `resolveAdminEffectiveAccess` (`shared/admin/tabAccess.cjs`) derives effective permissions from granted tabs (explicit `admin_tab_access` rows) or role defaults |
| **super_admin** | `permissions: ['*']` — full access including export |
| **admin (default, no explicit tabs)** | `ROLE_PERMISSIONS.admin` does **not** include `reports:view` — cannot export |
| **admin (explicit tabs)** | Gets `reports:view` only if `tickets` tab is in `allowed_tab_keys` |
| **Sensitive tabs** | `tickets` is **not** in `SENSITIVE_TAB_KEYS` and **not** in `standard_admin` preset — reports access must be explicitly granted |

### Who can export PII?

Excel export includes customer name, phone, email, and order financials. Access requires **`reports:view`**, which is tied to the **Tickets / Reports & Analytics** tab — not the generic `admin` role preset.

**Decision:** Reusing `reports:view` is **intentional and sufficient**. Analytics UI and Excel download share the same tab/permission; there is no separate “view KPIs without PII download” split in the product today.

### `reports:export` — not added (proposal only)

A dedicated `reports:export` permission would only be needed to separate in-app analytics from downloadable PII. **Not implemented** — requires product approval and migration (new permission key, tab mapping, admin UI presets, DB backfill).

### Minor UI note (non-blocking)

`canDownloadReportsExcel()` still gates on role `admin` \| `super_admin` only, while the server enforces `reports:view`. Tab-restricted admins may see the button but receive **403** from the API. Aligning UI to session `permissions` is a follow-up, not a deploy blocker.

---

## 2. Legacy endpoint: `/api/admin/analytics/export-orders`

### Security review

| Check | Status |
|-------|--------|
| `requireAdminAuth` before DB | **Yes** (`admin-orders-routes.cjs`) |
| `requireAdminPermission('reports:view')` before service role | **Yes** |
| Browser Excel password path | **None** (JSON API only) |
| Column minimization | **Fixed this gate** — replaced `select *` with explicit column list aligned to server Excel export |

### Still needed?

| Consumer | Uses endpoint? |
|----------|----------------|
| Reports analytics Excel UI | **No** — uses `/api/admin/reports/export` |
| `adminOrdersApi.exportOrders()` | **Defined but uncalled** in `src/` |
| Admin Dashboard COD export | **No** — builds Excel client-side from in-memory `codAmbassadorOrders` |

**Conclusion:** Endpoint is **legacy / unused for reports Excel**. Kept for backward compatibility and possible external scripts.

### Deprecation plan (approval required before removal)

1. Monitor Vercel logs for `GET /api/admin/analytics/export-orders` hits (30 days).
2. Remove dead `adminOrdersApi.exportOrders` and `ADMIN_ANALYTICS_EXPORT_ORDERS` from frontend.
3. Return `410 Gone` with message pointing to `/api/admin/reports/export`, then remove route + `vercel.json` rewrite.

**This gate:** Tightened `EXPORT_ORDER_SELECT` only; endpoint remains registered and protected.

---

## 3. Online payment fee server parity — **fixed**

### Problem

`reports-excel-export.cjs` bundled `src/lib/onlinePaymentFee.ts`, which esbuild replaced with `import_meta = {}` and `import.meta.env.VITE_ONLINE_PAYMENT_FEE_RATE` — unsafe in Node and decoupled from `ONLINE_PAYMENT_FEE_RATE`.

`reports-order-helpers.cjs` used `Number(process.env.ONLINE_PAYMENT_FEE_RATE || 0) || 0`, which silently became **0** when env unset (wrong vs server default **0.05**).

### Fix applied

| File | Change |
|------|--------|
| `api/_lib/online-payment-fee-shim.cjs` | **New** — server alias for frontend `onlinePaymentFee` API using `online-payment-fee.cjs` |
| `package.json` `build:reports-excel` | esbuild alias `@/lib/onlinePaymentFee` → shim |
| `api/_lib/reports-order-helpers.cjs` | Uses `getOnlinePaymentFeeRate` / `computeOnlinePaymentFees` from `online-payment-fee.cjs` |
| `api/_lib/reports-excel-fee-parity.test.cjs` | **New** — default 0.05, env override 0.08, bundle has no `import.meta.env` |

### Runtime config

| Env | Used by |
|-----|---------|
| `ONLINE_PAYMENT_FEE_RATE` | Server checkout, Excel export, `reports-order-helpers` |
| `VITE_ONLINE_PAYMENT_FEE_RATE` | Frontend checkout UI only (must match server value) |

Ensure **both** are set to the same rate in Vercel production (e.g. `0.05`).

### Tests

- Default rate → 100 TND subtotal → **105** TND revenue (5% fee)
- `ONLINE_PAYMENT_FEE_RATE=0.08` → 100 → **108** TND
- Bundle references `online-payment-fee.cjs` / shim; **no** `import.meta.env`

---

## Files changed (this gate)

| File | Change |
|------|--------|
| `api/_lib/online-payment-fee-shim.cjs` | Created |
| `api/_lib/reports-excel-fee-parity.test.cjs` | Created |
| `api/_lib/reports-order-helpers.cjs` | Fee via `online-payment-fee.cjs` |
| `api/_lib/admin-orders-routes.cjs` | Trimmed legacy `EXPORT_ORDER_SELECT`; deprecation comment |
| `api/_lib/reports-excel-export.cjs` | Rebuilt via `npm run build:reports-excel` |
| `package.json` | esbuild alias; fee test in `test:admin-auth-order` |

---

## Commands run and results

| Command | Result |
|---------|--------|
| `npm run build:reports-excel` | **PASS** |
| `npm run build` | **PASS** |
| `node --test api/_lib/reports-export-route.test.cjs` | **PASS** — 10/10 |
| `node --test api/_lib/reports-excel-fee-parity.test.cjs` | **PASS** — 4/4 |
| `npm run test:admin-api-authz-coverage` | **PASS** — 37/37 |
| `npm run security:admin-auth` | **PASS** |
| `npm run security:public-routes` | **PASS** |
| `npm run security:rls` | **PASS** |

### Grep evidence

```bash
rg -n "VITE_REPORTS_EXCEL_LOCK_PASSWORD|AndiamoEventsReports" src dist public api server.cjs
```

**0 hits** in `src`, `dist`, `public` (only test assertion strings in `api/_lib/reports-export-route.test.cjs`).

```bash
rg -n "REPORTS_EXCEL_LOCK_PASSWORD" src dist public
```

**0 hits**.

```bash
rg -n "import.meta.env" api/_lib/reports-excel-export.cjs api/_lib/reports-excel-server.src.ts api/_lib/reports-order-helpers.cjs api/_lib/reports-export-data.cjs
```

**0 hits** in export pipeline (bundle uses `online-payment-fee-shim.cjs`).

```bash
rg -n "/api/admin/analytics/export-orders|/api/admin/reports/export" src api server.cjs vercel.json
```

Both endpoints registered; new export used by frontend; legacy marked in route comment.

---

## Production build integration (2026-06-28 patch)

`package.json` defines `"prebuild": "npm run build:reports-excel"`, so **`npm run build` automatically rebuilds `api/_lib/reports-excel-export.cjs`** before the Vite production build. No separate manual esbuild step is required on deploy.

---

## Deploy checklist (manual)

- [ ] Set `ONLINE_PAYMENT_FEE_RATE` in Vercel production (and match `VITE_ONLINE_PAYMENT_FEE_RATE` for checkout UI)
- [ ] Optional: set `REPORTS_EXCEL_LOCK_PASSWORD` server-only for casual sheet edit lock
- [x] `build:reports-excel` runs automatically via `prebuild` on `npm run build`
- [ ] After deploy: smoke-test Reports → Export Excel as super_admin and as tab-restricted admin without `tickets` (expect 403)

---

## Final verdict: **PASS**

Server-side Excel export is ready for production deploy from a security and fee-parity perspective. `reports:view` is an accepted permission for PII export. Legacy JSON endpoint remains protected with minimized columns; removal deferred pending approval. No security gate failures.
