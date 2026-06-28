# Supabase Post-Remediation Validation

Date: 2026-06-28  
Project ref: `ykeryyraxmtjunnotoep`  
Scope: Validate applied security remediations, attempt migration-history repair for events storage only, run regression tests. **No new security changes. No SQL re-execution of events storage migration.**

---

## 1. Summary

- **Overall result: PARTIAL PASS**
- **Production DB mutated in this step:** No (read-only validation + CLI repair attempted; repair did not connect)
- **Migration history repaired:** No (Supabase CLI blocked — database password not available locally)
- **Remaining risks:**
  - Local migration filenames (`20260628120000`–`20260628120600`) do not match remote `schema_migrations` versions (`20260628115239`–`20260628115259`) for the six MCP-applied migrations; only events storage (`20260628120600`) is missing from remote history entirely.
  - Events storage policy `COMMENT ON POLICY` from local file was not applied live (metadata-only drift).
  - `npm run security:admin-auth` reports 20 heuristic static findings in `api/misc.js` (pre-existing pattern scan, not introduced by this remediation).
  - Career applications realtime subscriptions remain in frontend but publication no longer includes `career_applications` — live push notifications stopped; 15s polling remains.
  - Manual Supabase dashboard items still open (OTP expiry, leaked-password protection, Postgres patch).

---

## 2. Migration History

### Local events storage migration

| Field | Value |
|-------|-------|
| **Filename** | `supabase/migrations/20260628120600_harden_events_storage_bucket_policies.sql` |
| **Timestamp** | `20260628120600` |
| **Exists locally** | Yes |

### SQL vs live policy comparison

| Aspect | Local migration | Live database | Match |
|--------|-----------------|---------------|-------|
| Policy name | `Service role manage events assets` | `Service role manage events assets` | Yes |
| Command | `FOR ALL` | `ALL` | Yes |
| USING | `bucket_id = 'events' AND auth.role() = 'service_role'` | `(bucket_id = 'events') AND (auth.role() = 'service_role')` | Yes (equivalent) |
| WITH CHECK | Same as USING | Same as USING | Yes |
| COMMENT ON POLICY | Present | **Not set** (`policy_comment = null`) | Partial |

**Idempotent:** Yes — `DROP POLICY IF EXISTS` then `CREATE POLICY`.

**Would fail if run again via MCP `apply_migration`:** Yes — prior apply failed with `must be owner of relation objects` (`storage.objects` owned by `supabase_storage_admin`). Policy was applied successfully via MCP `execute_sql` as `postgres`.

**Safe to mark applied without re-execute:** Yes — live policy matches the security-relevant DDL; only comment metadata differs.

### Remote migration history (MCP read-only)

**Before repair attempt** — versions ≥ `20260628110000` in `supabase_migrations.schema_migrations`:

| Version | Name |
|---------|------|
| `20260628115239` | `revoke_client_maintenance_rpc_execute` |
| `20260628115246` | `harden_is_service_role_execute` |
| `20260628115247` | `harden_security_definer_search_path` |
| `20260628115248` | `restrict_sensitive_realtime_publication` |
| `20260628115257` | `tighten_scans_rls` |
| `20260628115259` | `add_explicit_deny_policies_to_sensitive_tables` |

**Missing from remote:** `20260628120600` (`harden_events_storage_bucket_policies`)

**Local-only timestamps (all 7 local files):** Query confirms **7/7** local timestamps (`20260628120000`–`20260628120600`) are absent from remote `schema_migrations`. Remote holds equivalent migrations under different MCP-generated timestamps for the first six; events storage has no row.

### Repair attempt

| Item | Result |
|------|--------|
| Command attempted | `supabase migration repair --status applied 20260628120600` |
| CLI `supabase migration list` | Blocked — prompts for database password |
| SQL re-executed | **No** |
| Repair completed | **No** — requires DB password (not in `.env` / `.env.local`) |

**Operator action to complete repair (no SQL re-run):**

```bash
supabase migration repair --status applied 20260628120600
```

Optional follow-up: align local filenames with remote MCP timestamps or repair all seven local timestamps if using `supabase db push` from repo.

---

## 3. Security Validation Results

