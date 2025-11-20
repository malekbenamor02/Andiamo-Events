# Admin Login Troubleshooting Guide

## Issue: Connection Error when trying to login

## Possible Causes:

### 1. Environment Variables Not Set in Vercel
The admin login requires these environment variables in Vercel:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key  
- `JWT_SECRET` - Secret key for JWT tokens

**Check**: Go to Vercel Dashboard → Your Project → Settings → Environment Variables

### 2. API Route Not Deployed
The `/api/admin-login` route should be automatically deployed as a serverless function.

**Check**: 
- Go to Vercel Dashboard → Your Project → Functions
- Look for `api/admin-login` function
- Check if it's deployed and has any errors

### 3. CORS or Network Issues
The API might be blocking requests or there might be a network issue.

**Check**: 
- Open browser DevTools (F12) → Network tab
- Try to login and see what error appears
- Check if the request to `/api/admin-login` is being made
- Check the response status and body

### 4. Admin Account Doesn't Exist
Make sure you have an admin account in the `admins` table.

**Check**: Run this SQL in Supabase:
```sql
SELECT * FROM admins;
```

If no admin exists, create one.

## Quick Test:

1. **Test API Health**: Visit `https://your-domain.vercel.app/api/health`
   - Should return JSON with environment variable status

2. **Test Admin Login API**: Try calling the API directly:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/admin-login \
     -H "Content-Type: application/json" \
     -d '{"email":"your-email@example.com","password":"your-password"}'
   ```

3. **Check Browser Console**: 
   - Open DevTools (F12)
   - Go to Console tab
   - Try to login
   - Check for any error messages

## Solution Steps:

1. **Verify Environment Variables in Vercel**:
   - Go to Vercel Dashboard
   - Project Settings → Environment Variables
   - Ensure these are set for Production:
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
     - `JWT_SECRET`

2. **Verify Admin Account Exists**:
   - Run SQL in Supabase to check if admin exists
   - If not, create one using the setup script or manually

3. **Check API Route**:
   - Verify the API route is deployed
   - Check Vercel function logs for errors

4. **Test Directly**:
   - Use the health endpoint to verify API is working
   - Check browser console for specific errors

