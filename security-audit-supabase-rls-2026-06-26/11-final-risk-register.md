# 11 — Final Risk Register

Consolidated findings from RLS policy review, code analysis, and Supabase advisors/logs.

| ID | Title | Severity | Affected table/file/route | Evidence | Business impact | Recommended fix | Priority |
|----|-------|----------|---------------------------|----------|-----------------|---------------|----------|
| RLS-001 | Unrestricted SELECT on admin credentials | **Critical** | `admins` / policy `admins_select` | `USING (true)` on SELECT; columns include `password` | Admin account takeover via offline hash crack | Drop policy; deny anon/authenticated SELECT; login via service role RPC only | P0 |
| RLS-002 | Unrestricted ALL on orders | **Critical** | `orders` / `Admin can manage all orders`, `Admins can manage all orders` | `USING (true)` on ALL | Full PII + payment data leak, tampering, fraud | Replace with deny-default; server service role only | P0 |
| RLS-003 | Public read all tickets | **Critical** | `tickets` / `Public can view tickets` | `USING (true)` SELECT | Ticket forgery, event unauthorized entry | Restrict SELECT to scoped token lookup or server only | P0 |
| RLS-004 | QR ticket registry readable | **High** | `qr_tickets` | SELECT true + service policy with `role IS NULL` | QR duplication / fraud | Remove public SELECT; fix NULL role policies | P0 |
| RLS-005 | Contact & subscriber PII exposed | **High** | `contact_messages`, `phone_subscribers`, `newsletter_subscribers` | SELECT true policies | GDPR/privacy breach, spam targeting | Admin-only SELECT via service role | P1 |
| RLS-006 | Ambassador records openly mutable | **High** | `ambassadors` | 12 policies, many `true` | Identity fraud, password exposure | Consolidate policies; deny anon; API-only management | P1 |
| RLS-007 | `role IS NULL` service policies match anon | **High** | `ambassadors`, `qr_tickets`, `security_audit_logs`, marketing tables | JWT claim IS NULL | Unintended write/read as anon | Remove IS NULL clause; use `auth.role() = 'service_role'` only | P1 |
| RLS-008 | Admin logs readable | **High** | `admin_logs` | `Allow read admin_logs` SELECT true | Operational intelligence leak | Restrict to service role | P1 |
| RLS-009 | Order/ticket logs exposed | **High** | `order_logs`, `sms_logs` | ALL or SELECT true | PII in log metadata | Service role only | P1 |
| RLS-010 | Event/pass admin write policies use true | **High** | `events`, `event_passes` | INSERT/UPDATE/DELETE true | Inventory/pricing manipulation | Separate public read from authenticated admin via server | P1 |
| RLS-011 | 22 tables RLS with zero policies | **Medium** | academy_*, presale_*, pos_*, etc. | policy_count = 0 | Deny today; grants still full if RLS disabled | Revoke anon grants; add explicit deny documentation | P2 |
| RLS-012 | All tables grant TRUNCATE to anon | **Medium** | All public tables | information_schema grants | Catastrophic if RLS bypassed | Revoke TRUNCATE/DELETE from anon/authenticated | P2 |
| APP-001 | Admin dashboard direct Supabase queries | **High** | `src/pages/admin/Dashboard.tsx` | 50+ `.from()` calls | Bypasses API audit trail; relies on broken RLS | Migrate to `/api/admin/*` exclusively | P1 |
| APP-002 | Client-side ticket generation | **High** | `src/lib/ticketGenerationService.tsx` | tickets/orders/qr_tickets writes | Token exposure in browser | Move to server-only job | P0 |
| APP-003 | Client order services | **High** | `src/lib/orders/*.ts`, `ambassadorOrders.ts` | Direct orders access | Order fraud / data leak | API-only | P1 |
| APP-004 | Admin login uses anon key | **Medium** | `api/admin-login.js:223` | SELECT admins via anon | Enables credential harvesting at scale | Security definer RPC or service role | P1 |
| APP-005 | JWT fallback secret | **Medium** | `admin-login.js`, `admin-authorization.mjs` | `fallback-secret-dev-only` | Forge admin JWT if misconfigured prod | Fail hard if JWT_SECRET missing | P2 |
| APP-006 | Inconsistent hasPermission on API routes | **Medium** | `api/misc.js` many routes | Auth without permission check | Privilege escalation among admin roles | Enforce permission on every admin route | P2 |
| APP-007 | Server falls back to anon key | **Medium** | Multiple api/_lib/* | Missing SERVICE_ROLE → anon | Broken RLS affects server too | Require service role in production | P2 |
| KEY-001 | Anon key in frontend bundle | **Low** (by design) | `VITE_SUPABASE_ANON_KEY` | client.ts | Safe only with strict RLS | Fix RLS (primary) | P0 |
| KEY-002 | Service role not in frontend | **Low** | — | Grep negative | Good | Maintain separation | — |
| LOG-001 | No historical exfil evidence | **Unknown** | Supabase API logs | 24h sample lacks admins/orders | Cannot confirm past abuse | Extended logging + alerts | P2 |

---

## Severity summary

| Severity | Count |
|----------|------:|
| Critical | 3 |
| High | 12 |
| Medium | 8 |
| Low | 1 |
| Unknown | 1 |

---

## Priority order

**P0 (immediate):** RLS-001, RLS-002, RLS-003, RLS-004, APP-002, KEY-001  
**P1 (days):** RLS-005 through RLS-010, APP-001, APP-003, APP-004  
**P2 (weeks):** RLS-011, RLS-012, APP-005–007, LOG-001
