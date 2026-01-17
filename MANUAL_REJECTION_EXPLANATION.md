# Manual Rejection - How It Works

## Overview

The manual rejection feature allows you to immediately reject all expired PENDING_CASH orders with a single click from the admin dashboard.

## How It Works (Step by Step)

### 1. **User Clicks the Button**
When you click the **"Reject Expired Orders"** button in the Order Expiration Settings section:

```
Admin Dashboard → Order Expiration Settings → "Reject Expired Orders" Button
```

### 2. **Frontend Makes API Call**
The frontend code calls your API endpoint:

```javascript
GET /api/auto-reject-expired-orders
```

**Location:** `src/pages/admin/Dashboard.tsx` → `triggerAutoRejectExpired()` function

**What happens:**
- Button shows "Processing..." with spinning icon
- Makes HTTP GET request to your API
- Waits for response

### 3. **API Endpoint Processes Request**
The API endpoint (`api/auto-reject-expired-orders.js` or `api/misc.js`) receives the request:

**What it does:**
1. Validates the request (checks for CRON_SECRET if set)
2. Creates Supabase client with service role key
3. Calls the database function: `auto_reject_expired_pending_cash_orders()`

### 4. **Database Function Executes**
The PostgreSQL function `auto_reject_expired_pending_cash_orders()` runs:

**What it does:**
1. **Finds expired orders:**
   ```sql
   SELECT * FROM orders
   WHERE status = 'PENDING_CASH'
     AND expires_at IS NOT NULL
     AND expires_at < NOW()
     AND rejected_at IS NULL
   ```

2. **For each expired order:**
   - **Releases stock first:**
     - Calls `release_order_stock_internal(order_id)`
     - Decrements `sold_quantity` for each pass in the order
     - Sets `stock_released = true` on the order
     - Makes passes available again for new orders
   
   - **Rejects the order:**
     - Updates status: `PENDING_CASH` → `REJECTED`
     - Sets `rejected_at = NOW()`
     - Sets `rejection_reason = 'Order expired automatically (expiration time reached)'`
   
   - **Logs the action:**
     - Inserts record in `order_logs` table
     - Action: `auto_rejected_expired`
     - Includes details: expiration date, stock release status, etc.

3. **Returns results:**
   ```json
   {
     "rejected_count": 2,
     "rejected_order_ids": ["uuid1", "uuid2"]
   }
   ```

### 5. **API Returns Response**
The API sends back a JSON response:

```json
{
  "success": true,
  "rejected_count": 2,
  "rejected_order_ids": ["uuid1", "uuid2"],
  "message": "Auto-rejected 2 expired order(s)",
  "timestamp": "2025-02-28T10:30:00.000Z"
}
```

### 6. **Frontend Updates UI**
The frontend receives the response and:

1. **Shows success message:**
   - Toast notification: "Successfully rejected X expired order(s)"
   - Displays the count of rejected orders

2. **Refreshes the orders list:**
   - Calls `fetchAmbassadorSalesData()` after 1 second
   - Updates the orders table
   - Expired orders now show as "Rejected" status

3. **Button returns to normal:**
   - Spinning icon stops
   - Button text returns to "Reject Expired Orders"

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Admin Dashboard UI                                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Order Expiration Settings                            │  │
│  │  [Reject Expired Orders Button] ← User clicks here   │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP GET Request
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  API Endpoint: /api/auto-reject-expired-orders              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Validate request                                 │  │
│  │  2. Create Supabase client                           │  │
│  │  3. Call RPC function                                │  │
│  └───────────────────────┬─────────────────────────────┘  │
└───────────────────────────┼───────────────────────────────┘
                            │
                            │ RPC Call
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Database Function: auto_reject_expired_pending_cash_orders │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  FOR EACH expired order:                              │  │
│  │    1. Release stock (decrement sold_quantity)         │  │
│  │    2. Update status: PENDING_CASH → REJECTED         │  │
│  │    3. Set rejected_at, rejection_reason               │  │
│  │    4. Log action in order_logs                        │  │
│  │  RETURN: rejected_count, rejected_order_ids          │  │
│  └───────────────────────┬─────────────────────────────┘  │
└───────────────────────────┼───────────────────────────────┘
                            │
                            │ Return Results
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  API Response                                                │
│  {                                                           │
│    "success": true,                                          │
│    "rejected_count": 2,                                      │
│    "rejected_order_ids": ["uuid1", "uuid2"]                  │
│  }                                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ Update UI
                        ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend Updates                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  1. Show success toast                               │  │
