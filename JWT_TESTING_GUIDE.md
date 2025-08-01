# JWT Authentication Testing Guide

## 🔐 Overview
Your Andiamo Events project uses JWT (JSON Web Tokens) for admin authentication. Here's how to test it thoroughly.

## 📋 Prerequisites
1. **Server running**: `node server.cjs`
2. **Admin account** in Supabase `admins` table
3. **Browser developer tools** open
4. **Postman or similar** for API testing

## 🧪 Testing Methods

### **1. Manual Testing via Browser**

#### **Step 1: Test Admin Login**
```bash
# Start the server
node server.cjs
```

**Navigate to:** `http://localhost:3000/admin/login`

**Test Cases:**
- ✅ **Valid credentials** - Should redirect to dashboard
- ❌ **Invalid email** - Should show error
- ❌ **Invalid password** - Should show error
- ❌ **Empty fields** - Should show validation errors

#### **Step 2: Check JWT Token**
1. **Open Developer Tools** (F12)
2. **Go to Application/Storage tab**
3. **Check Cookies** - Look for `adminToken`
4. **Verify token exists** after successful login

#### **Step 3: Test Protected Routes**
- ✅ **With valid token** - Should access admin dashboard
- ❌ **Without token** - Should redirect to login
- ❌ **With expired token** - Should redirect to login

### **2. API Testing with Postman**

#### **Admin Login Endpoint**
```http
POST http://localhost:8080/api/admin-login
Content-Type: application/json

{
  "email": "admin@andiamo.com",
  "password": "adminpassword"
}
```

**Expected Response:**
```json
{
  "success": true
}
```

**Check Cookies:**
- Look for `adminToken` in response cookies
- Verify `httpOnly: true`
- Verify `secure: true`
- Verify `sameSite: strict`

#### **Admin Logout Endpoint**
```http
POST http://localhost:8080/api/admin-logout
```

**Expected Response:**
```json
{
  "success": true
}
```

**Verify:**
- Cookie is cleared
- Can't access protected routes after logout

### **3. JWT Token Analysis**

#### **Decode JWT Token**
1. **Copy token** from browser cookies
2. **Go to:** https://jwt.io/
3. **Paste token** in the debugger
4. **Verify payload:**
```json
{
  "id": "admin-id",
  "email": "admin@andiamo.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234574490
}
```

#### **Check Token Expiration**
- **Current time:** `Date.now() / 1000`
- **Token expiration:** `exp` field
- **Should be:** 2 hours from creation

### **4. Security Testing**

#### **Test Invalid Tokens**
```javascript
// Test with malformed token
fetch('/api/protected-route', {
  headers: {
    'Cookie': 'adminToken=invalid-token'
  }
})
```

#### **Test Expired Tokens**
```javascript
// Create expired token for testing
const expiredToken = jwt.sign(
  { id: 'test', email: 'test@test.com', role: 'admin' },
  'secret',
  { expiresIn: '1s' }
);
// Wait 2 seconds, then test
```

#### **Test Missing Tokens**
```javascript
// Test without token
fetch('/api/protected-route', {
  headers: {}
})
```

### **5. Frontend Integration Testing**

#### **Test Login Flow**
```javascript
// In browser console
fetch('http://localhost:8080/api/admin-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'admin@andiamo.com',
    password: 'adminpassword'
  }),
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log(data));
```

#### **Test Logout Flow**
```javascript
// In browser console
fetch('http://localhost:8080/api/admin-logout', {
  method: 'POST',
  credentials: 'include'
})
.then(res => res.json())
.then(data => console.log(data));
```

### **6. Database Testing**

#### **Check Admin Table**
```sql
-- Verify admin exists
SELECT * FROM admins WHERE email = 'admin@andiamo.com';

-- Check password is hashed
SELECT email, password FROM admins;
-- Password should be hashed with bcrypt
```

#### **Test Password Hashing**
```javascript
// In Node.js console
const bcrypt = require('bcryptjs');
const password = 'adminpassword';
const hashedPassword = await bcrypt.hash(password, 10);
console.log('Hashed:', hashedPassword);

// Test comparison
const isMatch = await bcrypt.compare(password, hashedPassword);
console.log('Match:', isMatch); // Should be true
```

### **7. Environment Variables Testing**

