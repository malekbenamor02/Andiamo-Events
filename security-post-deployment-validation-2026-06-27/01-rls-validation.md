# 01 — RLS Validation

## Methods

- `npm run security:rls` (production URL + anon + service role from local env)
- `scripts/security/anon-rls-spot-check.mjs` (count/status only)
- Supabase MCP read-only SQL (policy metadata, RLS flags)
- No row dumps

## Anon SELECT (private tables)

All tested tables returned **count=0** (no error, no rows):

| Table | Result |
|-------|--------|
| admins | count=0 |
| orders | count=0 |
| tickets | count=0 |
| qr_tickets | count=0 |
| ambassadors | count=0 |
| ambassador_applications | count=0 |
| contact_messages | count=0 |
| newsletter_subscribers | count=0 |
| phone_subscribers | count=0 |
| sms_logs | count=0 |
| order_logs | count=0 |
| admin_logs | count=0 |
| site_logs | count=0 |
| career_applications | count=0 |
| audience_suggestions | count=0 |
| order_passes | count=0 |
| admin_tab_access | count=0 |
| ambassador_application_selections | count=0 |

**Pass** — no sensitive row exposure via anon SELECT.

### Special columns

| Check | Result |
|-------|--------|
| `qr_tickets.secure_token` SELECT limit 1 | 0 rows |
| events public filter | 6 listable events visible; no test/presale/cancelled leakage |

## Anon write access

| Action | Target | Result |
|--------|--------|--------|
| INSERT | orders | BLOCKED (42501) |
| INSERT | admins | BLOCKED (PGRST204) |
| INSERT | tickets | BLOCKED (42501) |
| INSERT | events | BLOCKED (42501) |
| INSERT | contact_messages + `status=approved` | BLOCKED (42501) |
| INSERT | contact_messages (valid, no RETURNING) | **ALLOWED** (intentional) |
| INSERT | newsletter + `import_label` | BLOCKED (42501) |
| INSERT | newsletter (plain) | BLOCKED (23505 duplicate — prior test email) |
| UPDATE | orders | 0 rows affected (RLS filters all rows) |
| DELETE | contact_messages | 0 rows deleted |

**Pass** — anon cannot mutate private/admin data. Elevated field injection on contact/newsletter blocked.

**Note:** Anon cannot read back inserted contact messages (SELECT count=0 by design).

## RLS enabled (SQL verification)

All sensitive tables: `rls_enabled = true`.

## Policy summary (sensitive tables)

| Pattern | Tables |
|---------|--------|
| `*_deny_all` USING(false) | admins, orders, tickets, qr_tickets, ambassadors, logs, etc. |
| Insert-only narrow WITH CHECK | contact_messages, newsletter_subscribers, phone_subscribers |
| Scoped SELECT | events, event_passes |
| Deny anon | admin_tab_access, order_expiration_settings |

No `USING (true)` on sensitive tables (SQL confirmed empty set).

Legacy unsafe policy names: **[]**

## `npm run security:rls`

| Item | Result |
|------|--------|
| Exit code | **1** |
| Classification | **Audit false positive** (not live exposure) |
| Anon counts | All private tables count=0 |
| Failure reason | Audit RPC flags insert-only policies because `with_check ILIKE '%IS NULL%'` matches `(import_label IS NULL)` and `(status IS NULL)` |

### Expected after fix

Exit **0** once `security_rls_policy_audit()` and/or `check-supabase-rls.mjs` exclude INSERT-only policies with narrow WITH CHECK from the permissive list.

## Gaps

| Item | Severity | Notes |
|------|----------|-------|
| ambassador_sessions | Low | RLS on, **0 policies** — implicit deny (secure); add explicit deny-all recommended |
| cities / villes | Info | Pre-existing public reference tables with USING(true) — out of original P0 scope |
