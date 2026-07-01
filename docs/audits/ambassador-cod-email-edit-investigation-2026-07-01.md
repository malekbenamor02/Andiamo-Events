# Ambassador / COD Email Edit Investigation

**Date:** 2026-07-01  
**Scope:** Ambassador / COD order customer email edit, plus adjacent editable customer/order field payload risks. Investigation only — no code changes applied.

---

## 1. Scope

This report verifies whether **Admin → Ambassador Sales** (COD / ambassador cash orders) has the same email-edit payload mismatch as **Online Orders**, or any related issue when saving customer email.

It also checks other editable fields in the COD order details dialog for similar frontend/backend contract drift.

**Out of scope:** Ambassador mobile app / ambassador portal order flows (no admin email-edit UI found there for this investigation).

---

## 2. Files Inspected

| File | Relevance |
|------|-----------|
| `src/pages/admin/components/AmbassadorSalesTab.tsx` | Ambassador Sales tab UI, order list, `onViewOrder` |
| `src/pages/admin/components/OrderDetailsDialog.tsx` | COD/Ambassador order details dialog; **inline email + admin notes edit** |
| `src/pages/admin/Dashboard.tsx` | Wires tab → dialog; order action handlers (approve/reject/remove/skip/complete); **Online Orders broken handler for comparison** |
| `src/pages/admin/adminTabRegistry.tsx` | Tab key `ambassador-sales`, label "Ambassador Sales" |
| `src/lib/api-routes.ts` | `ADMIN_UPDATE_ORDER_EMAIL`, `ADMIN_UPDATE_ORDER_NOTES`, action routes |
| `src/lib/adminOrdersApi.ts` | `rejectOrder`, `completeOrder` helpers |
| `api/misc.js` | `POST /api/admin/update-order-email`, `POST /api/admin/update-order-notes` |
| `api/_lib/admin-missing-routes-http.js` | `POST /api/admin/reject-order` |
| `api/admin-pos.js` | POS email update (reference comparison) |
| `src/components/admin/PosTab.tsx` | POS email save UI |
| `vercel.json` | Rewrites for shared email endpoint |
| `api/_lib/admin-api-authz-coverage.test.cjs` | Confirms `update-order-email` gated with `orders:manage` |
| `docs/audits/online-orders-email-edit-investigation-2026-07-01.md` | Prior Online Orders finding (comparison baseline) |

**Verification commands run:**

```text
rg "update-order-email" -n .
rg "newEmail" -n src api server.cjs
rg "editingEmailValue" -n src
rg "OrderDetailsDialog" -n src
rg "ADMIN_UPDATE_ORDER_EMAIL" -n .
rg "Valid email address is required" -n .
npm run test:admin-api-authz-coverage   # 37/37 pass
```

**No dedicated test** exists for `update-order-email` request-body field names (confirmed by grep across `*.test.*`).

---

## 3. COD/Ambassador UI Flow

### Tab / list

- **Admin tab key:** `ambassador-sales` (`shared/admin/tabDefinitions.data.json`, `adminTabRegistry.tsx`)
- **UI label:** "Ambassador Sales" / "Ventes Ambassadeurs"
- **Component:** `AmbassadorSalesTab.tsx` (`TabsContent value="ambassador-sales"`)
- **Permission:** `ambassador_sales:manage` for tab access; email edit uses separate `orders:manage` on API

### Component chain

```
Dashboard.tsx
  └─ LazyAmbassadorSalesTab (AmbassadorSalesTab.tsx)
       └─ order row click → p.onViewOrder(order)
  └─ OrderDetailsDialog (open={isOrderDetailsOpen}, order={selectedOrder})
       └─ Customer → Email → Edit → Save (inline fetch, not via Dashboard handler)
```

**Open order** (`Dashboard.tsx` ~L8755–8758):

```typescript
onViewOrder={(order) => {
  setSelectedOrder(order);
  setIsOrderDetailsOpen(true);
}}
```

**Important architectural difference vs Online Orders:**

| Flow | Email save location |
|------|---------------------|
| Online Orders | `OnlineOrderDetailsDialog` → `Dashboard.updateOnlineOrderEmail` (wrapper) |
| Ambassador/COD | `OrderDetailsDialog` — **fetch call is inline in the dialog** |

There is **no** `onUpdateEmail` prop or Dashboard email wrapper for COD orders.

### Data source

