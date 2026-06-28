# Supabase MCP Read-Only Security Audit

Date: 2026-06-28  
Project ref: `ykeryyraxmtjunnotoep`  
Auditor: Cursor Agent (Supabase MCP, read-only)  
Scope: Full database/project metadata audit via Supabase MCP — RLS, policies, grants, functions, storage, realtime, extensions, triggers, auth advisors. No code changes, no migrations, no data dumps.  
Read-only confirmation: **Confirmed.** All inspection used MCP `execute_sql` with SELECT-only catalog queries, plus read-only MCP tools (`list_tables`, `list_extensions`, `get_advisors`, `list_migrations`, `get_project`). No DDL/DML, no policy changes, no dashboard changes.

---

## 1. Executive Summary

- **Overall verdict: PARTIAL PASS**
- **Critical findings:** 0 confirmed. Core payment/order/ticket/admin tables use explicit `deny_all` RLS; anon/authenticated cannot read `orders`, `tickets`, `qr_tickets`, `admins`, `ambassadors`, or token columns via policies.
- **High findings:** 4 — client-executable maintenance RPCs; realtime includes sensitive tables; `scans` ambassador INSERT tied to `auth.uid()`; admin/marketing RLS relies on JWT `sub` claim matching `admins.id` without visible session-version gate in policy.
- **Medium findings:** 10 — 25 service-role-only tables with RLS/no policies; `is_service_role()` callable by anon/authenticated; SECURITY DEFINER RPCs with `search_path=public` only; stale `cleanup_old_credentials`; pg_cron/pg_net HTTP jobs; no FORCE RLS; storage `events` bucket has no explicit policies; broad table grants (mitigated by RLS); Postgres patch advisory; auth OTP/leaked-password warnings.
- **Low findings:** 6 — duplicate scan policies; many trigger/helper functions missing fixed `search_path`; intentional public-read reference tables; migration naming/documentation cleanup.
- **Not verified:** Live anon JWT spot checks against REST/RPC; Supabase Auth dashboard settings (redirect URLs, JWT expiry, email confirmation); Edge Function auth; whether admin custom JWT `sub` is ever issued to browser clients; repo script execution (scripts identified only).

---

## 2. Scope Checked

| Area | Status |
|------|--------|
| RLS | Checked all 67 `public` base tables — all have RLS enabled |
| Table grants | Checked `anon`/`authenticated` on `public` + `storage` |
| Column exposure | Metadata inventory of sensitive column names (no values queried) |
| Policies | All 50 `public` + 7 `storage.objects` policies from `pg_policies` |
| Views | None in `public` |
| Materialized views | None in `public` |
| RPC/functions | All `public` + `storage` + `extensions` functions catalogued |
| Function grants | EXECUTE for `anon`/`authenticated` on `public` routines |
| SECURITY DEFINER usage | 33 SECURITY DEFINER functions in `public` |
| search_path safety | Checked via `proconfig` and Supabase security advisor |
| Triggers | 29 triggers on `public` tables |
| Storage buckets | 6 buckets (`storage.buckets`) |
| Storage policies | 7 policies on `storage.objects`; none on `storage.buckets` |
| Auth-related tables/settings | Auth schema metadata; Supabase security advisor auth lints |
| Realtime/publications | `supabase_realtime` publication membership |
| Extensions | Full extension list via MCP |
| Schemas exposed to API | `public`, `storage`, `graphql_public` (standard Supabase) |
| Sensitive column inventory | Built from `information_schema.columns` |
| Admin/security-critical tables | RLS + policies reviewed |
| Migration consistency | 58 applied migrations listed; recent RLS hardening migrations present |
| Existing security scripts | Identified from `package.json` only (not executed) |

**Database metadata**

| Item | Value |
|------|-------|
| Postgres version | 17.4 (Supabase `17.4.1.054`) |
| Region | eu-west-3 |
| MCP DB role | `postgres` (service-level read access for audit) |
| Schemas observed | `auth`, `cron`, `extensions`, `graphql`, `graphql_public`, `net`, `public`, `realtime`, `storage`, `supabase_migrations`, `vault` |
| Public base tables | 67 |
| Public policies | 50 across 41 tables |
| Tables RLS enabled, zero policies | 25 (default deny for API roles) |

