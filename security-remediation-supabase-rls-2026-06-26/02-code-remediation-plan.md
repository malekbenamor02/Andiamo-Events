# Code remediation plan

## Backend (completed in branch)

| Area | Change |
|------|--------|
| `api/admin-login.js` | Service role only; select `id,email,name,role,password,is_active` |
| `api/_lib/admin-authorization.mjs` | Require `SUPABASE_SERVICE_ROLE_KEY` in production |
| `api/orders-create.js` | Require service role in production |
| `api/_lib/admin-data-routes.js` | New admin CRUD/list routes (bootstrap, ambassadors, subscribers, messages, logs) |
| `api/_lib/service-role-client.js` | Shared service-role helper |
| `api/misc.js` | Dispatch admin-data routes; approve flow provisions ambassador server-side |
| `vercel.json` | Rewrites for new `/api/admin/*` routes |

### New admin routes

- `GET /api/admin/dashboard/bootstrap`
- `GET|POST|PATCH|DELETE /api/admin/ambassadors[/:id]`
- `GET /api/admin/ambassador-applications`
- `GET|PATCH|DELETE /api/admin/contact-messages[/:id]`
- `GET|PATCH|DELETE /api/admin/subscribers/phones[/:id]`
- `GET|PATCH|DELETE /api/admin/subscribers/newsletters[/:id]`
- `GET|PATCH|DELETE /api/admin/audience-suggestions[/:id]`
- `GET /api/admin/sms-logs`, `GET /api/admin/site-logs`
- `GET /api/admin/order-passes?pass_ids=`

### Approve flow

`POST /api/admin-update-application` accepts `hashedPassword` when `status=approved` and calls `provisionAmbassadorForApplication`.

## Frontend (completed in branch)

| File | Change |
|------|--------|
| `src/lib/adminApi.ts` | Thin fetch wrappers for all new admin routes |
| `src/lib/admin-api/index.ts` | Re-export for plan folder layout |
| `src/lib/api-routes.ts` | Route constants |
| `src/pages/admin/Dashboard.tsx` | Removed direct Supabase on private tables |
| `src/lib/ambassadorOrders.ts` | Uses ambassador-sales API |
| `src/lib/orders/orderService.ts` | Direct order reads/writes throw (createOrder still uses API) |
| `src/lib/ambassadors/ambassadorService.ts` | Uses `/api/ambassadors/active` |
| `src/lib/analytics/reportsExcelExport.ts` | Admin API for passes/ambassadors/order_passes |
| `src/lib/ticketGenerationService.tsx` | Stubbed server-only |

### Allowed client Supabase (post-migration)

| File | Access |
|------|--------|
| `src/hooks/useEvents.ts` | Filtered `events`, `event_passes` SELECT |
| `src/pages/Contact.tsx` | `contact_messages` INSERT |
| `src/components/layout/Footer.tsx` | `newsletter_subscribers` INSERT |
| `src/hooks/useSiteContent.ts` | `site_content` SELECT |
| `src/pages/admin/Dashboard.tsx` | `site_content` reads only |

### Secondary (not in P0 scope)

- `src/lib/logger.ts` — `site_logs` INSERT (telemetry); consider API later

## CI grep gate (recommended)

Fail build if `src/` contains `.from('orders'|'tickets'|'admins')` outside allowlist.
