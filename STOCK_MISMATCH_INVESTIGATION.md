# Stock Mismatch Investigation Report

## User's Expectation
**Expected Formula:** `max_stock = paid + pending_cash`

## Current System Behavior

### What `sold_quantity` Currently Includes:

The `sold_quantity` field in `event_passes` table is calculated from orders where:
1. `stock_released = false` (stock hasn't been released back)
2. Status is NOT in excluded list: `REMOVED_BY_ADMIN`, `REJECTED`, `CANCELLED`, `CANCELLED_BY_AMBASSADOR`, `CANCELLED_BY_ADMIN`
3. Status IS in one of these categories:

   **PAID Orders (counted):**
   - `COMPLETED`
   - `PAID`
   - `MANUAL_COMPLETED`

   **PENDING Orders (also counted):**
   - `PENDING_CASH` ✅ (user expects this)
   - `PENDING_ONLINE` ❌ (user doesn't expect this)
   - `MANUAL_ACCEPTED` ❌ (user doesn't expect this)
   - `PENDING_ADMIN_APPROVAL` ❌ (user doesn't expect this)
   - `PENDING_AMBASSADOR_CONFIRMATION` ❌ (user doesn't expect this)

## The Problem

**Current Formula:** `sold_quantity = PAID + PENDING_CASH + PENDING_ONLINE + MANUAL_ACCEPTED + PENDING_ADMIN_APPROVAL + PENDING_AMBASSADOR_CONFIRMATION`

**User's Expected Formula:** `sold_quantity = PAID + PENDING_CASH`

### Why There's a Mismatch:

1. **Additional Pending Statuses**: The system counts ALL pending orders, not just `PENDING_CASH`. This includes:
   - `PENDING_ONLINE` - Online payment orders that are pending
   - `MANUAL_ACCEPTED` - Manually accepted orders
   - `PENDING_ADMIN_APPROVAL` - Orders waiting for admin approval (like POS orders)
   - `PENDING_AMBASSADOR_CONFIRMATION` - Orders waiting for ambassador confirmation

2. **Stock Release Logic**: Orders with `stock_released = true` are correctly excluded, but if there are any orders with `stock_released = true` that still have status `PAID` or `PENDING_CASH`, they shouldn't be counted (and currently aren't).

3. **POS Orders**: Point of Sale orders with status `PENDING_ADMIN_APPROVAL` are being counted in stock, which might not match the user's expectation.

## Where This Logic Lives

### Database Function:
- **File:** `supabase/migrations/20250301000000-fix-sold-quantity-exclude-removed-orders.sql`
- **Function:** The `sold_quantity` is recalculated by a migration that counts orders with the statuses listed above.

### Key Code Section:
```sql
AND (
    -- Completed/paid orders (always count if stock not released)
    o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
    -- Pending orders that haven't released stock (reserved stock)
    OR o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
)
```

## How to Investigate Further

I've created a SQL file `INVESTIGATE_STOCK_MISMATCH.sql` with 5 diagnostic queries:

1. **Query 1**: Shows current stock status for all passes
2. **Query 2**: Compares current `sold_quantity` vs expected (PAID + PENDING_CASH only) and shows the difference
3. **Query 3**: Shows what OTHER pending statuses are being counted (the ones user doesn't expect)
4. **Query 4**: Shows orders with `stock_released = true` that might be incorrectly counted
5. **Query 5**: Summary by status for each pass showing breakdown of all order statuses

## Possible Scenarios

### Scenario 1: Only PENDING_CASH Should Count
If the user wants ONLY `PENDING_CASH` to count (not other pending statuses), then:
- `PENDING_ONLINE` orders are inflating the count
- `PENDING_ADMIN_APPROVAL` (POS orders) are inflating the count
- `MANUAL_ACCEPTED` and `PENDING_AMBASSADOR_CONFIRMATION` are inflating the count

### Scenario 2: All Pending Should Count But There's a Bug
If all pending should count, then there might be:
- Orders with `stock_released = true` that are still being counted
- Orders in excluded statuses that are being counted
- Calculation timing issues (sold_quantity not updated after order status changes)

### Scenario 3: Stock Release Not Working Correctly
If orders are being rejected/cancelled but stock isn't being released:
- `stock_released` flag might not be set to `true`
- `sold_quantity` might not be decremented
- This would cause `sold_quantity` to be higher than expected

## Recommendations

1. **Run the diagnostic queries** in `INVESTIGATE_STOCK_MISMATCH.sql` to see exactly what's being counted
2. **Check if the user wants ONLY `PENDING_CASH`** or if other pending statuses should also count
3. **Verify stock release is working** - check if rejected/cancelled orders have `stock_released = true`
4. **Check for timing issues** - is `sold_quantity` being recalculated after order status changes?

## Files to Check

- `supabase/migrations/20250301000000-fix-sold-quantity-exclude-removed-orders.sql` - Stock calculation logic
- `supabase/migrations/20250301000002-enhance-stock-release-with-fallback.sql` - Stock release logic
- `api/orders-create.js` - Where orders are created and stock is reserved
- `server.cjs` - Where stock is released on order cancellation/rejection
