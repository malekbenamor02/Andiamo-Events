# Fix: Expired Orders Rejection Issue

## Problem
- Manual reject button shows success message but doesn't work
- Expired orders don't change to REJECTED status
- Stock doesn't return when orders are rejected

## Root Causes Identified

1. **Database Function Issue**: The `auto_reject_expired_pending_cash_orders()` function was using an older version of `release_order_stock_internal()` that didn't handle orders with `pass_id = NULL`.

2. **Missing Error Handling**: The function didn't properly verify that status updates actually occurred before counting them.

3. **Insufficient Logging**: The API endpoint didn't provide enough diagnostic information to identify why orders weren't being rejected.

## Fixes Applied

### 1. Database Migration: `20250301000003-fix-auto-reject-expired-orders.sql`

**What it does:**
- ✅ Recreates `auto_reject_expired_pending_cash_orders()` function with enhanced error handling
- ✅ Ensures it uses the enhanced `release_order_stock_internal()` with `pass_type` fallback
- ✅ Verifies status updates actually occurred before counting
- ✅ Adds comprehensive logging for debugging
- ✅ Handles edge cases (orders changed by other processes, stock already released, etc.)

**Key improvements:**
- Uses `GET DIAGNOSTICS` to verify status update actually happened
- Logs warnings when stock release fails (but continues processing)
- Logs errors when status update fails
- Better exception handling to prevent one failed order from stopping the entire process

### 2. API Endpoint Enhancement: `api/misc.js`

**What it does:**
- ✅ Checks how many expired orders exist BEFORE calling the function
- ✅ Provides diagnostic information in the response
- ✅ Logs warnings when expired orders are found but not rejected
- ✅ Better error messages to help identify issues

**New response includes:**
- `expired_orders_found`: Number of expired orders found before rejection
- `rejected_count`: Number actually rejected
- Better error messages explaining what happened

### 3. Diagnostic Queries: `DIAGNOSE_EXPIRED_ORDERS.sql`

**What it provides:**
- Query to find all expired orders
- Query to identify orders that should be rejected but aren't
- Query to check if orders have `pass_id` set (required for stock release)
- Query to test the function manually
- Query to check recent rejection logs
- Query to verify stock release status

## How to Apply the Fix

### Step 1: Run the Database Migration

1. Go to Supabase Dashboard → SQL Editor
2. Open the migration file: `supabase/migrations/20250301000003-fix-auto-reject-expired-orders.sql`
3. Copy and paste the entire content
4. Run the migration
5. Verify it completes successfully

### Step 2: Deploy Code Changes

1. The `api/misc.js` file has been updated
2. Deploy to your hosting platform (Vercel, etc.)
3. The changes will take effect immediately

### Step 3: Test the Fix

1. **Check for expired orders:**
   ```sql
   -- Run Query 1 from DIAGNOSE_EXPIRED_ORDERS.sql
   SELECT * FROM orders 
   WHERE status = 'PENDING_CASH' 
     AND expires_at < NOW() 
     AND rejected_at IS NULL;
   ```

2. **Test the function manually:**
   ```sql
   -- Run Query 4 from DIAGNOSE_EXPIRED_ORDERS.sql
   SELECT * FROM auto_reject_expired_pending_cash_orders();
   ```

3. **Click the manual reject button** in the admin dashboard
4. **Check the response:**
   - Should show `expired_orders_found` count
   - Should show `rejected_count` (should match if fix worked)
   - Check browser console for detailed logs

4. **Verify orders were rejected:**
   ```sql
   SELECT id, status, rejected_at, stock_released 
   FROM orders 
   WHERE id IN (-- IDs from rejected_order_ids in response);
   ```

5. **Verify stock was released:**
   ```sql
   -- Check if sold_quantity decreased
   SELECT ep.name, ep.sold_quantity, ep.max_quantity
   FROM event_passes ep
   WHERE ep.id IN (
     SELECT DISTINCT op.pass_id 
     FROM order_passes op 
     WHERE op.order_id IN (-- rejected order IDs)
   );
   ```

## Expected Behavior After Fix

### Before Fix:
- ❌ Button shows success but `rejected_count: 0`
- ❌ Orders remain `PENDING_CASH` status
- ❌ Stock not released
- ❌ No diagnostic information

### After Fix:
- ✅ Button shows actual count of rejected orders
- ✅ Orders change to `REJECTED` status
- ✅ Stock is automatically released
- ✅ Diagnostic information shows what happened
- ✅ Better error messages if something fails

## Troubleshooting

### Issue: Still showing `rejected_count: 0` but `expired_orders_found > 0`

**Possible causes:**
1. Orders might have `rejected_at` already set (check Query 2)
2. Orders might not have `expires_at` set (check Query 1)
3. Orders might have wrong status (not exactly `PENDING_CASH`)
4. Orders might be locked by another process

**Solution:**
- Run diagnostic queries to identify the issue
- Check `order_logs` for error messages
- Verify orders meet all conditions in the WHERE clause

### Issue: Stock not released

**Possible causes:**
1. Orders have `pass_id = NULL` in `order_passes` (check Query 3)
2. `pass_type` doesn't match any `event_passes.name`
3. Stock already released (`stock_released = true`)

**Solution:**
- Run Query 3 to check `pass_id` status
- Verify `pass_type` matches `event_passes.name` for the event
- Check if `stock_released` is already `true` (shouldn't be for PENDING_CASH)

### Issue: Function returns error

**Check:**
1. Supabase logs for detailed error messages
2. Verify `release_order_stock_internal()` function exists (migration 20250301000002)
3. Check database permissions

## Files Changed

1. ✅ `supabase/migrations/20250301000003-fix-auto-reject-expired-orders.sql` (NEW)
2. ✅ `api/misc.js` (ENHANCED)
3. ✅ `DIAGNOSE_EXPIRED_ORDERS.sql` (NEW - diagnostic tool)

## Next Steps

1. **Run the migration** in Supabase
2. **Deploy the code changes** to your hosting platform
3. **Test the manual reject button**
4. **Verify orders are rejected and stock is released**
5. **Check diagnostic queries** if issues persist

## Verification Checklist

- [ ] Migration ran successfully
- [ ] Code deployed to production
- [ ] Manual reject button works
- [ ] Expired orders change to REJECTED status
- [ ] Stock is released (sold_quantity decreases)
- [ ] Response shows correct counts
- [ ] No errors in console/logs
