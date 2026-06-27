# Current flow audit (pre-fix)

## Data-loading chain

1. **`GET /api/ambassador/me`** — session cookie → ambassador profile (`Dashboard.tsx` ~260–283)
2. **Browser Supabase anon** — `supabase.from("events").select(...)` (`Dashboard.tsx` ~493–496) **REMOVED**
3. **`filterAmbassadorDashboardEvents`** — excludes gallery, test (non-localhost) (`date-utils.ts` ~225–241)
4. **`selectedEventFilter`** — auto-set to first event; empty if no events (`Dashboard.tsx` ~503–507)
5. **`fetchData`** — skipped when `!selectedEventFilter` (`Dashboard.tsx` ~342–349)
6. **`GET /api/ambassador/orders?event_id=...`** — service role, works when called (`ambassador-routes.cjs` ~191–255)

## Why it broke

| Layer | Effect |
|-------|--------|
| RLS `events_public_select` | Hides `presale_enabled = true` from anon |
| Anon-visible rows | 6 legacy `event_type = gallery` events only |
| Frontend filter | Removes all gallery events |
| Result | 0 events → orders never fetched |

## Key files

| File | Role |
|------|------|
| `src/pages/ambassador/Dashboard.tsx` | Events + orders UI |
| `src/lib/date-utils.ts` | `filterAmbassadorDashboardEvents` |
| `api/_lib/ambassador-routes.cjs` | Orders/me auth handlers |
| `supabase/migrations/20260627120000_fix_critical_rls_exposure.sql` | `events_public_select` (unchanged) |
