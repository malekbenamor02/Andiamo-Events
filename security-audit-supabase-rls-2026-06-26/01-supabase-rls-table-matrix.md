# 01 — Supabase RLS Table Matrix (public schema)

**Source:** Supabase MCP `execute_sql` on project `ykeryyraxmtjunnotoep`, 2026-06-27.  
**Note:** All 72 public tables have RLS **enabled**, RLS **not forced** (`relforcerowsecurity = false`).  
**Grants:** Every table grants `anon` and `authenticated` full privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, etc.). Effective access is determined by RLS policies.

**Legend — Risk level**

| Level | Meaning |
|-------|---------|
| Critical | Open or broken policy on credentials, orders, tickets, payments |
| High | Open PII read/write or dangerous `true` policies |
| Medium | Over-permissive on semi-public data, or zero-policy tables with broad grants |
| Low | Intentionally public read-only content |
| Deny | RLS on, zero policies → default deny for anon/authenticated |

---

## Summary counts

| Metric | Count |
|--------|------:|
| Total public tables | 72 |
| Tables with ≥1 policy | 50 |
| Tables with 0 policies (deny default) | 22 |
| Tables with `USING (true)` SELECT on sensitive data | 15+ |

---

## Full table matrix

| Table | RLS | Forced | Policies | anon S/I/U/D* | auth S/I/U/D* | Sensitive | Risk | Notes |
|-------|:---:|:------:|:--------:|:-------------:|:-------------:|:---------:|:----:|-------|
| academy_influencers | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies; access denied via anon key |
| academy_promo_codes | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | Same |
| academy_registration_logs | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | Same |
| academy_registrations | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | Server uses service role in API |
| academy_settings | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | unknown | Deny | Logs show service/cron reads |
| admin_logs | yes | no | 2 | Y†/Y†/N/N | Y†/Y†/N/N | yes | High | `Allow read admin_logs` SELECT true; INSERT with_check true |
| admin_tab_access | yes | no | 1 | N/N/N/N | N/N/N/N | yes | Medium | `admin_tab_access_deny_anon_all` qual false |
| admins | yes | no | 5 | Y/N/N/N | Y/N/N/N | **yes** | **Critical** | `admins_select` USING (true) — password column exposed |
| aio_events_submissions | yes | no | 2 | Y/N/N/N | Y/N/N/N | yes | Medium | Public INSERT; admin SELECT via auth.uid() (Supabase Auth — may not match custom admin JWT) |
| ambassador_application_selection_items | yes | no | 4 | Y/Y/Y/Y | Y/Y/Y/Y | yes | High | All CRUD policies use true |
| ambassador_application_selections | yes | no | 4 | Y/Y/Y/Y | Y/Y/Y/Y | yes | High | All CRUD policies use true |
| ambassador_applications | yes | no | 3 | Y/Y/Y/Y | Y/Y/Y/Y | yes | High | SELECT/UPDATE true |
| ambassador_sessions | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | **yes** | Deny | Session tokens; no policy = denied (good) |
| ambassadors | yes | no | 12 | Y/Y/Y/Y | Y/Y/Y/Y | **yes** | **High** | Multiple duplicate open policies; passwords in `password` column |
| audience_suggestions | yes | no | 4 | Y/Y/Y/Y | Y/Y/Y/Y | yes | High | Full CRUD true |
| career_application_fields | yes | no | 1 | Y/N/N/N | Y/N/N/N | medium | Low | SELECT only when domain open |
| career_application_logs | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| career_applications | yes | no | 1 | Y/N/N/N | Y/N/N/N | yes | High | `career_applications_select` true |
| career_domains | yes | no | 1 | Y/N/N/N | Y/N/N/N | no | Low | Open domains only |
| career_form_template_fields | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| career_form_templates | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| cities | yes | no | 3 | Y/Y/Y/Y | Y/Y/Y/Y | no | Medium | Admin ALL true; public SELECT true |
| consultation_inquiries | yes | no | 1 | N/N/N/N | Y/Y/Y/Y | yes | Medium | Deny anon INSERT only; no SELECT policy → deny read |
| contact_messages | yes | no | 2 | Y/N/N/N | Y/N/N/N | **yes** | **High** | `contact_messages_select` true |
| csp_reports | yes | no | 2 | Y/N/N/N | Y/N/N/N | medium | High | SELECT true |
| event_passes | yes | no | 4 | Y‡/Y/Y/Y | Y‡/Y/Y/Y | medium | High | INSERT/UPDATE/DELETE true; SELECT gated by presale flag |
| event_promo_attempts | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| event_promo_code_pass_discounts | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| event_promo_code_passes | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| event_promo_codes | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| event_promo_order_create_rate | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | no | Deny | Rate limit table |
| event_promo_validate_rate | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | no | Deny | Rate limit table |
| events | yes | no | 4 | Y/Y/Y/Y | Y/Y/Y/Y | medium | High | Public SELECT true; admin write true (unrestricted) |
| fcm_tokens | yes | no | 1 | N/N/N/N | N/N/N/N | yes | Low | `fcm_tokens_no_client` qual false |
| investor_contacts | yes | no | 2 | N/N/N/N | N/N/N/N | yes | Medium | Admin + service_role policies (auth.uid based) |
| marketing_campaign_recipients | yes | no | 2 | N/N/N/N | N/N/N/N | yes | Medium | Admin + service_role |
| marketing_campaigns | yes | no | 2 | N/N/N/N | N/N/N/N | yes | Medium | Admin + service_role |
| newsletter_subscribers | yes | no | 4 | Y/N/N/N | Y/N/N/N | yes | High | SELECT true; INSERT allowed |
| official_invitations | yes | no | 4 | N/N/N/N | N/N/N/N | yes | Medium | Super-admin via auth.uid() |
| order_expiration_settings | yes | no | 4 | N/N/N/N | N/N/N/N | medium | Medium | Admin via auth.uid() |
| order_logs | yes | no | 3 | Y/Y/N/N | Y/Y/N/N | yes | High | Admin ALL true; INSERT with_check true |
| order_passes | yes | no | 3 | Y/Y/N/N | Y/Y/N/N | yes | High | Public SELECT/INSERT true |
| orders | yes | no | 6 | Y/Y/Y/Y | Y/Y/Y/Y | **yes** | **Critical** | Two ALL policies with USING (true) |
| payment_options | yes | no | 2 | Y/N/N/N | Y/N/N/N | medium | Low | Public SELECT true |
| phone_subscribers | yes | no | 3 | Y/N/N/N | Y/N/N/N | yes | High | SELECT true |
| pos_audit_log | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| pos_outlets | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | medium | Deny | No policies |
| pos_pass_stock | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | medium | Deny | No policies |
| pos_users | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | **yes** | Deny | password_hash; no policy = deny |
| presale_code_attempts | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| presale_code_pass_discounts | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| presale_codes | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | **yes** | Deny | Promo secrets; deny via RLS |
| presale_redeem_rate | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | no | Deny | No policies |
| presale_sessions | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | Session table |
| qr_tickets | yes | no | 2 | Y/N/N/N | Y/N/N/N | **yes** | **High** | SELECT true; service policy includes `role IS NULL` |
| scan_system_config | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | medium | Deny | No policies |
| scanners | yes | no | 1 | N/N/N/N | N/N/N/N | **yes** | Medium | service_role only policy |
| scans | yes | no | 4 | N/N/N/N | N/N/N/N | yes | Medium | Admin/ambassador scoped |
| security_audit_logs | yes | no | 2 | N/Y/N/N | N/Y/N/N | yes | High | INSERT when role IS NULL; SELECT admin-scoped |
| site_content | yes | no | 3 | Y/Y/Y/Y | Y/Y/Y/Y | low | Low | Public read; open admin write |
| site_logs | yes | no | 2 | Y/N/N/N | Y/N/N/N | medium | Medium | SELECT/INSERT true |
| sms_logs | yes | no | 2 | Y/N/N/N | Y/N/N/N | yes | High | SELECT/INSERT true |
| sponsors | yes | no | 4 | Y/Y/Y/Y | Y/Y/Y/Y | no | Medium | Full CRUD true |
| team_members | yes | no | 4 | Y/Y/Y/Y | Y/Y/Y/Y | no | Medium | Full CRUD true |
| tickets | yes | no | 4 | Y/Y/N/N | Y/Y/N/N | **yes** | **Critical** | Public SELECT true; INSERT with_check true |
| users | yes | no | 0 | Y/Y/Y/Y | Y/Y/Y/Y | yes | Deny | No policies |
| villes | yes | no | 3 | Y/Y/Y/Y | Y/Y/Y/Y | no | Medium | Public SELECT; admin ALL true |

\* **Y/N** = effective access via RLS for that operation (grants exist but RLS gates). **Y†** = allowed by policy. **Y‡** = SELECT allowed only when event presale disabled.

---

## Tables with zero policies (22)

These deny all access for `anon` / `authenticated` when using the anon key (default RLS behavior):

`academy_influencers`, `academy_promo_codes`, `academy_registration_logs`, `academy_registrations`, `academy_settings`, `career_application_logs`, `career_form_template_fields`, `career_form_templates`, `event_promo_*` (5 tables), `pos_audit_log`, `pos_outlets`, `pos_pass_stock`, `pos_users`, `presale_*` (5 tables), `scan_system_config`, `users`, `ambassador_sessions`

**Residual risk:** Grants still allow all operations if RLS were disabled or bypassed (service role, SQL editor, misconfiguration).

---

## Supabase security advisor (excerpt)

MCP `get_advisors` (security) reported multiple **`rls_enabled_no_policy`** INFO items for the zero-policy tables above. No advisor finding automatically flagged the `USING (true)` policies on `admins` / `orders` / `tickets` — manual policy review was required.
