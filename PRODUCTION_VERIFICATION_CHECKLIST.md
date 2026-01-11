# Production Verification Checklist
## Andiamo Events - Sales Flow Verification

**Objective:** Verify that production (andiamoevents.com) behaves EXACTLY like localhost

---

## ✅ Pre-Deployment Checklist

### Environment Variables (Vercel Dashboard)

#### Frontend Variables (VITE_*)
- [ ] `VITE_SUPABASE_URL` - Set to your Supabase project URL
- [ ] `VITE_SUPABASE_ANON_KEY` - Set to your Supabase anonymous key
- [ ] `VITE_RECAPTCHA_SITE_KEY` - Set if using reCAPTCHA
- [ ] `VITE_API_URL` - **SHOULD BE EMPTY** or not set (uses relative URLs)

#### Backend Variables (Serverless Functions)
- [ ] `SUPABASE_URL` - Same as VITE_SUPABASE_URL
- [ ] `SUPABASE_ANON_KEY` - Same as VITE_SUPABASE_ANON_KEY
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - ⚠️ **CRITICAL** - Must be set for order creation
- [ ] `FLOUCI_PUBLIC_KEY` - Flouci payment gateway public key
- [ ] `FLOUCI_SECRET_KEY` - Flouci payment gateway secret key
- [ ] `EMAIL_HOST` - SMTP server hostname
- [ ] `EMAIL_USER` - SMTP username
- [ ] `EMAIL_PASS` - SMTP password
- [ ] `JWT_SECRET` - JWT secret for admin/auth tokens
- [ ] `RECAPTCHA_SECRET_KEY` - Google reCAPTCHA secret key (if using reCAPTCHA)
- [ ] `WINSMS_API_KEY` - WinSMS API key (optional)

---

## 🧪 Production Testing Checklist

### 1. Basic Site Functionality
- [ ] Site loads correctly (andiamoevents.com)
- [ ] No console errors on page load
- [ ] Events page displays correctly
- [ ] Event details page displays correctly

### 2. Order Creation Flow

#### Step 1: Event Selection
- [ ] Navigate to an event
- [ ] Event details load correctly
- [ ] Passes display with correct prices
- [ ] Stock information displays (if available)

#### Step 2: Pass Selection
- [ ] Select pass quantities
- [ ] Price calculation is correct
- [ ] Stock limits are enforced (if applicable)

#### Step 3: Customer Information
- [ ] Fill in customer form
- [ ] Form validation works
- [ ] Required fields are enforced

#### Step 4: Payment Method Selection
- [ ] Payment options display
- [ ] Payment method selection works
- [ ] Ambassador selection works (if ambassador_cash)

#### Step 5: Order Submission
- [ ] Click "Submit Order" button
- [ ] Loading state displays
- [ ] API call succeeds (check Network tab)
- [ ] Order created successfully
- [ ] Redirect works correctly

### 3. API Endpoint Verification

#### Order Creation Endpoint (`/api/orders/create`)
- [ ] Request sent to correct endpoint
- [ ] CORS headers present in response
- [ ] Response status is 201 (Created)
- [ ] Response contains order data
- [ ] Order ID is returned

#### Stock Reservation
- [ ] Stock decreases correctly after order
- [ ] Multiple orders respect stock limits
- [ ] Stock cannot go negative

#### Order Passes
- [ ] `order_passes` records created
- [ ] Pass IDs are correct
- [ ] Quantities are correct
- [ ] Prices are correct

### 4. Error Handling

#### Network Errors
- [ ] Network errors display user-friendly message
- [ ] Console logs errors for debugging
- [ ] No sensitive data in error messages

#### Validation Errors
- [ ] Invalid data shows validation errors
- [ ] Error messages are clear
- [ ] Form highlights invalid fields

#### Stock Errors
- [ ] Insufficient stock shows error
- [ ] Error message is clear
- [ ] User can adjust quantity

### 5. Browser Console Verification
- [ ] No JavaScript errors
- [ ] No CORS errors
- [ ] No network errors (404, 500, etc.)
- [ ] API calls succeed
- [ ] Warning logs are informative (not errors)

### 6. Vercel Function Logs

#### Order Creation Function Logs
- [ ] Function executes successfully
- [ ] No errors in function logs
- [ ] Warning about missing service role key (if not set)
- [ ] Stock reservation succeeds
- [ ] Order creation succeeds
- [ ] Order_passes creation succeeds

#### Error Logs
- [ ] Errors are logged with context
- [ ] Error messages are helpful
- [ ] No sensitive data in logs

---

## 🔍 Comparison with Localhost

### Behavior Comparison

| Feature | Localhost | Production | Match? |
|---------|-----------|------------|--------|
| Order Creation | ✅ Works | ? | [ ] |
| Stock Reservation | ✅ Works | ? | [ ] |
| API Calls | ✅ Works | ? | [ ] |
| CORS | ✅ Allows all | ✅ Allows all | [ ] |
| Error Messages | ✅ Clear | ? | [ ] |
| Loading States | ✅ Works | ? | [ ] |
| Redirects | ✅ Works | ? | [ ] |

