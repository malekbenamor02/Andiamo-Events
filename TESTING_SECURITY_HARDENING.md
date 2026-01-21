# Testing Security Hardening Implementation

This guide provides step-by-step instructions to test all security hardening changes.

---

## 🧪 Testing Methods

### 1. Local Testing (Before Deployment)

#### Start the Development Server

```bash
# Start both frontend and backend
npm run dev:full

# Or start them separately:
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npm run server
```

#### Test Security Headers Locally

```bash
# Test homepage headers
node scripts/verify-security-headers.js http://localhost:3000

# Test API headers
curl -I http://localhost:8082/api/scan-system-status
```

#### Test CORS Locally

```bash
# Test from allowed origin (should work)
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:8082/api/scan-system-status

# Test from disallowed origin (should fail in production, but work in dev)
curl -H "Origin: http://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:8082/api/scan-system-status
```

#### Test CSP Report Endpoint Locally

```bash
# Send a test CSP violation report
curl -X POST http://localhost:8082/api/csp-report \
  -H "Content-Type: application/json" \
  -d '{
    "csp-report": {
      "document-uri": "http://localhost:3000/",
      "violated-directive": "script-src",
      "blocked-uri": "http://evil.com/script.js"
    }
  }'

# Check server logs for: "🚨 CSP Violation Report"
```

#### Test Security.txt Locally

```bash
# Should return 200 with security.txt content
curl http://localhost:3000/.well-known/security.txt
```

---

### 2. Preview Deployment Testing

After pushing to GitHub, Vercel will create a preview deployment.

#### Get Preview URL

1. Check Vercel dashboard for the preview URL
2. Or check the GitHub commit status for the deployment link
3. Preview URL format: `https://your-app-abc123.vercel.app`

#### Test Preview Deployment

```bash
# Replace with your actual preview URL
PREVIEW_URL="https://your-app-abc123.vercel.app"

# Test security headers
node scripts/verify-security-headers.js $PREVIEW_URL

# Test security.txt
curl $PREVIEW_URL/.well-known/security.txt

# Test API headers
curl -I $PREVIEW_URL/api/scan-system-status

# Test CORS (should work)
curl -H "Origin: $PREVIEW_URL" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     $PREVIEW_URL/api/scan-system-status
```

#### Functional Testing on Preview

1. **Homepage**
   - [ ] Visit preview URL
   - [ ] Page loads correctly
   - [ ] No console errors
   - [ ] Images load correctly
   - [ ] Fonts load correctly

2. **Login Flow**
   - [ ] Navigate to admin login
   - [ ] Login works
   - [ ] Session persists
   - [ ] No CORS errors

3. **API Calls**
   - [ ] API requests succeed
   - [ ] No CORS errors in console
   - [ ] Responses include security headers

4. **Payment Flow** (if applicable)
   - [ ] Payment page loads
   - [ ] Flouci integration works
   - [ ] No CSP violations

5. **Social Previews**
   - [ ] OG tags still work
   - [ ] Test with: https://www.opengraph.xyz/ or similar tool

---

### 3. Production Testing

After deploying to production:

#### Quick Verification

```bash
# Test security headers
node scripts/verify-security-headers.js https://www.andiamoevents.com

# Or use curl
curl -I https://www.andiamoevents.com
```

#### Detailed Production Tests

```bash
PROD_URL="https://www.andiamoevents.com"

# 1. Test Security Headers
echo "=== Testing Security Headers ==="
curl -I $PROD_URL | grep -i "x-frame-options\|x-content-type-options\|referrer-policy\|permissions-policy\|strict-transport-security\|content-security-policy"

# 2. Test Security.txt
echo "=== Testing Security.txt ==="
curl $PROD_URL/.well-known/security.txt

# 3. Test API Headers
echo "=== Testing API Headers ==="
curl -I $PROD_URL/api/scan-system-status

# 4. Test CORS (Allowed Origin)
echo "=== Testing CORS (Allowed) ==="
curl -H "Origin: $PROD_URL" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     $PROD_URL/api/scan-system-status \
     -v

# 5. Test CORS (Disallowed Origin)
echo "=== Testing CORS (Disallowed) ==="
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     $PROD_URL/api/scan-system-status \
     -v
# Should return 403 or no CORS headers

# 6. Test CSP Report Endpoint
echo "=== Testing CSP Report Endpoint ==="
curl -X POST $PROD_URL/api/csp-report \
  -H "Content-Type: application/json" \
  -d '{
    "csp-report": {
      "document-uri": "'$PROD_URL'/",
      "violated-directive": "script-src",
      "blocked-uri": "http://evil.com/script.js",
      "source-file": "test.js",
      "line-number": 42
    }
  }'
# Should return 204 No Content
```

---

### 4. Browser Testing

#### Chrome DevTools

1. **Open DevTools** (F12)
2. **Network Tab**
   - Check response headers for security headers
   - Look for: `X-Frame-Options`, `X-Content-Type-Options`, etc.

