# ORDER SYSTEM ANALYSIS & DESIGN DOCUMENT
**Date:** Analysis Phase  
**Status:** ANALYSIS ONLY - NO CODE CHANGES  
**Objective:** Design a 3-option order & payment system with admin control and ambassador cash flow

---

## 📌 1. CURRENT CODEBASE ANALYSIS

### 1.1 Relevant Files Identified

#### **Database Schema Files:**
- `supabase/migrations/20250201000000-create-order-management-system.sql` - Initial orders table creation
- `supabase/migrations/20250201000004-fix-orders-table-structure.sql` - Customer fields addition
- `supabase/migrations/20250201000005-remove-duplicate-columns.sql` - Cleanup (removed customer_name, phone, email in favor of user_*)
- `supabase/migrations/20250201000018-comprehensive-orders-schema-refactor.sql` - Major refactor with order_passes table
- `supabase/migrations/20250201000014-add-online-order-payment-fields.sql` - Payment status fields
- `supabase/migrations/20250201000015-fix-payment-columns-and-add-payment-status.sql` - Payment method fixes
- `supabase/migrations/20250718000000-create-ambassadors-table.sql` - Ambassadors table

#### **Frontend Pages:**
- `src/pages/PassPurchase.tsx` - Current order creation page (online payment only currently)
- `src/pages/CODOrder.tsx` - Legacy COD order page (appears unused/outdated)
- `src/pages/ambassador/Dashboard.tsx` - Ambassador manual order creation
- `src/pages/admin/Dashboard.tsx` - Admin order management (14784 lines - very large)

#### **Business Logic:**
- `src/lib/ambassadorOrders.ts` - Ambassador order utilities
- `src/lib/ticketGenerationService.tsx` - Ticket generation logic
- `AMBASSADOR_ORDERS_LOGIC.txt` - Documentation of current ambassador order flow
- `server.cjs` - Backend API (assign-order endpoint)

#### **Configuration:**
- `src/lib/salesSettings.ts` - Sales enable/disable (global toggle)
- `supabase/migrations/20250103000000-add-sales-enabled-setting.sql` - Sales settings table

### 1.2 Current Implementation Logic

#### **Order Creation Flow:**
1. **Online Orders** (`PassPurchase.tsx`):
   - Customer selects passes
   - Enters: fullName, phone, email, city, ville (if Sousse)
   - Creates order with `source: 'platform_online'`
   - `payment_method: 'online'`
   - `status: 'PENDING'` (needs to become `PENDING_ONLINE`)
   - `payment_status: 'PENDING_PAYMENT'` (for future gateway)

2. **COD Orders** (Legacy `CODOrder.tsx` - appears unused):
   - Old implementation
   - Uses outdated status: `PENDING_ADMIN_APPROVAL`
   - Not integrated with new system

3. **Ambassador Manual Orders** (`ambassador/Dashboard.tsx`):
   - Ambassador creates order on behalf of customer
   - `source: 'ambassador_manual'`
   - `payment_method: 'cod'`
   - `status: 'PENDING_ADMIN_APPROVAL'`
   - Requires admin approval

#### **Ambassador Assignment (Current - TO BE REMOVED):**
- ~~Round-robin system via `/api/assign-order`~~ **REMOVE - User will manually select ambassador**
- ~~Database function: `assign_order_to_ambassador(p_order_id, p_ville)`~~ **REMOVE**
- ~~Uses `round_robin_tracker` table per ville~~ **REMOVE**
- **NEW APPROACH:** User selects ambassador from list filtered by city/ville
- Filters ambassadors by:
  - `status = 'ACTIVE'` (not 'approved')
  - `city` match
  - `ville` match (if provided)
- Order created directly with selected `ambassador_id`
- Status set to `PENDING_CASH` immediately

#### **Current Database Schema:**

**Orders Table:**
- `id` (UUID, PK)
- `source` ('platform_cod' | 'platform_online' | 'ambassador_manual')
- `user_name` (TEXT, NOT NULL) ⚠️ Note: Uses user_name not customer_name
- `user_phone` (TEXT, NOT NULL)
- `user_email` (TEXT, nullable)
- `city` (TEXT, NOT NULL)
- `ville` (TEXT, nullable)
- `city_id` (UUID, FK to cities) - exists but may not be used
- `ville_id` (UUID, FK to villes) - exists but may not be used
- `ambassador_id` (UUID, FK to ambassadors, nullable)
- `event_id` (UUID, FK to events, nullable)
- `pass_type` (TEXT, nullable) - DEPRECATED, use order_passes table
- `quantity` (INTEGER, NOT NULL)
- `total_price` (DECIMAL(10,2), NOT NULL)
- `payment_method` ('cod' | 'online')
- `status` (TEXT) - Complex, source-dependent
- `payment_status` (TEXT, nullable) - 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'REFUNDED'
- `payment_gateway_reference` (TEXT, nullable)
- `payment_response_data` (JSONB, nullable)
- `transaction_id` (TEXT, nullable)
- `cancellation_reason` (TEXT, nullable) - exists but needs expansion
- `notes` (TEXT, nullable) - JSON string for pass details
- `assigned_at`, `accepted_at`, `completed_at`, `cancelled_at` (timestamps)
- `created_at`, `updated_at` (timestamps)

**Order Passes Table (order_passes):**
- `id` (UUID, PK)
- `order_id` (UUID, FK to orders)
- `pass_type` (TEXT)
- `quantity` (INTEGER)
- `price` (NUMERIC(10,2))
- Created to support multiple pass types per order

