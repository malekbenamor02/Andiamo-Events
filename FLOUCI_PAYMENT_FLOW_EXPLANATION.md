# Flouci Payment Flow - Complete Documentation

This document explains the complete Flouci payment integration flow from order creation to ticket delivery, based on the actual implementation.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [The Final Rulebook](#the-final-rulebook) 🔒
3. [Security Principles](#security-principles)
4. [Step-by-Step Flow](#step-by-step-flow)
5. [Key Components](#key-components)
6. [Payment States & Status Flow](#payment-states--status-flow)
7. [Idempotency & Replay Protection](#idempotency--replay-protection)
8. [Error Handling](#error-handling)
9. [Security Features](#security-features)

---

## 🎯 Overview

The Flouci payment system uses a **secure, redirect-based flow** with the following key principles:

- ✅ **Backend-only API calls** - Secret keys never exposed to frontend
- ✅ **Backend calculates amount** - Amount fetched from DB, not trusted from frontend
- ✅ **Verification API is source of truth** - Only `verify_payment()` confirms payment status
- ✅ **Idempotency protection** - One active payment per order, prevents duplicates
- ✅ **Webhook + redirect dual flow** - Both paths verify independently
- ✅ **Ticket generation only after PAID** - Tickets generated only after verification confirms SUCCESS
- ✅ **No card data on frontend** - All card data entered on Flouci's secure page

**Key Principle:** We never trust frontend data for payment amounts or status. All critical operations happen in the backend with database verification.

---

## 🔒 The Final Rulebook

**If you remember nothing else, remember these rules. They are non-negotiable.**

### 🔐 Payment Authority Rules

```
Redirect ≠ truth
Webhook ≠ truth
verify_payment() = ONLY truth
```

**Never mark order PAID based on:**
- ❌ Redirect status (can be unreliable)
- ❌ Webhook payload alone (can be replayed)
- ❌ Frontend signal (can be manipulated)

**Only mark PAID when:**
- ✅ `verify_payment(payment_id).status === 'SUCCESS'`

### 🔐 Order State Rules

```
Create order → save user info
Generate payment → save payment_id
verify SUCCESS → mark PAID
PAID → generate tickets
Tickets → send email
Email → send SMS
```

**Never change this order. Each step depends on the previous.**

### 🔐 Data Rules

```
Frontend sends intent, never authority
Backend calculates money
Backend confirms payment
Backend delivers assets
```

**Frontend role:**
- Sends `orderId` (intent to pay)
- Never sends amount (backend calculates)
- Never confirms payment (backend verifies)

**Backend role:**
- Fetches order from DB
- Calculates amount from `order_passes`
- Verifies payment with Flouci API
- Generates tickets and sends communications

### 🔐 Communication Rules

```
Email = delivery channel (QR codes, tickets)
SMS = confirmation channel (simple confirmation)
```

**Email:**
- ✅ Contains QR codes
- ✅ Contains ticket details
- ✅ Contains order information
- ✅ Sent after tickets generated

**SMS:**
- ✅ Simple confirmation message
- ✅ Order ID (first 8 chars)
- ✅ Total amount
- ✅ **NO URLs**
- ✅ **NO QR codes**
- ✅ **NO sensitive data**

**Never mix them. Never put sensitive data in SMS.**

---

## 🔒 Security Principles

### **1. Amount Source (CRITICAL)**
- ❌ **NEVER** trust frontend amount
- ✅ **ALWAYS** fetch order from DB and recalculate from `order_passes`
- Backend calculates: `sum(pass.price * pass.quantity)` from database

### **2. Source of Truth**
- ❌ **NEVER** mark order PAID based on redirect status
- ❌ **NEVER** mark order PAID based on webhook payload alone
- ✅ **ONLY** mark PAID when `verify_payment(payment_id).status === 'SUCCESS'`

**See [The Final Rulebook](#the-final-rulebook) for complete payment authority rules.**

### **3. Idempotency**
- One active payment per order (unique constraint on `payment_gateway_reference`)
- One ticket generation per order (checked before generating)
- One email per order (idempotency checks)
- Webhook replay protection (returns 200 if already PAID)

### **4. PENDING Handling**
- Frontend retries with exponential backoff (max 5 retries)
- After max retries, waits for webhook to finalize
- Backend allows webhook to finalize PENDING payments
- Prevents infinite retry loops

---

## 🔄 Step-by-Step Flow

### **Step 1: User Clicks "Book Now"**

**Location:** `src/pages/Events.tsx` or `src/pages/UpcomingEvent.tsx`

**Action:**
- User clicks "Book Now" button on an event
- Navigates to `/pass-purchase?eventId={eventId}`

---

### **Step 2: User Fills Order Form**

**Location:** `src/pages/PassPurchase.tsx`

**User Actions:**
1. Selects passes (quantity for each pass type)
2. Fills customer information:
   - Full Name
   - Email
   - Phone
   - City
   - Ville (optional)
3. Selects payment method: **Online Payment**
4. Clicks "Submit" button

**Validation:**
- Form validation checks all required fields
- Ensures at least one pass is selected
- Validates payment method is selected

---

### **Step 3: Order Creation**

**Location:** `src/pages/PassPurchase.tsx` → `src/lib/orders/orderService.ts`

**Process:**
1. `handleSubmit()` function is called
2. Calls `createOrder()` function with:
   - Customer information
   - Selected passes
   - Payment method: `PaymentMethod.ONLINE`
   - Event ID (if applicable)

**Order Creation (`createOrder`):**
```typescript
// File: src/lib/orders/orderService.ts
const order = await createOrder({
  customerInfo,
  passes: selectedPassesArray,
  paymentMethod: PaymentMethod.ONLINE,
  eventId: eventId || undefined
});
```

**What Happens:**
- Order is created in database with status: `PENDING_ONLINE`
- `order_passes` entries are created for each pass type with quantity and price
- Order ID (UUID) is generated and returned
- **User information is saved at this point** (needed even if payment fails)

**Database State:**
```sql
orders table:
- id: "98c1e3ac-xxxx-xxxx-xxxx-xxxxxxxxxxxx" (UUID)
- status: "PENDING_ONLINE"
- payment_method: "online"
- source: "platform_online"
- payment_status: NULL (will be set later)
- total_price: 25.00 (calculated from passes)

order_passes table:
- order_id: "98c1e3ac-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
- pass_type: "standard"
- quantity: 1
- price: 25.00
```

---

### **Step 4: Redirect to Payment Processing Page**

**Location:** `src/pages/PassPurchase.tsx`

**Action:**
```typescript
if (paymentMethod === PaymentMethod.ONLINE) {
  navigate(`/payment-processing?orderId=${order.id}`);
}
```

**URL:** `/payment-processing?orderId=98c1e3ac-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

### **Step 5: Payment Processing Page Initialization**

**Location:** `src/pages/PaymentProcessing.tsx`

**What Happens:**
1. Component loads and extracts `orderId` from URL
2. Checks if returning from Flouci (checks for `status` parameter)
3. If NOT returning from Flouci:
   - Checks if order is already PAID (prevents duplicate payment)
   - If not paid, calls `initializePayment()`

**Code Flow:**
```typescript
useEffect(() => {
  const statusParam = searchParams.get('status');
  
  // If returning from Flouci, skip initialization
  if (statusParam === 'success' || statusParam === 'failed') {
    return; // Verification will happen in second useEffect
  }
  
  // Check order status and initialize payment
  checkOrderStatus();
}, [orderId, searchParams]);
```

---

### **Step 6: Generate Flouci Payment Link**

**Location:** `src/pages/PaymentProcessing.tsx` → `server.cjs` (API endpoint)

**Frontend Call:**
```typescript
// File: src/pages/PaymentProcessing.tsx
// CRITICAL: Only send orderId - backend calculates amount from DB
const paymentResponse = await fetch(`${apiBase}/api/flouci-generate-payment`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: orderId,
    // Amount removed - backend calculates from DB (prevents frontend manipulation)
    successLink: `${baseUrl}/payment-processing?orderId=${orderId}&status=success`,
    failLink: `${baseUrl}/payment-processing?orderId=${orderId}&status=failed`,
    webhookUrl: `${apiBase}/api/flouci-webhook`
  })
});
```

**Backend Processing (`server.cjs`):**

**Endpoint:** `POST /api/flouci-generate-payment`

**Steps:**

1. **Validates Input:**
   - Checks `orderId`, `successLink`, `failLink`, `webhookUrl` are provided
   - **Note:** `amount` is NOT accepted from frontend

2. **Fetches Order from Database:**
   ```javascript
   const { data: order } = await supabase
     .from('orders')
     .select(`
       id,
       status,
       payment_gateway_reference,
       payment_response_data,
       total_price,
       order_passes (
         id,
         pass_type,
         quantity,
         price
       )
     `)
     .eq('id', orderId)
     .single();
   ```

3. **Security Checks:**
   - If order already PAID → returns error
   - If order not `PENDING_ONLINE` → returns error
   - If payment already generated → returns existing payment link (idempotency)

4. **CRITICAL: Calculates Amount from Database:**
   ```javascript
   // Calculate from order_passes (authoritative source)
   let calculatedAmount = 0;
   if (order.order_passes && order.order_passes.length > 0) {
     calculatedAmount = order.order_passes.reduce((sum, pass) => {
       return sum + (Number(pass.price) * Number(pass.quantity));
     }, 0);
   } else {
     // Fallback to total_price (legacy orders)
     calculatedAmount = Number(order.total_price) || 0;
   }
   ```
   - **This prevents frontend manipulation of payment amount**

5. **Converts Amount:**
   - Converts TND to millimes (Flouci uses millimes: 1 TND = 1000 millimes)
   - Example: 25.00 TND → 25000 millimes

6. **Builds Payment Request:**
   ```javascript
   {
     amount: 25000, // in millimes (calculated from DB)
     success_link: "https://yoursite.com/payment-processing?orderId=xxx&status=success",
     fail_link: "https://yoursite.com/payment-processing?orderId=xxx&status=failed",
     developer_tracking_id: "98c1e3ac-xxxx-xxxx-xxxx-xxxxxxxxxxxx", // Order ID
     session_timeout_secs: 1800, // 30 minutes
     accept_card: true,
     webhook: "https://yoursite.com/api/flouci-webhook" // Optional but recommended
   }
   ```

7. **Calls Flouci API:**
   ```javascript
   POST https://developers.flouci.com/api/v2/generate_payment
   Headers:
     Authorization: Bearer {PUBLIC_KEY}:{SECRET_KEY}
     Content-Type: application/json
   ```

8. **Handles Response:**
   - If successful: Returns payment link and payment_id
   - Updates order with `payment_gateway_reference` (payment_id)
   - Stores full Flouci response in `payment_response_data`
   - Sets `payment_created_at` timestamp

**Response:**
```json
{
  "success": true,
  "payment_id": "_fEmKGWKTLCgP_a-v_uGyg",
  "link": "https://checkout.flouci.com/.../_fEmKGWKTLCgP_a-v_uGyg",
  "isDuplicate": false
}
```

---

### **Step 7: Redirect to Flouci Payment Page**

**Location:** `src/pages/PaymentProcessing.tsx`

**Action:**
```typescript
// Redirect to Flouci payment page
window.location.href = paymentData.link;
```

**User Experience:**
- User is redirected to Flouci's secure payment page
- URL: `https://checkout.flouci.com/SOCIÉTÉ_BORN_TO_LEAD_B_T_L/_fEmKGWKTLCgP_a-v_uGyg`
- User sees Flouci's payment form

---

### **Step 8: User Enters Card Information on Flouci**

**Location:** Flouci's secure payment page (external)

**User Actions:**
1. Enters card number
2. Enters expiry date
3. Enters CVV
4. Enters cardholder name
5. Clicks "Pay" button

**Important:** 
- All card information is entered on Flouci's secure page
- Our platform never sees or handles card data
- Flouci processes the payment securely

---

### **Step 9: Flouci Processes Payment**

**Location:** Flouci's servers (external)

**What Happens:**
1. Flouci validates card information
2. Processes payment with bank
3. Determines payment result:
   - **SUCCESS:** Payment approved
   - **FAILURE:** Payment declined
   - **EXPIRED:** Payment session expired
   - **PENDING:** Payment still processing

4. **Two Callbacks Happen (Parallel):**
   - **Redirect:** User is redirected back to our site
   - **Webhook:** Flouci sends notification to our server (if configured)

---

### **Step 10: User Redirected Back to Our Site**

**Location:** `src/pages/PaymentProcessing.tsx`

**Redirect URLs:**
- **Success:** `/payment-processing?orderId=xxx&status=success&payment_id=xxx`
- **Failed:** `/payment-processing?orderId=xxx&status=failed`

**What Happens:**
1. Component detects `status` parameter in URL
2. Calls `verifyPayment()` function
3. Shows "Verifying payment..." message

**Code:**
```typescript
useEffect(() => {
  const statusParam = searchParams.get('status');
  const paymentId = searchParams.get('payment_id') || searchParams.get('id');
  
  if (statusParam === 'success' || statusParam === 'failed') {
    // Always verify with Flouci API (redirect status can be unreliable)
    if (paymentId) {
      verifyPayment(paymentId);
    } else {
      verifyPaymentByOrder(); // Get payment_id from order
    }
  }
}, [searchParams, orderId]);
```

**Important:** Redirect status is NOT trusted. We always verify with Flouci API.

---

### **Step 11: Verify Payment with Flouci API**

**Location:** `src/pages/PaymentProcessing.tsx` → `server.cjs` (API endpoint)

**Frontend Call:**
```typescript
// File: src/pages/PaymentProcessing.tsx
const verifyResponse = await fetch(`${apiBase}/api/flouci-verify-payment`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    paymentId: paymentId, 
    orderId: orderId 
  })
});
```

**Backend Processing (`server.cjs`):**

**Endpoint:** `POST /api/flouci-verify-payment`

**Steps:**

1. **Calls Flouci Verification API:**
   ```javascript
   GET https://developers.flouci.com/api/v2/verify_payment/{paymentId}
   Headers:
     Authorization: Bearer {PUBLIC_KEY}:{SECRET_KEY}
   ```

2. **Gets Payment Status:**
   ```json
   {
     "success": true,
     "result": {
       "status": "SUCCESS", // or "FAILURE", "EXPIRED", "PENDING"
       "amount": 25000,
       "transaction_id": "..."
     }
   }
   ```

3. **IDEMPOTENCY: Checks if Order Already PAID:**
   ```javascript
   // Check if order already PAID (idempotency protection)
   if (order.status === 'PAID') {
     return res.json({ 
       success: true,
       status: paymentStatus,
       orderUpdated: false,
       message: 'Order already processed'
     });
   }
   ```

4. **Updates Order ONLY if Verification Confirms SUCCESS:**
   ```javascript
   // Only mark PAID if verify_payment confirms SUCCESS (see Final Rulebook)
   if (paymentStatus === 'SUCCESS') {
     const updateData = {
       status: 'PAID',
       payment_status: 'PAID',
       payment_gateway_reference: paymentId,
       payment_response_data: data.result,
       completed_at: new Date().toISOString()
     };
     
     // Use conditional update to prevent race conditions
     await supabase
       .from('orders')
       .update(updateData)
       .eq('id', orderId)
       .eq('status', 'PENDING_ONLINE'); // Only update if still PENDING_ONLINE
   }
   ```

5. **Handles PENDING Status:**
   - Returns PENDING status to frontend
   - Frontend will retry with exponential backoff
   - Webhook will finalize if still pending

6. **Returns Response:**
   ```json
   {
     "success": true,
     "status": "SUCCESS",
     "orderUpdated": true,
     "orderId": "98c1e3ac-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   }
   ```

---

### **Step 12: Frontend Receives Verification Result**

**Location:** `src/pages/PaymentProcessing.tsx`

**What Happens:**
1. Receives verification response
2. Checks payment status:
   - **SUCCESS:** Shows success screen
   - **FAILURE/EXPIRED:** Shows failed screen
   - **PENDING:** Retries with exponential backoff (max 5 retries)

**PENDING Retry Logic:**
```typescript
if (paymentStatus === 'PENDING') {
  // Retry with exponential backoff (max 5 retries)
  // After max retries, wait for webhook to finalize
  // Implementation details in PaymentProcessing.tsx
}
```

**Important:** Frontend does NOT trigger ticket generation. Backend webhook handles that.

---

### **Step 13: Webhook Notification (Parallel Process)**

**Location:** `server.cjs` - `/api/flouci-webhook` endpoint

**What Happens:**
- Flouci sends webhook notification to our server (if configured)
- This happens **in parallel** with the redirect flow
- Webhook triggers verification, but verification API is the authority

**Webhook Process:**

1. **Receives Webhook:**
   ```json
   {
     "payment_id": "_fEmKGWKTLCgP_a-v_uGyg",
     "status": "SUCCESS",
     "developer_tracking_id": "98c1e3ac-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   }
   ```

2. **WEBHOOK REPLAY PROTECTION:**
   ```javascript
   // If order already PAID, return success immediately
   if (order.status === 'PAID') {
     console.log('✅ Order already PAID - webhook replay protection');
     return res.status(200).json({ 
       success: true, 
       message: 'Order already processed'
     });
   }
   ```

3. **Verifies Webhook Signature** (if configured):
   - Validates HMAC signature to ensure webhook is from Flouci
   - Prevents fake webhook attacks

4. **CRITICAL: Verifies Payment with Flouci API:**
   ```javascript
   // Verify payment status with Flouci (source of truth)
   const verifyResponse = await fetch(
     `https://developers.flouci.com/api/v2/verify_payment/${payment_id}`,
     {
       headers: {
         'Authorization': `Bearer ${FLOUCI_PUBLIC_KEY}:${FLOUCI_SECRET_KEY}`
       }
     }
   );
   const verifyData = await verifyResponse.json();
   const paymentStatus = verifyData.result?.status;
   ```
   - **This is the source of truth** - webhook payload is not trusted alone

5. **Updates Order ONLY if Verification Confirms SUCCESS:**
   ```javascript
   // Only mark PAID if verify_payment confirms SUCCESS (see Final Rulebook)
   if (paymentStatus === 'SUCCESS') {
     // Double-check order is not already PAID (idempotency)
     if (order.status === 'PAID') {
       return res.status(200).json({ success: true, message: 'Order already processed' });
     }
     
     // Update order to PAID
     await supabase.from('orders').update({
       status: 'PAID',
       payment_status: 'PAID',
       payment_gateway_reference: payment_id,
       payment_response_data: verifyData.result,
       completed_at: new Date().toISOString()
     }).eq('id', orderId).eq('status', 'PENDING_ONLINE');
   }
   ```

6. **IDEMPOTENCY: Checks if Tickets Already Exist:**
   ```javascript
   // Check if tickets already exist before generating
   const { data: existingTickets } = await supabase
     .from('tickets')
     .select('id')
     .eq('order_id', orderId)
     .limit(1);
   
   if (existingTickets && existingTickets.length > 0) {
     console.log('✅ Tickets already exist (idempotency protection)');
     return res.status(200).json({ success: true });
   }
   ```

7. **Generates Tickets and Sends Email (ONLY if SUCCESS):**
   ```javascript
   if (paymentStatus === 'SUCCESS') {
     // Generate tickets and send email (fire and forget)
     process.nextTick(async () => {
       await generateTicketsAndSendEmail(orderId);
     });
   }
   ```

---

### **Step 14: Ticket Generation**

**Location:** `server.cjs` - `generateTicketsAndSendEmail()` function

**Process:**

1. **Fetches Order Data:**
   - Gets order with passes and event information
   - Validates order status is `PAID` (security check)

2. **IDEMPOTENCY: Checks if Tickets Already Exist:**
   ```javascript
   const { data: existingTickets } = await dbClient
     .from('tickets')
     .select('id')
     .eq('order_id', orderId)
     .limit(1);
   
   if (existingTickets && existingTickets.length > 0) {
     return { success: true, message: 'Tickets already generated' };
   }
   ```

3. **Generates QR Codes:**
   - Creates one ticket per pass quantity
   - Generates unique secure token for each ticket
   - Creates QR code image from token
   - Uploads QR code to Supabase Storage

4. **Creates Ticket Records:**
   - Inserts tickets into `tickets` table
   - Links tickets to order via `order_id`
   - Sets status to `GENERATED`

5. **Sends Email:**
   - Composes email with all QR codes
   - Includes order ID, event details, pass information
   - Sends to customer's email address
   - Uses SMTP (TLS port 587)

6. **Sends SMS:**
   - Simple confirmation message
   - Includes order ID (first 8 characters, e.g., `98C1E3AC`)
   - Includes total amount
   - **NO URLs, NO QR codes** (as per security requirements)
   - Message: "Paiement confirmé ✅ Commande: 98C1E3AC Montant: 25 DT Andiamo Events"

7. **Updates Tickets:**
   - Sets ticket status to `DELIVERED`
   - Logs email delivery status

---

### **Step 15: User Sees Success Screen**

**Location:** `src/pages/PaymentProcessing.tsx` → `src/components/payment/PaymentSuccess.tsx`

**What User Sees:**
- Success message: "Payment Successful"
- Confirmation: "Your payment has been confirmed. You will receive your tickets via email shortly."
- Order ID displayed
- Option to go back to events

---

## 🔧 Key Components

### **Frontend Components:**

1. **`src/pages/PassPurchase.tsx`**
   - Order form and pass selection
   - Creates order and redirects to payment processing

2. **`src/pages/PaymentProcessing.tsx`**
   - Handles payment initialization
   - Manages redirect to Flouci
   - Verifies payment after redirect
   - Shows loading/success/failed states
   - Implements exponential backoff for PENDING status

3. **`src/components/payment/PaymentSuccess.tsx`**
   - Success screen after payment

4. **`src/lib/orders/orderService.ts`**
   - Order creation logic
   - Order status management

### **Backend Endpoints:**

1. **`POST /api/flouci-generate-payment`** (`server.cjs` ~line 2321)
   - Generates Flouci payment link
   - **Fetches order from DB and calculates amount** (security)
   - Returns payment URL for redirect
   - Implements idempotency (one payment per order)

2. **`POST /api/flouci-verify-payment`** (`server.cjs` ~line 2765)
   - Verifies payment status with Flouci API
   - **Source of truth for payment status**
   - Updates order to PAID if verification confirms SUCCESS
   - Implements idempotency checks

3. **`POST /api/flouci-webhook`** (`server.cjs` ~line 3059)
   - Receives webhook notifications from Flouci
   - **Verifies webhook signature** (if configured)
   - **Verifies payment with Flouci API** (source of truth)
   - Updates order and generates tickets
   - Implements webhook replay protection

4. **`POST /api/generate-tickets-for-order`** (`server.cjs` ~line 5907)
   - **⚠️ ADMIN-ONLY ENDPOINT** (requires admin authentication)
   - Generates QR code tickets (manual trigger for edge cases)
   - **Security Requirements:**
     - ✅ Admin authentication required
     - ✅ Admin role check enforced
     - ✅ Re-verifies order status inside endpoint
     - ✅ Never callable by public frontend
     - ✅ Idempotency checks (prevents duplicate generation)
   - **Use Case:** Manual ticket regeneration if automatic generation fails
   - Sends email with QR codes
   - Sends SMS with order ID

### **Helper Functions:**

1. **`generateTicketsAndSendEmail(orderId)`** (`server.cjs` ~line 4972)
   - Main function for ticket generation
   - Handles QR code creation, email, and SMS sending
   - Implements idempotency checks

---

## 📊 Payment States & Status Flow

### **Order Status Flow:**

```
PENDING_ONLINE
   ↓ generate payment
PENDING_ONLINE (payment exists but not paid)
   ↓ verify_payment SUCCESS
PAID
   ↓ tickets + email + sms
(Business completed - PAID status means order is fulfilled)
```

**Failures:**
```
PENDING_ONLINE
   ↓ FAILURE / EXPIRED
PENDING_ONLINE (status unchanged, payment_status = FAILED)
   ↓ (allows retry)
```

**PENDING Handling:**
```
PENDING_ONLINE
   ↓ verify_payment PENDING
PENDING_ONLINE (status unchanged)
   ↓ retry (exponential backoff, max 5)
   ↓ webhook finalizes
PAID (if webhook confirms SUCCESS)
```

### **Order Status vs Payment Status:**

**Important Distinction:**

- **`status`** = Business lifecycle state
  - `PENDING_ONLINE`: Order created, awaiting payment
  - `PAID`: Payment confirmed, order fulfilled (business completed)
  - `CANCELLED`: Order cancelled
  - `FAILED`: Order failed (rare, usually stays PENDING_ONLINE)

- **`payment_status`** = Last payment attempt result
  - `PENDING_PAYMENT`: Payment not yet initiated
  - `PAID`: Last payment attempt succeeded
  - `FAILED`: Last payment attempt failed (allows retry)
  - `REFUNDED`: Payment was refunded

**Key Points:**
- `status` controls business flow (can order proceed?)
- `payment_status` tracks payment attempts (can user retry?)
- When payment fails, `status` stays `PENDING_ONLINE` (allows retry)
- When payment succeeds, `status` becomes `PAID` (business completed)
- `PAID` status means the order is fulfilled - no separate "COMPLETED" status needed

### **Flouci Payment Status:**

- `SUCCESS`: Payment approved and completed
- `FAILURE`: Payment declined or failed
- `EXPIRED`: Payment session expired (30 minutes)
- `PENDING`: Payment still processing

### **Status Transition Rules:**

| Flouci Status | Order Status | Notes |
|--------------|--------------|-------|
| SUCCESS | PAID | Only if `verify_payment()` confirms |
| FAILURE | PENDING_ONLINE | Status unchanged, `payment_status = FAILED` (allows retry) |
| EXPIRED | PENDING_ONLINE | Status unchanged, `payment_status = FAILED` (allows retry) |
| PENDING | PENDING_ONLINE | Status unchanged, retry or wait for webhook |

**Important:** Order is NEVER auto-cancelled on PENDING. Webhook or retry will finalize.

---

## 🛡️ Idempotency & Replay Protection

### **1. Payment Generation Idempotency:**
- Unique constraint on `payment_gateway_reference` (where not null)
- If payment already generated, returns existing payment link
- Prevents duplicate payment creation

### **2. Order Update Idempotency:**
- Conditional update: only updates if status is `PENDING_ONLINE`
- Checks if order already PAID before updating
- Prevents race conditions

### **3. Webhook Replay Protection:**
- Checks if order already PAID before processing
- Returns 200 immediately if already processed
- Prevents duplicate ticket generation

### **4. Ticket Generation Idempotency:**
- Checks if tickets already exist before generating
- Returns early if tickets found
- Prevents duplicate ticket creation

### **5. Database Constraints:**
- Unique index on `payment_gateway_reference` (partial, where not null)
- Application-level checks for ticket generation
- Transaction safety for order updates

---

## ⚠️ Error Handling

### **Common Errors and Solutions:**

1. **"Order not found"**
   - **Cause:** Invalid orderId or order doesn't exist
   - **Solution:** Verify orderId is correct, check database

2. **"Order already paid"**
   - **Cause:** User trying to pay for already paid order
   - **Solution:** System prevents duplicate payment automatically

3. **"Order is not ready for payment"**
   - **Cause:** Order status is not `PENDING_ONLINE`
   - **Solution:** Check order status, only `PENDING_ONLINE` orders can proceed

4. **"Invalid order amount"**
   - **Cause:** Order has no valid passes or amount is 0
   - **Solution:** Check order_passes table, verify passes exist

5. **"Payment gateway timeout"**
   - **Cause:** Flouci API didn't respond within 30 seconds
   - **Solution:** Check internet connection, retry payment

6. **"Payment verification failed"**
   - **Cause:** Flouci API returned error or invalid response
   - **Solution:** Check Flouci API status, verify API keys

7. **"Payment pending"**
   - **Cause:** Payment still processing
   - **Solution:** System retries automatically (exponential backoff), webhook will finalize

### **Error Recovery:**

- **Timeout Errors:** User can retry payment
- **Network Errors:** User can retry payment
- **Payment Failures:** User can retry with different card (order stays PENDING_ONLINE)
- **Verification Errors:** System retries automatically (for PENDING status)
- **PENDING Status:** Frontend retries with exponential backoff, webhook finalizes

---

## 🔒 Security Features

### **1. Amount Security (CRITICAL):**
- ✅ Backend fetches order from DB
- ✅ Backend calculates amount from `order_passes` table
- ✅ Frontend never sends amount
- ✅ Prevents frontend manipulation

### **2. API Key Protection:**
- ✅ Flouci secret key is **never exposed** to frontend
- ✅ All Flouci API calls go through backend endpoints
- ✅ Keys stored in environment variables (`.env`)

### **3. Webhook Signature Verification:**
- ✅ **Optional:** If Flouci provides signature headers, we verify them using HMAC-SHA256
- ✅ Uses constant-time comparison (prevents timing attacks)
- ⚠️ **Important:** Flouci documentation does NOT clearly define signature headers
- ✅ **Primary Security:** We rely on:
  - Verifying payment via Flouci API (source of truth)
  - Matching `developer_tracking_id` (order ID)
  - Webhook signature verification is an additional layer if available

### **4. Payment Verification (Source of Truth):**
- ✅ Payment status is **always verified** with Flouci API
- ✅ Redirect status is NOT trusted (can be unreliable)
- ✅ Webhook payload is NOT trusted alone
- ✅ **See [The Final Rulebook](#the-final-rulebook) for complete payment authority rules.**

### **5. Order Status Validation:**
- ✅ Tickets only generated for `PAID` orders
- ✅ Order marked PAID only after verification confirms SUCCESS
- ✅ Prevents unauthorized ticket generation
- ✅ Security checks at multiple levels

### **6. Duplicate Payment Prevention:**
- ✅ Unique constraint on `payment_gateway_reference`
- ✅ Checks if order already has payment_id
- ✅ Prevents creating multiple payments for same order
- ✅ Returns existing payment link if already generated

### **7. Idempotency Protection:**
- ✅ One active payment per order
- ✅ One ticket generation per order
- ✅ One email per order
- ✅ Webhook replay protection

### **8. Timeout Protection:**
- ✅ 30-second timeout on all Flouci API calls
- ✅ 45-second timeout on frontend requests
- ✅ Prevents hanging requests
- ✅ Graceful error handling

### **9. Data Security:**
- ✅ No card data stored (all on Flouci's secure page)
- ✅ No payment secrets in frontend
- ✅ No sensitive data in SMS (only order ID and amount)
- ✅ SMTP credentials only in backend `.env`

---

## 🔄 Complete Flow Diagram

```
User clicks "Book Now"
    ↓
Fill order form (PassPurchase.tsx)
    ↓
Create order (orderService.ts)
    Status: PENDING_ONLINE
    User info saved (full_name, email, phone, city, ville)
    ↓
Redirect to /payment-processing?orderId=xxx
    ↓
Initialize payment (PaymentProcessing.tsx)
    ↓
Call /api/flouci-generate-payment
    ↓
Backend fetches order from DB
    ↓
Backend calculates amount from order_passes (security)
    ↓
Backend calls Flouci API
    ↓
Get payment link from Flouci
    ↓
Update order with payment_gateway_reference
    ↓
Redirect user to Flouci payment page
    ↓
User enters card info on Flouci
    ↓
Flouci processes payment
    ↓
┌─────────────────────────────────┐
│  TWO PARALLEL PATHS:            │
│                                  │
│  1. Redirect (User)             │
│  2. Webhook (Server)            │
└─────────────────────────────────┘
    ↓                    ↓
User redirected    Webhook received
back to site       (server.cjs)
    ↓                    ↓
Verify payment     Verify webhook signature
(PaymentProcessing) (if configured)
    ↓                    ↓
Call verify API     Verify payment with API
(server.cjs)       (source of truth)
    ↓                    ↓
Check if PAID      Check if already PAID
(idempotency)      (replay protection)
    ↓                    ↓
Update order        Update order to PAID
(if SUCCESS)       (if verify confirms SUCCESS)
    ↓                    ↓
Show success        Check tickets exist
screen              (idempotency)
    ↓                    ↓
                    Generate tickets
                    (if not exist)
                    ↓
                    Send email + SMS
                    ↓
    └────────┬───────────┘
             ↓
    Payment Complete!
```

---

## 📝 Important Notes

### **1. Amount Calculation:**
- **Frontend:** Does NOT send amount
- **Backend:** Fetches order from DB, calculates from `order_passes`
- **Formula:** `sum(pass.price * pass.quantity)` from database
- **Security:** Prevents frontend manipulation

### **2. Payment ID Format:**
- Flouci payment ID: `_fEmKGWKTLCgP_a-v_uGyg`
- Stored in: `orders.payment_gateway_reference`
- Used for verification
- Unique constraint prevents duplicates

### **3. Order ID Format:**
- UUID format: `98c1e3ac-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Displayed as first 8 characters: `98C1E3AC`
- Used in email and SMS
- Used as `developer_tracking_id` in Flouci

### **4. Amount Conversion:**
- Database stores: `25.00` (TND)
- Backend converts: `25000` (millimes)
- Flouci uses millimes (1 TND = 1000 millimes)

### **5. Redirect URLs:**
- Must be absolute URLs (start with `http://` or `https://`)
- Include `orderId` and `status` parameters
- Used by Flouci to redirect user back

### **6. Webhook URL:**
- Optional but recommended
- Must be publicly accessible (not localhost)
- Flouci sends payment status updates here
- Webhook signature verification recommended

### **7. Session Timeout:**
- Default: 30 minutes (1800 seconds)
- User must complete payment within this time
- After timeout, payment expires

### **8. PENDING Handling:**
- Frontend retries with exponential backoff (max 5 retries)
- After max retries, waits for webhook
- Webhook will finalize PENDING payments
- Prevents infinite retry loops

### **9. Source of Truth:**
- **Flouci Verification API** is the source of truth
- Webhook is a trigger, not authority
- Redirect status is NOT trusted
- Order marked PAID only if `verify_payment().status === 'SUCCESS'`

---

## 🧪 Testing the Flow

### **Test Card (Flouci Test Mode):**
- Use Flouci's test card numbers for testing
- Payments will be processed in test mode
- No real money is charged

### **Check Points:**
1. ✅ Order created with `PENDING_ONLINE` status
2. ✅ Payment link generated successfully (amount from DB)
3. ✅ Redirect to Flouci works
4. ✅ Payment verification works (source of truth)
5. ✅ Order updated to `PAID` status (only after verification)
6. ✅ Tickets generated (only after PAID confirmed)
7. ✅ Email sent with QR codes
8. ✅ SMS sent with order ID (no URLs)
9. ✅ Idempotency works (duplicate requests handled)
10. ✅ Webhook replay protection works

---

## 🐛 Troubleshooting

### **Payment Not Processing:**
1. Check server logs for errors
2. Verify Flouci API keys are set
3. Check network connectivity
4. Verify order exists in database
5. Check order status is `PENDING_ONLINE`

### **Payment Shows as Failed but Card is Valid:**
- System verifies with Flouci API (source of truth)
- Even if redirect says "failed", we check actual status
- Payment will be marked as SUCCESS if Flouci confirms it

### **Tickets Not Generated:**
1. Check order status is `PAID` (must be confirmed by verification)
2. Check server logs for ticket generation errors
3. Verify email service is configured
4. Check Supabase storage bucket exists
5. Check if tickets already exist (idempotency)

### **SMS Not Sent:**
1. Check `WINSMS_API_KEY` is set
2. Verify phone number format is correct
3. Check SMS service logs
4. SMS is sent with simple order ID confirmation (no URLs)

### **Duplicate Payment Attempts:**
- System prevents duplicates via unique constraint
- Returns existing payment link if already generated
- Idempotency protection at multiple levels

---

## 📚 Related Files

### **Frontend:**
- `src/pages/PassPurchase.tsx` - Order form
- `src/pages/PaymentProcessing.tsx` - Payment processing page
- `src/components/payment/PaymentSuccess.tsx` - Success screen
- `src/lib/orders/orderService.ts` - Order service

### **Backend:**
- `server.cjs` - Main server file with all API endpoints
  - `/api/flouci-generate-payment` (line ~2321)
  - `/api/flouci-verify-payment` (line ~2765)
  - `/api/flouci-webhook` (line ~3059)
  - `/api/generate-tickets-for-order` (line ~5907)
  - `generateTicketsAndSendEmail()` function (line ~4972)

### **Database:**
- `supabase/migrations/20250222000000-add-payment-idempotency-constraints.sql` - Unique constraints

---

## ✅ Summary

The Flouci payment flow is a **secure, production-ready payment system** that:

1. ✅ **Backend calculates amount** from database (prevents manipulation)
2. ✅ **Verification API is source of truth** (see [Final Rulebook](#the-final-rulebook))
3. ✅ **Idempotency protection** at all levels
4. ✅ **Webhook replay protection** (prevents duplicate processing)
5. ✅ **PENDING handling** with exponential backoff
6. ✅ **Never handles card data** (all on Flouci's secure page)
7. ✅ **Generates tickets only after verified payment**
8. ✅ **Sends email with QR codes** (only after PAID confirmed)
9. ✅ **Sends SMS with simple confirmation** (no URLs, no QR codes)
10. ✅ **Comprehensive error handling** and recovery
11. ✅ **Security at every level** (API keys, optional signatures, verification)
12. ✅ **Database constraints** for data integrity
13. ✅ **Clear status separation** (`status` = business lifecycle, `payment_status` = payment attempt result)

The system is designed to be **reliable, secure, and follows payment best practices**.

**Remember:** Always refer to [The Final Rulebook](#the-final-rulebook) for the non-negotiable rules.

---

**Last Updated:** Based on implementation as of 2025-02-22
**Version:** 2.0 (Refactored with security improvements)
