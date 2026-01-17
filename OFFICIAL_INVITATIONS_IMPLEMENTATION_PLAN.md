# Official Invitations Implementation Plan

## Overview
Build a new "Official Invitations" tab in the admin dashboard (super admin only) that allows creating invitation orders with multiple QR codes. Each QR code will be stored in the `qr_tickets` table and can be scanned like regular tickets.

---

## 1. Database Changes

### 1.1 Update `orders` Table
**File:** `supabase/migrations/YYYYMMDDHHMMSS-add-official-invitation-source.sql`

**Changes:**
- Add `'official_invitation'` to the `source` CHECK constraint in `orders` table
- Current values: `('platform_cod', 'platform_online', 'ambassador_manual')`
- New values: `('platform_cod', 'platform_online', 'ambassador_manual', 'official_invitation')`

**SQL:**
```sql
-- Update orders table to allow official_invitation source
ALTER TABLE public.orders 
  DROP CONSTRAINT IF EXISTS orders_source_check;

ALTER TABLE public.orders 
  ADD CONSTRAINT orders_source_check 
  CHECK (source IN ('platform_cod', 'platform_online', 'ambassador_manual', 'official_invitation'));
```

### 1.2 Update `qr_tickets` Table
**File:** Same migration file

**Changes:**
- Add `'official_invitation'` to the `source` CHECK constraint in `qr_tickets` table
- Current values: `('platform_online', 'platform_cod', 'ambassador_manual')`
- New values: `('platform_online', 'platform_cod', 'ambassador_manual', 'official_invitation')`

**SQL:**
```sql
-- Update qr_tickets table to allow official_invitation source
ALTER TABLE public.qr_tickets 
  DROP CONSTRAINT IF EXISTS qr_tickets_source_check;

ALTER TABLE public.qr_tickets 
  ADD CONSTRAINT qr_tickets_source_check 
  CHECK (source IN ('platform_online', 'platform_cod', 'ambassador_manual', 'official_invitation'));
```

### 1.3 No New Tables Needed
- We'll reuse the existing `orders`, `order_passes`, `tickets`, and `qr_tickets` tables
- The invitation number will be the `order_number` (6-digit random number, same as regular orders)

---

## 2. Frontend Components

### 2.1 New Tab in Admin Dashboard
**Location:** `src/pages/admin/Dashboard.tsx`

**Changes:**
1. Add new `TabsTrigger` with value `"official-invitations"` (only visible if `currentAdminRole === 'super_admin'`)
2. Add corresponding `TabsContent` for official invitations management
3. Add tab protection logic (redirect if not super admin)

**Tab Structure:**
```typescript
{currentAdminRole === 'super_admin' && (
  <TabsTrigger value="official-invitations">
    Official Invitations
  </TabsTrigger>
)}
```

### 2.2 Create Invitation Form Component
**Location:** `src/components/admin/OfficialInvitationForm.tsx` (new file)

**Form Fields:**
1. **Guest Name** (required, text input)
2. **Guest Phone Number** (required, phone input with validation)
3. **Event Selection** (required, dropdown)
   - Fetch only upcoming events (`event_type = 'upcoming'` AND `date >= NOW()`)
   - Display: Event name + date
   - On selection: Auto-load event details (name, date, venue, city, passes)
4. **Pass Type Selection** (required, dropdown)
   - Populated from selected event's `event_passes`
   - Display: Pass name + price
   - Show pass description
5. **Number of QR Codes** (required, number input)
   - Min: 1, Max: 100 (or configurable)
   - This determines how many QR codes to generate

**Form Validation:**
- All fields required
- Phone number format validation
- Event must be upcoming
- Pass type must belong to selected event
- Quantity must be positive integer

**Form Actions:**
- "Create Invitation" button
- Loading state during creation
- Success/error toast notifications

### 2.3 Invitations List Component
**Location:** `src/components/admin/OfficialInvitationsList.tsx` (new file)

