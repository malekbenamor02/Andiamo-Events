# Fix: Super Admin Can't Create Admin (Phone Column Error)

## The Problem

Error: "Could not find the 'phone' column of 'admins' in the schema cache"

This happens because:
1. The `phone` column doesn't exist in the `admins` table
2. The code tries to insert a phone value, causing the error

## Solution

### Option 1: Add Phone Column (Recommended)

Run this SQL in Supabase SQL Editor:

```sql
-- File: supabase/migrations/20250131000001-add-phone-to-admins.sql

ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_admins_phone ON public.admins(phone);

COMMENT ON COLUMN public.admins.phone IS 'Phone number for admin contact information';
```

### Option 2: Code Already Handles It

The code has been updated to:
- Try to insert with phone first
- If phone column doesn't exist, automatically retry without phone
- Admin will be created successfully (just without phone number)

## Also Run: INSERT Policy Fix

Make sure you also run `FIX_ADMIN_INSERT_POLICY.sql` to allow INSERT operations:

```sql
-- Create INSERT policy for admins
CREATE POLICY "admins_insert" ON public.admins
  FOR INSERT 
  WITH CHECK (true);
```

## Testing

After running the migrations:

1. Go to Admins tab (as super admin)
2. Click "Add Admin"
3. Fill in:
   - Name: Test Admin
   - Email: test@example.com
   - Phone: (optional, can leave empty)
4. Click "Create"
5. Should work now!

## What Changed

1. ✅ Code now handles missing phone column gracefully
2. ✅ Automatically retries without phone if column doesn't exist
3. ✅ Better error messages
4. ✅ INSERT policy fix for admins table

