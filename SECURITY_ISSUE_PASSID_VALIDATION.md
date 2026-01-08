# 🚨 Security Issue: Missing Pass ID Validation

## Problem

**Issue:** Orders can be created with fake/manipulated `passId` values like `"test-pass-1"`

**Severity:** HIGH - Data integrity and fraud risk

---

## How It Happened

The order with `passId: "test-pass-1"` was created because:

1. **No Server-Side Validation:**
   - `orderService.createOrder()` accepts any `passId` without validation
   - Does NOT check if `passId` exists in database
   - Does NOT verify `passId` belongs to the event
   - Does NOT verify pass price/name matches database

2. **Client-Side Only Validation:**
   - `PassPurchase.tsx` validates passes exist in `event.passes` array
   - BUT this can be bypassed by:
     - Manipulating form data before submission
     - Calling `createOrder()` directly via browser console
     - Creating orders programmatically

3. **Attack Vector:**
   ```javascript
   // Someone could run this in browser console:
   await createOrder({
     customerInfo: { full_name: "Fake", phone: "27123456", ... },
     passes: [{
       passId: "test-pass-1",  // ⚠️ FAKE ID
       passName: "VIP",
       quantity: 2,
       price: 50
     }],
     paymentMethod: PaymentMethod.AMBASSADOR_CASH,
     ambassadorId: "some-ambassador-id",
     eventId: "some-event-id"
   });
   ```

---

## Current Code Flow

### 1. PassPurchase.tsx (Client-Side)
```typescript
const getSelectedPassesArray = (): SelectedPass[] => {
  const passes: SelectedPass[] = [];
  Object.entries(selectedPasses).forEach(([passId, quantity]) => {
    const pass = event.passes?.find(p => p.id === passId);
    if (pass) {
      passes.push({
        passId: pass.id,  // ✅ Validated client-side
        passName: pass.name,
        quantity,
        price: pass.price
      });
    }
  });
  return passes;
};
```

**Problem:** This validation only happens in the UI. It can be bypassed.

### 2. orderService.ts (No Validation)
```typescript
export async function createOrder(data: CreateOrderData): Promise<Order> {
  const { customerInfo, passes, paymentMethod, ambassadorId, eventId } = data;
  
  // ⚠️ NO VALIDATION HERE
  // passes array is used directly without checking:
  // - Does passId exist?
  // - Does passId belong to eventId?
  // - Does price match database?
  
  const orderData: any = {
    notes: JSON.stringify({
      all_passes: passes.map(p => ({
        passId: p.passId,  // ⚠️ Accepted without validation
        passName: p.passName,
        quantity: p.quantity,
        price: p.price
      })),
    })
  };
  
  await supabase.from('orders').insert(orderData);
}
```

**Problem:** No server-side validation!

---

## Fix Required

Add server-side validation in `orderService.createOrder()`:

1. ✅ Verify each `passId` exists in database
2. ✅ Verify each `passId` belongs to `eventId`
3. ✅ Verify pass `price` matches database price
4. ✅ Verify pass `name` matches database name
5. ✅ Reject order if validation fails

---

**Status:** Needs server-side validation fix
