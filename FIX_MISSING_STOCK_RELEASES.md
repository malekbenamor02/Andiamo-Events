# Fix Missing Stock Releases

## Problem

You found 1 `REMOVED_BY_ADMIN` order that still has `stock_released = false`. This means the stock was never released when the order was removed.

## Solution

A new migration has been created to:
1. ✅ Find all orders that should have stock released but don't
2. ✅ Release stock for those orders
3. ✅ Verify all orders are fixed

## What You Need to Do

### Step 1: Find the Problematic Order

Run this query to see which order needs fixing:

```sql
-- Find orders that should have stock released but don't
SELECT 
    o.id,
    o.status,
    o.stock_released,
    o.created_at,
    o.updated_at,
    COUNT(op.id) as pass_count,
    SUM(op.quantity) as total_quantity
FROM orders o
JOIN order_passes op ON op.order_id = o.id
WHERE o.status IN (
    'REMOVED_BY_ADMIN',
    'REJECTED',
    'CANCELLED',
    'CANCELLED_BY_AMBASSADOR',
    'CANCELLED_BY_ADMIN',
    'REFUNDED'
)
  AND o.stock_released = false
  AND op.pass_id IS NOT NULL
GROUP BY o.id, o.status, o.stock_released, o.created_at, o.updated_at;
```

### Step 2: Run the Fix Migration

**Option A: Using Supabase CLI**
```bash
supabase migration up
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project → SQL Editor
2. Open the file: `supabase/migrations/20250301000001-fix-missing-stock-releases.sql`
3. Copy all contents and paste into SQL Editor
4. Click "Run"

### Step 3: Verify the Fix

After running the migration, verify all orders are fixed:

```sql
-- Should return 0 rows
SELECT 
    o.id,
    o.status,
    o.stock_released
FROM orders o
WHERE o.status IN (
    'REMOVED_BY_ADMIN',
    'REJECTED',
    'CANCELLED',
    'CANCELLED_BY_AMBASSADOR',
    'CANCELLED_BY_ADMIN',
    'REFUNDED'
)
  AND o.stock_released = false;
```

**Expected**: 0 rows (all orders should have `stock_released = true`)

### Step 4: Recalculate Stock

After fixing the stock releases, recalculate `sold_quantity`:

```sql
-- Run the main migration again to recalculate
-- Or run just the recalculation part from 20250301000000-fix-sold-quantity-exclude-removed-orders.sql
```

Or simply run:
```sql
SELECT * FROM verify_stock_calculations() WHERE discrepancy != 0;
```

## What the Migration Does

1. **Finds problematic orders**: Orders with status REJECTED/CANCELLED/REMOVED_BY_ADMIN that have `stock_released = false`
2. **Releases stock**: 
   - Sets `stock_released = true`
   - Decrements `sold_quantity` for each pass in the order
3. **Verifies fix**: Checks that all orders are now fixed

## Manual Fix (If Migration Doesn't Work)

If the migration doesn't fix the order, you can manually release stock:

```sql
-- 1. Find the order ID
SELECT id, status, stock_released 
FROM orders 
WHERE status = 'REMOVED_BY_ADMIN' 
  AND stock_released = false;

-- 2. Replace {ORDER_ID} with the actual order ID, then run:
DO $$
DECLARE
    order_id_to_fix UUID := '{ORDER_ID}'; -- Replace with actual order ID
BEGIN
    -- Set stock_released flag
    UPDATE orders
    SET stock_released = true
    WHERE id = order_id_to_fix
      AND stock_released = false;
    
    -- Decrement sold_quantity for each pass
    UPDATE event_passes ep
    SET sold_quantity = GREATEST(0, sold_quantity - op.quantity)
    FROM order_passes op
    WHERE op.order_id = order_id_to_fix
      AND op.pass_id = ep.id
      AND op.pass_id IS NOT NULL
      AND ep.sold_quantity >= op.quantity;
    
    RAISE NOTICE '✅ Stock released for order %', order_id_to_fix;
END $$;
```

## Why This Happened

Possible reasons:
1. **Stock release failed silently** - Error occurred but wasn't logged
2. **Order was removed before stock release was implemented** - Legacy order
3. **Race condition** - Order was removed while stock release was in progress
4. **API endpoint issue** - Stock release wasn't called in one of the removal paths

## Prevention

The migration ensures:
- ✅ All existing problematic orders are fixed
- ✅ Future orders will have stock released correctly (code already handles this)
- ✅ The calculation logic excludes orders with `stock_released = true`

## After Fixing

1. ✅ Run the verification query to confirm 0 problematic orders
2. ✅ Run `verify_stock_calculations()` to ensure no discrepancies
3. ✅ Check that stock counts match across all views
4. ✅ Test creating a new order to ensure stock is available

---

**Next Step**: Run the migration `20250301000001-fix-missing-stock-releases.sql` to fix the 1 problematic order.