### API Response Comparison

#### Localhost Response (Order Creation)
```json
{
  "success": true,
  "order": {
    "id": "...",
    "status": "PENDING_ONLINE",
    "order_passes": [...]
  }
}
```

#### Production Response (Expected)
```json
{
  "success": true,
  "order": {
    "id": "...",
    "status": "PENDING_ONLINE",
    "order_passes": [...]
  }
}
```

- [ ] Response structure matches localhost
- [ ] All required fields present
- [ ] Status codes match

---

## 🚨 Critical Issues to Verify

### Issue #1: Service Role Key
**Status:** ⚠️ MUST BE SET  
**Verification:**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel
- [ ] Function logs show no warning about missing key
- [ ] Order creation succeeds

### Issue #2: Stock Reservation
**Status:** ⚠️ MUST WORK  
**Verification:**
- [ ] Stock decreases after order
- [ ] Multiple orders respect stock limits
- [ ] Stock reservation is atomic (no race conditions)

### Issue #3: CORS Headers
**Status:** ✅ Should work  
**Verification:**
- [ ] CORS headers present in API responses
- [ ] No CORS errors in browser console
- [ ] API calls succeed from production domain

### Issue #4: API URL Configuration
**Status:** ✅ Should work  
**Verification:**
- [ ] API calls use relative URLs
- [ ] No hardcoded localhost URLs
- [ ] API calls succeed

---

## 📝 Test Scenarios

### Scenario 1: Basic Order Creation
1. [ ] Select event
2. [ ] Select pass(es)
3. [ ] Fill customer info
4. [ ] Select payment method (online)
5. [ ] Submit order
6. [ ] Verify order created
7. [ ] Verify redirect to payment page

### Scenario 2: Ambassador Cash Order
1. [ ] Select event
2. [ ] Select pass(es)
3. [ ] Fill customer info
4. [ ] Select payment method (ambassador_cash)
5. [ ] Select ambassador
6. [ ] Accept terms
7. [ ] Submit order
8. [ ] Verify order created
9. [ ] Verify order status is PENDING_CASH

### Scenario 3: Limited Stock Order
1. [ ] Select event with limited stock pass
2. [ ] Select quantity that exceeds stock
3. [ ] Verify error message
4. [ ] Select valid quantity
5. [ ] Submit order
6. [ ] Verify stock decreases
7. [ ] Try to create another order exceeding stock
8. [ ] Verify error message

### Scenario 4: Multiple Pass Order
1. [ ] Select event
2. [ ] Select multiple different passes
3. [ ] Fill customer info
4. [ ] Submit order
5. [ ] Verify all passes in order_passes
6. [ ] Verify stock decreased for all passes
7. [ ] Verify total price is correct

---

## 🔐 Security Verification

### API Security
- [ ] Service role key is NOT exposed to frontend
- [ ] Anon key is used in frontend (safe to expose)
- [ ] CORS headers are appropriate
- [ ] No sensitive data in error messages
- [ ] No sensitive data in logs

### Data Validation
- [ ] Server validates all input
- [ ] Server calculates prices (not trusted from frontend)
- [ ] Server validates stock availability
- [ ] Server enforces business rules

---

## 📊 Performance Verification

### API Response Times
- [ ] Order creation completes in < 3 seconds
- [ ] API calls don't timeout
- [ ] No hanging requests

### User Experience
- [ ] Loading states display correctly
- [ ] No UI freezing
- [ ] Error messages appear quickly
- [ ] Success messages appear quickly

---

## ✅ Final Verification

### Production Matches Localhost
- [ ] All features work identically
- [ ] All API endpoints work
- [ ] All error handling works
- [ ] All redirects work
- [ ] All validations work

### No Regressions
- [ ] Existing features still work
- [ ] No broken functionality
- [ ] No new errors
- [ ] Performance is acceptable

### Security Maintained
- [ ] No security downgrades
- [ ] All validations in place
- [ ] No sensitive data exposed
- [ ] Proper error handling

---

## 📝 Notes

- Test in production environment (andiamoevents.com)
- Test with different browsers (Chrome, Firefox, Safari)
- Test on mobile devices
- Monitor Vercel function logs during testing
- Monitor browser console for errors
- Document any issues found

---

## 🆘 Troubleshooting

### Order Creation Fails
1. Check Vercel function logs
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
3. Check browser console for errors
4. Verify CORS headers
5. Check network tab for API response

### Stock Reservation Fails
1. Verify service role key is set
2. Check RLS policies
3. Verify stock limits in database
4. Check function logs for errors

### CORS Errors
1. Verify CORS headers in API response
2. Check browser console for CORS errors
3. Verify origin in request headers
4. Check function CORS configuration

### API Not Found (404)
1. Verify API route exists
2. Check Vercel routing configuration
3. Verify relative URL is correct
4. Check `vercel.json` configuration
