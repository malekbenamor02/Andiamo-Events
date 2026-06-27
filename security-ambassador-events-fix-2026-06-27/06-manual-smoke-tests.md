# Manual smoke tests — 2026-06-27

## Production API (automated)

| Test | URL | Expected | Actual |
|------|-----|----------|--------|
| Unauth events | `GET https://www.andiamoevents.com/api/ambassador/events` | 401 | **401** |
| Unauth orders | `GET https://www.andiamoevents.com/api/ambassador/orders` | 401 | **401** |

## Browser (manual — post-deploy)

1. **Login** — `/ambassador/auth` as approved ambassador (e.g. Malek Ben amor)
2. **Dashboard** — `/ambassador/dashboard` shows welcome message
3. **Events dropdown** — should list **MAHRAJEN** and **Coming Soon** (presale)
4. **Auto-select** — first event selected automatically
5. **Network tab** — confirm:
   - `GET /api/ambassador/events` → 200, `{ events: [...] }`
   - `GET /api/ambassador/orders?status=PENDING_CASH&event_id=...` → 200
6. **Empty orders** — if no PENDING_CASH for that ambassador/event: **"No orders for this event."**
7. **Not shown** — "No active ambassador events available." when events exist

## Malek Ben amor (27169477)

- Expected: events dropdown populated (MAHRAJEN / Coming Soon)
- Expected: may have **zero** new orders on presale events (no assignments yet) — correct empty state
- Historical orders were on completed gallery event (El Daheeh) — not in current presale dropdown

## Deployment

- Production alias: https://www.andiamoevents.com
- Deployment ID: `dpl_W2PbUm4Jz57PT7XwDtzdYCHBjBki`
