# Post-Deployment Security Validation — 2026-06-27

**Target:** https://www.andiamoevents.com  
**Supabase project:** `ykeryyraxmtjunnotoep`  
**Migration:** `fix_critical_rls_exposure` (v6)  
**Validation type:** Authorized defensive pentest (safe, non-destructive)

## Overall verdict: **Partially secure**

The **original Critical Supabase RLS anon SELECT exposure is fixed**. Private tables return zero rows to the anon key; deny-all and narrow insert-only policies are in place. Unauthenticated admin API routes consistently return **401**. No service role key was found in the frontend bundle.

Remaining gaps are **operational / follow-up**, not re-openings of the original vulnerability:

| Area | Status |
|------|--------|
| Anon read of private tables | **Fixed** |
| Anon write to admin/order/ticket tables | **Blocked** |
| Admin API without cookie | **401** |
| `npm run security:rls` | **Exit 1** (audit false positive — not live exposure) |
| Public site core flows | **Mostly working** |
| Admin application selections tab | **Likely broken** (still uses direct Supabase) |
| Client `site_logs` writes | **Blocked by RLS** (expected; logging degraded) |
| Authenticated permission matrix | **Not fully tested** (needs test admin accounts) |

## Highest-risk findings

1. **None Critical** — original data exposure appears contained.
2. **Medium (functional):** `useApplicationSelections` still queries `ambassador_application_selections` via browser Supabase; RLS deny-all returns empty — admin draft selections UI likely broken.
3. **Low (tooling):** `security_rls_policy_audit()` / `npm run security:rls` false-positives on intentional insert-only policies.
4. **Low (hardening):** `ambassador_sessions` has RLS enabled but zero explicit policies (implicit deny — secure, but should get explicit deny-all for clarity).

## Old RLS exposure fixed?

**Yes** — for direct anon SELECT on sensitive tables. Count-only tests across 18 private tables returned **0 rows**. No password hashes or secure tokens returned. QR ticket token column returned **0 rows**.

## App still works?

**Mostly yes** — homepage, events, phone subscribe API, scanner status, and unauthenticated API rejection work. Contact/newsletter inserts work via anon (insert-only). Admin authenticated flows and checkout were **not fully exercised** in this session (no test credentials / no payment).

## Documents in this package

| File | Contents |
|------|----------|
| `01-rls-validation.md` | Anon access + policy audit |
| `02-api-authz-validation.md` | Admin route auth tests |
| `03-public-flow-smoke-tests.md` | Public endpoints |
| `04-admin-flow-smoke-tests.md` | Admin (limited) |
| `05-ticket-scanner-tests.md` | Scanner / QR |
| `06-service-role-and-mass-assignment.md` | Backend route review |
| `07-frontend-bundle-review.md` | Bundle / client Supabase usage |
| `08-logs-review.md` | Supabase API log summary |
| `09-findings-and-fixes-needed.md` | Findings register |
| `10-final-go-no-go.md` | Pentester retest recommendation |

**No secrets, PII, or customer/admin records are printed in this package.**
