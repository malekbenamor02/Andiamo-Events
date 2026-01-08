# 🔒 Server-Side Validation Solution - Never Trust the Frontend

## The Problem

**Frontend validation CANNOT be trusted** - it runs in the browser and can be bypassed via:
- Browser console manipulation
- Network request interception
- React DevTools state modification
- Direct function calls

## The Solution: Server-Side API Endpoint

**Rule:** Frontend NEVER directly accesses database. All validation happens server-side.

---

## Architecture: Server-Side Order Creation

### Current (Vulnerable) Flow:
```
Frontend → Supabase Client → Database ❌
(No validation, can be bypassed)
```

### Secure Flow:
```
Frontend → API Endpoint → Server Validation → Database ✅
(All validation server-side, cannot be bypassed)
```

---

## Implementation: Secure Server-Side Endpoint

### 1. Create Server-Side API Endpoint
**File:** `server.cjs`
**Endpoint:** `POST /api/create-order`

**Key Principles:**
1. ✅ **All validation server-side** - Frontend only sends request
2. ✅ **Fetch pass data from database** - Never trust client prices/names
3. ✅ **Calculate totals server-side** - Never trust client totals
4. ✅ **Validate pass IDs** - Must exist in database
5. ✅ **Check ambassador access** - Block ambassadors from creating
6. ✅ **Rate limiting** - Prevent abuse
7. ✅ **Input sanitization** - Clean all inputs

### 2. Frontend Changes
**File:** `src/lib/orders/orderService.ts`

**Change:**
- Remove direct Supabase calls
- Call API endpoint instead
- Send minimal data (passIds, quantities only)
- Server calculates everything else

---

## Security Benefits

### ✅ What Server-Side Validation Blocks:

1. **Fake Pass IDs:**
   - ❌ Client sends `passId: "test-pass-1"`
   - ✅ Server checks database - doesn't exist
   - ✅ Server rejects order

2. **Price Manipulation:**
   - ❌ Client sends `price: 10` (should be 50)
   - ✅ Server fetches price from database
   - ✅ Server uses database price (50), ignores client price

3. **Name Manipulation:**
   - ❌ Client sends `passName: "Cheap VIP"`
   - ✅ Server fetches name from database
   - ✅ Server uses database name

4. **Quantity Manipulation:**
   - ✅ Server validates quantity (must be positive integer)

5. **Total Price Manipulation:**
   - ❌ Client sends `totalPrice: 10` (should be 100)
   - ✅ Server calculates total from database prices
   - ✅ Server ignores client total

6. **Ambassador Blocking:**
   - ❌ Ambassador tries to create order
   - ✅ Server checks if user is ambassador
   - ✅ Server blocks if ambassador

---

## How It Works

### Request from Frontend:
```javascript
// Frontend sends ONLY:
{
  eventId: "event-uuid",
  passes: [
    { passId: "pass-uuid-1", quantity: 2 },  // ✅ Only ID and quantity
    { passId: "pass-uuid-2", quantity: 1 }   // ❌ NO price, NO name
  ],
  customerInfo: {
    full_name: "Customer Name",
    phone: "27123456",
    email: "customer@example.com",
    city: "Sousse",
    ville: "Test"
  },
  paymentMethod: "ambassador_cash",
  ambassadorId: "ambassador-uuid"  // Optional, for COD orders
}
```

### Server-Side Validation:
```javascript
// Server does ALL validation:
1. Fetch passes from database using passIds
2. Verify each passId exists
3. Verify each pass belongs to eventId
4. Get prices FROM DATABASE (don't trust client)
5. Get names FROM DATABASE (don't trust client)
6. Calculate total server-side
7. Validate customer info
8. Check if ambassador is trying to create (block if yes)
9. Create order with database values
```

### Response:
```javascript
{
  success: true,
  order: { /* order data */ },
  message: "Order created successfully"
}
```

---

## Why This Is Secure

### ✅ Cannot Be Bypassed:
- Validation runs on server (not in browser)
- Client cannot access server code
- Server has full database access
- Server controls what gets created

### ✅ Prevents All Attack Vectors:
- ❌ Browser console manipulation - Server validates
- ❌ Network interception - Server validates
- ❌ Direct Supabase calls - Frontend doesn't have access
- ❌ Fake pass IDs - Server checks database
- ❌ Price manipulation - Server uses database prices
- ❌ Ambassador creation - Server blocks ambassadors

---

## Implementation Steps

1. **Create API Endpoint** (`server.cjs`)
2. **Add Server-Side Validation** (all checks)
3. **Update Frontend** (call API instead of Supabase)
4. **Test** (verify attacks are blocked)

---

**Next:** I'll create the secure server-side endpoint.
