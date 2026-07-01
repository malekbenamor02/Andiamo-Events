# Online Orders Email Edit Investigation

**Date:** 2026-07-01  
**Scope:** Investigation only — no code changes applied.

---

## 1. Reproduction Path

1. Log in to the admin dashboard with a role that has `orders:manage` (Online Orders tab access).
2. Navigate to **Admin → Online Orders** (`activeTab === "online-orders"`).
3. Click an order row to open the **Online order details** dialog.
4. In the **Customer** section, click the edit (pencil) icon next to **Email**.
5. Change the email value and click **Save** (red button with floppy-disk icon).
6. A destructive toast appears:
   - **Title:** `Error`
   - **Description:** `Valid email address is required`

This matches the screenshot provided (order total 294.00 TND, customer Wiem ben mekki, phone 24864663, email field in edit mode).

**Important note on the screenshot:** The visible input value `jinenebenmekk` (no `@` / domain) would be blocked by **frontend** validation with `"Invalid email format"`, not by the backend message shown. The backend message `"Valid email address is required"` is returned only when the API receives a request **without** a `newEmail` field (see §5–§6). That error occurs even when the admin enters a syntactically valid email, because the Online Orders save handler sends the wrong JSON property name.

---

## 2. Files Inspected

| File | Relevance |
|------|-----------|
| `src/pages/admin/Dashboard.tsx` | Hosts Online Orders tab, `updateOnlineOrderEmail` save handler, wires `OnlineOrderDetailsDialog` |
| `src/pages/admin/components/OnlineOrdersTab.tsx` | Online Orders list; `onViewOrder` opens detail dialog |
| `src/pages/admin/components/OnlineOrderDetailsDialog.tsx` | UI for editing customer email, frontend validation, Save button |
| `src/pages/admin/components/OrderDetailsDialog.tsx` | COD/Ambassador order email edit — **working** reference implementation |
| `src/lib/api-routes.ts` | Defines `ADMIN_UPDATE_ORDER_EMAIL: '/api/admin/update-order-email'` |
| `api/misc.js` | Backend handler for `POST /api/admin/update-order-email`; source of error message |
| `api/admin-pos.js` | Separate POS email update flow (different endpoint/contract) |
| `api/orders-create.js` | Online order creation email requirements |
| `vercel.json` | Rewrites `/api/admin/update-order-email` → `api/misc.js` |
| `src/types/orders.ts` | `user_email?: string \| null` on `Order` |
| `supabase/migrations/20250201000000-create-order-management-system.sql` | Original `orders.email TEXT` (nullable) |
| `supabase/migrations/20250201000005-remove-duplicate-columns.sql` | Documents canonical column `user_email` |
| `api/_lib/admin-api-authz-coverage.test.cjs` | Confirms route gated with `orders:manage` |

---

## 3. Frontend Flow

### Component chain

```
Dashboard.tsx
  └─ LazyOnlineOrdersTab (OnlineOrdersTab.tsx)
       └─ onViewOrder → setSelectedOnlineOrder + open dialog
  └─ OnlineOrderDetailsDialog
       └─ onUpdateEmail={updateOnlineOrderEmail}
```

Opening an order (`Dashboard.tsx` ~L8729):

```typescript
onViewOrder={(order) => { setSelectedOnlineOrder(order); setIsOnlineOrderDetailsOpen(true); }}
```

### State fields (OnlineOrderDetailsDialog)

- `isEditingEmail` — toggles view vs edit mode
- `editingEmailValue` — controlled input value
- `updatingEmail` — disables controls during save

Edit is initialized from `order.user_email || order.email || ""` (~L438).

### Input handling

- `<Input type="email" value={editingEmailValue} onChange={...} />` (~L360–367)
- Save click handler (~L371–411):
  1. `nextEmail = editingEmailValue.trim()`
  2. Reject empty → toast `"Email cannot be empty"`
  3. Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` → reject with `"Invalid email format"`
  4. `await onUpdateEmail(order.id, nextEmail)`
  5. On success: success toast, exit edit mode
  6. On failure: toast with `error.message` (this is where the backend `"Valid email address is required"` surfaces)

### Save handler (Dashboard.tsx)

```3051:3085:src/pages/admin/Dashboard.tsx
  // Update online order customer email
  const updateOnlineOrderEmail = async (orderId: string, newEmail: string) => {
    const normalizedEmail = newEmail.trim();
    if (!normalizedEmail) {
      throw new Error(language === 'en' ? 'Email cannot be empty' : "L'email ne peut pas etre vide");
    }

    const apiUrl = buildFullApiUrl(API_ROUTES.ADMIN_UPDATE_ORDER_EMAIL, getApiBaseUrl());
    if (!apiUrl) throw new Error('Invalid API URL configuration');

    const response = await fetch(apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, email: normalizedEmail }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || body.details || 'Failed to update email');
    }
    // ... optimistic local state update ...
  };
