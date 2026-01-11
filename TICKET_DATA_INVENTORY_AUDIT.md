# TICKET DATA INVENTORY (READ-ONLY AUDIT)

**Date:** 2025-01-02  
**Type:** Factual Inventory - No Code Changes  
**Purpose:** Complete traceability of ticket sales data, sources, and sellers

---

## 1️⃣ TICKET CORE DATA

### Primary Ticket Table: `tickets`

**Table:** `public.tickets`  
**Created:** Migration `20250201000025-create-tickets-table.sql`

**Columns:**

| Column | Type | Description | Populated At |
|--------|------|-------------|--------------|
| `id` | UUID | Primary key, unique ticket identifier | Auto-generated on insert |
| `order_id` | UUID | Foreign key to `orders(id)` - links ticket to parent order | Set during ticket creation |
| `order_pass_id` | UUID | Foreign key to `order_passes(id)` - links ticket to specific pass type | Set during ticket creation |
| `secure_token` | TEXT (UNIQUE) | UUID v4 value encoded in QR code for verification | Generated in `generateTicketsAndSendEmail()` - `server.cjs:7149` |
| `qr_code_url` | TEXT | Public URL to QR code image stored in Supabase Storage | Generated in `generateTicketsAndSendEmail()` - `server.cjs:7173-7175` |
| `status` | TEXT | Ticket generation status | Set during ticket creation |
| | | Values: `'PENDING'`, `'GENERATED'`, `'DELIVERED'`, `'FAILED'` | |
| `email_delivery_status` | TEXT | Email delivery tracking for this ticket | Updated in `updateTicketsToDelivered()` - `ticketGenerationService.tsx:386` |
| | | Values: `'pending'`, `'sent'`, `'failed'`, `'pending_retry'` | |
| `created_at` | TIMESTAMP | Ticket record creation timestamp | Auto-set on insert |
| `updated_at` | TIMESTAMP | Last update timestamp | Auto-updated via trigger |
| `generated_at` | TIMESTAMP | When QR code was generated | Set in `generateTicketsAndSendEmail()` - `server.cjs:7184` |
| `delivered_at` | TIMESTAMP | When email was successfully sent | Set in `updateTicketsToDelivered()` - `ticketGenerationService.tsx:395` |

**Indexes:**
- `idx_tickets_order_id` - Fast order lookups
- `idx_tickets_order_pass_id` - Fast pass type lookups
- `idx_tickets_secure_token` - Fast QR code validation lookups
- `idx_tickets_status` - Status filtering
- `idx_tickets_email_delivery_status` - Email tracking

**Key Functions:**
- **Ticket Generation:** `generateTicketsAndSendEmail()` - `server.cjs:6888`
- **Alternative:** `generateTicketsForOrder()` - `src/lib/ticketGenerationService.tsx:409`
- **Alternative:** `api/misc.js` (lines 1473-1520)
- **Alternative:** `api/admin-approve-order.js` (lines 443-495)

---

## 2️⃣ SALES SOURCE IDENTIFICATION

### Source Field Location: `orders.source`

**Table:** `public.orders`  
**Column:** `source` (TEXT, NOT NULL)  
**Constraint:** `CHECK (source IN ('platform_cod', 'platform_online', 'ambassador_manual'))`

**Possible Values:**

1. **`'platform_cod'`** - Cash on Delivery orders
   - Created via: `api/orders-create.js:377` or `server.cjs:9652`
   - Payment method: `'cod'` or `'ambassador_cash'`
   - Ambassador ID: **REQUIRED** (NOT NULL)
   - Status flow: `PENDING_ADMIN_APPROVAL` → `PAID` → tickets generated

2. **`'platform_online'`** - Online payment orders
   - Created via: `api/orders-create.js:377` or `server.cjs:9652`
   - Payment method: `'online'` or `'external_app'`
   - Ambassador ID: **NULL** (must be NULL)
   - Status flow: `PAID` → tickets generated

3. **`'ambassador_manual'`** - Manual orders created by ambassadors
   - Created via: Ambassador dashboard manual order creation
   - Payment method: `'cod'`
   - Ambassador ID: **REQUIRED** (NOT NULL)
   - Status flow: `MANUAL_ACCEPTED` → `MANUAL_COMPLETED` → tickets generated

