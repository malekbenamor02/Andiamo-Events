# Andiamo Events Supabase RLS Table Audit

**Date:** 2026-06-27  
**Database:** Production Supabase project `ykeryyraxmtjunnotoep`  
**Method:** Read-only SQL via Supabase MCP + `npm run security:rls` + `npm run security:storage`  
**Migrations referenced:** `20260627120000_fix_critical_rls_exposure.sql`, `20260627140000_fix_storage_bucket_security.sql`, `20260627150000_harden_cities_csp_rpc_security.sql`

---

## 1. Executive Summary

| Metric | Value |
|--------|------:|
| **Overall RLS verdict** | **PASS** |
| Public tables checked | **67** |
| Tables with RLS disabled | **0** |
| Risky anon/authenticated grant groups (full DML on all tables) | **134** (67 tables × 2 roles) |
| Risky policies (legacy/dead/misleading) | **12** |
| Policies with `USING (true)` on SELECT | **6** (all intentional public-read) |
| Emergency fixes needed | **No** |

**Summary:** Every `public` table has RLS enabled. Sensitive tables (`admins`, `orders`, `tickets`, `qr_tickets`, ambassadors, logs, academy, presale, POS, etc.) are blocked from anon/authenticated direct access via explicit `deny_all` policies or implicit deny (RLS on, zero policies). Live anon-key regression tests **PASS**. No sensitive table has RLS disabled and no broad anon SELECT on private data was confirmed.

**Caveats (hardening, not FAIL):** All tables still grant INSERT/UPDATE/DELETE to `anon`/`authenticated` at the Postgres grant layer — security depends entirely on RLS. Twelve legacy policies reference `auth.uid()` or JWT `sub` claims incompatible with the app’s custom cookie auth (dead today, confusing tomorrow). Twenty-six tables rely on implicit deny with no explicit policy documentation.

---

## 2. Tables With RLS Disabled

**None.**

| Table | Contains sensitive data? | Current risk | Recommended fix |
|-------|--------------------------|--------------|-----------------|
| — | — | — | — |

---

## 3. Table-by-Table RLS Matrix

**Grant shorthand:** All 67 tables grant `DELETE, INSERT, SELECT, TRIGGER, UPDATE` to both `anon` and `authenticated` unless noted. RLS is the effective control.

| Table | RLS | Policies summary | Classification | Risk | Recommended action |
|-------|-----|------------------|----------------|------|-------------------|
| academy_influencers | yes | none (implicit deny) | SERVICE_ROLE_ONLY | Low | Add explicit `deny_all` |
| academy_promo_codes | yes | none | SERVICE_ROLE_ONLY | Low | Add explicit `deny_all` |
| academy_registration_logs | yes | none | SERVICE_ROLE_ONLY | Low | Add explicit `deny_all` |
| academy_registrations | yes | none | SERVICE_ROLE_ONLY | Low | Add explicit `deny_all` |
| academy_settings | yes | none | SERVICE_ROLE_ONLY | Low | Add explicit `deny_all` |
| admin_logs | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | Revoke anon DML grants |
| admin_tab_access | yes | `deny_anon_all` | SERVICE_ROLE_ONLY | Low | OK |
| admins | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| aio_events_submissions | yes | service INSERT only | SERVICE_ROLE_ONLY | Low | OK |
| ambassador_application_selection_items | yes | `deny_all` | ADMIN_ONLY | Low | OK |
| ambassador_application_selections | yes | `deny_all` | ADMIN_ONLY | Low | OK |
| ambassador_applications | yes | `deny_all` | ADMIN_ONLY | Low | OK |
| ambassador_sessions | yes | none (implicit deny) | SERVICE_ROLE_ONLY | Low | Add explicit `deny_all` |
| ambassadors | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| audience_suggestions | yes | `deny_all` | ADMIN_ONLY | Low | OK |
| career_application_fields | yes | SELECT if domain open | PUBLIC_SAFE | Low | OK |
| career_application_logs | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| career_applications | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| career_domains | yes | SELECT if applications_open | PUBLIC_SAFE | Low | OK |
| career_form_template_fields | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| career_form_templates | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| cities | yes | SELECT `USING (true)`; writes denied live | PUBLIC_SAFE | Low | OK |
| consultation_inquiries | yes | anon INSERT blocked | SERVICE_ROLE_ONLY | Low | OK |
| contact_messages | yes | INSERT only + with_check | INSERT-only public | Low | OK (no SELECT) |
| csp_reports | yes | service INSERT only | SERVICE_ROLE_ONLY | Low | OK |
| event_passes | yes | SELECT via `is_public_listable_event` | PUBLIC_SAFE | Low | OK |
| event_promo_attempts | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| event_promo_code_pass_discounts | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| event_promo_code_passes | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| event_promo_codes | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| event_promo_order_create_rate | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| event_promo_validate_rate | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| events | yes | SELECT filtered (no test/presale/cancelled) | PUBLIC_SAFE | Low | OK |
| fcm_tokens | yes | `deny` ALL | SERVICE_ROLE_ONLY | Low | OK |
| investor_contacts | yes | legacy JWT-sub admin + service_role | ADMIN_ONLY | Medium | Remove dead admin policy |
| marketing_campaign_recipients | yes | legacy JWT-sub admin + service_role | ADMIN_ONLY | Medium | Remove dead admin policy |
| marketing_campaigns | yes | legacy JWT-sub admin + service_role | ADMIN_ONLY | Medium | Remove dead admin policy |
| newsletter_subscribers | yes | INSERT only + with_check | INSERT-only public | Low | OK |
| official_invitations | yes | auth.uid() super_admin (4 policies) | SUPER_ADMIN_ONLY | Medium | Replace with deny_all; API only |
| order_expiration_settings | yes | `deny_all` | ADMIN_ONLY | Low | OK |
| order_logs | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| order_passes | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| orders | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| payment_options | yes | SELECT `USING (true)` | PUBLIC_SAFE | Low | OK |
| phone_subscribers | yes | INSERT only + with_check | INSERT-only public | Low | OK |
| pos_audit_log | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| pos_outlets | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| pos_pass_stock | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| pos_users | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| presale_code_attempts | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| presale_code_pass_discounts | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| presale_codes | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| presale_redeem_rate | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| presale_sessions | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| qr_tickets | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| scan_system_config | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| scanners | yes | service_role only | SERVICE_ROLE_ONLY | Low | OK |
| scans | yes | auth.uid() admin + ambassador (4) | ADMIN_ONLY | Medium | Remove dead policies |
| security_audit_logs | yes | service INSERT only | SERVICE_ROLE_ONLY | Low | OK |
| site_content | yes | SELECT `USING (true)` | PUBLIC_SAFE | Low | OK |
| site_logs | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| sms_logs | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| sponsors | yes | SELECT `USING (true)` | PUBLIC_SAFE | Low | OK |
| team_members | yes | SELECT `USING (true)` | PUBLIC_SAFE | Low | OK |
| tickets | yes | `deny_all` | SERVICE_ROLE_ONLY | Low | OK |
| users | yes | none | SERVICE_ROLE_ONLY | Low | deny_all |
| villes | yes | SELECT `USING (true)`; writes denied live | PUBLIC_SAFE | Low | OK |

