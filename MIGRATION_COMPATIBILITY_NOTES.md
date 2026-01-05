# Migration Compatibility Notes
## Based on Your Current Database Schema

## ✅ Safe Observations

### 1. ambassador_applications Table
- **Status values:** 'pending', 'approved', 'rejected', 'removed', 'suspended'
- **Impact:** ✅ **NO CHANGES** - Migration does NOT touch this table
- **Why:** Separate table with separate status field

### 2. round_robin_settings Table
- **Status:** ✅ **KEPT INTACT** - This is a DIFFERENT table
- **Note:** Migration removes `round_robin_tracker` (tracking table), NOT `round_robin_settings` (settings table)
- **Your schema has BOTH tables - only tracker is removed**

### 3. ambassadors Table Current Status
- **Current:** `status text DEFAULT 'pending'::text` (no constraint shown in dump)
- **Migration:** Adds constraint after updating values
- **Safe:** Migration uses `DROP CONSTRAINT IF EXISTS` so it won't fail if constraint doesn't exist

### 4. orders Table Current Status
- **Current:** `status text NOT NULL DEFAULT 'PENDING_AMBASSADOR'::text` (no constraint shown in dump)
- **Current:** `payment_method` constraint allows only 'online' and 'cod'
- **Migration:** 
  - Updates status values to unified system
  - Updates payment_method constraint to allow 'online', 'external_app', 'ambassador_cash'
  - Converts existing 'cod' values to 'ambassador_cash'

---

## ⚠️ Important Changes

### ambassadors.status
**Before:**
- Values: 'pending', 'approved', 'rejected', 'suspended' (and possibly others)
- No constraint shown (or constraint allows these)

**After:**
- Values: 'ACTIVE', 'PAUSED', 'DISABLED', 'PENDING', 'REJECTED'
- Constraint enforces these values
- 'approved' → 'ACTIVE'
- 'suspended' → 'PAUSED'
- 'pending' → stays 'pending' (but constraint uses 'PENDING' - see note below)

**⚠️ NOTE:** Your current schema shows status as lowercase 'pending', but migration constraint uses uppercase 'PENDING'. The migration updates 'approved' and 'suspended' but leaves other values as-is. If you have lowercase 'pending', it will remain lowercase (but constraint allows both 'PENDING' and 'pending' - wait, no, constraint only allows uppercase).

**Let me check the migration again...**

Actually, the migration constraint uses uppercase 'PENDING', but the UPDATE only changes 'approved' and 'suspended'. If you have lowercase 'pending', it will fail the constraint. I need to fix this!

### orders.payment_method
**Before:**
- Constraint allows: 'online', 'cod'

**After:**
- Constraint allows: 'online', 'external_app', 'ambassador_cash'
- Existing 'cod' values converted to 'ambassador_cash'

### orders.status
**Before:**
- Default: 'PENDING_AMBASSADOR'
- No constraint shown (but likely has one based on previous migrations)

**After:**
- Unified values: 'PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PAID', 'CANCELLED'
- All existing statuses mapped to new system

---

## 🔧 Migration Adjustments Needed

I need to update the ambassador status migration to handle lowercase 'pending' properly. Let me fix this.

