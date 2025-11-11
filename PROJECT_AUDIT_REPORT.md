# Project Audit Report - Andiamo Events

**Date:** November 3, 2025  
**Project:** Andiamo-Events-main  
**Status:** ⚠️ **Critical Issues Found**

---

## 🔴 CRITICAL SECURITY ISSUES

### 1. **Hardcoded Supabase Credentials** 
**Location:** `src/integrations/supabase/client.ts`
- **Issue:** Supabase URL and API keys are hardcoded as fallback values
- **Risk:** HIGH - Credentials are exposed in client-side code
- **Impact:** Anyone can access your Supabase project using these credentials
- **Recommendation:** Remove hardcoded values, use environment variables only

### 2. **JWT Fallback Secret**
**Location:** `server.cjs` (lines 99, 149)
- **Issue:** `JWT_SECRET` defaults to `'fallback-secret'` if not set
- **Risk:** HIGH - Weak secret can be exploited
- **Impact:** Tokens can be forged, authentication bypassed
- **Recommendation:** Make JWT_SECRET required, throw error if not set

### 3. **bcrypt in Frontend Code**
**Location:** `src/pages/ambassador/Auth.tsx` (line 10, 141)
- **Issue:** Password comparison happens in frontend using bcrypt
- **Risk:** HIGH - Password hashes exposed to client
- **Impact:** Security vulnerability, passwords can be extracted
- **Recommendation:** Move all password verification to backend API

### 4. **Unused bcrypt Import**
**Location:** `src/components/home/HeroSection.tsx` (line 9)
- **Issue:** Unused import that may cause build issues
- **Risk:** LOW - Code quality issue
- **Recommendation:** Remove unused import

### 5. **Plain Text Password in Database Migration**
**Location:** `supabase/migrations/20250718000001-create-admins-table.sql` (line 27-28)
- **Issue:** Default admin user created with plain text password
- **Risk:** HIGH - Anyone can see default credentials
- **Impact:** Default admin account is compromised
- **Recommendation:** Remove default admin, use setup script with hashed password

### 6. **Overly Permissive CORS Configuration**
**Location:** `server.cjs` (line 31-36)
- **Issue:** CORS allows wildcard IP ranges and multiple origins
- **Risk:** MEDIUM - Potential CSRF attacks
- **Impact:** Requests from unauthorized origins accepted
- **Recommendation:** Restrict CORS to specific production domains only

### 7. **Row Level Security Policy Too Permissive**
**Location:** `supabase/migrations/20250718000001-create-admins-table.sql` (line 22-23)
- **Issue:** RLS policy allows all operations: `USING (true)`
- **Risk:** HIGH - Database security bypassed
- **Impact:** Anyone can access admin data
- **Recommendation:** Implement proper RLS policies with authentication checks

### 8. **Password Hashing in Frontend (Admin Dashboard)**
**Location:** `src/pages/admin/Dashboard.tsx` (line 658)
- **Issue:** Password hashing using bcrypt happens in frontend when approving ambassadors
- **Risk:** MEDIUM - Security best practice violation
- **Impact:** Password hashing should be server-side only
- **Recommendation:** Move password generation and hashing to backend API

### 9. **Sensitive Data Stored in localStorage**
**Location:** `src/pages/ambassador/Auth.tsx` (line 177), `src/pages/ambassador/Dashboard.tsx`
- **Issue:** Full ambassador user object stored in localStorage
- **Risk:** MEDIUM - Sensitive user data accessible via XSS
- **Impact:** User data including potentially sensitive fields exposed
- **Recommendation:** Store only minimal session data (ID, token), not full user object

---

## ⚠️ DEPENDENCY & INSTALLATION ISSUES

### 10. **Missing Dependencies**
**Location:** Root directory
- **Issue:** All npm dependencies are not installed
- **Status:** `npm list` shows all dependencies as UNMET
- **Impact:** Project cannot run
- **Recommendation:** Run `npm install` to install all dependencies

