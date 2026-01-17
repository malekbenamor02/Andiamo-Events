# Auto-Reject Expired Orders - Cron Setup Guide

This guide explains how to set up automatic rejection of expired PENDING_CASH orders.

## Problem

Expired orders need to be automatically rejected every 5 minutes. Since Vercel cron jobs may not work reliably, we provide multiple alternative solutions.

## What Happens When Orders Are Rejected?

When expired orders are automatically rejected:
1. ✅ **Stock is automatically released** - The passes return to available inventory
2. ✅ **Order status changes to REJECTED** - With reason "Order expired automatically"
3. ✅ **Stock quantity is decremented** - `sold_quantity` decreases, making passes available again
4. ✅ **Action is logged** - Recorded in `order_logs` for audit trail

**Important:** The stock release happens automatically before the order is rejected, ensuring passes are immediately available for new orders.

## Solutions

### Option 1: External Cron Service (Recommended - Free & Reliable)

**Best for:** All projects, especially if pg_cron is not available

**Popular Services:**
- [cron-job.org](https://cron-job.org) (Free, reliable)
- [EasyCron](https://www.easycron.com) (Free tier available)
- [UptimeRobot](https://uptimerobot.com) (Free monitoring + cron)
- [Cronitor](https://cronitor.io) (Free tier available)

**Setup Steps:**

1. **Get your API endpoint URL:**
   ```
   https://your-domain.com/api/auto-reject-expired-orders
   ```

2. **Set up a secret (optional but recommended):**
   - Add `CRON_SECRET` to your Vercel environment variables
   - Use a strong random string (e.g., generate with: `openssl rand -hex 32`)

3. **Configure the cron service:**
   - **URL:** `https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET`
   - **Method:** GET or POST
   - **Schedule:** Every 5 minutes (`*/5 * * * *` or select "Every 5 minutes")
   - **Timeout:** 30 seconds
   - **Expected Response:** JSON with `success: true`

4. **Test the endpoint:**
   ```bash
   curl "https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET"
   ```

**Example Response:**
```json
{
  "success": true,
  "rejected_count": 2,
  "rejected_order_ids": ["uuid1", "uuid2"],
  "message": "Auto-rejected 2 expired order(s)",
  "timestamp": "2025-02-28T10:30:00.000Z"
}
```

---

### Option 2: Manual Trigger (For Testing)

**Best for:** Testing or low-volume scenarios

You can manually trigger the auto-reject function:

**Via API:**
```bash
curl "https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET"
```

**Via Supabase SQL Editor:**
```sql
SELECT auto_reject_expired_pending_cash_orders();
```

---

## Security

The endpoint supports optional authentication via `CRON_SECRET`:

1. Set `CRON_SECRET` in your Vercel environment variables
2. Include it in the cron service URL: `?secret=YOUR_SECRET`
3. The endpoint will reject requests without the correct secret

**Without CRON_SECRET:**
- The endpoint will still work (for testing)
- But it's recommended to set it for production

---

## Monitoring

### Check if cron is working:

1. **View logs in Vercel:**
   - Go to your Vercel project → Functions → `/api/auto-reject-expired-orders`
   - Check for regular invocations every 5 minutes

2. **Check Supabase logs:**
   ```sql
   -- View recent auto-rejections
   SELECT * FROM order_logs 
   WHERE action = 'auto_rejected_expired' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

3. **Check rejected orders:**
   ```sql
   -- View recently rejected expired orders
   SELECT id, created_at, expires_at, rejected_at, rejection_reason
   FROM orders
   WHERE status = 'REJECTED'
     AND rejection_reason LIKE '%expired automatically%'
   ORDER BY rejected_at DESC
   LIMIT 10;
   ```

---

## Troubleshooting

### Issue: Cron job not running

**For pg_cron:**
- Check if extension is enabled: `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
- Check job status: `SELECT * FROM cron.job WHERE jobname = 'auto-reject-expired-orders';`
- Check for errors: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`

**For external cron services:**
- Verify the URL is correct and accessible
- Check if `CRON_SECRET` is set correctly
- Review cron service logs for errors
- Test the endpoint manually with curl

### Issue: Orders not being rejected

1. **Check if orders are actually expired:**
   ```sql
   SELECT id, status, expires_at, created_at
   FROM orders
   WHERE status = 'PENDING_CASH'
     AND expires_at IS NOT NULL
     AND expires_at < NOW();
   ```

2. **Check if function is being called:**
   - Review Vercel function logs
   - Check cron service execution logs

3. **Test the function directly:**
   ```sql
   SELECT auto_reject_expired_pending_cash_orders();
   ```

---

## Recommended Setup

For all projects, we recommend **Option 1 (External Cron Service)** because:
- ✅ Works with any Supabase plan
- ✅ Free and reliable
- ✅ Easy to monitor and debug
- ✅ No database extension dependencies
- ✅ Can be set up in minutes

**Quick Start with cron-job.org:**
1. Sign up at https://cron-job.org (free)
2. Create new cron job
3. URL: `https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET`
4. Schedule: Every 5 minutes
5. Save and activate

---

## Migration Status

After running migrations:
- ✅ `20250228000000-fix-order-expiration-triggers.sql` - Fixes triggers for new orders
- ✅ `20250228000001-setup-auto-reject-cron.sql` - Documentation only (no database changes)

**Note:** The auto-reject functionality works entirely through the API endpoint. No database cron setup is needed - just configure an external cron service to call the API.
