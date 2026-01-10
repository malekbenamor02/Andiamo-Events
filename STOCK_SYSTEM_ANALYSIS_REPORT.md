# STOCK SYSTEM ANALYSIS REPORT
## Phase 0 - Complete Codebase Analysis (BEFORE IMPLEMENTATION)

**Date:** 2025-01-XX  
**Status:** ✅ ANALYSIS COMPLETE - READY FOR IMPLEMENTATION  
**Priority:** 🔴 PRODUCTION-CRITICAL

---

## 📋 EXECUTIVE SUMMARY

The stock system **database schema exists** (migration `20250220000000-add-stock-system-to-event-passes.sql` is complete), but **NO application logic has been implemented**. The system currently:
- ✅ Has database columns for stock management
- ❌ Does NOT validate stock during order creation
- ❌ Does NOT reserve stock atomically
- ❌ Does NOT release stock on cancellation/refund
- ❌ Frontend does NOT display stock availability
- ❌ Admin cannot manage stock

**Critical Finding:** Orders are currently created via **frontend** (`src/lib/orders/orderService.ts`) which directly inserts into Supabase. This is a security issue - order creation MUST move to server-side with stock validation.

---

## 1️⃣ DATABASE SCHEMA ANALYSIS

### ✅ WHAT EXISTS

**Migration File:** `supabase/migrations/20250220000000-add-stock-system-to-event-passes.sql`

#### `event_passes` Table (✅ COMPLETE)
- `max_quantity` INTEGER NULL (NULL = unlimited, non-NULL = limited)
- `sold_quantity` INTEGER NOT NULL DEFAULT 0
- `is_active` BOOLEAN NOT NULL DEFAULT true
- `release_version` INTEGER NOT NULL DEFAULT 1
- ✅ Constraints: `sold_quantity <= max_quantity OR max_quantity IS NULL`
- ✅ Indexes: Stock availability checks, active passes filtering
- ✅ Unique constraint: `(event_id, name, release_version)`

#### `order_passes` Table (⚠️ PARTIAL)
- `pass_type` TEXT NOT NULL (existing - stores pass name for display)
- `pass_id` UUID NULL REFERENCES `event_passes(id)` (NEW - added by migration)
- ✅ Migration backfills `pass_id` from existing orders
- ❌ **PROBLEM:** New orders created via frontend do NOT populate `pass_id`

#### `orders` Table (✅ COMPLETE)
- `stock_released` BOOLEAN NOT NULL DEFAULT false (NEW - prevents double-release)
- ✅ Index on `stock_released` for fast queries

### ⚠️ CRITICAL FINDINGS

1. **Migration is complete** - Database schema ready
2. **Backfill completed** - Existing orders have `pass_id` populated (via migration)
3. **New orders missing `pass_id`** - Frontend order creation doesn't set `pass_id`
4. **Initial `sold_quantity` calculated** - Migration counts existing completed/paid orders

---

## 2️⃣ ORDER CREATION FLOW ANALYSIS

### Current Implementation (❌ INSECURE)

**Location:** `src/lib/orders/orderService.ts` (lines 14-155)

**Flow:**
1. Frontend calculates totals client-side
2. Frontend directly inserts into `orders` table via Supabase client
3. Frontend directly inserts into `order_passes` table
4. **NO stock validation**
5. **NO `pass_id` populated** (only `pass_type` TEXT)
6. **NO server-side authority**

**Critical Issues:**
- ❌ Orders bypass server-side validation
- ❌ No stock checking before order creation
- ❌ No atomic stock reservation
- ❌ `order_passes.pass_id` is NULL for new orders
- ❌ Race conditions possible (multiple clients can oversell)
- ❌ Frontend controls pricing (should be server-side)

**File:**
```typescript
// src/lib/orders/orderService.ts
export async function createOrder(data: CreateOrderData): Promise<Order> {
  // ... client-side calculations ...
  
  // Create order (NO stock validation)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select()
    .single();
  
  // Create order_passes (NO pass_id populated)
  const orderPassesData = passes.map(pass => ({
    order_id: order.id,
    pass_type: pass.passName,  // ❌ Only pass_type, NO pass_id
    quantity: pass.quantity,
    price: pass.price
  }));
  
  const { error: passesError } = await supabase
    .from('order_passes')
    .insert(orderPassesData);  // ❌ Missing pass_id
}
```

