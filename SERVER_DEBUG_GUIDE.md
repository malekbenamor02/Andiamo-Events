# 🔍 Server 500 Error Debugging Guide

## Current Issue
- Frontend calls: `http://localhost:3000/api/admin-login` (POST)
- Vite proxy forwards to: `http://localhost:8082/api/admin-login`
- Server returns: **500 Internal Server Error**

## Quick Checks

### 1. Is the server running?
```bash
# Check if server is running on port 8082
npm run server
```

You should see:
```
API server running on port 8082
```

### 2. Check server console for errors
When you make a request, check the terminal where `npm run server` is running. Look for:
- Error stack traces
- "Supabase not configured" warnings
- Database connection errors

### 3. Test the endpoint directly
```bash
# Test admin login endpoint
curl -X POST http://localhost:8082/api/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

### 4. Check environment variables
The server needs these in `.env`:
- ✅ `SUPABASE_URL` - Should be set
- ✅ `SUPABASE_ANON_KEY` - Should be set  
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Should be set
- ✅ `JWT_SECRET` - Should be set

### 5. Common causes of 500 errors

#### A. Supabase client not initialized
**Symptom:** "Supabase not configured" error
**Fix:** Ensure `.env` has all Supabase variables and restart server

#### B. Database connection error
**Symptom:** Database query fails
**Fix:** Check Supabase project is active, RLS policies allow access

#### C. Missing middleware
**Symptom:** `req.admin` is undefined in `verifyAdmin`
**Fix:** Check `requireAdminAuth` middleware is working

#### D. Error in controller not caught
**Symptom:** Unhandled exception
**Fix:** Check server console for full error stack

## Next Steps

1. **Check server logs** - Look at terminal output when making request
2. **Test with curl** - Bypass frontend to isolate issue
3. **Check database** - Verify `admins` table exists and has data
4. **Verify middleware** - Ensure auth middleware is working

## Expected Server Response

**Success (200):**
```json
{
  "success": true,
  "message": "Login successful"
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

**Error (500):**
```json
{
  "success": false,
  "error": "Internal server error",
  "details": "..."
}
```

