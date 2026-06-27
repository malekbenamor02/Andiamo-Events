# Supabase RLS Security Audit — Executive Summary

**Audit date:** 2026-06-26 (documentation assembled 2026-06-27)  
**Scope:** Read-only review of Supabase Row Level Security, grants, admin auth architecture, frontend Supabase usage, API authorization, keys/env, and Supabase API logs.  
**Project:** `ykeryyraxmtjunnotoep` (from local Supabase CLI link)  
**Method:** Supabase MCP (`execute_sql`, `list_tables`, `get_advisors`, `get_logs`) + static code review. **No production changes were made.**

---

## Pentester report status

**Partially confirmed** (based on typical pentest themes: open RLS on sensitive tables, client-side Supabase access to PII, admin credential exposure via PostgREST).

Confirmed in this audit:

- Anonymous (`anon`) PostgREST clients can **SELECT** rows from `admins` (including bcrypt `password` column) via policy `admins_select` (`USING (true)`).
- Anonymous clients can **SELECT/UPDATE/DELETE** all rows in `orders` via policies `Admin can manage all orders` / `Admins can manage all orders` (`USING (true)` on `ALL`).
- Anonymous clients can **SELECT** all `tickets` (including `secure_token`, `secure_access_token`) via `Public can view tickets`.
- Multiple PII tables (`contact_messages`, `phone_subscribers`, `newsletter_subscribers`, `ambassadors`, `career_applications`, etc.) have `USING (true)` SELECT policies for role `{public}` (includes `anon`).
- Frontend admin dashboard performs **direct client-side Supabase queries** against sensitive tables using the publishable anon key (`VITE_SUPABASE_ANON_KEY`).
- Admin login is **backend-mediated** (`/api/admin-login`) with server-side bcrypt, but login still queries `admins` using the **anon key**, which succeeds because RLS allows it.

Not verified in this audit (no pentester report supplied):

- Specific exploit chain or attacker IP from the original report.
- Whether production JWT secrets or service role keys were ever committed or leaked.

---

## Overall severity

**Critical**

RLS policies on core business tables effectively negate database-level access control for anyone holding the public anon key (embedded in the frontend bundle).

---

## Main business risk

1. **Full customer PII and order data exfiltration** — names, phones, emails, payment metadata, ambassador assignments.
2. **Admin account compromise** — bcrypt password hashes and admin emails readable via PostgREST; offline cracking possible.
3. **Ticket fraud** — ticket secure tokens and QR URLs readable; could enable unauthorized entry or resale.
4. **Regulatory / trust impact** — GDPR-style exposure of contact lists, career applications, SMS logs.

Application-layer admin JWT checks on API routes **do not protect** data accessed directly through Supabase REST from the browser or any anon-key holder.

---

## Urgent findings (confirmed)

| ID | Finding | Severity |
|----|---------|----------|
| RLS-001 | `admins_select`: unrestricted SELECT on `admins` (includes `password`) | Critical |
| RLS-002 | `orders`: `ALL` policies with `USING (true)` | Critical |
| RLS-003 | `tickets`: `Public can view tickets` with `USING (true)` | Critical |
| RLS-004 | `contact_messages`, `phone_subscribers`, `newsletter_subscribers`: open SELECT | High |
| RLS-005 | `ambassadors`: multiple open SELECT/UPDATE/DELETE policies | High |
| RLS-006 | Policies matching `role IS NULL` treat anon JWT as privileged (e.g. `qr_tickets`, `security_audit_logs` INSERT) | High |
| RLS-007 | 22 tables: RLS enabled, **zero policies** — deny-by-default (good) but full table grants remain | Medium |
| APP-001 | Admin `Dashboard.tsx` queries orders/ambassadors/applications via client Supabase | High |
| APP-002 | `ticketGenerationService.tsx` client-side ticket/order writes with anon key | High |

See `11-final-risk-register.md` for the full register.

---

## Recommended next steps

1. **Emergency:** Rotate admin passwords; assume `admins.password` hashes may be exposed. Restrict Supabase project network/API if available.
2. **Emergency:** Replace all `USING (true)` / `WITH CHECK (true)` policies on sensitive tables with deny-by-default + explicit server-only access (service role via backend only).
3. **Short-term:** Remove direct client Supabase access to sensitive tables; route through authenticated API handlers.
4. **Short-term:** Revoke unnecessary `anon`/`authenticated` table grants; rely on service role from server.
5. **Long-term:** Migrate admin auth to Supabase Auth or dedicated identity provider; use RLS tied to verified JWT claims, not custom cookies alone.
6. **Long-term:** Add regression tests and Supabase security advisor checks in CI.

Detailed phased plan: `12-fix-plan-do-not-apply.md`.

---

## Audit artifacts

| File | Purpose |
|------|---------|
| `01-supabase-rls-table-matrix.md` | All public tables: RLS, grants, risk |
| `02-sensitive-data-exposure.md` | Focus tables: admins, orders, tickets, etc. |
| `03-policies-and-grants.md` | Policy inventory, unsafe policies |
| `04-admin-auth-architecture.md` | Admin login & authorization flow |
| `05-frontend-supabase-usage.md` | Client-side Supabase calls |
| `06-backend-api-authorization.md` | API route auth matrix |
| `07-keys-and-env-review.md` | Key exposure review |
| `08-logs-review.md` | Supabase API logs (24h) |
| `09-readonly-sql-used.sql` | All audit SELECT queries |
| `10-code-search-log.md` | Code search evidence |
| `11-final-risk-register.md` | Consolidated risk register |
| `12-fix-plan-do-not-apply.md` | Remediation plan (not applied) |

---

## Read-only audit statement

This folder contains **documentation and evidence only**. No application source files, database schema, migrations, or deployments were modified as part of this audit.