**Source Determination Logic:**

```javascript
// From api/orders-create.js:377 and server.cjs:9652
source: paymentMethod === 'ambassador_cash' ? 'platform_cod' : 'platform_online'
```

**Additional Source Indicators:**

- **Payment Method:** `orders.payment_method`
  - Values: `'online'`, `'cod'`, `'external_app'`, `'ambassador_cash'`
  - Set at: `api/orders-create.js:387` or `server.cjs:9662`

- **Order Status:** `orders.status` (source-dependent)
  - COD: `'PENDING_ADMIN_APPROVAL'`, `'PAID'`, `'REJECTED'`, `'CANCELLED'`
  - Online: `'PAID'`, `'FAILED'`, `'REFUNDED'`
  - Manual: `'MANUAL_ACCEPTED'`, `'MANUAL_COMPLETED'`

---

## 3️⃣ SELLER / OWNER / RESPONSIBILITY CHAIN

### Ambassador Information

**Field:** `orders.ambassador_id` (UUID, nullable)  
**Foreign Key:** `REFERENCES ambassadors(id) ON DELETE SET NULL`  
**Index:** `idx_orders_ambassador_id`

**When Populated:**
- **COD Orders (`platform_cod`):** REQUIRED - Set at order creation
  - Location: `api/orders-create.js:384` or `server.cjs:9659`
  - Source: From request body or round-robin assignment
- **Ambassador Manual Orders:** REQUIRED - Set by ambassador creating order
- **Online Orders:** NULL (must be NULL per constraint)

**Ambassador Details Available Via Join:**
- `ambassadors.full_name`
- `ambassadors.phone`
- `ambassadors.email`
- `ambassadors.city`
- `ambassadors.commission_rate` (stored in ambassadors table, not orders)

### Admin Information

**NOT STORED** - No direct admin_id field in orders table

**Admin Actions Tracked Via:**
- `order_logs.performed_by` (UUID) - Can be admin ID
- `order_logs.performed_by_type` (TEXT) - `'admin'`, `'ambassador'`, or `'system'`
- `orders.approved_at` (TIMESTAMP) - When admin approved order
- `orders.rejected_at` (TIMESTAMP) - When admin rejected order
- `orders.rejection_reason` (TEXT) - Admin rejection reason

**Admin Approval Flow:**
- Endpoint: `api/admin-approve-order.js`
- Function: `verifyAdminAuth()` - `api/admin-approve-order.js:6`
- Admin ID extracted from JWT token, stored in `order_logs.performed_by`

### Buyer Information

**Fields in `orders` table:**
- `user_name` (TEXT, NOT NULL) - Customer full name
- `user_phone` (TEXT, NOT NULL) - Customer phone number
- `user_email` (TEXT, nullable) - Customer email
- `city` (TEXT, NOT NULL) - Customer city
- `ville` (TEXT, nullable) - Customer neighborhood (if city = 'Sousse')

**Populated At:**
- `api/orders-create.js:378-382` or `server.cjs:9653-9657`
- From `customerInfo` object in request body

### Created By / System Actions

**NOT STORED** - No `created_by` field in orders or tickets tables

**System Actions Logged In:**
- `order_logs` table
  - `performed_by` (UUID, nullable) - NULL for system actions
  - `performed_by_type` (TEXT) - `'system'` for automated actions
  - `action` (TEXT) - Action type (e.g., `'created'`, `'assigned'`, `'status_changed'`)
  - `details` (JSONB) - Additional context

**Order Creation Logging:**
- Trigger: `order_creation_logger` - `supabase/migrations/20250201000000-create-order-management-system.sql:484`
- Function: `log_order_creation()` - Sets `performed_by_type` based on source

---

## 4️⃣ FINANCIAL & COMMERCIAL DETAILS

### Price Data (Order-Level)

**Table:** `public.orders`  
**Columns:**

