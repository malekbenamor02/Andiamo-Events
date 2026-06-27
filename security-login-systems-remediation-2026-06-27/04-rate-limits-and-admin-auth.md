# Rate Limits and Admin Auth

## Scanner login rate limit

**Route:** `POST /api/scanner-login`

- 6 failed attempts per 15 minutes per IP and per normalized email
- Returns `429` with generic message
- Failed attempts use same error as invalid credentials (`401 Invalid credentials`)
- Successful login clears counters for IP + email
- In-memory (serverless cold-start caveat documented)

**Module:** `api/_lib/scanner-login-rate-limit.cjs`  
**Tests:** `api/_lib/scanner-login-rate-limit.test.cjs`

## Scanner admin route auth

**Before:** JWT-only `requireAdminAuth` in `scan.js` (no `session_version` check)

**After:** `requireScannerAdminAuth` → `verifyAdminSession` from `admin-authorization.mjs` + `hasEffectivePermission(..., 'scanners:manage')`

**Routes affected:** All `/api/admin/scan-*` and `/api/admin/scanners*` handlers in `scan.js`

**Expected behavior:**

| Case | Status |
|------|--------|
| No cookie | 401 |
| Invalidated session (`session_version`) | 401 |
| Regular admin without `scanners:manage` | 403 |
| Super admin | 200 |

Note: `scanners:manage` is effectively super_admin-only in `shared/admin/permissions.cjs`.
