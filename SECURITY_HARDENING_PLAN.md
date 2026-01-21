# Security Hardening Plan - Andiamo Events

**Date:** 2026-01-21  
**Domain:** https://www.andiamoevents.com  
**Framework:** Vite + React (deployed on Vercel)  
**Status:** Implementation in progress

---

## Current Security State Analysis

### ✅ What's Working
- **HSTS**: Present (`max-age=63072000`) but missing `includeSubDomains`
- **SSL/TLS**: Valid Let's Encrypt certificate
- **Server**: Vercel (provides basic security)

### ❌ Security Issues Found

#### 1. Missing Security Headers
- ❌ `X-Frame-Options`: Not set
- ❌ `X-Content-Type-Options`: Not set
- ❌ `Content-Security-Policy`: Not set
- ❌ `Referrer-Policy`: Not set
- ❌ `Permissions-Policy`: Not set
- ❌ `Cross-Origin-Opener-Policy`: Not set
- ❌ `Cross-Origin-Resource-Policy`: Not set

#### 2. HSTS Configuration
- ⚠️ Missing `includeSubDomains` directive
- ⚠️ No `preload` (intentional - requires long-term commitment)

#### 3. CORS Issues
- ❌ `server.cjs`: Uses `cors` middleware with permissive origin check
- ❌ `api/misc.js`: `setCORSHeaders()` sets `Access-Control-Allow-Origin: *`
- ❌ `api/scan.js`: `setCORS()` sets `Access-Control-Allow-Origin: *`
- ❌ `api/admin-pos.js`: `setCORS()` sets `Access-Control-Allow-Origin: *`
- ❌ Multiple API files allow wildcard origins

#### 4. Missing Security.txt
- ❌ No `/.well-known/security.txt` file

---

## Implementation Plan

### Phase 1: Baseline Security Headers (Safe, No Breaking Changes)

**Location:** `vercel.json` (for static assets) + Express middleware (for API routes)

**Headers to Add:**
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
```

**Rationale:**
- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `Referrer-Policy` - Controls referrer information leakage
- `Permissions-Policy` - Disables unnecessary browser features
- `COOP: same-origin` - Isolates browsing context (safe for this app)
- `CORP: same-site` - Prevents cross-site resource access

**Risk:** Low - These headers are defensive and won't break functionality.

---

### Phase 2: HSTS Enhancement

**Change:** Add `includeSubDomains` to HSTS header

**Implementation:** Vercel automatically sets HSTS, but we can override via `vercel.json` headers

**Configuration:**
```
Strict-Transport-Security: max-age=63072000; includeSubDomains
```

**Note:** Not adding `preload` unless explicitly requested (hard to undo).

**Risk:** Low - Only affects subdomains. Ensure all subdomains support HTTPS.

---

### Phase 3: CSP in Report-Only Mode (Zero Risk)

**Strategy:** Start with `Content-Security-Policy-Report-Only` to collect violations

**Initial Policy (Conservative):**
```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
img-src 'self' https: data:;
font-src 'self' https: data:;
style-src 'self' 'unsafe-inline' https:;
script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
connect-src 'self' https: wss:;
```

**External Domains to Allow:**
- Supabase: `*.supabase.co`, `*.supabase.in`
- Flouci: `*.flouci.com`
- Google reCAPTCHA: `*.google.com`, `*.gstatic.com`
- Vercel Analytics: `*.vercel-analytics.com`
- Vercel Speed Insights: `*.vercel-insights.com`

**Reporting Endpoint:** `/api/csp-report` (new endpoint)

**Risk:** Zero - Report-only mode doesn't block anything.

---

### Phase 4: CORS Hardening

**Current State:**
- `server.cjs`: Uses `cors` middleware with environment-based allowlist
- Multiple API files: Use `Access-Control-Allow-Origin: *`

**Target State:**
- Environment variable: `ALLOWED_ORIGINS` (comma-separated)
- Default production origins:
  - `https://www.andiamoevents.com`
  - `https://andiamoevents.com`
  - `https://admin.andiamoevents.com` (if exists)
  - Vercel preview URLs (auto-detected)

**Files to Update:**
1. `server.cjs` - Already has allowlist logic, needs production defaults
2. `api/misc.js` - Replace `setCORSHeaders()` with allowlist
3. `api/scan.js` - Replace `setCORS()` with allowlist
4. `api/admin-pos.js` - Replace `setCORS()` with allowlist
5. Check other API files for CORS headers

