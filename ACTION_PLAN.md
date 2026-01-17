# Action Plan - Fix Stock Issues

## 📋 Step-by-Step Instructions

### Step 1: Run Migrations (In Order)

Run these 3 migrations in your Supabase SQL Editor, **one at a time**:

#### Migration 1: Fix Stock Calculation
**File**: `supabase/migrations/20250301000000-fix-sold-quantity-exclude-removed-orders.sql`

1. Go to Supabase Dashboard → SQL Editor
2. Open the file and copy ALL contents
3. Paste into SQL Editor
4. Click "Run"
5. ✅ Wait for success message

**What it does**: Recalculates `sold_quantity` correctly (excludes REMOVED_BY_ADMIN orders)

#### Migration 2: Fix Missing Stock Release
**File**: `supabase/migrations/20250301000001-fix-missing-stock-releases.sql`

1. In SQL Editor, open this file
2. Copy ALL contents
3. Paste into SQL Editor
4. Click "Run"
5. ✅ Should fix the 1 problematic order (order ID: 59cd3891-3673-4366-9f47-c0944fb6bdf6)

**What it does**: Releases stock for the order that has `stock_released = false`

#### Migration 3: Prevent Future Issues
**File**: `supabase/migrations/20250301000002-enhance-stock-release-with-fallback.sql`

1. In SQL Editor, open this file
2. Copy ALL contents
3. Paste into SQL Editor
4. Click "Run"
5. ✅ Wait for success message

**What it does**: 
- Enhances stock release to handle orders without `pass_id`
- Adds database trigger as safety net

---

### Step 2: Verify Migrations Worked

Run these queries in SQL Editor to verify:

#### Check 1: Verify the problematic order is fixed
```sql
SELECT 
    o.id,
    o.status,
    o.stock_released
FROM orders o
WHERE o.id = '59cd3891-3673-4366-9f47-c0944fb6bdf6';
```

**Expected**: `stock_released = true` ✅

#### Check 2: Verify all REMOVED_BY_ADMIN orders have stock released
```sql
SELECT 
    o.status,
    COUNT(*) as order_count,
    COUNT(*) FILTER (WHERE o.stock_released = true) as stock_released_count,
    COUNT(*) FILTER (WHERE o.stock_released = false) as stock_not_released_count
FROM orders o
WHERE o.status = 'REMOVED_BY_ADMIN'
GROUP BY o.status;
```

**Expected**: 
- `stock_released_count` = `order_count` ✅
- `stock_not_released_count` = 0 ✅

#### Check 3: Verify stock calculations are correct
```sql
SELECT * FROM verify_stock_calculations() WHERE discrepancy != 0;
```

**Expected**: 0 rows (no discrepancies) ✅

#### Check 4: Check Zone B pass specifically
```sql
SELECT 
    ep.name as pass_name,
    ep.max_quantity,
    ep.sold_quantity,
    ep.max_quantity - ep.sold_quantity as remaining
FROM event_passes ep
WHERE ep.name LIKE '%Zone B%';
```

**Expected**:
- `max_quantity`: 32
- `sold_quantity`: 29 (17 PAID + 12 PENDING_CASH)
- `remaining`: 3 ✅

---

### Step 3: Deploy Code Changes

The code files have been updated. You need to deploy them:

#### Files to Deploy:
1. **`server.cjs`** - Enhanced `releaseOrderStock()` function
2. **`api/misc.js`** - Fixed stock release logic

**How to deploy**:
- If using Vercel: Push to git, Vercel will auto-deploy
- If using other hosting: Deploy these files to your server

**Note**: The code changes ensure stock is released even if `pass_id` is NULL (uses `pass_type` matching as fallback)

---

### Step 4: Final Verification

After deploying code, test in the application:

1. **Check Pass Stock view**: Should show correct numbers
2. **Check Ticket Management**: Should show 17 passes sold
3. **Check Ambassadors Sales - Paid**: Should show 17 passes
4. **Check Ambassadors Sales - Pending Cash**: Should show 12 passes
5. **Check Ambassadors Sales - Removed**: Should show 7 passes (excluded from stock)

**All numbers should match!** ✅

---

## ✅ Quick Checklist

- [ ] Run Migration 1: `20250301000000-fix-sold-quantity-exclude-removed-orders.sql`
- [ ] Run Migration 2: `20250301000001-fix-missing-stock-releases.sql`
- [ ] Run Migration 3: `20250301000002-enhance-stock-release-with-fallback.sql`
- [ ] Verify problematic order is fixed (Check 1)
- [ ] Verify all REMOVED_BY_ADMIN orders have stock released (Check 2)
- [ ] Verify stock calculations are correct (Check 3)
- [ ] Check Zone B pass numbers (Check 4)
- [ ] Deploy code changes (`server.cjs` and `api/misc.js`)
- [ ] Verify in application (all views show correct numbers)

---

## 🎯 Expected Results

### After All Steps:

**Zone B Pass:**
- Max stock: 32 ✅
- Sold: 29 (17 PAID + 12 PENDING_CASH) ✅
- Remaining: 3 ✅
- REMOVED_BY_ADMIN: 7 (excluded from stock) ✅

**All Views:**
- Pass Stock: 32 max, 29 sold, 3 remaining ✅
- Ticket Management: 17 passes sold ✅
- Ambassadors Sales - Paid: 17 passes ✅
- Ambassadors Sales - Pending Cash: 12 passes ✅
- Ambassadors Sales - Removed: 7 passes (excluded) ✅

**Protection:**
- ✅ Application code releases stock (with fallback)
- ✅ Database function releases stock (with fallback)
- ✅ Database trigger releases stock automatically (safety net)
- ✅ No more missing stock releases!

---

## ⚠️ If Something Goes Wrong

### If Migration Fails:
1. Check the error message
2. Make sure you're running them in order (1, 2, 3)
3. Check if previous migrations were already run

### If Numbers Still Don't Match:
1. Run `SELECT * FROM verify_stock_calculations() WHERE discrepancy != 0;`
2. Check which passes have discrepancies
3. Run the migrations again (they're idempotent - safe to run multiple times)

### If Stock Still Not Released:
1. Check if database trigger is working:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'trigger_ensure_stock_released_on_status_change';
   ```
2. The trigger should automatically release stock when status changes

---

## 📞 Summary

**What to do:**
1. ✅ Run 3 migrations (in order)
2. ✅ Verify with SQL queries
3. ✅ Deploy code changes
4. ✅ Verify in application

**Result:**
- ✅ Stock calculations fixed
- ✅ Missing stock releases fixed
- ✅ Future issues prevented (triple protection)

---

**Ready to start?** Begin with Migration 1! 🚀