**Features:**
- Table showing all official invitation orders
- Columns:
  - Order Number (invitation number)
  - Guest Name
  - Guest Phone
  - Event Name
  - Pass Type
  - Quantity (number of QR codes)
  - Status (order status)
  - Created Date
  - Actions (View Details, Resend Email, Delete)
- Filters:
  - By event
  - By status
  - By date range
- Search: By guest name or phone number
- Pagination

### 2.4 Invitation Details Modal
**Location:** `src/components/admin/OfficialInvitationDetails.tsx` (new file)

**Displays:**
- Order information (order number, guest details)
- Event information
- Pass type details
- List of all QR codes (with images)
- QR code scan status (VALID, USED, etc.)
- Email delivery status
- Actions: Resend email, Download QR codes, View scan history

---

## 3. Backend API Endpoints

### 3.1 Create Official Invitation Order
**Endpoint:** `POST /api/admin/official-invitations/create`

**Location:** `server.cjs` or `api/admin-create-official-invitation.js`

**Request Body:**
```json
{
  "guest_name": "John Doe",
  "guest_phone": "+21612345678",
  "event_id": "uuid-here",
  "pass_type": "VIP",
  "quantity": 3
}
```

**Authentication:**
- Verify admin is authenticated
- Verify admin role is `'super_admin'`
- Return 403 if not super admin

**Process:**
1. Validate input (all fields required, phone format, event exists, pass type valid)
2. Fetch event details and pass information
3. Calculate total price: `pass_price * quantity`
4. Create order in `orders` table:
   - `source`: `'official_invitation'`
   - `customer_name`: guest_name
   - `phone`: guest_phone
   - `email`: null (or optional email field)
   - `city`: event.city (or "N/A")
   - `event_id`: event_id
   - `payment_method`: `'external_app'` (or new type `'official_invitation'`)
   - `status`: `'PAID'` (immediately paid, no payment needed)
   - `total_price`: calculated price
   - `order_number`: auto-generated (6-digit random)
5. Create `order_pass` entry:
   - `order_id`: new order id
   - `pass_type`: selected pass type name
   - `quantity`: quantity
   - `price`: pass price per unit
6. Generate tickets and QR codes:
   - For each quantity (1 to N):
     - Create `ticket` entry with unique `secure_token`
     - Generate QR code image
     - Upload to Supabase Storage
     - Create `qr_tickets` entry with:
       - `secure_token`: from ticket
       - `ticket_status`: `'VALID'`
       - `source`: `'official_invitation'`
       - `buyer_name`: guest_name
       - `buyer_phone`: guest_phone
       - All event and pass details
7. Send email with all QR codes:
   - Use the email template we created (`official-invitation-email-preview.html`)
   - Include all QR codes in the email
   - Use order_number as invitation number
8. Return response:
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "order_number": 123456,
    "guest_name": "John Doe",
    "event": {...},
    "tickets": [...]
  }
}
```

### 3.2 Get Official Invitations List
**Endpoint:** `GET /api/admin/official-invitations`

**Query Parameters:**
- `event_id` (optional): Filter by event
- `status` (optional): Filter by order status
- `search` (optional): Search by guest name or phone
- `limit` (optional): Pagination limit
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [...orders],
  "count": 100
}
```

### 3.3 Get Single Invitation Details
**Endpoint:** `GET /api/admin/official-invitations/:orderId`

**Response:**
```json
{
  "success": true,
  "order": {...},
  "tickets": [...],
  "qr_tickets": [...]
}
```

### 3.4 Resend Invitation Email
**Endpoint:** `POST /api/admin/official-invitations/:orderId/resend`

**Process:**
1. Fetch order and all tickets
2. Regenerate email with all QR codes
3. Send email
4. Update email delivery status

### 3.5 Delete/Cancel Invitation
**Endpoint:** `DELETE /api/admin/official-invitations/:orderId`

**Process:**
1. Mark order as cancelled
2. Optionally invalidate all QR codes (set status to 'INVALID' in qr_tickets)
3. Return success

---

## 4. Email Template Integration