**Ambassadors Table:**
- `id` (UUID, PK)
- `full_name` (TEXT)
- `phone` (TEXT, UNIQUE)
- `email` (TEXT, nullable)
- `city` (TEXT)
- `ville` (TEXT, nullable) - Added in migration
- `password` (TEXT)
- `status` (TEXT) - Current: 'pending' | 'approved' | 'rejected' | 'suspended'
- `commission_rate` (DECIMAL(5,2))
- `approved_by`, `approved_at`
- `created_at`, `updated_at`

**Supporting Tables:**
- `cities` - Reference data
- `villes` - Neighborhoods (linked to cities)
- ~~`round_robin_tracker`~~ - **REMOVE** (no longer needed - users select ambassador manually)
- `order_logs` - Audit trail for order changes

### 1.3 What Already Exists & Works

✅ **Keep:**
- Order creation infrastructure
- `order_passes` table (multi-pass support)
- Customer info fields (user_name, user_phone, user_email)
- City/ville structure
- Order logging system
- Admin order management UI (needs enhancement)
- Payment method column
- Payment status tracking (for online)
- Notes field (JSON storage for pass details)

🟡 **Keep but Refactor:**
- Status system (too complex, source-dependent)
- Ambassador status values (need ACTIVE/PAUSED/DISABLED)
- Order creation UI (needs unified customer form first)
- Payment method enum (needs 'external_app' option)
- Cancellation tracking (needs cancelled_by field)

❌ **Remove/Replace:**
- `CODOrder.tsx` page (legacy, unused)
- Source-dependent status validation (replace with unified)
- Old status values incompatible with new system
- Pass type column (use order_passes table only)

### 1.4 Issues & Inconsistencies Found

1. **Status Confusion:**
   - Current statuses vary by source (COD: PENDING_AMBASSADOR, ASSIGNED, ACCEPTED, COMPLETED, CANCELLED_BY_AMBASSADOR)
   - Online: PAID, FAILED, REFUNDED
   - Manual: MANUAL_ACCEPTED, MANUAL_COMPLETED
   - Need unified status system: PENDING_ONLINE, REDIRECTED, PENDING_CASH, PAID, CANCELLED

2. **Ambassador Status Mismatch:**
   - Current: 'pending', 'approved', 'rejected', 'suspended'
   - Required: 'ACTIVE', 'PAUSED', 'DISABLED'
   - Code filters by `status = 'approved'` - needs update to `status = 'ACTIVE'`

3. **Customer Field Inconsistency:**
   - Database uses: `user_name`, `user_phone`, `user_email`
   - Frontend sometimes uses: `customer_name`, `customerInfo.fullName`
   - Need consistency: Always use `user_name`, `user_phone`, `user_email` in DB
   - Frontend can use any naming, but must map correctly

4. **Payment Options Missing:**
   - No `payment_options` table exists
   - No external app configuration
   - No admin enable/disable per option
   - Payment method only supports 'cod' | 'online'

5. **Cancellation Tracking Incomplete:**
   - Has `cancellation_reason`
   - Missing: `cancelled_by` (admin_id | ambassador_id | 'system')
   - Has `cancelled_at` ✅

6. **No Timeout System:**
   - No configurable timeout for orders
   - No automatic cancellation logic

---

## 📌 2. KEEP / REMOVE DECISION TABLE

| Component | Decision | Reason | Notes |
|-----------|----------|--------|-------|
| **Orders Table** | ✅ Keep as-is | Core table, well-structured | Add new columns: cancelled_by, external_app_reference |
| **Order Passes Table** | ✅ Keep as-is | Perfect for multi-pass orders | No changes needed |
| **Ambassadors Table** | 🟡 Keep but refactor | Status values need change | Change status enum to ACTIVE/PAUSED/DISABLED |
| **Cities/Villes Tables** | ✅ Keep as-is | Reference data working well | No changes |
| **Round Robin Tracker** | ❌ Remove | No longer needed - users select ambassador manually | Delete table and all related code |
| **Order Logs Table** | ✅ Keep as-is | Audit trail essential | No changes |
| **PassPurchase.tsx** | 🟡 Keep but refactor | Main order page | Unify customer form, add 3 payment options |
| **CODOrder.tsx** | ❌ Remove | Legacy, unused, outdated | Delete file |
| **ambassador/Dashboard.tsx** | 🟡 Keep but refactor | Manual orders needed | Update status handling |
| **admin/Dashboard.tsx** | 🟡 Keep but refactor | Order management | Add payment options config, update status handling |
| **ambassadorOrders.ts** | 🟡 Keep but refactor | Utility functions | Update status checks |
| **ticketGenerationService.tsx** | ✅ Keep as-is | Works with new statuses | No changes |
| **assign_order_to_ambassador()** | ❌ Remove | Round-robin not needed | Delete function and API endpoint |
| **salesSettings.ts** | ✅ Keep as-is | Global sales toggle | Keep for overall enable/disable |
| **Status Constraints** | ❌ Remove | Source-dependent, too complex | Replace with unified status system |
| **Pass Type Column** | 🟡 Deprecate | Use order_passes table | Keep for backward compat, mark deprecated |

---

## 📌 3. ARCHITECTURE PROPOSAL

### 3.1 Folder Structure