**Implementation:**
- Create shared CORS utility function
- Use environment variable `ALLOWED_ORIGINS`
- Support Vercel preview URLs automatically
- Maintain credentials support where needed

**Risk:** Medium - Need to ensure all legitimate origins are included.

---

### Phase 5: Security.txt

**Location:** `public/.well-known/security.txt`

**Content:**
```
Contact: mailto:security@andiamoevents.com
Expires: 2026-07-21T00:00:00.000Z
Preferred-Languages: en, fr, ar
```

**Note:** Update contact email if security mailbox not available.

**Risk:** None.

---

## External API Origins Identified

### Payment Gateway
- **Flouci**: `*.flouci.com` (for payment processing)

### Database/Auth
- **Supabase**: `*.supabase.co`, `*.supabase.in` (for API calls, storage, auth)

### Analytics/Monitoring
- **Vercel Analytics**: `*.vercel-analytics.com`
- **Vercel Speed Insights**: `*.vercel-insights.com`

### Security
- **Google reCAPTCHA**: `*.google.com`, `*.gstatic.com`

### Email/SMS
- **SMTP**: `mail.routing.net` (server-side only, not in CSP)
- **WinSMS**: API calls (server-side only, not in CSP)

---

## Testing Strategy

### Pre-Deployment
1. ✅ Test headers locally using `curl`
2. ✅ Verify CSP report-only endpoint receives reports
3. ✅ Test CORS with allowed origins
4. ✅ Verify security.txt is accessible

### Post-Deployment (Preview)
1. ✅ Deploy to Vercel preview
2. ✅ Verify all headers present
3. ✅ Test login/signup flows
4. ✅ Test payment flow
5. ✅ Verify API calls work
6. ✅ Check CSP violation reports
7. ✅ Verify social previews (OG tags)

### Production Rollout
1. ✅ Deploy to production
2. ✅ Monitor CSP reports for 24-48 hours
3. ✅ If no critical violations, switch CSP to enforcing mode
4. ✅ Gradually tighten CSP (remove unsafe-inline/eval)

---

## Rollback Plan

All changes are:
- **Reversible**: Can remove headers or revert CORS changes
- **Non-breaking**: CSP in report-only mode doesn't block anything
- **Staged**: Can deploy incrementally

---

## Files to Modify

1. `vercel.json` - Add headers configuration
2. `server.cjs` - Add security headers middleware, fix CORS
3. `api/misc.js` - Fix CORS helper
4. `api/scan.js` - Fix CORS helper
5. `api/admin-pos.js` - Fix CORS helper
6. `api/csp-report.js` - New CSP reporting endpoint
7. `public/.well-known/security.txt` - New security contact file
8. `SECURITY_HARDENING_README.md` - Documentation

---

## Environment Variables

### New Variables
- `ALLOWED_ORIGINS` - Comma-separated list of allowed CORS origins
  - Example: `https://www.andiamoevents.com,https://andiamoevents.com`

### Existing Variables (No Changes)
- All existing environment variables remain unchanged

---

## Success Criteria

✅ All security headers present and correct  
✅ HSTS includes `includeSubDomains`  
✅ CSP in report-only mode, collecting violations  
✅ CORS restricted to allowlist (no wildcards)  
✅ Security.txt accessible at `/.well-known/security.txt`  
✅ Site functionality unchanged (login, payments, API calls)  
✅ No increase in error rates  
✅ CSP reports show no critical violations after 48 hours

---

## Next Steps (Post-Implementation)

1. **Monitor CSP Reports** (1-2 weeks)
   - Review violation reports
   - Identify legitimate sources that need CSP exceptions
   - Plan CSP policy refinement

2. **Tighten CSP** (After monitoring)
   - Remove `unsafe-inline` from script-src (use nonces/hashes)
   - Remove `unsafe-eval` if not needed
   - Add specific domain allowlists

3. **Consider Additional Hardening**
   - Implement nonce-based CSP for inline scripts
   - Add Subresource Integrity (SRI) for external scripts
   - Consider implementing a WAF (Cloudflare recommended)

---

## References

- [OWASP Secure Headers Project](https://owasp.org/www-project-secure-headers/)
- [MDN Security Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [CSP Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [HSTS Preload](https://hstspreload.org/)
