# Stock Calculation Verification Test

This document explains how to verify that stock calculations are correct after running the fix migration.

## Quick Test

Run this SQL query in your Supabase SQL editor to verify all stock calculations:

```sql
SELECT * FROM verify_stock_calculations();
```

### Expected Results

1. **No discrepancies**: All rows should show `discrepancy = 0`
2. **If discrepancies exist**: The query will show:
   - `pass_id`: The pass with the issue
   - `pass_name`: Name of the pass (e.g., "Zone B")
   - `current_sold_quantity`: What's currently stored
   - `calculated_sold_quantity`: What it should be
   - `discrepancy`: The difference (should be 0)
   - `status_breakdown`: JSON showing order counts by status

## Detailed Verification

### Test 1: Check Specific Pass (e.g., Zone B)

```sql
SELECT 
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity as current_sold,
    -- Count PAID orders
    (SELECT COALESCE(SUM(op.quantity), 0)
     FROM order_passes op
     JOIN orders o ON o.id = op.order_id
     WHERE op.pass_id = ep.id 
       AND o.status = 'PAID') as paid_count,
    -- Count PENDING_CASH orders (not released)
    (SELECT COALESCE(SUM(op.quantity), 0)
     FROM order_passes op
     JOIN orders o ON o.id = op.order_id
     WHERE op.pass_id = ep.id 
       AND o.status = 'PENDING_CASH'
       AND o.stock_released = false) as pending_cash_count,
    -- Count REMOVED_BY_ADMIN orders (should NOT be in sold_quantity)
    (SELECT COALESCE(SUM(op.quantity), 0)
     FROM order_passes op
     JOIN orders o ON o.id = op.order_id
     WHERE op.pass_id = ep.id 
       AND o.status = 'REMOVED_BY_ADMIN') as removed_count,
    -- Expected sold_quantity
    (SELECT COALESCE(SUM(op.quantity), 0)
     FROM order_passes op
     JOIN orders o ON o.id = op.order_id
     WHERE op.pass_id = ep.id 
       AND o.status NOT IN ('REMOVED_BY_ADMIN', 'REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'CANCELLED_BY_ADMIN')
       AND (
         o.status IN ('COMPLETED', 'PAID', 'MANUAL_COMPLETED')
         OR (o.status IN ('PENDING_CASH', 'PENDING_ONLINE', 'MANUAL_ACCEPTED', 'PENDING_ADMIN_APPROVAL', 'PENDING_AMBASSADOR_CONFIRMATION') 
             AND o.stock_released = false)
       )) as expected_sold
FROM event_passes ep
WHERE ep.name LIKE '%Zone B%'  -- Adjust pass name as needed
ORDER BY ep.name;
```

### Test 2: Verify All Passes

```sql
-- Check all passes for discrepancies
SELECT 
    ep.name,
    ep.max_quantity,
    ep.sold_quantity,
    v.calculated_sold_quantity,
    v.discrepancy,
    CASE 
        WHEN v.discrepancy = 0 THEN '✅ Correct'
        WHEN v.discrepancy > 0 THEN '⚠️ Too High'
        ELSE '⚠️ Too Low'
    END as status
FROM event_passes ep
LEFT JOIN verify_stock_calculations() v ON v.pass_id = ep.id
WHERE v.discrepancy != 0 OR ep.sold_quantity > 0
ORDER BY ABS(COALESCE(v.discrepancy, 0)) DESC;
```

### Test 3: Check Order Status Breakdown

```sql
-- See how orders are distributed by status for a specific pass
SELECT 
    ep.name as pass_name,
    o.status,
    COUNT(*) as order_count,
    SUM(op.quantity) as total_quantity,
    BOOL_OR(o.stock_released) as any_released,
    BOOL_AND(o.stock_released) as all_released
FROM event_passes ep
JOIN order_passes op ON op.pass_id = ep.id
JOIN orders o ON o.id = op.order_id
WHERE ep.name LIKE '%Zone B%'  -- Adjust pass name as needed
GROUP BY ep.name, o.status
ORDER BY ep.name, o.status;
```

## What to Check

### ✅ Correct Behavior

1. **sold_quantity** should equal:
   - All PAID orders
   - All PENDING_CASH orders where `stock_released = false`
   - All PENDING_ONLINE orders where `stock_released = false`
   - All other pending orders where `stock_released = false`

2. **sold_quantity** should NOT include:
   - REMOVED_BY_ADMIN orders
   - REJECTED orders
   - CANCELLED orders
   - Any orders where `stock_released = true`

### ⚠️ If You Find Discrepancies

1. **Check if REMOVED_BY_ADMIN orders have stock_released = true**:
   ```sql
   SELECT id, status, stock_released, created_at
   FROM orders
   WHERE status = 'REMOVED_BY_ADMIN'
     AND stock_released = false;
   ```
   
   If any exist, their stock needs to be released manually.

2. **Check for orders that should have stock released but don't**:
   ```sql
   SELECT o.id, o.status, o.stock_released, COUNT(op.id) as pass_count
   FROM orders o
   JOIN order_passes op ON op.order_id = o.id
   WHERE o.status IN ('REJECTED', 'CANCELLED', 'REMOVED_BY_ADMIN')
     AND o.stock_released = false
   GROUP BY o.id, o.status, o.stock_released;
   ```

3. **Manually release stock for problematic orders** (if needed):
   ```sql
   -- This should be done via the API endpoint, but if needed:
   -- Call releaseOrderStock() function for each order
   ```

## Expected Results After Fix

For Zone B pass:
- **Max stock**: 32
- **sold_quantity**: Should be 17 (PAID) + 12 (PENDING_CASH, not released) = 29
- **Remaining**: 32 - 29 = 3
- **REMOVED_BY_ADMIN orders**: Should NOT be counted (7 passes should be excluded)

**Total from views should match sold_quantity:**
- Ticket management: 17 (PAID only)
- Ambassadors sales - paid: 17 (PAID)
- Ambassadors sales - pending cash: 12 (PENDING_CASH)
- **Total in sold_quantity**: 17 + 12 = 29 ✅
- **REMOVED_BY_ADMIN**: 7 (excluded from sold_quantity) ✅

## Running the Test

1. **After migration**: Run `SELECT * FROM verify_stock_calculations();`
2. **Check for discrepancies**: Look for rows where `discrepancy != 0`
3. **If all discrepancies are 0**: ✅ Stock calculations are correct!
4. **If discrepancies exist**: Follow the troubleshooting steps above
