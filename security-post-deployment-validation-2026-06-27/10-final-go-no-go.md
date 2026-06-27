# 10 — Final Go / No-Go

## Can we tell the pentester to retest?

**Yes — with scope notes.**

Request retest focused on:

1. Anon Supabase REST access to private tables (should be empty/denied)
2. Unauthenticated admin API routes (401/403)
3. Authenticated permission bypass attempts
4. Regression check that no `USING (true)` read policies returned on P0 tables

Provide pentester the known false positive: insert-only contact/newsletter/phone policies may appear in internal audit tooling but are intentional.

## Is the old vulnerability fixed?

**Yes** — for the reported Critical issue (anon/public direct read of private Supabase tables).

Evidence:

- 18/18 private tables count=0 via anon key
- Deny-all policies active on P0/P1 tables
- No legacy unsafe policy names
- Admin data path moved to service-role API

**Partial** only for:

- Residual client code paths that *attempt* private access but get empty/denied (selections, site_logs)
- Pre-existing public reference tables (cities/villes)

## Remaining production risks

| Risk | Level |
|------|-------|
| Data re-exposure via RLS rollback | None observed |
| Admin API bypass without auth | None observed |
| Broken admin selections workflow | Medium (availability) |
| Incomplete post-incident hygiene (password reset, log review) | Medium (process) |
| Audit script false positives | Low |

## Must fix immediately?

| Item | Immediate? |
|------|------------|
| Re-open RLS | **No — do not** |
| FIND-002 application selections API migration | **Yes** (admin feature broken) |
| FIND-007 password reset / session invalidation | **Yes** (incident process) |
| FIND-001 audit script | No (tooling) |

## Verdict

**GO for pentester retest of the original RLS finding.**  
**NO-GO for declaring 100% regression-clean CI** until FIND-001 fixed.  
**NO-GO for declaring all admin features healthy** until FIND-002 verified with login.
