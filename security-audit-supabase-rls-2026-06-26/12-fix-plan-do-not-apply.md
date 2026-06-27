# 12 — Fix Plan (DO NOT APPLY)

**This document is a remediation plan only.**  
Per audit charter: no migrations, code changes, or deployments have been made. Execute only after stakeholder approval.

---

## Phase 0 — Emergency containment (0–24 hours)

1. **Assume breach of admin password hashes**
   - Force password reset for all rows in `admins` (out-of-band comms to operators).
   - Review admin account list for unknown emails (after RLS fixed, via SQL editor/service role).

2. **Monitor active abuse**
   - Enable Supabase dashboard alerts / log drain for `GET /rest/v1/admins`, `orders`, `tickets`.
   - Block obviously malicious IPs at CDN/WAF if scan traffic observed.

3. **Verify production secrets**
   - Confirm `JWT_SECRET` is set and not `fallback-secret-dev-only` on Vercel production.
   - Confirm `SUPABASE_SERVICE_ROLE_KEY` is set on all server functions.

4. **Temporary operational restriction (optional)**
   - Restrict Supabase API to known IP ranges (Vercel egress) if Supabase network restrictions available on plan.
   - **Not a substitute for RLS fix.**

---

## Phase 1 — Short-term RLS patch (1–3 days)

### 1.1 Drop or replace catastrophic policies

Target policies (by name):

| Table | Policies to remove/replace |
|-------|---------------------------|
| admins | `admins_select` |
| orders | `Admin can manage all orders`, `Admins can manage all orders` |
| tickets | `Public can view tickets`, `Allow server inserts for tickets` |
| contact_messages | `contact_messages_select` |
| phone_subscribers | `phone_subscribers_select` |
| newsletter_subscribers | `newsletter_subscribers_select` |
| ambassadors | All `USING (true)` SELECT/UPDATE/DELETE duplicates |
| admin_logs | `Allow read admin_logs` |
| order_logs | `Admins can manage all order logs` |
| qr_tickets | `Public can read QR tickets by token` |

### 1.2 Default-deny pattern

For each sensitive table:

```sql
-- EXAMPLE ONLY — do not run from this audit
-- CREATE POLICY deny_all ON public.orders FOR ALL TO public USING (false) WITH CHECK (false);
-- Then add minimal INSERT policies for legitimate public flows OR route via service role only
```

Prefer **no anon policies** on sensitive tables; use **service role from API** exclusively.

### 1.3 Fix `role IS NULL` policies

Replace:

```sql
-- BAD pattern found in production
(current_setting('request.jwt.claims', true)::json ->> 'role') IS NULL
```

With explicit:

```sql
auth.role() = 'service_role'
```

### 1.4 Revoke excessive grants

```sql
-- EXAMPLE — revoke TRUNCATE/DELETE from anon where not needed
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
```

Review each table for minimum required grant (often INSERT-only on public forms).

### 1.5 Admin login path

- Change `api/admin-login.js` to use **service role** or **`SECURITY DEFINER` function** that returns boolean match without exposing row data to anon.
- Stop using `.select('*')` — never return password column to any client context.

---

## Phase 2 — Short-term application patch (3–7 days)

1. **Remove client Supabase access to sensitive tables**
   - `src/pages/admin/Dashboard.tsx` → call existing `/api/admin/*` routes.
   - `src/lib/ticketGenerationService.tsx` → move to API route (may already partially exist in misc.js).
   - `src/lib/orders/*`, `src/lib/ambassadorOrders.ts` → ambassador/admin API only.

2. **Require service role in production API**
   - Fail fast in `admin-authorization.mjs` if `SUPABASE_SERVICE_ROLE_KEY` missing in production.

3. **Add permission checks**
   - Audit every `verifyAdminAuth` handler in `misc.js` — add `hasPermission` for destructive operations.

4. **Deploy frontend** after RLS deploy (order matters: **RLS first**, then remove client calls).

---

## Phase 3 — Long-term architecture (2–6 weeks)

1. **Identity model**
   - Option A: Supabase Auth for admins with `app_metadata.role` and RLS using `auth.jwt()`.
   - Option B: Keep custom JWT but **never** expose Postgres to browser for admin data — BFF/API only.

2. **Database access layers**
   - Private schema for `SECURITY DEFINER` functions (`login_admin`, `create_order`).
   - PostgREST exposes only views with `security_invoker = true` where public read needed.

3. **Ambassador / scanner / POS auth**
   - Unify session model; ensure RLS aligns with session tokens, not orphaned `auth.uid()` policies.

4. **CI security gates**
   - Run Supabase security advisor on every migration.
   - Automated test: anon key cannot SELECT from `admins`, `orders`, `tickets`.

---

## Password reset / key rotation recommendations

| Asset | Action | When |
|-------|--------|------|
| Admin passwords | Force reset all | Immediately (Phase 0) |
| `JWT_SECRET` | Rotate + invalidate cookies | After RLS patch, before wide announce |
| `SUPABASE_SERVICE_ROLE_KEY` | Rotate in Supabase dashboard | After RLS deployed + server env updated |
| `SUPABASE_ANON_KEY` | Optional rotate | After frontend redeploy with fixed RLS |
| Ambassador/POS passwords | Force reset if tables were exposed | Phase 1 assessment |

---

## Regression tests to add

1. **Anon key integration tests** (run in CI against staging):
   - `SELECT * FROM admins` → 0 rows or permission denied.
   - `SELECT * FROM orders` → 0 rows.
   - `SELECT * FROM tickets` → 0 rows.
   - Public INSERT contact message → still works (if retained).

2. **API tests**
   - Admin routes return 401 without cookie.
   - Permission-gated routes return 403 for wrong role.

3. **Policy lint**
   - SQL unit test: no policy with `USING (true)` on tables tagged sensitive in manifest.

---

## Deployment sequence

```text
1. Staging: apply RLS migration + grant changes
2. Staging: run anon-key regression tests
3. Staging: deploy API (service role login changes)
4. Staging: deploy frontend (remove direct Supabase)
5. Production: maintenance window announcement (optional)
6. Production: apply RLS migration (monitor errors)
7. Production: deploy API + frontend in quick succession
8. Rotate JWT_SECRET + admin password reset campaign
9. Rotate service role key (update Vercel env, redeploy)
10. 48h enhanced monitoring
```

---

## Rollback considerations

| Change | Rollback risk |
|--------|---------------|
| Drop open policies | **Low rollback desirability** — rolling back re-exposes data. Prefer forward fix. |
| Revoke grants | May break legacy client paths — test staging thoroughly |
| Admin login RPC | Keep feature flag to old path temporarily (still use service role) |
| Frontend API migration | Can revert frontend independently if API backward compatible |

**Do not rollback RLS hardening** unless production outage — instead add targeted policy for broken legitimate flow.

---

## Out of scope (reminder)

- No changes were applied during this audit.
- Implementation team should create proper Supabase migrations via `supabase migration new` when executing this plan.
- Legal/comms plan for customer notification if regulatory breach assessment requires it — **not assessed in this audit**.
