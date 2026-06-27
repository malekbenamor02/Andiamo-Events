# GET /api/ambassador/events

## Route

- **Path:** `GET /api/ambassador/events`
- **Handler:** `handleAmbassadorEvents` in `api/_lib/ambassador-routes.cjs`
- **Registration:** `api/misc.js`, `server.cjs`, `vercel.json`

## Auth

- Uses `requireAmbassadorAuth(req, res, db)` — same as `/api/ambassador/me` and `/api/ambassador/orders`
- No session / invalid session → **401** (response handled by auth helper)

## Database client

- `getAmbassadorDb()` → `createAmbassadorDbClient()` → **Supabase service role** (server-only)

## Query filters (server)

1. SQL: `event_status <> 'cancelled'`, `event_type <> 'gallery'`
2. Production: exclude `is_test = true` (localhost dev may include test events)
3. JS: `isEventOnAmbassadorDashboardSelector` — active/upcoming or completed within 30-day lookback (matches admin dashboard selector logic)
4. No assignment table in schema — all qualifying sellable events returned

## Response fields (safe)

```json
{
  "events": [
    {
      "id": "...",
      "name": "...",
      "date": "...",
      "event_type": "upcoming",
      "event_status": "active",
      "presale_enabled": true,
      "venue": "...",
      "city": "..."
    }
  ]
}
```

Excluded from response: `is_test`, internal/admin fields, notes, financial config.

## Expected production events

- **MAHRAJEN**, **Coming Soon** (presale, active, upcoming)
- Not included: gallery legacy events, cancelled, test (production)
