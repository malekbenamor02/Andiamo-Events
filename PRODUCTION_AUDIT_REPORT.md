# Production vs Localhost Audit Report
## Andiamo Events - Sales Flow Audit

**Date:** 2025-01-XX  
**Objective:** Make production (andiamoevents.com) behave EXACTLY like localhost

---

## 🔍 Critical Findings

### 1. **API Base URL Configuration**

#### Localhost
- Uses Vite dev server proxy (`vite.config.ts`)
- API calls go through proxy to `http://localhost:8082`
- `VITE_API_URL` typically not set (uses relative URLs)

#### Production
- **Issue:** `VITE_API_URL` may not be set in Vercel environment variables
- **Impact:** Frontend uses relative URLs (`/api/orders/create`)
- **Status:** Should work with Vercel routing, but needs verification

#### Files Affected
- `src/lib/orders/orderService.ts:30` - `const apiBase = import.meta.env.VITE_API_URL || '';`
- `src/pages/PassPurchase.tsx:239` - Pass fetching
- All API calls throughout the app

---

### 2. **CORS Configuration**

#### Localhost (`server.cjs`)
- Development: Allows all origins (line 80-82)
- Production (if used): Uses `ALLOWED_ORIGINS` env var, defaults to `['http://localhost:3000']`

#### Production (Vercel Serverless Functions)
- `api/orders/create.js:9` - Uses `req.headers.origin || '*'`
- **Status:** ✅ Should work, allows all origins

#### Potential Issue
- Vercel serverless functions handle CORS differently than Express
- Need to verify CORS headers are properly set

---

### 3. **Environment Variables**

#### Required in Production
- `VITE_SUPABASE_URL` (frontend)
- `VITE_SUPABASE_ANON_KEY` (frontend)
- `SUPABASE_URL` (backend/serverless)
- `SUPABASE_ANON_KEY` (backend/serverless)
- `SUPABASE_SERVICE_ROLE_KEY` (backend/serverless - for order creation)
- `VITE_API_URL` (optional - if not set, uses relative URLs)

#### Critical Missing Variables
- If `SUPABASE_SERVICE_ROLE_KEY` is missing, RLS policies may block order creation
- `api/orders/create.js:98-103` uses service role key if available, falls back to anon key

---

### 4. **Database Access (RLS Policies)**

#### Localhost
- May use service role key (bypasses RLS)
- Direct Supabase client access

#### Production
- RLS policies are **ENFORCED**
- Order creation requires:
  - `orders` table: "Public can create online orders" policy (source = 'platform_online')
  - `order_passes` table: "Public can insert order passes" policy
  - Stock reservation requires write access to `event_passes`

#### RLS Policies Status
- ✅ `order_passes`: Public can insert (migration `20250215000005-fix-order-passes-rls.sql`)
- ✅ `orders`: Public can create online orders (migration `20250201000000-create-order-management-system.sql`)
- ⚠️ `event_passes`: Need to verify write permissions for stock reservation

---

### 5. **Order Creation Flow Comparison**

#### Frontend (`src/lib/orders/orderService.ts`)
- ✅ Same in localhost and production
- Calls `/api/orders/create` endpoint
- Uses `VITE_API_URL || ''` for base URL

#### Backend - Localhost (`server.cjs`)
- Express server on port 8082
- Route: `app.post('/api/orders/create', ...)`
- Uses service role key if available (`supabaseService`)

#### Backend - Production (`api/orders/create.js`)
- Vercel serverless function
- Similar logic, but:
  - Uses service role key if `SUPABASE_SERVICE_ROLE_KEY` is set
  - Otherwise uses anon key (may fail due to RLS)

---

### 6. **Service Worker**

#### Status
- `public/sw.js` - Does NOT cache API requests (line 33)
- ✅ API calls always go to network
- ✅ No cache interference expected

---

## 🚨 Identified Issues

### Issue #1: Missing Environment Variables
**Severity:** 🔴 CRITICAL  
**Impact:** Order creation fails if service role key is missing

**Solution:**
1. Verify all environment variables are set in Vercel
2. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set for order creation

---

### Issue #2: RLS Policies for Stock Reservation
**Severity:** 🔴 CRITICAL  
**Impact:** Stock reservation may fail if event_passes table doesn't allow updates

**Solution:**
1. Verify RLS policies allow updates to `event_passes.sold_quantity`
2. May need service role key for atomic stock operations

---

### Issue #3: API URL Configuration
**Severity:** 🟡 MEDIUM  
**Impact:** If `VITE_API_URL` is set incorrectly, API calls fail

**Solution:**
1. In production, `VITE_API_URL` should be empty or set to production domain
2. Relative URLs work with Vercel routing

---

### Issue #4: CORS Headers
**Severity:** 🟢 LOW  
**Impact:** Should work, but needs verification

**Solution:**
1. Verify CORS headers in serverless function
2. Test from production domain

---

## ✅ Fixes to Apply

1. **Ensure Environment Variables are Set in Vercel**
   - Add/verify all required env vars
   - Document which vars are needed

2. **Verify RLS Policies**
   - Check `event_passes` table RLS for updates
   - Ensure service role key is used for stock operations

3. **Fix CORS if Needed**
   - Update serverless function CORS to be more explicit

4. **Add Error Logging**
   - Improve error messages in production
   - Log environment variable status on startup

---

## 🧪 Verification Checklist

- [ ] All environment variables set in Vercel
- [ ] Order creation works in production
- [ ] Stock reservation works correctly
- [ ] CORS headers allow production domain
- [ ] API calls succeed from production frontend
- [ ] Error messages are clear and helpful
- [ ] RLS policies allow required operations
- [ ] Service role key is used for sensitive operations

---

## 📝 Notes

- Vercel uses serverless functions, not the Express server in `server.cjs`
- The `server.cjs` file is only used for localhost development
- All production API routes are in `/api` directory (Vercel serverless functions)
- Service worker does NOT interfere with API calls
- Relative URLs work with Vercel's routing configuration
