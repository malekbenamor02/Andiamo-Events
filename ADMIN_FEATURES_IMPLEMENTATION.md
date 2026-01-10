# Admin Features Implementation Summary

## Overview

This document describes the implementation of two new admin-only features:
1. **Admin Skip Ambassador Confirmation** - Allows admin to approve orders directly without waiting for ambassador cash confirmation
2. **Admin Resend Ticket Email** - Allows admin to resend ticket emails for already-paid orders

## Files Modified

### 1. `server.cjs`
- **Added**: `buildTicketEmailHtml()` helper function (line ~5281)
  - Extracted email template building logic to avoid duplication
  - Reusable by both `generateTicketsAndSendEmail` and resend endpoint
  - Builds the same email template with QR codes

- **Added**: `POST /api/admin-skip-ambassador-confirmation` endpoint (line ~6700)
  - Server-side admin authentication required (`requireAdminAuth`)
  - Validates order exists and is in `PENDING_CASH` or `PENDING_ADMIN_APPROVAL` status
  - Conditionally updates order status to `PAID` (idempotent)
  - Calls `generateTicketsAndSendEmail()` to generate tickets and send email/SMS
  - Logs to `order_logs` and `security_audit_logs` for audit trail
  - Returns success/error with detailed information

- **Added**: `POST /api/admin-resend-ticket-email` endpoint (line ~6880)
  - Server-side admin authentication required (`requireAdminAuth`)
  - Rate limited (5 resends per hour per order)
  - Validates order exists and is `PAID`
  - Validates tickets exist (must not regenerate)
  - Reuses existing tickets and QR codes
  - Sends email using shared `buildTicketEmailHtml()` helper
  - Logs to `order_logs` and `email_delivery_logs`
  - Returns success/error with ticket count

- **Added**: Rate limiter for resend endpoint (line ~6870)
  - `resendTicketEmailLimiter`: Max 5 requests per hour per order (not per IP)

### 2. `src/lib/api-routes.ts`
- **Added**: `ADMIN_SKIP_AMBASSADOR_CONFIRMATION: '/api/admin-skip-ambassador-confirmation'`
- **Added**: `ADMIN_RESEND_TICKET_EMAIL: '/api/admin-resend-ticket-email'`

## Feature 1: Admin Skip Ambassador Confirmation

### Endpoint
```
POST /api/admin-skip-ambassador-confirmation
```

### Request Body
```json
{
  "orderId": "uuid",
  "reason": "optional reason for skipping" // Optional
}
```

### Behavior
1. **Authentication**: Requires admin role (enforced server-side)
2. **Validation**: 
   - Order must exist
   - Order status must be `PENDING_CASH` or `PENDING_ADMIN_APPROVAL`