### 4.1 Create Email Template Function
**Location:** `src/lib/email.ts`

**Function:** `createOfficialInvitationEmail(invitationData)`

**Parameters:**
```typescript
interface OfficialInvitationData {
  guestName: string;
  guestPhone: string;
  event: {
    name: string;
    date: string;
    venue: string;
    city: string;
  };
  passType: string;
  orderNumber: number;
  qrCodes: Array<{
    secure_token: string;
    qr_code_url: string;
  }>;
  zoneName?: string;
  zoneDescription?: string;
}
```

**Template:**
- Use the HTML template from `official-invitation-email-preview.html`
- Replace placeholders with actual data
- Include all QR codes (if multiple, show all in email)
- Use order_number as invitation number

**Email Sending:**
- Use existing `sendEmail` or `sendEmailWithDetails` function
- To: guest_phone (SMS) or email if provided
- Subject: "Official Invitation – Andiamo Events"

---

## 5. QR Code Generation

### 5.1 Reuse Existing Ticket Generation Logic
**Location:** `src/lib/ticketGenerationService.tsx`

**Process:**
- Use existing `generateTicketsForOrder` function or create similar
- For each quantity:
  1. Generate unique `secure_token` (UUID v4)
  2. Create `ticket` entry
  3. Generate QR code image using `qrcode` package
  4. Upload to Supabase Storage (`tickets/` bucket)
  5. Create `qr_tickets` entry with all context

**QR Code Data Format:**
- Encode `secure_token` in QR code
- Or encode URL: `https://andiamoevents.com/validate-ticket?token={secure_token}`

### 5.2 QR Code Storage
- Bucket: `tickets` (existing)
- Path: `invitations/{order_id}/{ticket_id}.png`
- Public URL stored in `tickets.qr_code_url` and `qr_tickets.qr_code_url`

---

## 6. QR Code Scanning Integration

### 6.1 Reuse Existing Scanning System
**Location:** Existing scanning endpoint/component

**Process:**
- QR codes from official invitations are stored in `qr_tickets` table
- Use existing scanning logic that queries `qr_tickets` by `secure_token`
- Status checking:
  - `VALID`: Can be scanned
  - `USED`: Already scanned
  - `INVALID`: Invalid ticket
  - `WRONG_EVENT`: Scanned at wrong event
  - `EXPIRED`: Past event date

**No Changes Needed:**
- Existing scanning system should work automatically
- QR codes are stored the same way as regular tickets

---

## 7. Implementation Steps

### Phase 1: Database Setup
1. ✅ Create migration file to add `'official_invitation'` to `orders.source` CHECK constraint
2. ✅ Create migration file to add `'official_invitation'` to `qr_tickets.source` CHECK constraint
3. ✅ Test migration on development database

### Phase 2: Backend API
1. ✅ Create `POST /api/admin/official-invitations/create` endpoint
   - Verify super admin authentication
   - Create order with source `'official_invitation'`
   - Generate multiple tickets and QR codes
   - Create qr_tickets entries
   - Send email
2. ✅ Create `GET /api/admin/official-invitations` endpoint (list)
3. ✅ Create `GET /api/admin/official-invitations/:orderId` endpoint (details)
4. ✅ Create `POST /api/admin/official-invitations/:orderId/resend` endpoint
5. ✅ Create `DELETE /api/admin/official-invitations/:orderId` endpoint

### Phase 3: Email Template
1. ✅ Create `createOfficialInvitationEmail()` function in `src/lib/email.ts`
2. ✅ Use HTML template from `official-invitation-email-preview.html`
3. ✅ Support multiple QR codes in email
4. ✅ Test email rendering

### Phase 4: Frontend Components
1. ✅ Add "Official Invitations" tab to admin dashboard (super admin only)
2. ✅ Create `OfficialInvitationForm.tsx` component
3. ✅ Create `OfficialInvitationsList.tsx` component
4. ✅ Create `OfficialInvitationDetails.tsx` component
5. ✅ Integrate with API endpoints
6. ✅ Add filters and search
7. ✅ Add loading states and error handling

