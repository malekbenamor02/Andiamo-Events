# Staging environment (branch: `staging`)

This document describes how to run **real staging validation** without touching production Supabase or production Vercel env.

## 1. Vercel — browser-accessible QA URL

The `staging` branch deploys a **Preview** on each push.

### Option A — Disable Preview Protection (recommended for QA)

1. Vercel → **Project** → **Settings** → **Deployment Protection**
2. For **Preview** deployments, disable **Vercel Authentication** / password protection for the **`staging`** branch (or all Preview deployments used for QA).
3. Redeploy the `staging` branch after changing protection.

### Option B — Custom domain alias

1. Vercel → **Project** → **Settings** → **Domains**
2. Add `staging.andiamoevents.com` (or subdomain you control)
3. Assign the domain to **Preview** environment and the **`staging`** Git branch.

### Option C — Keep protection (manual QA with login)

If Preview stays protected (401), testers must open the deployment URL in a browser, click **Log in with Vercel**, then run QA.

**Typical Preview URL pattern:** `https://andiamo-events-<hash>-<team>.vercel.app`

## 2. Supabase — staging database (do not use production for RLS tests)

Production project ref (live site): **`ykeryyraxmtjunnotoep`** — **do not apply RLS migration here.**

Choose one:

| Option | Action |
|--------|--------|
| **A — Separate staging project** | Supabase Dashboard → New project → copy URL + anon + service role into Vercel **Preview** env for branch `staging` |
| **B — Pro branching** | Upgrade plan → create branch `staging` → use branch credentials in Vercel Preview env |
| **C — Blocked** | If neither A nor B is available, **RLS cannot be safely validated** on a isolated DB; stop before production RLS apply |

## 3. Vercel environment variables (Preview / `staging` branch only)

In Vercel → **Settings** → **Environment Variables**, scope to **Preview** (and optionally **Development**):

| Variable | Notes |
|----------|--------|
| `VITE_SUPABASE_URL` | Staging project URL |
| `VITE_SUPABASE_ANON_KEY` | Staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service role (server only) |
| `JWT_SECRET` | Staging-only secret |
| Payment / SMS / email | Test or sandbox credentials only |

**Do not** point Preview `staging` at production Supabase if you intend to apply RLS on staging.

## 4. Apply RLS migration (staging DB only)

After staging Supabase exists and Preview env vars are set:

```bash
# Using Supabase CLI linked to STAGING project (not production)
supabase link --project-ref <STAGING_PROJECT_REF>
supabase db push
# OR apply the single file via Dashboard SQL / MCP apply_migration on staging project_id only
```

File: `supabase/migrations/20260616000000_harden-admin-privileged-table-rls.sql`

## 5. Smoke checklist

With staging URL + staging DB + RLS applied:

```bash
BASE_URL=https://<your-staging-url> ./scripts/admin-auth-smoke.sh
# Set ADMIN_EMAIL / ADMIN_PASSWORD for steps 4–5
```

Manual browser QA: homepage, events, checkout (test mode), ambassador, admin login, orders/POS/reports/settings tabs.

## 6. Production safety

- Do **not** merge `staging` → `main` until staging sign-off.
- Do **not** apply RLS to production until staging validation passes.
