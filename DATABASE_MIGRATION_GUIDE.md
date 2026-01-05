# Database Migration Guide
## Order System Migration Files

**👉 For detailed step-by-step instructions, see: `STEP_BY_STEP_MIGRATION_INSTRUCTIONS.md`**

You need to run **5 migration files** in order. Execute them in your Supabase SQL Editor.

---

## Migration Files (Run in Order)

### 1. `20250215000000-create-payment-options-table.sql`
**Purpose:** Creates the `payment_options` table for admin-configurable payment methods
**Impact:** ✅ Safe - Adds new table only
**Run Time:** ~1 second

### 2. `20250215000001-update-ambassadors-status-enum.sql`
**Purpose:** Updates ambassador status values (approved → ACTIVE, suspended → PAUSED)
**Impact:** ⚠️ Modifies data - Updates existing status values
**Run Time:** ~1-5 seconds (depending on number of ambassadors)

### 3. `20250215000002-update-orders-table-new-system.sql`
**Purpose:** Updates orders table with new unified status system and adds new columns
**Impact:** ⚠️ Modifies data - Updates existing status values and adds columns
**Run Time:** ~5-30 seconds (depending on number of orders)

### 4. `20250215000003-remove-round-robin-infrastructure.sql`
**Purpose:** Removes round-robin assignment system (table and functions)
**Impact:** ⚠️ Deletes infrastructure - Removes `round_robin_tracker` table and functions
**Run Time:** ~1 second

### 5. `20250215000004-add-order-timeout-settings.sql`
**Purpose:** Adds order timeout configuration to site_content
**Impact:** ✅ Safe - Adds new configuration only
**Run Time:** ~1 second

---

## How to Run

### Option 1: Supabase Dashboard SQL Editor (Recommended)
1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy each migration file content
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for success message
7. Move to next file

### Option 2: Supabase CLI
```bash
# If you're using Supabase CLI locally
supabase db push
```

### Option 3: Copy all files to migrations folder
If using Supabase CLI with migrations:
- All files are already in `supabase/migrations/`
- Run `supabase db push` to apply all pending migrations

---

## ⚠️ IMPORTANT NOTES

### Before Running:
1. **BACKUP YOUR DATABASE** - Especially the `orders` and `ambassadors` tables
2. **Test on Staging First** - Run migrations on a test database first
3. **Check Existing Data** - Review your current orders and ambassador statuses
4. **Verify Dependencies** - Ensure no application code is running that uses old status values

### What Gets Changed:
- ✅ **Ambassador statuses:** `approved` → `ACTIVE`, `suspended` → `PAUSED`
- ✅ **Order statuses:** Migrated to unified system (PENDING_ONLINE, REDIRECTED, PENDING_CASH, PAID, CANCELLED)
- ✅ **New columns added:** `cancelled_by`, `external_app_reference` to orders table
- ✅ **Table removed:** `round_robin_tracker` (no longer needed)
- ✅ **Functions removed:** `assign_order_to_ambassador()`, `get_next_ambassador_for_ville()`

### After Running:
1. Verify the `payment_options` table exists with 3 rows (one for each payment type)
2. Check that ambassador statuses are updated correctly
3. Verify order statuses are migrated correctly
4. Confirm `round_robin_tracker` table is removed
5. Test that new system works with your application code

---

## Rollback Plan

If you need to rollback, you would need to:
1. Restore from backup (safest)
2. Or manually revert status values (complex - not recommended)

**Recommendation:** Always backup before running migrations.

---

## Verification Queries

After running all migrations, run these to verify:

```sql
-- Check payment_options table exists
SELECT * FROM payment_options;

-- Check ambassador statuses are updated
SELECT status, COUNT(*) FROM ambassadors GROUP BY status;

-- Check order statuses are updated
SELECT status, COUNT(*) FROM orders GROUP BY status;

-- Check new columns exist
SELECT cancelled_by, external_app_reference FROM orders LIMIT 1;

-- Verify round_robin_tracker is removed (should return error)
SELECT * FROM round_robin_tracker;
```

---

## File Locations

All migration files are located in:
```
supabase/migrations/
├── 20250215000000-create-payment-options-table.sql
├── 20250215000001-update-ambassadors-status-enum.sql
├── 20250215000002-update-orders-table-new-system.sql
├── 20250215000003-remove-round-robin-infrastructure.sql
└── 20250215000004-add-order-timeout-settings.sql
```

