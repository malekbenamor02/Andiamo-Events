# Fix Admin Actions - Delete & Approve/Reject Issues

## Problems Found

### 1. Delete Ambassador Not Working
**Issue**: Delete operation shows success notification but ambassador is not actually deleted.

**Root Cause**: Missing RLS DELETE policy for ambassadors table. The migration `20250131000000-fix-rls-performance-and-security.sql` only has SELECT, INSERT, and UPDATE policies, but no DELETE policy.

**Fix**: Run the migration `20250131000002-fix-ambassador-delete-policy.sql` in Supabase SQL Editor.

### 2. Approve/Reject Not Updating Status
**Issue**: After approving or rejecting an application, the status doesn't change in the UI and the application stays visible.

**Root Cause**: Missing or incorrect RLS UPDATE policy for `ambassador_applications` table.

**Fix**: The same migration `20250131000002-fix-ambassador-delete-policy.sql` also fixes the UPDATE policy.

## Solution

### Step 1: Run the Migration
Run this SQL in Supabase SQL Editor:

```sql
-- File: supabase/migrations/20250131000002-fix-ambassador-delete-policy.sql
-- This adds DELETE and UPDATE policies for admins
```

The migration will:
1. Add DELETE policy for ambassadors (allows admins to delete)
2. Fix UPDATE policy for ambassadors (ensures admins can update)
3. Add UPDATE policy for ambassador_applications (allows admins to approve/reject)

### Step 2: Code Improvements Made

#### Delete Ambassador
- Added verification step to check if deletion actually worked
- Added error handling with proper error messages
- Closes delete dialog after successful deletion
- Reverts UI changes if deletion fails

#### Approve/Reject
- Added verification step to check if status update worked
- Added error handling with detailed error messages
- Updates local state immediately for instant UI feedback
- Verifies database update succeeded before showing success

## Testing

After running the migration:

1. **Test Delete Ambassador**:
   - Go to Ambassadors tab
   - Click delete on an ambassador
   - Confirm deletion
   - Check that ambassador is removed from the list
   - Check browser console for any errors

2. **Test Approve Application**:
   - Go to Applications tab
   - Click approve on a pending application
   - Check that:
     - Status badge changes to green (approved)
     - Approve/Reject buttons disappear
     - Application stays in list but with approved status
   - Check browser console for any errors

3. **Test Reject Application**:
   - Go to Applications tab
   - Click reject on a pending application
   - Check that:
     - Status badge changes to red (rejected)
     - Approve/Reject buttons disappear
     - Application stays in list but with rejected status
   - Check browser console for any errors

## If Issues Persist

1. **Check Browser Console** (F12 → Console):
   - Look for RLS policy errors
   - Look for database errors
   - Check if status updates are being logged

2. **Verify RLS Policies**:
   Run this SQL to check policies:
   ```sql
   SELECT tablename, policyname, cmd 
   FROM pg_policies 
   WHERE tablename IN ('ambassadors', 'ambassador_applications')
   ORDER BY tablename, cmd;
   ```

3. **Check Database**:
   - Verify the status was actually updated in the database
   - Check if the ambassador was actually deleted

## Files Modified

1. `supabase/migrations/20250131000002-fix-ambassador-delete-policy.sql` - New migration for RLS policies
2. `src/pages/admin/Dashboard.tsx` - Improved error handling and verification
3. `FIX_ADMIN_ACTIONS.md` - This documentation