```
src/
├── pages/
│   ├── PassPurchase.tsx          # Unified order creation (3 payment options)
│   ├── ambassador/
│   │   └── Dashboard.tsx         # Manual orders (keep)
│   └── admin/
│       └── Dashboard.tsx         # Order management + payment options config
├── components/
│   ├── orders/                   # NEW: Order-specific components
│   │   ├── CustomerInfoForm.tsx  # NEW: Unified customer info collection
│   │   ├── PaymentOptionSelector.tsx # NEW: 3-option selector
│   │   ├── AmbassadorSelector.tsx    # NEW: For ambassador payment
│   │   └── OrderSummary.tsx          # NEW: Review before submit
│   └── admin/                    # NEW: Admin-specific components
│       ├── AmbassadorSalesOverview.tsx  # NEW: Performance & analytics
│       ├── AmbassadorOrdersList.tsx      # NEW: COD orders list
│       └── AmbassadorSalesLogs.tsx       # NEW: Logs (Super Admin only)
├── lib/
│   ├── orders/                   # NEW: Order services
│   │   ├── orderService.ts       # NEW: Order creation, status updates
│   │   ├── paymentService.ts     # NEW: Payment option handling
│   │   └── cancellationService.ts # NEW: Cancellation logic
│   ├── ambassadors/              # NEW: Ambassador services
│   │   └── ambassadorService.ts  # NEW: Active ambassador queries
│   └── constants/
│       └── orderStatuses.ts      # NEW: Status enums & utilities
├── hooks/
│   ├── usePaymentOptions.ts      # NEW: Fetch enabled payment options
│   ├── useActiveAmbassadors.ts   # NEW: Fetch active ambassadors by city/ville
│   ├── useOrderCreation.ts       # NEW: Order creation logic
│   ├── useAmbassadorSales.ts     # NEW: Fetch ambassador sales data (orders, stats)
│   └── useAdminRole.ts           # NEW: Check admin role (for Super Admin features)
└── types/
    └── orders.ts                 # NEW: Order-related TypeScript types
```

### 3.2 Services vs Controllers

**Services (Business Logic):**
- `orderService.ts` - Order CRUD, status transitions
- `paymentService.ts` - Payment option validation, external app redirect
- `cancellationService.ts` - Cancellation with reason tracking
- `ambassadorService.ts` - Active ambassador queries, filtering
- `ambassadorSalesService.ts` - Ambassador sales analytics, performance metrics, statistics

**Controllers/API Routes (if needed):**
- ~~Keep existing `/api/assign-order`~~ **REMOVE** (round-robin not needed)
- Add `/api/payment-options` (GET) - Fetch enabled options
- Add `/api/orders/:id/cancel` (POST) - Cancel with reason
- Add `/api/ambassadors/active` (GET) - Fetch active ambassadors by city/ville

**Frontend Hooks (React):**
- `usePaymentOptions` - Fetches and caches enabled payment options
- `useActiveAmbassadors` - Fetches active ambassadors filtered by city/ville
- `useOrderCreation` - Handles order creation flow

### 3.3 Enums

**Order Status (Unified):**
```typescript
enum OrderStatus {
  PENDING_ONLINE = 'PENDING_ONLINE',     // Online payment pending
  REDIRECTED = 'REDIRECTED',              // External app payment
  PENDING_CASH = 'PENDING_CASH',          // Ambassador cash payment pending
  PAID = 'PAID',                          // Payment confirmed
  CANCELLED = 'CANCELLED'                 // Cancelled (with reason)
}
```

**Payment Method:**
```typescript
enum PaymentMethod {
  ONLINE = 'online',
  EXTERNAL_APP = 'external_app',
  AMBASSADOR_CASH = 'ambassador_cash'
}
```

**Payment Option Type:**
```typescript
enum PaymentOptionType {
  ONLINE = 'online',
  EXTERNAL_APP = 'external_app',
  AMBASSADOR_CASH = 'ambassador_cash'
}
```

**Ambassador Status:**
```typescript
enum AmbassadorStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  DISABLED = 'DISABLED',
  PENDING = 'PENDING',      // For applications
  REJECTED = 'REJECTED'     // For applications
}
```

**Cancelled By:**
```typescript
type CancelledBy = 'admin' | 'ambassador' | 'system';
```

### 3.4 Status Flow

**Order Lifecycle:**

1. **Creation:**
   - Customer info collected (mandatory)
   - Payment option selected (based on admin config)
   - Order created with initial status:
     - `ONLINE` → `PENDING_ONLINE`
     - `EXTERNAL_APP` → `REDIRECTED` (after redirect)
     - `AMBASSADOR_CASH` → `PENDING_CASH`

2. **Online Payment:**
   - Status: `PENDING_ONLINE`
   - Admin updates to `PAID` or `FAILED` (gateway integration later)
   - On `PAID`: Order complete, tickets generated

3. **External App Payment:**
   - Status: `REDIRECTED`
   - User redirected to external_link
   - Admin updates to `PAID` or `CANCELLED` manually
   - On `PAID`: Order complete, tickets generated

4. **Ambassador Cash Payment:**
   - Status: `PENDING_CASH`
   - User manually selects ambassador from active list (filtered by city/ville)
   - Order created with selected `ambassador_id`
   - Ambassador confirms payment → `PAID`
   - Ambassador cancels → `CANCELLED` (reason required)
   - On `PAID`: Order complete, tickets generated

5. **Cancellation:**
   - Can be triggered by: Admin, Ambassador, System (timeout)
   - Status: `CANCELLED`
   - Fields set: `cancelled_by`, `cancel_reason`, `cancelled_at`

---

## 📌 4. ORDER LIFECYCLE (TEXTUAL DESCRIPTION)

### 4.1 Order Creation

