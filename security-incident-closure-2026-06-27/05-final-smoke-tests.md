# 05 — Final Smoke Tests

## Automated (post-deploy)

| Test | Expected | Actual | Pass |
|------|----------|--------|------|
| `npm run build` | 0 | 0 | ✅ |
| `npm run security:rls` | 0 | 0 | ✅ |
| Homepage | 200 | 200 | ✅ |
| `/api/verify-admin` (no cookie) | 401 | 401 | ✅ |
| `/api/admin/orders` (no cookie) | 401 | 401 | ✅ |
| `/api/admin/application-selections` (no cookie) | 401 | 401 | ✅ |
| `/api/scan-system-status` | 200 | 200 | ✅ |
| `POST /api/site-logs` (valid payload) | 204 | 204 | ✅ |
| No browser Supabase on selection tables | 0 grep hits | 0 | ✅ |

## Manual (requires admin credentials)

| Test | Notes |
|------|-------|
| Admin login + `requiresPasswordChange` | All 8 admins must reset password |
| Application selections CRUD | Applications tab after login |
| Restricted admin 403 | Test with non-super admin account |
| Checkout / ticket scanner | Manual; no payment abuse |
