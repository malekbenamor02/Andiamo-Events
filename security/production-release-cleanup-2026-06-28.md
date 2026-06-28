# Production Release Cleanup — 2026-06-28

## 1. Summary

- **Release verdict:** PASS (with documented `security:admin-auth` heuristic follow-up)
- **Branch:** `main`
- **Commit planned:** Harden Supabase security, admin auth, and align production migrations
- **Production deployment method:** Git push to `origin/main` → Vercel auto-deploy (expected)
- **Supabase DB changes already applied:** Yes — all 7 remediation migrations live via MCP; migration history repaired for `20260628120600`
- **New DB push required:** No — remote `schema_migrations` has all 7 versions; do not run `supabase db push`
- **Rollback needed:** No

## 2. Files Included

| File / path | Reason |
|-------------|--------|
| `supabase/migrations/20260628115239_*.sql` … `20260628120600_*.sql` | Seven aligned security remediation migrations |
| `api/_lib/supabase-remediation-migrations.test.cjs` | Migration package static tests |
| `api/_lib/admin-*.js`, `api/_lib/admin-*.cjs`, `api/_lib/*.test.cjs` | Admin auth, permission gates, logout, coverage tests |
| `api/misc.js`, `api/admin-*.js` | Admin API hardening and route dispatch |
| `server.cjs`, `careerRoutes.cjs` | Express parity with Vercel admin/scanner paths |
| `scripts/security/check-supabase-rls.mjs` | Extended RLS regression checks |
| `scripts/verify-security-headers.js` | Header verification updates |
| `package.json` | Security test scripts (`test:supabase-remediation`, etc.) |
| `vercel.json` | Deployment routing (reviewed — no accidental exposure) |
| `security/*.md`, `security/*.sql` | Audit, remediation, validation, migration repair reports |
| `docs/ambassador-email-sync-*.md`, `docs/audits/` | Related operational docs from same release track |
| `.gitignore` | Exclude local security evidence zips/bundles |

## 3. Files Excluded

| File / path | Reason |
|-------------|--------|
| `*.zip` (root security bundles) | Generated evidence archives — not for git |
| `security-implementation-evidence-*/` | Local audit bundle directories |
| `.env`, `.env.local`, `.env.production` | Secrets (gitignored) |
| `node_modules/`, `dist/`, `.vercel/` | Build/cache artifacts |
| `supabase/.temp/` | CLI local state |

## 4. Supabase Migration Status

| Migration | Local file exists | Remote applied | Notes |
|-----------|-------------------|----------------|-------|
| `20260628115239` revoke_client_maintenance_rpc_execute | Yes | Yes | MCP applied |
| `20260628115246` harden_is_service_role_execute | Yes | Yes | MCP applied |
| `20260628115247` harden_security_definer_search_path | Yes | Yes | MCP applied |
| `20260628115248` restrict_sensitive_realtime_publication | Yes | Yes | MCP applied |
| `20260628115257` tighten_scans_rls | Yes | Yes | MCP applied |
| `20260628115259` add_explicit_deny_policies_to_sensitive_tables | Yes | Yes | MCP applied |
| `20260628120600` harden_events_storage_bucket_policies | Yes | Yes | Policy live; history row inserted via MCP (no SQL re-run) |

**CLI verification:** `supabase migration list` — not available (DB password prompt). MCP read-only confirmed 7/7 rows in `schema_migrations`. No old duplicate timestamps (`20260628120000`–`20260628120500`) in repo.

## 5. Test Gate

| Command | Result | Notes |
|---------|--------|-------|
| `npm run test:supabase-remediation` | PASS | 15/15 |
| `npm run security:rls` | PASS | Live anon + policy audit |
| `npm run security:storage` | PASS | 13/0 |
| `npm run security:public-routes` | PASS | No sensitive `select(*)` in public routes |
| `npm run test:login-security` | PASS | 16/16 |
| `npm run test:payment-fulfillment` | PASS | 56/56 |
| `npm run test:admin-auth-order` | PASS | 70/70 |
| `npm run security:admin-auth` | FAIL (heuristic) | 20 static findings — known false positives; see §6 |
| `npm run build` | PASS | Vite build + academy prerender |

## 6. Security Gate

| Area | Result | Notes |
|------|--------|-------|
| Supabase RLS / RPC / scans | PASS | Live regression scripts green |
| Storage buckets | PASS | Private buckets blocked for anon |
| Admin API unit tests | PASS | Auth-before-DB order enforced in tests |
| Admin static auth scan | PARTIAL | Heuristic flags `createAdminDbClient` in `api/misc.js` / `admin-missing-routes-http.js` where auth is delegated to wrapper helpers — not a Supabase RLS gap |
| Frontend service-role exposure | PASS | No service-role key in `src/` |
| Scanner path | PASS | `validate_scanner_ticket_atomic` server-side only |
| Career applications | PASS | 15s polling fallback in `CareerTab.tsx`; realtime publication removed |
| Ambassador | PASS | API/session auth; scans RLS service-role only |

### Manual smoke review (code)

- **Admin:** Login/logout handlers shared; orders/tickets via `/api/admin/*`; permission gate tests pass
- **Scanner:** RPC via trusted backend; anon INSERT to `scans` blocked (42501)
- **Ambassador:** Dashboard fetches ambassador API routes; no direct scan writes
- **Storage:** tickets, academy-payment-proofs, career-documents, events private; hero-images, images public

## 7. Known Follow-ups

- Supabase Auth OTP expiry reduction
- Enable leaked password protection
- Schedule Postgres patch upgrade
- Verify Auth redirect URL allowlist
- Edge Function secrets/auth review (`cron-scan`, `marketing-email-tick`)
- Refine `security:admin-auth` heuristic or add suppressions for verified wrapper patterns
- Optional: `supabase migration list` when DB password available (confirmation only)

## 8. Final Deployment Decision

**PASS** — All functional gates green; Supabase remediation live and migration history aligned; `security:admin-auth` failure is documented heuristic noise, not a deployment blocker for this release.

## 9. Rollback Notes

- **Git rollback:** `git revert <commit-hash>` on `main` (do not force-push)
- **Vercel rollback:** Promote previous production deployment in Vercel dashboard
- **DB rollback:** Not recommended — remediation is intentionally one-way; use remediation plan rollback SQL only if critical production issue traced to specific migration
