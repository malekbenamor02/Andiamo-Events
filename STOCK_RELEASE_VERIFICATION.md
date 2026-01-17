# Stock Release Verification - All Scenarios

This document verifies that stock is properly released and calculations are correct in all scenarios.

## ✅ Stock Release Scenarios

### 1. Admin Rejects Order ✅

**Location**: `server.cjs` line ~5459

**What happens:**
1. Order status changes to `REJECTED`
2. `releaseOrderStock()` is called
3. `stock_released` is set to `true`
4. `sold_quantity` is decremented for each pass

**Verification:**
```sql
-- Check that rejected orders have stock_released = true
SELECT 
    o.id,
    o.status,
    o.stock_released,
    COUNT(op.id) as pass_count
FROM orders o
JOIN order_passes op ON op.order_id = o.id
WHERE o.status = 'REJECTED'
GROUP BY o.id, o.status, o.stock_released;

-- All should show stock_released = true
```

### 2. Ambassador Cancels Order ✅

**Location**: `server.cjs` line ~4849

**What happens:**
1. Order status changes to `CANCELLED_BY_AMBASSADOR`
2. `releaseOrderStock()` is called
3. `stock_released` is set to `true`
4. `sold_quantity` is decremented for each pass

**Verification:**
```sql
-- Check that cancelled orders have stock_released = true
SELECT 
    o.id,
    o.status,
    o.stock_released,
    COUNT(op.id) as pass_count
FROM orders o
JOIN order_passes op ON op.order_id = o.id
WHERE o.status = 'CANCELLED_BY_AMBASSADOR'
GROUP BY o.id, o.status, o.stock_released;

-- All should show stock_released = true
```

### 3. Order Expires Automatically ✅

**Location**: `supabase/migrations/20250227000000-restrict-expiration-to-pending-cash-only.sql` line ~227

**What happens:**
1. Database function `auto_reject_expired_pending_cash_orders()` runs
2. Calls `release_order_stock_internal()` BEFORE status change
3. `stock_released` is set to `true`
4. `sold_quantity` is decremented for each pass
5. Order status changes to `REJECTED`

**Verification:**
```sql
-- Check that expired/rejected orders have stock_released = true
SELECT 
    o.id,
    o.status,
    o.stock_released,
    o.rejection_reason,
    COUNT(op.id) as pass_count
FROM orders o
JOIN order_passes op ON op.order_id = o.id
WHERE o.status = 'REJECTED'
  AND o.rejection_reason LIKE '%expired%'
GROUP BY o.id, o.status, o.stock_released, o.rejection_reason;

-- All should show stock_released = true
```

### 4. Admin Removes Order ✅

**Location**: 
- `server.cjs` line ~5350 (main server)
- `api/misc.js` line ~3337 (API endpoint)

**What happens:**
1. Order status changes to `REMOVED_BY_ADMIN`
2. `releaseOrderStock()` is called
3. `stock_released` is set to `true`
4. `sold_quantity` is decremented for each pass

**Verification:**
```sql
-- Check that removed orders have stock_released = true
SELECT 
    o.id,
    o.status,
    o.stock_released,
    COUNT(op.id) as pass_count
FROM orders o
JOIN order_passes op ON op.order_id = o.id
WHERE o.status = 'REMOVED_BY_ADMIN'
GROUP BY o.id, o.status, o.stock_released;

-- All should show stock_released = true
```

### 5. Admin Cancels/Refunds Order ✅

**Location**: `server.cjs` line ~5160

**What happens:**
1. Order status changes to `CANCELLED` or `REFUNDED`
2. `releaseOrderStock()` is called
3. `stock_released` is set to `true`
4. `sold_quantity` is decremented for each pass

**Verification:**
```sql
-- Check that cancelled/refunded orders have stock_released = true
SELECT 
    o.id,
    o.status,
    o.stock_released,
    COUNT(op.id) as pass_count
FROM orders o
JOIN order_passes op ON op.order_id = o.id
WHERE o.status IN ('CANCELLED', 'CANCELLED_BY_ADMIN', 'REFUNDED')
GROUP BY o.id, o.status, o.stock_released;

-- All should show stock_released = true
```

## 🔍 Comprehensive Verification Query

Run this query to check ALL scenarios at once:

