# Supabase MCP Remediation Plan

Date: 2026-06-28  
Source audit: `security/supabase-mcp-readonly-audit-2026-06-28.md`  
Project ref: `ykeryyraxmtjunnotoep`  
Status: **Prepared only — migrations NOT applied to production or linked Supabase project**

---

## Executive summary

This package addresses confirmed findings **F-001 through F-007, F-009, F-013** from the read-only MCP audit. Seven idempotent SQL migration files, one validation SQL file, static unit tests, and extended RLS regression probes were added. **No live database changes were made.**

| Metric | Before (audit) | After (expected post-apply) |
|--------|----------------|-----------------------------|
| Overall verdict | PARTIAL PASS | PASS (DB layer); dashboard items remain |
| High findings open | 4 | 0–1 (F-004 admin JWT RLS unchanged) |
| Client-callable maintenance RPCs | 7 functions | 0 |
| `is_service_role()` client RPC | Callable by anon/authenticated | Blocked; policies use `auth.role()` |
| Sensitive realtime publication | 5 tables | 0 tables |
| Scans client INSERT path | Ambassador `auth.uid()` policies | service_role only |
| Zero-policy sensitive tables | 26 implicit deny | Explicit `*_deny_all` |
| Events storage policies | 0 | 1 service_role policy |

---

## Findings addressed

| ID | Finding | Migration | Addressed |
|----|---------|-----------|-----------|
| F-001 | Maintenance RPCs executable by anon/authenticated | `20260628120000_revoke_client_maintenance_rpc_execute.sql` | Yes |
| F-002 | Sensitive tables in `supabase_realtime` | `20260628120300_restrict_sensitive_realtime_publication.sql` | Yes |
| F-003 | Scans ambassador INSERT via `auth.uid()` | `20260628120400_tighten_scans_rls.sql` | Yes |
| F-005 | 26 tables RLS with no explicit policies | `20260628120500_add_explicit_deny_policies_to_sensitive_tables.sql` | Yes |
| F-006 | `is_service_role()` client RPC exposure | `20260628120100_harden_is_service_role_execute.sql` | Yes |
| F-007 | Ticket RPCs missing `pg_catalog` in search_path | `20260628120200_harden_security_definer_search_path.sql` | Yes |
| F-009 | Stale `cleanup_old_credentials()` | Revoke in maintenance migration (drop deferred) | Partial |
| F-013 | Events bucket without storage policies | `20260628120600_harden_events_storage_bucket_policies.sql` | Yes |

### Not addressed in this package (documented)

| ID | Finding | Reason |
|----|---------|--------|
| F-004 | Admin/marketing RLS via JWT `sub` | Needs product/auth architecture decision; admin uses custom JWT + server API |
| F-008 | 20+ INVOKER functions missing search_path | Out of scope; lower risk; separate batch migration recommended |
| F-010 | pg_cron / pg_net HTTP jobs | Operational review; not SQL migration |
| F-011 | FORCE RLS | Requires service_role path verification across all owners |
| F-012 | Broad table grants | RLS remains primary control; optional follow-up |
| F-014–F-018 | Auth dashboard / Postgres patch | Manual Supabase dashboard / platform upgrade |
| F-019 | Client EXECUTE on slug/QR helpers | Low priority; separate revoke migration |

---

## Migration files created

| File | Purpose |
|------|---------|
| `supabase/migrations/20260628120000_revoke_client_maintenance_rpc_execute.sql` | Revoke client EXECUTE on 7 maintenance functions |
| `supabase/migrations/20260628120100_harden_is_service_role_execute.sql` | Inline `auth.role()` in policies; revoke client RPC on helper |
| `supabase/migrations/20260628120200_harden_security_definer_search_path.sql` | Fix search_path on ticket RPCs |
| `supabase/migrations/20260628120300_restrict_sensitive_realtime_publication.sql` | Drop 5 sensitive tables from realtime |
| `supabase/migrations/20260628120400_tighten_scans_rls.sql` | service_role-only scans access |
| `supabase/migrations/20260628120500_add_explicit_deny_policies_to_sensitive_tables.sql` | Explicit deny-all on 26 tables |
| `supabase/migrations/20260628120600_harden_events_storage_bucket_policies.sql` | service_role-only events bucket |

Supporting files:

| File | Purpose |
|------|---------|
| `security/supabase-remediation-validation-2026-06-28.sql` | Post-apply SELECT-only validation |
| `api/_lib/supabase-remediation-migrations.test.cjs` | Static migration package tests |
| `scripts/security/check-supabase-rls.mjs` | Extended anon RPC / scans / ticket probes |

---

## Exact SQL changes proposed

### 1. `20260628120000_revoke_client_maintenance_rpc_execute.sql`

For each existing function signature:

- `release_order_stock_internal(uuid)`
- `auto_fail_expired_pending_online_orders()`
- `auto_reject_expired_pending_cash_orders()`
- `apply_expiration_to_existing_pending_cash_orders()`
- `clear_expiration_from_existing_pending_cash_orders()`
- `verify_stock_calculations()`
- `cleanup_old_credentials()`