```

### Request payload (actual — **bug**)

```json
{
  "orderId": "<uuid>",
  "email": "user@example.com"
}
```

### Request payload (expected by API)

```json
{
  "orderId": "<uuid>",
  "newEmail": "user@example.com"
}
```

The working COD flow in `OrderDetailsDialog.tsx` sends the correct shape (~L865–868):

```typescript
body: JSON.stringify({
  orderId: order.id,
  newEmail: editingEmailValue.trim()
}),
```

---

## 4. Backend/API Flow

### Route

- **Method/path:** `POST /api/admin/update-order-email`
- **Implementation:** `api/misc.js` (~L4074–4178)
- **Deployment:** `vercel.json` rewrite to `api/misc.js` (~L424–425)

### Auth / permissions

```javascript
const authResult = await gateAdminPermission(req, res, 'orders:manage');
if (!authResult) return;
```

Confirmed in `api/_lib/admin-api-authz-coverage.test.cjs` — requires `orders:manage`.

### Handler logic

```4076:4135:api/misc.js
    if (path === '/api/admin/update-order-email' && method === 'POST') {
      // ...
        const bodyData = await parseBody(req);
        const { orderId, newEmail } = bodyData;
        // ...
        if (!orderId) {
          return res.status(400).json({ error: 'Order ID is required' });
        }
        
        if (!newEmail || typeof newEmail !== 'string') {
          return res.status(400).json({ error: 'Valid email address is required' });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail.trim())) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
        // ...
        const { data: order } = await dbClient
          .from('orders')
          .select('id, user_email')
          .eq('id', orderId)
          .single();
        // ...
        await dbClient.from('orders').update({
            user_email: trimmedNewEmail,
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)
        // audit log: order_logs action 'admin_update_email'
```

### Validation summary (backend)

| Check | Error |
|-------|-------|
| Missing `orderId` | `Order ID is required` |
| Missing / non-string `newEmail` | **`Valid email address is required`** |
| Regex fail on `newEmail` | `Invalid email format` |
| Order not found | `Order not found` |

There is **no** fallback that reads `bodyData.email` or `bodyData.user_email`.

### Database update

- Updates only `orders.user_email` and `orders.updated_at`
- Writes audit row to `order_logs` with action `admin_update_email`

---

## 5. Source of Error Message

**Exact location:**

```4089:4090:api/misc.js
        if (!newEmail || typeof newEmail !== 'string') {
          return res.status(400).json({ error: 'Valid email address is required' });
```

This is the **only** occurrence of the string `"Valid email address is required"` in the repository (verified via ripgrep).

It triggers when `newEmail` is `undefined`, `null`, empty string, or not a string — which happens for Online Orders because the client sends `email` instead of `newEmail`.

---

## 6. Root Cause Assessment

**Most likely root cause (high confidence): JSON payload field name mismatch between Online Orders frontend and the shared update-email API.**

| Layer | Expects / sends |
|-------|-----------------|
| `Dashboard.tsx` `updateOnlineOrderEmail` | sends **`email`** |
| `api/misc.js` handler | reads **`newEmail`** |
| `OrderDetailsDialog.tsx` (COD) | sends **`newEmail`** ✓ |

Because `const { orderId, newEmail } = bodyData` never sees `email`, `newEmail` is always `undefined` for the Online Orders path. The backend returns HTTP 400 with `"Valid email address is required"` before any DB lookup.

**Evidence:**

1. Grep shows a single source for the exact error text — backend guard on missing `newEmail`.
2. Online Orders handler is the **only** caller using `{ orderId, email }` (grep across repo).
3. COD `OrderDetailsDialog` uses the same endpoint with `{ orderId, newEmail }` and should succeed (same frontend validation + correct payload).
4. Frontend Online Orders validation would produce different messages (`Email cannot be empty`, `Invalid email format`) — matching the screenshot error confirms the request reached the API and failed on the `newEmail` guard, not on regex validation.

**Ruled out (for the reported error text):**

- **Wrong field name to DB** — handler never reaches DB when `newEmail` is missing.
- **Backend schema requiring unrelated fields** — only `orderId` + `newEmail` validated before update.
- **Empty email converted to invalid instead of null** — Online Orders frontend forbids empty save; backend would return `"Valid email address is required"` for empty `newEmail`, but the client never sends `newEmail` at all.

**Separate UX issue (screenshot):** If an admin tries to save a partial address like `jinenebenmekk`, frontend regex blocks with `"Invalid email format"`. Fixing the payload bug does not change that behavior.

---

## 7. Email Requirement Assessment

### At order creation (online checkout)

`api/orders-create.js` requires customer email:

```343:357:api/orders-create.js
    if (!customerInfo.full_name || !customerInfo.phone || !customerInfo.email || !customerInfo.city) {
      return orderErr(res, 400, 'Missing customer information', 'full_name, phone, email, and city are required');
    }
    if (!validateOrderEmail(customerInfo.email)) {
      return orderErr(res, 400, 'Invalid email', 'Please provide a valid email address.');
    }
```

Stored as `user_email: customerInfo.email.trim() || null` (~L870).

### In admin email-edit API

- **Required:** non-empty string matching email regex (`newEmail` must be present and valid).
- **Not supported:** clearing email to `null` via this endpoint (unlike POS).

### In database

- Original column: `email TEXT` (nullable, no `NOT NULL`) in `20250201000000-create-order-management-system.sql` (~L81).
- Canonical name per migrations: `user_email` (`20250201000005-remove-duplicate-columns.sql`).
- TypeScript model: `user_email?: string | null` (`src/types/orders.ts` ~L43).

**Conclusion:** New online orders must include a valid email, but the DB column allows null. Admin update endpoint treats email as **required and non-empty** when editing through `/api/admin/update-order-email`. Legacy or manually corrupted rows could theoretically hold invalid/missing email despite creation rules.

---

## 8. Security / Data Integrity Impact

| Area | Impact |
|------|--------|
| **Order data integrity** | Low — bug prevents updates; no partial/corrupt writes occur because validation fails before DB update. |
| **Customer PII** | None — email is not changed while bug persists. |
| **Other order fields** | None — endpoint updates only `user_email` (+ `updated_at`, audit log). |
| **Admin permissions** | Correct — `orders:manage` gate is in place; unauthorized users cannot hit the handler successfully. |
| **Audit trail** | No `admin_update_email` log entries are created for failed Online Orders attempts. |

No evidence this bug bypasses auth or affects unrelated admin actions.

---

## 9. Recommended Fix Options

### Option A — Fix Online Orders client payload (recommended)

**Files:** `src/pages/admin/Dashboard.tsx` (`updateOnlineOrderEmail`)

**Change:** Send `newEmail` instead of `email`:

```javascript
body: JSON.stringify({ orderId, newEmail: normalizedEmail }),
```

| Pros | Cons |
|------|------|
| Minimal one-line fix | Does not harden API against future callers |
| Aligns with COD dialog and API contract | Still requires non-empty valid email (no clear-to-null) |
| Lowest risk | |

**Risk level:** Low  
**Tests needed:**
- Manual: Online Orders email save succeeds; COD flow still works.
- Optional unit/integration test asserting `updateOnlineOrderEmail` request body keys.

---

### Option B — Accept both `newEmail` and `email` on the API

**Files:** `api/misc.js` (~L4081)

**Change:**

```javascript
const newEmail = bodyData.newEmail ?? bodyData.email;
```

| Pros | Cons |
|------|------|
| Backward compatible if any client uses `email` | Masks client bugs; two accepted shapes |
| Single-line server change | Slightly broader API surface |

**Risk level:** Low  
**Tests needed:**
- Node test posting `{ orderId, email }` and `{ orderId, newEmail }` both succeed.
- Regression: invalid/missing both fields still 400.

---

### Option C — Centralize email update in a shared frontend helper

**Files:** New small helper (e.g. `src/lib/adminOrdersApi.ts`), `Dashboard.tsx`, optionally refactor `OrderDetailsDialog.tsx` to use it.

**Change:** One function `updateOrderEmail(orderId, newEmail)` used by Online + COD dialogs.

| Pros | Cons |
|------|------|
| Prevents duplicate drift | Larger diff than Option A |
| Easier to test once | Still need to fix current bug in helper |

**Risk level:** Low–medium (touch multiple UI files)  
**Tests needed:** Same as A + vitest for helper mock fetch body.

---

## 10. Verification Plan

### After fix — manual

1. Admin login with `orders:manage`.
2. **Online Orders:** open order → edit email to valid address → Save → expect success toast and updated display after refresh.
3. **Online Orders:** try empty email → expect frontend `"Email cannot be empty"` (no API call).
4. **Online Orders:** try `invalid` without `@` → expect frontend `"Invalid email format"`.
5. **Ambassador Sales / COD:** edit email on an order → confirm still works (regression).
6. Optional: check `order_logs` for `admin_update_email` after successful save.

### After fix — automated

```bash
# Repo search — error should only remain in API guard, not triggered by clients
rg "Valid email address is required" -n .

# Auth coverage (existing)
npm run test:admin-api-authz-coverage

# Optional new test (if implemented): request body contract for update-order-email
node --test path/to/update-order-email.test.cjs
```

### DevTools check (before/after)

Network tab on Save:

- **URL:** `POST /api/admin/update-order-email`
- **Before fix body:** `{ "orderId": "...", "email": "..." }` → 400 `"Valid email address is required"`
- **After fix body:** `{ "orderId": "...", "newEmail": "..." }` → 200 `{ success: true, ... }`

---

## Appendix: Comparison of customer email edit flows

| Flow | Component | Endpoint | Payload field | Allows null? | Status |
|------|-----------|----------|---------------|--------------|--------|
| Online Orders | `OnlineOrderDetailsDialog` → `Dashboard.updateOnlineOrderEmail` | `POST /api/admin/update-order-email` | **`email`** (wrong) | No (frontend + API) | **Broken** |
| COD / Ambassador Sales | `OrderDetailsDialog` | `POST /api/admin/update-order-email` | **`newEmail`** | No | **Works** |
| POS orders | `PosTab` | `PATCH /api/admin/pos-orders/:id` | **`user_email`** | Yes (`null` allowed) | **Works** (different API) |