---

## 3. Findings Table

| ID | Severity | Area | Finding | Evidence | Risk | Recommended Fix | Status |
|----|----------|------|---------|----------|------|-----------------|--------|
| F-001 | High | RPC grants | `release_order_stock_internal`, `auto_fail_expired_pending_online_orders`, `verify_stock_calculations`, `cleanup_old_credentials` have EXECUTE granted to `anon` and `authenticated` | `information_schema.routine_privileges`; functions are SECURITY INVOKER | Caller could invoke order/stock maintenance RPCs; writes blocked today by `orders_deny_all` RLS but violates least-privilege and breaks if RLS regresses | Revoke EXECUTE from `anon`/`authenticated`; grant only to `service_role` or a dedicated maintenance role; restrict cron caller | Confirmed |
| F-002 | High | Realtime | `supabase_realtime` publishes `orders`, `ambassador_applications`, `career_applications`, `marketing_campaigns`, `marketing_campaign_recipients` | `pg_publication_tables` | If SELECT policies are added incorrectly, private rows could stream to clients | Remove sensitive tables from publication or ensure server-only subscriptions; document admin realtime path | Confirmed |
| F-003 | High | Policies / scans | `scans` allows INSERT/SELECT where `auth.uid()::text = ambassador_id::text` | `pg_policies` on `public.scans` | If ambassador UUIDs ever match Supabase Auth UIDs, clients could forge scan records without scanner RPC | Route scans only through `validate_scanner_ticket_atomic` (service_role); remove or tighten ambassador client policies | Needs review |
| F-004 | High | Policies / admin | Marketing/investor admin policies authorize via `request.jwt.claims ->> 'sub'` matching `admins.id`; `official_invitations` uses `auth.uid() = admins.id` | Policies on `marketing_*`, `investor_contacts`, `official_invitations` | Inconsistent admin identity sources; JWT `sub` spoofing if custom admin JWT reaches browser; invitations policies may be ineffective if admins are not Supabase Auth users | Standardize admin authorization in RLS (server-only) or enforce `session_version`/permission RPC; align `auth.uid()` vs JWT claim usage | Needs review |
| F-005 | Medium | RLS | 25 sensitive tables have RLS enabled but **no policies** (default deny) | Supabase advisor lint `rls_enabled_no_policy`; query on `pg_policies` | Safe today (implicit deny) but confusing for reviewers; easy to misread as “broken” | Add explicit `deny_all` policies for documentation parity (as on `orders`, `admins`) | Confirmed |
| F-006 | Medium | RPC | `public.is_service_role()` is SECURITY DEFINER and EXECUTE granted to `anon`/`authenticated` | Supabase advisor lint; `pg_proc` + routine privileges | Unnecessary attack surface; helper exposed on `/rest/v1/rpc/is_service_role` | Revoke client EXECUTE; keep for internal policy use only | Confirmed |
| F-007 | Medium | Functions | `insert_fulfillment_tickets_locked` and `validate_scanner_ticket_atomic` are SECURITY DEFINER with `search_path = public` only (no `pg_catalog`) | `pg_proc.proconfig` | search_path hijack risk on privileged ticket/fulfillment RPCs | Set `search_path = public, pg_catalog`; keep EXECUTE service_role-only | Confirmed |
| F-008 | Medium | Functions | 20+ public trigger/helper functions lack fixed `search_path` | Supabase advisor `function_search_path_mutable` | Lower risk for INVOKER triggers; elevated if any become SECURITY DEFINER | Add `SET search_path = public, pg_catalog` to mutable functions | Confirmed |
| F-009 | Medium | Functions | `cleanup_old_credentials()` references dropped table `ambassador_credentials` | `pg_get_functiondef`; `to_regclass('public.ambassador_credentials')` is NULL | RPC callable by clients; execution would error; indicates stale surface area | Drop or restrict function; remove client EXECUTE | Confirmed |
| F-010 | Medium | Extensions / cron | `pg_cron` (3 jobs) and `pg_net` installed; jobs invoke HTTP endpoints and `auto_fail_expired_pending_online_orders()` | `cron.job`; extensions list | Compromised DB role could schedule outbound HTTP; cron job 5 uses hardcoded project URL pattern | Review cron job ownership; prefer vault-based URLs (as job 7); restrict cron schema access | Confirmed |
| F-011 | Medium | RLS hardening | No `public` tables use FORCE ROW LEVEL SECURITY (`relforcerowsecurity = false` everywhere) | `pg_class` metadata | Table owner (`postgres`) bypasses RLS — standard on Supabase but reduces defense-in-depth | Consider FORCE RLS on highest-sensitivity tables after confirming service_role paths | Confirmed |
| F-012 | Medium | Grants | `anon`/`authenticated` hold full DML grants on all `public` tables | `information_schema.table_privileges` | Grants alone would allow access without RLS; reliance on RLS is correct but brittle | Optional: REVOKE default privileges and grant minimally; keep RLS as primary control | Confirmed |
| F-013 | Medium | Storage | `events` bucket is private but has **zero** `storage.objects` policies | `storage.buckets`; `pg_policies` | Default deny via RLS — safe, but undocumented; service_role-only uploads expected | Add explicit service_role-only policies for consistency with other buckets | Confirmed |
| F-014 | Medium | Auth config | Supabase advisor: email OTP expiry > 1 hour | `get_advisors` security lint `auth_otp_long_expiry` | Longer OTP window increases takeover risk | Reduce OTP expiry in Auth settings | Not verified (advisor only) |
| F-015 | Medium | Platform | Postgres security patches available for current engine version | Advisor `vulnerable_postgres_version` | Known CVE exposure until upgrade | Schedule Supabase platform upgrade | Confirmed |
| F-016 | Low | Policies | Duplicate overlapping policies on `scans` (`ALL` + `SELECT` for admins) | `pg_policies` | Noise; no direct exposure | Consolidate admin scan policies | Confirmed |
| F-017 | Low | Policies | Intentional `USING (true)` SELECT on reference tables: `cities`, `villes`, `sponsors`, `team_members`, `site_content`, `payment_options` | `pg_policies` | Expected public marketing/reference reads | Document as intentional public-read | False positive / intentional |
| F-018 | Low | Auth config | Leaked password protection disabled (HaveIBeenPwned) | Advisor `auth_leaked_password_protection` | Weaker password hygiene for Auth users | Enable in Supabase Auth dashboard | Not verified (advisor only) |
| F-019 | Low | Functions | Client EXECUTE on slug/QR generators (`generate_qr_id`, `generate_slug`, etc.) | routine privileges | Low direct impact; unnecessary API surface | Revoke if unused from client | Confirmed |
| F-020 | Info | RLS | Critical tables explicitly denied: `orders`, `tickets`, `qr_tickets`, `admins`, `ambassadors`, `order_passes`, `order_logs`, `pos_*`, `presale_*`, `event_promo_*` (no policies = deny) | `pg_policies` + no-policy table list | Correct service-role/server-side access model post `fix_critical_rls_exposure` migration | Maintain; add explicit deny policies on no-policy tables | Confirmed |
| F-021 | Info | Storage | Private buckets (`tickets`, `academy-payment-proofs`, `career-documents`, `events`) limited to `service_role` in policies; public buckets (`hero-images`, `images`) are `public=true` with service_role write-only policies | `storage.buckets` + policies | Public buckets intentionally world-readable via CDN URL; private ticket/payment files not exposed via storage RLS | Keep ticket/payment buckets private; audit public bucket contents periodically | Confirmed |
| F-022 | Info | Migrations | Recent security migrations applied: `fix_critical_rls_exposure`, `fix_storage_bucket_security`, `admin_session_invalidation`, `atomic_scanner_ticket_validation`, `harden_cities_csp_rpc_security*` | `list_migrations` | Indicates active remediation track | Continue migration-based hardening with tests | Confirmed |

