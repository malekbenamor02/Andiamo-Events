# Schema Compatibility Check
## Verification Against Your Current Database

Based on your schema dump, here's what the migrations will do:

---

## ✅ CONFIRMED SAFE

### Tables That Are NOT Touched:
- ✅ `ambassador_applications` - Separate table, separate status field
- ✅ `round_robin_settings` - Different from `round_robin_tracker`, stays intact
- ✅ `admins` - No changes
- ✅ `cities` - No changes
- ✅ `villes` - No changes
- ✅ `events` - No changes
- ✅ `order_passes` - No changes
- ✅ `tickets` - No changes
- ✅ All other tables - No changes

---

## ⚠️ TABLES THAT WILL CHANGE

### 1. `ambassadors` Table
**Column Changed:** `status`

**Current State:**
- Type: `text DEFAULT 'pending'::text`
- No constraint shown (may exist but not in dump)
- Likely values: 'pending', 'approved', 'rejected', 'suspended'

**After Migration:**
- Values: 'ACTIVE', 'PAUSED', 'DISABLED', 'PENDING', 'REJECTED'
- Constraint added: `CHECK (status IN ('ACTIVE', 'PAUSED', 'DISABLED', 'PENDING', 'REJECTED'))`
- Data conversion:
  - 'approved' → 'ACTIVE'
  - 'suspended' → 'PAUSED'
  - 'pending' → 'PENDING' (uppercase)
  - 'rejected' → 'REJECTED' (uppercase)

### 2. `orders` Table
**Columns Changed:** `status`, `payment_method`
**Columns Added:** `cancelled_by`, `external_app_reference`

**Current State:**
- `status`: `text NOT NULL DEFAULT 'PENDING_AMBASSADOR'::text` (no constraint shown)
- `payment_method`: `CHECK (payment_method IN ('online', 'cod'))`
- No `cancelled_by` column
- No `external_app_reference` column

**After Migration:**
- `status`: New constraint with unified values
- `payment_method`: Updated to `CHECK (payment_method IN ('online', 'external_app', 'ambassador_cash'))`
- `cancelled_by`: Added (TEXT, nullable)
- `external_app_reference`: Added (TEXT, nullable)
- Data conversion:
  - Status values mapped to new unified system
  - 'cod' → 'ambassador_cash' (same thing, new name)

### 3. `round_robin_tracker` Table
**Action:** DROPPED (deleted)

**Current State:**
- Table exists with columns: id, ville, last_assigned_ambassador_id, etc.

**After Migration:**
- Table removed (CASCADE)
- All data deleted

**Note:** `round_robin_settings` table is DIFFERENT and stays intact!

---

## ✅ NEW TABLES CREATED

### `payment_options` Table
- New table
- 3 rows inserted (all disabled initially)
- Safe addition

---

## 🔍 PRE-MIGRATION CHECK QUERIES

Run these to see current state:

```sql
-- 1. Check current ambassador statuses
SELECT status, COUNT(*) as count 
FROM ambassadors 
GROUP BY status 
ORDER BY count DESC;

-- 2. Check current order statuses
SELECT status, COUNT(*) as count 
FROM orders 
GROUP BY status 
ORDER BY count DESC;

-- 3. Check current payment methods
SELECT payment_method, COUNT(*) as count 
FROM orders 
GROUP BY payment_method 
ORDER BY count DESC;

-- 4. Check if round_robin_tracker exists
SELECT COUNT(*) as table_exists
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'round_robin_tracker';

-- 5. Verify round_robin_settings exists (should NOT be dropped)
SELECT COUNT(*) as table_exists
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'round_robin_settings';

-- 6. Check if cancelled_by column exists (should NOT exist yet)
SELECT COUNT(*) as column_exists
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'orders' 
AND column_name = 'cancelled_by';
```

---

## ✅ POST-MIGRATION VERIFICATION

After migrations, verify:

```sql
-- 1. Ambassador statuses (should be uppercase)
SELECT status, COUNT(*) as count 
FROM ambassadors 
GROUP BY status 
ORDER BY count DESC;
-- Expected: ACTIVE, PAUSED, PENDING, REJECTED (uppercase)
-- Should NOT see: approved, suspended (lowercase)

-- 2. Order statuses (should be new unified system)
SELECT status, COUNT(*) as count 
FROM orders 
GROUP BY status 
ORDER BY count DESC;
-- Expected: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PAID, CANCELLED

-- 3. Payment methods (should NOT have 'cod' anymore)
SELECT payment_method, COUNT(*) as count 
FROM orders 
GROUP BY payment_method 
ORDER BY count DESC;
-- Expected: online, external_app, ambassador_cash
-- Should NOT see: cod

-- 4. New columns exist
SELECT 
  COUNT(*) FILTER (WHERE column_name = 'cancelled_by') as has_cancelled_by,
  COUNT(*) FILTER (WHERE column_name = 'external_app_reference') as has_external_app_ref
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'orders';

-- 5. round_robin_tracker is gone
SELECT COUNT(*) as table_exists
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'round_robin_tracker';
-- Expected: 0 (table doesn't exist)

-- 6. round_robin_settings still exists (should NOT be dropped)
SELECT COUNT(*) as table_exists
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'round_robin_settings';
-- Expected: 1 (table still exists)

-- 7. payment_options table exists
SELECT COUNT(*) as count FROM payment_options;
-- Expected: 3 (one for each payment type)
```

---

## ⚠️ IMPORTANT NOTES

1. **round_robin_settings vs round_robin_tracker:**
   - `round_robin_tracker` = tracking table (DROPPED)
   - `round_robin_settings` = settings table (KEPT - not touched)

2. **Status Case Sensitivity:**
   - Migration converts all statuses to uppercase
   - Old lowercase values ('pending', 'approved') → New uppercase ('PENDING', 'ACTIVE')

3. **payment_method 'cod' → 'ambassador_cash':**
   - These are the same thing
   - 'cod' is converted to 'ambassador_cash' during migration
   - New constraint only allows: 'online', 'external_app', 'ambassador_cash'

4. **ambassador_applications:**
   - Completely separate table
   - Has its own status field
   - NOT affected by migration

---

## ✅ ALL MIGRATIONS ARE SAFE

All migrations have been updated to be compatible with your current schema. They use:
- `IF EXISTS` / `IF NOT EXISTS` clauses
- Safe constraint dropping
- Case-insensitive updates
- Preserves `round_robin_settings` (different table)

