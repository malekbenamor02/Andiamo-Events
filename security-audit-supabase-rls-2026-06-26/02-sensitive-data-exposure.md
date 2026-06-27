# 02 — Sensitive Data Exposure

Focus tables from audit scope. Evidence from `pg_policies` and column metadata (MCP `execute_sql`). No live customer data queried.

---

## admins

| Question | Answer |
|----------|--------|
| Can anon read? | **Yes** — policy `admins_select` (`SELECT`, roles `{public}`, `USING (true)`) |
| Can authenticated read? | **Yes** — same policy (`public` includes authenticated) |
| Sensitive columns? | **Yes** — `email`, `password` (bcrypt hash), `phone`, `role`, `is_active` |
| RLS enabled? | Yes |
| Policies safe? | **No** — unrestricted SELECT; INSERT/UPDATE/DELETE gated by `is_admin_user()` but SELECT exposes credentials |
| Risk | **Critical** |

**Evidence**

```sql
-- Policy admins_select
USING (true)  -- cmd SELECT, roles {public}
```

**Code correlation:** `api/admin-login.js` lines 223–229 queries `.from('admins').select('*')` with `SUPABASE_ANON_KEY`, which succeeds because of this policy.

**Masked example:** Admin row would include `email: a***@example.com`, `password: $2a$10$***...***` (bcrypt).

---

## orders

| Question | Answer |
|----------|--------|
| Can anon read? | **Yes** |
| Can authenticated read? | **Yes** |
| Sensitive columns? | **Yes** — `user_name`, `user_phone`, `user_email`, `payment_*`, `payment_response_data`, `meta_attribution`, addresses (`city`, `ville`), pricing |
| RLS enabled? | Yes |
| Policies safe? | **No** |

**Unsafe policies (confirmed names)**

| Policy | Cmd | Qual |
|--------|-----|------|
| Admin can manage all orders | ALL | true |
| Admins can manage all orders | ALL | true |
| Public can create COD orders | INSERT | with_check source = platform_cod |
| Public can create online orders | INSERT | with_check source = platform_online |
| Ambassadors can view own orders | SELECT | ambassador_id scoped (ineffective if other ALL policies apply) |

**Note:** Permissive policies are OR'd; any `USING (true)` on ALL grants full read/write/delete to anon.

| Risk | **Critical** |

---

## tickets

| Question | Answer |
|----------|--------|
| Can anon read? | **Yes** |
| Can authenticated read? | **Yes** |
| Sensitive columns? | **Yes** — `secure_token`, `secure_access_token`, `qr_code_url`, `order_id`, delivery status |
| RLS enabled? | Yes |
| Policies safe? | **No** |

**Evidence:** `Public can view tickets` — SELECT, `USING (true)`.  
`Allow server inserts for tickets` — INSERT with `WITH CHECK (true)`.

| Risk | **Critical** |

---

## order_passes

| Question | Answer |
|----------|--------|
| Can anon read? | **Yes** — `Public can view order passes` |
| Sensitive columns? | Order linkage, pass quantities, pricing |
| Risk | **High** |

---

## bookings

**Not verified as separate table.** No `bookings` table in public schema. Order/booking data lives in `orders`, `order_passes`, `tickets`.

---

## customers

**Not verified as separate table.** PII in `orders`, `newsletter_subscribers`, `phone_subscribers`, `contact_messages`, `ambassadors`.

---

## contact_messages

| Question | Answer |
|----------|--------|
| Can anon read? | **Yes** — `contact_messages_select` true |
| Can anon insert? | **Yes** — `contact_messages_insert` with_check true |
| Sensitive columns? | `name`, `email`, `subject`, `message` |
| Risk | **High** |

**Frontend:** `src/pages/Contact.tsx` line 113 inserts via client Supabase (expected). Read access should not be public.

---

## payments

Payment data stored on `orders` (`payment_method`, `payment_reference`, `payment_gateway_reference`, `payment_response_data`, `transaction_id`, `payment_confirm_response`). Exposed via open `orders` policies — **Critical**.

`payment_options` — public SELECT only (configuration, lower risk).

---

## ambassadors

| Question | Answer |
|----------|--------|
| Can anon read? | **Yes** — multiple SELECT policies with true |
| Can anon update/delete? | **Yes** — `Public can update ambassadors`, `ambassadors_delete`, etc. |
| Sensitive columns? | `full_name`, `phone`, `email`, `password`, `status`, `ville` |
| Risk | **High** |

**Duplicate/overlapping policies:** 12 policies including `Admin can view all ambassadors` (ALL, true) and ambassador self-access via `auth.uid()` (likely unused — app uses custom sessions, not Supabase Auth for ambassadors).

---

## audit logs

### admin_logs

| Can anon read? | **Yes** — `Allow read admin_logs` SELECT true |
| Sensitive? | Admin actions, emails in `admin_email`, JSON `details` |
| Risk | **High** |

### security_audit_logs

| Can anon read? | **No** — SELECT requires admin row match on JWT sub |
| Can anon insert? | **Likely yes** — `System can insert security_audit_logs` includes `(role IS NULL)` |
| Risk | **High** (log injection / noise) |

### order_logs

| Can anon read? | **Yes** — `Admins can manage all order logs` ALL true |
| Risk | **High** |

---

## sessions

### ambassador_sessions

| Can anon read? | **No** — RLS enabled, 0 policies → default deny |
| Sensitive columns? | `token_hash`, `ip_address`, `user_agent` |
| Risk | **Low** (via anon key) / grants still dangerous if RLS disabled |

### presale_sessions

Zero policies — default deny for anon. Server uses service role (`api/_lib/presale-route-session.js`).

---

## role / permission tables

### admin_tab_access

| Can anon read? | **No** — `admin_tab_access_deny_anon_all` qual false on ALL |
| Risk | **Medium** — correct deny; backend uses service role in `verifyAdminSession` |

### admins (roles)

See admins section — role column exposed with password hashes.

---

## Additional high-risk tables (brief)

| Table | Anon read | Notes |
|-------|:---------:|-------|
| newsletter_subscribers | Yes | Emails readable |
| phone_subscribers | Yes | Phone numbers readable |
| career_applications | Yes | Application PII |
| sms_logs | Yes | Phone/message metadata |
| qr_tickets | Yes | QR/ticket registry |
| site_logs | Yes | Client telemetry |

---

## Assumptions vs confirmed

| Status | Item |
|--------|------|
| Confirmed | Policy names and `USING (true)` from live `pg_policies` |
| Confirmed | Column lists from `information_schema.columns` |
| Not verified | Volume of historical exfiltration (see logs — limited 24h window) |
| Not verified | Whether Supabase Auth `auth.uid()` policies ever match real admin sessions |
