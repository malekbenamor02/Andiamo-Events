# 🔧 Fix: Network Error After Preview Deployment

**Issue:** "Unexpected token 'N', 'Network Error' is not valid JSON" after deploying to preview  
**Status:** ✅ **FIXED** - Code updated, configuration needed

---

## 🎯 Root Cause

After deploying to Vercel preview, the frontend tries to call the backend API (`/api/flouci-generate-payment`), but:

1. **The backend server (`server.cjs`) is separate** - not deployed on Vercel
2. **`VITE_API_URL` is not set** in Vercel environment variables
3. The frontend tries to call the API on the Vercel domain, which doesn't have the backend endpoints
4. This causes a network error

---

## ✅ Solution

### **Step 1: Set `VITE_API_URL` in Vercel**

1. **Go to your Vercel project dashboard:**
   - https://vercel.com/dashboard
   - Select your project

2. **Go to Settings → Environment Variables**

3. **Add new environment variable:**
   - **Name:** `VITE_API_URL`
   - **Value:** Your backend server URL (e.g., `https://your-backend-server.com` or `https://your-backend.railway.app`)
   - **Environment:** Select all (Production, Preview, Development)

4. **Save and redeploy:**
   - Vercel will automatically redeploy with the new environment variable

---

## 🔍 How to Find Your Backend URL

### **If your backend is deployed separately:**

1. **Railway:**
   - Go to Railway dashboard
   - Your backend URL: `https://your-app.railway.app`

2. **Render:**
   - Go to Render dashboard
   - Your backend URL: `https://your-app.onrender.com`

3. **Fly.dev:**
   - Go to Fly.io dashboard
   - Your backend URL: `https://your-app.fly.dev`

4. **Custom domain:**
   - Use your custom backend domain: `https://api.yourdomain.com`

### **If your backend is on the same domain:**

- If backend is deployed as Vercel serverless functions on the same domain:
  - `VITE_API_URL` can be empty (code will use same origin)
  - OR set it to your Vercel preview/production URL

---

## 🧪 Testing

1. **After setting `VITE_API_URL` and redeploying:**

2. **Check browser console:**
   - Should see: `Using payment callback URLs: { apiBase: 'https://your-backend-url.com', ... }`

3. **Try payment flow:**
   - Should connect to backend successfully
   - No more "Network Error"

---

## 📝 Code Changes Made

### **1. Fixed API URL Fallback:**
```typescript
// Before:
const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : '');

// After:
const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : window.location.origin);
```

### **2. Improved Error Handling:**
- Better JSON parsing error handling
- Clearer error messages for network errors
- Added logging to show which API URL is being used

---

## ⚠️ Important Notes

1. **Backend Must Be Accessible:**
   - Your backend server must be running and accessible from the internet
   - It must accept requests from your Vercel preview domain (CORS configured)

2. **CORS Configuration:**
   - Make sure your backend (`server.cjs`) allows requests from Vercel domains
   - Check CORS settings in `server.cjs`

3. **Environment Variables:**
   - `VITE_API_URL` must be set in **all environments** (Production, Preview, Development)
   - Or at least in Preview if you're testing there

---

## 🔍 Troubleshooting

### **Still seeing network error?**

1. **Check `VITE_API_URL` is set:**
   - Go to Vercel dashboard → Settings → Environment Variables
   - Make sure `VITE_API_URL` exists and has correct value

2. **Check backend is running:**
   - Test backend URL directly: `https://your-backend-url.com/api/test` (if you have a test endpoint)
   - Should return a response

3. **Check CORS:**
   - Backend must allow requests from Vercel preview domain
   - Check `server.cjs` CORS configuration

4. **Check browser console:**
   - Look for the logged `apiUrl` value
   - Verify it's pointing to the correct backend

5. **Redeploy after setting environment variable:**
   - Vercel needs to rebuild with new environment variables
   - Go to Deployments → Redeploy

---

## ✅ Verification Checklist

- [ ] `VITE_API_URL` set in Vercel environment variables
- [ ] Backend server is running and accessible
- [ ] CORS allows requests from Vercel domain
- [ ] Vercel deployment rebuilt after setting environment variable
- [ ] Browser console shows correct `apiBase` URL
- [ ] Payment flow works without network errors

---

## 🎯 Summary

**The Fix:**
1. ✅ Code updated to use `window.location.origin` as fallback
2. ✅ Better error handling for network errors
3. ✅ Added logging to debug API URL

**What You Need to Do:**
1. ⚙️ Set `VITE_API_URL` in Vercel environment variables
2. 🔄 Redeploy your Vercel preview
3. ✅ Test payment flow

---

**After setting `VITE_API_URL` and redeploying, the network error should be resolved!** 🎉