**Step 1: Customer Information (MANDATORY - Always First)**
- User must provide:
  - `full_name` (required)
  - `phone` (required, validated)
  - `email` (required, validated)
  - `city` (required)
  - `ville` (required if city supports it)
- Data saved to order immediately (before payment selection)
- Validation happens client-side and server-side

**Step 2: Pass Selection**
- User selects pass types and quantities
- Total price calculated
- Multiple passes supported via `order_passes` table

**Step 3: Payment Option Selection**
- Admin config determines available options
- User sees only enabled options:
  - Option A: Online Payment (if enabled)
  - Option B: External App Payment (if enabled)
  - Option C: Ambassador Cash Payment (if enabled)
- User selects one option

**Step 4: Option-Specific Flow**

**Option A - Online Payment:**
- Order created: `status: PENDING_ONLINE`, `payment_method: 'online'`
- Order saved to database
- Show confirmation message (no gateway redirect yet)
- Admin later updates status to `PAID` or `FAILED`

**Option B - External App Payment:**
- Order created: `status: PENDING_ONLINE` (temporary)
- Admin config provides: `app_name`, `external_link`, `app_image`
- User redirected to `external_link`
- Order updated: `status: REDIRECTED`, `payment_method: 'external_app'`
- Admin later updates status to `PAID` or `CANCELLED`

**Option C - Ambassador Cash Payment:**
- User sees list of active ambassadors (filtered by city + ville)
- User manually selects ambassador from the list
- User accepts rules (checkbox required)
- Order created: `status: PENDING_CASH`, `payment_method: 'ambassador_cash'`, `ambassador_id: selected_ambassador_id`
- `assigned_at` timestamp set on creation
- Order saved to database

### 4.2 Ambassador Selection (Option C Only)

- User selects ambassador **before** order creation
- Flow:
  1. User enters city (and ville if applicable)
  2. System fetches active ambassadors: `status = 'ACTIVE'`, `city = user.city`, `ville = user.ville` (if provided)
  3. User sees list of available ambassadors with their info (name, contact, etc.)
  4. User manually selects one ambassador from the list
  5. User accepts terms/rules (checkbox required)
  6. On order creation: `ambassador_id` is set to selected ambassador
  7. `assigned_at` timestamp set to `created_at`
- No automatic assignment - always manual user selection
- If no active ambassadors available for city/ville, show error and disable option

### 4.3 Payment Confirmation

**Online Payment:**
- Admin updates order status to `PAID` manually (gateway integration later)
- `payment_status` set to `PAID`
- Tickets generated automatically

**External App Payment:**
- Admin updates order status to `PAID` manually (after external confirmation)
- Tickets generated automatically

**Ambassador Cash Payment:**
- Ambassador confirms payment in their dashboard
- Order status updated to `PAID`
- `completed_at` timestamp set
- Tickets generated automatically
- Logged in `order_logs`

### 4.4 Cancellation

**By Admin:**
- Admin cancels order in dashboard
- Required: `cancel_reason` (text input)
- Fields set: `status: CANCELLED`, `cancelled_by: 'admin'`, `cancelled_at: NOW()`, `cancel_reason`
- Logged in `order_logs`

**By Ambassador:**
- Ambassador cancels order in their dashboard
- Required: `cancel_reason` (text input, mandatory)
- Fields set: `status: CANCELLED`, `cancelled_by: 'ambassador'`, `cancelled_at: NOW()`, `cancel_reason`
- Logged in `order_logs`

**By System (Timeout):**
- Configurable timeout (e.g., 24 hours for PENDING_CASH)
- System job checks for expired orders
- Fields set: `status: CANCELLED`, `cancelled_by: 'system'`, `cancelled_at: NOW()`, `cancel_reason: 'Order timeout - no payment confirmation'`
- Logged in `order_logs`

### 4.5 Admin Visibility

**Order List View:**
- All orders visible to admin
- Filterable by:
  - Status (PENDING_ONLINE, REDIRECTED, PENDING_CASH, PAID, CANCELLED)
  - Payment method (online, external_app, ambassador_cash)
  - Date range
  - City/ville
  - Ambassador (for cash orders)

**Order Detail View:**
- Full order information
- Customer details
- Pass breakdown (from `order_passes`)
- Payment information
- Status history (from `order_logs`)
- Actions:
  - Update status (for online/external app)
  - Cancel (with reason)
  - View tickets (if paid)
  - Resend confirmation email

**Payment Options Configuration:**
- Toggle each option: enable/disable
- For External App: Configure `app_name`, `external_link`, `app_image`
- Changes take effect immediately

**Ambassador Sales Tab (See Phase 6.0 for detailed structure):**
- Overview mini tab: Performance metrics & analytics (All Admins)
- COD Ambassador Orders mini tab: List of ambassador cash orders (All Admins)
- Logs mini tab: Order logs (Super Admin only)

---

## 📌 5. IMPLEMENTATION ROADMAP

### Phase 1: Database Schema Updates

**1.1 Create Payment Options Table**
```sql
CREATE TABLE payment_options (
  id UUID PRIMARY KEY,
  option_type TEXT NOT NULL CHECK (option_type IN ('online', 'external_app', 'ambassador_cash')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  app_name TEXT,  -- For external_app only
  external_link TEXT,  -- For external_app only
  app_image TEXT,  -- For external_app only
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```
- Insert default rows (all disabled initially)
- RLS policies (admin only for write, public read for enabled status)

