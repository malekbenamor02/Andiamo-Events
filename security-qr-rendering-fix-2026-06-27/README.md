# Secure QR Rendering Fix — 2026-06-27

## Status

**Code complete (local branch). Production API/frontend not yet deployed with this QR display/email fix.**

Storage migration (private `tickets` bucket) **is applied in production** and must not be rolled back.

## Root cause

After `tickets` bucket privatization, legacy `qr_code_url` values pointing at `/storage/v1/object/public/tickets/...` return 400/403. Admin dashboard and transactional emails still hotlinked those URLs. PDF generation was unaffected because it embeds QR from `secure_token` server-side.

## Fix summary

| Surface | Before | After |
|---------|--------|-------|
| Source of truth | `qr_code_url` (Storage URL) | `secure_token` |
| Admin order QR | `<img src={qr_code_url}>` | `qr_display_url` → `/api/tickets/qr/{token}` |
| Admin invitations | `qr_code_url` | `qr_display_url` from API |
| Emails | hotlinked `qr_code_url` | CID inline PNG from `secure_token` |
| PDF | `secure_token` inline | unchanged |
| Scanner | backend API | unchanged |

## Absolute rules preserved

- `tickets` bucket remains private
- No permanent public Storage QR URLs for display/email
- No service role in frontend
- No full `secure_token` in logs
- RLS unchanged
- No ticket objects deleted

## Evidence files

1. `01-current-qr-flow-audit.md`
2. `02-admin-qr-fix.md`
3. `03-email-cid-qr-fix.md`
4. `04-pdf-qr-verification.md`
5. `05-api-ticket-qr-route.md`
6. `06-database-qr-url-strategy.md`
7. `07-tests-output.md`
8. `08-risk-register.md`
9. `09-deployment-plan.md`
