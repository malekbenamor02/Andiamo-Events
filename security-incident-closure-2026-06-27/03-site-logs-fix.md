# 03 — Site Logs Fix (FIND-003)

## Approach: **Option A** (API ingest)

## New route

`POST /api/site-logs` → `api/_lib/client-site-log.js`

- Service role insert to `site_logs`
- Rate limit: 30 req/min/IP
- Allowlisted fields only (`SITE_LOG_CLIENT_FIELDS`)
- Rejects messages/details containing password/token/bcrypt patterns
- Server sets `user_agent` and `ip_address` from request headers

## Frontend

`src/lib/logger.ts` — replaced direct Supabase insert with `fetch('/api/site-logs')`.

## RLS

`site_logs_deny_all` **unchanged**. Browser Supabase inserts remain blocked (correct).

## Verification

- Build: PASS
- Production route live: **after Vercel deploy**
- Expected: Supabase logs show `POST /rest/v1/site_logs` from **node** (service role), not browser 401s
