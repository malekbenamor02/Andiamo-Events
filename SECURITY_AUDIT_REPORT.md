# 🔒 COMPREHENSIVE SECURITY AUDIT REPORT
**Date:** 2025-02-02  
**Auditor:** Senior Security Architect + Backend Lead  
**Scope:** Full codebase security hardening

---

## 📋 EXECUTIVE SUMMARY

This audit identifies **CRITICAL security violations** across the codebase that violate the server-authoritative architecture. The system has **multiple attack vectors** that allow:
- Frontend database manipulation
- Price tampering
- Status skipping
- Rate limit bypass (IPv6)
- SMS abuse
- Replay attacks

**Risk Level:** 🔴 **CRITICAL** - Immediate action required

---

## 🔴 CRITICAL VIOLATIONS FOUND

### 1. FRONTEND DATABASE ACCESS (CRITICAL)

#### Violations:
- **`src/pages/admin/Dashboard.tsx`** (Lines 7079, 7086, 7643, 7650)
  - Direct `supabase.from('sponsors').insert()` and `.update()`
  - Direct `supabase.from('team_members').insert()` and `.update()`
  - **Impact:** Admin can manipulate data without server validation

- **`src/lib/ticketGenerationService.tsx`** (Line 366)
  - Direct `supabase.from('email_delivery_logs').insert()`
  - **Impact:** Frontend can log fake email delivery events

- **`src/lib/logger.ts`** (Line 77)
  - Direct `supabase.from('site_logs').insert()`
  - **Impact:** Frontend can inject fake audit logs

#### Required Actions:
- ❌ **REMOVE** all frontend database inserts/updates
- ✅ **CREATE** API endpoints for all admin operations
- ✅ **ENFORCE** server-side validation for all data modifications

---

### 2. PRICE CALCULATION IN FRONTEND (CRITICAL)

#### Violations:
- **`src/pages/PassPurchase.tsx`** (Lines 241-253, 364, 456, 757)
  - `calculateTotal()` function calculates prices client-side
  - Uses `pass.price * quantity` directly from frontend
  - **Impact:** Users can manipulate prices by modifying frontend code

- **`src/components/orders/OrderSummary.tsx`** (Lines 100-101, 113)
  - Displays calculated totals from frontend
  - **Impact:** UI shows client-calculated prices (should only display server-validated prices)

#### Required Actions:
- ❌ **REMOVE** all price calculation logic from frontend
- ✅ **ENSURE** server recalculates ALL prices from database
- ✅ **VALIDATE** server ignores any `price` or `total` sent from frontend

---

### 3. ORDER STATUS STATE MACHINE VIOLATIONS (CRITICAL)

#### Current Flow (INCONSISTENT):
```
COD Orders:
  PENDING_CASH → PENDING_ADMIN_APPROVAL → PAID/COMPLETED/REJECTED
  ❌ Status mismatch: platform_cod uses COMPLETED, but admin approval sets PAID
  ❌ No SMS_SENT state tracking
  ❌ No validation that states are sequential

Online Orders:
  PENDING_ONLINE → PAID → TICKETS_SENT
  ❌ Missing intermediate states
  ❌ No idempotency on status transitions
```

#### Violations Found:
- **`server.cjs:3690`** - Admin approval sets `COMPLETED` for `platform_cod`, but ticket generation expects `PAID` or `COMPLETED`
- **`server.cjs:3289`** - Orders created with `PENDING_CASH` but database constraint expects `PENDING_ADMIN_APPROVAL` for COD
- **`src/pages/admin/Dashboard.tsx:2244`** - `updateOnlineOrderStatus()` directly updates `payment_status` without state machine validation
- **Missing:** No state transition validation middleware
- **Missing:** No prevention of skipping states

#### Required Actions:
- ✅ **DEFINE** strict state machine with all intermediate states
- ✅ **IMPLEMENT** state transition validator middleware
- ✅ **ENFORCE** forward-only transitions (no skipping, no reverting)
- ✅ **ADD** idempotency keys to all status transitions

---

### 4. RATE LIMITING VULNERABILITIES (CRITICAL)

#### IPv6 Bypass Issue:
- **`server.cjs:2921`** - `orderPerPhoneLimiter` uses `req.ip` directly
  - **Error:** `ERR_ERL_KEY_GEN_IPV6` - IPv6 addresses can bypass limits
  - **Impact:** IPv6 users can create unlimited orders

