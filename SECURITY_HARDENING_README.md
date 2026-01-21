# Security Hardening Implementation Guide

**Date:** 2026-01-21  
**Domain:** https://www.andiamoevents.com  
**Status:** ✅ Implemented

---

## Overview

This document describes the security headers and configurations implemented to harden the Andiamo Events website for production.

---

## Security Headers Implemented

### 1. X-Frame-Options
- **Value:** `DENY`
- **Purpose:** Prevents the site from being embedded in frames (clickjacking protection)
- **Location:** Set globally via `vercel.json` and Express middleware

### 2. X-Content-Type-Options
- **Value:** `nosniff`
- **Purpose:** Prevents browsers from MIME-sniffing responses
- **Location:** Set globally via `vercel.json` and Express middleware

### 3. Referrer-Policy
- **Value:** `strict-origin-when-cross-origin`
- **Purpose:** Controls referrer information sent with requests
- **Location:** Set globally via `vercel.json` and Express middleware

### 4. Permissions-Policy
- **Value:** `geolocation=(), microphone=(), camera=(), payment=()`
- **Purpose:** Disables unnecessary browser features to reduce attack surface
- **Location:** Set globally via `vercel.json` and Express middleware

### 5. Cross-Origin-Opener-Policy (COOP)
- **Value:** `same-origin`
- **Purpose:** Isolates browsing context from cross-origin documents
- **Location:** Set globally via `vercel.json` and Express middleware
- **Note:** Safe for this application as it doesn't rely on cross-origin popups for authentication

### 6. Cross-Origin-Resource-Policy (CORP)
- **Value:** `same-site`
- **Purpose:** Prevents cross-site resource access
- **Location:** Set globally via `vercel.json` and Express middleware
- **Note:** If assets need to be consumed cross-site, change to `cross-origin`

### 7. Strict-Transport-Security (HSTS)
- **Value:** `max-age=63072000; includeSubDomains`
- **Purpose:** Forces HTTPS connections for 2 years, including subdomains
- **Location:** Set globally via `vercel.json` and Express middleware
- **Note:** `preload` not included (requires long-term commitment)

### 8. Content-Security-Policy (CSP)
- **Status:** Report-Only mode (not enforcing)
- **Purpose:** Restricts resource loading to prevent XSS and data injection attacks
- **Location:** Set globally via `vercel.json` and Express middleware

**Current Policy (Report-Only):**
```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
img-src 'self' https: data:;
font-src 'self' https: data:;
style-src 'self' 'unsafe-inline' https:;
script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
connect-src 'self' https: wss: *.supabase.co *.supabase.in *.flouci.com *.google.com *.gstatic.com *.vercel-analytics.com *.vercel-insights.com;
frame-src 'self' https: *.google.com;
report-uri /api/csp-report;
```

**Next Steps:**
1. Monitor CSP reports for 1-2 weeks
2. Address legitimate violations
3. Switch to enforcing mode (`Content-Security-Policy` instead of `Content-Security-Policy-Report-Only`)
4. Gradually remove `unsafe-inline` and `unsafe-eval` by implementing nonces/hashes

---

## CORS Configuration

### Environment Variable
- **Variable:** `ALLOWED_ORIGINS`
- **Format:** Comma-separated list of allowed origins
- **Example:** `https://www.andiamoevents.com,https://andiamoevents.com`

### Default Production Origins
If `ALLOWED_ORIGINS` is not set, the following origins are allowed:
- `https://www.andiamoevents.com`
- `https://andiamoevents.com`
- Vercel preview URLs (auto-detected)

### Development Mode
In development (`NODE_ENV !== 'production'`), all origins are allowed for easier testing.

### Implementation
- **Shared Utility:** `api/utils/cors.js`
- **Files Updated:**
  - `server.cjs` - Express server CORS middleware
  - `api/misc.js` - Uses shared CORS utility
  - `api/scan.js` - Uses shared CORS utility
  - `api/admin-pos.js` - Uses shared CORS utility
  - `api/pos.js` - Uses shared CORS utility

### How to Update Allowed Origins

1. **Via Environment Variable (Recommended):**
   ```bash
   # In Vercel dashboard or .env file
   ALLOWED_ORIGINS=https://www.andiamoevents.com,https://andiamoevents.com,https://admin.andiamoevents.com
   ```

2. **Via Code (Not Recommended):**
   Edit `api/utils/cors.js` and update `defaultProductionOrigins` array.

---

## Security.txt

**Location:** `/.well-known/security.txt`  
**Status:** ✅ Implemented

