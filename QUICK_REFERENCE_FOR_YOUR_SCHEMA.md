# Quick Reference - Your Database Schema Compatibility

## ✅ Confirmed: Migrations Are Safe for Your Schema

Based on your schema dump, here's what will happen:

---

## 🔍 Key Findings from Your Schema

### 1. **ambassadors Table**
- ✅ **Current:** `status text DEFAULT 'pending'::text` (no constraint shown)
- ✅ **Migration:** Converts lowercase to uppercase, adds constraint
- ✅ **Safe:** Uses case-insensitive updates

### 2. **orders Table**
- ✅ **Current:** `payment_method` only allows `'online'` and `'cod'`
- ✅ **Migration:** Updates to `'online'`, `'external_app'`, `'ambassador_cash'`
- ✅ **Conversion:** `'cod'` → `'ambassador_cash'` (same thing, renamed)

### 3. **round_robin_tracker Table**
- ✅ **Current:** EXISTS in your schema
- ✅ **Migration:** Will be DROPPED (this is correct)
- ✅ **Note:** `round_robin_settings` is DIFFERENT and will NOT be dropped

### 4. **ambassador_applications Table**
- ✅ **Status:** Separate table with separate status field
- ✅ **Impact:** NO CHANGES (completely untouched)

---

## 📋 What Gets Changed (Summary)

| Table | Column | Before | After | Action |
|-------|--------|--------|-------|--------|
| `ambassadors` | `status` | 'pending', 'approved', 'rejected', 'suspended' | 'PENDING', 'ACTIVE', 'REJECTED', 'PAUSED', 'DISABLED' | Updates values + adds constraint |
| `orders` | `status` | Various (PENDING_AMBASSADOR, etc.) | Unified: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PAID, CANCELLED | Maps to new system |
| `orders` | `payment_method` | 'online', 'cod' | 'online', 'external_app', 'ambassador_cash' | Updates constraint + converts 'cod' |
| `orders` | `cancelled_by` | (doesn't exist) | Added (TEXT) | NEW COLUMN |
| `orders` | `external_app_reference` | (doesn't exist) | Added (TEXT) | NEW COLUMN |
| `round_robin_tracker` | (entire table) | EXISTS | DROPPED | Table removed |
| `payment_options` | (entire table) | (doesn't exist) | Created with 3 rows | NEW TABLE |

---

## ⚠️ Important Notes

### 1. round_robin_settings vs round_robin_tracker
Your schema has **TWO different tables**:
- ✅ `round_robin_tracker` → **DROPPED** (tracking table)
- ✅ `round_robin_settings` → **KEPT** (settings table, not touched)

### 2. Status Case Conversion
- Lowercase values (`'pending'`, `'approved'`) → Uppercase (`'PENDING'`, `'ACTIVE'`)
- Migration handles this automatically

### 3. payment_method 'cod' → 'ambassador_cash'
- They're the same thing (Cash on Delivery = Ambassador Cash)
- All existing `'cod'` values converted to `'ambassador_cash'`

---

## ✅ Pre-Migration Checklist

Before running migrations, check:

```sql
-- 1. Count ambassadors by status
SELECT status, COUNT(*) FROM ambassadors GROUP BY status;

-- 2. Count orders by payment_method
SELECT payment_method, COUNT(*) FROM orders GROUP BY payment_method;

-- 3. Verify round_robin_tracker exists (should return 1+)
SELECT COUNT(*) FROM round_robin_tracker;

-- 4. Verify round_robin_settings exists (should return 1+)
SELECT COUNT(*) FROM round_robin_settings;

-- 5. Check if cancelled_by column exists (should return 0)
SELECT COUNT(*) FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'cancelled_by';
```

---

## ✅ Post-Migration Verification

After migrations, verify:

```sql
-- 1. Ambassador statuses (should be uppercase)
SELECT status, COUNT(*) FROM ambassadors GROUP BY status;
-- Should see: ACTIVE, PAUSED, PENDING, REJECTED (uppercase)

-- 2. Payment methods (should NOT have 'cod')
SELECT payment_method, COUNT(*) FROM orders GROUP BY payment_method;
-- Should see: online, ambassador_cash, external_app
-- Should NOT see: cod

-- 3. New columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('cancelled_by', 'external_app_reference');
-- Should return 2 rows

-- 4. round_robin_tracker is gone
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'round_robin_tracker';
-- Should return 0

-- 5. round_robin_settings still exists
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_name = 'round_robin_settings';
-- Should return 1 (still exists)
```

---

## 🚀 Ready to Run

All migrations have been updated to be compatible with your schema. They:
- ✅ Handle case conversion (lowercase → uppercase)
- ✅ Convert 'cod' → 'ambassador_cash'
- ✅ Preserve `round_robin_settings` (only drops `round_robin_tracker`)
- ✅ Don't touch `ambassador_applications` table
- ✅ Use safe `IF EXISTS` / `IF NOT EXISTS` clauses

**You're good to go!** Follow `STEP_BY_STEP_MIGRATION_INSTRUCTIONS.md` to run them.