#### Missing Action-Based Limiters:
- ❌ No dedicated limiter for "Confirm COD" action
- ❌ No dedicated limiter for "Admin Approve" action
- ❌ SMS limiter is global (should be per-phone/per-order)
- ❌ No idempotency-based rate limiting

#### Required Actions:
- ✅ **FIX** IPv6 normalization using express-rate-limit helper
- ✅ **CREATE** action-specific rate limiters:
  - `confirmCashLimiter`: 1 request per orderId
  - `adminApproveLimiter`: High limit, admin-auth only
  - `smsPerPhoneLimiter`: 1 SMS per phone per 2 minutes
- ✅ **PRIORITIZE** business identifiers (phone, orderId) over IP

---

### 5. SMS ENDPOINT SECURITY (HIGH)

#### Vulnerabilities:
- **`server.cjs:2043`** - `/api/send-order-confirmation-sms`
  - ❌ **NO AUTHENTICATION** - Publicly accessible
  - ⚠️ Only has `smsLimiter` (IP-based, bypassable)
  - **Impact:** Anyone can trigger SMS sends, causing abuse and costs

- **`server.cjs:2173`** - `/api/send-ambassador-order-sms`
  - ❌ **NO AUTHENTICATION** - Publicly accessible
  - ⚠️ Only has `smsLimiter` (IP-based, bypassable)
  - **Impact:** SMS spam to ambassadors

- **`server.cjs:1679`** - `/api/send-sms` (Broadcast)
  - ✅ Has `requireAdminAuth` - **CORRECT**
  - ⚠️ But no per-phone rate limiting

#### Required Actions:
- ✅ **REQUIRE** authentication on ALL SMS endpoints
- ✅ **VALIDATE** order ownership before sending SMS
- ✅ **ENFORCE** idempotency (prevent duplicate SMS)
- ✅ **ADD** per-phone rate limiting (1 SMS per phone per 2 minutes)
- ✅ **REMOVE** public SMS endpoints or make them internal-only

---

### 6. IDEMPOTENCY GAPS (HIGH)

#### Missing Idempotency:
- ❌ **Ambassador confirm cash** - No idempotency key
  - **Impact:** Double-clicking can create duplicate confirmations
- ❌ **Admin approve order** - No idempotency key
  - **Impact:** Multiple approvals can generate duplicate tickets
- ❌ **Ticket generation** - Partial (checks existing tickets, but no request-level idempotency)
- ✅ **Order creation** - Has idempotency key (CORRECT)

#### Required Actions:
- ✅ **ADD** idempotency keys to:
  - `/api/ambassador/confirm-cash`
  - `/api/admin/approve-order`
  - `/api/admin/reject-order`
  - `/api/generate-tickets-for-order`
- ✅ **STORE** idempotency keys in database with action type
- ✅ **RETURN** existing result if same key used twice

---

### 7. ROLE-BASED ACCESS CONTROL (MEDIUM)

#### Issues Found:
- **`server.cjs:2938`** - `requireAmbassadorAuth`
  - ⚠️ Accepts `ambassadorId` and `ambassadorToken` from request body
  - ⚠️ No token validation (only checks if ambassador exists)
  - **Impact:** Anyone can spoof ambassador ID if they know it

- **`server.cjs:1266`** - `requireAdminAuth`
  - ✅ Validates JWT token (CORRECT)
  - ✅ Checks expiration (CORRECT)
  - ⚠️ But doesn't verify admin is still active in database on every request

#### Required Actions:
- ✅ **ENFORCE** proper token-based auth for ambassadors (not just ID)
- ✅ **VERIFY** admin is active in database on every request
- ✅ **ADD** role checks to all sensitive endpoints
- ✅ **LOG** all role-based access attempts

---

### 8. ADMIN DASHBOARD DIRECT DB ACCESS (CRITICAL)

#### Violations:
- **`src/pages/admin/Dashboard.tsx:2244`** - `updateOnlineOrderStatus()`
  - Directly updates `payment_status` without API
  - **Impact:** Admin can skip state machine, change status arbitrarily

- **`src/pages/admin/Dashboard.tsx:7079, 7086, 7643, 7650`**
  - Direct database inserts/updates for sponsors and team members
  - **Impact:** No server-side validation, no audit trail

