# Frontend refactor

## Files changed

| File | Change |
|------|--------|
| `src/pages/ambassador/Dashboard.tsx` | Replace Supabase events read with `GET /api/ambassador/events` |
| `src/lib/api-routes.ts` | Add `AMBASSADOR_EVENTS` |
| `src/pages/ambassador/components/NewOrdersTab.tsx` | Empty state uses `t.noAssignedOrders` |

## Removed

```typescript
// Dashboard.tsx — REMOVED
import { supabase } from "@/integrations/supabase/client";
supabase.from("events").select("id,name,date,event_type,event_status,is_test")...
```

## Added

```typescript
fetch(`${getApiBaseUrl()}${API_ROUTES.AMBASSADOR_EVENTS}`, { credentials: "include" })
```

## Selection behavior

- On success: auto-select first event if none selected
- On empty list: `selectedEventFilter = ""`, show **"No active ambassador events available."**
- `filterAmbassadorDashboardEvents` kept as defensive fallback (does not remove presale/upcoming)

## Orders

- Unchanged: `fetchData` calls `/api/ambassador/orders` when `selectedEventFilter` is set
- Empty orders message: **"No orders for this event."**
