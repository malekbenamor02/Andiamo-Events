# Ambassador Orders Flow - Complete Documentation (A to Z)

## Overview

This document provides a comprehensive explanation of the ambassador orders flow in the Andiamo Events system, covering all steps from order creation to final delivery, including SMS and email notifications, ambassador confirmation, and admin approval.

---

## Table of Contents

1. [Order Creation](#1-order-creation)
2. [Initial Order Status: PENDING_CASH](#2-initial-order-status-pending_cash)
3. [Ambassador Confirms Cash Payment](#3-ambassador-confirms-cash-payment)
4. [Order Status: PENDING_ADMIN_APPROVAL](#4-order-status-pending_admin_approval)
5. [Admin Approval Process](#5-admin-approval-process)
6. [Order Status: PAID](#6-order-status-paid)
7. [Ticket Generation](#7-ticket-generation)
8. [Email Notifications](#8-email-notifications)
9. [SMS Notifications](#9-sms-notifications)
10. [Order Completion](#10-order-completion)
11. [Order Rejection Flow](#11-order-rejection-flow)
12. [Database Schema](#12-database-schema)
13. [API Endpoints](#13-api-endpoints)
14. [Status Flow Diagram](#14-status-flow-diagram)

---

## 1. Order Creation

### When It Happens
An ambassador creates a new order through the ambassador dashboard when a customer wants to purchase passes using cash payment.

### Process Details

**Location:** `src/pages/ambassador/Dashboard.tsx` (Order creation UI)

**Order Data Structure:**
```typescript
{
  source: 'ambassador_manual',           // All COD orders use this source
  user_name: string,                    // Customer full name
  user_phone: string,                    // Customer phone (8 digits, starts with 2, 4, 5, or 9)
  user_email: string | null,             // Customer email (optional but recommended)
  city: string,                         // Customer city (must be 'Sousse' for COD)
  ville: string | null,                  // Neighborhood (required if city = 'Sousse')
  event_id: string | null,               // Associated event ID
  ambassador_id: string,                 // Ambassador who created the order (REQUIRED)
  pass_type: string,                     // Primary pass type (or 'mixed' if multiple)
  quantity: number,                      // Total quantity of passes
  total_price: number,                   // Total order amount in TND
  payment_method: 'ambassador_cash',     // Payment method (was 'cod' in legacy)
  status: 'PENDING_CASH',                // Initial status
  assigned_at: timestamp,                // Set to current time
  notes: JSON string                     // Contains detailed pass breakdown
}
```

**Order Passes Table (`order_passes`):**
Each pass type in the order is stored separately:
```typescript
{
  order_id: string,
  pass_type: string,                     // e.g., 'VIP', 'Standard', 'Premium'
  quantity: number,
  price: number                          // Price per pass
}
```

**Notes Field Structure:**
```json
{
  "all_passes": [
    {
      "passId": "pass-uuid",
      "passName": "VIP",
      "quantity": 2,
      "price": 50
    }
  ],
  "total_order_price": 100,
  "pass_count": 1
}
```

### Validation Rules
- City must be 'Sousse' for COD orders
- Ville (neighborhood) is required if city is 'Sousse'
- Ambassador ID is mandatory
- Phone number must be 8 digits, starting with 2, 4, 5, or 9
- Total price must be > 0
- Quantity must be > 0

### Database Insert
**Table:** `orders`
**Related Tables:** `order_passes` (one row per pass type)

---

## 2. Initial Order Status: PENDING_CASH

### Status Meaning
The order has been created by the ambassador but the cash payment has not yet been confirmed. The ambassador is waiting to receive cash from the customer.

### What Happens at This Stage
1. Order appears in ambassador's "New Orders" tab
2. Ambassador can see order details:
   - Customer name, phone, email
   - Pass types and quantities
   - Total amount
   - Order creation timestamp
3. Ambassador can:
   - **Confirm Cash** - When customer pays cash
   - **Cancel Order** - If customer cancels

### Ambassador Dashboard Display
**Location:** `src/pages/ambassador/Dashboard.tsx`

**Query:**
```typescript
// Fetch new orders (PENDING_CASH status)
const { data: newOrdersData } = await supabase
  .from('orders')
  .select('*, order_passes (*)')
  .eq('ambassador_id', ambassadorId)
  .eq('status', 'PENDING_CASH')
  .order('created_at', { ascending: false });
```

**UI Elements:**
- Badge: "Pending Cash" (yellow)
- Action Button: "Confirm Cash Payment"
- Action Button: "Cancel Order"

### No Notifications Yet
- ❌ No SMS sent to customer
- ❌ No SMS sent to ambassador
- ❌ No email sent
- ❌ No tickets generated

---

## 3. Ambassador Confirms Cash Payment

### When It Happens
The ambassador receives cash payment from the customer and clicks "Confirm Cash Payment" in their dashboard.

### Process Details

**Location:** `src/pages/ambassador/Dashboard.tsx` → `handleConfirmCash()`

**Action:**
```typescript
// Update order status
await supabase
  .from('orders')
  .update({
    status: 'PENDING_ADMIN_APPROVAL',
    updated_at: new Date().toISOString()
  })
  .eq('id', orderId);
```

**Order Log Entry:**
```typescript
await supabase.from('order_logs').insert({
  order_id: orderId,
  action: 'status_changed',
  performed_by: ambassador.id,
  performed_by_type: 'ambassador',
  details: {
    from_status: 'PENDING_CASH',
    to_status: 'PENDING_ADMIN_APPROVAL'
  }
});
```

### Status Transition
- **From:** `PENDING_CASH`
- **To:** `PENDING_ADMIN_APPROVAL`

### What Happens
1. Order status updated in database
2. Order moved from "New Orders" to "History" tab in ambassador dashboard
3. Order appears in admin dashboard for approval
4. Order log entry created for audit trail

### User Feedback
**Toast Notification:**
- English: "Cash payment confirmed. Waiting for admin approval before tickets are sent."
- French: "Paiement en espèces confirmé. En attente de l'approbation de l'administrateur avant l'envoi des billets."

### Still No Notifications
- ❌ No SMS sent yet
- ❌ No email sent yet
- ❌ No tickets generated yet

---

## 4. Order Status: PENDING_ADMIN_APPROVAL

### Status Meaning
The ambassador has confirmed receiving cash payment. The order is now waiting for admin review and approval before tickets are generated and sent to the customer.

### What Happens at This Stage

**Admin Dashboard:**
**Location:** `src/pages/admin/Dashboard.tsx`

**Query:**
```typescript
// Fetch orders pending admin approval
const { data: pendingOrders } = await supabase
  .from('orders')
  .select('*, order_passes (*), ambassadors (*)')
  .eq('status', 'PENDING_ADMIN_APPROVAL')
  .order('created_at', { ascending: false });
```

**Admin Can:**
1. **Approve Order** - Approve and generate tickets
2. **Reject Order** - Reject with reason (no tickets generated)

**Order Details Shown:**
- Customer information (name, phone, email)
- Ambassador information (name, phone)
- Pass breakdown (types, quantities, prices)
- Total amount
- Order creation timestamp
- Ambassador confirmation timestamp

### Validation Before Approval
- Order must have status `PENDING_ADMIN_APPROVAL`
- Order must have `ambassador_id`
- Order must have valid customer information
- Order must have `order_passes` entries

---

## 5. Admin Approval Process

### When It Happens
Admin reviews the order and clicks "Approve Order" in the admin dashboard.

### Process Details

**Location:** `src/pages/admin/Dashboard.tsx` → `handleApproveCodAmbassadorOrder()`

**Step 1: Update Order Status**
```typescript
// Update order to PAID status
await supabase
  .from('orders')
  .update({
    status: 'PAID',
    approved_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
  .eq('id', orderId);
```

**Step 2: Generate Tickets**
**API Endpoint:** `POST /api/generate-tickets-for-order`
**Location:** `server.cjs` → `generateTicketsAndSendEmail()`

**Process:**
1. Verify order is in `PAID` status
2. Check if tickets already exist (prevent duplicates)
3. Fetch order with all related data:
   - Order details
   - Order passes
   - Event information
   - Ambassador information
4. Generate QR codes for each pass
5. Create ticket records in `tickets` table
6. Generate QR access token (single URL for all QR codes)

**Ticket Generation:**
```typescript
// For each pass in order_passes
for (const pass of orderPasses) {
  for (let i = 0; i < pass.quantity; i++) {
    // Generate unique ticket
    const ticket = {
      order_id: orderId,
      pass_type: pass.pass_type,
      qr_code: generateQRCode(...),
      ticket_number: generateTicketNumber(),
      status: 'active'
    };
    // Insert into tickets table
  }
}
```

**Step 3: Send Email (if customer email exists)**
- See [Email Notifications](#8-email-notifications) section

**Step 4: Send SMS**
- See [SMS Notifications](#9-sms-notifications) section

**Step 5: Log Approval**
```typescript
await supabase.from('order_logs').insert({
  order_id: orderId,
  action: 'approved',
  performed_by: null,  // Admin (no specific admin ID tracked)
  performed_by_type: 'admin',
  details: {
    old_status: 'PENDING_ADMIN_APPROVAL',
    new_status: 'PAID',
    tickets_generated: true,
    email_sent: true/false,
    sms_sent: true/false,
    admin_action: true
  }
});
```

### Status Transition
- **From:** `PENDING_ADMIN_APPROVAL`
- **To:** `PAID`

### What Happens
1. ✅ Order status updated to `PAID`
2. ✅ Tickets generated (QR codes created)
3. ✅ Email sent to customer (if email exists)
4. ✅ SMS sent to customer (if phone exists)
5. ✅ Order log entry created
6. ✅ Order appears in "Paid Orders" in admin dashboard
7. ✅ Order appears in "History" in ambassador dashboard

---

## 6. Order Status: PAID

### Status Meaning
The order has been approved by admin, tickets have been generated, and notifications have been sent. The order is complete from a payment perspective.

### What Happens at This Stage
- Order is considered fully paid
- Tickets are active and can be used at the event
- Customer has received confirmation (email/SMS)
- Ambassador commission is calculated (if applicable)

### Order Visibility
- **Admin Dashboard:** Shows in "Paid Orders" section
- **Ambassador Dashboard:** Shows in "History" tab
- **Customer:** Has received tickets via email/SMS

---

## 7. Ticket Generation

### Process Details

**API Endpoint:** `POST /api/generate-tickets-for-order`
**Location:** `server.cjs` (line ~6227)
**Helper Function:** `generateTicketsAndSendEmail()` (in `server.cjs`)

### Step-by-Step Process

**1. Validation**
- Verify order exists
- Verify order status is `PAID`
- Check if tickets already exist (prevent duplicates)
- Verify order has customer email or phone

**2. Fetch Order Data**
```typescript
const { data: order } = await supabase
  .from('orders')
  .select(`
    *,
    order_passes (*),
    events (*),
    ambassadors (*)
  `)
  .eq('id', orderId)
  .single();
```

**3. Generate QR Codes**
- One QR code per ticket
- QR code contains: order ID, ticket number, pass type
- QR codes stored in `tickets` table

**4. Generate QR Access Token**
- Single-use token for accessing all QR codes
- URL format: `/api/qr-codes/{token}`
- Stored in `orders.qr_access_token`

**5. Create Ticket Records**
```typescript
// For each pass type and quantity
for (const pass of orderPasses) {
  for (let i = 0; i < pass.quantity; i++) {
    const ticket = {
      order_id: orderId,
      pass_type: pass.pass_type,
      qr_code: qrCodeData,
      ticket_number: generateUniqueTicketNumber(),
      status: 'active',
      created_at: new Date().toISOString()
    };
    await supabase.from('tickets').insert(ticket);
  }
}
```

**6. Update Order**
```typescript
await supabase
  .from('orders')
  .update({
    qr_access_token: generatedToken,
    tickets_generated_at: new Date().toISOString()
  })
  .eq('id', orderId);
```

### Ticket Data Structure
```typescript
{
  id: string,                    // UUID
  order_id: string,             // Reference to order
  pass_type: string,            // e.g., 'VIP', 'Standard'
  qr_code: string,             // QR code data/URL
  ticket_number: string,        // Unique ticket number
  status: 'active' | 'used' | 'cancelled',
  validated_at: timestamp | null,
  created_at: timestamp
}
```

---

## 8. Email Notifications

### When Email is Sent
Email is sent automatically when:
1. Admin approves order (status changes to `PAID`)
2. Tickets are successfully generated
3. Customer has a valid email address

### Email Sending Process

**API Endpoint:** `POST /api/send-order-completion-email`
**Location:** `server.cjs` (line ~4210)
**Also Called From:** `generateTicketsAndSendEmail()` helper function

### Email Content

**Subject:** `✅ Order Confirmation - Your Pass Purchase is Complete!`

**Email Includes:**
1. **Header:** "✅ Order Confirmed! Your Pass Purchase is Complete"
2. **Order Details:**
   - Order ID
   - Event name
   - Ambassador name (who delivered)
3. **Passes Purchased Table:**
   - Pass type
   - Quantity
   - Price per pass
   - Total amount
4. **QR Codes:**
   - Single QR code image (if available)
   - QR code access URL (shows all QR codes)
5. **Payment Confirmation:**
   - Amount paid
   - Payment method (cash via ambassador)
   - Confirmation message
6. **Support Information:**
   - Contact support link
   - Help text

### Email Delivery Logging

**Table:** `email_delivery_logs`

**Log Entry:**
```typescript
{
  order_id: string,
  email_type: 'order_completion',
  recipient_email: string,
  recipient_name: string,
  subject: string,
  status: 'pending' | 'sent' | 'failed',
  sent_at: timestamp | null,
  error_message: string | null
}
```

**Process:**
1. Create log entry with status `pending`
2. Send email via SMTP (using `transporter.sendMail()`)
3. Update log entry:
   - If success: `status = 'sent'`, `sent_at = now()`
   - If failure: `status = 'failed'`, `error_message = error details`

### Email Configuration
**Required Environment Variables:**
- `EMAIL_USER` - SMTP username
- `EMAIL_PASS` - SMTP password
- SMTP server configuration (in `server.cjs`)

### Email Template Location
**Inline HTML Template:** `server.cjs` (lines ~4295-4408)
- Responsive design
- Brand colors (purple gradient)
- Professional styling

### Resend Email
**API Endpoint:** `POST /api/resend-order-completion-email`
**Location:** `server.cjs` (line ~4549)
**Access:** Admin only (requires admin authentication)

---

## 9. SMS Notifications

### SMS Types

There are two types of SMS sent in the ambassador order flow:

1. **SMS to Customer** - Order confirmation with QR codes
2. **SMS to Ambassador** - New order assignment (sent when order is created)

### 9.1 SMS to Customer

**When Sent:**
- After admin approves order
- After tickets are generated
- If customer has valid phone number

**API Endpoint:** `POST /api/send-order-confirmation-sms`
**Location:** `server.cjs` (line ~1859)

**SMS Content:**
```
Commande confirmée :

ID:{orderNumber} confirmée
Pass: {passesText} | Total: {totalPrice} DT
Ambassadeur: {ambassadorName} – {ambassadorPhone}
We Create Memories

🎫 Vos QR Codes:
{qrCodeUrl}

⚠️ Ce lien ne peut être utilisé qu'une seule fois.
```

**Example:**
```
Commande confirmée :

ID:#12345678 confirmée
Pass: 2× VIP (50 DT) | Total: 100 DT
Ambassadeur: John Doe – 27123456
We Create Memories

🎫 Vos QR Codes:
https://andiamoevents.com/api/qr-codes/abc123xyz

⚠️ Ce lien ne peut être utilisé qu'une seule fois.
```

**Process:**
1. Fetch order with ambassador and pass details
2. Format passes text (e.g., "2× VIP (50 DT)")
3. Build SMS message
4. Format phone number (add country code: +216)
5. Send SMS via WinSMS API
6. Log to `sms_logs` table

**SMS Logging:**
**Table:** `sms_logs`

```typescript
{
  phone_number: string,        // Customer phone
  message: string,             // Full SMS content
  status: 'sent' | 'failed',
  api_response: JSON string,   // API response from WinSMS
  sent_at: timestamp | null,
  error_message: string | null
}
```

### 9.2 SMS to Ambassador

**When Sent:**
- When order is created (optional, can be triggered manually)
- Not automatically sent in current flow

**API Endpoint:** `POST /api/send-ambassador-order-sms`
**Location:** `server.cjs` (line ~1989)

**SMS Content:**
```
Nouvelle cmd {orderNumber}
Pass: {passesText} | Total: {totalPrice} DT
Client: {clientName} – {clientPhone}
```

**Example:**
```
Nouvelle cmd #12345678
Pass: 2× VIP (50 DT) | Total: 100 DT
Client: Jane Smith – 27123456
```

**Note:** This SMS is not automatically sent when order is created. It can be triggered manually from admin dashboard if needed.

### SMS Configuration
**Required Environment Variables:**
- `WINSMS_API_KEY` - WinSMS API key

**Phone Number Formatting:**
- Input: 8 digits (e.g., "27123456")
- Output: International format (e.g., "+21627123456")
- Validation: Must start with 2, 4, 5, or 9

### SMS Rate Limiting
**Middleware:** `smsLimiter`
- Window: 15 minutes
- Max requests: 5 per IP
- Prevents SMS spam

---

## 10. Order Completion

### Final State
Once an order reaches `PAID` status and tickets are generated:

1. ✅ **Payment Confirmed:** Cash received and verified
2. ✅ **Tickets Generated:** QR codes created and stored
3. ✅ **Customer Notified:** Email and SMS sent
4. ✅ **Order Logged:** All actions logged for audit
5. ✅ **Commission Calculated:** Ambassador commission ready (if applicable)

### Order in Database
```typescript
{
  status: 'PAID',
  approved_at: timestamp,
  tickets_generated_at: timestamp,
  qr_access_token: string,
  // ... other fields
}
```

### Related Records
- **Tickets:** Multiple ticket records (one per pass)
- **Order Passes:** Pass breakdown
- **Order Logs:** Complete audit trail
- **Email Logs:** Email delivery status
- **SMS Logs:** SMS delivery status

---

## 11. Order Rejection Flow

### When Admin Rejects Order

**Location:** `src/pages/admin/Dashboard.tsx` → `handleRejectCodAmbassadorOrder()`

### Process

**1. Validation**
- Order must be in `PENDING_ADMIN_APPROVAL` status
- Rejection reason is required

**2. Update Order Status**
```typescript
await supabase
  .from('orders')
  .update({
    status: 'REJECTED',
    rejected_at: new Date().toISOString(),
    rejection_reason: rejectionReason.trim(),
    updated_at: new Date().toISOString()
  })
  .eq('id', orderId);
```

**3. Log Rejection**
```typescript
await supabase.from('order_logs').insert({
  order_id: orderId,
  action: 'rejected',
  performed_by: null,
  performed_by_type: 'admin',
  details: {
    old_status: 'PENDING_ADMIN_APPROVAL',
    new_status: 'REJECTED',
    rejection_reason: rejectionReason,
    email_sent: false,
    sms_sent: false,
    admin_action: true
  }
});
```

### What Happens
- ✅ Order status changed to `REJECTED`
- ✅ Rejection reason stored
- ✅ Order log entry created
- ❌ **NO tickets generated**
- ❌ **NO email sent**
- ❌ **NO SMS sent**

### Order Visibility
- **Admin Dashboard:** Shows in rejected orders
- **Ambassador Dashboard:** Shows in history with "Rejected" status
- **Customer:** Not notified (no email/SMS)

---

## 12. Database Schema

### Orders Table

**Table:** `orders`

**Key Columns:**
```sql
id UUID PRIMARY KEY
source TEXT CHECK (source IN ('platform_online', 'ambassador_manual'))
user_name TEXT NOT NULL
user_phone TEXT NOT NULL
user_email TEXT
city TEXT NOT NULL
ville TEXT
ambassador_id UUID REFERENCES ambassadors(id)
event_id UUID REFERENCES events(id)
pass_type TEXT
quantity INTEGER
total_price DECIMAL(10,2)
payment_method TEXT CHECK (payment_method IN ('online', 'external_app', 'ambassador_cash'))
status TEXT CHECK (status IN ('PENDING_ONLINE', 'REDIRECTED', 'PENDING_CASH', 'PENDING_ADMIN_APPROVAL', 'PAID', 'REJECTED', 'CANCELLED'))
notes TEXT (JSON string)
assigned_at TIMESTAMP
approved_at TIMESTAMP
rejected_at TIMESTAMP
rejection_reason TEXT
qr_access_token TEXT
tickets_generated_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()
updated_at TIMESTAMP DEFAULT NOW()
```

### Order Passes Table

**Table:** `order_passes`

**Columns:**
```sql
id UUID PRIMARY KEY
order_id UUID REFERENCES orders(id)
pass_type TEXT NOT NULL
quantity INTEGER NOT NULL
price DECIMAL(10,2) NOT NULL
created_at TIMESTAMP DEFAULT NOW()
```

### Tickets Table

**Table:** `tickets`

**Columns:**
```sql
id UUID PRIMARY KEY
order_id UUID REFERENCES orders(id)
pass_type TEXT
qr_code TEXT
ticket_number TEXT UNIQUE
status TEXT CHECK (status IN ('active', 'used', 'cancelled'))
validated_at TIMESTAMP
created_at TIMESTAMP DEFAULT NOW()
```

### Order Logs Table

**Table:** `order_logs`

**Columns:**
```sql
id UUID PRIMARY KEY
order_id UUID REFERENCES orders(id)
action TEXT (e.g., 'status_changed', 'approved', 'rejected')
performed_by UUID (ambassador ID or null for admin)
performed_by_type TEXT ('ambassador' | 'admin')
details JSONB
created_at TIMESTAMP DEFAULT NOW()
```

### Email Delivery Logs Table

**Table:** `email_delivery_logs`

**Columns:**
```sql
id UUID PRIMARY KEY
order_id UUID REFERENCES orders(id)
email_type TEXT
recipient_email TEXT
recipient_name TEXT
subject TEXT
status TEXT CHECK (status IN ('pending', 'sent', 'failed'))
sent_at TIMESTAMP
error_message TEXT
created_at TIMESTAMP DEFAULT NOW()
```

### SMS Logs Table

**Table:** `sms_logs`

**Columns:**
```sql
id UUID PRIMARY KEY
phone_number TEXT
message TEXT
status TEXT CHECK (status IN ('sent', 'failed'))
api_response TEXT (JSON string)
sent_at TIMESTAMP
error_message TEXT
created_at TIMESTAMP DEFAULT NOW()
```

---

## 13. API Endpoints

### Order Management

**POST /api/generate-tickets-for-order**
- **Purpose:** Generate tickets for a paid order
- **Auth:** Optional (admin auth for admin requests, reCAPTCHA for public)
- **Body:** `{ orderId: string, recaptchaToken?: string }`
- **Returns:** `{ success: boolean, ticketsCount: number, emailSent: boolean, smsSent: boolean }`

### Email Endpoints

**POST /api/send-order-completion-email**
- **Purpose:** Send order completion email to customer
- **Auth:** None (internal use)
- **Body:** `{ orderId: string }`
- **Returns:** `{ success: boolean, message: string, emailLogId?: string }`

**POST /api/resend-order-completion-email**
- **Purpose:** Resend order completion email (admin only)
- **Auth:** Admin required
- **Body:** `{ orderId: string }`
- **Returns:** `{ success: boolean, message: string }`

### SMS Endpoints

**POST /api/send-order-confirmation-sms**
- **Purpose:** Send SMS confirmation to customer
- **Auth:** Rate limited (5 requests per 15 minutes)
- **Body:** `{ orderId: string }`
- **Returns:** `{ success: boolean, message: string, result: object }`

**POST /api/send-ambassador-order-sms**
- **Purpose:** Send SMS notification to ambassador
- **Auth:** Rate limited
- **Body:** `{ orderId: string }`
- **Returns:** `{ success: boolean, message: string, result: object }`

---

## 14. Status Flow Diagram

```
┌─────────────────────┐
│  ORDER CREATED      │
│  (by Ambassador)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  PENDING_CASH       │
│  (Waiting for cash) │
└──────────┬──────────┘
           │
           │ Ambassador confirms cash
           ▼
┌─────────────────────┐
│PENDING_ADMIN_APPROVAL│
│  (Waiting for admin) │
└──────────┬──────────┘
           │
           │ Admin approves
           ▼
┌─────────────────────┐
│       PAID           │
│  (Tickets generated) │
└─────────────────────┘
           │
           ├──► Email sent to customer
           ├──► SMS sent to customer
           └──► Tickets active

Alternative path (rejection):
┌─────────────────────┐
│PENDING_ADMIN_APPROVAL│
└──────────┬──────────┘
           │
           │ Admin rejects
           ▼
┌─────────────────────┐
│     REJECTED         │
│  (No tickets/notifications)│
└─────────────────────┘
```

---

## 15. Key Files Reference

### Frontend Files

1. **Ambassador Dashboard:**
   - `src/pages/ambassador/Dashboard.tsx`
   - Order creation UI
   - Cash confirmation handler
   - Order display

2. **Admin Dashboard:**
   - `src/pages/admin/Dashboard.tsx`
   - Order approval handler
   - Order rejection handler
   - Order management UI

3. **Order Service:**
   - `src/lib/orders/orderService.ts`
   - Order creation logic
   - Status management

4. **Ambassador Orders:**
   - `src/lib/ambassadorOrders.ts`
   - Ambassador-specific order functions

### Backend Files

1. **Server:**
   - `server.cjs`
   - All API endpoints
   - Ticket generation
   - Email sending
   - SMS sending

2. **Email Service:**
   - `src/lib/email.ts`
   - Email template generation

3. **Ticket Generation:**
   - `src/lib/ticketGenerationService.tsx`
   - QR code generation
   - Ticket creation

### Database Migrations

- `supabase/migrations/` - All database schema changes
- Key migration: `20250201000031-enforce-cod-rules.sql` - COD order rules

---

## 16. Important Notes

### Order Source Types
- `ambassador_manual` - All COD orders created by ambassadors
- `platform_online` - Online payment orders (not part of ambassador flow)

### Payment Methods
- `ambassador_cash` - Cash payment via ambassador (replaces legacy `cod`)
- `online` - Online payment (not part of ambassador flow)
- `external_app` - External payment app (not part of ambassador flow)

### Status Constraints
- COD orders (`ambassador_manual` + `ambassador_cash`) must start as `PENDING_CASH`
- Cannot skip `PENDING_ADMIN_APPROVAL` status
- Must be `PAID` before tickets can be generated

### Notification Requirements
- Email: Requires `user_email` field
- SMS: Requires `user_phone` field
- Both are optional but recommended

### Commission Calculation
- Commission calculated based on total passes sold
- Rules:
  - Passes 1-7: 0 DT commission
  - Passes 8+: 3 DT per pass
  - Bonuses: 15 passes = +15 DT, 25 passes = +20 DT, 35 passes = +20 DT

### Security
- All API endpoints have rate limiting
- Admin actions require authentication
- Order status changes are logged
- SMS/Email sending is logged for audit

---

## 17. Troubleshooting

### Common Issues

**1. Tickets Not Generated**
- Check order status is `PAID`
- Verify order has `order_passes` entries
- Check server logs for errors

**2. Email Not Sent**
- Verify `user_email` exists
- Check `EMAIL_USER` and `EMAIL_PASS` environment variables
- Check `email_delivery_logs` table for error messages

**3. SMS Not Sent**
- Verify `user_phone` exists and is valid format
- Check `WINSMS_API_KEY` environment variable
- Check `sms_logs` table for error messages
- Verify rate limit not exceeded

**4. Order Stuck in PENDING_ADMIN_APPROVAL**
- Check admin dashboard for pending orders
- Verify order has valid data
- Check order logs for errors

**5. Ambassador Cannot Confirm Cash**
- Check sales are enabled (`salesEnabled` flag)
- Verify order status is `PENDING_CASH`
- Check ambassador has permission

---

## Conclusion

This document provides a complete overview of the ambassador orders flow from creation to completion. The flow ensures:

1. ✅ Proper order creation with validation
2. ✅ Ambassador confirmation of cash payment
3. ✅ Admin review and approval
4. ✅ Automatic ticket generation
5. ✅ Customer notifications (email + SMS)
6. ✅ Complete audit trail
7. ✅ Error handling and logging

For any questions or issues, refer to the specific file locations mentioned in this document or check the server logs for detailed error messages.

---

**Last Updated:** Based on current codebase as of documentation creation
**Version:** 1.0
