# Production Deployment Plan

## Preconditions

- [ ] Owner approves this remediation branch
- [ ] `npm run build` passes
- [ ] `npm run test:login-security` passes
- [ ] `npm run security:rls` passes
- [ ] Migration SQL reviewed

## Steps

### 1. Deploy application code

Deploy branch `security/fix-login-systems-auth-hardening` to Vercel (preview first recommended).

Verify env:

- `SUPABASE_SERVICE_ROLE_KEY` set (required)
- `JWT_SECRET` set
- `AMBASSADOR_SESSION_PEPPER` set
- Do **not** set `ALLOW_DEV_ANON_FALLBACK` in production

### 2. Apply database migration

Apply `20260627180000_atomic_scanner_ticket_validation.sql` via Supabase migration pipeline.

Verify:

```sql
SELECT proname FROM pg_proc WHERE proname = 'validate_scanner_ticket_atomic';
SELECT indexname FROM pg_indexes WHERE indexname = 'scans_one_valid_per_qr_ticket_idx';
```

### 3. Post-deploy smoke tests (no PII logging)

| Test | Method | Pass criteria |
|------|--------|---------------|
| validate-ticket no cookie | POST empty | 401 |
| scanner login empty body | POST | 400 |
| scan-system-status | GET | 200 `{enabled:...}` |
| admin scanners no cookie | GET | 401 |
| ambassador me no cookie | GET | 401 |

Functional (staging/test scanner account):

- Valid scan → `result: valid`
- Rescan → `already_scanned`
- Deactivated scanner → 401 on validate

### 4. Monitor

- Vercel function logs for `validate_scanner_ticket_atomic RPC error`
- 503 spikes on scanner/POS (config regression)

## Rollback / fix-forward

- **Code rollback:** Revert Vercel deployment to prior release (validate-ticket falls back to old JS logic if migration not relied upon — prefer keeping migration)
- **Migration:** Do not drop RLS. Fix-forward with new SQL if RPC bug found.
- **Do not** weaken RLS or storage policies to fix issues.

## Production status

**Not deployed** as of evidence generation date.
