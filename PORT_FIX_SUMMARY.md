# 🔧 Port Mismatch Fix

## Issue Found
- **Server running on:** Port 8081 (from `.env` file)
- **Vite proxy configured for:** Port 8082
- **Result:** Frontend requests were failing because they couldn't reach the server

## Fix Applied ✅
Updated `vite.config.ts` to proxy to port 8081 (matching the actual server port).

## Next Steps

### 1. Restart Frontend Dev Server
```bash
# Stop current dev server (Ctrl+C)
npm run dev
```

The Vite dev server needs to restart to pick up the new proxy configuration.

### 2. Test Login Again
After restarting, try the admin login again. The proxy should now correctly forward requests to port 8081.

### 3. Check Server Console
You should now see request logs in the server console:
```
[2025-02-02T...] POST /api/admin-login
Request body: { "email": "...", "password": "..." }
```

If there's still a 500 error, the server console will show:
- The exact error message
- Full stack trace
- What failed (Supabase, database, JWT, etc.)

## Alternative: Change Server Port to 8082

If you prefer to keep the server on 8082, update your `.env` file:
```env
PORT=8082
```

Then restart the server:
```bash
npm run server
```

---

**The port mismatch is now fixed. Restart the frontend dev server and try again!**

