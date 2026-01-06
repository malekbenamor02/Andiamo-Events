# How Duplicate Payment Detection Works

This document explains how the system detects different order states to prevent duplicate payments.

## Database Fields Used

The system checks these fields in the `orders` table:

1. **`status`** - Order status (e.g., 'PAID', 'PENDING_ONLINE', 'CANCELLED')
2. **`payment_gateway_reference`** - Stores the Flouci payment_id
3. **`payment_response_data`** - JSONB field storing the full Flouci API response (includes payment link)

## Detection Logic Flow

### Step 1: Query Order from Database

```javascript
const { data: existingOrder, error: fetchError } = await supabase
  .from('orders')
  .select('payment_gateway_reference, payment_response_data, status')
  .eq('id', orderId)
  .single();
```

**What this does:**
- Fetches the order by `orderId`
- Gets only the fields we need: `payment_gateway_reference`, `payment_response_data`, `status`
- Uses `.single()` to get one record (or null if not found)

---

## Scenario 1: Order Already Paid ✅

### How It's Detected:

```javascript
if (existingOrder.status === 'PAID') {
  console.log('⚠️ Order already paid, returning existing payment info');
  return res.status(400).json({ 
    error: 'Order already paid',
    message: 'This order has already been paid',
    alreadyPaid: true
  });
}
```

### What Happens:
- **Check:** `existingOrder.status === 'PAID'`
- **Action:** Returns error immediately, prevents new payment generation
- **Response:** `400 Bad Request` with `alreadyPaid: true` flag

### Example:
```json
// Database record:
{
  "id": "abc-123",
  "status": "PAID",  // ← This triggers the check
  "payment_gateway_reference": "tYEgtlhbTOC-s-A-WlhJYg",
  "payment_response_data": { "result": { "link": "https://..." } }
}

// Result: Payment generation blocked, user sees "Order already paid"
```

---

## Scenario 2: Payment Already Generated (Has payment_id) ✅

### How It's Detected:

```javascript
if (existingOrder.payment_gateway_reference) {
  console.log('⚠️ Payment already generated for this order:', existingOrder.payment_gateway_reference);
  
  // Try to get the payment link from stored response data
  let paymentLink = null;
  if (existingOrder.payment_response_data?.result?.link) {
    paymentLink = existingOrder.payment_response_data.result.link;
  } else if (existingOrder.payment_response_data?.link) {
    paymentLink = existingOrder.payment_response_data.link;
  }

  // If we have the link, return it (don't create duplicate payment)
  if (paymentLink) {
    console.log('✅ Returning existing payment link (duplicate submission prevented)');
    return res.json({ 
      success: true,
      payment_id: existingOrder.payment_gateway_reference,
      link: paymentLink,
      isDuplicate: true,
      message: 'Payment already generated for this order'
    });
  }
}
```

### What Happens:
1. **Check:** `existingOrder.payment_gateway_reference` exists (not null/empty)
2. **Extract Link:** Tries to get payment link from `payment_response_data`
   - First tries: `payment_response_data.result.link` (new format)
   - Falls back to: `payment_response_data.link` (old format)
3. **Action:** If link exists, returns existing payment link (no new payment created)
4. **Response:** `200 OK` with `isDuplicate: true` flag

### Example:
```json
// Database record:
{
  "id": "abc-123",
  "status": "PENDING_ONLINE",
  "payment_gateway_reference": "tYEgtlhbTOC-s-A-WlhJYg",  // ← Payment ID exists
  "payment_response_data": {
    "result": {
      "link": "https://checkout.flouci.com/...",  // ← Link stored here
      "payment_id": "tYEgtlhbTOC-s-A-WlhJYg"
    }
  }
}

// Result: Returns existing payment link, user redirected to same Flouci checkout
```

---

## Scenario 3: Payment ID Exists But Link Missing ⚠️

### How It's Detected:

```javascript
if (existingOrder.payment_gateway_reference) {
  // ... try to get link ...
  
  if (paymentLink) {
    // Return existing link
  } else {
    // Payment ID exists but no link stored - might be from old format
    // Generate new payment but log the duplicate attempt
    console.log('⚠️ Payment ID exists but no link found, generating new payment');
  }
}
```

### What Happens:
- **Check:** `payment_gateway_reference` exists BUT `paymentLink` is null
- **Action:** Logs warning, but continues to generate new payment
- **Why:** Handles edge cases where payment_id was stored but link wasn't (old data format)

### Example:
```json
// Database record:
{
  "id": "abc-123",
  "status": "PENDING_ONLINE",
  "payment_gateway_reference": "tYEgtlhbTOC-s-A-WlhJYg",  // ← Payment ID exists
  "payment_response_data": null  // ← But no link stored!
}

// Result: New payment generated, old payment_id might be overwritten
```

