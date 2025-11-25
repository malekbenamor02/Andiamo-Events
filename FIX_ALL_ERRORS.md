# Fix All Errors - Complete Guide

## Errors Found

1. **500 Error on `/api/admin-update-application`** - Server error when updating application
2. **400 Error on admins query** - Phone column might not exist
3. **Network errors for site_content and site_logs** - RLS policy or network issues
4. **Service worker fetch errors** - Service worker intercepting Supabase requests

## Solutions

### 1. Fix Admin Update Application (500 Error)

**Problem**: The server route is using anon key which is subject to RLS policies.

**Solution**: Make sure you ran the migration:
```sql
-- File: supabase/migrations/20250131000003-add-unique-constraints-and-fix-approve-reject.sql
```

This migration adds the UPDATE policy for `ambassador_applications`.

**Check if it worked**:
```sql
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'ambassador_applications' AND cmd = 'UPDATE';
```

You should see `ambassador_applications_update` policy.

### 2. Fix Admins Query (400 Error)

**Problem**: Query tries to select `phone` column which might not exist.

**Solution**: Run the migration:
```sql
-- File: supabase/migrations/20250131000001-add-phone-to-admins.sql
```

**Or**: The code now handles this gracefully - it will try with phone first, then fallback to without phone if the column doesn't exist.

### 3. Fix Network Errors for site_content and site_logs

**Problem**: RLS policies might be blocking these queries, or the service worker is interfering.

**Solutions**:

#### Option A: Check RLS Policies
```sql
-- Check if SELECT policies exist
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('site_content', 'site_logs') AND cmd = 'SELECT';
```

#### Option B: Add/Update RLS Policies
If policies don't exist or are blocking, run:
```sql
-- Allow public SELECT on site_content
DROP POLICY IF EXISTS "site_content_select" ON public.site_content;
CREATE POLICY "site_content_select" ON public.site_content
  FOR SELECT USING (true);

-- Allow public SELECT on site_logs  
DROP POLICY IF EXISTS "site_logs_select" ON public.site_logs;
CREATE POLICY "site_logs_select" ON public.site_logs
  FOR SELECT USING (true);

-- Allow public INSERT on site_logs
DROP POLICY IF EXISTS "site_logs_insert" ON public.site_logs;
CREATE POLICY "site_logs_insert" ON public.site_logs
  FOR INSERT WITH CHECK (true);
```

### 4. Fix Service Worker Errors

**Problem**: Service worker is trying to intercept Supabase requests and failing.

**Solution**: The service worker has been updated to:
- Not cache Supabase requests
- Handle errors gracefully
- Let network errors propagate naturally

**If errors persist**, you can disable the service worker temporarily:
1. Open DevTools (F12) → Application tab
2. Go to Service Workers
3. Click "Unregister"

## Quick Fix Checklist

1. ✅ **Run Migration for Approve/Reject**:
   ```sql
   -- File: supabase/migrations/20250131000003-add-unique-constraints-and-fix-approve-reject.sql
   ```

2. ✅ **Run Migration for Phone Column**:
   ```sql
   -- File: supabase/migrations/20250131000001-add-phone-to-admins.sql
   ```

3. ✅ **Check RLS Policies for site_content and site_logs**:
   ```sql
   SELECT tablename, policyname, cmd 
   FROM pg_policies 
   WHERE tablename IN ('site_content', 'site_logs')
   ORDER BY tablename, cmd;
   ```

4. ✅ **Restart Express Server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run server
   # Or
   npm run dev:full
   ```

5. ✅ **Clear Browser Cache**:
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or clear cache in DevTools → Application → Clear storage

## Testing

After applying fixes:

1. **Test Approve/Reject**:
   - Go to Applications tab
   - Click Approve/Reject
   - Should work without 500 error

2. **Test Admins Tab**:
   - Go to Admins tab (if super admin)
   - Should load without 400 error

3. **Test Site Content**:
   - Check browser console
   - Should not see network errors for site_content

4. **Test Service Worker**:
   - Check browser console
   - Should not see service worker fetch errors

## If Issues Persist

### Check Server Logs
Look at the Express server console for detailed error messages.

### Check Browser Console
1. Open DevTools (F12) → Console
2. Look for specific error messages
3. Check Network tab for failed requests

### Check Supabase Logs
1. Go to Supabase Dashboard
2. Check Logs → API Logs
3. Look for RLS policy errors

