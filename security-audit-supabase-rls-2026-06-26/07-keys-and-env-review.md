# 07 — Keys and Environment Variable Review

Read-only review of `env.example`, codebase grep, and Supabase MCP. **No secret values printed.**

---

## Variable inventory

| Variable | In repo | Exposed to browser | Purpose | Finding |
|----------|:-------:|:------------------:|---------|---------|
| `VITE_SUPABASE_URL` | env.example, client.ts | **Yes** | Supabase project URL | Expected for client |
| `VITE_SUPABASE_ANON_KEY` | env.example, client.ts | **Yes** | Publishable/anon key | Expected; **must pair with strict RLS** |
| `SUPABASE_URL` | env.example, api/* | No | Server Supabase URL | OK |
| `SUPABASE_ANON_KEY` | env.example, api/* | No | Server-side anon | OK on server |
| `SUPABASE_SERVICE_ROLE_KEY` | env.example, api/* | No | Bypass RLS | OK if Vercel/server only |
| `NEXT_PUBLIC_SUPABASE_URL` | **Not found** | — | — | Project uses Vite `VITE_*` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Not found** | — | — | Same |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` | **Not found** | — | — | **Good** — not referenced |
| `JWT_SECRET` | api admin auth | No | Admin JWT signing | Must be strong in production |
| `RECAPTCHA_SECRET_KEY` | admin-login | No | Server reCAPTCHA | OK |
| `VITE_RECAPTCHA_SITE_KEY` | Login.tsx | Yes (public site key) | Expected | OK |

---

## Service role exposed to frontend?

**No — confirmed by code search.**

- Client bundle: `src/integrations/supabase/client.ts` lines 5–6 use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- `src/lib/userErrors/internalErrorPatterns.ts` line 3 filters error messages matching `/service_role/i` from user-facing text.
- No `import.meta.env` reference to `SERVICE_ROLE` in `src/**`.

**Masked pattern if found in env:** `eyJhbGciOiJ***...***` (JWT service role key format).

---

## Committed .env files

| Check | Result |
|-------|--------|
| `.env` in workspace | **Not found** (glob 0 files) |
| `.env.local`, `.env.production` | **Not found** |
| `env.example` | Present — placeholder values only (`your_supabase_*_here`) |

**Good:** No committed live secrets detected in repository snapshot.

---

## Hardcoded secrets in source

| Location | Finding |
|----------|---------|
| `api/admin-login.js` line 25–26 | `DUMMY_BCRYPT_HASH` — public dummy hash for timing attack mitigation (not a live secret) |
| `api/admin-login.js` line 245 | `'fallback-secret-dev-only'` JWT fallback — **must not exist in production** (guarded by `isProductionRuntime()`) |
| Supabase URLs in logs | Host `ykeryyraxmtjunnotoep.supabase.co` visible in MCP logs (project ref, not secret) |

---

## Vercel environment references

| Source | Finding |
|--------|---------|
| `vercel.json` | No inline env vars |
| `docs/vercel-api-count-and-career-solution.md` | Documents RPC locked to service_role |
| UI copy in `EmailCampaignEditor.tsx` | Mentions `SUPABASE_SERVICE_ROLE_KEY` for operators (not a leak) |

**Not verified:** Actual Vercel project env configuration (requires Vercel dashboard / CLI access not performed).

---

## Key rotation recommendations (plan only)

1. Rotate **Supabase service role key** after RLS fix deploy (old key may have been used while DB was open).
2. Rotate **admin passwords** immediately (hashes may be readable via `admins_select`).
3. Rotate **JWT_SECRET** and force re-login (invalidates admin cookies).
4. Optionally rotate **anon key** after RLS hardening (embedded in old frontend bundles until redeploy).

---

## Anon key in browser — inherent exposure

The anon key is **intentionally public** in Supabase architecture. Security depends entirely on RLS. Current policies treat anon as full reader on sensitive tables — **configuration failure**, not key leakage.

---

## Supabase MCP / CLI local state

| File | Content | Risk |
|------|---------|------|
| `supabase/.temp/project-ref` | Project ref `ykeryyraxmtjunnotoep` | Low — not a secret |
| `supabase/.temp/cli-latest` | CLI metadata | Low |

Do not commit service role keys to these paths.
