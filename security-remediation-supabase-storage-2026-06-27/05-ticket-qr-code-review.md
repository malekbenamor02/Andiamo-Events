# Ticket / invitation QR code review

## Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| No `getPublicUrl` for ticket QR / invitation QR in API flows | **PASS** | `git grep getPublicUrl` in `api/misc.js`, `api/admin-approve-order.js`, `api/admin-pos.js`, `api/_lib/r2-media.cjs`, `server.cjs` — no matches |
| QR access uses backend route | **PASS** | `GET /api/tickets/qr/:secureToken` in `api/_lib/ticket-qr-route.cjs`, registered via `register-storage-security-routes.cjs` + `vercel.json` rewrite |
| Route validates `secure_token` (UUID) | **PASS** | `isValidSecureToken()` in `api/_lib/ticket-qr-url.cjs`; invalid → 400 |
| Route does not sign arbitrary paths | **PASS** | PNG generated on-the-fly from validated token; no `createSignedUrl` or user-supplied storage path |
| `secure_token` is not logged | **PASS** | Errors log `[ticket-qr] generate failed` / `route error` with `e.message` only — no token in log lines |
| Old public Storage URLs expected to stop working | **PASS** (after migration) | Migration sets `tickets.public = false`; drops `Public can view ticket QR codes`. Legacy rows use `resolveTicketQrUrl()` to prefer API URL when token known |

## Implementation summary

- **New tickets:** `buildTicketQrApiUrl(secureToken)` → `https://{site}/api/tickets/qr/{uuid}` stored in `qr_code_url` (no Storage upload for new flows via `uploadTicketQrToR2OrSupabase`).
- **Route behavior:** DB lookup in `tickets` / `qr_tickets`; void/cancelled → 404; rate limit 60 req/min/IP; returns PNG with `Cache-Control: private`.
- **Legacy:** `resolveTicketQrUrl()` still falls back to stored URL for old rows until emails/cache expire; after bucket private, legacy public URLs return non-200.

## Residual notes

- `scripts/create-invitation-qr-tickets.cjs` and `scripts/reupload-optimize-current-media.cjs` are ops scripts; latter still uses `getPublicUrl` for media reupload — **not** in ticket purchase/email path.
- ~1,431 legacy PNG objects remain in private bucket (orphan storage; optional cleanup later).
