# Supabase MCP Migration History Repair

Date: 2026-06-28  
Project ref: `ykeryyraxmtjunnotoep`  
Method: Supabase MCP `execute_sql` (bookkeeping INSERT only)

---

## Summary

| Item | Result |
|------|--------|
| MCP repair completed | **Yes** |
| Production schema changed | **No** (no policies, grants, functions, RLS, or storage DDL) |
| Production data changed | **No** (application/business tables untouched) |
| Migration history changed | **Yes** (one row inserted into `supabase_migrations.schema_migrations`) |
| Safe to run future `supabase db push` | **Yes** (for this seven-migration security remediation set) |

**Final gate: PASS — migration history aligned, future db push safe**

---

## Pre-checks

| Check | Result | Evidence |
| ----- | ------ | -------- |
| Live events policy exists | **PASS** | `pg_policies`: `storage.objects` / `Service role manage events assets`, `cmd=ALL`, USING and WITH CHECK both `(bucket_id = 'events') AND (auth.role() = 'service_role')` |
| Events bucket private | **PASS** | `storage.buckets`: `id=events`, `public=false` |
| Migration missing before repair | **PASS** | `SELECT * FROM supabase_migrations.schema_migrations WHERE version = '20260628120600'` → **0 rows** |
| Table structure inspected | **PASS** | Columns: `version` (text, NOT NULL, PK), `statements` (text[], nullable), `name` (text, nullable), `created_by` (text, nullable), `idempotency_key` (text, nullable, UNIQUE), `rollback` (text[], nullable). PK on `version` — `ON CONFLICT (version) DO NOTHING` valid |

---

## Repair

| Item | Value |
| ---- | ----- |
| Version inserted | `20260628120600` |
| Name inserted | `harden_events_storage_bucket_policies` |
| SQL used | `INSERT INTO supabase_migrations.schema_migrations (version, name, statements) VALUES (...)` with local migration file content in `statements` array; `ON CONFLICT (version) DO NOTHING` |
| Duplicate protection | `ON CONFLICT (version) DO NOTHING` (PK `schema_migrations_pkey` on `version`) |
| `apply_migration` used | **No** |
| Events storage policy SQL re-executed | **No** |

**Insert returned:** `version=20260628120600`, `name=harden_events_storage_bucket_policies`

Optional columns left null (consistent with nullable columns; `created_by` not set — bookkeeping-only insert via MCP):

- `created_by`: null
- `idempotency_key`: null
- `rollback`: null

---

## Post-checks

| Check | Result |
| ----- | ------ |
| `20260628120600` exists in `schema_migrations` | **PASS** — 1 row |
| All seven remediation migrations registered | **PASS** — 7 rows |

```
20260628115239  revoke_client_maintenance_rpc_execute
20260628115246  harden_is_service_role_execute
20260628115247  harden_security_definer_search_path
20260628115248  restrict_sensitive_realtime_publication
20260628115257  tighten_scans_rls
20260628115259  add_explicit_deny_policies_to_sensitive_tables
20260628120600  harden_events_storage_bucket_policies
```

| Security tests | Result |
| -------------- | ------ |
| `npm run test:supabase-remediation` | **PASS** (15/15) |
| `npm run security:rls` | **PASS** |
| `npm run security:storage` | **PASS** (13/0) |
| `npm run security:public-routes` | **PASS** |
| `npm run test:login-security` | **PASS** (16/16) |
| `npm run test:payment-fulfillment` | **PASS** (56/56) |
| `npm run test:admin-auth-order` | **PASS** (70/70) |

---

## Notes

- Local migration filenames were previously renamed to match remote MCP timestamps for migrations 1–6 (`security/supabase-migration-history-repair-2026-06-28.md`).
- Live events storage policy predates this repair; only migration bookkeeping was added.
- `COMMENT ON POLICY` in local file / `statements` array is metadata; live policy comment was already null before repair — no schema impact.
- Before running `supabase db push`, review any **newer** local migrations beyond this set.

---

## Final Gate

**PASS — migration history aligned, future db push safe**

Operator may verify with CLI when DB password is available:

```bash
supabase migration list
```

Expected: all seven security remediation versions show as applied on remote; none pending.

Do **not** re-run `supabase migration repair --status applied 20260628120600` — row already exists.
