# Fix: "Already Applied" Error

## Problem
Everyone gets "Already Applied" error when trying to submit the ambassador application form.

## Root Cause
The duplicate check queries are failing because:
1. **RLS Policies Missing**: The SELECT policies haven't been created in Supabase
2. **Query Failures**: When RLS policies block queries, the code might be treating failures incorrectly

## Solution

### Step 1: Run the Migration (REQUIRED)
You MUST run the SQL migration in Supabase:

1. Open: https://supabase.com/dashboard/project/ykeryyraxmtjunnotoep/sql/new
2. Copy the SQL from: `RUN_THIS_IN_SUPABASE.sql`
3. Paste and click "Run"

This migration will:
- Add `email` column to `ambassador_applications` table
- Create indexes for faster lookups
- Add SELECT policies to allow duplicate checking

### Step 2: Verify Migration
Run `VERIFY_MIGRATION.sql` in Supabase SQL Editor to check if:
- Email column exists
- SELECT policies are created

### Step 3: Test the Application
After running the migration:
1. Try submitting the application form
2. Check browser console (F12) for any errors
3. The form should work correctly

## Current Code Status
The code has been updated to:
- Handle RLS policy errors gracefully
- Allow applications if policies aren't set up (temporary workaround)
- Log detailed information for debugging

## If Error Persists

### Check Browser Console
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try submitting the form
4. Look for errors like:
   - "Error checking ambassadors"
   - "Error checking applications"
   - RLS/permission errors

### Temporary Workaround
If you need to disable duplicate checking temporarily:
1. Open `src/pages/ambassador/Application.tsx`
2. Find: `const ENABLE_DUPLICATE_CHECK = true;`
3. Change to: `const ENABLE_DUPLICATE_CHECK = false;`
4. Save and redeploy

**Note**: This is only for testing. You should run the migration for the proper fix.

## Files Changed
- `src/pages/ambassador/Application.tsx` - Improved error handling
- `supabase/migrations/20250102000000-add-email-to-ambassador-applications.sql` - Migration SQL
- `RUN_THIS_IN_SUPABASE.sql` - SQL to run in Supabase
- `VERIFY_MIGRATION.sql` - SQL to verify migration

## Next Steps
1. ✅ Run the migration in Supabase (REQUIRED)
2. ✅ Verify migration was applied
3. ✅ Test the application form
4. ✅ Check browser console for errors
5. ✅ If still not working, check the console logs for specific error messages

