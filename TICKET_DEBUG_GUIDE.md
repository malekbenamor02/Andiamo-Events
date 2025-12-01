# Ticket Generation Debugging Guide

## Quick Checklist

### 1. Check Environment Variables
Make sure your `.env` file has:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # IMPORTANT for storage!
```

**How to get Service Role Key:**
1. Go to Supabase Dashboard
2. Go to **Settings** → **API**
3. Copy the **service_role** key (NOT the anon key)
4. Add it to your `.env` file as `SUPABASE_SERVICE_ROLE_KEY`

### 2. Install Packages
Make sure you've installed the required packages:
```bash
npm install
```

This installs `qrcode` and `uuid` packages.

### 3. Restart Server
After adding the service role key, restart your server:
```bash
npm run server
```

### 4. Check Server Logs
When you mark an order as COMPLETED, you should see logs like:
```
🎫 Ticket generation request received: { orderId: '...' }
📋 Order status check: status=COMPLETED, source=platform_cod, isPaidStatus=true
✅ Found 1 pass(es) for order ...
🎫 Starting ticket generation...
📤 Uploading QR code to storage: tickets/.../...
✅ QR code uploaded successfully
💾 Creating ticket entry in database...
✅ Ticket created: ...
📧 Preparing to send email to: ...
✅ Email sent successfully
🎉 Ticket generation completed successfully!
```

### 5. Check Browser Console
Open browser DevTools (F12) → Console tab. You should see:
```
🎫 Starting ticket generation for order: ...
📦 Ticket generation response: { success: true, ticketsCount: ... }
✅ Tickets generated successfully
```

## Common Issues

### Issue: "No tickets in database"
**Possible causes:**
1. Service role key not set → Storage upload fails → Ticket creation skipped
2. RLS policies blocking inserts → Check tickets table policies
3. Order status not COMPLETED → Check order status

**Solution:**
- Add `SUPABASE_SERVICE_ROLE_KEY` to `.env`
- Restart server
- Check server logs for errors

### Issue: "No QR codes"
**Possible causes:**
1. Storage upload failing → Check service role key
2. Storage bucket doesn't exist → Run migration `20250201000026-create-tickets-storage-bucket.sql`
3. Storage policies not set → Create policies via Dashboard

**Solution:**
- Verify storage bucket exists: Storage → tickets bucket
- Verify storage policies are created (see STORAGE_POLICIES_SETUP.md)
- Check server logs for upload errors

### Issue: "Email not sent"
**Possible causes:**
1. Email credentials not set → Check EMAIL_USER and EMAIL_PASS
2. Email service not configured → Check server logs
3. Ticket generation failed → Email only sent if tickets created

**Solution:**
- Check `.env` has email credentials (EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT)
- Check server logs for email errors
- Verify tickets were created first

## Testing Steps

1. **Mark an order as COMPLETED** in ambassador dashboard
2. **Check browser console** for logs
3. **Check server terminal** for detailed logs
4. **Check database:**
   ```sql
   SELECT * FROM tickets WHERE order_id = 'your-order-id';
   ```
5. **Check storage:** Go to Storage → tickets bucket → Look for files
6. **Check email:** Customer should receive email with QR codes

## What to Look For

### ✅ Success Indicators:
- Server logs show "✅ Ticket created"
- Database has ticket entries
- Storage has QR code images
- Email sent successfully

### ❌ Error Indicators:
- Server logs show "❌ Error..."
- No tickets in database
- No files in storage
- No email sent

## Next Steps

If you see errors in the logs, share:
1. The error message from server logs
2. The error message from browser console
3. Whether tickets table exists
4. Whether storage bucket exists
5. Whether service role key is set

