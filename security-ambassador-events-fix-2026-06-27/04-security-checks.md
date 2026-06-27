# Security checks

| # | Check | Result |
|---|-------|--------|
| 1 | `GET /api/ambassador/events` without session → 401 | Verified post-deploy (see smoke tests) |
| 2 | Logged-in ambassador → 200 with events | Verified post-deploy |
| 3 | Response includes presale events | MAHRAJEN, Coming Soon (service-role query) |
| 4 | Response excludes gallery events | SQL `neq('event_type','gallery')` |
| 5 | Response excludes cancelled | SQL `neq('event_status','cancelled')` |
| 6 | Test events excluded in production | `requestAllowsTestEvents` + filter |
| 7 | No `supabase.from("events")` in ambassador Dashboard | Confirmed grep clean |
| 8 | Service role not in frontend bundle | Unchanged; key server-only |
| 9 | `/api/ambassador/orders` still requires auth | Unchanged handler |
| 10 | Orders API called after event selection | Unchanged `fetchData` flow |
| 11 | No RLS policy changes | `events_public_select` untouched |
| 12 | `npm run security:rls` | **PASS** (exit 0) |