| Column | Type | Description | Level |
|--------|------|-------------|-------|
| `total_price` | DECIMAL(10,2) | Total order price | Order |
| `quantity` | INTEGER | Total ticket quantity (deprecated, use order_passes) | Order |

**Populated At:**
- `api/orders-create.js:386` or `server.cjs:9661`
- Calculated from sum of all passes in order

### Price Data (Pass-Level)

**Table:** `public.order_passes`  
**Columns:**

| Column | Type | Description | Level |
|--------|------|-------------|-------|
| `pass_type` | TEXT | Pass type name (e.g., 'VIP', 'Standard') | Pass |
| `quantity` | INTEGER | Quantity of this pass type | Pass |
| `price` | NUMERIC(10,2) | Price per pass (unit price) | Pass |

**Populated At:**
- `api/orders-create.js:424-440` or `server.cjs:9707-9723`
- Created for each pass type in order

### Commission Data

**NOT STORED** - No commission fields in orders or tickets tables

**Commission Information Available:**
- `ambassadors.commission_rate` (DECIMAL(5,2)) - Default 10.00%
- `ambassador_performance.commission_earned` (DECIMAL(10,2)) - Calculated/aggregated
- Commission is **calculated on-the-fly**, not stored per ticket/order

**Commission Calculation:**
- Based on `ambassadors.commission_rate` × order `total_price`
- Stored in `ambassador_performance` table (aggregated by event)

### Payment Method

**Field:** `orders.payment_method` (TEXT)  
**Constraint:** `CHECK (payment_method IN ('online', 'cod'))`

**Possible Values:**
- `'online'` - Online payment (Flouci gateway)
- `'cod'` - Cash on Delivery
- `'external_app'` - External payment app (legacy)
- `'ambassador_cash'` - Ambassador collects cash (treated as COD)

**Populated At:**
- `api/orders-create.js:387` or `server.cjs:9662`
- From request body `paymentMethod`

### Payment Status (Online Orders Only)

**Field:** `orders.payment_status` (TEXT, nullable)  
**Constraint:** `CHECK (payment_status IN ('PENDING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED'))`

**Populated At:**
- Updated when payment gateway responds
- `server.cjs` payment webhook handlers

### Currency

**NOT STORED** - No currency field. Assumed TND (Tunisian Dinar) based on context.

### Discount / Promo

**NOT STORED** - No discount or promo code fields in orders or tickets tables.

---

## 5️⃣ EVENT & PASS CONTEXT

### Event Linkage

**Field:** `orders.event_id` (UUID, nullable)  
**Foreign Key:** `REFERENCES events(id) ON DELETE SET NULL`  
**Index:** `idx_orders_event_id`

**Populated At:**
- `api/orders-create.js:383` or `server.cjs:9658`
- From request body `eventId`

**Event Details Available Via Join:**
- `events.id`
- `events.name`
- `events.date`
- `events.venue`
- `events.city`

### Pass Type Linkage

**Primary:** `order_passes.pass_type` (TEXT, NOT NULL)  
**Table:** `public.order_passes`  
**Foreign Key:** `order_passes.order_id` → `orders.id`

**Relationship:**
- One order can have multiple `order_passes` (one per pass type)
- Each `order_pass` has `quantity` and `price`
- Each ticket links to one `order_pass_id`

**Ticket → Pass Relationship:**
- `tickets.order_pass_id` → `order_passes.id`
- `order_passes.pass_type` → Pass type name (e.g., 'VIP', 'Standard')

**Deprecated Field:**
- `orders.pass_type` (TEXT, nullable) - Kept for backward compatibility
- New orders should use `order_passes` table

**Populated At:**
- `api/orders-create.js:424-440` or `server.cjs:9707-9723`
- One `order_pass` record per pass type in order

### Event Date & Venue

**NOT STORED** in orders or tickets tables  
**Available Via Join:**
- `events.date` - Event date
- `events.venue` - Event venue
- `events.city` - Event city

**Relationship Enforced:**
- `orders.event_id` → `events.id` (foreign key)
- Cascade: `ON DELETE SET NULL` (if event deleted, order.event_id becomes NULL)

---

## 6️⃣ LIFECYCLE & STATUS TRACKING

### Order Status Fields