```sql
REVOKE ALL ON FUNCTION public.<signature> FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.<signature> TO service_role;
```

Guarded by `to_regprocedure()` — skips missing functions (e.g. `cleanup_old_credentials` if absent).

**pg_cron job 2** (`auto_fail_expired_pending_online_orders`) runs as database superuser — unaffected.

### 2. `20260628120100_harden_is_service_role_execute.sql`

Recreates service-insert policies with `auth.role() = 'service_role'` instead of `is_service_role()` on:

- `csp_reports`
- `aio_events_submissions`
- `security_audit_logs`
- `investor_contacts` (service_role policy only)
- `marketing_campaigns` (service_role policy only)
- `marketing_campaign_recipients` (service_role policy only)

Then:

```sql
REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO service_role;
```

**RLS safety:** Prior migration `20260627150000` re-granted `is_service_role` to anon for policy evaluation. This package **removes that dependency** by inlining `auth.role()`, so revoking client EXECUTE does not break INSERT denial on `csp_reports` / `aio_events_submissions` / `security_audit_logs`.

### 3. `20260628120200_harden_security_definer_search_path.sql`

```sql
ALTER FUNCTION public.insert_fulfillment_tickets_locked(uuid, jsonb)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.validate_scanner_ticket_atomic(text, uuid, uuid, text, text)
  SET search_path = public, pg_catalog;
```

### 4. `20260628120300_restrict_sensitive_realtime_publication.sql`

Idempotent `ALTER PUBLICATION supabase_realtime DROP TABLE public.<table>` for:

- `orders`
- `ambassador_applications`
- `career_applications`
- `marketing_campaigns`
- `marketing_campaign_recipients`

### 5. `20260628120400_tighten_scans_rls.sql`

Drops legacy ambassador/admin scan policies; creates single `scans_service_role_all` matching `scanners` table pattern.

**Code impact:** All scan writes already use service_role in `server.cjs`, `api/scan.js`, `lib/scanner-supervisor-handlers.cjs`, and `validate_scanner_ticket_atomic`. No app code changes required.

### 6. `20260628120500_add_explicit_deny_policies_to_sensitive_tables.sql`

Creates `<table>_deny_all` (`USING (false) WITH CHECK (false)`) on 26 tables when table exists and no policies present.

### 7. `20260628120600_harden_events_storage_bucket_policies.sql`

```sql
CREATE POLICY "Service role manage events assets" ON storage.objects
  FOR ALL
  USING (bucket_id = 'events' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'events' AND auth.role() = 'service_role');
```

---

## Rollback SQL (apply only if reverting)

> Run on staging first. Order: reverse migration sequence.

### Rollback `20260628120600` (events storage)

```sql
DROP POLICY IF EXISTS "Service role manage events assets" ON storage.objects;
```

### Rollback `20260628120500` (explicit deny policies)

```sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academy_influencers','academy_promo_codes','academy_registration_logs',
    'academy_registrations','academy_settings','ambassador_sessions',
    'career_application_logs','career_form_template_fields','career_form_templates',
    'event_promo_attempts','event_promo_code_pass_discounts','event_promo_code_passes',
    'event_promo_codes','event_promo_order_create_rate','event_promo_validate_rate',
    'pos_audit_log','pos_outlets','pos_pass_stock','pos_users',
    'presale_code_attempts','presale_code_pass_discounts','presale_codes',
    'presale_redeem_rate','presale_sessions','scan_system_config','users'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_deny_all', t);
  END LOOP;
END $$;
```

### Rollback `20260628120400` (scans)

Re-apply policies from `20250802000000-create-scans-table.sql` / `20250131000000-fix-rls-performance-and-security.sql` if needed, or leave implicit deny by dropping service policy only:

```sql
DROP POLICY IF EXISTS "scans_service_role_all" ON public.scans;
```

