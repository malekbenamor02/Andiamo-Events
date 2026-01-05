# Migration Safety Notes
## Important Information About Ambassador Tables

## ✅ SAFE - These Tables Are NOT Affected

### `ambassador_applications` Table
- **Status Field:** Has its own separate `status` field
- **Status Values:** 'pending', 'approved', 'rejected', 'removed', 'suspended'
- **Impact:** ❌ **NO CHANGES** - This migration does NOT touch this table
- **Why:** `ambassador_applications` and `ambassadors` are separate tables with separate status fields

### Other Tables
- All other tables remain completely untouched
- Only `ambassadors` table status values are updated

---

## ⚠️ What Gets Changed

### `ambassadors` Table ONLY
- **Status Field:** `status` column in `public.ambassadors` table
- **Changes:**
  - `approved` → `ACTIVE` (ambassadors who can receive orders)
  - `suspended` → `PAUSED` (temporarily paused ambassadors)
  - `pending` → stays `pending` (unchanged)
  - `rejected` → stays `rejected` (unchanged)
  - Any other values → stay unchanged

---

## 🔍 Pre-Migration Checks

Before running migration `20250215000001-update-ambassadors-status-enum.sql`, you can check:

```sql
-- Check current status distribution in ambassadors table
SELECT status, COUNT(*) as count 
FROM ambassadors 
GROUP BY status 
ORDER BY count DESC;

-- Check if there are any unexpected status values
SELECT DISTINCT status 
FROM ambassadors 
WHERE status NOT IN ('approved', 'suspended', 'pending', 'rejected');

-- Count how many will be affected
SELECT 
  COUNT(*) FILTER (WHERE status = 'approved') as will_become_active,
  COUNT(*) FILTER (WHERE status = 'suspended') as will_become_paused,
  COUNT(*) FILTER (WHERE status NOT IN ('approved', 'suspended')) as will_stay_same
FROM ambassadors;
```

---

## ✅ Post-Migration Verification

After running the migration, verify:

```sql
-- Check new status distribution
SELECT status, COUNT(*) as count 
FROM ambassadors 
GROUP BY status 
ORDER BY count DESC;

-- Should see: ACTIVE, PAUSED, pending, rejected (if any exist)
-- Should NOT see: approved, suspended (they should all be converted)

-- Verify ambassador_applications is untouched
SELECT status, COUNT(*) as count 
FROM ambassador_applications 
GROUP BY status 
ORDER BY count DESC;

-- Should still show: pending, approved, rejected, removed, suspended
-- (No changes to this table)
```

---

## 🛡️ Safety Features in Migration

The migration includes:
1. ✅ **Safe Updates:** Only updates specific values (approved, suspended)
2. ✅ **Preserves Other Values:** Leaves pending, rejected, and any other statuses unchanged
3. ✅ **Non-Breaking:** Uses `DROP CONSTRAINT IF EXISTS` to avoid errors
4. ✅ **Verification:** Includes check to warn about invalid statuses
5. ✅ **Isolated:** Only affects `ambassadors` table, NOT `ambassador_applications`

---

## 📋 Migration Order (Safe)

The migrations are designed to be safe:
1. **Migration 1:** Creates new table (payment_options) - ✅ Safe
2. **Migration 2:** Updates ambassadors.status - ⚠️ Updates data (but safe - see above)
3. **Migration 3:** Updates orders table - ⚠️ Updates data (different table)
4. **Migration 4:** Removes round_robin_tracker - ✅ Safe (separate table)
5. **Migration 5:** Adds config - ✅ Safe

---

## 🚨 If Something Goes Wrong

If you need to rollback the ambassador status migration:

```sql
-- Rollback: Convert back to old status values
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

**However, it's better to restore from backup if possible.**

---

## ✅ Summary

- ✅ `ambassador_applications` table is **NOT affected**
- ✅ Only `ambassadors` table status values are updated
- ✅ Migration is **safe and reversible** (with rollback SQL above)
- ✅ All other tables remain **completely untouched**