---

## 📋 CONFIGURATION ISSUES

### 11. **Port Mismatch**
**Location:** `env.example` vs `server.cjs`
- **Issue:** `env.example` shows PORT=8081, but `server.cjs` defaults to 8082
- **Risk:** LOW - Configuration confusion
- **Recommendation:** Align port numbers in documentation

### 12. **TypeScript Strict Mode Disabled**
**Location:** `tsconfig.json`
- **Issue:** `strictNullChecks`, `noImplicitAny` disabled
- **Risk:** MEDIUM - Type safety compromised
- **Impact:** Potential runtime errors not caught at compile time
- **Recommendation:** Enable strict mode for better type safety

---

## 🐛 CODE QUALITY ISSUES

### 13. **Missing Error Handling in API Endpoint**
**Location:** `server.cjs` - `/api/validate-ticket`
- **Issue:** Ticket validation may fail if `supabase` is null
- **Risk:** MEDIUM - Unhandled errors
- **Recommendation:** Add null check for supabase client

### 14. **Environment Variables Not Validated**
**Location:** `server.cjs`
- **Issue:** Email service may fail silently if env vars missing
- **Risk:** MEDIUM - Silent failures
- **Recommendation:** Validate required env vars on startup

### 15. **Cookie Security Settings**
**Location:** `server.cjs` (line 100-107)
- **Issue:** `secure: false` and `domain: 'localhost'` hardcoded
- **Risk:** MEDIUM - Cookies not secure in production
- **Recommendation:** Use environment-based configuration

---

## ✅ POSITIVE FINDINGS

1. ✅ Good project structure with clear separation of concerns
2. ✅ Comprehensive UI component library (shadcn/ui)
3. ✅ Database migrations are versioned
4. ✅ ESLint configuration is set up
5. ✅ Rate limiting implemented for email endpoint
6. ✅ Password hashing used (bcryptjs) - though in wrong location
7. ✅ JWT authentication implemented
8. ✅ Row Level Security enabled on tables

---

## 🔧 IMMEDIATE ACTION ITEMS

### Priority 1 (Fix Immediately):
1. ❗ Remove hardcoded Supabase credentials from client.ts
2. ❗ Remove bcrypt from frontend, create backend API for ambassador login
3. ❗ Move password hashing from Admin Dashboard to backend
4. ❗ Make JWT_SECRET required (no fallback)
5. ❗ Remove default admin user from migration
6. ❗ Fix RLS policies for admins table (remove `USING (true)`)
7. ❗ Remove full user object from localStorage (store only session token)
8. ❗ Install dependencies: `npm install`

### Priority 2 (Fix Soon):
9. ⚠️ Restrict CORS configuration (remove wildcards)
10. ⚠️ Add environment variable validation on server startup
11. ⚠️ Fix cookie security settings for production (use env-based config)
12. ⚠️ Remove unused bcrypt import from HeroSection.tsx

### Priority 3 (Improvements):
13. 📝 Enable TypeScript strict mode
14. 📝 Align port configuration (fix mismatch between env.example and server.cjs)
15. 📝 Add comprehensive error handling
16. 📝 Add input validation/sanitization
17. 📝 Consider using httpOnly cookies for ambassador sessions instead of localStorage

---

## 📊 SUMMARY

| Category | Count |
|----------|-------|
| Critical Issues | 9 |
| High Priority | 2 |
| Medium Priority | 4 |
| Low Priority | 2 |

**Overall Status:** ⚠️ **Project has critical security vulnerabilities that must be addressed before deployment.**

---

## 🚀 RECOMMENDED FIX ORDER

1. **Security First:** Fix all critical security issues
2. **Dependencies:** Install all npm packages
3. **Testing:** Test authentication flows after security fixes
4. **Configuration:** Align environment variables and configuration
5. **Code Quality:** Address TypeScript and error handling improvements

---

*Generated by Project Audit Tool*

