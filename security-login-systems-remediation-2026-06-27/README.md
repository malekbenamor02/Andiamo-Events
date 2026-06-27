# Login Systems Security Remediation — 2026-06-27

## Summary

Implemented defensive hardening from `security-login-systems-audit-2026-06-27.md` on branch `security/fix-login-systems-auth-hardening`.

### Fixed (P1/P2)

- Scanner DB revalidation on all authenticated scanner routes (including `validate-ticket`)
- Atomic ticket validation via PostgreSQL RPC + partial unique index (duplicate-scan race)
- Service-role fail-fast for scanner/POS (no silent anon fallback in production)
- Scanner login rate limiting (IP + email, 6 / 15 min)
- Scanner admin routes use `verifyAdminSession` + `scanners:manage` permission
- Admin ambassador password reset revokes all ambassador sessions
- Ambassador `requires_password_change` enforced (API + frontend change-password flow)
- Ambassador password policy raised to 8+ chars with complexity (influencer rules)

### Deferred (documented)

- Separate JWT secrets per role
- Plaintext temp password emails → setup links
- Per-scanner event ACL
- Centralized portal login audit table
- 2FA/MFA
- Legacy `server.cjs` `/api/validate-ticket` removal (local dev only)

## Production status

**Not deployed.** Code and migration are ready for owner review.

**Deploy order:** code → apply migration `20260627180000_atomic_scanner_ticket_validation.sql` → post-deploy scanner tests.

## Evidence index

| File | Contents |
|------|----------|
| `01-audit-findings-addressed.md` | Finding status matrix |
| `02-scanner-validation-hardening.md` | Scanner auth + atomic validation |
| `03-service-role-fail-fast.md` | POS/scan DB client behavior |
| `04-rate-limits-and-admin-auth.md` | Rate limits + admin session verify |
| `05-ambassador-session-password-reset.md` | Ambassador session/password |
| `06-migrations.md` | SQL migration summary |
| `07-build-and-test-output.md` | Build/test commands |
| `08-final-risk-register.md` | Remaining risks |
| `09-production-deployment-plan.md` | Deploy checklist |
