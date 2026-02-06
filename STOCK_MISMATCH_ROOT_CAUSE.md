# Stock Mismatch Root Cause Analysis

## Key Finding

**The calculation logic is CORRECT, but the stored `sold_quantity` values are OUT OF SYNC.**

### Evidence from Query Results:

| Zone | Stored Value | Expected (PAID + PENDING_CASH) | System Calculated | Difference | Status |
|------|-------------|-------------------------------|-------------------|------------|--------|
| Zone A | 50 | 51 | 51 | -1 | **Stored value is 1 too low** |
| Zone B | 35 | 37 | 37 | -2 | **Stored value is 2 too low** |
| Zone C | 87 | 83 | 83 | +4 | **Stored value is 4 too high** |

## Important Observations:

1. ✅ **`system_calculated_quantity` = `expected_sold_quantity`** for all zones
   - This proves the calculation logic is working correctly
   - The system knows what the correct value should be

2. ❌ **`actual_sold_quantity` (stored in database) ≠ `expected_sold_quantity`**
   - The stored values in `event_passes.sold_quantity` are stale/out of sync
   - This is a **data synchronization issue**, not a logic bug

3. ✅ **`other_pending_quantity = 0`** for all zones
   - This confirms there are NO other pending statuses being counted
   - The calculation is correctly excluding them

## Root Cause:

The `sold_quantity` field in the `event_passes` table has not been recalculated after recent order changes. The stored values are outdated.

### Possible Reasons:

1. **Timing Issue**: Orders were created/modified but the `sold_quantity` recalculation function wasn't triggered
2. **Manual Modification**: Someone manually changed `sold_quantity` values in the database
3. **Recalculation Not Running**: The stock recalculation function/migration hasn't been executed recently
4. **Transaction Issue**: Orders were added in a transaction that didn't trigger the recalculation trigger

## Solution:

**The `sold_quantity` needs to be recalculated** using the existing recalculation function.

### The Recalculation Function:

Located in: `supabase/migrations/20250301000000-fix-sold-quantity-exclude-removed-orders.sql`

This function recalculates `sold_quantity` based on:
- Orders with `stock_released = false`
- Status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED', 'PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION')
- Status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', etc.)

### To Fix:

Run the recalculation function/migration to update `sold_quantity` values. After recalculation:
- Zone A: Should become 51 (currently 50)
- Zone B: Should become 37 (currently 35)
- Zone C: Should become 83 (currently 87)

## Why Zone C is Different:

Zone C shows +4, meaning the stored value is HIGHER than expected. This could mean:
1. The stored value was manually set higher at some point
2. Some orders were counted but later had their stock released or status changed
3. The recalculation hasn't run since those changes

## Next Steps:

1. **Run the recalculation function** to sync `sold_quantity` with actual orders
2. **Verify the results** match expected values (PAID + PENDING_CASH)
3. **Set up automatic recalculation** if not already in place (triggers, scheduled jobs, etc.)

## Files to Check:

- `supabase/migrations/20250301000000-fix-sold-quantity-exclude-removed-orders.sql` - Recalculation logic
- Check if there are database triggers that should auto-update `sold_quantity`
- Check if there's a scheduled job/cron that should run recalculation
