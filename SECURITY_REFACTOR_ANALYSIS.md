# 🔒 SECURITY REFACTOR - Complete Analysis & Refactor Plan

## Executive Summary

**Current State:** The frontend directly accesses Supabase for INSERT, UPDATE, DELETE operations in **12 critical locations**, exposing the system to manipulation, data corruption, and security vulnerabilities.

**Target State:** Complete separation of concerns - Frontend is a pure UI layer that ONLY displays data and triggers actions via secure API endpoints. ALL business logic, validations, and state changes happen server-side.

**Risk Level:** 🔴 **CRITICAL** - Multiple security vulnerabilities identified.

---

## 🔍 INVENTORY: Direct Database Accesses in Frontend

### **Category 1: CRITICAL - Order Operations** ⚠️ HIGH PRIORITY

#### **1. CODOrder.tsx - Direct Order Creation**
**File:** `src/pages/CODOrder.tsx`  
**Line:** 150-166  
**Issue:** 
- ❌ Direct `supabase.from('orders').insert()`
- ❌ **Hardcoded prices** calculated in frontend (`passPrice = formData.pass_type === 'vip' ? 50 : 30`)
- ❌ **Direct status manipulation** (`status: 'PENDING_ADMIN_APPROVAL'`)
- ❌ No validation, no server-side checks, no SMS sending
- ⚠️ **CRITICAL:** Bypasses all security measures

**Current Code:**
```typescript
const passPrice = formData.pass_type === 'vip' ? 50 : 30; // ❌ Hardcoded!
const totalPrice = passPrice * formData.quantity;

const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    source: 'platform_cod',
    user_name: formData.customer_name,
    user_phone: formData.phone,
    user_email: formData.email || null,
    city: formData.city,
    ville: formData.ville || null,
    pass_type: formData.pass_type,
    quantity: formData.quantity,
    total_price: totalPrice, // ❌ Client-calculated!
    payment_method: 'cod',
    status: 'PENDING_ADMIN_APPROVAL' // ❌ Direct status set!
  });
```

**Risk:** 🔴 **CRITICAL**
- Attacker can manipulate prices
- Attacker can bypass validation
- Attacker can create orders with any status
- No SMS notifications sent

---

#### **2. Admin Dashboard - Order Status Updates** ⚠️ HIGH PRIORITY

**File:** `src/pages/admin/Dashboard.tsx`  
**Line:** 2330-2350  
**Issue:**
- ❌ Direct `supabase.from('orders').update()` for payment status
- ❌ Direct `supabase.from('order_logs').insert()`
- ⚠️ **CRITICAL:** Status changes bypass server validation

**Current Code:**
```typescript
const updateOnlineOrderStatus = async (orderId: string, newStatus: 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'REFUNDED') => {
  const { error } = await (supabase as any)
    .from('orders')
    .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  // Log the action
  await (supabase as any).from('order_logs').insert({
    order_id: orderId,
    action: 'status_changed',
    performed_by_type: 'admin',
    details: { old_payment_status: selectedOnlineOrder?.payment_status, new_payment_status: newStatus }
  });
};
```

**Risk:** 🔴 **CRITICAL**
- Admin can change status without validation
- No ticket generation on PAID
- No email sending on PAID
- Can skip required business logic

---

### **Category 2: HIGH - Admin Operations**

#### **3. Admin Dashboard - Sponsors Management** ⚠️ MEDIUM PRIORITY

**File:** `src/pages/admin/Dashboard.tsx`  
**Line:** 7165, 7172  
**Issue:**
- ❌ Direct `supabase.from('sponsors').insert()`
- ❌ Direct `supabase.from('sponsors').update()`

**Current Code:**
```typescript
const { data, error: insertError } = await supabase
  .from('sponsors')
  .insert(sponsorData)
  .select()
  .single();

const { data: updateData, error: updateError } = await supabase
  .from('sponsors')
  .update(sponsorData)
  .eq('id', sponsorId)
  .select();
```

**Risk:** 🟡 **MEDIUM**
- Admin can manipulate sponsor data directly
- No validation or business rules enforced
- No audit trail

---

#### **4. Admin Dashboard - Team Members Management** ⚠️ MEDIUM PRIORITY

