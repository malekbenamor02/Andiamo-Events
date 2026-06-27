# 09 — Findings & Fixes Needed

| ID | Severity | Area | Evidence | Impact | Required fix | Owner | Priority |
|----|----------|------|----------|--------|--------------|-------|----------|
| FIND-001 | Low | Tooling | `npm run security:rls` exit 1; audit flags insert-only policies | CI noise; false alarm | Exclude INSERT-only narrow policies from permissive audit | Eng | P2 |
| FIND-002 | Medium | Admin UX | `useApplicationSelections.ts` direct Supabase on deny-all tables | Applications draft selections tab broken | Add admin API routes; migrate hook | Eng | P1 |
| FIND-003 | Low | Observability | `logger.ts` → `site_logs` insert gets 401 | Client-side activity logging lost | Route logs via API/service role or drop client insert | Eng | P2 |
| FIND-004 | Low | Hardening | `ambassador_sessions` RLS on, 0 policies | Implicit deny (secure) but unclear | Add explicit `deny_all` policy in forward migration | Eng | P3 |
| FIND-005 | Info | Pre-existing | `cities`/`villes` USING(true) ALL | Public reference data; not P0 scope | Review separately if admin-only desired | Eng | P4 |
| FIND-006 | Info | Testing | Admin permission matrix untested live | Unknown 403 behavior for restricted admins | Run scripted tests with test admin accounts | Security | P2 |
| FIND-007 | Info | Post-incident | Admin password reset / JWT rotation | Session hygiene after exposure | Complete incident checklist | Ops | P1 |

## Confirmed fixed (no finding)

- Anon SELECT row exposure on admins/orders/tickets/qr_tickets/logs/subscribers
- Unauthenticated `/api/admin/*` access
- Service role key in client bundle
- Client bcrypt password hashing in admin UI
- Broad public RLS on private tables (no rollback detected)
