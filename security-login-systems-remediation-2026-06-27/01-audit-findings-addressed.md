# Audit Findings Addressed

| ID | Finding | Severity | Status | Notes |
|----|---------|----------|--------|-------|
| F-01 | Scanner validate-ticket JWT-only | High | **Fixed** | `requireScannerAuthWithDb` on all scanner routes |
| F-02 | Duplicate-scan race | High | **Fixed** | RPC `validate_scanner_ticket_atomic` + unique index |
| F-03 | Service role → anon fallback | High | **Fixed** | `scanner-db.cjs`, `pos.js` fail-fast in prod |
| F-04 | Shared JWT_SECRET | Medium | **Deferred** | Documented; separate secrets planned separately |
| F-05 | scan.js JWT-only admin auth | Medium | **Fixed** | `verifyAdminSession` + `scanners:manage` |
| F-06 | No scanner login rate limit | Medium | **Fixed** | `scanner-login-rate-limit.cjs` |
| F-07 | Admin reset doesn't revoke sessions | Medium | **Fixed** | `revokeAllAmbassadorSessions` on PATCH password |
| F-08 | requires_password_change not enforced | Medium | **Fixed** | API 403 + `/ambassador/change-password` |
| F-09 | Plaintext temp passwords in email | Medium | **Deferred** | Out of scope for this patch |
| F-10 | No per-scanner event ACL | Medium | **Deferred** | Operational/business decision |
| F-11 | Ambassador min password 6 | Low | **Fixed** | Now 8+ with complexity |
| F-12 | In-memory rate limits | Low | **Open** | Same pattern as POS; Upstash recommended |
| F-13 | Legacy server.cjs validate-ticket | Low | **Deferred** | Not in Vercel rewrites |
| F-14 | Legacy scans RLS policies | Low | **Deferred** | No client regression found |
| F-15 | Public ambassadors/active PII | Info | **N/A** | By design for COD |
| F-16 | No payout APIs | Info | **N/A** | — |
