# Admin Role System Explanation

## Why Only One Admin Can See Certain Features

The system uses a **role-based access control** system with two admin roles:

1. **`admin`** - Regular admin (default role)
2. **`super_admin`** - Super admin with elevated privileges

## How It Works

### 1. Role Storage
Admin roles are stored in the `admins` table in the database:
```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  ...
);
```

### 2. Role Assignment During Login
When an admin logs in:
- The system reads the `role` from the database
- Encodes it in the JWT token: `{ id, email, role }`
- Stores it in a cookie for session management

### 3. Role Verification
The frontend checks the role via:
- `useAdminRole()` hook → calls `/api/verify-admin`
- Returns: `{ isSuperAdmin: boolean, role: string }`
- Features are conditionally rendered based on `isSuperAdmin`

## Current Situation

**Only one admin can see super admin features because:**
- Only one admin account has `role = 'super_admin'` in the database
- Other admins have `role = 'admin'` (the default)
- Super admin features check: `role === 'super_admin'`

## How to Check Current Admin Roles

### Option 1: Via Supabase Dashboard
1. Go to your Supabase project
2. Navigate to **Table Editor** → `admins` table
3. Check the `role` column for each admin

### Option 2: Via SQL Query
```sql
SELECT id, email, name, role, is_active 
FROM admins 
ORDER BY role, email;
```

## How to Update Admin Roles

### Make an Admin a Super Admin:
```sql
UPDATE admins 
SET role = 'super_admin' 
WHERE email = 'admin@example.com';
```

### Make a Super Admin a Regular Admin:
```sql
UPDATE admins 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

**Important:** After updating roles in the database:
1. The admin must **log out and log back in** for the change to take effect
2. The JWT token contains the role, so a new login is required to get a new token with the updated role

## Features That Are Super Admin Only

Based on the codebase analysis, these features require `super_admin` role:

1. **Official Invitations** (planned feature) - Only super admins can send official invitations
2. Any other features that check: `isSuperAdmin === true` or `role === 'super_admin'`

## Why Super Admin Restrictions?

Super admin restrictions are used for:
- **Security**: Sensitive operations (like sending official invitations) should be limited
- **Control**: Prevents accidental changes by multiple admins
- **Audit**: Clear separation of who can perform critical actions

## Solutions

### If You Want Multiple Super Admins:
1. Update the database to set `role = 'super_admin'` for the admins you want
2. Have those admins log out and log back in
3. They will now see super admin features

### If You Want All Admins to See a Feature:
1. Remove the super admin check from the frontend component
2. Remove the super admin check from the backend API endpoint
3. Update RLS policies if needed

### If You Want to Check Who Is Super Admin:
Run this query:
```sql
SELECT email, name, role, created_at 
FROM admins 
WHERE role = 'super_admin';
```

## Troubleshooting

### Admin Can't See Super Admin Features:
1. ✅ Check database: `SELECT role FROM admins WHERE email = '...'`
2. ✅ Verify role is `'super_admin'` (not `'admin'`)
3. ✅ Have admin **log out and log back in** (JWT token needs refresh)
4. ✅ Check browser console for errors
5. ✅ Verify `/api/verify-admin` returns correct role

### Role Not Updating:
- JWT tokens are cached for 1 hour
- Admin must log out and log back in to get a new token with updated role
- Clear browser cookies if needed

## Example: Making Multiple Super Admins

```sql
-- Make specific admins super admins
UPDATE admins 
SET role = 'super_admin' 
WHERE email IN ('admin1@example.com', 'admin2@example.com');

-- Verify the update
SELECT email, role FROM admins WHERE role = 'super_admin';
```

After running this:
1. Those admins need to **log out**
2. **Log back in**
3. They will now have super admin access