### Order Creation Endpoints in `server.cjs`

**Search Results:**
- ❌ **NO POST `/api/orders/create` endpoint found**
- ❌ **NO server-side order creation logic**
- ❌ **NO stock validation anywhere**

**Conclusion:** Order creation is 100% client-side. This must be rebuilt server-side.

---

## 3️⃣ CANCELLATION & REFUND FLOW ANALYSIS

### Ambassador Cancel Order

**Location:** `src/pages/ambassador/Dashboard.tsx` (lines 578-682)

**Flow:**
1. Frontend updates order status to `CANCELLED_BY_AMBASSADOR`
2. Logs cancellation to `order_logs`
3. ❌ **NO stock release**

**Code:**
```typescript
// Updates status, but NO stock release
const { error: updateError } = await supabase
  .from('orders')
  .update({
    status: 'CANCELLED_BY_AMBASSADOR',
    cancelled_at: new Date().toISOString(),
    cancellation_reason: cancellationReason.trim()
  })
  .eq('id', selectedOrder.id);
```

### Admin Cancel Order

**Location:** `src/pages/admin/Dashboard.tsx` (search: "cancel", "reject")

**Findings:**
- Admin can reject COD orders (`handleRejectOrderAsAdmin`)
- Sets status to `REJECTED`
- ❌ **NO stock release**

### Cancellation Service

**Location:** `src/lib/orders/cancellationService.ts`

**Functions:**
- `cancelByAdmin()` - Updates status, logs
- `cancelByAmbassador()` - Updates status, logs
- `cancelBySystem()` - Updates status, logs
- ❌ **NO stock release in ANY function**

### Flouci Webhook Handler

**Location:** `server.cjs` (lines 3257-3500+)

**Flow:**
1. Verifies payment status from Flouci
2. Updates order to `PAID` on SUCCESS
3. Updates order to `FAILED` on FAILURE
4. ❌ **NO stock release on FAILURE**
5. ❌ **NO stock release on REFUND**

**Code Snippets:**
```javascript
// Line 3152: Payment failed - NO stock release
else if (paymentStatus === 'FAILURE' || paymentStatus === 'EXPIRED') {
  const updateData = {
    payment_status: 'FAILED',
    // ... NO stock release logic
  };
}
```

### Conclusion

**ALL cancellation/refund flows are MISSING stock release logic.**

---

## 4️⃣ FRONTEND STOCK DISPLAY ANALYSIS

### Pass Purchase Page

**Location:** `src/pages/PassPurchase.tsx`

**Current Behavior:**
- Fetches passes from `event_passes` table (lines 193-198)
- Shows pass name, price, description
- ❌ **Does NOT filter by `is_active`**
- ❌ **Does NOT display stock availability**
- ❌ **Does NOT show "Sold Out" badges**
- ❌ **Does NOT disable sold-out passes**

**Code:**
```typescript
// Fetches passes - NO filtering by is_active or stock
const { data: passesData, error: passesError } = await supabase
  .from('event_passes')
  .select('*')
  .eq('event_id', eventId)
  .order('is_primary', { ascending: false });
```

### Events List Page

**Location:** `src/hooks/useEvents.ts`, `src/pages/Events.tsx`

**Current Behavior:**
- Fetches events with passes
- Shows pass information
- ❌ **Does NOT display stock availability**
- ❌ **Does NOT filter inactive passes**

### Admin Dashboard

**Location:** `src/pages/admin/Dashboard.tsx`

**Current Behavior:**
- Lists events and passes
- Can edit pass prices
- ❌ **NO stock management UI**
- ❌ **Cannot set `max_quantity`**
- ❌ **Cannot activate/deactivate passes**
- ❌ **Cannot view sold/remaining quantities**

---

## 5️⃣ ORDER STATUS TRANSITIONS ANALYSIS

### Current Status Flow