**Live anon verification (`npm run security:rls`):** All 17 private probe tables return 0 rows / denied writes. Policy audit RPC confirms no dangerous broad policies on sensitive tables.

---

## 4. Dangerous Grants

Supabase default: **every** `public` table grants full DML to `anon` and `authenticated`.

| Grant pattern | Tables affected | Acceptable? | Notes |
|---------------|-----------------|-------------|-------|
| `anon`: INSERT, UPDATE, DELETE, SELECT | 67 | **Defense-in-depth risk** | RLS blocks today; grant alone would expose if RLS dropped |
| `authenticated`: same | 67 | **Defense-in-depth risk** | App does not use Supabase Auth sessions for portals |
| SELECT on PUBLIC_SAFE tables | 10 | Yes | events, event_passes, site_content, sponsors, team_members, payment_options, cities, villes, career_domains, career_application_fields |
| INSERT on contact/newsletter/phone | 3 | Yes | Insert-only policies; SELECT denied |
| INSERT/UPDATE/DELETE on sensitive tables | 57+ | **Dangerous if RLS fails** | Revoke in hardening migration |

**Count of dangerous grant groups:** **134** (67 tables × 2 roles with unnecessary INSERT/UPDATE/DELETE beyond minimum required).

**TRUNCATE:** Not present in grant query results for `anon`/`authenticated` (good).

---

## 5. Dangerous Policies

### 5.1 `USING (true)` SELECT policies (intentional public-read)

| Table | Policy | Risk |
|-------|--------|------|
| cities | `cities_public_select` | Low — reference data; writes denied live |
| villes | `villes_public_select` | Low — reference data; writes denied live |
| site_content | `site_content_public_select` | Low — CMS public content |
| sponsors | `sponsors_public_select` | Low — marketing |
| team_members | `team_members_public_select` | Low — marketing |
| payment_options | `Public can view payment options` | Low — method labels only |

**Count:** 6 — all **acceptable** PUBLIC_SAFE.

### 5.2 Legacy / misleading policies (not exploitable via anon today)