#### Required Actions:
- ❌ **REMOVE** all direct database operations from admin dashboard
- ✅ **CREATE** API endpoints:
  - `/api/admin/update-order-payment-status`
  - `/api/admin/manage-sponsors`
  - `/api/admin/manage-team-members`
- ✅ **ENFORCE** state machine validation in all endpoints

---

### 9. DEPRECATED UNSAFE FUNCTIONS (MEDIUM)

#### Functions Still Accessible:
- **`src/lib/orders/orderService.ts`**
  - `updateOrderStatus()` - Marked deprecated but still callable
  - `cancelOrder()` - Marked deprecated but still callable

- **`src/lib/orders/cancellationService.ts`**
  - `cancelByAdmin()` - Marked deprecated but still callable
  - `cancelByAmbassador()` - Marked deprecated but still callable

- **`src/lib/ambassadorOrders.ts`**
  - `completeOrderAsAdmin()` - Marked deprecated but still callable
  - `cancelOrderAsAdmin()` - Marked deprecated but still callable

#### Required Actions:
- ❌ **REMOVE** deprecated functions entirely (not just mark)
- ✅ **OR** throw errors if called from frontend
- ✅ **ENSURE** only server-side code can use them

---

### 10. SILENT FAILURES (MEDIUM)

#### Issues:
- **`server.cjs:3726-3729`** - Ticket generation errors are silently caught
  - **Impact:** Admin sees "tickets generation failed" but no details
- **`server.cjs:3743-3746`** - Email sending errors are silently caught
  - **Impact:** Failures are hidden, no retry mechanism

#### Required Actions:
- ✅ **LOG** all failures with full error details
- ✅ **RETURN** error details to admin (not just "failed")
- ✅ **IMPLEMENT** retry mechanism with exponential backoff
- ✅ **ALERT** on critical failures

---

## 📊 VULNERABILITY SUMMARY

| Category | Severity | Count | Status |
|----------|----------|-------|--------|
| Frontend DB Access | 🔴 CRITICAL | 6 | Needs Fix |
| Price Calculation | 🔴 CRITICAL | 2 | Needs Fix |
| State Machine | 🔴 CRITICAL | 4 | Needs Fix |
| Rate Limiting | 🔴 CRITICAL | 1 | Needs Fix |
| SMS Security | 🟠 HIGH | 3 | Needs Fix |
| Idempotency | 🟠 HIGH | 3 | Needs Fix |
| RBAC | 🟡 MEDIUM | 2 | Needs Fix |
| Silent Failures | 🟡 MEDIUM | 2 | Needs Fix |
| Deprecated Functions | 🟡 MEDIUM | 6 | Needs Removal |

**Total Critical Issues:** 13  
**Total High Issues:** 6  
**Total Medium Issues:** 10

---

## 🛡️ REQUIRED SECURITY ARCHITECTURE

### 1. SERVER-OWNED BUSINESS LOGIC

#### Current State: ⚠️ PARTIAL
- ✅ Order creation uses server API
- ❌ Price calculation happens in frontend
- ❌ Admin dashboard has direct DB access
- ❌ Status updates bypass state machine

#### Required Implementation:
```
Frontend → API Request (IDs only)
         ↓
Server → Validate Event Exists
       → Fetch Passes from DB
       → Calculate Prices (IGNORE client prices)
       → Validate Ambassador
       → Validate City/Ville
       → Create Order
       → Send SMS (internal)
       → Return Order
```

---

### 2. ORDER STATE MACHINE (MANDATORY)

#### Required States:
```
COD Order Flow:
  CREATED (PENDING_CASH)
    → SMS_SENT (tracked in order_logs)
    → AMBASSADOR_CONFIRMED (PENDING_ADMIN_APPROVAL)
    → ADMIN_APPROVED (PAID/COMPLETED)
    → TICKETS_GENERATED
    → TICKETS_SENT

Online Order Flow:
  CREATED (PENDING_ONLINE)
    → PAYMENT_INITIATED
    → PAYMENT_VERIFIED (PAID)
    → TICKETS_GENERATED
    → TICKETS_SENT
```

#### Required Validations:
- ✅ No skipping states
- ✅ No reverting without admin override
- ✅ Each transition requires previous state
- ✅ Idempotency key per transition
- ✅ Server validates state before update