**1.2 Update Ambassadors Table**
- Change status constraint to: `CHECK (status IN ('ACTIVE', 'PAUSED', 'DISABLED', 'PENDING', 'REJECTED'))`
- Migration to map existing:
  - 'approved' → 'ACTIVE'
  - 'suspended' → 'PAUSED'
  - 'rejected' → 'REJECTED' (keep)
  - 'pending' → 'PENDING' (keep)

**1.3 Update Orders Table**
- Add column: `cancelled_by` TEXT CHECK (cancelled_by IN ('admin', 'ambassador', 'system'))
- Rename/enhance: `cancellation_reason` (keep as-is, ensure NOT NULL when CANCELLED)
- Add column: `external_app_reference` TEXT (for external app transaction ID)
- Update status constraint to: `CHECK (status IN ('PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PAID', 'CANCELLED'))`
- Update payment_method constraint to: `CHECK (payment_method IN ('online', 'external_app', 'ambassador_cash'))`
- Migration to map existing statuses to new system

**1.4 Remove Round-Robin Infrastructure**
- Drop `round_robin_tracker` table: `DROP TABLE IF EXISTS round_robin_tracker CASCADE;`
- Drop `assign_order_to_ambassador()` function: `DROP FUNCTION IF EXISTS assign_order_to_ambassador(UUID, TEXT);`
- Remove related indexes if any

**1.5 Create Site Configuration for Timeout**
- Add to `site_content` table: `key: 'order_timeout_settings'`
- Value: `{"cash_payment_timeout_hours": 24}`

### Phase 2: Backend Services

**2.1 Payment Options Service**
- `fetchPaymentOptions()` - Get enabled options
- `updatePaymentOption(optionType, config)` - Admin update
- `isPaymentOptionEnabled(optionType)` - Check if enabled

**2.2 Order Service**
- `createOrder(orderData)` - Unified order creation
- `updateOrderStatus(orderId, status, metadata)` - Status updates
- `cancelOrder(orderId, cancelledBy, reason)` - Cancellation with tracking
- `getOrderById(orderId)` - Fetch with all relations

**2.3 Ambassador Service**
- `getActiveAmbassadorsByLocation(city, ville)` - Fetch active ambassadors for user selection (ACTIVE only)

**2.4 Cancellation Service**
- `cancelByAdmin(orderId, reason)`
- `cancelByAmbassador(orderId, ambassadorId, reason)`
- `cancelBySystem(orderId, reason)` - For timeout
- `checkTimeouts()` - Check and cancel expired orders

### Phase 3: API Endpoints

**3.1 Payment Options**
- `GET /api/payment-options` - Get enabled options (public)
- `GET /api/admin/payment-options` - Get all options (admin)
- `PUT /api/admin/payment-options/:type` - Update option config (admin)

**3.2 Orders**
- `POST /api/orders` - Create order (public, with validation)
- `GET /api/orders/:id` - Get order details (authenticated)
- `PUT /api/orders/:id/status` - Update status (admin/ambassador)
- `POST /api/orders/:id/cancel` - Cancel order (admin/ambassador/system)

**3.3 Ambassadors (Active) - NEW ENDPOINT**
- `GET /api/ambassadors/active?city=xxx&ville=xxx` - Get active ambassadors for user selection (public for order page)
- Returns only ambassadors with `status = 'ACTIVE'` filtered by city/ville
- Used by AmbassadorSelector component for manual user selection

**3.4 Ambassador Sales Analytics - NEW ENDPOINTS (Admin)**
- `GET /api/admin/ambassador-sales/overview` - Get performance metrics and analytics (admin)
- `GET /api/admin/ambassador-sales/orders` - Get COD ambassador orders with filters (admin)
- `GET /api/admin/ambassador-sales/logs` - Get order logs (super admin only)
- `GET /api/admin/ambassador-sales/stats` - Get aggregated statistics (admin)

### Phase 4: Frontend Components

**4.1 Customer Info Form Component**
- Unified form: full_name, phone, email, city, ville
- Validation (client-side)
- Reusable across all payment flows

**4.2 Payment Option Selector Component**
- Fetches enabled options from API
- Displays cards for each enabled option
- Shows app_name, app_image for external_app
- Handles selection state

**4.3 Ambassador Selector Component**
- Fetches active ambassadors by city/ville
- Displays list with ambassador info (name, contact details, etc.)
- User manually selects one ambassador (radio buttons or selection cards)
- Checkbox for rules acceptance (required)
- Disabled/empty state if no active ambassadors available

**4.4 Order Summary Component**
- Shows customer info
- Shows selected passes
- Shows total price
- Shows selected payment option
- Confirm button

### Phase 5: Frontend Pages

**5.1 Refactor PassPurchase.tsx**
- Step 1: Customer Info Form (mandatory first) - includes city/ville
- Step 2: Pass Selection (existing logic)
- Step 3: Payment Option Selection (new component)
- Step 4: Option-specific flow:
  - Online: Show confirmation
  - External App: Redirect
  - Ambassador: Fetch active ambassadors → User selects ambassador → Accept rules checkbox
- Step 5: Order Summary & Submit (includes selected ambassador for Option C)

**5.2 Update ambassador/Dashboard.tsx**
- Update status handling to new values
- Update cancellation to include reason
- Filter ambassadors by ACTIVE status

**5.3 Update admin/Dashboard.tsx**
- Add Payment Options Configuration section
- Update order list filters (new statuses)
- Update order detail view (new statuses, cancellation tracking)
- Add status update UI (for online/external app)
- Add cancellation UI (with reason input)
- **Restructure Ambassador Sales Tab** (see detailed structure below)

### Phase 6: Admin Controls

**6.0 Ambassador Sales Tab Structure (Admin Dashboard)**

