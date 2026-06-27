# Supabase RLS Critical Remediation

**Branch:** `security/fix-supabase-rls-critical`  
**Date started:** 2026-06-27  
**Target project:** `ykeryyraxmtjunnotoep` (production — migration **not applied** until explicit approval)

## Status

| Phase | Status |
|-------|--------|
| Migration file | Done — `supabase/migrations/20260627120000_fix_critical_rls_exposure.sql` |
| Backend hardening | Done |
| Frontend refactor | Done |
| Security regression script | Done — `npm run security:rls` |
| Local validation | See `03-staging-test-results.md` |
| Production apply | **Blocked — awaiting your explicit approval** |

## Documentation

| File | Purpose |
|------|---------|
| [01-policy-remediation-plan.md](01-policy-remediation-plan.md) | SQL / RLS strategy |
| [02-code-remediation-plan.md](02-code-remediation-plan.md) | API + frontend changes |
| [03-staging-test-results.md](03-staging-test-results.md) | Local validation log |
| [04-production-deployment-checklist.md](04-production-deployment-checklist.md) | **Approval gate** |
| [05-security-regression-tests.md](05-security-regression-tests.md) | `security:rls` + verification |
| [06-final-risk-register.md](06-final-risk-register.md) | Residual risks |
| [verification.sql](verification.sql) | Post-apply SQL audit |

## Confirmed vulnerabilities (pre-fix)

- `admins_select` and related policies allowed anon SELECT including password hashes
- `orders` ALL policies with `USING (true)`
- `tickets` / `qr_tickets` public read policies
- PII tables: open SELECT on contact_messages, subscribers, ambassadors, logs

## See also

- Audit: [`../security-audit-supabase-rls-2026-06-26/`](../security-audit-supabase-rls-2026-06-26/)

## Next step

Review this branch, run local checks, then approve production migration per [04-production-deployment-checklist.md](04-production-deployment-checklist.md).