│  │  2. Refresh orders list                              │  │
│  │  3. Orders now show "Rejected" status                │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## What Happens to Each Expired Order

### Before Rejection:
- **Status:** `PENDING_CASH`
- **Stock:** Reserved (sold_quantity increased)
- **Expires At:** Past date/time
- **UI Shows:** "Expired" badge (red)

### After Rejection:
- **Status:** `REJECTED` ✅
- **Stock:** Released (sold_quantity decreased) ✅
- **Rejected At:** Current timestamp ✅
- **Rejection Reason:** "Order expired automatically (expiration time reached)" ✅
- **UI Shows:** "Rejected" badge (red)
- **Log Entry:** Created in `order_logs` table ✅

## Key Features

### ✅ **Automatic Stock Release**
- Stock is released **before** the order is rejected
- Prevents double-release with `stock_released` flag
- Passes become available immediately for new orders

### ✅ **Atomic Operations**
- Uses database transactions
- `FOR UPDATE SKIP LOCKED` prevents race conditions
- All-or-nothing: if one order fails, others still process

### ✅ **Comprehensive Logging**
- Every rejection is logged in `order_logs`
- Includes: expiration date, stock release status, timestamps
- Action type: `auto_rejected_expired`
- Performed by: `system` (not a user)

### ✅ **User Feedback**
- Real-time loading state (spinning icon)
- Success message with count
- Automatic list refresh
- Error handling with clear messages

## When to Use Manual Rejection

**Use manual rejection when:**
- ✅ Testing the rejection functionality
- ✅ You have expired orders right now and want to reject them immediately
- ✅ The cron service isn't set up yet
- ✅ You want to verify the system is working

**Use automatic rejection (cron) when:**
- ✅ You want hands-off operation
- ✅ You want orders rejected automatically every 5 minutes
- ✅ You're in production and want consistent automation

## Difference: Manual vs Automatic

| Feature | Manual Trigger | Automatic Cron |
|---------|---------------|----------------|
| **Trigger** | Admin clicks button | External service calls API every 5 min |
| **Timing** | Immediate | Every 5 minutes |
| **Requires** | Admin action | Cron service setup |
| **Use Case** | Testing, immediate action | Production automation |
| **Same Function** | ✅ Yes - both use same database function | ✅ Yes |

**Important:** Both manual and automatic rejection use the **exact same database function** (`auto_reject_expired_pending_cash_orders()`), so the behavior is identical. The only difference is **how** it's triggered.

## Troubleshooting

### Button doesn't work:
- Check browser console for errors
- Verify API endpoint is accessible
- Check network tab for failed requests

### Orders not rejected:
- Verify orders are actually expired (`expires_at < NOW()`)
- Check orders are still `PENDING_CASH` status
- Verify orders don't already have `rejected_at` set
- Check Supabase logs for function errors

### Stock not released:
- Check `order_logs` for `stock_released` status
- Verify `order_passes` have `pass_id` set (required for stock release)
- Check if stock was already released (`stock_released = true`)

## Code Locations

- **Frontend Function:** `src/pages/admin/Dashboard.tsx` → `triggerAutoRejectExpired()`
- **API Endpoint:** `api/auto-reject-expired-orders.js` or `api/misc.js`
- **Database Function:** `supabase/migrations/20250227000000-restrict-expiration-to-pending-cash-only.sql` → `auto_reject_expired_pending_cash_orders()`
- **Stock Release Function:** Same migration → `release_order_stock_internal()`