---

## 4. Detailed Evidence

### 4.1 RLS posture (public schema)

- **All 67 base tables** have `relrowsecurity = true`. None have RLS disabled.
- **Zero-policy tables (25)** — RLS on with no policies ⇒ implicit deny for `anon`/`authenticated`:
  - Academy: `academy_influencers`, `academy_promo_codes`, `academy_registration_logs`, `academy_registrations`, `academy_settings`
  - Ambassador/session: `ambassador_sessions`
  - Career templates/logs: `career_application_logs`, `career_form_template_fields`, `career_form_templates`
  - Event promo: `event_promo_attempts`, `event_promo_code_pass_discounts`, `event_promo_code_passes`, `event_promo_codes`, `event_promo_order_create_rate`, `event_promo_validate_rate`
  - POS: `pos_audit_log`, `pos_outlets`, `pos_pass_stock`, `pos_users`
  - Presale: `presale_code_attempts`, `presale_code_pass_discounts`, `presale_codes`, `presale_redeem_rate`, `presale_sessions`
  - Other: `scan_system_config`, `users`
- **Explicit deny_all policies** (examples): `orders_deny_all`, `tickets_deny_all`, `qr_tickets_deny_all`, `admins_deny_all`, `ambassadors_deny_all`, `order_passes_deny_all`, `admin_logs_deny_all`, `site_logs_deny_all`, `sms_logs_deny_all`, `fcm_tokens_no_client` (`USING false`).