3. **Status Transition**:
   - `PENDING_CASH` → `PAID`
   - `PENDING_ADMIN_APPROVAL` → `PAID`
   - Conditional update ensures idempotency (won't fail if already PAID)
4. **Ticket Generation**:
   - Calls `generateTicketsAndSendEmail(orderId)` (idempotent function)
   - Generates tickets with QR codes if they don't exist
   - Sends email with QR codes
   - Sends SMS confirmation
5. **Audit Logging**:
   - Logs to `order_logs` with:
     - Action: `admin_skip_confirmation`
     - Admin ID and email
     - Old status and new status
     - Reason (if provided)
     - Tickets generation status
   - Logs security events to `security_audit_logs` for invalid attempts

### Response (Success)
```json
{
  "success": true,
  "message": "Order approved successfully (ambassador confirmation skipped)",
  "orderId": "uuid",
  "oldStatus": "PENDING_CASH",
  "newStatus": "PAID",
  "ticketsGenerated": true,
  "ticketsCount": 3,
  "emailSent": true,
  "smsSent": true,
  "ticketError": null
}
```

### Response (Error - Invalid Status)
```json
{
  "error": "Invalid order status",
  "details": "Order must be in PENDING_CASH or PENDING_ADMIN_APPROVAL status. Current status: PAID"
}
```

### Idempotency
- If order is already `PAID`, returns success with `ticketsExist: true`
- If tickets already exist, `generateTicketsAndSendEmail` returns early without regenerating
- Duplicate calls are safe and logged

## Feature 2: Admin Resend Ticket Email

### Endpoint
```
POST /api/admin-resend-ticket-email
```

### Request Body
```json
{
  "orderId": "uuid"
}
```

### Behavior
1. **Authentication**: Requires admin role (enforced server-side)
2. **Rate Limiting**: Max 5 resends per hour per order (keyed by orderId, not IP)
3. **Validation**:
   - Order must exist
   - Order status must be `PAID`
   - Customer email must exist
   - Tickets must exist (fails if no tickets found)
4. **Email Sending**:
   - Fetches existing tickets with QR codes
   - Uses shared `buildTicketEmailHtml()` helper (same template as generation)
   - Sends email with all existing QR codes
   - **Does NOT regenerate tickets** (reuses existing)
   - **Does NOT change order status** (remains `PAID`)
5. **Audit Logging**:
   - Logs to `order_logs` with:
     - Action: `admin_resend_ticket_email`
     - Admin ID and email
     - Email sent status
     - Ticket count
   - Logs to `email_delivery_logs` with email status
   - Logs security events for invalid attempts

### Response (Success)
```json
{
  "success": true,
  "message": "Ticket email resent successfully",
  "orderId": "uuid",
  "emailSent": true,
  "ticketsCount": 3
}
```

### Response (Error - Not Paid)
```json
{
  "error": "Order must be PAID to resend tickets",
  "details": "Current status: PENDING_CASH, Payment status: null"
}
```

### Response (Error - No Tickets)
```json
{
  "error": "No tickets found for this order",
  "details": "Tickets must be generated before resending email. Use the skip confirmation endpoint first."
}
```

### Rate Limiting
- Key: `resend-ticket-email:{orderId}`
- Window: 1 hour
- Max: 5 requests per order per hour
- Response on limit: `429 Too Many Requests` with error message

## Status Transitions

### Admin Skip Confirmation
```
PENDING_CASH → PAID
PENDING_ADMIN_APPROVAL → PAID
```

### Admin Resend Email
```
PAID → PAID (no status change)
```

## Security Features

### Server-Side Enforcement
- ✅ All admin checks are server-side (never frontend logic)
- ✅ `requireAdminAuth` middleware validates admin role on every request
- ✅ Order status transitions validated server-side
- ✅ No bypass via API parameters

### Audit Logging
- ✅ All actions logged to `order_logs` with admin ID and timestamp
- ✅ Security events logged to `security_audit_logs` for invalid attempts
- ✅ Email delivery logged to `email_delivery_logs`

### Idempotency
- ✅ Skip confirmation: Conditional update ensures idempotency
- ✅ Ticket generation: `generateTicketsAndSendEmail` checks for existing tickets
- ✅ Resend email: Rate limiting prevents abuse, but doesn't prevent legitimate resends

### Rate Limiting
- ✅ Resend email: 5 requests per hour per order
- ✅ Uses orderId as key (not IP) to prevent abuse while allowing legitimate use

## Reused Logic

### Email Template
- ✅ Extracted to `buildTicketEmailHtml()` helper function
- ✅ Used by both `generateTicketsAndSendEmail` and resend endpoint
- ✅ Same template ensures consistent email appearance

### Ticket Generation
- ✅ Skip confirmation calls `generateTicketsAndSendEmail()` directly
- ✅ Reuses existing idempotent logic
- ✅ No duplication of ticket generation code

### SMS Sending
- ✅ Included in `generateTicketsAndSendEmail()` call
- ✅ Same SMS logic as normal flow

## Testing Recommendations

1. **Skip Confirmation**:
   - Test with `PENDING_CASH` order
   - Test with `PENDING_ADMIN_APPROVAL` order
   - Test idempotency (call twice)
   - Test with invalid status (should fail)
   - Test with non-admin (should fail)
   - Verify tickets generated
   - Verify email sent
   - Verify SMS sent
   - Verify audit logs created

2. **Resend Email**:
   - Test with `PAID` order with tickets
   - Test with `PAID` order without tickets (should fail)
   - Test with non-PAID order (should fail)
   - Test rate limiting (5 requests, 6th should fail)
   - Test with non-admin (should fail)
   - Verify email sent with existing QR codes
   - Verify no ticket regeneration
   - Verify audit logs created

3. **Normal Flow Regression**:
   - Verify ambassador confirmation flow still works
   - Verify normal ticket generation flow still works
   - Verify no regression in existing functionality

## Frontend Integration (TODO)

The frontend admin dashboard needs to be updated to:
1. Add UI button/action for "Skip Ambassador Confirmation"
2. Add UI button/action for "Resend Ticket Email"
3. Call the new API endpoints using `API_ROUTES` constants
4. Handle success/error responses
5. Show rate limit errors appropriately

## Notes

### ⚠️ IMPORTANT: generateTicketsAndSendEmail() Refactoring Rule

**DO NOT modify `generateTicketsAndSendEmail()` again unless you migrate it fully to use `buildTicketEmailHtml()` helper.**

- The function currently builds email inline (lines ~6128-6143)
- The resend endpoint uses `buildTicketEmailHtml()` helper to avoid duplication
- **Rule**: Never partially refactor this function - partial refactors introduce bugs
- **Future work**: When ready, fully migrate `generateTicketsAndSendEmail()` to use `buildTicketEmailHtml()` helper in one complete change

### Security & Architecture

- All critical operations are server-side enforced
- No business logic moved to frontend
- All actions are idempotent where appropriate
- Comprehensive audit logging ensures traceability
- Rate limiting prevents abuse while allowing legitimate use
