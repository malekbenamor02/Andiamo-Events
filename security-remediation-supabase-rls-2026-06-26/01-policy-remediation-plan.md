# Policy remediation plan

## Objective

Lock down Row Level Security on production (`ykeryyraxmtjunnotoep`) so the anon/authenticated roles cannot read or mutate privileged data. Public site flows continue via filtered SELECT policies and server-side service role.

## Migration

**File:** `supabase/migrations/20260627120000_fix_critical_rls_exposure.sql`

Consolidates never-applied `20260616000000_harden-admin-privileged-table-rls.sql` plus full P0/P1 coverage.

### Helpers

| Function | Behavior |
|----------|----------|
| `is_admin_user()` | Always `false` (removes legacy bypass) |
| `is_service_role()` | `auth.role() = 'service_role'` only |
| `is_public_listable_event()` | Used in inline events policy |

### P0 — deny all (anon + authenticated)

- `admins`, `orders`, `tickets`, `qr_tickets`

### P1 — deny all except controlled inserts

| Table | Public access after migration |
|-------|------------------------------|
| `contact_messages` | INSERT only |
| `newsletter_subscribers` | INSERT only |
| `phone_subscribers` | INSERT only |
| `ambassadors`, `ambassador_applications` | Deny all (API only) |
| `admin_logs`, `order_logs`, `sms_logs` | Deny all |
| `career_applications`, `audience_suggestions` | Deny all |

### Public read (filtered)

- **events:** `NOT is_test`, `NOT presale_enabled`, `event_status <> cancelled`
- **event_passes:** existing presale-gated SELECT; anon INSERT/UPDATE/DELETE removed
- **site_content**, **sponsors**, **team_members**, **payment_options:** public SELECT unchanged

### Grants

- `REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated`

### Audit fixes

- Replace `role IS NULL` bypass patterns with `is_service_role()`
- Drop policies with `USING (true)` on non-public tables

## Views / RPCs

- Admin login and all privileged reads/writes use **service role** in Vercel API routes only.
- No new public RPCs for admin credential verification (bcrypt stays in Node).

## Rollback

Prefer forward fix via API. Do not restore `USING (true)` policies except emergency with explicit approval.