### 4.2 Payment / order / ticket / QR protection

| Object | RLS | Policy summary | Sensitive columns (metadata) |
|--------|-----|----------------|------------------------------|
| `orders` | ON | `orders_deny_all` (`USING false`) | `user_email`, `user_phone`, `payment_*`, `payment_response_data` |
| `order_passes` | ON | `order_passes_deny_all` | pass linkage to orders |
| `tickets` | ON | `tickets_deny_all` | `secure_token`, `secure_access_token`, `qr_code_url` |
| `qr_tickets` | ON | `qr_tickets_deny_all` | `secure_token`, `buyer_email`, `buyer_phone`, `qr_code_url` |
| `presale_codes` | ON | no policies (deny) | `code_hash` |
| `event_promo_codes` | ON | no policies (deny) | `code_hash` |
| `scanners` | ON | `scanners_service_role_all` only | `password_hash`, `email`, `role` |

**Fulfillment RPCs (service_role path expected):**

- `insert_fulfillment_tickets_locked(p_order_id uuid, p_rows jsonb)` — SECURITY DEFINER, `search_path=public`, **no** client EXECUTE grants observed.
- `validate_scanner_ticket_atomic(...)` — SECURITY DEFINER, `search_path=public`, **no** client EXECUTE grants observed.

### 4.3 Admin / superadmin tables

| Table | RLS | Client access via policies |
|-------|-----|----------------------------|
| `admins` | ON | `admins_deny_all` |
| `admin_logs` | ON | `admin_logs_deny_all` |
| `admin_tab_access` | ON | `admin_tab_access_deny_anon_all` (`false`) |
| `security_audit_logs` | ON | INSERT only when `is_service_role()`; no SELECT for clients |

Password/token columns exist on `admins.password`, `ambassadors.password`, `ambassador_sessions.token_hash`, `pos_users.password_hash`, `scanners.password_hash`, `academy_influencers.password_hash` — all on deny-all or no-policy tables.

### 4.4 App-role data (ambassador / scanner / POS / influencer)