The Ambassador Sales section in the admin dashboard will have a tabbed interface:

**Main Tab: "Ambassador Sales"**

**Mini Tab 1: Overview** (All Admins)
- **Performance Metrics:**
  - Total orders by ambassadors (all time, this month, this week)
  - Total revenue generated by ambassadors
  - Total commissions earned
  - Average order value
  - Orders per ambassador (average)
  - Top performing ambassadors (top 10)
- **Analytics:**
  - Orders over time (chart: daily/weekly/monthly)
  - Revenue trends (chart)
  - Ambassador performance comparison (bar chart)
  - City/ville distribution of orders
  - Status breakdown (PENDING_CASH, PAID, CANCELLED counts)
  - Payment method breakdown (ambassador_cash vs others)
  - Conversion rate (orders created → PAID)
  - Cancellation rate
  - Average time to payment confirmation

**Mini Tab 2: COD Ambassador Orders** (All Admins)
- List of all orders with `payment_method = 'ambassador_cash'`
- Filters:
  - Status (PENDING_CASH, PAID, CANCELLED)
  - Ambassador (dropdown)
  - City/Ville
  - Date range
  - Search by customer name/phone
- Columns:
  - Order ID
  - Customer Name
  - Customer Phone
  - City/Ville
  - Ambassador Name
  - Pass Details (from order_passes)
  - Total Price
  - Status
  - Created At
  - Paid At / Cancelled At
- Actions per order:
  - View details (modal/drawer)
  - Update status (if PENDING_CASH → PAID)
  - Cancel order (with reason)
  - View tickets (if PAID)
  - Contact customer/ambassador

**Mini Tab 3: Logs** (Super Admin Only)
- Access control: Only visible if `admin.role = 'super_admin'`
- Shows order_logs entries related to ambassador orders
- Filters:
  - Date range
  - Action type (assigned, accepted, completed, cancelled, etc.)
  - Ambassador
  - Order ID
- Columns:
  - Timestamp
  - Order ID
  - Action
  - Performed By (ambassador name or 'admin' or 'system')
  - Performed By Type
  - Details (JSON view)
- Export option: Download logs as CSV/JSON

**Implementation Notes:**
- Use tab component (Tabs/TabList/TabPanels)
- Overview tab: Use charts library (recharts, chart.js, etc.)
- COD Orders tab: Use DataTable component with pagination
- Logs tab: Conditional rendering based on admin role
- All tabs share same data fetching hooks but different views

**6.1 Payment Options Configuration UI**
- Toggle switches for each option (enable/disable)
- External App config form:
  - App name input
  - External link input (URL validation)
  - App image upload/URL
- Save button (updates payment_options table)
- Preview of enabled options

**6.2 Order Management Enhancements**
- Status update dropdown (context-aware)
- Cancellation modal (reason input required)
- Filter by new status values
- Filter by payment method
- View cancellation details (who, why, when)

### Phase 7: Edge Cases & Safety

**7.1 Ambassador Paused Mid-Order**
- Handle: If ambassador status changes to PAUSED/DISABLED
- Action: Reassign order to next active ambassador
- Log: Reassignment reason in order_logs

**7.2 No Active Ambassadors**
- Handle: User selects ambassador payment, but no active ambassadors for city/ville
- Action: Show error message, disable option or show "Coming soon"

**7.3 Payment Option Disabled Mid-Flow**
- Handle: Admin disables option while user is on order page
- Action: Re-fetch options on payment selection step, show error if selected option now disabled

**7.4 External App Disabled**
- Handle: External app disabled after order created but before redirect
- Action: Check before redirect, show error if disabled

**7.5 Order Timeout**
- Implementation: Background job (cron or Supabase function)
- Check: Orders with status PENDING_CASH older than timeout hours
- Action: Cancel with reason "Order timeout - no payment confirmation"

---

## 📌 6. RISK & EDGE CASES

### 6.1 Ambassador Status Changes

**Risk:** Ambassador paused/disabled while handling orders

**Mitigation:**
- Orders in PENDING_CASH status can be reassigned
- Add reassignment logic in admin dashboard
- Prevent new assignments to paused/disabled ambassadors
- Show warning if ambassador has active orders when pausing

**Implementation:**
- Query: Get orders with `status = 'PENDING_CASH'` and `ambassador_id = paused_ambassador_id`
- Action: Bulk reassign to next active ambassador
- Log: Reassignment reason

### 6.2 No Active Ambassadors

**Risk:** City/ville has no active ambassadors

**Mitigation:**
- Check before showing ambassador payment option
- If no active ambassadors: Hide option or show "Unavailable in your area"
- Admin alert: Show warning if enabling ambassador_cash but no active ambassadors exist

**Implementation:**
- Pre-check: When loading payment options, check active ambassador count per city
- Frontend: Conditionally show/hide ambassador option
- Admin: Validation when enabling ambassador_cash option

### 6.3 Partial Admin Enablement

**Risk:** Admin enables only 1-2 options, user expects all 3

**Mitigation:**
- UI clearly shows only enabled options
- No "placeholder" for disabled options
- Clear messaging: "Available payment methods"

**Implementation:**
- Fetch enabled options only
- Display only enabled options as selectable cards
- No disabled/grayed-out options shown

### 6.4 External App Disabled

**Risk:** External app disabled after order creation but before redirect

**Risk:** External app returns but order status inconsistent

**Mitigation:**
- Check option enabled status before redirect
- Store redirect timestamp in order notes
- Admin can manually update status if external app confirms payment

