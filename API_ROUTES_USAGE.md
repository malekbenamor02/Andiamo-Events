# API Routes Usage Guide

This document explains how to use the centralized API routes system to prevent 404 errors and ensure frontend-backend route consistency.

## Overview

All API routes are now centralized in `src/lib/api-routes.ts`. This prevents typos, ensures consistency, and makes it easy to update routes across the entire application.

## Usage

### Basic Usage

```typescript
import { API_ROUTES } from '@/lib/api-routes';
import { apiFetch, handleApiResponse } from '@/lib/api-client';

// Simple GET request
const response = await apiFetch(API_ROUTES.VERIFY_ADMIN);
const data = await handleApiResponse(response);

// POST request with body
const response = await apiFetch(API_ROUTES.ADMIN_UPDATE_APPLICATION, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ applicationId: '123', status: 'approved' })
});
const data = await handleApiResponse(response);
```

### Using safeApiCall (Recommended)

For even simpler error handling:

```typescript
import { safeApiCall } from '@/lib/api-client';
import { API_ROUTES } from '@/lib/api-routes';

try {
  const data = await safeApiCall(API_ROUTES.VERIFY_ADMIN);
  console.log('Success:', data);
} catch (error) {
  // Error is already handled gracefully
  toast.error(error.message);
}
```

### Routes with Parameters

Some routes accept parameters:

```typescript
// Email delivery logs for a specific order
const response = await apiFetch(API_ROUTES.EMAIL_DELIVERY_LOGS(orderId));

// Next ambassador for a ville
const response = await apiFetch(API_ROUTES.NEXT_AMBASSADOR('Sousse'));
```

## Available Routes

### Authentication & Admin
- `API_ROUTES.ADMIN_LOGIN` - Admin login endpoint
- `API_ROUTES.ADMIN_LOGOUT` - Admin logout endpoint
- `API_ROUTES.VERIFY_ADMIN` - Verify admin token

### Application Management
- `API_ROUTES.ADMIN_UPDATE_APPLICATION` - Update application status

### Email
- `API_ROUTES.SEND_EMAIL` - Send email
- `API_ROUTES.RESEND_ORDER_COMPLETION_EMAIL` - Resend order completion email
- `API_ROUTES.EMAIL_DELIVERY_LOGS(orderId)` - Get email delivery logs for an order

### SMS
- `API_ROUTES.SMS_BALANCE` - Get SMS balance
- `API_ROUTES.SEND_SMS` - Send SMS
- `API_ROUTES.BULK_PHONES` - Add bulk phone numbers

### Orders & Assignments
- `API_ROUTES.ASSIGN_ORDER` - Assign order to ambassador
- `API_ROUTES.AUTO_REASSIGN` - Auto-reassign ignored orders
- `API_ROUTES.NEXT_AMBASSADOR(ville)` - Get next ambassador for a ville

### Tickets
- `API_ROUTES.VALIDATE_TICKET` - Validate ticket QR code
- `API_ROUTES.GENERATE_QR_CODE` - Generate QR code
- `API_ROUTES.GENERATE_TICKETS_FOR_ORDER` - Generate tickets for an order

## Error Handling

The API client automatically handles:
- **401 Unauthorized**: Clears tokens and redirects to login (no console errors)
- **404 Not Found**: Returns user-friendly error message (no console spam)
- **Other errors**: Logs appropriately and provides helpful error messages

### Example with Error Handling

```typescript
try {
  const response = await apiFetch(API_ROUTES.SEND_SMS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumbers: ['123'], message: 'Hello' })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to send SMS');
  }
  
  const data = await response.json();
  console.log('Success:', data);
} catch (error) {
  // Handle error - no console spam for 401/404
  toast.error(error.message);
}
```

## Adding New Routes

1. Add the route constant to `src/lib/api-routes.ts`:
```typescript
export const API_ROUTES = {
  // ... existing routes
  NEW_ROUTE: '/api/new-route',
} as const;
```

2. Add the backend route in `server.cjs`:
```javascript
app.post('/api/new-route', async (req, res) => {
  // ... route handler
});
```

3. Use the constant in your frontend code:
```typescript
const response = await apiFetch(API_ROUTES.NEW_ROUTE);
```

## Benefits

✅ **No more 404 errors** - Routes are guaranteed to match between frontend and backend  
✅ **No typos** - TypeScript will catch invalid route names  
✅ **Easy refactoring** - Change a route in one place, updates everywhere  
✅ **Better error handling** - Automatic handling of 401/404 errors  
✅ **No console spam** - Clean error handling without red console errors  



