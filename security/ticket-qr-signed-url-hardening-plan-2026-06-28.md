# Ticket QR Signed URL Hardening Plan — 2026-06-28

## Current flow

1. Order fulfillment generates a UUID `secure_token` per ticket (`randomUuid()`).
2. Email and PDF embed `GET /api/tickets/qr/:secureToken` (via `buildTicketQrApiUrl`).
3. Route handler (`api/_lib/ticket-qr-route.cjs`) validates UUID format, rate-limits by IP, loads ticket via service-role DB, returns PNG encoding the token.
4. Scanner validates by posting `secure_token` to `POST /api/scanner/validate-ticket` (authenticated).

## Risk

Bearer UUID in URL is shareable; anyone with the token can fetch the QR PNG until the ticket is voided. Leak vectors: email forwarding, screenshots, referrer logs, server logs (phase 1 removes token logging).

## Compatibility requirement

**Already issued tickets** must continue to work via existing `/api/tickets/qr/:uuid` links in customer inboxes. Phase 2 must not invalidate outstanding emails without a grace period.

## Phase 1 (implemented 2026-06-28)

- `Cache-Control: no-store, private`
- `Referrer-Policy: no-referrer`
- Generic 400/404 errors
- IP rate limit (60/min)
- No secure_token in server logs

## Proposed signed URL format (phase 2)

```
GET /api/tickets/qr/:secureToken?sig=HMAC-SHA256(token|exp, QR_URL_SIGNING_SECRET)&exp=UNIX
```

- `QR_URL_SIGNING_SECRET` — server-only env (distinct from JWT_SECRET).
- `exp` — short TTL (e.g. 7–30 days for email lifetime, or 24h for re-fetch).
- Legacy URLs without `sig` accepted during migration window (configurable cutoff date).

## Expiry strategy

- **New tickets:** email links include `sig` + `exp`.
- **Old tickets:** honor unsigned URLs until `QR_LEGACY_CUTOFF` (announce 90 days ahead).
- Optional: one-time “refresh link” from order confirmation page (session or email OTP).

## Fallback / migration

1. Deploy signing verification with `QR_REQUIRE_SIGNATURE=false` (log-only).
2. Enable signing on new fulfillment only.
3. Set `QR_LEGACY_CUTOFF` after monitoring 403 rates.
4. Rollback: set `QR_REQUIRE_SIGNATURE=false` — unsigned URLs work again.

## Tests required (phase 2)

- Valid sig + unexpired → 200 PNG
- Invalid sig → 403 generic
- Expired sig → 403 generic
- Legacy unsigned before cutoff → 200
- Legacy unsigned after cutoff → 404

## Operational rollback

Revert env flags; no DB migration required for rollback.
