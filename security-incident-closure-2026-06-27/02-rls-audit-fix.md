# 02 — RLS Audit Fix (FIND-001)

## Migration

`supabase/migrations/20260627130000_fix_security_rls_policy_audit_insert_only.sql`

**Applied to production:** yes (`fix_security_rls_policy_audit_insert_only`)

## Change

`security_rls_policy_audit()` now excludes known insert-only policies:

- `contact_messages_anon_insert`
- `newsletter_subscribers_anon_insert`
- `phone_subscribers_anon_insert`

Still flags: `USING(true)`, `WITH CHECK(true)`, broad ALL policies, legacy unsafe names, RLS disabled.

## Script update

`scripts/security/check-supabase-rls.mjs` — client-side allowlist for same three policies.

## Result

```
npm run security:rls
RLS regression passed
Exit code: 0
```

All 16 private tables: count=0 + policy audit OK.