**Content:**
```
Contact: mailto:security@andiamoevents.com
Expires: 2026-07-21T00:00:00.000Z
Preferred-Languages: en, fr, ar
```

**Note:** Update the contact email if a dedicated security mailbox is not available.

---

## CSP Reporting Endpoint

**Endpoint:** `/api/csp-report`  
**Method:** POST  
**Status:** ✅ Implemented

**Purpose:** Collects CSP violation reports from browsers in report-only mode.

**Logging:**
- Violations are logged to console by default
- To enable database logging, set `ENABLE_CSP_LOGGING=true` in environment variables
- Database table `csp_violations` can be created via migration if needed

**Response:** 204 No Content (standard for CSP reporting)

---

## Verification Steps

### 1. Check Headers Locally

```bash
# Check homepage headers
curl -I http://localhost:3000

# Check API headers
curl -I http://localhost:8082/api/scan-system-status
```

### 2. Check Headers in Production

```bash
# Check homepage headers
curl -I https://www.andiamoevents.com

# Check security.txt
curl https://www.andiamoevents.com/.well-known/security.txt

# Check API headers
curl -I https://www.andiamoevents.com/api/scan-system-status
```

### 3. Verify Security Headers

Use online tools to verify headers:
- [SecurityHeaders.com](https://securityheaders.com)
- [Mozilla Observatory](https://observatory.mozilla.org)

### 4. Test CORS

```bash
# Test from allowed origin (should work)
curl -H "Origin: https://www.andiamoevents.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://www.andiamoevents.com/api/scan-system-status

# Test from disallowed origin (should fail)
curl -H "Origin: https://evil.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://www.andiamoevents.com/api/scan-system-status
```

### 5. Monitor CSP Reports

1. Deploy to production
2. Monitor browser console for CSP violations
3. Check server logs for CSP violation reports
4. Review violations and update CSP policy as needed
5. After 1-2 weeks with no critical violations, switch to enforcing mode

---

## Switching CSP to Enforcing Mode

**Current:** `Content-Security-Policy-Report-Only`  
**Target:** `Content-Security-Policy`

### Steps:

1. **Update `vercel.json`:**
   ```json
   {
     "key": "Content-Security-Policy",
     "value": "..."
   }
   ```
   Remove `Content-Security-Policy-Report-Only`.

2. **Update `server.cjs`:**
   Change:
   ```javascript
   res.setHeader('Content-Security-Policy-Report-Only', cspPolicy);
   ```
   To:
   ```javascript
   res.setHeader('Content-Security-Policy', cspPolicy);
   ```

3. **Deploy and Monitor:**
   - Deploy to preview first
   - Test all functionality
   - Monitor for errors
   - Deploy to production

---

## Files Modified

1. **`vercel.json`** - Added headers configuration
2. **`server.cjs`** - Added security headers middleware, updated CORS
3. **`api/utils/cors.js`** - New shared CORS utility
4. **`api/misc.js`** - Updated to use shared CORS utility
5. **`api/scan.js`** - Updated to use shared CORS utility
6. **`api/admin-pos.js`** - Updated to use shared CORS utility
7. **`api/pos.js`** - Updated to use shared CORS utility
8. **`api/csp-report.js`** - New CSP reporting endpoint
9. **`public/.well-known/security.txt`** - New security contact file

---

## Environment Variables

### New Variables
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins (optional, has defaults)

### Existing Variables (No Changes)
- All existing environment variables remain unchanged

---

## Rollback Plan

All changes are reversible:

1. **Headers:** Remove from `vercel.json` and `server.cjs`
2. **CORS:** Revert API files to use wildcard origins
3. **CSP:** Remove CSP headers or switch back to report-only
4. **Security.txt:** Delete `public/.well-known/security.txt`

---

## Testing Checklist

Before deploying to production:

- [ ] Headers present on homepage
- [ ] Headers present on API routes
- [ ] Security.txt accessible
- [ ] CORS works from allowed origins
- [ ] CORS blocks disallowed origins
- [ ] Login/signup flows work
- [ ] Payment flow works
- [ ] API calls succeed
- [ ] Social previews (OG tags) unchanged
- [ ] No console errors
- [ ] CSP reports being collected (check logs)

---

## Support

For questions or issues:
- Review `SECURITY_HARDENING_PLAN.md` for detailed implementation plan
- Check server logs for CSP violation reports
- Verify environment variables are set correctly

---

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HSTS Preload](https://hstspreload.org/)
- [Security.txt Specification](https://www.ietf.org/rfc/rfc9116.txt)
