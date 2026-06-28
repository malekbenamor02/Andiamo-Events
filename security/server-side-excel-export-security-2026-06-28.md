# Server-side Excel report export — security verification

**Date:** 2026-06-28  
**Scope:** Move admin sales Excel export from browser to protected API; remove client passwords/secrets.  
**Verdict:** **PASS_WITH_NOTES**

---

## Executive summary

Admin Reports Excel export no longer builds workbooks in the browser. The frontend is a thin client that calls `GET /api/admin/reports/export` with session cookies. Workbook generation, service-role DB access, optional sheet protection (`REPORTS_EXCEL_LOCK_PASSWORD`), and audit logging run only on the server after DB-backed admin auth and `reports:view` permission checks.

Removed: hardcoded `AndiamoEventsReports` password, `VITE_REPORTS_EXCEL_LOCK_PASSWORD`, and ~1,200 lines of `exceljs` report logic from the client bundle.

---

## Current implementation summary

### Before

- `src/lib/analytics/reportsExcelExport.ts` (~1,273 lines) dynamically imported `exceljs`, fetched orders via `GET /api/admin/analytics/export-orders`, and built a multi-sheet workbook in the browser.
- Default sheet lock password `AndiamoEventsReports` was inlined in production bundles when no `VITE_` env was set (browser-exposed).

### After

| Layer | Behavior |
|-------|----------|
| **Frontend** | `reportsExcelExport.ts` (~67 lines): UI role guard (`admin` / `super_admin`), `fetch` to `/api/admin/reports/export`, blob download. No `exceljs`, no passwords. |
| **API** | `GET /api/admin/reports/export` — `requireAdminAuth` → `requireAdminPermission('reports:view')` → service-role data load → `buildReportsExcelBuffer` → `res.send(buffer)` with `Content-Disposition: attachment`. |
| **Excel** | Ported to `api/_lib/reports-excel-server.src.ts`, bundled to `api/_lib/reports-excel-export.cjs` via esbuild (`npm run build:reports-excel`). |
| **Delivery** | Direct authenticated HTTP response (no static files, no signed URL storage). |
| **Sheet lock** | Optional `process.env.REPORTS_EXCEL_LOCK_PASSWORD` server-only; if unset, export ships without sheet password (preferred). |

**Note:** Permission key is `reports:view` (existing analytics export permission), not a separate `reports.export` key. Matches `GET /api/admin/analytics/export-orders`.

---

## Files changed

### Added

| File | Purpose |
|------|---------|
| `api/_lib/reports-excel-server.src.ts` | Server workbook builder (no client fetch/API routes) |
| `api/_lib/reports-excel-export.cjs` | esbuild CJS bundle consumed by route |
| `api/_lib/reports-order-helpers.cjs` | Paid-order classification / revenue helpers |
| `api/_lib/reports-export-data.cjs` | Service-role payload loader (trimmed column select) |
| `api/_lib/reports-export-route.cjs` | Protected export endpoint + audit |
| `api/_lib/reports-export-route.test.cjs` | AuthZ, HTTP status, secret grep tests |

### Modified

| File | Change |
|------|--------|
| `src/lib/analytics/reportsExcelExport.ts` | Replaced with thin API client |
| `src/lib/api-routes.ts` | `ADMIN_REPORTS_EXPORT: '/api/admin/reports/export'` |
| `api/_lib/admin-privileged-app.cjs` | Register route; `isAdminPrivilegedPath` includes export path |
| `server.cjs` | Register route for local dev |
| `vercel.json` | Rewrite `/api/admin/reports/export` → `misc.js` |
| `package.json` | `build:reports-excel`; include export tests in `test:admin-auth-order` |
| `api/_lib/admin-api-authz-coverage.test.cjs` | Static gate for `reports:view` before DB load |

### Removed

| File | Reason |
|------|--------|
| `api/_lib/reports-excel-export.bundle.cjs` | Stale failed bundle |
| `scripts/internal/convert-reports-excel-to-cjs.mjs` | Abandoned regex conversion |

---

## Endpoint

```
GET /api/admin/reports/export
```

**Query parameters:** `event_id`, `event_name`, `date_range` (`ALL_TIME` \| `LAST_7_DAYS` \| `LAST_30_DAYS`), `language` (`en` \| `fr`)

