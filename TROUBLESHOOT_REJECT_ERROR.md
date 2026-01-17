# Troubleshooting: "Failed to auto-reject expired orders" Error

## Quick Diagnosis Steps

### Step 1: Check if the Database Function Exists

Run this in Supabase SQL Editor:

```sql
-- Check if function exists
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'auto_reject_expired_pending_cash_orders';
```

**Expected:** Should return 1 row with the function definition.

**If empty:** The migration hasn't been run. Go to Step 2.

---

### Step 2: Run the Required Migrations

The function requires these migrations to be run **in order**:

1. **First**: `20250301000002-enhance-stock-release-with-fallback.sql`
   - Creates/enhances `release_order_stock_internal()` with pass_type fallback
   - Creates the safety net trigger

2. **Second**: `20250301000003-fix-auto-reject-expired-orders.sql`
   - Creates/fixes `auto_reject_expired_pending_cash_orders()` function
   - Verifies the enhanced `release_order_stock_internal()` exists

**How to run:**
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the entire migration file content
3. Run it
4. Check for any errors in the output

---

### Step 3: Check Function Permissions

Run this to verify permissions:

```sql
-- Check function permissions
SELECT 
    p.proname as function_name,
    r.rolname as role_name,
    CASE 
        WHEN has_function_privilege(r.oid, p.oid, 'EXECUTE') THEN '✅ Has EXECUTE'
        ELSE '❌ No EXECUTE'
    END as permission
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
  AND p.proname = 'auto_reject_expired_pending_cash_orders'
  AND r.rolname IN ('authenticated', 'service_role', 'anon')
ORDER BY r.rolname;
```

**Expected:** All roles should have EXECUTE permission.

**If missing:** Run this to grant permissions:

```sql
GRANT EXECUTE ON FUNCTION auto_reject_expired_pending_cash_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_reject_expired_pending_cash_orders() TO service_role;
GRANT EXECUTE ON FUNCTION auto_reject_expired_pending_cash_orders() TO anon;
```

---

### Step 4: Test the Function Manually

Run this to test if the function works:

```sql
-- Test the function
SELECT * FROM auto_reject_expired_pending_cash_orders();
```

**Expected:** Should return a row with `rejected_count` and `rejected_order_ids`.

**If error:** Check the error message:
- **"function does not exist"** → Migration not run (go to Step 2)
- **"permission denied"** → Permission issue (go to Step 3)
- **Other error** → Check Supabase logs for details

---

### Step 5: Check API Logs

1. Go to your hosting platform (Vercel, etc.)
2. Check the function logs for `/api/auto-reject-expired-orders`
3. Look for the error message - it should show the exact database error

**Common errors in logs:**
- `"function auto_reject_expired_pending_cash_orders() does not exist"` → Migration not run
- `"permission denied for function"` → Permission issue
- `"release_order_stock_internal() function not found"` → Need to run migration 20250301000002 first

---

### Step 6: Verify Dependencies

The function requires `release_order_stock_internal()` to exist. Check:

```sql
-- Check if release_order_stock_internal exists
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'release_order_stock_internal';
```

**Expected:** Should return 1 row with `order_id_param uuid`.

**If empty:** Run migration `20250301000002-enhance-stock-release-with-fallback.sql` first.

---

## Common Issues and Solutions

### Issue 1: "Function does not exist"

**Cause:** Migration not run or function was dropped.

**Solution:**
1. Run migration `20250301000003-fix-auto-reject-expired-orders.sql`
2. Verify it completed successfully
3. Check for any errors in the migration output

---

### Issue 2: "Permission denied"

**Cause:** Service role doesn't have EXECUTE permission.

**Solution:**
```sql
GRANT EXECUTE ON FUNCTION auto_reject_expired_pending_cash_orders() TO service_role;
```

---

### Issue 3: "release_order_stock_internal() function not found"

**Cause:** Migration 20250301000002 not run.

**Solution:**
1. Run `20250301000002-enhance-stock-release-with-fallback.sql` first
2. Then run `20250301000003-fix-auto-reject-expired-orders.sql`

---

### Issue 4: Function exists but returns error when called

**Cause:** There might be an issue with the function logic or data.

**Solution:**
1. Check Supabase logs for detailed error messages
2. Run diagnostic queries from `DIAGNOSE_EXPIRED_ORDERS.sql`
3. Check if there are any expired orders that meet the criteria

---

## Quick Fix Checklist

- [ ] Migration `20250301000002-enhance-stock-release-with-fallback.sql` has been run
- [ ] Migration `20250301000003-fix-auto-reject-expired-orders.sql` has been run
- [ ] Function `auto_reject_expired_pending_cash_orders()` exists (Step 1)
- [ ] Function has proper permissions (Step 3)
- [ ] Function can be called manually without errors (Step 4)
- [ ] API endpoint is deployed with latest code
- [ ] Check API logs for specific error message

---

## Still Not Working?

If you've completed all steps and it's still not working:

1. **Check the exact error message** from API logs
2. **Share the error details** - it will help identify the specific issue
3. **Run diagnostic queries** from `DIAGNOSE_EXPIRED_ORDERS.sql` to see what data exists
4. **Check Supabase logs** for any database-level errors

---

## Expected Behavior After Fix

Once everything is set up correctly:

1. ✅ Button click should show success message
2. ✅ Response should include `rejected_count` and `rejected_order_ids`
3. ✅ Orders should change from `PENDING_CASH` to `REJECTED`
4. ✅ Stock should be released (sold_quantity decreases)
5. ✅ No error messages in console or logs
