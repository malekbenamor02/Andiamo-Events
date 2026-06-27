# Migrations

## New migration

**File:** `supabase/migrations/20260627180000_atomic_scanner_ticket_validation.sql`

### Contents

1. **Partial unique index** `scans_one_valid_per_qr_ticket_idx`  
   `UNIQUE (qr_ticket_id) WHERE scan_result = 'valid' AND qr_ticket_id IS NOT NULL`

2. **Function** `public.validate_scanner_ticket_atomic(...)`  
   - SECURITY DEFINER, `search_path = public`
   - Row lock on ticket
   - Atomic status update + scan insert
   - Returns JSONB result codes: `valid`, `already_used`, `wrong_event`, `not_found`, `error`

3. **Grants**  
   - REVOKE from PUBLIC, anon, authenticated  
   - GRANT EXECUTE to service_role only

### Rollback / fix-forward

- **Do not drop RLS policies**
- Fix-forward only: if RPC needs change, create new migration altering function
- Index can remain; dropping it would re-open race window

### Apply

```bash
supabase db push
# or apply via Supabase dashboard SQL editor in maintenance window
```

**Critical:** Apply migration **before** or **with** code deploy that calls `validate_scanner_ticket_atomic`. If code deploys first without migration, validate-ticket returns 500 until migration applied.
