# 02 — API Authorization Validation

## Unauthenticated GET tests (production)

Base URL: `https://www.andiamoevents.com`

| Route | Expected | Actual | Pass |
|-------|----------|--------|------|
| `/api/verify-admin` | 401 | 401 | ✅ |
| `/api/admin/dashboard/bootstrap` | 401 | 401 | ✅ |
| `/api/admin/admins` | 401 | 401 | ✅ |
| `/api/admin/ambassadors` | 401 | 401 | ✅ |
| `/api/admin/ambassador-applications` | 401 | 401 | ✅ |
| `/api/admin/contact-messages` | 401 | 401 | ✅ |
| `/api/admin/subscribers/phones` | 401 | 401 | ✅ |
| `/api/admin/subscribers/newsletters` | 401 | 401 | ✅ |
| `/api/admin/sms-logs` | 401 | 401 | ✅ |
| `/api/admin/site-logs` | 401 | 401 | ✅ |
| `/api/admin/order-passes` | 401 | 401 | ✅ |
| `/api/admin/orders/online` | 401 | 401 | ✅ |
| `/api/admin/order-logs` | 401 | 401 | ✅ |
| `/api/admin/logs` | 401 | 401 | ✅ |
| `/api/admin/audit-logs` | 401 | 401 | ✅ |
| `/api/scan-system-status` | 200 (public) | 200 | ✅ |
| `/api/ambassadors/active` | 400 without params | 400 | ✅ (not open data leak) |

**Pass** — private admin routes reject unauthenticated callers.

## Authenticated permission matrix

| Test | Status |
|------|--------|
| Restricted admin → forbidden routes | **Not tested** — no test credentials provided |
| Super admin → intended routes | **Not tested** |
| Direct API vs tab hiding | Code review: server uses `hasEffectivePermission` + service role in `admin-data-routes.js` |

### Code review (server-side enforcement)

- `requireAdmin()` verifies cookie JWT then checks permission key per route.
- Dashboard private data loaded via `/api/admin/*` and `adminApi.ts`, not browser Supabase for orders/tickets/admins.
- **Pass (design)** — tab hiding is not the only control.

## Mass assignment (unauthenticated)

Unauthenticated POST/PATCH to admin routes returns **401** before body processing — **Pass**.

Authenticated mass-assignment tests deferred (see `06-service-role-and-mass-assignment.md`).
