# Production Fixes - Making Production Match Localhost

## 🎯 Objective
Make production (andiamoevents.com) behave EXACTLY like localhost with no regressions and no security downgrade.

---

## 🔴 Critical Issues Found

### Issue #1: Missing SUPABASE_SERVICE_ROLE_KEY in Production
**Severity:** 🔴 CRITICAL  
**Impact:** Order creation fails if service role key is missing (RLS blocks stock reservation)

**Root Cause:**
- `api/orders/create.js` uses service role key if available (line 98-103)
- If missing, falls back to anon key, which is subject to RLS policies
- Stock reservation requires UPDATE on `event_passes.sold_quantity`
- Current RLS policy allows updates, but service role key is safer and more efficient

**Fix:**
1. ✅ Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel environment variables
2. ✅ Verify the serverless function uses service role key for stock operations

**Status:** Code already handles this correctly - need to verify env var is set

---

### Issue #2: RLS Policy for event_passes Allows All Operations
**Severity:** 🟡 MEDIUM (Security concern, but functional)
**Impact:** Currently allows all operations for everyone (too permissive)

**Root Cause:**
- Migration `20250131000005-add-events-admin-policies.sql` creates policy with `USING (true)` and `WITH CHECK (true)`
- This allows anyone to update `event_passes` table
- Order creation endpoint should use service role key to bypass RLS (more secure)

**Fix:**
- ✅ Current implementation is functional (service role key bypasses RLS)
- ✅ No code changes needed - rely on service role key
- ⚠️ Consider tightening RLS policy in future (separate task, not blocking)

**Status:** Functional with service role key, but policy is too permissive

---

### Issue #3: CORS Configuration
**Severity:** 🟢 LOW (Should work, but verify)
**Impact:** API calls may be blocked if CORS headers are incorrect

**Root Cause:**
- `api/orders/create.js` sets CORS headers: `req.headers.origin || '*'`
- This allows all origins (same as localhost behavior in dev mode)

**Fix:**
- ✅ Current CORS configuration matches localhost behavior (allows all origins)
- ✅ No changes needed

**Status:** Should work, but verify in production

---

### Issue #4: API Base URL (VITE_API_URL)
**Severity:** 🟢 LOW (Works with relative URLs)
**Impact:** If VITE_API_URL is set incorrectly, API calls fail

**Root Cause:**
- Frontend uses `import.meta.env.VITE_API_URL || ''`
- If empty, uses relative URL `/api/orders/create`
- Vercel routing handles relative URLs correctly

**Fix:**
- ✅ Relative URLs work with Vercel routing
- ✅ No changes needed
- ⚠️ Recommend NOT setting VITE_API_URL in production (use relative URLs)

**Status:** Works correctly with relative URLs

---

### Issue #5: Environment Variables Documentation
**Severity:** 🟡 MEDIUM (Operational)
**Impact:** Unclear which environment variables are required in production

**Fix:**
- ✅ Create comprehensive environment variables documentation
- ✅ Add startup logging to verify env vars are set

**Status:** Need to document and add logging

---

## ✅ Required Environment Variables for Production

### Frontend (Vercel Environment Variables)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key (public, safe to expose)
- `VITE_RECAPTCHA_SITE_KEY` - Google reCAPTCHA site key (if using reCAPTCHA)

### Backend (Vercel Serverless Functions)
- `SUPABASE_URL` - Same as VITE_SUPABASE_URL
- `SUPABASE_ANON_KEY` - Same as VITE_SUPABASE_ANON_KEY
- `SUPABASE_SERVICE_ROLE_KEY` - ⚠️ **CRITICAL** - Required for order creation (stock reservation)
- `FLOUCI_PUBLIC_KEY` - Flouci payment gateway public key
- `FLOUCI_SECRET_KEY` - Flouci payment gateway secret key
- `EMAIL_HOST` - SMTP server hostname
- `EMAIL_USER` - SMTP username
- `EMAIL_PASS` - SMTP password
- `JWT_SECRET` - JWT secret for admin/auth tokens
- `RECAPTCHA_SECRET_KEY` - Google reCAPTCHA secret key (if using reCAPTCHA)
- `WINSMS_API_KEY` - WinSMS API key (optional, for SMS features)