| Table | Policy | Issue |
|-------|--------|-------|
| scans | Admins can manage/view all scans | Uses `auth.uid()` — app uses custom admin JWT, not Supabase Auth |
| scans | Ambassadors can insert/view own scans | Uses `auth.uid()` — ambassadors use custom session |
| marketing_campaigns | Admins can manage | JWT `sub` claim from `request.jwt.claims` — not set for custom admin cookie |
| marketing_campaign_recipients | Admins can manage | Same |
| investor_contacts | Admins can manage | Same |
| official_invitations | Super admins × 4 | Uses `auth.uid()` — dead for direct client access |

**Count:** **12** risky/misleading policies. Effective access for these tables is via **service-role API**, not browser anon.

### 5.3 Missing `WITH CHECK` on UPDATE

| Table | Policy | Note |
|-------|--------|------|
| scans | Admins can manage all scans | Dead policy; UPDATE lacks with_check |
| marketing_* | Admins can manage | Dead policy |
| official_invitations | Super admins update | Dead policy |

Not exploitable today because policies never match for anon/authenticated clients.

### 5.4 Safe deny-all / service-only policies (representative)

- `admins_deny_all`, `orders_deny_all`, `tickets_deny_all`, `qr_tickets_deny_all`, `ambassadors_deny_all` — **correct**
- `contact_messages_anon_insert`, `newsletter_subscribers_anon_insert`, `phone_subscribers_anon_insert` — **correct** (insert-only, no SELECT)
- `csp_reports_service_insert`, `security_audit_logs_service_insert`, `aio_events_submissions_service_insert` — **correct**
- `scanners_service_role_all` — **correct**

---

## 6. Public Data Inventory

| Surface | Public? | Data exposed | Why | Acceptable? | Action |
|---------|---------|--------------|-----|-------------|--------|
| events | yes | Non-test, non-presale, active events | Public listings | Yes | None |
| event_passes | yes | Passes for listable events | Purchase UI | Yes | None |
| site_content | yes | CMS keys/values | Site rendering | Yes | None |
| sponsors, team_members | yes | Marketing content | About/home | Yes | None |
| payment_options | yes | Payment method config | Checkout | Yes | None |
| cities, villes | yes | City/ville reference | Forms | Yes | None |
| career_domains (open) | yes | Open job domains | Careers page | Yes | None |
| career_application_fields | yes | Fields for open domains | Apply form | Yes | None |
| contact_messages | INSERT only | Form submission | Contact page | Yes | No anon SELECT |
| newsletter_subscribers | INSERT only | Email signup | Footer | Yes | No anon SELECT |
| phone_subscribers | INSERT only | Phone capture | Marketing | Yes | No anon SELECT |
| hero-images bucket | yes (URLs) | Public media | CDN | Yes | No anon write |
| images bucket | yes (URLs) | Public media | CDN | Yes | Restrict LIST |
| storage.views | none | — | — | — | No public views in `public` schema |

---

## 7. Admin/Sensitive Tables

All verified **blocked** from anon direct access (deny_all or implicit deny + live count=0).

| Table | Expected classification | RLS | Anon access live | Status |
|-------|------------------------|-----|------------------|--------|
| admins | SERVICE_ROLE_ONLY | yes | denied | OK |
| admin_tab_access | SERVICE_ROLE_ONLY | yes | denied | OK |
| ambassador_sessions | SERVICE_ROLE_ONLY | yes | denied | OK |
| orders | SERVICE_ROLE_ONLY | yes | denied | OK |
| order_passes | SERVICE_ROLE_ONLY | yes | denied | OK |
| tickets | SERVICE_ROLE_ONLY | yes | denied | OK |
| qr_tickets | SERVICE_ROLE_ONLY | yes | denied | OK |
| ambassadors | SERVICE_ROLE_ONLY | yes | denied | OK |
| ambassador_applications | ADMIN_ONLY | yes | denied | OK |
| academy_registrations | SERVICE_ROLE_ONLY | yes | denied | OK |
| academy_promo_codes | SERVICE_ROLE_ONLY | yes | denied | OK |
| academy_influencers | SERVICE_ROLE_ONLY | yes | denied | OK |
| presale_codes / sessions | SERVICE_ROLE_ONLY | yes | denied | OK |
| scanners | SERVICE_ROLE_ONLY | yes | denied | OK |
| pos_users / outlets | SERVICE_ROLE_ONLY | yes | denied | OK |
| admin_logs, order_logs, sms_logs, site_logs | SERVICE_ROLE_ONLY | yes | denied | OK |
| security_audit_logs | SERVICE_ROLE_ONLY | yes | denied | OK |
| career_applications | SERVICE_ROLE_ONLY | yes | denied | OK |

**Payment proof data:** Table `academy_registrations` + bucket `academy-payment-proofs` (private) — anon blocked.

**Email delivery:** No dedicated `email_delivery_logs` table in schema; order email state on orders (denied).

---

## 8. RPC / Function Review

**Public views:** None in `public` schema.

### SECURITY DEFINER functions (selected)

