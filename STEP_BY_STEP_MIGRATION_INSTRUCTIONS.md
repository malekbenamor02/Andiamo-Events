# Step-by-Step Migration Instructions
## Complete Guide to Run Database Migrations

Follow these steps **exactly** in order.

---

## 📋 PREPARATION (Do This First!)

### Step 1: Backup Your Database
**CRITICAL - Do this first!**

1. Go to your **Supabase Dashboard**
2. Click on **Database** in the left sidebar
3. Click on **Backups** tab
4. Click **Create Backup** (or use the backup feature)
5. **OR** Export your data:
   - Go to **SQL Editor**
   - Run this to export ambassadors table:
     ```sql
     SELECT * FROM ambassadors;
     ```
   - Copy the results
   - Run this to export orders table:
     ```sql
     SELECT * FROM orders;
     ```
   - Copy the results
   - Save both in a text file

### Step 2: Check Current Data (Optional but Recommended)
Run these queries in SQL Editor to see what you have:

```sql
-- Check current ambassador statuses
SELECT status, COUNT(*) as count 
FROM ambassadors 
GROUP BY status 
ORDER BY count DESC;

-- Check current order statuses
SELECT status, COUNT(*) as count 
FROM orders 
GROUP BY status 
ORDER BY count DESC;

-- Verify ambassador_applications is separate (should show different statuses)
SELECT status, COUNT(*) as count 
FROM ambassador_applications 
GROUP BY status 
ORDER BY count DESC;
```

**Note:** Write down these numbers so you can verify after migration.

---

## 🚀 RUNNING THE MIGRATIONS

### Step 3: Open Supabase SQL Editor
1. Go to **Supabase Dashboard**
2. Click **SQL Editor** in the left sidebar
3. Click **New Query** (or use the editor)

### Step 4: Run Migration 1 - Payment Options Table
1. Open file: `supabase/migrations/20250215000000-create-payment-options-table.sql`
2. **Copy ALL the content** from the file
3. **Paste** into Supabase SQL Editor
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)
5. **Wait for success message** ✅
6. **Verify:** Run this query:
   ```sql
   SELECT * FROM payment_options;
   ```
   - Should show 3 rows (online, external_app, ambassador_cash)
   - All should have `enabled = false`

### Step 5: Run Migration 2 - Update Ambassadors Status
⚠️ **This modifies data - be careful!**

1. Open file: `supabase/migrations/20250215000001-update-ambassadors-status-enum.sql`
2. **Copy ALL the content** from the file
3. **Paste** into Supabase SQL Editor
4. Click **Run**
5. **Wait for success message** ✅
6. **Check the output** - You should see notices like:
   - "Will update X approved ambassadors to ACTIVE"
   - "Will update Y suspended ambassadors to PAUSED"
   - "Migration successful: All ambassador statuses are valid."
7. **Verify:** Run this query:
   ```sql
   SELECT status, COUNT(*) as count 
   FROM ambassadors 
   GROUP BY status 
   ORDER BY count DESC;
   ```
   - Should see: `ACTIVE`, `PAUSED`, `pending`, `rejected` (if any)
   - Should **NOT** see: `approved`, `suspended` (they should be converted)

### Step 6: Run Migration 3 - Update Orders Table
⚠️ **This modifies data - be careful!**

1. Open file: `supabase/migrations/20250215000002-update-orders-table-new-system.sql`
2. **Copy ALL the content** from the file
3. **Paste** into Supabase SQL Editor
4. Click **Run**
5. **Wait for success message** ✅ (may take 10-30 seconds if you have many orders)
6. **Verify:** Run these queries:
   ```sql
   -- Check new statuses
   SELECT status, COUNT(*) as count 
   FROM orders 
   GROUP BY status 
   ORDER BY count DESC;
   ```
   - Should see: `PENDING_ONLINE`, `REDIRECTED`, `PENDING_CASH`, `PAID`, `CANCELLED`
   
   ```sql
   -- Check new columns exist
   SELECT cancelled_by, external_app_reference 
   FROM orders 
   LIMIT 1;
   ```
   - Should not show errors (columns exist)

