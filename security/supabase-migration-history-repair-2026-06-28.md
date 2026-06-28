# Supabase Migration History Repair

Date: 2026-06-28  
Project ref: `ykeryyraxmtjunnotoep`  
Scope: Reconcile local migration filenames with remote `schema_migrations`; register events storage migration without re-executing SQL. **No schema changes. No `supabase db push`.**

---

## 1. Summary

| Item | Result |
|------|--------|
| Local files renamed | **Yes** (6 of 6 MCP-registered migrations) |
| Remote migration repair completed | **No** (CLI blocked — database password required) |
| DB password required | **Yes** |
| Safe to run future `supabase db push` | **No** until operator runs repair for `20260628120600` |

**Final gate: PARTIAL PASS** — local filenames now match remote applied versions for the first six migrations; events storage migration history repair still requires operator action with DB password.

---

## 2. File Rename Mapping

Confirmed by migration **name suffix** and SQL intent (each local file’s body matches the remotely applied migration of the same name).

| Old local file | New local file | Matching remote version | Status |
| -------------- | -------------- | ----------------------- | ------ |
| `20260628120000_revoke_client_maintenance_rpc_execute.sql` | `20260628115239_revoke_client_maintenance_rpc_execute.sql` | `20260628115239` | Renamed |
| `20260628120100_harden_is_service_role_execute.sql` | `20260628115246_harden_is_service_role_execute.sql` | `20260628115246` | Renamed |
| `20260628120200_harden_security_definer_search_path.sql` | `20260628115247_harden_security_definer_search_path.sql` | `20260628115247` | Renamed |
| `20260628120300_restrict_sensitive_realtime_publication.sql` | `20260628115248_restrict_sensitive_realtime_publication.sql` | `20260628115248` | Renamed |
| `20260628120400_tighten_scans_rls.sql` | `20260628115257_tighten_scans_rls.sql` | `20260628115257` | Renamed |
| `20260628120500_add_explicit_deny_policies_to_sensitive_tables.sql` | `20260628115259_add_explicit_deny_policies_to_sensitive_tables.sql` | `20260628115259` | Renamed |
| `20260628120600_harden_events_storage_bucket_policies.sql` | *(unchanged)* | *(not in remote history)* | Kept as-is pending repair |

**Remote `schema_migrations` (MCP read-only, post-rename):**

```
20260628115239  revoke_client_maintenance_rpc_execute
20260628115246  harden_is_service_role_execute
20260628115247  harden_security_definer_search_path
20260628115248  restrict_sensitive_realtime_publication
20260628115257  tighten_scans_rls
20260628115259  add_explicit_deny_policies_to_sensitive_tables
```

**Supporting change:** `api/_lib/supabase-remediation-migrations.test.cjs` manifest updated to new filenames (migration bookkeeping only; no application/runtime code changed). `npm run test:supabase-remediation` — **15/15 PASS**.

---

## 3. Events Storage Repair

| Check | Result |
| ----- | ------ |
| Live policy exists | **Yes** — `Service role manage events assets` on `storage.objects` |
| Local SQL matches live policy | **Yes** — `FOR ALL`, `bucket_id = 'events'`, `auth.role() = 'service_role'` on USING and WITH CHECK |
| Comment drift only | **Yes** — local file includes `COMMENT ON POLICY`; live `policy_comment` is null (metadata-only) |
| Repair command run | **Attempted** — blocked |
| Repair result | **Not completed** — CLI prompts for database password |

Live policy (MCP read-only):

- `polcmd`: `*` (ALL)
- `using_expr`: `(bucket_id = 'events') AND (auth.role() = 'service_role')`
- `with_check`: same as USING

Local migration SQL was **not** re-executed.

---

## 4. Validation

| Command | Result | Notes |
| ------- | ------ | ----- |
| `supabase migration list` | **NOT RUN** | CLI: “Forgot your password?” — requires Supabase DB password |
| `supabase migration repair --status applied 20260628120600` | **NOT RUN** | Same password prompt; no row inserted into `schema_migrations` |
| `npm run test:supabase-remediation` | **PASS** | 15/15 after filename manifest update |
| MCP `schema_migrations` query | **PASS** | Six remote versions present; `20260628120600` still absent |

**Expected after operator repair:**

- `supabase migration list` — all seven local security migrations show as **applied** on remote; none pending
- First six local timestamps align with remote (already true after rename)
- `20260628120600` appears in remote history without SQL execution

---

## 5. Final Operator Instructions

The operator **must** provide the Supabase database password (Dashboard → Project Settings → Database) or configure CLI access, then run:

```bash
cd c:\Users\ASUS\Andiamo-Events
supabase migration repair --status applied 20260628120600
supabase migration list
```

**Do not** run:

```bash
supabase db push
```

until `migration list` confirms `20260628120600` is applied on remote.

**Why repair is safe:** The events storage policy already exists live and matches local DDL. `migration repair --status applied` only inserts a bookkeeping row into `supabase_migrations.schema_migrations`; it does not execute migration SQL.

**Optional env approaches** (choose one):

- Enter password when CLI prompts during `supabase link` / `migration repair`
- Set connection via Supabase CLI docs for your version (e.g. linked project + stored credentials)

**Do not** manually INSERT into `schema_migrations` via ad-hoc SQL unless you cannot use `migration repair` — prefer the official repair command.

---

## 6. Final Gate

**PARTIAL PASS — local files fixed, remote repair still needs DB password**

| Milestone | Status |
|-----------|--------|
| Local ↔ remote alignment (first 6) | Done |
| Events storage registered remotely | Pending operator repair |
| Future `supabase db push` safe | **No** — would attempt pending `20260628120600` until repair completes |

After operator runs repair and `migration list` shows all seven applied:

**PASS — migration history aligned, future db push safe** (for this security remediation set; always review any newer local migrations before push).