| Check | Result | Evidence |
|-------|--------|----------|
| anon/authenticated EXECUTE on maintenance RPCs | **PASS** | MCP SQL: 0 grant rows for 8 function names × client roles |
| anon/authenticated EXECUTE on `is_service_role()` | **PASS** | MCP SQL: 0 grant rows; `security:rls` rpc blocked (42501) |
| `insert_fulfillment_tickets_locked` search_path | **PASS** | `public, pg_catalog` |
| `validate_scanner_ticket_atomic` search_path | **PASS** | `public, pg_catalog` |
| Sensitive tables removed from realtime | **PASS** | MCP SQL: 0 rows for 5 table names in `supabase_realtime` |
| `scans` policy tightened | **PASS** | Only `scans_service_role_all`; anon INSERT denied (42501) |
| Explicit deny on 26 remediation tables | **PASS** | MCP SQL: `deny_all_on_remediation_tables = 26` |
| Events storage policy exists | **PASS** | `Service role manage events assets` on `storage.objects` |
| No public SELECT on token/ticket tables | **PASS** | MCP SQL: 0 permissive SELECT policies on orders/tickets/qr_tickets/admins/ambassadors |
| Private table anon access (RLS) | **PASS** | `npm run security:rls` — all private tables deny-all confirmed via policy audit |
| Anon RPC surface reduced | **PASS** | All 14 probed RPCs blocked including maintenance + ticket RPCs |
| Storage bucket visibility | **PASS** | tickets/career/academy/events/events private; hero-images/images public |
| Storage anon upload/delete | **PASS** | `npm run security:storage` 13/13 PASS |
| Policy audit (service role) | **PASS** | No permissive sensitive policies; no anon SECURITY DEFINER executables |

---

## 4. Test Results

| Command | Result | Notes |
|---------|--------|-------|
| `npm run test:supabase-remediation` | **PASS** | 15/15 static migration tests |
| `npm run test:login-security` | **PASS** | 16/16 scanner/ambassador auth unit tests |
| `npm run test:payment-fulfillment` | **PASS** | Fulfillment + ticket QR unit tests |
| `npm run test:admin-auth-order` | **PASS** | 70/70 admin auth/order unit tests |
| `npm run security:rls` | **PASS** | Live anon + service-role policy audit |
| `npm run security:storage` | **PASS** | 13 PASS, 0 FAIL |
| `npm run security:admin-auth` | **FAIL** | 20 heuristic static findings in `api/misc.js` / `admin-missing-routes-http.js` (pre-existing; not remediation regression) |
| `npm run security:public-routes` | **PASS** | No `select(*)` on sensitive tables in public routes |
| `supabase migration list` | **NOT RUN** | CLI requires database password |
| `supabase migration repair` | **NOT RUN** | Blocked — same password prompt |

**Env vars used (names only):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — all present for live scripts. No `SUPABASE_DB_PASSWORD` / `DATABASE_URL` for CLI repair.

---

## 5. Smoke-Test Results

| Flow | Result | Notes |
|------|--------|-------|
| Scanner validation | **PASS** | `api/_lib/scanner-validate-ticket.cjs` calls `validate_scanner_ticket_atomic` via trusted `db` (service-role path); anon RPC blocked (42501); scan inserts in `server.cjs`/`api/scan.js` use service-role client |
| Admin dashboard | **PASS** | Admin data via `/api/admin/*` with cookie auth + service-role backend; unit tests confirm auth-before-DB order; orders/tickets not client-readable (RLS deny-all) |
| Career applications polling | **PASS** | `CareerTab.tsx`: `setInterval(loadApplications, 15000)` + `fetchAdminCareerDomain`; realtime channel still subscribed but publication drop means postgres_changes will not fire — polling is the active fallback |
| Ambassador dashboard | **PASS** | `ambassador/Dashboard.tsx` loads via ambassador API routes (not direct Supabase on sensitive tables); ambassadors use custom session auth, not Supabase Auth UID for scans |
| Storage access | **PASS** | Private buckets non-public; anon upload/delete blocked; public hero/images buckets remain public-read by design |

---

## 6. Remaining Manual Supabase Dashboard Actions

- Reduce Auth email OTP expiry to ≤ 1 hour
- Enable leaked password protection (HaveIBeenPwned)
- Schedule Postgres platform upgrade (`17.4.1.054` security patches)
- Verify Auth redirect URL allowlist
- Verify Edge Function auth/secrets for `cron-scan`, `marketing-email-tick`
- Provide database password to local Supabase CLI (or set `SUPABASE_DB_PASSWORD`) and run:

  ```bash
  supabase migration repair --status applied 20260628120600
  ```

- Optional: apply missing policy comment:

  ```sql
  COMMENT ON POLICY "Service role manage events assets" ON storage.objects IS
    'Private events bucket: service_role only. Matches tickets/career-documents pattern.';
  ```

  (Metadata only — not required for security.)

---

## 7. Final Recommendation

**Safe to continue development:** Yes — live security posture matches remediation intent; RLS and storage regressions pass.

**Safe for production (database layer):** **Yes with caveats** — core findings (RPC revoke, scans RLS, realtime publication, deny-all policies, ticket RPC search_path) are verified live. Caveats:

1. Complete migration history repair for `20260628120600` when CLI DB access is available (no SQL re-run).
2. Reconcile local vs remote migration version timestamps before next `supabase db push`.
3. Accept career application notification UX change (realtime off; polling on).
4. Address dashboard auth hardening and Postgres/auth advisor items on a separate track.

**Rollback needed:** No — validation shows intended security state; no failed partial apply detected.

---

*Validation performed via Supabase MCP read-only SQL, local npm scripts, and static code review. No production data modified in this step.*
