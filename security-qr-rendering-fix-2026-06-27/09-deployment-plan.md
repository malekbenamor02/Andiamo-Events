# 09 — Deployment plan

## Preconditions

- Storage migration applied (`tickets` private) — **done**
- `npm run security:storage` PASS — **done**
- `npm run build` PASS — **done**

## Deploy steps

1. **Commit** QR rendering changes (API helpers, misc, admin-pos, admin-approve-order, frontend)
2. **Deploy** to Vercel production (`npx vercel --prod` or merge to main)
3. **Do not** revert Storage policies or make `tickets` public

## Smoke tests (production)

1. Super admin → open paid online order → QR images load
2. Resend ticket email to test inbox → QR visible (not broken image)
3. `curl -s -D - -o /tmp/qr.png "https://www.andiamoevents.com/api/tickets/qr/{real-token}"` → 200, `Content-Type: image/png`
4. Scanner app → scan live ticket → validates
5. Open PDF attachment → QR present

## Rollback

- **Code rollback only** if smoke fails
- **Never** rollback Storage privatization
- Legacy `qr_code_url` values remain in DB; safe to redeploy fix forward

## Monitoring

- Watch Vercel function logs for `[ticket-qr]` errors (no token values)
- Check email delivery logs for resend failures
