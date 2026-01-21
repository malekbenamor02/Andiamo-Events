# CORS Misconfiguration Fix Summary

## Changes Made

### 1. Fixed CORS Utility (`api/utils/cors.js`)
- **Before**: Returned `'*'` when no Origin header was present
- **After**: Returns `null` when no Origin header (don't set CORS headers for same-origin requests)
- **Rationale**: CORS headers should only be set for cross-origin requests (requests with Origin header)

### 2. Updated All API Files to Use Shared CORS Utility
Updated these files to use the shared CORS utility instead of directly setting `Access-Control-Allow-Origin: *`:

- ✅ `api/admin-login.js`
- ✅ `api/verify-admin.js`
- ✅ `api/orders-create.js`
- ✅ `api/passes-[eventId].js`
- ✅ `api/aio-events-save-submission.js`
- ✅ `api/admin-approve-order.js`
- ✅ `api/admin/logs.js`

### 3. Fixed `/api/scan` Error Handling
- Added proper try-catch wrapper around the entire handler
- Added environment variable validation with clear error messages
- Added nested error handling to prevent uncaught exceptions

### 4. CORS Configuration
- **Allowlist Origins**:
  - `https://www.andiamoevents.com`
  - `https://andiamoevents.com`
  - Vercel preview URLs (auto-detected via environment variables)
- **Environment Variable**: `ALLOWED_ORIGINS` (comma-separated, optional)
- **Credentials**: Only set when explicitly needed (admin endpoints use cookies)

## Verification Commands (PowerShell)

### 1. Test Homepage (Should NOT have CORS headers)
```powershell
curl.exe -I https://www.andiamoevents.com/
```
**Expected**: No `Access-Control-Allow-Origin` header

### 2. Test API with Allowed Origin
```powershell
curl.exe -I -H "Origin: https://www.andiamoevents.com" https://www.andiamoevents.com/api/scan-system-status
```
**Expected**: 
- `Access-Control-Allow-Origin: https://www.andiamoevents.com` (exact origin, not `*`)
- `Vary: Origin`
- `Access-Control-Allow-Methods` present

### 3. Test API with Disallowed Origin
```powershell
curl.exe -I -H "Origin: https://evil.com" https://www.andiamoevents.com/api/scan-system-status
```
**Expected**: No `Access-Control-Allow-Origin` header (or 403 response)

### 4. Test API without Origin (Same-Origin)
```powershell
curl.exe -I https://www.andiamoevents.com/api/scan-system-status
```
**Expected**: No `Access-Control-Allow-Origin` header (same-origin requests don't need CORS)

### 5. Test CORS Preflight (OPTIONS)
```powershell
curl.exe -X OPTIONS -H "Origin: https://www.andiamoevents.com" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -I https://www.andiamoevents.com/api/scan-system-status
```
**Expected**: 
- Status: 200
- `Access-Control-Allow-Origin: https://www.andiamoevents.com`
- `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

### 6. Test CORS Preflight with Disallowed Origin
```powershell
curl.exe -X OPTIONS -H "Origin: https://evil.com" -H "Access-Control-Request-Method: POST" -I https://www.andiamoevents.com/api/scan-system-status
```
**Expected**: Status 403 or no CORS headers

### 7. Test /api/scan (should no longer return 500)
```powershell
curl.exe -I https://www.andiamoevents.com/api/scan-system-status
```
**Expected**: Status 200, not 500

## Files Modified

1. `api/utils/cors.js` - Fixed to not set CORS for same-origin requests
2. `api/admin-login.js` - Use shared CORS utility
3. `api/verify-admin.js` - Use shared CORS utility
4. `api/orders-create.js` - Use shared CORS utility
5. `api/passes-[eventId].js` - Use shared CORS utility
6. `api/aio-events-save-submission.js` - Use shared CORS utility
7. `api/admin-approve-order.js` - Use shared CORS utility
8. `api/admin/logs.js` - Use shared CORS utility
9. `api/scan.js` - Added proper error handling

## Important Notes

- **Homepage CORS**: If the homepage still shows `Access-Control-Allow-Origin: *`, it might be from Vercel's automatic CORS handling. Check Vercel dashboard settings or edge middleware.
- **Static Assets**: Static assets (CSS, JS, images) should not have CORS headers unless they're intentionally CORS-enabled.
- **Credentials**: Only admin/auth endpoints set `Access-Control-Allow-Credentials: true` because they use cookies.