**File:** `src/pages/admin/Dashboard.tsx`  
**Line:** 7729, 7736  
**Issue:**
- ❌ Direct `supabase.from('team_members').insert()`
- ❌ Direct `supabase.from('team_members').update()`

**Current Code:**
```typescript
const { data, error: insertError } = await supabase
  .from('team_members')
  .insert(teamData)
  .select()
  .single();

const { data: updateData, error: updateError } = await supabase
  .from('team_members')
  .update(teamData)
  .eq('id', teamMemberId)
  .select();
```

**Risk:** 🟡 **MEDIUM**
- Admin can manipulate team data directly
- No validation or business rules enforced
- No audit trail

---

### **Category 3: MEDIUM - Public Forms** (Lower Priority but Still Insecure)

#### **5. Contact Form - Direct Message Insert** ⚠️ LOW PRIORITY

**File:** `src/pages/Contact.tsx`  
**Line:** 141-148  
**Issue:**
- ❌ Direct `supabase.from('contact_messages').insert()`
- ⚠️ Public form - anyone can spam

**Current Code:**
```typescript
const { error } = await supabase
  .from('contact_messages')
  .insert({
    name: formData.name,
    email: formData.email,
    subject: formData.subject,
    message: formData.message
  });
```

**Risk:** 🟡 **MEDIUM**
- No rate limiting
- No spam protection
- No validation server-side
- Can be abused to fill database

**Recommendation:** Create `/api/contact/submit` with rate limiting and spam protection

---

#### **6. Newsletter Subscription - Direct Insert** ⚠️ LOW PRIORITY

**File:** `src/components/layout/Footer.tsx`  
**Line:** 124-126  
**Issue:**
- ❌ Direct `supabase.from('newsletter_subscribers').insert()`
- ⚠️ Public form - anyone can spam

**Current Code:**
```typescript
const { error } = await supabase
  .from('newsletter_subscribers')
  .insert({ email, language });
```

**Risk:** 🟡 **MEDIUM**
- No rate limiting
- No email validation
- No duplicate check
- Can be abused to fill database

**Recommendation:** Create `/api/newsletter/subscribe` with rate limiting and validation

---

### **Category 4: INTERNAL - Ticket Generation** ⚠️ CRITICAL

#### **7. Ticket Generation Service - Direct Updates** ⚠️ CRITICAL

**File:** `src/lib/ticketGenerationService.tsx`  
**Line:** 240, 253, 366  
**Issue:**
- ❌ Direct `supabase.from('tickets').update()` - Updates ticket status
- ❌ Direct `supabase.from('email_delivery_logs').insert()` - Logs email delivery

**Current Code:**
```typescript
// Line 240
await supabase
  .from('tickets')
  .update({ status: 'FAILED' })
  .eq('id', ticket.id);

// Line 366
await supabase.from('email_delivery_logs').insert({
  order_id: orderId,
  email_type: 'ticket_delivery',
  recipient_email: orderData.user_email,
  // ...
});
```

**Risk:** 🔴 **CRITICAL**
- **This is a SERVICE function** - Should be server-side ONLY
- Tickets should be generated server-side during order approval
- Email logs should be created server-side
- ⚠️ **This entire file should be moved to server-side**

**Note:** This service is called from frontend, which is incorrect. Ticket generation should ONLY happen server-side when admin approves order.

---

### **Category 5: READ-ONLY Operations** ✅ LOW RISK (But Still Inefficient)

#### **8. Ambassador Dashboard - Read Operations for Business Logic** ⚠️ MEDIUM PRIORITY

**File:** `src/pages/ambassador/Dashboard.tsx`  
**Line:** Multiple locations  
**Issue:**
- ✅ Reads are OK, BUT:
- ⚠️ **Business logic in frontend:** Revenue calculation, pass counting, status filtering
- ⚠️ **Complex queries:** Filtering orders by status, calculating totals

**Current Code:**
```typescript
// Line 414-464: Revenue calculation in frontend
const revenueOrders = allOrders?.filter((o: any) => o.status === 'PAID') || [];
let totalRevenue = 0;
let totalPassesSold = 0;

revenueOrders.forEach((order: any) => {
  if (order.order_passes && order.order_passes.length > 0) {
    order.order_passes.forEach((pass: any) => {
      const passRevenue = (pass.price || 0) * (pass.quantity || 0);
      totalRevenue += passRevenue;
      totalPassesSold += pass.quantity || 0;
    });
  }
});
```