### Step 7: Run Migration 4 - Remove Round-Robin
1. Open file: `supabase/migrations/20250215000003-remove-round-robin-infrastructure.sql`
2. **Copy ALL the content** from the file
3. **Paste** into Supabase SQL Editor
4. Click **Run**
5. **Wait for success message** ✅
6. **Verify:** Run this query (should show error - table doesn't exist):
   ```sql
   SELECT * FROM round_robin_tracker;
   ```
   - Should get error: "relation round_robin_tracker does not exist" ✅
   - This is correct - the table was removed

### Step 8: Run Migration 5 - Add Timeout Settings
1. Open file: `supabase/migrations/20250215000004-add-order-timeout-settings.sql`
2. **Copy ALL the content** from the file
3. **Paste** into Supabase SQL Editor
4. Click **Run**
5. **Wait for success message** ✅
6. **Verify:** Run this query:
   ```sql
   SELECT * FROM site_content WHERE key = 'order_timeout_settings';
   ```
   - Should show 1 row with `content = {"cash_payment_timeout_hours": 24}`

---

## ✅ FINAL VERIFICATION

### Step 9: Run All Verification Queries
Run these **all at once** to verify everything:

```sql
-- 1. Check payment_options table
SELECT 'payment_options' as table_name, COUNT(*) as count FROM payment_options
UNION ALL
-- 2. Check ambassador statuses (should be ACTIVE/PAUSED, not approved/suspended)
SELECT 'ambassadors (ACTIVE)' as table_name, COUNT(*) FROM ambassadors WHERE status = 'ACTIVE'
UNION ALL
SELECT 'ambassadors (PAUSED)' as table_name, COUNT(*) FROM ambassadors WHERE status = 'PAUSED'
UNION ALL
SELECT 'ambassadors (old approved)' as table_name, COUNT(*) FROM ambassadors WHERE status = 'approved'
UNION ALL
SELECT 'ambassadors (old suspended)' as table_name, COUNT(*) FROM ambassadors WHERE status = 'suspended'
UNION ALL
-- 3. Check order statuses (should be new unified system)
SELECT 'orders (PENDING_CASH)' as table_name, COUNT(*) FROM orders WHERE status = 'PENDING_CASH'
UNION ALL
SELECT 'orders (PAID)' as table_name, COUNT(*) FROM orders WHERE status = 'PAID'
UNION ALL
SELECT 'orders (CANCELLED)' as table_name, COUNT(*) FROM orders WHERE status = 'CANCELLED'
UNION ALL
-- 4. Check new columns exist
SELECT 'orders with cancelled_by' as table_name, COUNT(*) FROM orders WHERE cancelled_by IS NOT NULL
UNION ALL
-- 5. Verify round_robin_tracker is gone (should return 0 or error)
SELECT 'round_robin_tracker exists' as table_name, 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'round_robin_tracker') 
  THEN 1 ELSE 0 END;
```

**Expected Results:**
- ✅ `payment_options`: Should show 3
- ✅ `ambassadors (ACTIVE)`: Should show count (not 0 if you had approved ambassadors)
- ✅ `ambassadors (PAUSED)`: Should show count (not 0 if you had suspended ambassadors)
- ✅ `ambassadors (old approved)`: Should show **0** (all converted)
- ✅ `ambassadors (old suspended)`: Should show **0** (all converted)
- ✅ `orders` statuses: Should show counts in new statuses
- ✅ `orders with cancelled_by`: May show 0 or more (depends on cancelled orders)
- ✅ `round_robin_tracker exists`: Should show **0** (table removed)

---

## 🎯 WHAT TO DO IF SOMETHING GOES WRONG

### If Migration Fails:
1. **STOP** - Don't run the next migration
2. **Check the error message** in SQL Editor
3. **Take a screenshot** of the error
4. **Check your data:**
   ```sql
   -- Check if data is corrupted
   SELECT * FROM ambassadors WHERE status NOT IN ('ACTIVE', 'PAUSED', 'DISABLED', 'PENDING', 'REJECTED');
   ```
5. **Restore from backup** if needed

### If You Need to Rollback:
**Only if absolutely necessary!**

```sql
-- Rollback ambassador statuses (if needed)
UPDATE public.ambassadors
SET status = CASE
  WHEN status = 'ACTIVE' THEN 'approved'
  WHEN status = 'PAUSED' THEN 'suspended'
  ELSE status
END
WHERE status IN ('ACTIVE', 'PAUSED');

-- Restore old constraint
ALTER TABLE public.ambassadors DROP CONSTRAINT IF EXISTS ambassadors_status_check;
ALTER TABLE public.ambassadors ADD CONSTRAINT ambassadors_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));
```

**But it's better to restore from backup!**

---

## 📝 CHECKLIST

Use this checklist to track your progress:

- [ ] **Step 1:** Database backup created
- [ ] **Step 2:** Current data checked and noted
- [ ] **Step 3:** SQL Editor opened
- [ ] **Step 4:** Migration 1 run and verified ✅
- [ ] **Step 5:** Migration 2 run and verified ✅
- [ ] **Step 6:** Migration 3 run and verified ✅
- [ ] **Step 7:** Migration 4 run and verified ✅
- [ ] **Step 8:** Migration 5 run and verified ✅
- [ ] **Step 9:** Final verification queries run ✅
- [ ] All results match expected values ✅

---

## 🎉 AFTER MIGRATION

Once all migrations are complete:

1. **Test your application:**
   - Try creating an order
   - Check if ambassadors are showing correctly
   - Verify admin dashboard works

2. **Update application code:**
   - The frontend code needs to be updated to use new status values
   - But database is ready!

3. **Enable payment options (optional):**
   ```sql
   -- Enable a payment option (example: enable online payment)
   UPDATE payment_options 
   SET enabled = true 
   WHERE option_type = 'online';
   ```

---

## 📞 NEED HELP?

If you encounter any issues:
1. Check the error message carefully
2. Verify you copied the entire SQL file content
3. Check that previous migrations completed successfully
4. Review `MIGRATION_SAFETY_NOTES.md` for safety information

---

## ⚠️ REMEMBER

- ✅ **Backup first!**
- ✅ **Run migrations in order (1, 2, 3, 4, 5)**
- ✅ **Verify after each migration**
- ✅ **Don't skip verification steps**
- ✅ **ambassador_applications table is NOT affected** (separate table)

---

**Good luck! 🚀**