### Phase 5: Testing
1. ✅ Test invitation creation with single QR code
2. ✅ Test invitation creation with multiple QR codes
3. ✅ Test email delivery
4. ✅ Test QR code generation and storage
5. ✅ Test QR code scanning (should work with existing scanner)
6. ✅ Test permissions (non-super admin access blocked)
7. ✅ Test resend functionality
8. ✅ Test deletion/cancellation

---

## 8. Key Design Decisions

### 8.1 Order Number as Invitation Number
- **Decision:** Use `order_number` (6-digit random) as invitation number
- **Rationale:** Consistent with existing order system, no need for separate numbering system
- **Display:** Show as "Invitation #123456" in email and UI

### 8.2 Multiple QR Codes per Invitation
- **Decision:** Create one QR code per quantity, all linked to same order
- **Rationale:** Each person needs their own QR code for scanning
- **Storage:** Each QR code is a separate entry in `tickets` and `qr_tickets` tables

### 8.3 QR Code Status
- **Decision:** Use existing `ticket_status` in `qr_tickets` table
- **Values:** `VALID`, `USED`, `INVALID`, `WRONG_EVENT`, `EXPIRED`
- **Rationale:** Reuse existing scanning infrastructure

### 8.4 Payment Method
- **Decision:** Use `payment_method: 'external_app'` or create new `'official_invitation'`
- **Alternative:** Add `'official_invitation'` to payment_method CHECK constraint
- **Rationale:** Invitations are free, no payment needed

### 8.5 Order Status
- **Decision:** Set status to `'PAID'` immediately upon creation
- **Rationale:** No payment needed, tickets should be generated immediately

---

## 9. API Routes

**Location:** `src/lib/api-routes.ts`

**Add:**
```typescript
export const API_ROUTES = {
  // ... existing routes
  
  // Official Invitations (Super Admin Only)
  CREATE_OFFICIAL_INVITATION: '/api/admin/official-invitations/create',
  GET_OFFICIAL_INVITATIONS: '/api/admin/official-invitations',
  GET_OFFICIAL_INVITATION: (orderId: string) => `/api/admin/official-invitations/${orderId}`,
  RESEND_INVITATION_EMAIL: (orderId: string) => `/api/admin/official-invitations/${orderId}/resend`,
  DELETE_OFFICIAL_INVITATION: (orderId: string) => `/api/admin/official-invitations/${orderId}`,
};
```

---

## 10. Files to Create/Modify

### New Files:
1. `supabase/migrations/YYYYMMDDHHMMSS-add-official-invitation-source.sql`
2. `src/components/admin/OfficialInvitationForm.tsx`
3. `src/components/admin/OfficialInvitationsList.tsx`
4. `src/components/admin/OfficialInvitationDetails.tsx`
5. `api/admin-create-official-invitation.js` (or add to `server.cjs`)

### Modified Files:
1. `src/pages/admin/Dashboard.tsx` - Add new tab
2. `src/lib/email.ts` - Add `createOfficialInvitationEmail()` function
3. `src/lib/api-routes.ts` - Add new API routes
4. `src/lib/ticketGenerationService.tsx` - May need to support official invitations
5. `server.cjs` - Add new endpoints (or create separate API file)

---

## 11. Summary

**What We're Building:**
- ✅ New super admin-only tab for official invitations
- ✅ Form to create invitations (guest name, phone, event, pass type, quantity)
- ✅ Automatic order creation with `source: 'official_invitation'`
- ✅ Multiple QR code generation (one per quantity)
- ✅ Each QR code stored in `qr_tickets` table (scannable)
- ✅ Email with all QR codes using our template
- ✅ Invitation number = order number (6-digit random)
- ✅ Full integration with existing scanning system

**Key Benefits:**
- Reuses existing order and ticket infrastructure
- QR codes work with existing scanner
- Consistent numbering system
- No duplicate data structures

**Estimated Complexity:** Medium-High
**Estimated Time:** 3-4 days for full implementation