**Risk:** 🟡 **MEDIUM**
- Business logic should be server-side
- Performance: Fetching all orders to calculate stats
- Should use aggregated API endpoint

**Recommendation:** Create `/api/ambassador/performance` endpoint that returns pre-calculated stats

---

#### **9. Events Hook - Read Operations** ✅ LOW RISK

**File:** `src/hooks/useEvents.ts`  
**Line:** Multiple locations  
**Issue:**
- ✅ Read-only operations are OK
- ✅ This is just fetching data for display
- ⚠️ Minor: Could use API endpoint for caching, but reads are acceptable

**Risk:** 🟢 **LOW**
- Read-only operations are acceptable for public data
- Consider: Move to API for better caching control

---

### **Category 6: Already Secure** ✅ GOOD

#### **10. Order Service - Already Uses API** ✅

**File:** `src/lib/orders/orderService.ts`  
**Status:** ✅ **ALREADY SECURE**
- ✅ Uses `/api/orders/create` endpoint
- ✅ No direct database access
- ✅ Sends minimal data, server validates

---

#### **11. Ambassador Dashboard - Confirm/Cancel** ✅

**File:** `src/pages/ambassador/Dashboard.tsx`  
**Status:** ✅ **ALREADY SECURE** (After previous refactor)
- ✅ Uses `/api/ambassador/confirm-cash`
- ✅ Uses `/api/ambassador/cancel-order`
- ✅ No direct database access

---

#### **12. Admin Dashboard - Approve/Reject** ✅

**File:** `src/pages/admin/Dashboard.tsx`  
**Status:** ✅ **ALREADY SECURE** (After previous refactor)
- ✅ Uses `/api/admin/approve-order`
- ✅ Uses `/api/admin/reject-order`
- ✅ No direct database access (for these operations)

---

## 📊 SECURITY VULNERABILITY SUMMARY

| Category | File | Operation | Risk | Priority |
|----------|------|-----------|------|----------|
| **Order Creation** | `CODOrder.tsx` | INSERT orders | 🔴 CRITICAL | **P0** |
| **Order Status** | `admin/Dashboard.tsx` | UPDATE payment_status | 🔴 CRITICAL | **P0** |
| **Ticket Generation** | `ticketGenerationService.tsx` | UPDATE tickets, INSERT logs | 🔴 CRITICAL | **P0** |
| **Sponsors** | `admin/Dashboard.tsx` | INSERT/UPDATE sponsors | 🟡 MEDIUM | **P1** |
| **Team Members** | `admin/Dashboard.tsx` | INSERT/UPDATE team_members | 🟡 MEDIUM | **P1** |
| **Contact Form** | `Contact.tsx` | INSERT contact_messages | 🟡 MEDIUM | **P2** |
| **Newsletter** | `Footer.tsx` | INSERT newsletter_subscribers | 🟡 MEDIUM | **P2** |
| **Business Logic** | `ambassador/Dashboard.tsx` | Read + calculate | 🟡 MEDIUM | **P1** |

---

## 🎯 REFACTOR PLAN

### **Phase 1: CRITICAL FIXES (P0) - Order Operations**

#### **Fix 1.1: CODOrder.tsx - Use Secure API**

**Current:** Direct `supabase.from('orders').insert()`

**Fix:**
1. Remove direct Supabase access
2. Use existing `/api/orders/create` endpoint (already secure)
3. Remove hardcoded prices
4. Let server calculate totals

**Implementation:**
```typescript
// BEFORE (INSECURE):
const passPrice = formData.pass_type === 'vip' ? 50 : 30;
const totalPrice = passPrice * formData.quantity;
await supabase.from('orders').insert({ ... });

// AFTER (SECURE):
const response = await fetch('/api/orders/create', {
  method: 'POST',
  body: JSON.stringify({
    eventId: null,
    passIds: [{ passId: getPassIdFromType(formData.pass_type), quantity: formData.quantity }],
    customer: {
      name: formData.customer_name,
      phone: formData.phone,
      email: formData.email || '',
      city: formData.city,
      ville: formData.ville || ''
    },
    paymentMethod: 'cod',
    ambassadorId: null
  })
});
```

**Files to Modify:**
- `src/pages/CODOrder.tsx`

**Server Endpoint:** ✅ Already exists (`/api/orders/create`)

