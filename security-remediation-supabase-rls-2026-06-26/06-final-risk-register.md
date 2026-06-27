# Final risk register (post-remediation)

| Risk | Severity | Mitigation | Status |
|------|----------|------------|--------|
| Historical exfiltration before fix | High | Password reset, key rotation, log review | Open — ops |
| Migration not yet on production | Critical | Apply after approval + deploy code first | **Blocked** |
| `site_logs` client INSERT (`logger.ts`) | Low | Secondary migration if abuse observed | Accepted |
| Bulk newsletter Excel import without API | Medium | Admin UI shows error; add API if needed | Partial |
| Dashboard partial migration stray calls | Medium | Grep gate in CI | Mitigated — Dashboard clean |
| No Supabase staging branch | Medium | Local `db reset` + prod approval gate | Accepted |
| Ambassador `auth.uid()` unused in old policies | Low | All access via API + service role | Mitigated |
| `verify_admin_credentials` RPC not added | Low | Node bcrypt in admin-login sufficient | Accepted |

## Residual allowed anon access

| Table | Operation |
|-------|-----------|
| `events` | Filtered SELECT |
| `event_passes` | Presale-gated SELECT |
| `site_content`, `sponsors`, `team_members`, `payment_options` | SELECT |
| `contact_messages`, `newsletter_subscribers`, `phone_subscribers` | INSERT only |

## Sign-off

Remediation code ready on branch `security/fix-supabase-rls-critical`. Production SQL apply requires explicit user approval per [`04-production-deployment-checklist.md`](04-production-deployment-checklist.md).
