# Admin & Super Admin Authentication System Documentation

## Overview
The authentication system uses JWT tokens stored in httpOnly cookies, with role-based access control (RBAC) distinguishing between `admin` and `super_admin` roles.

---

## 🔐 Authentication Flow

### 1. **Login Process** (`/admin/login`)

**Frontend:** `src/pages/admin/Login.tsx`
- User enters email and password
- reCAPTCHA v3 verification (bypassable on localhost)
- POST request to `/api/admin-login` with credentials

**Backend:** `server.cjs` - `/api/admin-login` endpoint
```javascript
// Steps:
1. Verify reCAPTCHA token
2. Query `admins` table by email
3. Compare password using bcrypt
4. Generate JWT token containing: { id, email, role }
5. Set httpOnly cookie named 'adminToken' (24h expiration)
6. Return success response
```

**JWT Token Structure:**
```json
{
  "id": "admin-uuid",
  "email": "admin@example.com",
  "role": "admin" | "super_admin",
  "exp": 1234567890
}
```

---

### 2. **Route Protection** (`/admin`)

**Component:** `src/components/auth/ProtectedAdminRoute.tsx`
- On mount, calls `/api/verify-admin`
- Checks if `data.valid === true`
- If invalid → redirects to `/admin/login`
- If valid → renders Dashboard

**Backend:** `server.cjs` - `/api/verify-admin` endpoint
```javascript
// Middleware: requireAdminAuth
1. Extracts 'adminToken' from cookies
2. Verifies JWT using JWT_SECRET
3. Decodes token to get admin info
4. Queries database to verify admin exists and is_active = true
5. Returns: { valid: true, admin: { id, email, name, role } }
```

---

### 3. **Role Verification in Dashboard**

**Component:** `src/pages/admin/Dashboard.tsx`

**Role Fetching:**
```typescript
useEffect(() => {
  const fetchCurrentAdminRole = async () => {
    const response = await fetch('/api/verify-admin', {
      credentials: 'include'
    });
    const data = await response.json();
    if (data.valid && data.admin) {
      setCurrentAdminRole(data.admin.role); // 'admin' or 'super_admin'
    }
  };
  fetchCurrentAdminRole();
  // Refetch every 30 seconds
  const interval = setInterval(fetchCurrentAdminRole, 30000);
}, []);
```

**Role-Based UI:**
- **Super Admin Only:**
  - "Admins Management" tab (line 5505)
  - "Platform Logs" tab (restricted to super_admin)
  - Can add/edit/delete other admins
  
- **All Admins:**
  - Overview, Events, Ambassadors, Applications tabs
  - Settings, Marketing, Content Management

**Example:**
```typescript
{currentAdminRole === 'super_admin' && (
  <TabsTrigger value="admins">Admins Management</TabsTrigger>
)}
```

---

## 🛡️ Security Features

### 1. **JWT Token Storage**
- **httpOnly cookies** - Prevents XSS attacks (JavaScript cannot access)
- **24-hour expiration** - Automatic logout after 24h
- **Secure flag** - Set to `false` for localhost, should be `true` in production

### 2. **Password Security**
- Passwords hashed with **bcrypt** (10 rounds)
- Stored in `admins.password` column
- Never sent to frontend

### 3. **reCAPTCHA Protection**
- reCAPTCHA v3 on login form
- Bypassable on localhost if `VITE_DISABLE_RECAPTCHA_LOCALHOST=true`
- Prevents automated login attempts

### 4. **Middleware Protection**
```javascript
function requireAdminAuth(req, res, next) {
  const token = req.cookies.adminToken;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded; // Attach admin info to request
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
```

### 5. **Database Verification**
- Every protected endpoint verifies admin exists in database
- Checks `is_active = true`
- Validates role from database (not just JWT)

---

## 📊 Database Schema

