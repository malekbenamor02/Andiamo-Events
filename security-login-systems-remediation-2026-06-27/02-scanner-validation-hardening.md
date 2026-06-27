# Scanner Validation Hardening

## Design

### DB revalidation (`requireScannerAuthWithDb`)

1. Verify `scannerToken` JWT (`type === 'scanner'`, `scannerId` present)
2. Load `scanners` row by `scannerId` via service role
3. Reject if missing, `is_active = false`, or ID mismatch
4. **Role from DB** (`scanner` | `supervisor`), not stale JWT `scannerRole`
5. On inactive/missing: clear cookie, return 401

Applied to all scanner-authenticated routes in `api/scan.js`.

### Atomic validation

PostgreSQL function `validate_scanner_ticket_atomic`:

- Row-locks `qr_tickets` by `secure_token` (`FOR UPDATE`)
- Handles: not_found, wrong_event, already_used, valid
- Updates `ticket_status` to `USED` only when still `VALID`
- Inserts into `scans` with appropriate `scan_result`
- Partial unique index: one `valid` scan per `qr_ticket_id`

**Grants:** `EXECUTE` to `service_role` only (revoked from `PUBLIC`, `anon`, `authenticated`).

### API mapping

`api/_lib/scanner-validate-ticket.cjs` calls RPC and maps JSON to existing scanner UI response shape (including invitation fields).

## Files changed

| File | Change |
|------|--------|
| `api/scan.js` | Uses helpers; atomic validate route |
| `api/_lib/scanner-auth.cjs` | DB-backed auth |
| `api/_lib/scanner-validate-ticket.cjs` | RPC wrapper + response builder |
| `supabase/migrations/20260627180000_atomic_scanner_ticket_validation.sql` | Function + index |

## Tests

- `api/_lib/scanner-auth.test.cjs` — inactive scanner, stale JWT role
- Manual post-deploy: first scan valid, second already_scanned, concurrent scan single valid