Orders loaded via `fetchAmbassadorSalesData` → `GET /api/admin/ambassador-sales/orders` (`Dashboard.tsx` ~L2414, `API_ROUTES.AMBASSADOR_SALES_ORDERS`).

Filtered to COD/ambassador cash:

```typescript
order.payment_method === 'ambassador_cash' &&
['platform_cod', 'ambassador_manual'].includes(order.source)
```

---

## 4. Frontend Email Payload

### Email edit UI state (`OrderDetailsDialog.tsx`)

| State | Purpose |
|-------|---------|
| `isEditingEmail` | Toggle view / edit mode |
| `editingEmailValue` | Controlled input value |
| `updatingEmail` | Disable controls during save |

Edit initialized from `order.user_email || order.email || ""` (~L926).

### Frontend validation (before API call)

1. Empty trimmed value → toast `"Email cannot be empty"` (~L831–837)
2. Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` fail → toast `"Invalid email format"` (~L840–847)

### Save handler

Inline `fetch` in `OrderDetailsDialog.tsx` (~L859–868):

```typescript
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include',
  body: JSON.stringify({
    orderId: order.id,
    newEmail: editingEmailValue.trim()
  }),
});
```

### Exact JSON body sent (Ambassador/COD)

```json
{
  "orderId": "<order-uuid>",
  "newEmail": "customer@example.com"
}
```

### Toast / error handling

- **Success:** `"Email updated successfully"` (~L877–883)
- **API error:** `throw new Error(data.error || data.details || 'Failed to update email')` → destructive toast with `error.message` (~L890–896)
- **Local state:** `onOrderUpdate({ user_email: editingEmailValue.trim() })` (~L886)

If the Online Orders bug occurred here, the toast would show `"Valid email address is required"` from the API — but COD sends `newEmail`, so that specific error should not occur for a valid email payload.

---

## 5. Backend/API Contract

### Shared email endpoint (same as Online Orders)

| Property | Value |
|----------|-------|
| **Route** | `POST /api/admin/update-order-email` |
| **Handler** | `api/misc.js` ~L4076–4178 |
| **Rewrite** | `vercel.json` → `api/misc.js` |
| **Permission** | `gateAdminPermission(req, res, 'orders:manage')` |

### Expected request fields

```javascript
const { orderId, newEmail } = bodyData;
```

| Field | Required | Validation |
|-------|----------|------------|
| `orderId` | Yes | 400 `Order ID is required` if missing |
| `newEmail` | Yes | Must be non-empty string; 400 **`Valid email address is required`** if missing/wrong type |
| | | Regex; 400 `Invalid email format` if fail |

**No fallback** for `email`, `user_email`, or other aliases.

### Database update

```javascript
await dbClient.from('orders').update({
  user_email: trimmedNewEmail,
  updated_at: new Date().toISOString()
}).eq('id', orderId)
```

- **Column:** `orders.user_email` (same as Online Orders path when working)
- **Audit:** `order_logs` insert, action `admin_update_email` (~L4147–4158)

### Admin notes endpoint (second editable field in same dialog)

| Property | Value |
|----------|-------|
| **Route** | `POST /api/admin/update-order-notes` |
| **Frontend sends** | `{ orderId, adminNotes }` (~L979–982) |
| **Backend expects** | `{ orderId, adminNotes }` (~L4189) |
| **DB column** | `orders.admin_notes` |

---

## 6. Contract Match / Mismatch Result

| Flow | Component | Endpoint | Frontend Payload | Backend Expected Field | Result |
|------|-----------|----------|------------------|------------------------|--------|
| Online Orders | `OnlineOrderDetailsDialog` → `Dashboard.updateOnlineOrderEmail` | `POST /api/admin/update-order-email` | `{ orderId, **email** }` | `newEmail` | **Broken** |
| Ambassador/COD | `OrderDetailsDialog` (inline Save) | `POST /api/admin/update-order-email` | `{ orderId, **newEmail** }` | `newEmail` | **Pass (contract matches)** |
| POS | `PosTab.onSaveOrderEmail` | `PATCH /api/admin/pos-orders/:id` | `{ **user_email** }` | `user_email` | **Pass (reference — different endpoint)** |

### Ambassador/COD status assessment

**Does not have the Online Orders payload mismatch.**

Evidence:

1. Only three references to `ADMIN_UPDATE_ORDER_EMAIL` exist in application code:
   - `OrderDetailsDialog.tsx` → sends `newEmail` ✓
   - `Dashboard.tsx` `updateOnlineOrderEmail` → sends `email` ✗ (Online Orders only)
   - `api-routes.ts` (constant definition)

2. Grep for `newEmail` in `src/` shows it only in `OrderDetailsDialog.tsx` (email save) plus unrelated marketing import logic in `Dashboard.tsx`.

3. Grep for `JSON.stringify({ orderId, email` in order context finds **only** `Dashboard.tsx` Online Orders handler (~L3065).

**Runtime status:** Not manually exercised in this investigation. Based on static code review, Ambassador/COD email edit is **untested here but likely correct** — frontend and backend contracts align.

---

## 7. Other COD Editable Fields Risk Check

### Customer section (`OrderDetailsDialog.tsx` ~L808–941)

| Field | Editable in UI? | Frontend handler | Endpoint | Frontend payload field | Backend expected field | Mismatch risk? |
|-------|-----------------|------------------|----------|------------------------|------------------------|----------------|
| **Name** (`user_name`) | No — read-only `<span>` | — | — | — | — | **None** |
| **Phone** (`user_phone`) | No — read-only | — | — | — | — | **None** |
| **Email** (`user_email`) | Yes | Inline Save in dialog | `POST /api/admin/update-order-email` | `newEmail` | `newEmail` | **None** |
| **City / ville** | No — read-only | — | — | — | — | **None** |

### Admin notes section (~L944–1059)

| Field | Editable? | Frontend payload | Backend field | Mismatch? |
|-------|-----------|------------------|---------------|-----------|
| **admin_notes** | Yes | `adminNotes` | `adminNotes` | **None** |

### Order actions (status / COD workflow — not inline field edit)

Handled via `Dashboard.tsx` callbacks passed to `OrderDetailsDialog`:

| Action | Frontend handler | Endpoint | Payload | Backend expects | Mismatch? |
|--------|------------------|----------|---------|-----------------|-----------|
| Approve | `handleApproveOrderAsAdmin` | `POST /api/admin-approve-order` | `{ orderId }` | `orderId` | **None** (verified handler pattern) |
| Reject | `handleRejectCodAmbassadorOrder` → `adminOrdersApi.rejectOrder` | `POST /api/admin/reject-order` | `{ orderId, reason }` | `{ orderId, reason }` | **None** |
| Remove | `handleRemoveOrder` | `POST /api/admin-remove-order` | `{ orderId }` | `orderId` | **None** |
| Skip ambassador confirm | `handleSkipAmbassadorConfirmation` | `POST /api/admin-skip-ambassador-confirmation` | `{ orderId, reason? }` | `orderId`, `reason` | **None** |
| Complete | `handleCompleteOrderAsAdmin` → `adminOrdersApi.completeOrder` | `PATCH /api/admin/orders/:id/complete` | (order id in URL) | id in path | **None** |
| Resend completion email | `handleResendCompletionEmail` in dialog | `POST /api/resend-order-completion-email` | `{ orderId }` | `orderId` | **None** |
| Resend ticket email | `handleResendTicketEmail` in Dashboard | `POST /api/admin-resend-ticket-email` | `{ orderId }` | `orderId` | **None** |

**Payment status:** Not editable in `OrderDetailsDialog`. Online Orders payment status is edited separately in `OnlineOrderDetailsDialog` via `adminOrdersApi.updatePaymentStatus` — out of COD dialog scope.

### Minor UX note (not a contract bug)

After COD email save, `OrderDetailsDialog` calls `onOrderUpdate({ user_email })` but **does not** call `onRefresh()` to reload the ambassador sales list. The open dialog shows the new email; the table row may stay stale until manual refresh. This is a list-sync UX gap, not a payload mismatch.

---

## 8. Root Cause Assessment

**Ambassador/COD does not have the same root cause as Online Orders.**

| | Online Orders (broken) | Ambassador/COD |
|--|------------------------|----------------|
| Save location | Centralized `Dashboard.updateOnlineOrderEmail` | Inline in `OrderDetailsDialog` |
| Payload key | `email` | `newEmail` |
| API reads | `newEmail` → undefined | `newEmail` → present |

The Online Orders bug was introduced by extracting email save into `Dashboard.tsx` with the wrong property name while `OrderDetailsDialog` (written earlier or separately) uses the correct `newEmail` key.

**Why COD likely works:** It never uses the broken Dashboard wrapper; it calls the API directly with the contract the backend implements.

---

## 9. Security / Data Integrity Impact

### If COD email edit works as coded (expected)

| Area | Impact |
|------|--------|
| Customer email accuracy | Admins with `orders:manage` can correct email on COD orders; updates `orders.user_email` only |
| COD delivery / contact | Correct email enables ticket/completion emails to reach the customer |
| Ambassador attribution | **No impact** — `ambassador_id` and related fields are not modified by email endpoint |
| Audit logs | Successful saves write `order_logs` action `admin_update_email` with old/new email |
| Admin permissions | Route correctly gated (`orders:manage`); tab visibility uses `ambassador_sales:manage` separately |

### Current risk from this investigation

**No Ambassador/COD-specific email bug identified.** The Online Orders bug does not affect COD unless someone copies the broken Dashboard pattern into the COD path in a future refactor.

---

## 10. Recommended Fix Options

**No fix recommended for Ambassador/COD email edit.** Keep it as a regression test reference when fixing Online Orders.

When fixing Online Orders, recommended safeguards:

1. **Regression — COD email still works:** Save email on an Ambassador Sales order after deploying Online Orders fix.
2. **Regression — shared endpoint:** Confirm `OrderDetailsDialog` still sends `newEmail` (unchanged).
3. **Optional hardening:** Add a contract test that `POST /api/admin/update-order-email` accepts `{ orderId, newEmail }` and rejects `{ orderId, email }` unless Option B from Online Orders audit is implemented (API accepts both keys).

---

## 11. Verification Plan

### Manual — Ambassador/COD email edit

1. Admin login with `ambassador_sales:manage` + `orders:manage`.
2. **Ambassador Sales** → open a COD / ambassador cash order.
3. Customer → Email → Edit → enter valid email → **Save**.
   - Expect: success toast, email visible in dialog.
   - Network: `POST /api/admin/update-order-email` body `{ "orderId": "...", "newEmail": "..." }` → **200**.
4. Repeat with invalid email (no `@`) → expect frontend `"Invalid email format"` (no API call).
5. Repeat with empty email → expect frontend `"Email cannot be empty"`.
6. Check `order_logs` for `admin_update_email` after successful save (if DB access available).

### Manual — Online Orders regression (after Online Orders fix)

1. Online Orders → edit email → Save.
2. Confirm body uses `newEmail`, not `email`.
3. Confirm no `"Valid email address is required"` for valid input.

### Manual — POS regression

1. **Point de Vente** tab → open POS order → save email.
2. Confirm `PATCH /api/admin/pos-orders/:id` with `{ user_email }` still works (separate endpoint).

### Automated (existing)

```bash
npm run test:admin-api-authz-coverage
```

Confirms `/api/admin/update-order-email` is gated with `orders:manage` (37/37 pass on 2026-07-01).

### Automated (recommended when fixing Online Orders)

Add a small Node test, e.g. `api/_lib/update-order-email-contract.test.cjs`:

- Assert `OrderDetailsDialog`-style body `{ orderId, newEmail }` is the documented contract.
- Optionally static-scan `Dashboard.tsx` does not send bare `email` key without `newEmail`.

### DevTools checklist (Ambassador/COD)

| Check | Expected |
|-------|----------|
| Request URL | `/api/admin/update-order-email` |
| Request body | `{ "orderId": "...", "newEmail": "user@domain.com" }` |
| 200 response | `{ success: true, newEmail: "...", ... }` |
| Wrong body `{ orderId, email }` | 400 `"Valid email address is required"` (proves Online Orders failure mode) |

---

## Appendix: Side-by-side email edit implementations

### Ambassador/COD (correct)

```865:868:src/pages/admin/components/OrderDetailsDialog.tsx
                                  body: JSON.stringify({
                                    orderId: order.id,
                                    newEmail: editingEmailValue.trim()
                                  }),
```

### Online Orders (broken)

```3061:3066:src/pages/admin/Dashboard.tsx
    const response = await fetch(apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, email: normalizedEmail }),
    });
```

### Backend (shared)

```4080:4090:api/misc.js
        const bodyData = await parseBody(req);
        const { orderId, newEmail } = bodyData;
        // ...
        if (!newEmail || typeof newEmail !== 'string') {
          return res.status(400).json({ error: 'Valid email address is required' });
        }
```