### `admins` Table
```sql
CREATE TABLE admins (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL, -- bcrypt hashed
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  phone TEXT, -- Optional
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Roles:**
- `admin` - Standard admin access
- `super_admin` - Full access including admin management and platform logs

---

## 🔄 Authentication State Management

### Frontend State
```typescript
const [currentAdminRole, setCurrentAdminRole] = useState<string | null>(null);
```

**Updates:**
- On Dashboard mount
- Every 30 seconds (polling)
- After role changes in database

### Backend State
- Stored in JWT token (stateless)
- Verified against database on each request
- No server-side session storage

---

## 🚪 Logout Process

**Frontend:** `src/pages/admin/Dashboard.tsx`
```typescript
const handleLogout = async () => {
  await fetch('/api/admin-logout', {
    method: 'POST',
    credentials: 'include'
  });
  navigate('/admin/login');
};
```

**Backend:** `server.cjs` - `/api/admin-logout`
```javascript
app.post('/api/admin-logout', (req, res) => {
  res.clearCookie('adminToken');
  res.json({ success: true });
});
```

---

## 🔍 Role Checking Examples

### 1. **Check if Super Admin**
```typescript
if (currentAdminRole === 'super_admin') {
  // Show super admin features
}
```

### 2. **Backend Role Check**
```javascript
// In server.cjs
if (req.admin.role !== 'super_admin') {
  return res.status(403).json({ error: 'Forbidden: Only super admins' });
}
```

### 3. **Database RLS Policies**
```sql
-- Example: Only super_admin can view platform_logs
CREATE POLICY "Super admin can view all logs" ON platform_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id::text = auth.uid()::text
      AND admins.role = 'super_admin'
    )
  );
```

---

## ⚠️ Important Notes

1. **JWT Secret:** Must be set in `JWT_SECRET` environment variable
2. **Cookie Domain:** Currently set to `localhost` - update for production
3. **HTTPS:** In production, set `secure: true` in cookie options
4. **Role Updates:** Role changes require logout/login to take effect (JWT contains role)
5. **Token Expiration:** 24 hours - no automatic refresh (user must re-login)

---

## 🐛 Troubleshooting

### Issue: "Not authenticated" error
- **Check:** Cookie is being sent (`credentials: 'include'`)
- **Check:** JWT_SECRET matches between server restarts
- **Check:** Token hasn't expired (24h limit)

### Issue: Role not updating
- **Solution:** Log out and log back in (JWT contains role at login time)
- **Check:** Database `admins.role` is correct
- **Check:** `currentAdminRole` state is being set

### Issue: Super admin features not showing
- **Check:** `currentAdminRole === 'super_admin'` in console
- **Check:** Database role is `super_admin` (not `admin`)
- **Check:** JWT token contains correct role (decode at jwt.io)

---

## 📝 API Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin-login` | POST | None | Login and get JWT cookie |
| `/api/admin-logout` | POST | None | Clear JWT cookie |
| `/api/verify-admin` | GET | Cookie | Verify token and return admin info |
| `/api/admin-update-application` | POST | Cookie | Update application status |
| `/api/get-platform-logs` | GET | Cookie + Super Admin | Get platform logs (super_admin only) |

---

## 🔐 Environment Variables Required

```env
# Backend (server.cjs)
JWT_SECRET=your-secret-key-here
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
RECAPTCHA_SECRET_KEY=your-recaptcha-secret

# Frontend (.env)
VITE_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
VITE_DISABLE_RECAPTCHA_LOCALHOST=true  # Optional for localhost
```

---

## ✅ Security Checklist

- [x] Passwords hashed with bcrypt
- [x] JWT tokens in httpOnly cookies
- [x] reCAPTCHA on login
- [x] Role verification on backend
- [x] Database verification on each request
- [x] Token expiration (24h)
- [ ] HTTPS in production (update cookie secure flag)
- [ ] Rate limiting on login endpoint (10 req/15min)
- [ ] Logging of failed login attempts

---

**Last Updated:** 2025-01-31
**Version:** 1.0


