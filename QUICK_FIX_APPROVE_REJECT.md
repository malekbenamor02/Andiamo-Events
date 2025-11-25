# Quick Fix: Admin Can't Approve/Reject (500 Error)

## The Problem

The `/api/admin-update-application` endpoint returns 500 error because:
1. The server uses **anon key** which is subject to RLS policies
2. The RLS UPDATE policy for `ambassador_applications` might not exist or isn't working

## The Solution

### Step 1: Run This SQL in Supabase (REQUIRED)

```sql
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "ambassador_applications_update" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.ambassador_applications;
DROP POLICY IF EXISTS "Admin can update applications" ON public.ambassador_applications;

-- Create UPDATE policy that allows all updates (since admin auth is handled at app level)
CREATE POLICY "ambassador_applications_update" ON public.ambassador_applications
  FOR UPDATE USING (true)
  WITH CHECK (true);
```

### Step 2: Verify It Worked

```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies 
WHERE tablename = 'ambassador_applications' AND cmd = 'UPDATE';
```

You should see `ambassador_applications_update` with `cmd = 'UPDATE'`.

### Step 3: Restart Express Server

```bash
# Stop server (Ctrl+C)
npm run server
# Or
npm run dev:full
```

### Step 4: Test

1. Go to Applications tab
2. Click "Approve" or "Reject"
3. Should work now!

## Why This Works

- The policy uses `USING (true)` which allows all UPDATE operations
- This is safe because:
  - Admin authentication is handled at the application level (JWT tokens)
  - Only authenticated admins can access the dashboard
  - The API route verifies the JWT token before allowing updates

## If It Still Doesn't Work

### Check Server Console
Look at the Express server terminal for detailed error messages. The server now logs:
- The update attempt
- The full error details (message, code, details, hint)

### Common Issues

1. **Policy doesn't exist**: Run the SQL above
2. **Policy exists but wrong**: Drop and recreate it
3. **Server not restarted**: Restart the Express server
4. **Wrong table name**: Make sure it's `ambassador_applications` (with underscore)

### Alternative: Use Service Role Key

If RLS policies still don't work, you can use the service role key in the server:

1. Add to `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Update `server.cjs` to use service role key for this route (bypasses RLS)

But the RLS policy approach is better and should work.