```sql
-- Verify stock release for all cancellation/rejection scenarios
SELECT 
    o.status,
    COUNT(*) as order_count,
    COUNT(*) FILTER (WHERE o.stock_released = true) as stock_released_count,
    COUNT(*) FILTER (WHERE o.stock_released = false) as stock_not_released_count,
    SUM(op.quantity) FILTER (WHERE o.stock_released = false) as passes_still_reserved
FROM orders o
JOIN order_passes op ON op.order_id = o.id
WHERE o.status IN (
    'REJECTED',
    'CANCELLED',
    'CANCELLED_BY_AMBASSADOR',
    'CANCELLED_BY_ADMIN',
    'REMOVED_BY_ADMIN',
    'REFUNDED'
)
GROUP BY o.status
ORDER BY o.status;
```

**Expected Results:**
- All orders in these statuses should have `stock_released = true`
- `stock_not_released_count` should be 0 for all statuses
- `passes_still_reserved` should be 0 for all statuses

## ✅ Stock Calculation Verification

The calculation logic ensures:

1. **Orders with `stock_released = true` are NEVER counted** (primary check)
2. **Orders with excluded statuses are NEVER counted** (defensive check)
3. **Only active/reserved orders are counted**:
   - `PAID`, `COMPLETED`, `MANUAL_COMPLETED` (if `stock_released = false`)
   - `PENDING_CASH`, `PENDING_ONLINE`, etc. (if `stock_released = false`)

**Test the calculation:**
```sql
-- This should return 0 discrepancies
SELECT * FROM verify_stock_calculations() WHERE discrepancy != 0;
```

## 🧪 Test Scenarios

### Test 1: Create Order → Reject → Verify Stock Released

```sql
-- 1. Create a test order (via API)
-- 2. Check sold_quantity increased
-- 3. Reject the order (via API)
-- 4. Verify stock_released = true
-- 5. Verify sold_quantity decreased
```

### Test 2: Create Order → Cancel → Verify Stock Released

```sql
-- 1. Create a test order (via API)
-- 2. Check sold_quantity increased
-- 3. Cancel the order (via API)
-- 4. Verify stock_released = true
-- 5. Verify sold_quantity decreased
```

### Test 3: Create Order → Let Expire → Verify Stock Released

```sql
-- 1. Create a PENDING_CASH order with short expiration
-- 2. Check sold_quantity increased
-- 3. Wait for expiration or trigger auto-reject
-- 4. Verify stock_released = true
-- 5. Verify sold_quantity decreased
```

### Test 4: Create Order → Remove → Verify Stock Released

```sql
-- 1. Create a test order (via API)
-- 2. Check sold_quantity increased
-- 3. Remove the order (via API)
-- 4. Verify stock_released = true
-- 5. Verify sold_quantity decreased
```

## ⚠️ Common Issues to Check

### Issue 1: Orders with stock_released = false but status is REJECTED/CANCELLED

**Problem**: Stock wasn't released when order was rejected/cancelled

**Check:**
```sql
SELECT id, status, stock_released, created_at, updated_at
FROM orders
WHERE status IN ('REJECTED', 'CANCELLED', 'CANCELLED_BY_AMBASSADOR', 'REMOVED_BY_ADMIN')
  AND stock_released = false;
```

**Fix**: Manually release stock for these orders or investigate why release failed

### Issue 2: sold_quantity doesn't match actual orders

**Problem**: Calculation is incorrect

**Check:**
```sql
SELECT * FROM verify_stock_calculations() WHERE discrepancy != 0;
```

**Fix**: Run the migration again to recalculate

### Issue 3: Double stock release

**Problem**: Stock released multiple times

**Check:**
```sql
-- Check order_logs for multiple stock_released entries
SELECT order_id, COUNT(*) as release_count
FROM order_logs
WHERE action = 'stock_released'
GROUP BY order_id
HAVING COUNT(*) > 1;
```

**Fix**: The `stock_released` flag should prevent this, but investigate if it occurs

## ✅ Success Criteria

After running all tests, you should see:

1. ✅ All rejected orders have `stock_released = true`
2. ✅ All cancelled orders have `stock_released = true`
3. ✅ All expired orders have `stock_released = true`
4. ✅ All removed orders have `stock_released = true`
5. ✅ `verify_stock_calculations()` shows no discrepancies
6. ✅ New orders can be created successfully (stock is available)
7. ✅ Stock counts match across all views in the application

## 📝 Notes

- The `stock_released` flag is the **primary** mechanism to prevent counting released stock
- Status exclusions are a **defensive** measure
- Both checks work together to ensure accuracy
- The migration recalculates everything from scratch, so it's safe to run anytime