#### **Check JWT Secret**
```bash
# In .env file
JWT_SECRET=your-secret-jwt-key-here

# Test in server
console.log('JWT Secret:', process.env.JWT_SECRET);
```

#### **Test Fallback Secret**
```javascript
// Remove JWT_SECRET from .env
// Restart server
// Should use 'fallback-secret'
```

### **8. Error Handling Testing**

#### **Test Invalid Credentials**
```http
POST http://localhost:8080/api/admin-login
Content-Type: application/json

{
  "email": "wrong@email.com",
  "password": "wrongpassword"
}
```

**Expected Response:**
```json
{
  "error": "Invalid credentials"
}
```

#### **Test Missing Supabase**
```javascript
// Comment out Supabase initialization
// Test login endpoint
// Should return: "Supabase not configured"
```

### **9. Performance Testing**

#### **Test Rate Limiting**
```bash
# Send multiple requests quickly
for i in {1..15}; do
  curl -X POST http://localhost:8080/api/send-email \
    -H "Content-Type: application/json" \
    -d '{"to":"test@test.com","subject":"Test","html":"<p>Test</p>"}'
done
```

**Expected:**
- First 10 requests: Success
- Next 5 requests: "Too many requests"

### **10. Browser Security Testing**

#### **Test Cookie Security**
1. **Check cookie attributes:**
   - `httpOnly: true` ✅
   - `secure: true` ✅
   - `sameSite: strict` ✅

2. **Test XSS protection:**
```javascript
// Try to access cookie via JavaScript
console.log(document.cookie); // Should not show adminToken
```

3. **Test CSRF protection:**
```javascript
// Test cross-origin requests
fetch('http://localhost:8080/api/admin-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'admin@andiamo.com',
    password: 'adminpassword'
  })
})
// Should fail due to CORS/sameSite
```

## 🎯 Test Checklist

### **Authentication Flow**
- [ ] Admin can login with valid credentials
- [ ] Admin cannot login with invalid credentials
- [ ] JWT token is created and stored in httpOnly cookie
- [ ] Token contains correct payload (id, email, role)
- [ ] Token expires after 2 hours
- [ ] Admin can logout and token is cleared
- [ ] Protected routes require valid token
- [ ] Expired tokens are rejected
- [ ] Malformed tokens are rejected

### **Security Features**
- [ ] Passwords are hashed with bcrypt
- [ ] JWT secret is from environment variables
- [ ] Cookies are httpOnly, secure, and sameSite strict
- [ ] Rate limiting is working
- [ ] Input validation is working
- [ ] Error messages don't leak sensitive information

### **Integration Testing**
- [ ] Frontend can login and access admin dashboard
- [ ] Frontend can logout and lose access
- [ ] Email functionality works with authentication
- [ ] Database operations work with authentication
- [ ] Error handling works correctly

## 🚨 Common Issues & Solutions

### **Issue: "Not authenticated" error**
**Solution:** Check if JWT_SECRET is set in .env file

### **Issue: Token expires too quickly**
**Solution:** Check token expiration time in JWT sign options

### **Issue: Can't access protected routes**
**Solution:** Verify cookie is being sent with requests

### **Issue: Login works but dashboard doesn't load**
**Solution:** Check if frontend is properly handling authentication state

## 📊 Testing Results Template

```markdown
## JWT Authentication Test Results

### ✅ Passed Tests
- Admin login with valid credentials
- JWT token creation and storage
- Protected route access
- Logout functionality
- Token expiration handling

### ❌ Failed Tests
- [List any failed tests]

### 🔧 Issues Found
- [List any issues discovered]

### 📈 Performance
- Login response time: ___ms
- Token validation time: ___ms
- Rate limiting: Working/Not working

### 🔒 Security
- Password hashing: ✅
- Cookie security: ✅
- Token expiration: ✅
- Rate limiting: ✅
```

## 🎉 Success Criteria

Your JWT authentication is working correctly if:
1. ✅ Admin can login and access dashboard
2. ✅ Token is properly stored in secure cookie
3. ✅ Protected routes require authentication
4. ✅ Logout clears token and access
5. ✅ Invalid/expired tokens are rejected
6. ✅ No security vulnerabilities found

**Happy testing!** 🚀 