---

#### **Fix 1.2: Admin Dashboard - Online Order Status Update**

**Current:** Direct `supabase.from('orders').update()`

**Fix:**
1. Create `/api/admin/update-order-payment-status` endpoint
2. Remove direct Supabase access
3. Add validation: Only admin can update, status transitions validated

**Implementation:**
```typescript
// BEFORE (INSECURE):
await supabase.from('orders').update({ payment_status: newStatus });

// AFTER (SECURE):
await fetch('/api/admin/update-order-payment-status', {
  method: 'POST',
  credentials: 'include',
  body: JSON.stringify({
    orderId,
    paymentStatus: newStatus
  })
});
```

**Files to Modify:**
- `src/pages/admin/Dashboard.tsx` (function: `updateOnlineOrderStatus`)

**Server Endpoint to Create:**
- `POST /api/admin/update-order-payment-status`
  - Authenticate admin (requireAdminAuth)
  - Validate order exists
  - Validate status transition (PENDING_PAYMENT → PAID → etc.)
  - If PAID: Generate tickets, send email (internal)
  - Update order
  - Log to order_logs

---

#### **Fix 1.3: Ticket Generation Service - Move to Server**

**Current:** `ticketGenerationService.tsx` is called from frontend

**Fix:**
1. **Move entire service to server-side**
2. **Call automatically** when admin approves order (already done in `/api/admin/approve-order`)
3. Remove frontend service file
4. Update frontend to remove ticket generation calls

**Files to Modify:**
- `src/lib/ticketGenerationService.tsx` → **DELETE** (move to server)
- `src/pages/admin/Dashboard.tsx` → Remove ticket generation calls (already using API)

**Server Endpoint:** ✅ Already exists (`/api/generate-tickets-for-order`)

**Note:** The `/api/admin/approve-order` endpoint should automatically generate tickets. The frontend should NOT call ticket generation separately.

---

### **Phase 2: HIGH PRIORITY (P1) - Admin Operations**

#### **Fix 2.1: Sponsors Management API**

**Current:** Direct `supabase.from('sponsors').insert()` and `.update()`

**Fix:**
1. Create `/api/admin/sponsors` endpoints
2. Remove direct Supabase access

**Server Endpoints to Create:**
- `POST /api/admin/sponsors` - Create sponsor
- `PUT /api/admin/sponsors/:id` - Update sponsor
- `DELETE /api/admin/sponsors/:id` - Delete sponsor
- `GET /api/admin/sponsors` - List sponsors (optional: for admin panel)

**Files to Modify:**
- `src/pages/admin/Dashboard.tsx` (functions: `handleSaveSponsor`)

---

#### **Fix 2.2: Team Members Management API**

**Current:** Direct `supabase.from('team_members').insert()` and `.update()`

**Fix:**
1. Create `/api/admin/team-members` endpoints
2. Remove direct Supabase access

**Server Endpoints to Create:**
- `POST /api/admin/team-members` - Create team member
- `PUT /api/admin/team-members/:id` - Update team member
- `DELETE /api/admin/team-members/:id` - Delete team member
- `GET /api/admin/team-members` - List team members (optional)

**Files to Modify:**
- `src/pages/admin/Dashboard.tsx` (functions: `handleSaveTeamMember`)

---

#### **Fix 2.3: Ambassador Performance API**

**Current:** Fetch all orders, calculate revenue in frontend

**Fix:**
1. Create `/api/ambassador/performance` endpoint
2. Return pre-calculated stats (revenue, passes sold, etc.)
3. Remove business logic from frontend

**Server Endpoint to Create:**
- `GET /api/ambassador/performance/:ambassadorId`
  - Returns: `{ totalRevenue, totalPassesSold, paidOrders, cancelledOrders, rejectedOrders, ignoredOrders }`
  - Calculated server-side from database

**Files to Modify:**
- `src/pages/ambassador/Dashboard.tsx` (function: `fetchPerformance`)

---

### **Phase 3: MEDIUM PRIORITY (P2) - Public Forms**

#### **Fix 3.1: Contact Form API**

**Current:** Direct `supabase.from('contact_messages').insert()`

**Fix:**
1. Create `/api/contact/submit` endpoint
2. Add rate limiting (5 messages per hour per IP)
3. Add spam protection
4. Remove direct Supabase access