---

### 3. ACTION-BASED RATE LIMITING

#### Required Limiters:

| Action | Endpoint | Limit | Key Strategy |
|--------|----------|-------|--------------|
| Create Order | `/api/orders/create` | 3 / 10 min | Phone number (primary), normalized IP (fallback) |
| Confirm COD | `/api/ambassador/confirm-cash` | 1 / orderId | OrderId + AmbassadorId |
| Admin Approve | `/api/admin/approve-order` | High / auth | AdminId + OrderId |
| Send SMS | `/api/send-*-sms` | 1 / 2 min | Phone number (primary) |
| Generate Tickets | `/api/generate-tickets-for-order` | 1 / orderId | OrderId (idempotency) |

#### IPv6 Fix Required:
```javascript
// WRONG (current):
keyGenerator: (req) => req.body?.customerInfo?.phone || req.ip

// CORRECT:
const { ipKeyGenerator } = require('express-rate-limit');
keyGenerator: (req) => {
  const phone = req.body?.customerInfo?.phone;
  if (phone) return `phone:${phone}`;
  return ipKeyGenerator(req); // Normalizes IPv6
}
```

---

### 4. IDEMPOTENCY IMPLEMENTATION

#### Required for All Critical Actions:

1. **Order Creation** ✅ (Already implemented)
2. **Confirm Cash** ❌ (Missing)
   - Add `idempotencyKey` to request
   - Store in `order_logs` with action type
   - Return existing result if key exists

3. **Admin Approve** ❌ (Missing)
   - Add `idempotencyKey` to request
   - Prevent duplicate approvals
   - Prevent duplicate ticket generation

4. **Ticket Generation** ⚠️ (Partial)
   - Currently checks existing tickets
   - Need request-level idempotency key

---

### 5. SMS & EMAIL PROTECTION

#### Current Issues:
- Public SMS endpoints
- No order ownership validation
- IP-based rate limiting (bypassable)

#### Required Fixes:
```javascript
// ALL SMS endpoints must:
1. Require authentication (admin/ambassador)
2. Validate order ownership
3. Check order state (only send if valid state)
4. Use phone-based rate limiting (not IP)
5. Enforce idempotency (prevent duplicate sends)
6. Log all attempts (success and failure)
```

---

### 6. AUDIT LOGGING

#### Current State: ⚠️ PARTIAL
- ✅ Security audit logs exist
- ⚠️ Not all actions are logged
- ❌ IP addresses not normalized (IPv6 issue)

#### Required:
- ✅ Log every status transition with:
  - Actor (user/ambassador/admin ID)
  - Action type
  - OrderId
  - Old status → New status
  - Timestamp
  - Normalized IP address
  - Idempotency key (if applicable)

---

## 📝 REFACTOR PLAN (STEP-BY-STEP)

### PHASE 1: CRITICAL FIXES (IMMEDIATE)

#### Step 1.1: Remove Frontend Database Access
- [ ] Remove all `supabase.from().insert/update/delete` from `src/pages/admin/Dashboard.tsx`
- [ ] Remove `supabase.from('email_delivery_logs').insert()` from `src/lib/ticketGenerationService.tsx`
- [ ] Remove `supabase.from('site_logs').insert()` from `src/lib/logger.ts`
- [ ] Create API endpoints for all removed operations

#### Step 1.2: Fix IPv6 Rate Limiting
- [ ] Import `ipKeyGenerator` from express-rate-limit
- [ ] Update `orderPerPhoneLimiter` to use normalized IP
- [ ] Test with IPv6 addresses

#### Step 1.3: Secure SMS Endpoints
- [ ] Add authentication to `/api/send-order-confirmation-sms`
- [ ] Add authentication to `/api/send-ambassador-order-sms`
- [ ] Add order ownership validation
- [ ] Add phone-based rate limiting

---

### PHASE 2: STATE MACHINE ENFORCEMENT

#### Step 2.1: Define State Machine
- [ ] Create `OrderStateMachine` class with:
  - Valid states per order source
  - Valid transitions
  - Required conditions for each transition
- [ ] Document in code and migration

#### Step 2.2: Implement State Validator Middleware
- [ ] Create `validateStateTransition` middleware
- [ ] Apply to all status update endpoints
- [ ] Enforce forward-only transitions
- [ ] Prevent state skipping

