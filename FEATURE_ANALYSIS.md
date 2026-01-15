# Feature Analysis Document
## Comprehensive Analysis of Requested Features

**Date:** 2025-02-XX  
**Status:** Analysis Phase - No Code Changes Yet

---

## Table of Contents
1. [Admin Order Removal (Soft Delete)](#1-admin-order-removal-soft-delete)
2. [Sold Quantity Management on Order Cancellation/Rejection](#2-sold-quantity-management-on-order-cancellationrejection)
3. [Pending Order Timer/Date Management](#3-pending-order-timerdate-management)
4. [Admin Messages for Ambassadors](#4-admin-messages-for-ambassadors)
5. [Random Ambassador Display in Pass Purchase](#5-random-ambassador-display-in-pass-purchase)

---

## 1. Admin Order Removal (Soft Delete)

### Current State Analysis

**Order Structure:**
- Orders table contains: `id`, `status`, `payment_method`, `payment_status`, `order_passes`, etc.
- Order statuses include: `PENDING_ONLINE`, `PENDING_CASH`, `PAID`, `CANCELLED`, etc.
- Related data includes:
  - `order_passes` table (one-to-many relationship)
  - `order_logs` table (audit trail)
  - `tickets` table (if order was approved/paid)
  - `qr_tickets` table (QR code registry)
  - `email_delivery_logs` (if email was sent)
  - `sms_logs` (if SMS was sent)

**Current Admin Actions:**
- Admin can approve orders (changes status to `PAID`)
- Admin can reject orders (changes status to `REJECTED`)
- Admin can view order details in modal (`isOrderDetailsOpen`, `isOnlineOrderDetailsOpen`)
- No current "delete" or "remove" functionality exists

**Related Data Identified:**
1. **order_passes** - Contains pass type, quantity, price for each pass in the order
2. **order_logs** - Audit trail of all order actions
3. **tickets** - Generated tickets with QR codes (if order was PAID)
4. **qr_tickets** - QR ticket registry entries
5. **email_delivery_logs** - Email delivery tracking
6. **sms_logs** - SMS delivery tracking

### Requirements

1. **Admin should be able to remove orders** (soft delete)
2. **Only non-PAID orders can be removed** (PAID orders are protected)
3. **Deletion should be soft delete** (change status, not actual deletion)
4. **Removed orders should not appear in ambassador sales reports**
5. **Data should be preserved** (for audit/historical purposes)
6. **Button should be in admin order view modal** (in the action buttons section)

### Implementation Plan

#### Database Changes

**New Order Status:**
- Add `REMOVED` or `DELETED` status to order status enum
- Alternative: Use existing `CANCELLED` status with a flag `is_removed_by_admin: boolean`

**Recommended Approach:**
- Add new status: `REMOVED_BY_ADMIN` to distinguish from regular cancellations
- Add optional field: `removed_at: timestamp` and `removed_by: uuid` (admin_id)

#### Backend Changes

**New API Endpoint:** `/api/admin-remove-order`
- Verify admin authentication
- Check order status (must NOT be `PAID`)
- Update order status to `REMOVED_BY_ADMIN`
- Set `removed_at` timestamp
- Set `removed_by` to admin ID
- Log action to `order_logs`
- **DO NOT** delete any related data (order_passes, tickets, logs remain)

**Stock Management:**
- When order is removed, decrease `sold_quantity` in `event_passes` table
- This will be handled in feature #2

#### Frontend Changes

**Admin Dashboard (`src/pages/admin/Dashboard.tsx`):**
- Add "Remove Order" button in order details modal
- Button should only show if:
  - Order status is NOT `PAID`
  - User is admin
- Add confirmation dialog before removal
- After removal, refresh order list and show success toast

**Location in Code:**
- Order details modal around line 14751 (`setIsOrderDetailsOpen(true)`)
- Online order details modal around line 14437 (`setIsOnlineOrderDetailsOpen(true)`)
- Add button alongside existing approve/reject buttons

#### Filtering Logic

**Ambassador Sales Reports:**
- Update queries that fetch orders for ambassador sales
- Filter out orders with status `REMOVED_BY_ADMIN`
- Location: `src/pages/ambassador/Dashboard.tsx` - `fetchPerformance` function
- Also filter in any other sales/revenue calculations

**Admin Dashboard:**
- Option to show/hide removed orders (filter toggle)
- Default: Show removed orders but with visual indicator (grayed out, badge)

---

## 2. Sold Quantity Management on Order Cancellation/Rejection

### Current State Analysis

**Stock System:**
- `event_passes` table has:
  - `max_quantity: integer | null` (null = unlimited)
  - `sold_quantity: integer` (default 0)
  - Constraint: `sold_quantity <= max_quantity` (or max_quantity is null)

**Current Flow:**
- When order is created: `sold_quantity` is increased (in `api/orders-create.js`)
- When order is approved (PAID): No change (already counted)
- **ISSUE:** When order is cancelled/rejected/removed, `sold_quantity` is NOT decreased

**Order Status Transitions:**
- `PENDING_CASH` → `PENDING_ADMIN_APPROVAL` → `PAID` (sold_quantity already increased)
- `PENDING_CASH` → `CANCELLED` (sold_quantity should decrease)
- `PENDING_ADMIN_APPROVAL` → `REJECTED` (sold_quantity should decrease)
- `PENDING_ADMIN_APPROVAL` → `REMOVED_BY_ADMIN` (sold_quantity should decrease)
- `PAID` → `CANCELLED` (refund scenario - sold_quantity should decrease)

### Requirements

1. **When order is cancelled/rejected/removed, decrease `sold_quantity`**
2. **Handle all cancellation scenarios:**
   - Ambassador cancels order
   - Admin rejects order
   - Admin removes order
   - Admin cancels paid order (refund)
3. **Update must be atomic** (transaction-safe)
4. **Must handle multiple passes in one order** (order_passes table)

### Implementation Plan

#### Database Changes

**No schema changes needed** - `sold_quantity` field already exists

**Consider adding trigger or function:**
- Database trigger on order status change (complex, not recommended)
- Better: Handle in application logic with transactions

#### Backend Changes

**Update Existing Endpoints:**

1. **`api/admin-approve-order.js`** (already exists)
   - Currently: Only handles approval
   - No changes needed (approval doesn't affect sold_quantity)

2. **`api/admin-reject-order.js`** (needs to be created or updated)
   - When rejecting: Decrease `sold_quantity` for each pass in `order_passes`
   - Use transaction to ensure atomicity

3. **`src/lib/orders/cancellationService.ts`**
   - `cancelByAdmin()` - Add sold_quantity decrease logic
   - `cancelByAmbassador()` - Add sold_quantity decrease logic

4. **New: `api/admin-remove-order.js`**
   - When removing: Decrease `sold_quantity` for each pass

**Stock Decrease Logic:**
```javascript
// Pseudo-code
For each order_pass in order.order_passes:
  - Get event_pass by pass_type and event_id
  - Decrease sold_quantity by order_pass.quantity
  - Ensure sold_quantity >= 0 (safety check)
  - Update event_passes table
```

**Transaction Safety:**
- Use Supabase transaction or ensure all updates succeed
- If any update fails, rollback order status change

#### Frontend Changes

**No direct frontend changes needed** - handled in backend

**Error Handling:**
- If stock decrease fails, show error to admin
- Order status should not change if stock update fails

---

## 3. Pending Order Timer/Date Management

### Current State Analysis

**Current Order Statuses:**
- `PENDING_CASH` - Ambassador cash orders waiting for confirmation
- `PENDING_ONLINE` - Online payment pending
- `PENDING_ADMIN_APPROVAL` - Waiting for admin approval

**Current Fields:**
- `assigned_at: timestamp` - When order was assigned to ambassador
- `accepted_at: timestamp` - When ambassador accepted
- `created_at: timestamp` - Order creation time
- No expiration/timer fields exist

### Requirements

1. **Admin can set expiration date/timer for pending orders**
2. **Admin can edit the period from dashboard**
3. **Should apply to pending orders** (PENDING_CASH, PENDING_ONLINE, PENDING_ADMIN_APPROVAL)
4. **Timer should be configurable per order or globally**

### Implementation Plan

#### Database Changes

**Option 1: Per-Order Expiration**
- Add `expires_at: timestamp` to `orders` table
- Add `expiration_set_by: uuid` (admin_id)
- Add `expiration_notes: text` (optional reason)

**Option 2: Global Settings**
- Create new table: `order_expiration_settings`
  - `id: uuid`
  - `order_status: text` (PENDING_CASH, PENDING_ONLINE, etc.)
  - `default_expiration_hours: integer` (e.g., 24, 48, 72)
  - `is_active: boolean`
  - `created_at: timestamp`
  - `updated_at: timestamp`

**Recommended: Both**
- Global settings for default expiration
- Per-order override capability

#### Backend Changes

**New API Endpoints:**

1. **`GET /api/admin/order-expiration-settings`**
   - Get current expiration settings

2. **`POST /api/admin/order-expiration-settings`**
   - Update global expiration settings

3. **`POST /api/admin/set-order-expiration`**
   - Set expiration for specific order
   - Body: `{ orderId, expiresAt, reason? }`

4. **Background Job/Cron (optional):**
   - Check for expired orders
   - Auto-cancel or notify admin

#### Frontend Changes

**Admin Dashboard:**

1. **Settings Section:**
   - New tab or section: "Order Expiration Settings"
   - Form to set default expiration hours per status:
     - PENDING_CASH: X hours
     - PENDING_ONLINE: X hours
     - PENDING_ADMIN_APPROVAL: X hours
   - Save button to update global settings

2. **Order Details Modal:**
   - Show current expiration (if set)
   - Add "Set Expiration" button
   - Date/time picker to set custom expiration
   - Show countdown timer if expiration is set

3. **Order List:**
   - Show expiration indicator (badge/icon)
   - Highlight orders expiring soon (e.g., < 2 hours)
   - Sort by expiration date

**UI Components Needed:**
- Date/time picker component
- Countdown timer component
- Expiration badge component

---

## 4. Admin Messages for Ambassadors

### Current State Analysis

**Ambassador Dashboard:**
- Located in `src/pages/ambassador/Dashboard.tsx`
- Shows: Orders, Performance, Profile
- No current message/notification system for admin messages

**Admin Dashboard:**
- No current section for managing ambassador messages

### Requirements

1. **Admin can write messages that show to ambassadors**
2. **Messages appear when ambassador enters dashboard**
3. **Admin can edit messages from dashboard**
4. **Admin can remove/delete messages**

### Implementation Plan

#### Database Changes

**New Table: `ambassador_messages`**
```sql
CREATE TABLE ambassador_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_text TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('info', 'warning', 'alert', 'announcement')),
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Higher = more important
  target_audience TEXT CHECK (target_audience IN ('all', 'specific_city', 'specific_ville', 'specific_ambassadors')),
  target_city TEXT NULL,
  target_ville TEXT NULL,
  target_ambassador_ids UUID[] NULL, -- Array of ambassador IDs
  created_by UUID REFERENCES admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NULL, -- Optional expiration
  display_until_read BOOLEAN DEFAULT false -- Show until ambassador marks as read
);
```

**New Table: `ambassador_message_reads`** (track who read what)
```sql
CREATE TABLE ambassador_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES ambassador_messages(id) ON DELETE CASCADE,
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, ambassador_id)
);
```

#### Backend Changes

**New API Endpoints:**

1. **`GET /api/ambassador/messages`**
   - Get active messages for current ambassador
   - Filter by: target_audience, city, ville, expiration

2. **`POST /api/ambassador/messages/:id/read`**
   - Mark message as read by ambassador

3. **`GET /api/admin/ambassador-messages`**
   - Get all messages (admin view)

4. **`POST /api/admin/ambassador-messages`**
   - Create new message

5. **`PUT /api/admin/ambassador-messages/:id`**
   - Update existing message

6. **`DELETE /api/admin/ambassador-messages/:id`**
   - Delete message (soft delete: set is_active = false)

#### Frontend Changes

**Admin Dashboard:**

1. **New Section: "Ambassador Messages"**
   - Tab or dedicated section
   - List of all messages (active and inactive)
   - Create/Edit/Delete buttons
   - Message editor (rich text or plain text)
   - Options:
     - Message type (info/warning/alert)
     - Target audience (all/specific city/ville/ambassadors)
     - Priority
     - Expiration date
     - Display until read

2. **Message Management UI:**
   - Table/list view of messages
   - Status indicator (active/inactive)
   - Edit button opens modal with form
   - Delete button with confirmation

**Ambassador Dashboard:**

1. **Message Display Component:**
   - Fetch messages on dashboard load
   - Display as alert/banner at top of dashboard
   - Different styling based on message_type:
     - `info`: Blue/neutral
     - `warning`: Yellow/orange
     - `alert`: Red
     - `announcement`: Green/prominent
   - "Mark as read" or "Dismiss" button
   - Auto-dismiss after X seconds (optional)
   - Show unread count badge

2. **Implementation Location:**
   - `src/pages/ambassador/Dashboard.tsx`
   - Add message component at top of dashboard (after header, before tabs)

**UI Components:**
- Message banner/alert component
- Message editor modal (admin)
- Message list component (admin)

---

## 5. Random Ambassador Display in Pass Purchase

### Current State Analysis

**Current Implementation:**
- `src/components/orders/AmbassadorSelector.tsx` - Displays ambassadors
- `src/hooks/useActiveAmbassadors.ts` - Fetches ambassadors
- `src/lib/ambassadors/ambassadorService.ts` - `getActiveAmbassadorsByLocation()`
- Ambassadors are filtered by `city` and `ville`
- Currently ordered by `full_name` (alphabetical)

**Current Query:**
```typescript
// From ambassadorService.ts
.order('full_name')  // Alphabetical order
```

**Location in Pass Purchase:**
- `src/pages/PassPurchase.tsx` - Uses `AmbassadorSelector` component
- Ambassadors are fetched based on user's selected city/ville

### Requirements

1. **Randomize ambassador display order**
2. **Keep city and ville filtering logic unchanged**
3. **Only affect display order, not assignment logic**
4. **Should be random each time** (not cached order)

### Implementation Plan

#### Database Changes

**No schema changes needed**

**Option: Add randomization at query level**
- Use PostgreSQL `ORDER BY RANDOM()` or `ORDER BY RANDOM()` with seed

#### Backend Changes

**Update `src/lib/ambassadors/ambassadorService.ts`:**

**Current:**
```typescript
.order('full_name')
```

**Change to:**
```typescript
// Option 1: Pure random
.order('random()', { ascending: false })  // Supabase doesn't support this directly

// Option 2: Use RPC function
// Create database function that returns random order

// Option 3: Fetch all, shuffle in JavaScript
```

**Recommended: Option 3 (JavaScript shuffle)**
- Fetch ambassadors as usual
- Shuffle array in JavaScript using Fisher-Yates algorithm
- No database changes needed
- Simple and reliable

#### Frontend Changes

**Update `src/lib/ambassadors/ambassadorService.ts`:**

```typescript
export async function getActiveAmbassadorsByLocation(
  city: string,
  ville?: string
): Promise<Ambassador[]> {
  // ... existing query logic ...
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch active ambassadors: ${error.message}`);
  }
  
  // Shuffle the results
  const shuffled = shuffleArray(data || []);
  
  return shuffled as Ambassador[];
}

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

**Alternative: Shuffle in component**
- Keep service as-is
- Shuffle in `AmbassadorSelector.tsx` or `PassPurchase.tsx`
- Less ideal (shuffling should be in service layer)

**No changes needed in:**
- `useActiveAmbassadors` hook (just passes through)
- `AmbassadorSelector` component (displays whatever order it receives)
- Pass purchase page (uses component as-is)

---

## Implementation Priority & Dependencies

### Recommended Order:

1. **Feature #2 (Sold Quantity Management)** - Critical for data integrity
2. **Feature #1 (Admin Order Removal)** - Depends on #2 for stock management
3. **Feature #5 (Random Ambassador Display)** - Simple, no dependencies
4. **Feature #3 (Pending Order Timer)** - Medium complexity
5. **Feature #4 (Admin Messages)** - Most complex, can be done independently

### Dependencies:

- Feature #1 depends on Feature #2 (stock decrease on removal)
- Feature #3 is independent
- Feature #4 is independent
- Feature #5 is independent

---

## Testing Considerations

### Feature #1 (Order Removal):
- Test removing non-PAID orders
- Test that PAID orders cannot be removed
- Test that removed orders don't appear in ambassador sales
- Test that related data is preserved

### Feature #2 (Sold Quantity):
- Test stock decrease on cancellation
- Test stock decrease on rejection
- Test stock decrease on removal
- Test concurrent order scenarios (race conditions)
- Test refund scenario (PAID → CANCELLED)

### Feature #3 (Order Timer):
- Test setting expiration
- Test editing expiration
- Test expiration display in UI
- Test expired order handling (if auto-cancel implemented)

### Feature #4 (Admin Messages):
- Test creating messages
- Test editing messages
- Test deleting messages
- Test message display for ambassadors
- Test targeting (all/specific city/ville)
- Test read tracking

### Feature #5 (Random Display):
- Test that filtering by city/ville still works
- Test that order is different on each page load
- Test with different numbers of ambassadors

---

## Database Migration Files Needed

1. **Add REMOVED_BY_ADMIN status:**
   - Migration: `YYYYMMDDHHMMSS-add-removed-order-status.sql`

2. **Add order expiration fields:**
   - Migration: `YYYYMMDDHHMMSS-add-order-expiration.sql`

3. **Add expiration settings table:**
   - Migration: `YYYYMMDDHHMMSS-create-order-expiration-settings.sql`

4. **Add ambassador messages tables:**
   - Migration: `YYYYMMDDHHMMSS-create-ambassador-messages.sql`

---

## Files That Will Need Changes

### Backend/API:
- `api/admin-approve-order.js` (review, may need updates)
- `api/admin-reject-order.js` (create or update)
- `api/admin-remove-order.js` (create new)
- `api/orders-create.js` (review stock management)
- `api/misc.js` (may need updates for expiration settings)
- `server.cjs` (may need new routes)

### Frontend Services:
- `src/lib/orders/orderService.ts` (add remove function)
- `src/lib/orders/cancellationService.ts` (add stock decrease)
- `src/lib/ambassadors/ambassadorService.ts` (add shuffle)

### Frontend Pages:
- `src/pages/admin/Dashboard.tsx` (major updates)
- `src/pages/ambassador/Dashboard.tsx` (add messages, update sales filter)

### Frontend Components:
- `src/components/orders/AmbassadorSelector.tsx` (no changes if shuffle in service)

### Database:
- Multiple migration files (see above)

---

## Notes & Considerations

1. **Soft Delete vs Hard Delete:**
   - All deletions should be soft (status change)
   - Preserve audit trail and historical data

2. **Stock Management:**
   - Critical to handle race conditions
   - Use transactions where possible
   - Consider locking mechanism for concurrent updates

3. **Performance:**
   - Random ambassador shuffle is lightweight
   - Message queries should be indexed
   - Expiration checks may need background job

4. **User Experience:**
   - Confirmation dialogs for destructive actions
   - Clear visual indicators for removed/expired orders
   - Toast notifications for all actions

5. **Internationalization:**
   - All new UI text should support EN/FR
   - Use existing translation patterns

---

## Questions for Clarification

1. **Order Removal:**
   - Should removed orders be visible to admin with a filter?
   - Should there be a way to restore removed orders?

2. **Sold Quantity:**
   - What happens if sold_quantity becomes negative? (Should not happen, but safety check)

3. **Order Expiration:**
   - Should expired orders auto-cancel or just notify admin?
   - Should there be warnings before expiration (e.g., 1 hour before)?

4. **Admin Messages:**
   - Should messages support rich text/formatting?
   - Should there be message templates?
   - Should messages support attachments/images?

5. **Random Display:**
   - Should the random order persist for a session, or change on every render?
   - Should there be a way to disable randomization (admin setting)?

---

**End of Analysis Document**
