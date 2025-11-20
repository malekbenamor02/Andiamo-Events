# Admin Login Connection Error - Fix Guide

## Problem
Admin login shows "Connection Error - Network error. Please check your connection."

## Root Causes

### 1. Environment Variables Missing in Vercel (MOST LIKELY)
The API route needs these environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `JWT_SECRET` - Secret key for JWT tokens

**Fix**: 
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add these variables for Production, Preview, and Development:
   - `SUPABASE_URL` = your Supabase URL
   - `SUPABASE_ANON_KEY` = your Supabase anon key
   - `JWT_SECRET` = a strong random secret (e.g., generate with: `openssl rand -base64 32`)
3. Redeploy after adding variables

### 2. API Route Not Working
The `/api/admin-login` route might not be deployed correctly.

**Test**:
1. Visit: `https://andiamo-events.vercel.app/api/health`
   - Should return JSON
   - Check if environment variables are set
2. Visit: `https://andiamo-events.vercel.app/api/test`
   - Should return a simple JSON response

### 3. Admin Account Doesn't Exist
Make sure you have an admin account in the database.

**Check**: Run this in Supabase SQL Editor:
```sql
SELECT * FROM admins;
```

**Create Admin**: If no admin exists, you need to create one. The password must be hashed with bcrypt.

### 4. Vercel Rewrite Pattern
The rewrite pattern might be interfering with API routes.

**Current fix**: The `vercel.json` has been updated to exclude `/api` routes from the rewrite.

## Quick Diagnostic Steps

1. **Check Vercel Function Logs**:
   - Go to Vercel Dashboard → Your Project → Functions
   - Click on `api/admin-login`
   - Check the logs for errors

2. **Test API Directly**:
   - Open browser DevTools (F12) → Network tab
   - Try to login
   - Check the request to `/api/admin-login`
   - Look at the response status and body

3. **Check Environment Variables**:
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Verify all required variables are set
   - Make sure they're set for the correct environment (Production)

4. **Verify Admin Account**:
   - Check if admin account exists in Supabase
   - Verify the email and password are correct

## Expected Behavior

After fixing:
1. API route should respond with JSON
2. Login should set a cookie
3. Redirect to `/admin` dashboard
4. Dashboard should load successfully

## If Still Not Working

Check the browser console (F12) for:
- Network errors
- CORS errors
- Response status codes
- Response body content

Check Vercel function logs for:
- Environment variable errors
- Supabase connection errors
- Authentication errors