**Implementation:**
- Pre-redirect check: Verify option still enabled
- Store: `external_app_redirected_at` in notes or new column
- Admin UI: Manual status update for REDIRECTED orders

### 6.5 System Timeout

**Risk:** Orders stuck in PENDING_CASH indefinitely

**Mitigation:**
- Configurable timeout (default 24 hours)
- Background job checks expired orders
- Automatic cancellation with system reason
- Email notification to admin (optional)

**Implementation:**
- Supabase Edge Function (scheduled) or cron job
- Query: `SELECT * FROM orders WHERE status = 'PENDING_CASH' AND created_at < NOW() - INTERVAL '24 hours'`
- Action: Update status to CANCELLED, set cancelled_by='system', reason='Order timeout'
- Log: Cancellation action

### 6.6 Data Migration Risks

**Risk:** Existing orders with old status values

**Mitigation:**
- Comprehensive migration script
- Map all old statuses to new ones
- Test migration on staging first
- Backup before migration

**Migration Mapping:**
- `PENDING_AMBASSADOR` (COD) → `PENDING_CASH`
- `ASSIGNED` (COD) → `PENDING_CASH`
- `ACCEPTED` (COD) → `PENDING_CASH`
- `COMPLETED` (COD) → `PAID`
- `PAID` (Online) → `PAID`
- `PENDING_PAYMENT` (Online) → `PENDING_ONLINE`
- `CANCELLED_BY_AMBASSADOR` → `CANCELLED`
- `REFUNDED` → `CANCELLED` (with reason "Refunded")

### 6.7 Ambassador Filtering

**Risk:** Incorrect filtering (showing paused/disabled ambassadors)

**Mitigation:**
- Always filter by `status = 'ACTIVE'` in queries
- Add database constraint if possible
- Unit tests for filtering logic
- Code review focus on status checks

**Implementation:**
- All queries: `.eq('status', 'ACTIVE')`
- Frontend: Filter in `useActiveAmbassadors` hook
- Ambassador selector component: Only shows ACTIVE ambassadors

### 6.8 Payment Method Mismatch

**Risk:** Order created with wrong payment_method for selected option

**Mitigation:**
- Strict validation in order creation service
- Type-safe enums in TypeScript
- Database constraints
- Unit tests

**Implementation:**
- Service validation: `if (optionType === 'external_app') payment_method must be 'external_app'`
- TypeScript: Use enum for payment_method
- Database: CHECK constraint

---

## 📌 7. DATABASE SCHEMA CHANGES SUMMARY

### New Tables
1. **payment_options** - Admin-configurable payment options

### Tables to Modify
1. **orders**
   - Add: `cancelled_by` TEXT
   - Add: `external_app_reference` TEXT
   - Modify: `status` constraint (new values)
   - Modify: `payment_method` constraint (add 'external_app')
   - Keep: All existing columns

2. **ambassadors**
   - Modify: `status` constraint (ACTIVE/PAUSED/DISABLED)

3. **site_content**
   - Add: `order_timeout_settings` key

### Tables to Keep As-Is
- `order_passes` ✅
- `cities` ✅
- `villes` ✅
- `order_logs` ✅

### Tables to Remove
- `round_robin_tracker` ❌ (no longer needed - users select ambassador manually)
  - Migration: `DROP TABLE IF EXISTS round_robin_tracker CASCADE;`
  - Also drop related function: `DROP FUNCTION IF EXISTS assign_order_to_ambassador(UUID, TEXT);`
  - Migration: `DROP TABLE IF EXISTS round_robin_tracker CASCADE;`

---

## 📌 8. FILES TO CREATE/MODIFY/DELETE

### Create:
- `src/components/orders/CustomerInfoForm.tsx`
- `src/components/orders/PaymentOptionSelector.tsx`
- `src/components/orders/AmbassadorSelector.tsx`
- `src/components/orders/OrderSummary.tsx`
- `src/lib/orders/orderService.ts`
- `src/lib/orders/paymentService.ts`
- `src/lib/orders/cancellationService.ts`
- `src/lib/ambassadors/ambassadorService.ts`
- `src/lib/ambassadors/ambassadorSalesService.ts` (Analytics, performance metrics)
- `src/lib/constants/orderStatuses.ts`
- `src/hooks/usePaymentOptions.ts`
- `src/hooks/useActiveAmbassadors.ts`
- `src/hooks/useOrderCreation.ts`
- `src/hooks/useAmbassadorSales.ts` (Fetch sales data, stats, analytics)
- `src/hooks/useAdminRole.ts` (Check if super admin)
- `src/types/orders.ts`
- `supabase/migrations/XXXXXX-create-payment-options-table.sql`
- `supabase/migrations/XXXXXX-update-ambassador-status-enum.sql`
- `supabase/migrations/XXXXXX-update-orders-status-enum.sql`
- `supabase/migrations/XXXXXX-add-cancellation-tracking.sql`

### Modify:
- `src/pages/PassPurchase.tsx` (major refactor)
- `src/pages/ambassador/Dashboard.tsx` (status handling)
- `src/pages/admin/Dashboard.tsx` (add payment options config, update status handling)
- `src/lib/ambassadorOrders.ts` (status updates)
- `server.cjs` (add payment options endpoints, remove assign-order endpoint)

### Delete:
- `src/pages/CODOrder.tsx` ❌
- `server.cjs` - `/api/assign-order` endpoint ❌
- Database function: `assign_order_to_ambassador()` ❌
- `round_robin_tracker` table ❌ (via migration)

---

## 📌 9. VALIDATION RULES