**COD Orders:**
- `PENDING_CASH` → `COMPLETED` (ambassador confirms)
- `PENDING_CASH` → `CANCELLED_BY_AMBASSADOR` (ambassador cancels)
- `PENDING_ADMIN_APPROVAL` → `PAID` (admin approves, skip approval)
- `PENDING_ADMIN_APPROVAL` → `REJECTED` (admin rejects)

**Online Orders:**
- `PENDING_ONLINE` → `PAID` (webhook success)
- `PENDING_ONLINE` → `FAILED` (payment fails)
- `PAID` → `REFUNDED` (admin refunds)

**Manual Orders:**
- `MANUAL_ACCEPTED` → `MANUAL_COMPLETED`

### Stock Release Requirements

**Stock SHOULD be released when:**
- ❌ Order status → `CANCELLED_BY_AMBASSADOR` (NOT implemented)
- ❌ Order status → `REJECTED` (NOT implemented)
- ❌ Order status → `FAILED` (NOT implemented)
- ❌ Order status → `REFUNDED` (NOT implemented)
- ❌ Order timeout/expiration (NOT implemented)

**Stock SHOULD NOT be released when:**
- ✅ Order status → `COMPLETED` (correct - stock sold)
- ✅ Order status → `PAID` (correct - stock sold)
- ✅ Order status → `MANUAL_COMPLETED` (correct - stock sold)

---

## 6️⃣ WHAT MUST BE PRESERVED

### Critical Existing Functionality

1. **Multi-pass orders** - Orders can contain multiple pass types
2. **COD flow** - Ambassador cash payment flow must continue working
3. **Online payment flow** - Flouci integration must continue working
4. **Admin skip approval** - Admin can approve COD orders without ambassador
5. **Order history** - Existing orders must remain valid
6. **Pass name display** - `order_passes.pass_type` (TEXT) for historical display
7. **Backward compatibility** - Old orders without `pass_id` must still work

### Database Schema (DO NOT CHANGE)

- ✅ `event_passes` stock columns (already exist)
- ✅ `order_passes.pass_id` column (already exists, needs population)
- ✅ `orders.stock_released` flag (already exists)
- ✅ All constraints and indexes (already exist)

---

## 7️⃣ WHAT IS MISSING / BROKEN

### ❌ CRITICAL MISSING FEATURES

1. **Server-side order creation endpoint**
   - Must validate stock before creating order
   - Must atomically reserve stock in transaction
   - Must populate `pass_id` in `order_passes`

2. **Stock reservation logic**
   - Atomic UPDATE with WHERE clause
   - All-or-nothing transaction (if one pass fails, rollback all)
   - Validation: `is_active = true`, `remaining_quantity >= requested`

3. **Stock release function**
   - Single source of truth: `releaseOrderStock(orderId, reason)`
   - Idempotent (check `stock_released` flag)
   - Decrement `sold_quantity` using `pass_id`

4. **Stock release integration**
   - Ambassador cancel endpoint
   - Admin cancel/reject endpoint
   - Flouci webhook (FAILURE/REFUNDED)
   - Order expiration cron job (if exists)

5. **Frontend stock display**
   - Filter inactive passes (`is_active = true`)
   - Show "Sold Out" badges
   - Disable sold-out passes
   - Show remaining quantity

6. **Admin stock management**
   - API endpoints for stock updates
   - UI for managing `max_quantity`
   - UI for activating/deactivating passes
   - View sold/remaining quantities

### ⚠️ BROKEN / INCOMPLETE FEATURES

1. **New orders missing `pass_id`**
   - Frontend creates `order_passes` without `pass_id`
   - Stock release cannot work without `pass_id`

2. **No server-side authority**
   - Frontend controls order creation
   - No validation or stock checks

3. **Race conditions possible**
   - Multiple clients can create orders simultaneously
   - No atomic reservation

---

## 8️⃣ FILES TO MODIFY

### Database (✅ NO CHANGES NEEDED)
- ✅ Migration already complete: `supabase/migrations/20250220000000-add-stock-system-to-event-passes.sql`

### Server-Side (`server.cjs`)

**MUST CREATE:**
1. ✅ `POST /api/orders/create` - Server-side order creation with stock validation
2. ✅ `releaseOrderStock(orderId, reason)` - Shared stock release function

