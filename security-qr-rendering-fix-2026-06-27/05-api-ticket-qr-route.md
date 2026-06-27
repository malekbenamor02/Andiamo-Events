# 05 — API ticket QR route

## Route

`GET /api/tickets/qr/:secureToken`

**Implementation:** `api/_lib/ticket-qr-route.cjs` (registered via `register-storage-security-routes.cjs` / `misc.js`)

## Behavior

| Input | Status | Body |
|-------|--------|------|
| Invalid UUID | 400 | `{"error":"Invalid token"}` |
| Valid UUID, no active ticket | 404 | `{"error":"Not found"}` |
| Valid + active row in `tickets` or `qr_tickets` | 200 | `image/png` buffer |

- QR generated dynamically (not Storage fetch)
- Rate limit: 60 req/min/IP
- No full token in logs

## Response headers (success — **after deploy of cross-origin fix**)

| Header | Value |
|--------|-------|
| Content-Type | `image/png` |
| Cache-Control | `private, max-age=300` |
| Cross-Origin-Resource-Policy | `cross-origin` (code) |
| X-Content-Type-Options | `nosniff` |

## Production probe (2026-06-27, pre QR-fix deploy)

```
GET /api/tickets/qr/not-a-uuid          → 400
GET /api/tickets/qr/00000000-0000-4000-8000-000000000000 → 404
Cross-Origin-Resource-Policy: same-site  (platform default on JSON responses)
```

PNG success responses will include route-level `cross-origin` CORP after deploy.

## Usage

- **Admin browser preview:** primary display URL
- **Email:** do not hotlink; use CID attachments
