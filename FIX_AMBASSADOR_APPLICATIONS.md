# Fix Ambassador Applications Issue

## Problem
Ambassador applications are not showing up in the admin dashboard. The issue is caused by:
1. Missing email column in the `ambassador_applications` table
2. Restrictive RLS (Row Level Security) policies blocking insertions and selections

## Solution Steps

### Step 1: Run the Database Fix Script
1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `check-table-structure.sql` into the editor
4. Click "Run" to execute the script

This script will:
- Add the missing email column to the table
- Fix the RLS policies to allow proper access
- Test the functionality

### Step 2: Test the Fix
After running the SQL script, test the functionality:

1. **Test Application Submission:**
   - Go to your website's Ambassador page
   - Fill out and submit an application
   - Check the browser console for any errors
   - You should see a success message

2. **Test Admin Dashboard:**
   - Go to your admin dashboard
   - Navigate to the "Applications" tab
   - You should now see the submitted applications
   - Check the browser console for any errors

### Step 3: Verify the Fix
Run the test script to verify everything is working:

```bash
node test-ambassador-applications.cjs
```

You should see:
- ✅ Database connection successful
- ✅ Successfully fetched X applications
- ✅ Test application inserted successfully

## What the Fix Does

### Database Changes:
1. **Adds Email Column:** The `ambassador_applications` table gets an `email` column if it doesn't exist
2. **Fixes RLS Policies:** Creates comprehensive policies that allow:
   - Anyone to insert applications (for the form)
   - Anyone to view applications (for the admin dashboard)
   - Anyone to update applications (for approval/rejection)
   - Anyone to delete applications (for admin cleanup)

### Code Changes:
1. **Better Error Logging:** Added detailed console logging to help debug issues
2. **TypeScript Fix:** Made email field optional in the interface to prevent type errors

## Troubleshooting

### If applications still don't show up:

1. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Go to Console tab
   - Look for any error messages when loading the admin dashboard

2. **Check Network Tab:**
   - In Developer Tools, go to Network tab
   - Refresh the admin dashboard
   - Look for failed requests to Supabase

3. **Verify Database:**
   - Run the test script again
   - Check if applications are actually being saved

### Common Issues:

1. **"new row violates row-level security policy"**
   - This means the RLS policies are still restrictive
   - Run the `check-table-structure.sql` script again

2. **"column 'email' does not exist"**
   - The email column wasn't added properly
   - Run the `add-email-to-applications.sql` script

3. **"TypeError: fetch failed"**
   - Network connectivity issue
   - Check your internet connection
   - Verify Supabase credentials are correct

## Files Modified

1. **`check-table-structure.sql`** - Database fix script
2. **`src/pages/Ambassador.tsx`** - Added better error logging
3. **`src/pages/admin/Dashboard.tsx`** - Added better error logging and fixed TypeScript interface
4. **`test-ambassador-applications.cjs`** - Test script with correct credentials

## Next Steps

After fixing this issue:

1. **Test the Complete Flow:**
   - Submit an ambassador application
   - Verify it appears in admin dashboard
   - Test approval/rejection functionality
   - Verify email notifications are sent

2. **Monitor for Issues:**
   - Check browser console regularly
   - Monitor application submissions
   - Test admin dashboard functionality

3. **Consider Security:**
   - The current RLS policies allow public access
   - Consider implementing proper authentication for admin access
   - Add rate limiting for application submissions

## Support

If you continue to have issues:
1. Check the browser console for specific error messages
2. Run the test script and share the output
3. Verify that the SQL script ran successfully in Supabase
4. Check if there are any network connectivity issues 