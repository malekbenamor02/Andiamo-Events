# Ambassador dashboard events fix — 2026-06-27

## Summary

After Supabase RLS hardening, the ambassador dashboard loaded events via the browser **anon** Supabase client. Presale events (`presale_enabled = true`) are hidden from anon SELECT, and the remaining anon-visible rows were legacy **gallery** events filtered out by the frontend. Result: zero events → no `selectedEventFilter` → orders API never called.

## Fix

- Added **`GET /api/ambassador/events`** — ambassador session + service role server-side.
- Updated **`src/pages/ambassador/Dashboard.tsx`** to fetch events from the API (no browser Supabase reads).
- Preserved RLS hardening; no policy changes.

## Status

- Code: implemented
- Build: pass (`npm run build`)
- RLS regression: pass (`npm run security:rls`)
- Production deploy: see `06-manual-smoke-tests.md`
