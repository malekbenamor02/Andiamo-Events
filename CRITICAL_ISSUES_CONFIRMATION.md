# 🔴 CRITICAL ISSUES CONFIRMATION
## Database + Backend + Frontend Synchronization Fixes

**Date:** 2025-01-XX  
**Status:** Awaiting Approval

---

## PHASE 1: CRITICAL ISSUES CONFIRMED

### 🔴 **ISSUE #1: Missing `pass_purchases` Table**

#### **Database Impact:**
- ❌ `scans` table has foreign key `ticket_id` REFERENCES `pass_purchases(id)` 
- ❌ Foreign key constraint **CANNOT BE CREATED** (referenced table doesn't exist)
- ❌ Database integrity violation - scans cannot be inserted

#### **Backend Impact:**
- ❌ `server.cjs` line 1035: `.from('pass_purchases')` - **QUERY FAILS**
- ❌ Ticket validation endpoint `/api/validate-ticket` **BROKEN**
- ❌ Code expects `pass_purchases` table with columns:
  - `id`, `qr_code`, `event_id`, `customer_name`, `pass_type`
- ❌ Code references `ticket.customer_name`, `ticket.pass_type` (lines 1092, 1094, 1122, 1124, 1159, 1161)

#### **Frontend Impact:**
- ⚠️ No direct frontend impact (endpoint is backend-only)
- ⚠️ Ticket scanning feature **COMPLETELY BROKEN** for ambassadors

#### **Root Cause:**
- Migration `20250201000025-create-tickets-table.sql` created `tickets` table instead
- Old code still references legacy `pass_purchases` table
- Migration `20250802000000-create-scans-table.sql` references wrong table

---

### 🔴 **ISSUE #2: Foreign Key Constraint Failure**

#### **Database Impact:**
- ❌ `scans.ticket_id` FK constraint **INVALID** (references non-existent table)
- ❌ Cannot create scans records
- ❌ Database schema inconsistency

#### **Backend Impact:**
- ❌ Scan insertion fails (lines 1076, 1106, 1132 in `server.cjs`)
- ❌ Ticket validation cannot record scans

#### **Frontend Impact:**
- ❌ Ambassador ticket scanning **BROKEN**
- ❌ No scan history can be recorded

#### **Root Cause:**
- Migration created FK to wrong table name

---

### 🔴 **ISSUE #3: Orders Table Column Name Inconsistencies**

#### **Database Impact:**
- ⚠️ Migration `20250201000005-remove-duplicate-columns.sql` **REMOVED** `customer_name`, `phone`, `email`
- ⚠️ Migration says to use `user_name`, `user_phone`, `user_email` **BUT NEVER ADDS THEM**
- ⚠️ Current state: Database may have **NEITHER** set of columns OR **BOTH** sets
- ❌ Data integrity risk - columns may be missing

#### **Backend Impact:**
- ⚠️ Backend code doesn't directly query orders table (uses Supabase client)
- ⚠️ If columns missing, order creation/retrieval **FAILS**

#### **Frontend Impact:**
- ❌ `src/pages/ambassador/Dashboard.tsx` line 35-37: Expects `user_name`, `user_phone`, `user_email`
- ❌ `src/pages/PassPurchase.tsx` line 403-405: Creates orders with `user_name`, `user_phone`, `user_email`
- ❌ `src/lib/ticketGenerationService.tsx` line 43-44: Expects `user_name`, `user_email`
- ❌ If columns don't exist, **ORDER CREATION FAILS**, **DASHBOARD DISPLAY FAILS**

#### **Root Cause:**
- Migration removed old columns but didn't add new ones
- Frontend code updated to use new names, but database wasn't

---

### 🔴 **ISSUE #4: RLS Policies Using `auth.uid()` with Custom JWT**

#### **Database Impact:**
- ⚠️ RLS policies using `auth.uid()` won't work with custom JWT authentication
- ⚠️ Policies may allow unauthorized access OR block legitimate access
- ❌ Security risk - policies may be bypassed

#### **Backend Impact:**
- ⚠️ Backend uses custom JWT (not Supabase Auth)
- ⚠️ RLS policies expecting `auth.uid()` will **FAIL**
- ⚠️ Service role key may be required for all operations

#### **Frontend Impact:**
- ⚠️ Frontend queries may be blocked by RLS
- ⚠️ Data may not display correctly

#### **Affected Policies:**
- `scans` table: Lines 28, 32, 38, 46 in migration `20250802000000-create-scans-table.sql`
- `ambassadors` table: Lines 73, 81, 87, 94 in migration `20250718000000-create-ambassadors-table.sql`
- `email_tracking` table: Line 25 in migration `20250803000000-create-email-tracking-table.sql`

#### **Root Cause:**
- App uses custom JWT authentication (admin/ambassador login via Express)
- RLS policies assume Supabase Auth (`auth.uid()`)
- Mismatch between auth system and RLS expectations

---

## PHASE 2: PROPOSED SYNCHRONIZED FIXES

### 🔧 **FIX GROUP #1: Replace `pass_purchases` with `tickets`**

#### **Database Migration:**
```sql
-- 1. Drop invalid foreign key constraint
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_ticket_id_fkey;

-- 2. Update foreign key to reference tickets table
ALTER TABLE scans 
  ADD CONSTRAINT scans_ticket_id_fkey 
  FOREIGN KEY (ticket_id) 
  REFERENCES tickets(id) 
  ON DELETE CASCADE;

-- 3. Drop pass_purchases table if it exists (legacy)
DROP TABLE IF EXISTS pass_purchases CASCADE;

-- 4. Update scans table to use tickets.secure_token for QR code lookups
-- (tickets table has secure_token, not qr_code column)
```

#### **Backend Code Changes:**
**File:** `server.cjs` (lines 1034-1164)
- Change `.from('pass_purchases')` → `.from('tickets')`
- Change `.eq('qr_code', qrCode)` → `.eq('secure_token', qrCode)` (or join with order_passes/orders)
- Update field references:
  - `ticket.customer_name` → Get from `orders.user_name` via join
  - `ticket.pass_type` → Get from `order_passes.pass_type` via join
  - `ticket.event_id` → Get from `orders.event_id` via join

**New Query Structure:**
```javascript
// Tickets table uses 'secure_token' for QR code lookup (not 'qr_code')
// Must join through order_passes -> orders -> events to get customer info
const { data: ticket, error: ticketError } = await supabase
  .from('tickets')
  .select(`
    *,
    order_passes (
      pass_type,
      quantity,
      price,
      orders (
        id,
        user_name,
        user_email,
        event_id,
        events (
          id,
          name,
          date,
          venue,
          city
        )
      )
    )
  `)
  .eq('secure_token', qrCode)  // QR code contains secure_token, not qr_code column
  .single();

// Update response fields:
// ticket.order_passes.orders.user_name (instead of ticket.customer_name)
// ticket.order_passes.pass_type (instead of ticket.pass_type)
// ticket.order_passes.orders.event_id (instead of ticket.event_id)
// ticket.order_passes.orders.events (instead of ticket.events)
```

#### **Frontend Code Changes:**
- ⚠️ No direct changes needed (endpoint is backend-only)
- ⚠️ May need to update ticket generation to use `secure_token` instead of `qr_code`

---

### 🔧 **FIX GROUP #2: Add Missing `user_name`, `user_phone`, `user_email` Columns**

#### **Database Migration:**
```sql
-- 1. Add user_name column if it doesn't exist
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS user_name TEXT;

-- 2. Add user_phone column if it doesn't exist
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS user_phone TEXT;

-- 3. Add user_email column if it doesn't exist
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS user_email TEXT;

-- 4. Migrate data from old columns if they exist
UPDATE orders 
SET 
  user_name = COALESCE(user_name, customer_name, ''),
  user_phone = COALESCE(user_phone, phone, ''),
  user_email = COALESCE(user_email, email)
WHERE user_name IS NULL OR user_phone IS NULL;

-- 5. Make columns NOT NULL after migration
ALTER TABLE orders 
  ALTER COLUMN user_name SET NOT NULL,
  ALTER COLUMN user_phone SET NOT NULL;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_user_phone ON orders(user_phone);
CREATE INDEX IF NOT EXISTS idx_orders_user_email ON orders(user_email);

-- 7. Drop old columns (OPTIONAL - after confirming migration success)
-- ALTER TABLE orders DROP COLUMN IF EXISTS customer_name;
-- ALTER TABLE orders DROP COLUMN IF EXISTS phone;
-- ALTER TABLE orders DROP COLUMN IF EXISTS email;
```

#### **Backend Code Changes:**
- ✅ No changes needed (backend uses Supabase client, columns will be available)

#### **Frontend Code Changes:**
- ✅ No changes needed (frontend already uses `user_name`, `user_phone`, `user_email`)

---

### 🔧 **FIX GROUP #3: Fix RLS Policies for Custom JWT**

#### **Database Migration:**
```sql
-- Option A: Allow service role for all operations (RECOMMENDED)
-- Update scans policies
DROP POLICY IF EXISTS "Ambassadors can view their own scans" ON scans;
DROP POLICY IF EXISTS "Ambassadors can insert scans" ON scans;
DROP POLICY IF EXISTS "Admins can view all scans" ON scans;
DROP POLICY IF EXISTS "Admins can manage all scans" ON scans;

-- New policies that work with service role
CREATE POLICY "Service role can manage scans" ON scans
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
    OR current_setting('request.jwt.claims', true)::json->>'role' IS NULL
  );

CREATE POLICY "Public can view scans" ON scans
  FOR SELECT USING (true);

-- Similar updates for ambassadors, email_tracking tables
-- (Full SQL in migration file)
```

#### **Backend Code Changes:**
- ✅ Ensure service role key is used for all database operations
- ✅ Verify `server/utils/supabase.cjs` uses `SUPABASE_SERVICE_ROLE_KEY`

#### **Frontend Code Changes:**
- ✅ No changes needed (frontend uses anon key, backend handles auth)

---

## SUMMARY OF CHANGES

### **Database Migrations Required:**
1. ✅ Fix `scans.ticket_id` foreign key (reference `tickets` instead of `pass_purchases`)
2. ✅ Add `user_name`, `user_phone`, `user_email` columns to `orders` table
3. ✅ Migrate data from old columns to new columns
4. ✅ Update RLS policies to work with service role
5. ✅ Drop legacy `pass_purchases` table if exists

### **Backend Code Changes Required:**
1. ✅ Update `server.cjs` ticket validation endpoint (lines 1034-1164)
2. ✅ Change table reference: `pass_purchases` → `tickets`
3. ✅ Update query to join with `order_passes` and `orders`
4. ✅ Update field references in response

### **Frontend Code Changes Required:**
1. ✅ None (already uses correct column names)

### **Files to Modify:**
- `supabase/migrations/[NEW]-fix-critical-schema-issues.sql` (NEW)
- `server.cjs` (MODIFY)
- `server/services/ticketService.cjs` (if exists, MODIFY)
- `server/controllers/ticketController.cjs` (if exists, MODIFY)

---

## ⚠️ RISK ASSESSMENT

### **Low Risk:**
- Adding `user_name`, `user_phone`, `user_email` columns (backward compatible)
- Updating RLS policies (can be tested)

### **Medium Risk:**
- Migrating data from old columns (data loss risk if migration fails)
- Updating foreign key constraint (may fail if data exists)

### **High Risk:**
- Updating ticket validation endpoint (core functionality)
- Dropping `pass_purchases` table (if it has data)

---

## ✅ VALIDATION CHECKLIST

After fixes:
- [ ] `scans` table foreign key valid
- [ ] Ticket validation endpoint works
- [ ] Orders can be created with `user_name`, `user_phone`, `user_email`
- [ ] Frontend dashboard displays orders correctly
- [ ] RLS policies allow service role operations
- [ ] No broken queries or missing columns
- [ ] TypeScript types updated
- [ ] All tests pass

---

**READY FOR APPROVAL**

Please review and approve each fix group before I proceed with implementation.

