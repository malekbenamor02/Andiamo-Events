# Admin Features Implementation Plan

## Analysis Summary

### Current Order Lifecycle
- **Statuses**: `PENDING_ONLINE`, `REDIRECTED`, `PENDING_CASH`, `PAID`, `CANCELLED`
- **Ambassador Flow**: Order created → `PENDING_CASH` → Ambassador confirms cash → Admin approves → `PAID` → Tickets generated
- **Admin Approval**: Currently done in frontend (INSECURE - frontend directly updates DB)

### Key Existing Functions
1. **`generateTicketsAndSendEmail(orderId)`** (`server.cjs` line ~5284)
   - Validates order is PAID
   - Checks for existing tickets (idempotency)
   - Generates tickets + QR codes
   - Sends email with QR codes
   - Sends SMS confirmation
   - Logs to email_delivery_logs and sms_logs

2. **`/api/generate-tickets-for-order`** (`server.cjs` line ~6347)
   - Validates order is PAID
   - Calls generateTicketsAndSendEmail
   - Has admin auth check

3. **`/api/resend-order-completion-email`** (`server.cjs` line ~4669)
   - Currently sends basic email (doesn't include tickets)

### Files to Modify
1. `server.cjs` - Add new admin endpoints
2. `src/lib/api-routes.ts` - Add route constants
3. `src/pages/admin/Dashboard.tsx` - Add UI for new features

## Implementation

### Feature 1: Admin Skip Ambassador Confirmation
**Endpoint**: `POST /api/admin-skip-ambassador-confirmation`
- Server-side admin auth check (requireAdminAuth)
- Validates order exists
- Validates order status is `PENDING_CASH` or `PENDING_ADMIN_APPROVAL`
- Updates order status to `PAID` (conditional update for idempotency)
- Calls `generateTicketsAndSendEmail` (already idempotent)
- Logs to `order_logs` with admin ID, action, timestamp
- Returns success/error

**Status Transitions**:
- `PENDING_CASH` → `PAID`
- `PENDING_ADMIN_APPROVAL` → `PAID`

### Feature 2: Admin Resend Ticket Email
**Endpoint**: `POST /api/admin-resend-ticket-email`
- Server-side admin auth check (requireAdminAuth)
- Validates order exists and is `PAID`
- Validates tickets exist (fail if no tickets)
- Rate limiting (max 5 resends per hour per order)
- Reuses existing tickets (no regeneration)
- Sends email using same template as `generateTicketsAndSendEmail`
- Logs to `order_logs` and `email_delivery_logs`
- Returns success/error

**No Status Change** - Order remains `PAID`
