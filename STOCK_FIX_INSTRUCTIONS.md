# Stock Calculation Fix - Instructions

## Problem Summary

The `sold_quantity` field in `event_passes` was counting `REMOVED_BY_ADMIN` orders, causing discrepancies:
- **Pass stock view**: Shows 32 passes (max_quantity)
- **Ticket management**: Shows 17 passes sold (PAID only)
- **Ambassadors sales - paid**: Shows 17 passes (PAID)
- **Ambassadors sales - pending cash**: Shows 12 passes (PENDING_CASH)
- **Ambassadors sales - removed**: Shows 7 passes (REMOVED_BY_ADMIN)
- **Total**: 36 passes, but max stock is only 32 ❌

The issue: `REMOVED_BY_ADMIN` orders (7 passes) were being counted in `sold_quantity` when they shouldn't be.

## Solution

A migration has been created to:
1. ✅ Recalculate `sold_quantity` correctly (excluding REMOVED_BY_ADMIN, REJECTED, CANCELLED orders)
2. ✅ Create a verification function to test calculations
3. ✅ Automatically verify the fix after migration

## What You Need to Do

### Step 1: Run the Migration

The migration file is: `supabase/migrations/20250301000000-fix-sold-quantity-exclude-removed-orders.sql`

**If using Supabase CLI:**
```bash
supabase migration up
```

**If using Supabase Dashboard:**
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy the contents of the migration file
4. Run it

### Step 2: Verify the Fix

After running the migration, verify the calculations are correct:

```sql
SELECT * FROM verify_stock_calculations();
```

**Expected result**: All rows should show `discrepancy = 0`

### Step 3: Check Your Specific Pass (Zone B)

Run this query to verify Zone B pass:

```sql
SELECT 
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity as current_sold,
    -- Expected: 17 (PAID) + 12 (PENDING_CASH) = 29
    (SELECT COALESCE(SUM(op.quantity), 0)
     FROM order_passes op
     JOIN orders o ON o.id = op.order_id
     WHERE op.pass_id = ep.id 
       AND o.status = 'PAID') as paid_count,
    (SELECT COALESCE(SUM(op.quantity), 0)
     FROM order_passes op
     JOIN orders o ON o.id = op.order_id
     WHERE op.pass_id = ep.id 
       AND o.status = 'PENDING_CASH'
       AND o.stock_released = false) as pending_cash_count,
    (SELECT COALESCE(SUM(op.quantity), 0)
     FROM order_passes op
     JOIN orders o ON o.id = op.order_id
     WHERE op.pass_id = ep.id 
       AND o.status = 'REMOVED_BY_ADMIN') as removed_count_should_be_zero
FROM event_passes ep
WHERE ep.name LIKE '%Zone B%';
```

**Expected results:**
- `current_sold`: Should be 29 (17 + 12)
- `paid_count`: 17
- `pending_cash_count`: 12
- `removed_count_should_be_zero`: 7 (but NOT counted in current_sold)

### Step 4: Verify in the Application

1. **Check Pass Stock view**: Should show remaining = 3 (32 - 29 = 3)
2. **Check Ticket Management**: Should show 17 passes sold
3. **Check Ambassadors Sales - Paid**: Should show 17 passes
4. **Check Ambassadors Sales - Pending Cash**: Should show 12 passes
5. **Check Ambassadors Sales - Removed**: Should show 7 passes (but these are NOT in sold_quantity)

**All numbers should now match!** ✅

## If You Find Issues

### Issue 1: Discrepancies Still Exist

If `verify_stock_calculations()` shows discrepancies:

1. **Check if REMOVED_BY_ADMIN orders have stock_released = false**:
   ```sql
   SELECT id, status, stock_released
   FROM orders
   WHERE status = 'REMOVED_BY_ADMIN' AND stock_released = false;
   ```

2. **If any exist**, their stock needs to be released. The migration should handle this, but if not:
   - These orders should have had their stock released when they were removed
   - You may need to manually trigger stock release for these orders

### Issue 2: Numbers Still Don't Match

If the numbers still don't match after the migration:

1. **Check the verification function results**:
   ```sql
   SELECT * FROM verify_stock_calculations() 
   WHERE pass_name LIKE '%Zone B%';
   ```

2. **Check order status breakdown**:
   ```sql
   SELECT 
       o.status,
       COUNT(*) as order_count,
       SUM(op.quantity) as total_quantity
   FROM orders o
   JOIN order_passes op ON op.order_id = o.id
   JOIN event_passes ep ON ep.id = op.pass_id
   WHERE ep.name LIKE '%Zone B%'
   GROUP BY o.status;
   ```

3. **Contact support** with the results if the issue persists

## What Changed

### Before Fix:
- `sold_quantity` counted: PAID + PENDING_CASH + **REMOVED_BY_ADMIN** ❌
- Result: 17 + 12 + 7 = 36 (exceeds max of 32)

### After Fix:
- `sold_quantity` counts: PAID + PENDING_CASH (where stock_released = false) ✅
- Excludes: REMOVED_BY_ADMIN, REJECTED, CANCELLED ✅
- Result: 17 + 12 = 29 (within max of 32) ✅

## Testing Checklist

- [ ] Migration runs successfully
- [ ] `verify_stock_calculations()` shows no discrepancies
- [ ] Zone B pass shows correct sold_quantity (29)
- [ ] Pass stock view shows correct remaining (3)
- [ ] Ticket management shows 17 passes sold
- [ ] Ambassadors sales - paid shows 17 passes
- [ ] Ambassadors sales - pending cash shows 12 passes
- [ ] Ambassadors sales - removed shows 7 passes (excluded from stock)

## Additional Notes

- The fix also applies to **order type passes** (same stock system)
- The verification function can be run anytime to check stock accuracy
- Future orders will automatically follow the correct calculation rules
- The migration is idempotent (safe to run multiple times)
