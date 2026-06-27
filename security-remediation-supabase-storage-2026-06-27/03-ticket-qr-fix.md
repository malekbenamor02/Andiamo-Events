# Ticket QR Fix (STG-001)

## Old flow

1. Server generates `secureToken` UUID.
2. Renders QR PNG, uploads to **public** `tickets` bucket (`tickets/{orderId}/{token}.png`).
3. Stores `getPublicUrl()` in `tickets.qr_code_url` and emails HTML `<img src="...public...">`.

## New flow

1. Server generates `secureToken`.
2. Stores `qr_code_url = https://www.andiamoevents.com/api/tickets/qr/{secureToken}` via `buildTicketQrApiUrl()`.
3. **No new public storage upload** for ticket QRs.
4. `GET /api/tickets/qr/:secureToken`:
   - UUID validation
   - Rate limit (60/min/IP)
   - Lookup active row in `tickets` or `qr_tickets`
   - Generate PNG on the fly

## Files changed

- `api/_lib/ticket-qr-url.cjs` (new)
- `api/_lib/ticket-qr-generate.cjs` (new)
- `api/_lib/ticket-qr-route.cjs` (new)
- `api/_lib/r2-media.cjs` — `uploadTicketQrToR2OrSupabase` returns API URL
- `api/misc.js`, `api/admin-approve-order.js`, `api/admin-pos.js`, `server.cjs`
- `api/_lib/render-premium-ticket-pdf.cjs` — generates QR from `secure_token` for PDFs
- `vercel.json` — rewrite `/api/tickets/qr/:secureToken` → misc.js

## Email / scanner compatibility

| Consumer | Behavior after deploy |
|----------|----------------------|
| Ticket emails | `<img src="/api/tickets/qr/{token}">` — works while token valid |
| Admin UI | Uses `qr_code_url` from DB (new rows = API URL) |
| Scanner app | Unchanged — validates via `/api/scan` backend, not storage URL |
| Legacy public Supabase URLs | **Stop working** when bucket set private; same token still works via API route |

## Business tradeoff

Security-first: old emailed Supabase/R2 image URLs for existing tickets will 404 after bucket privatization. Customers can still scan QR **if email client cached image**, or use PDF attachment. **Fix-forward:** API route works for all tokens in DB regardless of stored PNG.