#### Step 2.3: Fix Status Mismatches
- [ ] Standardize COD order final status (PAID vs COMPLETED)
- [ ] Update ticket generation to accept correct status
- [ ] Update admin approval to set correct status

---

### PHASE 3: IDEMPOTENCY IMPLEMENTATION

#### Step 3.1: Add Idempotency to Confirm Cash
- [ ] Add `idempotencyKey` parameter
- [ ] Store in database with action type
- [ ] Return existing result if duplicate

#### Step 3.2: Add Idempotency to Admin Actions
- [ ] Add to approve endpoint
- [ ] Add to reject endpoint
- [ ] Prevent duplicate ticket generation

#### Step 3.3: Enhance Ticket Generation Idempotency
- [ ] Add request-level idempotency key
- [ ] Store in database
- [ ] Return existing tickets if key exists

---

### PHASE 4: API ENDPOINT CREATION

#### Step 4.1: Admin Management APIs
- [ ] `/api/admin/sponsors` - CRUD operations
- [ ] `/api/admin/team-members` - CRUD operations
- [ ] `/api/admin/update-order-payment-status` - Status updates
- [ ] All with proper validation and audit logging

#### Step 4.2: Remove Deprecated Functions
- [ ] Delete or throw errors in:
  - `updateOrderStatus()`
  - `cancelOrder()`
  - `cancelByAdmin()`
  - `cancelByAmbassador()`
  - `completeOrderAsAdmin()`
  - `cancelOrderAsAdmin()`

---

### PHASE 5: RATE LIMITING HARDENING

#### Step 5.1: Create Action-Specific Limiters
- [ ] `confirmCashLimiter` - 1 per orderId
- [ ] `adminApproveLimiter` - High limit, admin-only
- [ ] `smsPerPhoneLimiter` - 1 per phone per 2 min
- [ ] `ticketGenerationLimiter` - 1 per orderId

#### Step 5.2: Implement Layered Key Strategy
- [ ] Priority 1: Business identifier (phone, orderId, ambassadorId)
- [ ] Priority 2: Normalized IP (IPv4 + IPv6 canonical)
- [ ] Never use raw `req.ip` directly

---

### PHASE 6: AUDIT LOGGING ENHANCEMENT

#### Step 6.1: Comprehensive Logging
- [ ] Log all status transitions
- [ ] Log all SMS sends (success and failure)
- [ ] Log all admin actions
- [ ] Normalize all IP addresses (IPv6)

#### Step 6.2: Error Reporting
- [ ] Remove silent failures
- [ ] Return detailed errors to admins
- [ ] Implement retry mechanisms
- [ ] Alert on critical failures

---

## 🚨 PRIORITY MATRIX

### P0 - CRITICAL (Fix Immediately):
1. Remove frontend database access
2. Fix IPv6 rate limiting bypass
3. Secure SMS endpoints (add auth)
4. Fix price calculation (server-only)

### P1 - HIGH (Fix This Week):
5. Implement state machine validator
6. Add idempotency to all critical actions
7. Create API endpoints for admin operations

### P2 - MEDIUM (Fix This Month):
8. Remove deprecated functions
9. Enhance audit logging
10. Fix silent failures

---

## ✅ VERIFICATION CHECKLIST

After implementation, verify:

- [ ] No `supabase.from().insert/update/delete` in `src/` directory
- [ ] All prices calculated server-side only
- [ ] All status transitions go through validator
- [ ] All SMS endpoints require authentication
- [ ] All critical actions have idempotency keys
- [ ] IPv6 addresses normalized in rate limiters
- [ ] All admin operations use API endpoints
- [ ] All failures are logged with details
- [ ] State machine prevents skipping states
- [ ] Rate limits use business identifiers (not just IP)

---

## 📚 REFERENCES

- Express Rate Limit IPv6: https://express-rate-limit.github.io/ERR_ERL_KEY_GEN_IPV6/
- State Machine Pattern: https://en.wikipedia.org/wiki/Finite-state_machine
- Idempotency Best Practices: https://stripe.com/docs/api/idempotent_requests

---

**END OF AUDIT REPORT**

**⚠️ DO NOT PROCEED WITH IMPLEMENTATION UNTIL CONFIRMED**
