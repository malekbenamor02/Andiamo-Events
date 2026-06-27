# 03 — Policies and Grants

**Project:** `ykeryyraxmtjunnotoep`  
**Sources:** `pg_policies`, `information_schema.role_table_grants` via MCP `execute_sql`.

---

## pg_policies summary

- **Schema:** `public` only (exposed to PostgREST).
- **Total policies:** 120+ across 50 tables.
- **Role target:** Most policies use `{public}` (includes `anon`, `authenticated`, and `service_role` as PostgreSQL roles — not to be confused with Supabase JWT role claim).
- **22 tables** have RLS enabled and **zero policies** (default deny).

Full policy export is in audit SQL query #2 in `09-readonly-sql-used.sql`. Key policy names by table:

| Table | Policy names (sample) |
|-------|----------------------|
| admins | `admins_select`, `admins_insert`, `admins_update`, `admins_delete`, `Admins can access own data` |
| orders | `Admin can manage all orders`, `Admins can manage all orders`, `Public can create COD orders`, `Public can create online orders`, `Ambassadors can view own orders`, `Ambassadors can update own orders` |
| tickets | `Public can view tickets`, `Allow server inserts for tickets`, `Admins can manage all tickets`, `System can manage tickets` |
| ambassadors | 12 policies including `Public can view ambassadors`, `Service role can manage ambassadors`, `ambassadors_select`, … |

---

## role_table_grants summary

**Pattern (all 72 public tables):**

| Grantee | Privileges |
|---------|------------|
| `anon` | DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE |
| `authenticated` | Same full set |
| `service_role` | Same full set (bypasses RLS when used) |

**Implication:** Table-level grants are maximally permissive. **RLS is the only gate** for anon/authenticated API access. Any policy mistake or `USING (true)` immediately exposes data.

---

## Unsafe policies found

### Category A — Unrestricted read (`USING (true)` on SELECT)

| Table | Policy | Cmd |
|-------|--------|-----|
| admins | admins_select | SELECT |
| admin_logs | Allow read admin_logs | SELECT |
| orders | (via ALL policies) | ALL |
| tickets | Public can view tickets | SELECT |
| contact_messages | contact_messages_select | SELECT |
| ambassadors | Public can view ambassadors, ambassadors_select, Admin can view all ambassadors | SELECT/ALL |
| newsletter_subscribers | newsletter_subscribers_select | SELECT |
| phone_subscribers | phone_subscribers_select | SELECT |
| order_passes | Public can view order passes | SELECT |
| order_logs | Admins can manage all order logs | ALL |
| career_applications | career_applications_select | SELECT |
| qr_tickets | Public can read QR tickets by token | SELECT |
| sms_logs | Public can view SMS logs | SELECT |
| site_logs | site_logs_select | SELECT |
| csp_reports | Allow select csp_reports | SELECT |
| audience_suggestions | audience_suggestions_select | SELECT |
| ambassador_applications | ambassador_applications_select | SELECT |

### Category B — Unrestricted write (`WITH CHECK (true)` or `USING (true)` on INSERT/UPDATE/DELETE)

| Table | Policy | Cmd |
|-------|--------|-----|
| events | events_insert_admin, events_update_admin, events_delete_admin | I/U/D |
| event_passes | event_passes_insert_anon, event_passes_update_anon, event_passes_delete_anon | I/U/D |
| sponsors / team_members | Allow all * | ALL |
| ambassadors | Public can update ambassadors, ambassadors_delete, … | U/D |
| site_content | Admins can insert/update site content | I/U |
| tickets | Allow server inserts for tickets | INSERT |

### Category C — `role IS NULL` bypass pattern (dangerous for anon JWT)

Policies that allow access when `(current_setting('request.jwt.claims')::json ->> 'role') IS NULL`:

| Table | Policy | Effect |
|-------|--------|--------|
| ambassadors | Service role can manage ambassadors | ALL for anon requests |
| qr_tickets | Service role can manage QR tickets | ALL for anon |
| security_audit_logs | System can insert security_audit logs | INSERT for anon |
| investor_contacts, marketing_* | Service role can manage * | ALL when role null |

**Confirmed:** Supabase anon key requests typically have no `role` claim in JWT → `IS NULL` evaluates true → policy matches.

### Category D — Policies referencing `auth.uid()` / Supabase Auth

Examples: `official_invitations`, `order_expiration_settings`, `investor_contacts`, `tickets` (`Admins can manage all tickets`).

**Risk note:** Application admin auth uses **custom JWT in HttpOnly cookie**, not Supabase Auth session. These policies may **not** grant admins any access via anon key, while `USING (true)` policies still expose data to everyone.

---

## Broad policies using `true` (complete list from query)

See `09-readonly-sql-used.sql` query #3. Count: **70+ policy rows** match `qual = 'true'`, `qual IS NULL`, or `with_check = 'true'`.

---

## Policies allowing anon access to private data

All Category A and B policies above apply to role `{public}`, which includes **`anon`**.

**Most critical:**

1. `admins.admins_select`
2. `orders` ALL policies with true
3. `tickets.Public can view tickets`

---

## Missing policies (should be explicit deny)

| Table | Issue |
|-------|-------|
| 22 zero-policy tables | Deny works but grants should be revoked from anon |
| consultation_inquiries | Only anon INSERT deny; no explicit admin SELECT policy (relies on default deny) |
| payment_options | Public SELECT intentional — OK if data is non-secret |

**Recommendation:** Replace implicit deny with explicit `DENY` policies only after revoking excessive grants; document intended public INSERT endpoints (contact form, newsletter).

---

## admin_tab_access (positive example)

```sql
Policy: admin_tab_access_deny_anon_all
Cmd: ALL
Qual: false
With check: false
```

Effective deny for all roles — backend uses service role for tab loading in `verifyAdminSession`.

---

## fcm_tokens (positive example)

```sql
Policy: fcm_tokens_no_client
Cmd: ALL
Qual: false
```

Push tokens not client-accessible via RLS.
