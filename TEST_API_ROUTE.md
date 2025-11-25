# Testing the Admin Update Application API Route

## The Route is POST Only

The `/api/admin-update-application` route only accepts **POST** requests, not GET. When you visit it in the browser, you're making a GET request, which is why you see "Cannot GET".

## How to Test

### Option 1: Restart the Server (Required)
The route was just added to `server.cjs`. You need to restart the Express server:

1. **Stop the current server** (Ctrl+C in the terminal where it's running)
2. **Restart it**:
   ```bash
   npm run server
   ```
   Or if using full dev:
   ```bash
   npm run dev:full
   ```

### Option 2: Test with Browser DevTools
1. Open your admin dashboard
2. Open DevTools (F12) → Network tab
3. Try to approve/reject an application
4. Look for the request to `/api/admin-update-application`
5. Check if it's successful (200) or has an error

### Option 3: Test with curl (Command Line)
```bash
curl -X POST http://localhost:8082/api/admin-update-application \
  -H "Content-Type: application/json" \
  -H "Cookie: adminToken=YOUR_TOKEN_HERE" \
  -d '{"applicationId":"uuid-here","status":"approved"}'
```

## What the Route Does

The route:
1. ✅ Verifies you're logged in as admin (checks JWT token)
2. ✅ Updates the application status (approved/rejected)
3. ✅ Returns the updated application data

## If It Still Doesn't Work

### Check 1: Server is Running
```bash
# Should show port 8082 is listening
netstat -ano | findstr :8082
```

### Check 2: Route is Registered
After restarting, check the server console - it should start without errors.

### Check 3: Check Browser Console
1. Open DevTools (F12) → Console
2. Try to approve/reject
3. Look for error messages
4. Check Network tab for the actual request/response

### Check 4: Verify RLS Policies
Make sure you ran the migration:
```sql
-- File: supabase/migrations/20250131000003-add-unique-constraints-and-fix-approve-reject.sql
```

This migration includes the UPDATE policy for `ambassador_applications`.

## Expected Behavior

When you click "Approve" or "Reject" in the admin dashboard:
1. Frontend sends POST to `/api/admin-update-application`
2. Server verifies admin authentication
3. Server updates application status in database
4. Server returns success response
5. Frontend updates UI to show new status

If any step fails, check the browser console for the specific error.