| Function | SECURITY DEFINER | search_path locked | anon EXECUTE | Risk | Action |
|----------|------------------|-------------------|--------------|------|--------|
| is_service_role | yes | yes (`public, pg_catalog`) | **yes** | Medium | Revoke anon EXECUTE |
| is_admin_user | yes | yes | no (service_role only) | Low | OK |
| security_rls_policy_audit | yes | yes | no | Low | OK |
| validate_scanner_ticket_atomic | yes | yes (`public`) | no | Low | OK |
| insert_fulfillment_tickets_locked | yes | yes (`public`) | no | Low | OK |
| cleanup_old_logs | yes | yes | no | Low | OK |
| get_log_statistics | yes | yes | no | Low | OK |
| presale_* / event_promo_* (claim/release/rate) | yes | yes | no (service_role) | Low | OK |
| assign_order_to_ambassador | yes | yes | no | Low | OK |

### Non–SECURITY DEFINER with anon EXECUTE (trigger/helpers)

Functions like `generate_slug`, `auto_generate_event_slug`, `validate_order_status` are granted to anon but operate in invoker context on tables protected by RLS — **low risk**.

### Functions without locked search_path (SECURITY DEFINER = false)

Many trigger functions lack `search_path` — not SECURITY DEFINER, lower priority.

**Flagged:** `is_service_role()` callable by anon — returns false for anon but unnecessary surface.

---

## 9. Storage Bucket Review

| Bucket | Public | Policies | Anon probes | Risk | Action |
|--------|--------|----------|-------------|------|--------|
| academy-payment-proofs | **private** | service_role ALL | upload 400 | Low | OK |
| career-documents | **private** | service_role ALL | upload 400 | Low | OK |
| events | **private** | (no objects policy in query) | — | Low | Verify if used |
| tickets | **private** | service_role INSERT/UPDATE/DELETE only | public GET 400 | Low | OK |
| hero-images | **public** | service_role manage only | upload/delete 400 | Low | OK |
| images | **public** | service_role manage only | upload/delete 400; **LIST 200** | Medium | Restrict anon LIST |

**Confirmed private for sensitive assets:** tickets (QR), career-documents, academy-payment-proofs.

---

## 10. Final Verdict

## PASS

All 67 `public` tables have RLS enabled. Sensitive tables are blocked from anon/authenticated direct access. Intentional public-read policies are limited to safe marketing/reference/event data. Live anon regression and storage probes pass. No emergency action required.

Hardening recommended (grants revocation, legacy policy cleanup, explicit deny_all on implicit-deny tables) but does not change PASS status.

---

## 11. Fix Plan

**Do not implement yet — proposals only.**

### Emergency fixes

None.

### Short-term fixes

1. Revoke `INSERT`, `UPDATE`, `DELETE` from `anon`/`authenticated` on all SERVICE_ROLE_ONLY and ADMIN_ONLY tables.
2. Drop or replace 12 legacy `auth.uid()` / JWT-claim policies on `scans`, `marketing_*`, `investor_contacts`, `official_invitations`.
3. Revoke `EXECUTE ON FUNCTION is_service_role()` FROM anon, authenticated.
4. Add explicit `deny_all` policies on 26 implicit-deny tables (academy_*, presale_*, pos_*, etc.).
5. Restrict `images` bucket anon LIST while keeping public GET URLs.

### Hardening improvements

1. Lock `search_path` on remaining trigger functions flagged by Supabase advisor.
2. Document PUBLIC_SAFE tables in a single migration comment block.
3. Add CI `npm run security:rls` + `security:storage` to deployment checklist.
4. Consider revoking SELECT grant on insert-only tables (contact_messages, etc.) — redundant with RLS but clearer.

---

## 12. Appendix

### SQL queries used

All 8 queries from the audit specification were executed read-only against production.

### Files/migrations inspected

- `supabase/migrations/20260627120000_fix_critical_rls_exposure.sql`
- `supabase/migrations/20260627140000_fix_storage_bucket_security.sql`
- `supabase/migrations/20260627150000_harden_cities_csp_rpc_security.sql`
- `scripts/security/check-supabase-rls.mjs`
- `scripts/security/check-supabase-storage.mjs`

### DB environment checked

- **Production:** `ykeryyraxmtjunnotoep` (live read-only SQL + anon key probes)

### Checks completed

- RLS status all tables
- All policies
- Grants to anon/authenticated
- Public views (0)
- SECURITY DEFINER functions + execute grants
- Storage buckets + storage policies
- Live anon SELECT/INSERT/UPDATE/DELETE probes
- Storage anon upload/delete/list probes

### Checks not completed

- Authenticated Supabase Auth user probes (app uses custom auth, not Supabase Auth)
- Per-column sensitivity review (table-level only)
- Email delivery log table (not present in schema)

---

*Audit only. No DDL/DML changes were made.*
