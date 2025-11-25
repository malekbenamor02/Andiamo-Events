# Fix: Approve/Reject Using API Route

## Problem
Admin can't approve or reject applications because the frontend Supabase client uses the anon key, which is subject to RLS policies. Even with `USING (true)` policies, there may be conflicts or the migration wasn't run.

## Solution
Created an API route that uses the **service role key** to bypass RLS policies entirely. This is the recommended approach for admin operations.

## What Was Changed

### 1. New API Route: `api/admin-update-application.js`
- Uses **service role key** (bypasses RLS)
- Verifies admin JWT token
- Updates application status (approve/reject)
- Returns proper error messages

### 2. Updated Frontend: `src/pages/admin/Dashboard.tsx`
- `handleApprove()` now calls `/api/admin-update-application` instead of direct Supabase call
- `handleReject()` now calls `/api/admin-update-application` instead of direct Supabase call
- Better error handling with specific error messages

## Setup Required

### Step 1: Add Environment Variable (REQUIRED)
Add this to your **Vercel environment variables**:

```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**How to get the service role key:**
1. Go to Supabase Dashboard
2. Go to Settings → API
3. Copy the **service_role** key (NOT the anon key)
4. Add it to Vercel as `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ IMPORTANT**: The service role key bypasses ALL RLS policies. Keep it secret and only use it in server-side code (API routes).

### Step 2: Deploy
After adding the environment variable:
1. Redeploy your Vercel project
2. The API route will now work

## How It Works

### Before (Direct Supabase Call):
```
Frontend → Supabase (anon key) → RLS Policy Check → ❌ May fail
```

### After (API Route):
```
Frontend → API Route → Supabase (service role key) → ✅ Bypasses RLS
```

## Testing

1. **Approve Application**:
   - Go to Applications tab
   - Click "Approve" on a pending application
   - ✅ Should work without errors
   - ✅ Status should change to "Approved"
   - ✅ Buttons should disappear

2. **Reject Application**:
   - Go to Applications tab
   - Click "Reject" on a pending application
   - ✅ Should work without errors
   - ✅ Status should change to "Rejected"
   - ✅ Buttons should disappear

## If It Still Doesn't Work

### Check 1: Environment Variable
```bash
# In Vercel Dashboard → Settings → Environment Variables
# Make sure SUPABASE_SERVICE_ROLE_KEY exists
```

### Check 2: API Route Logs
1. Go to Vercel Dashboard → Your Project → Functions
2. Click on `api/admin-update-application`
3. Check the logs for errors

### Check 3: Browser Console
1. Open DevTools (F12) → Console
2. Try to approve/reject
3. Look for error messages
4. Check Network tab → Look for `/api/admin-update-application` request

### Check 4: Verify Service Role Key
Run this in Supabase SQL Editor (using service role key):
```sql
SELECT * FROM ambassador_applications LIMIT 1;
```
If this works, your service role key is correct.

## Security Notes

- ✅ **Service role key is only used in API routes** (server-side)
- ✅ **API route verifies admin JWT token** before allowing updates
- ✅ **Frontend never sees the service role key**
- ✅ **RLS policies still protect direct database access**

## Alternative: Fix RLS Policies

If you prefer to use direct Supabase calls (without API route), you can:

1. Run the migration: `20250131000002-fix-ambassador-delete-policy.sql`
2. Run the migration: `20250131000003-add-unique-constraints-and-fix-approve-reject.sql`
3. Verify policies exist:
   ```sql
   SELECT policyname, cmd 
   FROM pg_policies 
   WHERE tablename = 'ambassador_applications' AND cmd = 'UPDATE';
   ```

However, using the API route with service role key is **more reliable** and **recommended** for admin operations.

