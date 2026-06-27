# Final Risk Register

| ID | Severity | System | Risk | Owner | Next action |
|----|----------|--------|------|-------|-------------|
| R-01 | Medium | All JWT portals | Shared `JWT_SECRET` | Engineering | Split secrets in planned migration |
| R-02 | Low | Scanner/POS | In-memory rate limits reset on cold start | Engineering | Upstash like admin login |
| R-03 | Medium | Ambassador/Influencer | Plaintext temp passwords in email | Ops | Setup-link flow |
| R-04 | Medium | Scanner | No per-event scanner assignment | Product | ACL if required |
| R-05 | Low | Legacy | `server.cjs` unauthenticated validate-ticket | Engineering | Remove or gate |
| R-06 | Low | scans RLS | Legacy ambassador scan policies | DBA | Drop unused policies |
| R-07 | Info | RPC | Migration must be applied with code | DevOps | Deploy checklist |

## Pentest readiness

After migration + deploy + manual checklist: **recommended for scanner-focused retest**.

Remaining deferred items are not blockers for scanner/POS/ambassador login retest but should be tracked.
