# 02 — Admin QR fix

## Backend: `GET /api/admin/order-qr-tickets`

**File:** `api/misc.js` (~4958–5021)

- Loads `secure_token` from `qr_tickets` or `tickets`
- Returns `qr_display_url: resolveTicketQrUrl(secure_token)` for each row
- Keeps `qr_code_url` as legacy metadata only
- Auth: super_admin only (unchanged)

## Backend: invitation details

**File:** `api/misc.js` (~7311–7321)

- Maps `qr_tickets` with `qr_display_url` per row

## Frontend

**`AdminOrderQrTicketsSection.tsx`**

```tsx
<img src={t.qr_display_url} />
```

Unavailable state when `secure_token` missing.

**`OfficialInvitationsList.tsx`**

Uses `qr.qr_display_url` or `API_ROUTES.TICKET_QR(secure_token)`.

## Acceptance

- Legacy rows with dead Storage `qr_code_url` render via API URL when `secure_token` present
- New orders same path
- Broken Storage URL no longer used for `<img src>`

## Manual test (post-deploy)

1. Super admin → Online order detail → QR section shows images
2. Ambassador order detail → same
3. POS order detail (dark theme) → same
4. Official invitation detail → QR grid loads
