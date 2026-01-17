# Step-by-Step Guide: Setting Up External Cron Service

This guide will walk you through setting up an external cron service to automatically reject expired orders every 5 minutes.

## Quick Setup with cron-job.org (Free)

### Step 1: Sign Up for cron-job.org

1. Go to https://cron-job.org
2. Click **"Sign Up"** or **"Create Account"**
3. Fill in:
   - Email address
   - Password
   - Confirm password
4. Click **"Create Account"**
5. Check your email and verify your account (if required)

---

### Step 2: Get Your API Endpoint URL

1. Your API endpoint is:
   ```
   https://your-domain.com/api/auto-reject-expired-orders
   ```
   
   **Replace `your-domain.com` with your actual domain**, for example:
   - `https://andiamoevents.com/api/auto-reject-expired-orders`
   - `https://your-app.vercel.app/api/auto-reject-expired-orders`

2. **Optional but Recommended:** Set up a secret for security:
   - Go to your Vercel project dashboard
   - Go to **Settings** → **Environment Variables**
   - Add a new variable:
     - **Name:** `CRON_SECRET`
     - **Value:** Generate a random string (see below)
   - Click **Save**
   - **Redeploy** your application for the variable to take effect

   **To generate a secure secret:**
   - On Windows (PowerShell): `-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})`
   - On Mac/Linux: `openssl rand -hex 32`
   - Or use an online generator: https://randomkeygen.com/

3. Your full URL with secret will be:
   ```
   https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET_HERE
   ```

---

### Step 3: Create the Cron Job

1. **Log in** to cron-job.org
2. Click **"Create cronjob"** or **"New Cronjob"** button
3. Fill in the form:

   **Title:**
   ```
   Auto-Reject Expired Orders
   ```

   **Address (URL):**
   ```
   https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET_HERE
   ```
   (Replace with your actual domain and secret)

   **Schedule:**
   - Select **"Every 5 minutes"** from the dropdown
   - Or use cron syntax: `*/5 * * * *`

   **Request Method:**
   - Select **"GET"** (or "POST" - both work)

   **Timeout:**
   - Set to **30 seconds**

   **Expected Status Code:**
   - Enter **200**

   **Notifications (Optional):**
   - You can enable email notifications if the job fails
   - Enter your email address

4. Click **"Create cronjob"** or **"Save"**

---

### Step 4: Test the Cron Job

1. After creating the cron job, you'll see it in your dashboard
2. Click **"Run now"** or **"Test"** button to test it immediately
3. Check the **"Last execution"** or **"Logs"** section
4. You should see:
   - Status: **200 OK** (green)
   - Response should contain: `{"success": true, ...}`

5. **Test manually with curl** (optional):
   ```bash
   curl "https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET"
   ```
   
   Expected response:
   ```json
   {
     "success": true,
     "rejected_count": 0,
     "rejected_order_ids": [],
     "message": "Auto-rejected 0 expired order(s)",
     "timestamp": "2025-02-28T10:30:00.000Z"
   }
   ```

---

### Step 5: Verify It's Working

1. **Wait 5 minutes** after creating the cron job
2. Check the **"Last execution"** time in cron-job.org dashboard
3. It should show recent executions every 5 minutes
4. Check your Vercel function logs:
   - Go to Vercel Dashboard → Your Project → **Functions** tab
   - Click on `/api/auto-reject-expired-orders`
   - You should see invocations every 5 minutes

5. **Check if orders are being rejected:**
   - Go to your Admin Dashboard
   - Look at the orders list
   - Expired orders should change from "Expired" to "Rejected" status

---

## Alternative: EasyCron Setup

If you prefer EasyCron:

1. Sign up at https://www.easycron.com
2. Click **"Add New Cron Job"**
3. Fill in:
   - **Cron Job Title:** Auto-Reject Expired Orders
   - **URL:** `https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET`
   - **Schedule:** Select "Every 5 minutes"
   - **HTTP Method:** GET
4. Click **"Save"**

---

## Alternative: UptimeRobot Setup

UptimeRobot offers free monitoring + cron:

1. Sign up at https://uptimerobot.com
2. Go to **"Monitors"** → **"Add New Monitor"**
3. Select **"HTTP(s)"** type
4. Fill in:
   - **Friendly Name:** Auto-Reject Expired Orders
   - **URL:** `https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET`
   - **Monitoring Interval:** 5 minutes
5. Click **"Create Monitor"**

---

## Troubleshooting

### Issue: Cron job shows "Failed" or "Error"

**Check:**
1. Is the URL correct? Test it manually in a browser
2. Is `CRON_SECRET` set correctly? Make sure it matches in both places
3. Is your Vercel deployment active?
4. Check Vercel function logs for errors

### Issue: Cron job runs but orders aren't rejected

**Check:**
1. Are there actually expired orders?
   - Go to Admin Dashboard → Check orders with "Expired" badge
2. Test the endpoint manually:
   ```bash
   curl "https://your-domain.com/api/auto-reject-expired-orders?secret=YOUR_SECRET"
   ```
3. Check the response - does it show `rejected_count > 0`?
4. Check Supabase logs:
   ```sql
   SELECT * FROM order_logs 
   WHERE action = 'auto_rejected_expired' 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

### Issue: "Unauthorized" error

**Solution:**
- Make sure `CRON_SECRET` is set in Vercel environment variables
- Make sure the secret in the URL matches the one in Vercel
- Redeploy your Vercel app after adding the environment variable

### Issue: Cron job not running on schedule

**Check:**
1. Is the cron job **enabled/active** in cron-job.org?
2. Check the schedule - should be "Every 5 minutes" or `*/5 * * * *`
3. Free tier limitations - some services have limits on free accounts
4. Check cron-job.org status page for service issues

---

## Security Best Practices

1. **Always use CRON_SECRET** in production
2. **Don't share your secret** publicly
3. **Use HTTPS** (your Vercel domain should already use HTTPS)
4. **Monitor the logs** regularly to ensure it's working
5. **Set up email notifications** for failed cron jobs

---

## Cost

- **cron-job.org:** Free (up to 2 cron jobs on free tier)
- **EasyCron:** Free tier available (limited jobs)
- **UptimeRobot:** Free (50 monitors)

All of these are sufficient for your needs!

---

## Next Steps

After setting up the cron service:

1. ✅ Test it manually first
2. ✅ Wait 5 minutes and verify it's running automatically
3. ✅ Check your orders list - expired orders should be rejected
4. ✅ Monitor for a few hours to ensure it's working consistently

Your expired orders will now be automatically rejected every 5 minutes! 🎉