**Field:** `orders.status` (TEXT, NOT NULL)  
**Source-Dependent Values:**

**COD Orders (`platform_cod`):**
- `'PENDING_ADMIN_APPROVAL'` - Waiting for admin approval
- `'PAID'` - Approved by admin, tickets can be generated
- `'REJECTED'` - Rejected by admin
- `'CANCELLED'` - Cancelled

**Online Orders (`platform_online`):**
- `'PAID'` - Payment successful, tickets generated
- `'FAILED'` - Payment failed
- `'REFUNDED'` - Order refunded

**Manual Orders (`ambassador_manual`):**
- `'MANUAL_ACCEPTED'` - Ambassador created order
- `'MANUAL_COMPLETED'` - Order completed

**Populated At:**
- Order creation: `api/orders-create.js:388` or `server.cjs:9663`
- Status changes: Various endpoints (admin approval, payment webhooks, etc.)

### Order Timestamps

| Field | Description | Populated At |
|-------|-------------|--------------|
| `created_at` | Order creation | Auto-set on insert |
| `updated_at` | Last update | Auto-updated via trigger |
| `assigned_at` | When ambassador assigned | `api/orders-create.js:390` or `server.cjs:9665` |
| `accepted_at` | When ambassador accepted | Ambassador acceptance action |
| `completed_at` | When order completed | Order completion action |
| `cancelled_at` | When order cancelled | Order cancellation action |
| `approved_at` | When admin approved | `api/admin-approve-order.js` |
| `rejected_at` | When admin rejected | Admin rejection action |
| `tickets_generated_at` | When tickets generated | `generateTicketsAndSendEmail()` |

### Ticket Status Fields

**Field:** `tickets.status` (TEXT, NOT NULL)  
**Values:** `'PENDING'`, `'GENERATED'`, `'DELIVERED'`, `'FAILED'`

**Field:** `tickets.email_delivery_status` (TEXT, nullable)  
**Values:** `'pending'`, `'sent'`, `'failed'`, `'pending_retry'`

**Ticket Timestamps:**

| Field | Description | Populated At |
|-------|-------------|--------------|
| `created_at` | Ticket record creation | Auto-set on insert |
| `updated_at` | Last update | Auto-updated via trigger |
| `generated_at` | QR code generated | `server.cjs:7184` |
| `delivered_at` | Email sent | `ticketGenerationService.tsx:395` |

### Who Triggered Status Changes

**Tracked In:** `order_logs` table

| Field | Description | Values |
|-------|-------------|--------|
| `performed_by` | UUID of user who performed action | Ambassador ID, Admin ID, or NULL (system) |
| `performed_by_type` | Type of actor | `'ambassador'`, `'admin'`, `'system'` |
| `action` | Action type | `'created'`, `'assigned'`, `'accepted'`, `'cancelled'`, `'completed'`, `'admin_reassigned'`, `'admin_cancelled'`, `'admin_refunded'`, `'status_changed'` |
| `details` | JSONB with context | Old status, new status, reason, etc. |

**Populated At:**
- Automatic triggers: `order_action_logger`, `order_creation_logger`
- Manual logging: Various endpoints log actions explicitly

---

## 7️⃣ QR CODE & SCAN READINESS

### QR Code Linkage to Ticket

**Token Source:** `tickets.secure_token` (TEXT, UNIQUE)  
**QR Code Content:** The `secure_token` UUID v4 value is encoded in the QR code image

**QR Code Generation:**
- Function: `QRCode.toBuffer(secureToken, ...)` - `server.cjs:7152`
- Input: `secureToken` (UUID v4) - `server.cjs:7149`
- Storage: Supabase Storage bucket `tickets` at path `tickets/${orderId}/${secureToken}.png`
- URL Stored: `tickets.qr_code_url` - `server.cjs:7182`

**QR Code Image Storage:**
- **Location:** Supabase Storage (persistent)
- **Path:** `tickets/${orderId}/${secureToken}.png`
- **Public URL:** Stored in `tickets.qr_code_url`

### Scan Validation

**Current Endpoint:** `/api/validate-ticket` - `server.cjs:1726`

