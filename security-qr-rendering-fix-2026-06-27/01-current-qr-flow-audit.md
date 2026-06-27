# 01 — Current QR flow audit

## Shared helpers (`api/_lib/`)

| File | Role |
|------|------|
| `ticket-qr-generate.cjs` | `generateTicketQrPngBuffer`, `generateTicketQrDataUrl` — UUID validation, no token logging |
| `ticket-qr-url.cjs` | `resolveTicketQrUrl`, `buildTicketQrApiUrl`, `maskTokenForLogs` |
| `ticket-qr-route.cjs` | `GET /api/tickets/qr/:secureToken` — dynamic PNG, rate limit |
| `ticket-qr-email.cjs` | CID attachment builders for email |

## API routes

| Path | File | Lines (approx) | Old behavior | Risk |
|------|------|----------------|--------------|------|
| `GET /api/tickets/qr/:token` | `ticket-qr-route.cjs` | 65–100 | Dynamic PNG from token | OK (deployed) |
| `GET /api/admin/order-qr-tickets` | `misc.js` | 4905–5022 | Returned raw `qr_code_url` | **Fixed** → `qr_display_url` |
| Order approve / CTP / resend email | `misc.js` | ~3987, 4492, 5300 | `qr_code_url` in HTML | **Fixed** → CID |
| Invitation create/resend | `misc.js` | ~7145, 7390 | `qr_code_url` in HTML | **Fixed** → CID |
| Ambassador approve email | `admin-approve-order.js` | ~590–770 | `qr_code_url` img | **Fixed** → CID |
| POS approve/resend email | `admin-pos.js` | ~448–680 | `qr_code_url` img | **Fixed** → shared template + CID |
| Invitation details | `misc.js` | 7317 | raw `qr_tickets` | **Fixed** → `qr_display_url` |

## Frontend

| File | Lines | Old | Fixed |
|------|-------|-----|-------|
| `AdminOrderQrTicketsSection.tsx` | 194–205 | `qr_code_url` | `qr_display_url` |
| `OfficialInvitationsList.tsx` | 789–807 | `qr_code_url` | `qr_display_url` / API URL fallback |

## PDF

| File | Lines | Behavior |
|------|-------|----------|
| `render-premium-ticket-pdf.cjs` | 322–328 | Uses `generateTicketQrDataUrl(secure_token)` only |

## Legacy / not production-critical

| File | Notes |
|------|-------|
| `server.cjs` | Local dev monolith; still has `qr_code_url` img tags — Vercel uses `api/*` |
| `src/lib/email.ts` | Client-side ambassador helpers; not ticket delivery path |
| `scripts/create-invitation-qr-tickets.cjs` | One-off script |

## Storage

- `tickets` bucket: **private** (post-migration)
- New tickets store `qr_code_url` as API URL via `buildTicketQrApiUrl` for DB compatibility only
- Display/email ignore legacy Storage URLs