3. **Console Tab**
   - Check for CSP violation warnings (in report-only mode, these won't block)
   - Look for: "Content Security Policy" warnings

4. **Security Tab**
   - View site security information
   - Check certificate details
   - Verify HSTS status

#### Firefox DevTools

1. **Network Tab**
   - View response headers
   - Check security headers

2. **Console Tab**
   - Check for CSP warnings

#### Online Security Scanners

1. **SecurityHeaders.com**
   - Visit: https://securityheaders.com
   - Enter: `https://www.andiamoevents.com`
   - Check security grade (should be A or A+)

2. **Mozilla Observatory**
   - Visit: https://observatory.mozilla.org
   - Enter: `https://www.andiamoevents.com`
   - Run scan and review results

3. **SSL Labs**
   - Visit: https://www.ssllabs.com/ssltest/
   - Enter: `www.andiamoevents.com`
   - Check SSL/TLS configuration

---

### 5. Functional Testing Checklist

Before considering the deployment successful, verify:

#### Core Functionality
- [ ] Homepage loads correctly
- [ ] All pages navigate correctly
- [ ] No broken images or assets
- [ ] Fonts load correctly
- [ ] Styles apply correctly

#### Authentication
- [ ] Admin login works
- [ ] Session persists after login
- [ ] Logout works
- [ ] Protected routes require authentication

#### API Functionality
- [ ] All API endpoints respond correctly
- [ ] No CORS errors in browser console
- [ ] API responses include security headers
- [ ] POST/PUT/DELETE requests work

#### Payment Flow (if applicable)
- [ ] Payment page loads
- [ ] Flouci payment gateway works
- [ ] Payment callbacks succeed
- [ ] Order creation works

#### Third-Party Integrations
- [ ] Supabase connections work
- [ ] Analytics (Vercel) works
- [ ] reCAPTCHA (if used) works
- [ ] Email sending works

#### Social Features
- [ ] OG tags display correctly
- [ ] Social previews work (test with Facebook/Twitter debuggers)
- [ ] Share buttons work (if any)

---

### 6. Monitoring CSP Reports

#### Check Vercel Logs

1. Go to Vercel Dashboard
2. Select your project
3. Go to "Logs" or "Functions" tab
4. Look for: `🚨 CSP Violation Report`

#### Enable Database Logging (Optional)

If you want to store CSP violations in the database:

1. Set environment variable: `ENABLE_CSP_LOGGING=true`
2. Create `csp_violations` table in Supabase (if needed)
3. Uncomment database logging code in `api/misc.js`

#### Review Violations

After 24-48 hours, review CSP violations:
- Identify legitimate sources that need CSP exceptions
- Update CSP policy in `vercel.json` and `server.cjs`
- Plan removal of `unsafe-inline` and `unsafe-eval`

---

### 7. Automated Testing Script

Create a test script for continuous monitoring:

```bash
#!/bin/bash
# test-security.sh

URL="${1:-https://www.andiamoevents.com}"

echo "Testing security headers for: $URL"
echo "=================================="

# Test headers
node scripts/verify-security-headers.js $URL

# Test security.txt
echo ""
echo "Testing security.txt..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL/.well-known/security.txt)
if [ "$STATUS" = "200" ]; then
  echo "✅ Security.txt accessible"
else
  echo "❌ Security.txt returned status: $STATUS"
fi

# Test CSP report endpoint
echo ""
echo "Testing CSP report endpoint..."
CSP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST $URL/api/csp-report \
  -H "Content-Type: application/json" \
  -d '{"csp-report":{"document-uri":"'$URL'","violated-directive":"test"}}')
if [ "$CSP_STATUS" = "204" ]; then
  echo "✅ CSP report endpoint working"
else
  echo "❌ CSP report endpoint returned status: $CSP_STATUS"
fi
```

---

### 8. Troubleshooting

#### Headers Not Appearing

1. **Check Vercel deployment**
   - Verify `vercel.json` is deployed
   - Check Vercel build logs for errors

2. **Check Cache**
   - Clear browser cache
   - Try incognito/private mode
   - Check CDN cache (Vercel caches headers)

3. **Verify Configuration**
   - Check `vercel.json` syntax
   - Verify headers are in the correct format

#### CORS Errors

1. **Check Environment Variables**
   - Verify `ALLOWED_ORIGINS` is set (if custom origins needed)
   - Check default origins in `api/utils/cors.js`

2. **Check Origin**
   - Verify the origin making the request
   - Check browser console for exact error

3. **Development vs Production**
   - Development allows all origins
   - Production uses allowlist

#### CSP Violations

1. **Report-Only Mode**
   - Violations are logged, not blocked
   - Check browser console for warnings
   - Check server logs for reports

2. **Common Issues**
   - Inline scripts need nonces or hashes
   - External resources need to be in CSP policy
   - `unsafe-inline` and `unsafe-eval` are temporary

---

## ✅ Success Criteria

All tests should pass:

- [x] Security headers present and correct
- [x] HSTS includes `includeSubDomains`
- [x] CSP in report-only mode
- [x] CORS restricted to allowlist
- [x] Security.txt accessible
- [x] CSP report endpoint working
- [x] Site functionality unchanged
- [x] No increase in error rates
- [x] No console errors

---

## 📞 Next Steps

After successful testing:

1. **Monitor for 24-48 hours**
   - Watch for CSP violations
   - Monitor error rates
   - Check user reports

2. **Review CSP Reports**
   - Identify legitimate violations
   - Update CSP policy as needed

3. **Plan CSP Enforcement**
   - After 1-2 weeks, switch to enforcing mode
   - Gradually remove `unsafe-inline` and `unsafe-eval`

---

## 🔗 Useful Links

- [SecurityHeaders.com](https://securityheaders.com)
- [Mozilla Observatory](https://observatory.mozilla.org)
- [SSL Labs](https://www.ssllabs.com/ssltest/)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
