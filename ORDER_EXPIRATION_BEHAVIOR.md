# Order Expiration Behavior

## What Happens When Order Expiration Time Ends?

### Current Implementation

When an order's `expires_at` timestamp is reached or passed:

1. **Visual Indicators:**
   - Ambassador dashboard shows "Expired" badge (red, pulsing)
   - Admin dashboard shows "Expired" indicator in order list
   - Order details show expiration status

2. **Current Behavior:**
   - **No automatic action is taken** - orders remain in their current status
   - Expiration is informational only - serves as a deadline reminder
   - Admins can manually cancel/remove expired orders if needed

### Recommended Future Enhancements

For production, consider implementing one of these approaches:

#### Option 1: Auto-Cancel Expired Orders (Recommended)
- **Background Job/Cron:** Run every 5-15 minutes
- **Action:** Automatically cancel orders where `expires_at < NOW()` and status is still pending
- **Stock Management:** Release stock (decrease `sold_quantity`) when auto-cancelling
- **Notification:** Send email/SMS to customer and ambassador about cancellation
- **Logging:** Log auto-cancellation in `order_logs` with reason "Order expired"

#### Option 2: Notification Only
- **Background Job:** Check for expired orders
- **Action:** Send notifications to admin and ambassador
- **Status:** Keep order in pending status but mark as "expired" (new status or flag)
- **Manual Action:** Admin must manually cancel expired orders

#### Option 3: Warning System
- **Pre-Expiration Warnings:** Notify when < 2 hours remain
- **Expiration Marking:** Mark orders as "EXPIRED" status (new status)
- **Manual Review:** Admin reviews and decides action (cancel, extend, approve)

### Implementation Notes

**To implement auto-cancellation:**

1. Create a background job (cron, scheduled function, or Supabase Edge Function)
2. Query orders where:
   ```sql
   expires_at < NOW() 
   AND status IN ('PENDING_CASH', 'PENDING_ONLINE', 'PENDING_ADMIN_APPROVAL')
   AND expires_at IS NOT NULL
   ```
3. For each expired order:
   - Update status to `CANCELLED`
   - Set `cancelled_at` timestamp
   - Set `cancellation_reason` = "Order expired (automatic cancellation)"
   - Release stock using `releaseOrderStock()` function
   - Log to `order_logs`
   - Send notifications (optional)

**Database Function Example:**
```sql
CREATE OR REPLACE FUNCTION auto_cancel_expired_orders()
RETURNS INTEGER AS $$
DECLARE
  cancelled_count INTEGER;
BEGIN
  -- Cancel expired pending orders
  WITH expired_orders AS (
    UPDATE orders
    SET 
      status = 'CANCELLED',
      cancelled_at = NOW(),
      cancellation_reason = 'Order expired (automatic cancellation)',
      updated_at = NOW()
    WHERE 
      expires_at < NOW()
      AND status IN ('PENDING_CASH', 'PENDING_ONLINE', 'PENDING_ADMIN_APPROVAL')
      AND expires_at IS NOT NULL
    RETURNING id
  )
  SELECT COUNT(*) INTO cancelled_count FROM expired_orders;
  
  -- Release stock for cancelled orders (via trigger or function)
  -- Log cancellations
  
  RETURN cancelled_count;
END;
$$ LANGUAGE plpgsql;
```

**Schedule the function:**
- Supabase: Use pg_cron extension
- External: Use cron job or scheduled task
- Vercel: Use Vercel Cron Jobs

### Current Status

✅ **Implemented:**
- Expiration date/time setting (admin)
- Expiration display (admin dashboard)
- Expiration countdown timer (ambassador dashboard)
- Visual indicators (expired, expiring soon)

⏳ **Not Yet Implemented:**
- Automatic cancellation when expired
- Background job to check expired orders
- Pre-expiration warnings/notifications

### Recommendation

For now, expiration serves as a **deadline reminder**. Admins and ambassadors can see when orders will expire and take manual action if needed.

To enable automatic cancellation, implement a background job that runs periodically (every 5-15 minutes) to check and cancel expired orders.
