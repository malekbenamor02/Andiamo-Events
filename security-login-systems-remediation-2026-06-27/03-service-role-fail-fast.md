# Service Role Fail-Fast

## Problem

`api/scan.js` and `api/pos.js` used `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY`, allowing privileged operations on anon key if service role was missing.

## Solution

### `api/_lib/scanner-db.cjs`

- Production/Vercel: **requires** `SUPABASE_SERVICE_ROLE_KEY`
- Local dev: optional anon fallback only when `ALLOW_DEV_ANON_FALLBACK=true`
- Returns `null` client + `dbConfigErrorResponse()` (503) when misconfigured

### `api/pos.js`

- Same rules via shared helpers from `scanner-db.cjs` + `supabase-env.cjs`
- Handler returns 503 if client is null

### Public exception

`GET /api/scan-system-status` still returns `{ enabled: false }` when DB unavailable (non-sensitive metadata).

## Env

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Required in production for scanner/POS |
| `ALLOW_DEV_ANON_FALLBACK` | Local dev only; default off |

## Verification

- Production without service role → 503 on scanner login / validate / POS routes
- `npm run security:rls` — anon private table access still blocked