---

## Scenario 4: Order Not Found ❌

### How It's Detected:

```javascript
const { data: existingOrder, error: fetchError } = await supabase
  .from('orders')
  .select('...')
  .eq('id', orderId)
  .single();

if (fetchError && fetchError.code !== 'PGRST116') {
  console.error('❌ Error fetching order:', fetchError);
  // Continue anyway - don't block payment generation
} else if (existingOrder) {
  // Order found - check status/payment_id
} else {
  // Order not found (fetchError.code === 'PGRST116' means "not found")
  // Code continues to generate payment anyway
}
```

### What Happens:
- **Check:** `fetchError.code === 'PGRST116'` means "no rows returned" (order not found)
- **Action:** Logs error but continues (doesn't block payment generation)
- **Why:** Allows payment generation even if order lookup fails (graceful degradation)

### Example:
```javascript
// Order ID doesn't exist in database
// fetchError = { code: 'PGRST116', message: 'No rows returned' }

// Result: Payment generation continues (order might be created elsewhere)
```

---

## Frontend Detection (PaymentProcessing.tsx)

The frontend also checks order status before generating payment:

```typescript
// Fetch order details
const order = await getOrderById(orderId!);
if (!order) {
  setStatus('error');
  setErrorMessage('Order not found');
  return;
}

// Check if order is already paid
if (order.status === OrderStatus.PAID) {
  setStatus('success');
  return;
}

// Check if order is cancelled
if (order.status === OrderStatus.CANCELLED) {
  setStatus('failed');
  setErrorMessage('This order has been cancelled');
  return;
}
```

**Frontend checks:**
1. ✅ Order exists
2. ✅ Order not already paid
3. ✅ Order not cancelled

**Then:** Calls backend API to generate payment (backend does duplicate check)

---

## Complete Flow Diagram

```
User clicks "Pay Now"
    ↓
Frontend: Check order status
    ├─ Order not found → Show error
    ├─ Order already PAID → Show success
    ├─ Order CANCELLED → Show error
    └─ Order PENDING_ONLINE → Continue
         ↓
Backend: Check for duplicate payment
    ├─ Order status = 'PAID' → Return error (already paid)
    ├─ payment_gateway_reference exists + link exists → Return existing link
    ├─ payment_gateway_reference exists + no link → Generate new payment (warning)
    └─ No payment_gateway_reference → Generate new payment
         ↓
Generate Flouci Payment
    ↓
Store payment_id and link in database
    ↓
Return payment link to frontend
    ↓
Redirect user to Flouci checkout
```

---

## Database Schema Reference

### Orders Table Fields:

| Field | Type | Description | Used For Detection |
|-------|------|-------------|-------------------|
| `id` | UUID | Order ID | Lookup order |
| `status` | TEXT | Order status | Check if PAID |
| `payment_gateway_reference` | TEXT | Flouci payment_id | Check if payment exists |
| `payment_response_data` | JSONB | Full Flouci response | Extract payment link |

### Status Values:

- `'PAID'` - Order is paid (blocks new payment)
- `'PENDING_ONLINE'` - Payment pending (allows payment generation)
- `'CANCELLED'` - Order cancelled (blocks payment)
- `'PENDING_CASH'` - Ambassador cash payment (not applicable here)
- `'REDIRECTED'` - External app payment (not applicable here)

---

## Testing Each Scenario

### Test 1: Already Paid
```sql
UPDATE orders SET status = 'PAID' WHERE id = 'your-order-id';
```
**Expected:** Payment generation blocked, returns "Order already paid"

### Test 2: Duplicate Payment
```sql
UPDATE orders 
SET payment_gateway_reference = 'test-payment-id',
    payment_response_data = '{"result": {"link": "https://checkout.flouci.com/test"}}'
WHERE id = 'your-order-id';
```
**Expected:** Returns existing payment link, no new payment created

### Test 3: Payment ID but No Link
```sql
UPDATE orders 
SET payment_gateway_reference = 'test-payment-id',
    payment_response_data = NULL
WHERE id = 'your-order-id';
```
**Expected:** Warning logged, new payment generated

### Test 4: Order Not Found
```sql
-- Use a non-existent order ID
```
**Expected:** Error logged, payment generation continues (or fails gracefully)

---

## Summary

The system uses **database queries** to check order state before generating payments:

1. **Order Paid?** → Check `status === 'PAID'`
2. **Payment Exists?** → Check `payment_gateway_reference` exists
3. **Link Available?** → Extract from `payment_response_data`
4. **Order Found?** → Check if query returned a row

This prevents duplicate payments while handling edge cases gracefully.