| Domain | Tables | RLS / policy notes |
|--------|--------|-------------------|
| Ambassadors | `ambassadors`, `ambassador_applications`, `ambassador_sessions`, selections | All deny-all or no-policy |
| Scanners | `scanners` | service_role only |
| POS | `pos_users`, `pos_outlets`, `pos_pass_stock`, `pos_audit_log` | no policies (deny) |
| Influencers | `academy_influencers` | no policies (deny); contains `password_hash` |
| Customers / PII intake | `contact_messages`, `newsletter_subscribers`, `phone_subscribers` | anon INSERT only with constraints; no client SELECT |
| Scans | `scans` | Admin via `auth.uid()`; ambassador INSERT/SELECT via `auth.uid()` — see F-003 |

### 4.5 Anon INSERT policies (intentional public forms)

| Table | Policy | WITH CHECK constraint |
|-------|--------|------------------------|
| `contact_messages` | `contact_messages_anon_insert` | `status IS NULL OR status = 'unread'` |
| `newsletter_subscribers` | `newsletter_subscribers_anon_insert` | `import_label IS NULL` |
| `phone_subscribers` | `phone_subscribers_anon_insert` | `import_label IS NULL` |
| `consultation_inquiries` | `consultation_inquiries_deny_anon_insert` | `false` (anon blocked) |
| `aio_events_submissions` | service insert only | `is_service_role()` |
| `csp_reports` | service insert only | `is_service_role()` |
| `security_audit_logs` | service insert only | `is_service_role()` |

### 4.6 Storage

**Buckets**

| Bucket | Public flag | Size limit | Notes |
|--------|-------------|------------|-------|
| `hero-images` | true | 25 MB | MIME restricted to images/video |
| `images` | true | 25 MB | Marketing assets |
| `tickets` | false | 1 MB | PNG only |
| `academy-payment-proofs` | false | 5 MB | image/pdf |
| `career-documents` | false | 10 MB | docs/pdf/images |
| `events` | false | none | **No storage policies defined** |

**`storage.objects` policies:** All 7 policies require `auth.role() = 'service_role'` for named buckets. No anon/authenticated SELECT/INSERT/UPDATE/DELETE policies. Public bucket files remain reachable via public URL when `public=true` (by design).

### 4.7 Realtime

`supabase_realtime` includes:

- `public.orders`
- `public.ambassador_applications`
- `public.career_applications`
- `public.marketing_campaigns`
- `public.marketing_campaign_recipients`

Client subscriptions are still filtered by RLS SELECT policies; sensitive tables currently have no permissive SELECT for anon/authenticated.

### 4.8 SECURITY DEFINER functions (public) — client EXECUTE

Only **`is_service_role()`** among SECURITY DEFINER functions has `anon`/`authenticated` EXECUTE.

Other SECURITY DEFINER RPCs (promo/presale claim/release, admin tab replace, log analytics, ticket validation, fulfillment) show **no** client EXECUTE grants in catalog — expected service_role/server path.

**Notable SECURITY DEFINER with fixed search_path:** most promo/order functions use `public, pg_catalog`. Exceptions: `insert_fulfillment_tickets_locked`, `validate_scanner_ticket_atomic` → `public` only.

### 4.9 Extensions (security-relevant, installed)

| Extension | Version | Schema | Implication |
|-----------|---------|--------|-------------|
| `pg_cron` | 1.6 | pg_catalog | Scheduled jobs; 3 active jobs |
| `pg_net` | 0.14.0 | extensions | Async HTTP from DB |
| `pgcrypto` | 1.3 | extensions | Crypto helpers |
| `uuid-ossp` | 1.1 | extensions | UUID generation |
| `supabase_vault` | 0.3.1 | vault | Secrets storage (used by cron job 7) |
| `pg_graphql` | not installed | — | — |
| `pgsodium` | not installed | — | — |
| `http` | not installed | — | — |
| `dblink` / `postgres_fdw` | not installed | — | — |

### 4.10 Triggers (security-relevant)

Order lifecycle triggers enforce stock release, promo/presale slot release, logging (`log_order_*`), ambassador cancellation — all invoke SECURITY DEFINER trigger functions with `search_path=public, pg_catalog` where definer is set.

No client-invokable trigger bypass observed.

### 4.11 Views / GraphQL