### Rollback `20260628120300` (realtime)

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambassador_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.career_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_campaign_recipients;
```

### Rollback `20260628120200` (search_path)

```sql
ALTER FUNCTION public.insert_fulfillment_tickets_locked(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.validate_scanner_ticket_atomic(text, uuid, uuid, text, text) SET search_path = public;
```

### Rollback `20260628120100` (is_service_role)

Restore policies from `20260627150000_harden_cities_csp_rpc_security.sql` and:

```sql
GRANT EXECUTE ON FUNCTION public.is_service_role() TO anon, authenticated, service_role;
```

### Rollback `20260628120000` (maintenance RPCs)

```sql
-- Per function that exists:
GRANT EXECUTE ON FUNCTION public.<signature> TO anon, authenticated, service_role;
```

---

## Realtime / frontend dependency analysis

| Table removed from realtime | Client subscription found | Impact after apply |
|----------------------------|---------------------------|-------------------|
| `orders` | **No** — removed in Dashboard (comment: RLS Wave B) | None |
| `ambassador_applications` | **No** — removed in Dashboard | None |
| `career_applications` | **Yes** — `src/pages/admin/Dashboard.tsx`, `src/pages/admin/components/CareerTab.tsx` | Live postgres_changes notifications stop; **15s polling in CareerTab still runs**; Dashboard push notifications for new applications stop until migrated to admin API webhook/polling |
| `marketing_campaigns` | **No** client subscription found | None |
| `marketing_campaign_recipients` | **No** | None |

**Recommendation before production apply:** Accept reduced realtime UX for career applications, or add admin API polling/websocket in a follow-up PR (not included here per scope rules).

Other realtime subscriptions (unaffected): `site_content`, `academy_settings` (Application.tsx), sales settings, maintenance mode.

---

## `cleanup_old_credentials()` analysis

| Check | Result |
|-------|--------|
| Repo code references | **None** (only audit docs) |
| SQL migrations defining function | **None** in current `supabase/migrations/` |
| pg_cron usage | **No** — cron jobs: online order fail, marketing email tick, cron-scan |
| Live DB (audit) | Function exists; references dropped `ambassador_credentials` table |

**Action taken:** Include in maintenance REVOKE migration (guarded). **Drop deferred** to separate migration after confirming absence in production via `to_regprocedure`.

---

## Tests added / updated

| Test | Type | Description |
|------|------|-------------|
| `npm run test:supabase-remediation` | Static (no DB) | Validates migration files exist and contain expected patterns |
| `scripts/security/check-supabase-rls.mjs` | Live (needs env) | Added blocked RPCs, scans INSERT probe, tickets.secure_token probe |

### Tests run

| Command | Result |
|---------|--------|
| `npm run test:supabase-remediation` | **PASS** (15/15 static tests) |

### Tests not run (migrations not applied)

| Command | Why skipped |
|---------|-------------|
| `npm run security:rls` | Requires live Supabase; new RPC blocks fail until migrations applied |
| `npm run security:storage` | Live HTTP checks; events policy not yet in DB |
| `npm run security:admin-auth` | Live checks |
| `npm run security:public-routes` | Live checks |
| `npm run test:admin-auth-order` | Unrelated unit tests; not re-run |
| `npm run test:login-security` | Unrelated unit tests; not re-run |
| `npm run test:payment-fulfillment` | Unrelated unit tests; not re-run |
| `security/supabase-remediation-validation-2026-06-28.sql` | Manual post-apply on staging |

**Post-apply verification checklist:**

1. Apply migrations to **staging** only (`supabase db push` or dashboard SQL — not run in this task)
2. Run `security/supabase-remediation-validation-2026-06-28.sql` in SQL editor
3. Run `npm run security:rls` and `npm run security:storage`
4. Smoke-test scanner validate-ticket flow and admin career applications list
5. Confirm career application notifications still acceptable (polling fallback)

---

## Manual Supabase Dashboard actions still needed

| Action | Finding |
|--------|---------|
| Reduce email OTP expiry to ≤ 1 hour | F-014 |
| Enable leaked password protection (HaveIBeenPwned) | F-018 |
| Schedule Postgres platform upgrade (`17.4.1.054` patches) | F-015 |
| Verify Auth redirect URL allowlist | Not verified in audit |
| Verify JWT expiry settings | Not verified |
| Verify Edge Function auth for `cron-scan`, `marketing-email-tick` | F-010 |
| Review pg_cron job 5 hardcoded project URL → vault pattern | F-010 |

---

## Unresolved items / needs product decision

1. **F-004 Admin JWT RLS** — `marketing_*` / `investor_contacts` admin policies use `request.jwt.claims ->> 'sub'`. Standardize on server-only access or add `session_version` gate.
2. **Career applications realtime UX** — After publication drop, restore notifications via admin API or re-add publication with strict RLS + service_role-only subscription (not possible from browser).
3. **DROP `cleanup_old_credentials()`** — After REVOKE confirmed in staging, optional `20260628120700_drop_cleanup_old_credentials.sql`.
4. **F-008 Batch search_path** — Separate migration for INVOKER trigger functions flagged by advisor.
5. **F-019 Revoke slug/QR generator RPCs** — If unused from client.

---

## Risk level summary

| Area | Before | After (expected) |
|------|--------|------------------|
| RPC attack surface | High — maintenance + helper RPCs callable | Low — service_role / cron only |
| Realtime data leak if RLS regresses | Medium — 5 sensitive tables published | Low — removed from publication |
| Scan forgery | Medium — ambassador INSERT policy | Low — service_role only |
| Policy clarity | Medium — implicit deny | Low — explicit deny_all |
| Storage events bucket | Low (implicit deny) | Low — explicit service_role policy |
| Auth/platform config | Medium | Unchanged (manual) |

---

## Apply instructions (for operators — do not run blindly)

1. **Review** this plan and migration SQL in PR.
2. **Apply to staging** first; never directly to production from this package without staging pass.
3. **Do not** run `supabase db push` against production until staging validation passes.
4. Run validation SQL + `npm run security:rls` + scanner smoke test on staging.
5. Deploy app code is **not required** for these migrations (except optional career notification UX follow-up).
6. Promote to production in maintenance window.

---

**Confirmation: No migrations were applied. No production database, dashboard settings, or live data were modified during preparation of this package.**
