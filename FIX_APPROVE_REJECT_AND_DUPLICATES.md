# Fix: Approve/Reject & Duplicate Prevention

## Issues
1. **Admin can't approve or reject applications** - Status doesn't update
2. **Applications should not have duplicate emails or phone numbers** - Need database-level constraints

## Solutions

### Step 1: Run Migration for Approve/Reject (REQUIRED)
Run this SQL in Supabase SQL Editor:

```sql
-- File: supabase/migrations/20250131000002-fix-ambassador-delete-policy.sql
```

This adds the UPDATE policy for `ambassador_applications` table.

### Step 2: Run Migration for Duplicate Prevention (REQUIRED)
Run this SQL in Supabase SQL Editor:

```sql
-- File: supabase/migrations/20250131000003-add-unique-constraints-and-fix-approve-reject.sql
```

This migration:
- ✅ Cleans up existing duplicate applications (keeps most recent)
- ✅ Adds unique constraints on phone_number (for pending/approved only)
- ✅ Adds unique constraints on email (for pending/approved only)
- ✅ Ensures UPDATE policy exists for approve/reject

**Why partial unique indexes?**
- We allow multiple **rejected** applications with the same phone/email
- We only prevent duplicates for **pending** and **approved** statuses
- This is the correct approach for your use case

### Step 3: Verify Migrations Ran
Run this SQL to verify:

```sql
-- Check unique indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'ambassador_applications'
  AND indexname LIKE '%unique%'
ORDER BY indexname;

-- Check UPDATE policy
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE tablename = 'ambassador_applications'
  AND cmd = 'UPDATE';
```

You should see:
- `idx_ambassador_applications_phone_unique` (unique index)
- `idx_ambassador_applications_email_unique` (unique index)
- `ambassador_applications_update` (UPDATE policy)

## How It Works

### Duplicate Prevention (Two Layers)

#### Layer 1: Application-Level Check (Frontend)
The application form (`src/pages/ambassador/Application.tsx`) checks for duplicates before submission:
- Checks `ambassadors` table for existing phone/email
- Checks `ambassador_applications` table for pending/approved applications
- Shows user-friendly error messages
- Prevents form submission if duplicate found

#### Layer 2: Database-Level Constraints (Backend)
The database enforces uniqueness at the SQL level:
- Unique index on `phone_number` (for pending/approved only)
- Unique index on `email` (for pending/approved only)
- Database will reject duplicate inserts even if frontend check is bypassed
- Provides data integrity guarantee

### Approve/Reject Flow

1. **Admin clicks Approve/Reject**
2. **Code updates application status** in `ambassador_applications` table
3. **RLS policy allows UPDATE** (if migration was run)
4. **UI updates immediately** for instant feedback
5. **Status badge changes** (green for approved, red for rejected)
6. **Buttons disappear** (only pending applications show approve/reject buttons)

## Testing

### Test Approve/Reject:
1. Go to Applications tab
2. Find a pending application
3. Click "Approve"
4. ✅ Status should change to "Approved" (green badge)
5. ✅ Approve/Reject buttons should disappear
6. ✅ Email should be sent to applicant

### Test Duplicate Prevention:
1. Try to submit application with existing phone number
2. ✅ Should show error: "You have already submitted an application"
3. Try to submit application with existing email
4. ✅ Should show error: "An application with this email already exists"
5. Try to submit with same phone/email after rejection
6. ✅ Should work (rejected applications don't block new submissions)

## If Issues Persist

### Approve/Reject Not Working:
1. **Check Browser Console** (F12 → Console):
   - Look for RLS policy errors
   - Look for "Permission denied" messages
   - Check if migration was run

2. **Verify Policy Exists**:
   ```sql
   SELECT policyname, cmd 
   FROM pg_policies 
   WHERE tablename = 'ambassador_applications' AND cmd = 'UPDATE';
   ```

3. **If policy doesn't exist**: Run migration `20250131000002-fix-ambassador-delete-policy.sql`

### Duplicates Still Allowed:
1. **Check Browser Console**:
   - Look for errors in duplicate check
   - Check if queries are being blocked by RLS

2. **Verify Unique Indexes**:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'ambassador_applications' 
   AND indexname LIKE '%unique%';
   ```

3. **If indexes don't exist**: Run migration `20250131000003-add-unique-constraints-and-fix-approve-reject.sql`

## Files Modified

1. `supabase/migrations/20250131000002-fix-ambassador-delete-policy.sql` - UPDATE policy for applications
2. `supabase/migrations/20250131000003-add-unique-constraints-and-fix-approve-reject.sql` - Unique constraints
3. `src/pages/ambassador/Application.tsx` - Already has duplicate checking (no changes needed)
4. `src/pages/admin/Dashboard.tsx` - Already has approve/reject logic (no changes needed)

## Important Notes

- **Rejected applications don't block new submissions** - This is intentional
- **Database constraints are the final safeguard** - Even if frontend check fails, database will prevent duplicates
- **Migration cleans up existing duplicates** - Keeps the most recent application, deletes older ones
- **Both migrations must be run** - One for approve/reject, one for duplicate prevention

