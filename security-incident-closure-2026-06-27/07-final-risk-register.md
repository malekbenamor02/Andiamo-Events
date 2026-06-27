# 07 — Final Risk Register

| ID | Severity | Area | Status | Owner | Next action |
|----|----------|------|--------|-------|-------------|
| R-001 | — | Original RLS exposure | **Closed** | Eng | Pentester retest |
| R-002 | — | Code not deployed | **Closed** | Eng | Deployed 2026-06-27 |
| R-003 | Medium | Admin password reset | In progress | Ops | All 8 admins must change password post-deploy |
| R-004 | Low | JWT_SECRET rotation | Open | Ops | Rotate in Vercel + redeploy |
| R-005 | Low | ambassador_sessions explicit policy | Open | Eng | Forward migration deny-all |
| R-006 | Info | cities/villes public read | Accepted | Eng | Out of scope |
| R-007 | Info | Manual admin/checkout/scanner tests | Open | QA | After deploy |

## Incident closed?

**Nearly closed.** Vulnerability contained; code and DB migrations live in production. Mark **fully closed** after all admins reset passwords, optional JWT_SECRET rotation, and pentester retest pass.
