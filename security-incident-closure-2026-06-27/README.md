# Security Incident Closure — 2026-06-27

## Final status: **Contained → closure fixes deployed**

| Layer | Status |
|-------|--------|
| Original RLS anon exposure | **Fixed** |
| Follow-up code fixes | **Deployed to production** (2026-06-27) |
| DB migrations (audit + admin sessions) | **Applied to production** |
| `npm run security:rls` | **Exit 0** |
| Admin sessions | **Invalidated** via `session_version=2` |
| Admin password reset | **Required** — all 8 admins must change password |

## Fixes in this closure batch

1. **FIND-002** — Application selections migrated to `/api/admin/application-selections*` (service role + `applications:manage`).
2. **FIND-001** — `security_rls_policy_audit()` updated; `npm run security:rls` passes.
3. **FIND-003** — Client logging via `POST /api/site-logs` (rate-limited, allowlisted).
4. **FIND-007** — Admin `session_version` + `requires_password_change`; `/api/admin/change-password` added.

## Deploy required

**Done.** Production: https://www.andiamoevents.com (deployment `8HNmS4f8kBNvW4qnjSTamj7c9qFE`).

## JWT secret rotation

**Manual ops:** Rotate `JWT_SECRET` in Vercel production env for defense-in-depth. Migration already invalidates cookies via `session_version`.

## Documents

| File | Topic |
|------|-------|
| `01-application-selections-fix.md` | FIND-002 |
| `02-rls-audit-fix.md` | FIND-001 |
| `03-site-logs-fix.md` | FIND-003 |
| `04-password-reset-session-invalidation.md` | FIND-007 |
| `05-final-smoke-tests.md` | Test matrix |
| `06-pentester-retest-package.md` | External retest brief |
| `07-final-risk-register.md` | Remaining risks |

No secrets or PII in this package.