- **0 views** and **0 materialized views** in `public` — no view-based RLS bypass.
- `graphql_public` schema exists (Supabase default) — GraphQL exposure not fully audited via MCP.

### 4.12 Repo security scripts (package.json only — not executed)

| Script | Purpose (from name) |
|--------|---------------------|
| `npm run security:rls` | `scripts/security/check-supabase-rls.mjs` |
| `npm run security:storage` | `scripts/security/check-supabase-storage.mjs` |
| `npm run security:admin-auth` | Admin service-role auth checks |
| `npm run security:public-routes` | Public route service-role checks |
| `npm run security:check` | General security config |
| `npm run test:admin-auth-order` | Admin auth unit tests |
| `npm run test:login-security` | Scanner/ambassador auth tests |
| `npm run test:payment-fulfillment` | Payment/ticket tests |

Additional scripts under `scripts/security/` include `anon-rls-spot-check.mjs`, `storage-anon-spot-check.mjs` — suitable for post-remediation verification (not run in this audit).

---

## 5. Read-Only SQL Used

All queries were SELECT-only against catalog views / metadata.

1. `SELECT current_user, session_user, current_database(), version();`
2. `SELECT schema, name, kind, rls_enabled, force_rls, owner FROM pg_class JOIN pg_namespace ...`
3. `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies ...`
4. `SELECT schema, table_name, rls_enabled, policy_count ...` (RLS without policies)
5. `SELECT table_schema, table_name, grantee, privileges FROM information_schema.table_privileges ...`
6. `SELECT schema, function_name, args, returns, language, security_definer, volatility, owner, search_path FROM pg_proc ...`
7. `SELECT schema, function_name, args, grantee, privilege_type FROM routine_privileges ...`
8. `SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns ...` (sensitive name filter)
9. `SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets;`
10. `SELECT pubname, schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
11. `SELECT schema, view_name, reloptions FROM pg_class ... WHERE relkind IN ('v','m');`
12. `SELECT trigger_name, schema, table_name, pg_get_triggerdef(...) FROM pg_trigger ...`
13. `SELECT pg_get_functiondef(...) FROM pg_proc WHERE proname IN (...);`
14. `SELECT schema, function_name, security_definer, search_path, client_grants ... WHERE prosecdef = true;`
15. `SELECT ... FROM pg_policies WHERE qual = 'true' OR with_check = 'true';`
16. `SELECT object_schema, grantee, privilege_type FROM information_schema.usage_privileges ...`
17. `SELECT jobid, schedule, command FROM cron.job;`
18. `SELECT base_tables, views, matviews counts FROM pg_class ...`
19. `SELECT to_regclass('public.ambassador_credentials'), ...;`
20. `SELECT extname, extversion, schema FROM pg_extension WHERE extname IN (...);`
21. `SELECT nspname FROM pg_namespace ...;`
22. `SELECT count(*) policies, count(DISTINCT tablename) FROM pg_policies WHERE schemaname='public';`
23. `SELECT ... FROM pg_policies WHERE tablename IN (...)` (targeted policy reviews)
24. `SELECT ... FROM pg_class WHERE relrowsecurity = false` (public tables)

**MCP tools (read-only):** `list_projects`, `get_project`, `list_tables` (verbose), `list_extensions`, `get_advisors` (security), `list_migrations`.

---

## 6. Recommended Remediation Plan

**Do not implement in this audit — proposal only.**

### Priority 1 (High — next migration)

1. **`YYYYMMDDHHMMSS_revoke_client_maintenance_rpc_execute.sql`**
   - Revoke EXECUTE on `release_order_stock_internal`, `auto_fail_expired_pending_online_orders`, `auto_reject_expired_pending_cash_orders`, `apply_expiration_to_existing_pending_cash_orders`, `clear_expiration_from_existing_pending_cash_orders`, `verify_stock_calculations`, `cleanup_old_credentials` from `PUBLIC`, `anon`, `authenticated`.
2. **`YYYYMMDDHHMMSS_revoke_client_is_service_role_execute.sql`**
   - Revoke client EXECUTE on `is_service_role()` (keep usage inside policies).
3. **`YYYYMMDDHHMMSS_fix_ticket_rpc_search_path.sql`**
   - Alter `insert_fulfillment_tickets_locked` and `validate_scanner_ticket_atomic` to `SET search_path = public, pg_catalog`.
4. **`YYYYMMDDHHMMSS_review_scans_and_realtime_publication.sql`**
   - Tighten `scans` policies; remove or restrict realtime members for `orders` and application tables.

### Priority 2 (Medium)

5. **`YYYYMMDDHHMMSS_explicit_deny_policies_service_role_tables.sql`** — Add `*_deny_all` policies to 25 zero-policy tables for audit clarity.
6. **`YYYYMMDDHHMMSS_storage_events_bucket_policies.sql`** — Mirror service_role-only pattern for `events` bucket.
7. **`YYYYMMDDHHMMSS_drop_or_fix_cleanup_old_credentials.sql`** — Remove stale function or repoint to current schema.
8. **`YYYYMMDDHHMMSS_function_search_path_hardening.sql`** — Batch fix mutable search_path on public functions (advisor list).
9. Review admin RLS on `marketing_*` / `investor_contacts` / `official_invitations` for custom JWT vs Supabase Auth alignment.

### Priority 3 (Platform / dashboard)

10. Schedule Postgres platform upgrade (advisor patch).
11. Auth dashboard: reduce OTP expiry; enable leaked password protection.
12. Review pg_cron jobs — migrate hardcoded URLs to vault pattern.

### Tests to add / run after remediation

- `npm run security:rls`
- `npm run security:storage`
- `npm run test:admin-auth-order`
- `npm run test:login-security`
- `npm run test:payment-fulfillment`
- Add anon RPC denial tests for revoked functions
- Realtime subscription tests asserting zero rows for anon on `orders`

### Manual dashboard checks (Not verified via MCP)

- Auth → URL configuration / redirect allowlist
- Auth → JWT expiry settings
- Auth → Email confirmation required?
- API → exposed schemas (`public`, `storage` only?)
- Edge Functions → verify service_role/cron secrets on `cron-scan`, `marketing-email-tick`

---

## 7. Final Gate Checklist

| Gate | Result | Notes |
|------|--------|-------|
| All sensitive tables have RLS enabled | **PASS** | 67/67 public base tables |
| No anon DML on sensitive tables | **PASS** | Deny-all or no-policy on orders/tickets/admin/POS/presale/promo |
| No authenticated broad DML without policy controls | **PASS** | Same RLS posture; grants are broad but RLS blocks |
| No public storage bucket exposing private files | **PASS** | Ticket/payment/career buckets private; public buckets are marketing-only by design |
| No unsafe SECURITY DEFINER functions | **PARTIAL PASS** | Most SD functions are service_role-only; `is_service_role()` client-callable; two ticket RPCs have narrow search_path |
| All SECURITY DEFINER functions have safe search_path | **FAIL** | `insert_fulfillment_tickets_locked`, `validate_scanner_ticket_atomic` use `public` only; many INVOKER functions unset |
| RPC EXECUTE grants are restricted | **FAIL** | Maintenance INVOKER RPCs + `is_service_role()` granted to anon/authenticated |
| Views do not bypass RLS unintentionally | **PASS** | No public views |
| Realtime does not expose private tables | **PARTIAL PASS** | Sensitive tables listed in publication; RLS currently blocks client SELECT |
| No exposed tokens/secrets columns through public policies | **PASS** | No SELECT policies on token/password tables |
| Admin/superadmin tables are protected | **PASS** | Explicit deny_all / no-policy |
| Ambassador/scanner/POS/influencer data is protected | **PASS** | Deny-all or service_role-only |
| Payment/order/ticket/QR/token data is protected | **PASS** | Explicit deny_all on core fulfillment tables |

---

*End of read-only audit report. No changes were made to the database, codebase, or Supabase project settings.*