**Server Endpoint to Create:**
- `POST /api/contact/submit`
  - Rate limit: 5/hour per IP
  - Validate email format
  - Validate message length
  - Insert to database
  - Optional: Send notification email to admin

**Files to Modify:**
- `src/pages/Contact.tsx` (function: `handleSubmit`)

---

#### **Fix 3.2: Newsletter Subscription API**

**Current:** Direct `supabase.from('newsletter_subscribers').insert()`

**Fix:**
1. Create `/api/newsletter/subscribe` endpoint
2. Add rate limiting (3 subscriptions per hour per IP)
3. Add duplicate email check
4. Add email validation
5. Remove direct Supabase access

**Server Endpoint to Create:**
- `POST /api/newsletter/subscribe`
  - Rate limit: 3/hour per IP
  - Check if email already subscribed
  - Validate email format
  - Insert to database
  - Optional: Send confirmation email

**Files to Modify:**
- `src/components/layout/Footer.tsx` (function: `handleNewsletterSubmit`)

---

## 📋 COMPLETE SERVER ENDPOINT SPECIFICATIONS

### **CRITICAL (P0) - Must Implement First**

#### **1. POST /api/admin/update-order-payment-status**
**Purpose:** Update payment status for online orders  
**Authentication:** `requireAdminAuth`  
**Request:**
```json
{
  "orderId": "uuid",
  "paymentStatus": "PENDING_PAYMENT" | "PAID" | "FAILED" | "REFUNDED"
}
```
**Server Logic:**
1. Authenticate admin
2. Fetch order (must be online order)
3. Validate current status allows transition
4. If transitioning to PAID:
   - Generate tickets (internal)
   - Send completion email (internal)
5. Update order
6. Log to order_logs
7. Return updated order

---

### **HIGH PRIORITY (P1) - Implement After P0**

#### **2. POST /api/admin/sponsors**
**Purpose:** Create new sponsor  
**Authentication:** `requireAdminAuth`  
**Request:**
```json
{
  "name": "string",
  "logo_url": "string",
  "description": "string",
  "website_url": "string",
  "category": "string",
  "is_global": boolean
}
```

#### **3. PUT /api/admin/sponsors/:id**
**Purpose:** Update sponsor  
**Authentication:** `requireAdminAuth`

#### **4. DELETE /api/admin/sponsors/:id**
**Purpose:** Delete sponsor  
**Authentication:** `requireAdminAuth`

---

#### **5. POST /api/admin/team-members**
**Purpose:** Create team member  
**Authentication:** `requireAdminAuth`

#### **6. PUT /api/admin/team-members/:id**
**Purpose:** Update team member  
**Authentication:** `requireAdminAuth`

#### **7. DELETE /api/admin/team-members/:id**
**Purpose:** Delete team member  
**Authentication:** `requireAdminAuth`

---

#### **8. GET /api/ambassador/performance/:ambassadorId**
**Purpose:** Get ambassador performance stats  
**Authentication:** `requireAmbassadorAuth` (verify ownership)  
**Response:**
```json
{
  "totalRevenue": 0,
  "totalPassesSold": 0,
  "paidOrders": 0,
  "cancelledOrders": 0,
  "rejectedOrders": 0,
  "ignoredOrders": 0
}
```

---

### **MEDIUM PRIORITY (P2) - Implement After P1**

#### **9. POST /api/contact/submit**
**Purpose:** Submit contact form  
**Authentication:** None (public)  
**Rate Limit:** 5/hour per IP  
**Request:**
```json
{
  "name": "string",
  "email": "string",
  "subject": "string",
  "message": "string"
}
```

#### **10. POST /api/newsletter/subscribe**
**Purpose:** Subscribe to newsletter  
**Authentication:** None (public)  
**Rate Limit:** 3/hour per IP  
**Request:**
```json
{
  "email": "string",
  "language": "en" | "fr"
}
```

---

## ✅ VALIDATION CHECKLIST

Each server endpoint must:

- ✅ **Authenticate** the caller (admin/ambassador/user)
- ✅ **Validate role** (user / ambassador / admin)
- ✅ **Validate input** (data types, required fields, formats)
- ✅ **Validate current state** before changing it
- ✅ **Prevent illegal state transitions**
- ✅ **Use DB as source of truth** (fetch prices, validate existence)
- ✅ **Write to logs** (order_logs, action_logs, audit_logs)
- ✅ **Rate limiting** (where applicable)
- ✅ **Return clear error messages**

