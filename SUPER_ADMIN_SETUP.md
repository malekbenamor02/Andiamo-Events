# Super Admin Setup Guide

## Overview
This guide explains how to set up the super admin account and use the admin management features.

## Step 1: Run Database Migrations

### 1.1 Add Phone Field to Admins Table
Run this SQL in Supabase SQL Editor:
```sql
-- File: supabase/migrations/20250131000001-add-phone-to-admins.sql
ALTER TABLE public.admins 
ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS idx_admins_phone ON public.admins(phone);

COMMENT ON COLUMN public.admins.phone IS 'Phone number for admin contact information';
```

### 1.2 Create Super Admin Account
Run this SQL in Supabase SQL Editor:
```sql
-- File: CREATE_SUPER_ADMIN.sql
INSERT INTO admins (name, email, password, role, is_active) 
VALUES (
  'Super Admin', 
  'malekbenamor02@icloud', 
  '$2b$10$hlJ786UOHTIgrT5ooIHmdOKpufV/4xQ5QHUvtx7IPbfs75MXfjCD6',
  'super_admin',
  true
)
ON CONFLICT (email) DO UPDATE 
SET 
  password = EXCLUDED.password,
  role = 'super_admin',
  updated_at = NOW();
```

**Login Credentials:**
- Email: `malekbenamor02@icloud`
- Password: `022006`

## Step 2: Features

### Super Admin Features
- **Login**: Super admin logs in from the same login page as regular admins (`/admin/login`)
- **Admin Management**: Super admin can add new admins with:
  - Name
  - Email
  - Phone number (optional)
- **Automatic Password Generation**: System generates a secure password for each new admin
- **Email Notification**: Credentials are automatically sent to the new admin's email

### Regular Admin Features
- Regular admins have the same access as before
- They cannot see or access the "Admins" tab in the dashboard
- They cannot add new admins

## Step 3: Using Admin Management

1. **Login as Super Admin**
   - Go to `/admin/login`
   - Use email: `malekbenamor02@icloud`
   - Use password: `022006`

2. **Access Admin Management**
   - After logging in, you'll see an "Admins" tab in the sidebar (only visible to super_admin)
   - Click on "Admins" to view all admins

3. **Add New Admin**
   - Click the "Add Admin" button
   - Fill in:
     - **Name**: Admin's full name
     - **Email**: Admin's email address (required)
     - **Phone**: Admin's phone number (optional)
   - Click "Create Admin"
   - The system will:
     - Generate a secure password
     - Create the admin account
     - Send credentials via email to the new admin

4. **View All Admins**
   - The admin list shows:
     - Name
     - Email
     - Phone
     - Role (Admin or Super Admin)
     - Status (Active/Inactive)
     - Created date

## Files Created/Modified

### Created Files:
1. `CREATE_SUPER_ADMIN.sql` - SQL script to create super admin account
2. `supabase/migrations/20250131000001-add-phone-to-admins.sql` - Migration to add phone field
3. `SUPER_ADMIN_SETUP.md` - This guide

### Modified Files:
1. `src/lib/email.ts` - Added `createAdminCredentialsEmail` function
2. `src/pages/admin/Dashboard.tsx` - Added admin management UI and functionality
3. `api/verify-admin.js` - Updated to return admin role

## Email Template

The admin credentials email includes:
- Welcome message
- Login credentials (email and password)
- Phone number (if provided)
- Security notice
- Link to admin login page

## Security Notes

1. **Password Security**: All passwords are hashed using bcrypt before storage
2. **Role-Based Access**: Only super_admin can access admin management features
3. **Email Delivery**: If email fails to send, the password is shown in a toast notification (for manual delivery)
4. **Session Management**: Admin sessions use JWT tokens stored in httpOnly cookies

## Troubleshooting

### Issue: "Admins" tab not showing
- **Solution**: Make sure you're logged in as super_admin and the role is correctly set in the database

### Issue: Email not sending
- **Solution**: Check email configuration in environment variables. The password will be shown in a toast notification if email fails.

### Issue: Phone field error
- **Solution**: Make sure you've run the migration `20250131000001-add-phone-to-admins.sql` in Supabase

### Issue: Cannot create admin
- **Solution**: 
  - Verify you're logged in as super_admin
  - Check that all required fields (name, email) are filled
  - Check browser console for errors

## Next Steps

After setup:
1. Login as super admin
2. Test creating a new admin account
3. Verify the email is received with credentials
4. Test logging in as the new admin

