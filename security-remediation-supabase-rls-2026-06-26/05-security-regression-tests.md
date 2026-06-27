# Security regression tests

## Script: `scripts/security/check-supabase-rls.mjs`

**npm:** `npm run security:rls`

### Environment

Reads (never logs secrets):

- `VITE_SUPABASE_URL` or `SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` or `SUPABASE_ANON_KEY`

Loads `.env` / `.env.local` if present.

### Private tables (expect deny or count 0)

`admins`, `orders`, `tickets`, `qr_tickets`, `ambassadors`, `ambassador_applications`, `contact_messages`, `newsletter_subscribers`, `phone_subscribers`, `sms_logs`, `order_logs`, `admin_logs`, `career_applications`, `audience_suggestions`, `order_passes`

### Public events filter

SELECT on `events` must not return rows where:

- `is_test = true`
- `presale_enabled = true`
- `event_status = cancelled`

### Exit code

- `0` — all checks pass
- `1` — any private read succeeded with rows, or events filter violated

## SQL verification

See [`verification.sql`](verification.sql) for read-only policy/grant audit in SQL editor.

## Existing checks

```bash
npm run build
npm run lint
npm test
```

## Optional INSERT smoke (local)

After migration on local stack:

1. Contact form → `contact_messages` row created
2. Newsletter footer → `newsletter_subscribers` row created
3. Anon SELECT on those tables still fails