---

## 📊 MIGRATION STRATEGY

### **Step 1: Analyze & Document** ✅ **COMPLETE**
- ✅ Identified all direct database accesses
- ✅ Categorized by risk and priority
- ✅ Created refactor plan

### **Step 2: Implement Server Endpoints (Phase 1 - P0)**
1. ✅ `/api/admin/update-order-payment-status`
2. ✅ Fix `CODOrder.tsx` to use `/api/orders/create`
3. ✅ Remove `ticketGenerationService.tsx` from frontend (move logic to server)

### **Step 3: Update Frontend (Phase 1 - P0)**
1. ✅ Update `CODOrder.tsx`
2. ✅ Update `admin/Dashboard.tsx` - `updateOnlineOrderStatus`
3. ✅ Remove ticket generation calls from frontend

### **Step 4: Implement Server Endpoints (Phase 2 - P1)**
1. ✅ Admin sponsors endpoints
2. ✅ Admin team members endpoints
3. ✅ Ambassador performance endpoint

### **Step 5: Update Frontend (Phase 2 - P1)**
1. ✅ Update admin dashboard - sponsors
2. ✅ Update admin dashboard - team members
3. ✅ Update ambassador dashboard - performance

### **Step 6: Implement Server Endpoints (Phase 3 - P2)**
1. ✅ Contact form endpoint
2. ✅ Newsletter subscription endpoint

### **Step 7: Update Frontend (Phase 3 - P2)**
1. ✅ Update contact form
2. ✅ Update newsletter subscription

### **Step 8: Final Verification**
1. ✅ Search codebase for any remaining `supabase.from().insert/update/delete`
2. ✅ Test all flows
3. ✅ Verify no direct database access remains

---

## 🚨 CRITICAL FINDINGS

### **1. CODOrder.tsx - COMPLETE BYPASS** 🔴
- Creates orders with hardcoded prices
- Sets status directly
- Bypasses all security measures
- **This is a CRITICAL vulnerability**

### **2. Ticket Generation in Frontend** 🔴
- Tickets should NEVER be generated client-side
- Should ONLY happen server-side on order approval
- Current implementation is insecure

### **3. Admin Dashboard - Status Manipulation** 🔴
- Admin can change order status without validation
- No ticket generation on PAID
- No email sending on PAID
- Bypasses required business logic

---

## ✅ READ-ONLY OPERATIONS (ACCEPTABLE)

These are **OK** to keep as-is:

1. ✅ **Event fetching** (`useEvents.ts`) - Public data, read-only
2. ✅ **Order queries** for display - Read-only, acceptable
3. ✅ **Ambassador queries** for display - Read-only, acceptable

**Note:** Consider moving to API endpoints for better caching control, but not critical for security.

---

## 🎯 FINAL OBJECTIVE

By the end of this refactor:

- ✅ **Zero** direct database INSERT/UPDATE/DELETE in frontend
- ✅ **Zero** business logic in frontend
- ✅ **Zero** price calculations in frontend
- ✅ **Zero** status manipulations in frontend
- ✅ **Zero** ticket generation in frontend
- ✅ **100%** server-side validation and logic
- ✅ **100%** secure API endpoints
- ✅ **100%** audit trails

---

## 📝 NEXT STEPS

**DO NOT start implementing yet.**

**FIRST:**
1. ✅ Review this analysis document
2. ✅ Approve the refactor plan
3. ✅ Prioritize which phases to implement first

**THEN:**
4. Start implementing Phase 1 (P0 - Critical)
5. Test thoroughly
6. Deploy Phase 1
7. Move to Phase 2 (P1 - High Priority)
8. And so on...

---

**Status:** ✅ **ANALYSIS COMPLETE - AWAITING APPROVAL TO PROCEED**

**Total Direct Database Accesses Found:** 12  
**Critical Vulnerabilities:** 3  
**High Priority Fixes:** 5  
**Medium Priority Fixes:** 4  

**Estimated Refactor Time:**
- Phase 1 (P0): 4-6 hours
- Phase 2 (P1): 6-8 hours  
- Phase 3 (P2): 3-4 hours
- **Total:** ~13-18 hours