**MUST MODIFY:**
3. ✅ `POST /api/flouci-webhook` - Add stock release on FAILURE/REFUNDED
4. ✅ `POST /api/flouci-verify-payment` - Add stock release on FAILURE (if needed)

**MUST CREATE (Admin):**
5. ✅ `POST /api/admin/passes/:id/stock` - Update `max_quantity`
6. ✅ `POST /api/admin/passes/:id/activate` - Toggle `is_active`
7. ✅ `GET /api/admin/passes/:eventId` - List all passes with stock info
8. ✅ `GET /api/passes/:eventId` - Public endpoint for active passes with stock

**MUST CREATE/MODIFY (Ambassador):**
9. ✅ `POST /api/ambassador/cancel-order` - Add stock release
10. ✅ `POST /api/admin/cancel-order` - Add stock release (if exists)

### Frontend

**MUST MODIFY:**
1. ✅ `src/lib/orders/orderService.ts` - Route to server endpoint instead of direct Supabase
2. ✅ `src/pages/PassPurchase.tsx` - Display stock, filter inactive, disable sold-out
3. ✅ `src/hooks/useEvents.ts` - Include stock fields in pass queries
4. ✅ `src/pages/admin/Dashboard.tsx` - Add stock management UI

**MUST CREATE (Types):**
5. ✅ `src/types/orders.ts` - Add stock-related types (if needed)

---

## 9️⃣ IMPLEMENTATION RISKS

### High Risk

1. **Breaking existing orders**
   - Risk: Frontend order creation will break if we require `pass_id`
   - Mitigation: Keep `pass_type` for display, require `pass_id` for new orders

2. **Race conditions**
   - Risk: Multiple concurrent orders for same pass
   - Mitigation: Use atomic UPDATE with WHERE clause in transaction

3. **Double-release**
   - Risk: Webhook retries, admin double-clicks
   - Mitigation: Use `stock_released` flag with atomic check

4. **Overselling**
   - Risk: Stock validation fails under high traffic
   - Mitigation: Database constraint + atomic reservation

### Medium Risk

1. **Backward compatibility**
   - Risk: Old orders without `pass_id` cannot release stock
   - Mitigation: Migration already backfilled, but handle edge cases

2. **Admin skip approval**
   - Risk: Admin approval flow may not release stock if order was already created
   - Mitigation: Stock already reserved on order creation, no release needed on approval

---

## 🔟 VALIDATION SCENARIOS TO TEST

### Critical Test Cases

1. ✅ **Concurrent orders for last pass**
   - Two users buy last pass simultaneously
   - Only one should succeed

2. ✅ **Multi-pass order**
   - Order with Pass A (available) + Pass B (sold out)
   - Should fail entirely (all-or-nothing)

3. ✅ **Unlimited stock**
   - Pass with `max_quantity = NULL`
   - Should always work

4. ✅ **Inactive pass**
   - Order creation for `is_active = false` pass
   - Should fail with clear error

5. ✅ **Stock release on cancellation**
   - Ambassador cancels order
   - Stock should be released once (idempotent)

6. ✅ **Stock release on refund**
   - Admin refunds paid order
   - Stock should be released once

7. ✅ **Webhook retry**
   - Flouci webhook retries FAILURE status
   - Should not double-release stock

8. ✅ **Admin skip approval**
   - Admin approves COD order without ambassador
   - Should not affect stock (already reserved)

---

## ✅ ANALYSIS COMPLETE - READY FOR IMPLEMENTATION

### Summary

- ✅ **Database schema:** COMPLETE (migration exists)
- ❌ **Server-side logic:** MISSING (must be built)
- ❌ **Stock reservation:** MISSING (must be built)
- ❌ **Stock release:** MISSING (must be built)
- ❌ **Frontend display:** MISSING (must be built)
- ❌ **Admin management:** MISSING (must be built)

### Next Steps (PHASE 1-5)

1. **PHASE 1:** Build server-side order creation endpoint with atomic stock reservation
2. **PHASE 2:** Build stock release function and integrate into cancellation flows
3. **PHASE 3:** Update frontend to use server endpoint and display stock
4. **PHASE 4:** Build admin stock management endpoints and UI
5. **PHASE 5:** Test all critical scenarios

---

**END OF ANALYSIS REPORT**