### Customer Information (Always Required)
- `full_name`: Non-empty string, trimmed, max 255 chars
- `phone`: 8 digits, starts with 2/4/5/9, validated regex
- `email`: Valid email format, max 255 chars
- `city`: Non-empty, must exist in cities table
- `ville`: Required if city supports villes, must exist in villes table for that city

### Payment Option Selection
- At least one option must be enabled (admin validation)
- User must select exactly one option
- Selected option must be currently enabled (re-check on submit)

### Ambassador Selection (Option C only)
- At least one active ambassador must exist for city/ville
- User must accept rules (checkbox required)
- Ambassador must be ACTIVE status

### Order Creation
- Customer info must be validated and saved first
- At least one pass must be selected with quantity > 0
- Total price must be > 0
- Payment method must match selected option type
- Status must match payment method:
  - `online` → `PENDING_ONLINE`
  - `external_app` → `REDIRECTED`
  - `ambassador_cash` → `PENDING_CASH`

### Cancellation
- `cancel_reason` required (non-empty string, max 500 chars)
- `cancelled_by` required (admin | ambassador | system)
- Can only cancel if status allows (not already CANCELLED or PAID)

---

## 📌 10. TESTING CHECKLIST

### Unit Tests
- [ ] Customer info validation
- [ ] Payment option filtering (enabled only)
- [ ] Ambassador filtering (ACTIVE only)
- [ ] Status transitions (valid/invalid)
- [ ] Cancellation logic (all three types)
- [ ] Ambassador manual selection logic

### Integration Tests
- [ ] Order creation flow (all 3 options)
- [ ] Payment option enable/disable
- [ ] Ambassador assignment
- [ ] Status updates
- [ ] Cancellation flow

### E2E Tests
- [ ] Complete order flow (Option A)
- [ ] Complete order flow (Option B)
- [ ] Complete order flow (Option C)
- [ ] Admin payment options configuration
- [ ] Ambassador cancellation
- [ ] Admin cancellation
- [ ] System timeout cancellation

### Edge Case Tests
- [ ] No active ambassadors (hide option)
- [ ] Payment option disabled mid-flow
- [ ] Ambassador paused with active orders
- [ ] External app disabled after redirect
- [ ] Order timeout (24 hours)

---

## 📌 11. MIGRATION STRATEGY

### Pre-Migration
1. Backup database
2. Test migrations on staging
3. Document current status values
4. Create rollback scripts

### Migration Steps
1. Create `payment_options` table (no data loss)
2. Update `ambassadors.status` constraint (with data migration)
3. Update `orders.status` constraint (with data migration)
4. Add new columns to `orders` (nullable initially)
5. Update application code
6. Deploy application
7. Migrate existing data (status values)
8. Test thoroughly
9. Monitor for issues

### Rollback Plan
1. Revert application code
2. Revert database migrations (if safe)
3. Restore from backup if needed

---

## 📌 12. OPEN QUESTIONS & DECISIONS NEEDED

1. **Timeout Configuration:**
   - Should timeout be configurable per payment method or global?
   - **Recommendation:** Global for now, per-method later if needed

2. **External App Return URL:**
   - How does external app notify system of payment?
   - **Recommendation:** Manual admin update for now, webhook later

3. **Ambassador Selection:**
   - ~~Should user select ambassador or auto-assign?~~
   - **Decision:** User manually selects ambassador from active list (round-robin removed)

4. **Rules Acceptance:**
   - What rules need acceptance checkbox?
   - **Recommendation:** Terms of Service + Cancellation Policy

5. **Payment Gateway Integration:**
   - When to integrate actual gateway?
   - **Recommendation:** Phase 2 - after basic system works

6. **Order Passes Migration:**
   - Migrate existing orders to order_passes table?
   - **Recommendation:** Yes, backfill from pass_type/quantity

---

## 📌 13. SUMMARY

### What We Have ✅
- Solid order infrastructure
- Multi-pass support (order_passes)
- Customer data fields
- Payment method tracking
- Order logging
- City/ville structure for filtering

### What We Need ❌
- Payment options configuration table
- Unified status system
- Ambassador status update (ACTIVE/PAUSED/DISABLED)
- Cancellation tracking (cancelled_by)
- External app payment support
- Unified customer form (before payment selection)
- Payment option selector component

### What We Must Remove ❌
- Legacy CODOrder.tsx page
- Round-robin assignment logic (users select ambassador manually)
- `round_robin_tracker` table
- `assign_order_to_ambassador()` database function
- `/api/assign-order` API endpoint
- Source-dependent status validation
- Old status values
- Ambassador status 'approved' (use ACTIVE)

### Implementation Complexity
- **Database:** Medium (3-4 migrations)
- **Backend:** Medium (new services, update existing)
- **Frontend:** High (major refactor of PassPurchase.tsx)
- **Testing:** High (many edge cases)
- **Migration:** Medium (data migration required)

### Estimated Effort
- **Phase 1 (Database):** 2-3 days
- **Phase 2-3 (Backend/API):** 3-4 days
- **Phase 4-5 (Frontend):** 5-7 days
- **Phase 6 (Admin):** 2-3 days
- **Phase 7 (Edge Cases):** 2-3 days
- **Testing:** 3-4 days
- **Total:** ~3-4 weeks

---

## 🚫 STRICT CONSTRAINT REMINDER

**NO CODE CHANGES HAVE BEEN MADE.**

This document is ANALYSIS & PLANNING ONLY.

Wait for approval before proceeding with implementation.

---

**END OF ANALYSIS DOCUMENT**

