# Vercel API count (serverless functions)

Vercel Hobby counts **one serverless function per `api/**` file that exports a default HTTP handler**. Helpers under `api/_lib/` are not separate functions.

## Current count: **11** (at limit)

| File | Role |
|------|------|
| `api/admin-login.js` | Admin auth |
| `api/admin-approve-order.js` | Order approval + PDF |
| `api/orders-create.js` | Create order |
| `api/passes-[eventId].js` | Public passes |
| `api/presale.js` | Presale + **event promo** (availability, validate, admin CRUD) |
| `api/clictopay-generate-payment.js` | ClicToPay (do not merge) |
| `api/misc.js` | Unified routes (career, admin logs, ambassador, academy, …) |
| `api/media.js` | Media upload |
| `api/pos.js` | POS |
| `api/admin-pos.js` | Admin POS |
| `api/scan.js` | Scanner |

**Merged into `misc.js`:** `api/admin/logs.js` → `api/_lib/admin-logs-route.js` (rewrite `/api/admin/logs` → `misc.js`).

**Do not add** `api/event-promo.js` — all promo routes go through `presale.js`.

## Promo + presale rewrites (vercel.json)

- `/api/event-promo/:path*` → `presale.js`
- `/api/admin/event-promo/:path*` → `presale.js`
- Presale routes unchanged (separate rewrites for clarity)

## Event promo Supabase

Migration `event_promo_security_hardening` on production includes:

- `code_hash`, `label` columns
- `event_promo_order_create_rate_try` (12 / 15 min per IP)
- `event_promo_claim_uses(event_id, promo_id, count)`
- RPC execute locked to `service_role`
- `CANCELLED_BY_ADMIN` releases promo slots

**Promo hashing:** set `EVENT_PROMO_CODE_PEPPER` (or `PRESALE_CODE_PEPPER`) on Vercel. Table uses `label` (admin display) + `code_hash` (lookup only); plaintext `code` column removed.