**Current Implementation (MISMATCH DETECTED):**
- **Queries:** `pass_purchases` table by `qr_code` field - `server.cjs:1738-1749`
- **Expected:** Should query `tickets` table by `secure_token` field
- **Scanned Value:** The decoded QR code contains the `secure_token` UUID

**Scan Validation Source:**
- **Current (Incorrect):** `pass_purchases.qr_code` - `server.cjs:1749`
- **Should Be:** `tickets.secure_token` (indexed, unique)

**Scan Tracking:**
- **Table:** `scans`
- **Fields:**
  - `ticket_id` (UUID) - References `pass_purchases(id)` (MISMATCH - should reference `tickets.id`)
  - `event_id` (UUID)
  - `ambassador_id` (UUID) - Who scanned
  - `scan_time` (TIMESTAMP)
  - `scan_result` (TEXT) - `'valid'`, `'invalid'`, `'already_scanned'`, `'expired'`
  - `scan_location` (TEXT)
  - `device_info` (TEXT)

**Note:** There is a schema mismatch between ticket generation (uses `tickets` table) and scan validation (uses `pass_purchases` table). The `pass_purchases` table appears to be legacy/unused for new ticket generation.

---

## SUMMARY

### How to Fully Identify Who Sold a Ticket, From Where, How, and With What Data

**To trace a ticket sale completely:**

1. **Start with Ticket:**
   - Query `tickets` table by `secure_token` (from scanned QR code)
   - Get `order_id` and `order_pass_id`

2. **Get Order Details:**
   - Query `orders` table by `order_id`
   - **Sales Source:** `orders.source` → `'platform_cod'`, `'platform_online'`, or `'ambassador_manual'`
   - **Payment Method:** `orders.payment_method` → `'online'`, `'cod'`, etc.
   - **Seller (Ambassador):** `orders.ambassador_id` → Join to `ambassadors` table for details
   - **Buyer:** `orders.user_name`, `orders.user_phone`, `orders.user_email`, `orders.city`
   - **Price:** `orders.total_price` (order total)
   - **Event:** `orders.event_id` → Join to `events` table

3. **Get Pass Details:**
   - Query `order_passes` table by `order_pass_id`
   - Get `pass_type`, `quantity`, `price` (unit price)

4. **Get Financial Details:**
   - **Commission:** Calculate from `ambassadors.commission_rate` × `orders.total_price`
   - **Commission Tracking:** Query `ambassador_performance` table (aggregated by event)

5. **Get Lifecycle History:**
   - Query `order_logs` table by `order_id`
   - See all status changes, who performed them (`performed_by`, `performed_by_type`), and when

6. **Get Admin Actions:**
   - Check `orders.approved_at` / `orders.rejected_at` for admin approval/rejection
   - Check `order_logs` where `performed_by_type = 'admin'` for admin actions

**Key Relationships:**
- `tickets.order_id` → `orders.id` (one-to-many)
- `tickets.order_pass_id` → `order_passes.id` (many-to-one)
- `orders.ambassador_id` → `ambassadors.id` (many-to-one, nullable)
- `orders.event_id` → `events.id` (many-to-one, nullable)
- `order_logs.order_id` → `orders.id` (one-to-many)

**Missing Data Points:**
- ❌ Admin ID who approved/rejected (only timestamp stored)
- ❌ Commission per ticket/order (only aggregated in `ambassador_performance`)
- ❌ Discount/promo codes
- ❌ Currency (assumed TND)
- ❌ Created_by field (system actions logged in `order_logs`)

**Data Completeness:**
- ✅ Sales source (orders.source)
- ✅ Payment method (orders.payment_method)
- ✅ Ambassador seller (orders.ambassador_id)
- ✅ Buyer information (orders.user_*)
- ✅ Price data (orders.total_price, order_passes.price)
- ✅ Event context (orders.event_id)
- ✅ Pass type (order_passes.pass_type)
- ✅ Status history (order_logs)
- ✅ QR code token (tickets.secure_token)
- ⚠️ Scan validation uses wrong table (pass_purchases instead of tickets)

---

**END OF AUDIT**
