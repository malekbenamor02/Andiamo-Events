# Staging test results

**Environment:** Local Supabase (`supabase db reset`) — no Supabase staging branch exists.

**Date:** 2026-06-27  
**Branch:** `security/fix-supabase-rls-critical`

## Automated checks

| Check | Command | Result |
|-------|---------|--------|
| Build | `npm run build` | **Pass** (2026-06-27) |
| Lint | `npm run lint` | Pre-existing project errors (not introduced by this branch) |
| RLS regression | `npm run security:rls` | **Skipped locally** — Docker/Supabase local stack unavailable |
| DB migrations | `supabase db reset` | **Skipped** — Docker Desktop not running on dev machine |

## Manual smoke (local)

| Flow | Status | Notes |
|------|--------|-------|
| Public home / events | Pending manual | |
| Event detail | Pending manual | |
| Contact form INSERT | Pending manual | |
| Newsletter INSERT | Pending manual | |
| Checkout create order | Pending manual | Requires service role in API env |
| Admin login | Pending manual | Requires `SUPABASE_SERVICE_ROLE_KEY` |
| Dashboard bootstrap | Pending manual | |
| Ambassador login / orders | Pending manual | |
| Scanner validate ticket | Pending manual | API path |

## Anon regression script

After local reset, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to local stack values, then:

```bash
npm run security:rls
```

Expected: all private tables denied or count 0; public events pass filter check.

## Blockers

- Production migration **not applied** (by design until explicit approval).
- Local validation requires Docker + Supabase CLI for full DB reset.