**Response:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Cache-Control: no-store`, `Content-Disposition: attachment`

**Registration:** `server.cjs`, `admin-privileged-app.cjs` (Vercel via `misc.js`), `vercel.json` rewrite.

---

## AuthZ model

1. **`requireAdminAuth`** — DB-backed session verification (`verifyAdminSession`); JWT cookie alone is not trusted.
2. **`requireAdminPermission('reports:view')`** — effective permissions from DB; generic 403 if denied.
3. **`requireServiceDb`** — `supabaseService` only after steps 1–2; 503 if misconfigured.
4. **Frontend UI guard** — `canDownloadReportsExcel` limits button visibility to `admin` / `super_admin` (server still enforces permission).

Unauthenticated → **401**. Authenticated without permission → **403**. Authorized → **200** + file stream.

---

## Data filtering / minimization

- `EXPORT_ORDER_SELECT` in `reports-export-data.cjs` lists only report columns (order identity, customer contact, pass lines, ambassador name, event name). No payment secrets, tokens, or internal service fields in the select list.
- Orders filtered server-side: paid/completed, online/ambassador_cash + POS (`point_de_vente`), optional `event_id` and date range.
- Export limited to admins with `reports:view` (PII in report is intentional for finance ops; gated by permission).

---

## Audit logging

Every export calls `writeAdminMutationAudit` with:

| Field | Value |
|-------|-------|
| `action` | `reports_excel_export` |
| `target_type` | `report` |
| `target_id` | `event_id` or `all_events` |
| `details` | `report_type`, `event_id`, `date_range`, `language`, `success`, `row_count` (success) or `error` message (failure) |

No order rows or customer payload in audit `details`.

---

## Excel sheet protection

```text
// Excel sheet protection is accidental-edit protection only; access control is enforced server-side.
```

- Env: `REPORTS_EXCEL_LOCK_PASSWORD` (server-only).
- **Not used:** `VITE_REPORTS_EXCEL_LOCK_PASSWORD`.
- Workbooks are **not** written to `public/`, `dist/`, or disk.

Rebuild bundle after editing `reports-excel-server.src.ts`:

```bash
npm run build:reports-excel
```

---

## Tests run

| Command | Result |
|---------|--------|
| `npm run build` | **PASS** |
| `npm run test:admin-api-authz-coverage` | **PASS** — 37/37 |
| `npm run security:admin-auth` | **PASS** |
| `npm run security:public-routes` | **PASS** |
| `npm run security:rls` | **PASS** |
| `node --test api/_lib/reports-export-route.test.cjs` | **PASS** — 10/10 |

**Export test coverage:**

- 401 unauthenticated
- 403 missing `reports:view`
- 200 authorized + xlsx response headers
- Auth middleware ordering before `loadReportsExportPayload`
- No `VITE_REPORTS_EXCEL_LOCK_PASSWORD` / `AndiamoEventsReports` in `src`
- `REPORTS_EXCEL_LOCK_PASSWORD` only in server report modules
- No `writeFileSync` / `public/` / `dist/` in route handler

---

## Grep evidence (post-build)

### Password / env scan

```bash
rg -n "VITE_REPORTS_EXCEL_LOCK_PASSWORD|AndiamoEventsReports|REPORTS_EXCEL_LOCK_PASSWORD" src dist public api server.cjs
```

| Pattern | `src` | `dist` | `public` | `api` / `server.cjs` |
|---------|-------|--------|----------|----------------------|
| `VITE_REPORTS_EXCEL_LOCK_PASSWORD` | **0** | **0** | **0** | test assertions only |
| `AndiamoEventsReports` | **0** | **0** | **0** | **0** |
| `REPORTS_EXCEL_LOCK_PASSWORD` | **0** | **0** | **0** | `reports-excel-export.cjs`, `reports-excel-server.src.ts`, test file only |

### Secrets in static output

```bash
rg -n "service_role|SUPABASE_SERVICE_ROLE|JWT_SECRET|DATABASE_URL|STRIPE_SECRET|RESEND_API_KEY" dist public
```

- **`dist`:** one match — `/service_role/i` inside client-side **error sanitization** regex (hides server errors from users). Not a credential.
- **`public`:** **0** matches.

### Source maps

```bash
find dist public -name "*.map"
```

**0** files (PowerShell equivalent returned empty).

---

## Notes (non-blocking)

1. **`reports:view` vs `reports.export`:** Implementation reuses existing `reports:view` (same as legacy `export-orders`). Add a dedicated `reports:export` permission later if tab-level separation is needed.
2. **Legacy endpoint:** `GET /api/admin/analytics/export-orders` remains for other consumers (e.g. admin Dashboard order export). Reports analytics UI now uses `/api/admin/reports/export` only.
3. **Online payment fee on server:** Bundled server code inherits `onlinePaymentFee.ts` `import.meta.env` usage; fee rate may be `0` unless `ONLINE_PAYMENT_FEE_RATE` (or equivalent server env) is set. Verify parity with production fee config if revenue columns must match frontend exactly.
4. **Optional sheet lock:** Set `REPORTS_EXCEL_LOCK_PASSWORD` in Vercel/server env only if casual edit protection is desired; it is not an access-control boundary.

---

## Final verdict: **PASS_WITH_NOTES**

All required security controls are in place: no browser Excel passwords, protected server endpoint with auth before service role, direct non-public download, audit logging, tests and greps clean. Notes above are operational/documentation items, not export security blockers.
