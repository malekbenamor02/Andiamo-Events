# 06 — Database `qr_code_url` strategy

## Decision

**No urgent backfill migration.**

| Column | Role going forward |
|--------|-------------------|
| `secure_token` | Source of truth for QR rendering |
| `qr_code_url` | Legacy metadata; deprecated for display/email |

## New tickets

- `qr_code_url` set to `https://www.andiamoevents.com/api/tickets/qr/{secure_token}` via `buildTicketQrApiUrl` for backward compatibility with any external integrations reading the column
- No new public Storage URLs written

## Existing rows

- Legacy Storage URLs remain in DB but are **not** used for admin `<img>` or email `<img>`
- Rendering resolves from `secure_token` at runtime

## Optional future backfill (not in scope)

If desired later:

```sql
-- Example only — do not run without backup and review
UPDATE tickets SET qr_code_url = 'https://www.andiamoevents.com/api/tickets/qr/' || secure_token::text
WHERE qr_code_url LIKE '%/object/public/tickets/%';
```

Same pattern for `qr_tickets`. Script must not log tokens.

## RLS / Storage

No policy changes. `tickets` bucket stays private.