### Optional
- `VITE_API_URL` - Should be empty/not set (use relative URLs)
- `ALLOWED_ORIGINS` - Not used in serverless functions (CORS handled per-function)

---

## 🔧 Code Fixes to Apply

### Fix #1: Improve Error Logging in Order Creation Endpoint
**File:** `api/orders/create.js`

**Change:** Add startup logging to verify environment variables

```javascript
// Add at top of file (after imports)
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY not set. Order creation may fail due to RLS policies.');
}
```

**Status:** ✅ Apply this fix

---

### Fix #2: Verify Service Role Key Usage
**File:** `api/orders/create.js`

**Current Code:** Already uses service role key if available (line 98-103)
**Status:** ✅ No changes needed

---

### Fix #3: CORS Headers - Make More Explicit
**File:** `api/orders/create.js`

**Current Code:** Uses `req.headers.origin || '*'`
**Status:** ✅ Works correctly, no changes needed

**Optional Improvement:** Could be more explicit, but current implementation matches localhost behavior

---

## 🧪 Verification Steps

### 1. Verify Environment Variables in Vercel
- [ ] Log into Vercel dashboard
- [ ] Go to project settings → Environment Variables
- [ ] Verify all required variables are set (see list above)
- [ ] **CRITICAL:** Verify `SUPABASE_SERVICE_ROLE_KEY` is set

### 2. Test Order Creation in Production
- [ ] Navigate to production site
- [ ] Create a test order
- [ ] Verify order is created successfully
- [ ] Check browser console for errors
- [ ] Check Vercel function logs for errors

### 3. Verify Stock Reservation Works
- [ ] Create order with limited stock pass
- [ ] Verify stock decreases correctly
- [ ] Verify order_passes records are created
- [ ] Verify order status is correct

### 4. Verify CORS Headers
- [ ] Check browser Network tab
- [ ] Verify CORS headers are present in API responses
- [ ] Verify no CORS errors in console

---

## 📋 Summary

### Critical Actions Required
1. ✅ **Verify `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel** (MOST IMPORTANT)
2. ✅ Verify all other required environment variables are set
3. ✅ Test order creation in production
4. ✅ Monitor Vercel function logs for errors

### Code Changes Required
1. ✅ Add warning log if service role key is missing
2. ✅ (Optional) Improve error messages

### No Code Changes Needed
1. ✅ CORS configuration (already matches localhost)
2. ✅ API URL configuration (relative URLs work)
3. ✅ Service role key usage (already implemented correctly)
4. ✅ RLS policies (work with service role key)

---

## 🎯 Expected Behavior After Fixes

### Order Creation Flow
1. Frontend calls `/api/orders/create` (relative URL)
2. Vercel serverless function handles request
3. Function uses service role key (bypasses RLS)
4. Stock reservation succeeds
5. Order created successfully
6. Order_passes created successfully
7. Response returned to frontend

### All Steps Should Work Identically to Localhost
- ✅ API calls use same endpoints
- ✅ Stock reservation uses same logic
- ✅ Order creation uses same validation
- ✅ Error handling is identical

---

## 🔐 Security Notes

1. **Service Role Key:** Must be kept secret, only used in serverless functions
2. **Anon Key:** Safe to expose in frontend (VITE_SUPABASE_ANON_KEY)
3. **RLS Policies:** Provide defense in depth, but service role key bypasses them (by design)
4. **CORS:** Currently allows all origins (matches localhost dev mode - acceptable for production)

---

## 📝 Next Steps

1. Verify environment variables in Vercel
2. Test order creation in production
3. Monitor logs for any errors
4. Document any additional issues found
5. Create deployment checklist for future releases
