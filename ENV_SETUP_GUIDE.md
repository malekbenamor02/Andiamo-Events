# 🔐 Environment Variables Setup Guide

## Frontend Supabase Error Fix

The error `Failed to construct 'URL': Invalid URL` means your Supabase environment variables are missing or invalid.

---

## Step 1: Create `.env` File

Create a `.env` file in the project root (same level as `package.json`).

---

## Step 2: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy these values:

---

## Step 3: Add to `.env` File

```env
# ============================================
# SUPABASE CONFIGURATION
# ============================================

# Frontend (Vite) - Required for React app
VITE_SUPABASE_URL=https://ykeryyraxmtjunnotoep.supabase.co
VITE_SUPABASE_ANON_KEY=paste_your_anon_key_here

# Backend (Server) - Required for Express API
SUPABASE_URL=https://ykeryyraxmtjunnotoep.supabase.co
SUPABASE_ANON_KEY=paste_your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=paste_your_service_role_key_here

# ============================================
# JWT & AUTHENTICATION
# ============================================
JWT_SECRET=your-secret-jwt-key-here-change-this-in-production

# ============================================
# GOOGLE RECAPTCHA
# ============================================
VITE_RECAPTCHA_SITE_KEY=your_recaptcha_site_key_here
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key_here
DISABLE_RECAPTCHA_LOCALHOST=true
VITE_DISABLE_RECAPTCHA_LOCALHOST=true

# ============================================
# EMAIL SMTP
# ============================================
EMAIL_USER=support@andiamoevents.com
EMAIL_PASS=your_email_password_here
EMAIL_HOST=mail.routing.net
EMAIL_PORT=587

# ============================================
# SERVER CONFIG
# ============================================
PORT=8082
NODE_ENV=development
```

---

## Step 4: Restart Dev Server

After creating `.env`:
```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
npm run server
```

---

## ⚠️ Important Notes

1. **Never commit `.env` to git** - It's in `.gitignore`
2. **Use different keys for production** - Don't use service_role key in frontend
3. **VITE_ prefix** - Only variables starting with `VITE_` are available in frontend
4. **Restart required** - Environment variables are loaded at startup

---

## 🔍 Verify Setup

After restarting, check browser console:
- ✅ No "Invalid URL" errors
- ✅ Supabase client initializes
- ✅ API calls work

---

## 📝 Quick Checklist

- [ ] Created `.env` file in project root
- [ ] Added `VITE_SUPABASE_URL` (with `https://`)
- [ ] Added `VITE_SUPABASE_ANON_KEY`
- [ ] Added `SUPABASE_SERVICE_ROLE_KEY` (for backend)
- [ ] Restarted dev server
- [ ] Frontend loads without errors

