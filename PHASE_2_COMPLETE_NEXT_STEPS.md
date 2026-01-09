# ✅ Phase 2 Complete: ngrok Tunnel Setup

**Status:** ✅ ngrok tunnel is configured and URL added to Vercel!

**Your ngrok URL:** `https://haven-lachrymose-hyperdelicately.ngrok-free.dev`

---

## 🎯 What You've Done

✅ **Authentication configured** - ngrok auth token set  
✅ **Tunnel started** - ngrok running on port 8082  
✅ **HTTPS URL obtained** - `https://haven-lachrymose-hyperdelicately.ngrok-free.dev`  
✅ **Vercel configured** - `VITE_API_URL` environment variable set  

---

## ✅ Next Steps: Phase 3 - Verification & Testing

### **Step 1: Verify Backend is Running**

Make sure your backend server is running on port 8082:

```bash
node server.cjs
```

You should see:
```
✅ Server running on port 8082
```

**Keep this running!** The backend must stay active for ngrok to work.

---

### **Step 2: Verify ngrok is Running**

Check the ngrok terminal window. You should see:
```
Session Status                online
Account                       [your account]
Forwarding                    https://haven-lachrymose-hyperdelicately.ngrok-free.dev -> http://localhost:8082
```

**Keep this window open!** Closing it stops the tunnel.

---

### **Step 3: Redeploy Vercel Preview**

1. Go to: https://vercel.com/dashboard
2. Select your **Andiamo-Events** project
3. Go to **Deployments** tab
4. Find the latest preview deployment
5. Click **...** (three dots) → **Redeploy**
6. Or push a new commit to trigger redeploy

**Why redeploy?** Environment variables are only applied on new deployments.

---

### **Step 4: Test the Preview**

After redeployment:

1. **Visit your Vercel preview URL**
   - Should be something like: `https://andiamo-events-xyz.vercel.app`

2. **Open Browser DevTools** (F12)
   - Go to **Console** tab
   - Go to **Network** tab

3. **Test Online Payment Flow:**
   - Go to pass purchase page
   - Select a pass
   - Choose "Online Payment" (Flouci)
   - Check console for errors

4. **What to Look For:**
   - ✅ **No CORS errors** in console
   - ✅ **Network requests** go to `https://haven-lachrymose-hyperdelicately.ngrok-free.dev`
   - ✅ **Order creation** works
   - ✅ **Payment redirect** to Flouci works
   - ✅ **Payment verification** works

---

### **Step 5: Verify API Calls**

**Check Network Tab:**
- API calls should show: `https://haven-lachrymose-hyperdelicately.ngrok-free.dev/api/...`
- Not: `http://localhost:8082` ❌
- Not: `https://vercel-preview.vercel.app/api/...` ❌

**Check Console:**
- Should see logs showing API base URL
- No "CORS blocked" errors
- No "Network Error" or "Failed to fetch"

---

## 🔍 Troubleshooting

### **Issue: Still seeing CORS errors**

**Check:**
1. Vercel environment variable is set: `VITE_API_URL = https://haven-lachrymose-hyperdelicately.ngrok-free.dev`
2. **Redeployed** after setting the variable (important!)
3. Backend CORS is configured to allow your Vercel preview domain
4. Check `server.cjs` - CORS should allow your Vercel domain

### **Issue: API calls still going to localhost**

**Check:**
1. Environment variable is set in **Preview** environment (not just Production)
2. Redeployed after setting variable
3. Hard refresh browser (Ctrl+Shift+R)
4. Check if service worker is caching old URLs - clear cache

### **Issue: ngrok shows "Tunnel not found"**

**Solutions:**
1. Restart ngrok: `ngrok http 8082`
2. Get new URL from ngrok window
3. Update `VITE_API_URL` in Vercel with new URL
4. Redeploy

### **Issue: "ngrok-free.dev warning page"**

**This is normal!** Free ngrok shows a warning page on first visit.

**Solution:**
- Click "Visit Site" button on the warning page
- Or add `ngrok-skip-browser-warning` header to requests (for development only)

---

## ⚠️ Important Notes

### **ngrok URL Changes**

**Free tier:** URL changes every time you restart ngrok.

**If you restart ngrok:**
1. Get new URL from ngrok window
2. Update `VITE_API_URL` in Vercel
3. Redeploy preview

**Paid tier option:** Can get static URLs that don't change (optional upgrade).

### **Keep Services Running**

**Must be running simultaneously:**
1. ✅ Backend (`node server.cjs`) - port 8082
2. ✅ ngrok (`ngrok http 8082`) - tunnel to backend
3. ✅ Vercel preview - frontend deployment

**If any stops, preview will fail!**

---

## ✅ Success Checklist

- [ ] Backend running on port 8082
- [ ] ngrok tunnel active and showing HTTPS URL
- [ ] `VITE_API_URL` set in Vercel (Preview environment)
- [ ] Vercel preview redeployed after setting variable
- [ ] Tested preview - no CORS errors
- [ ] API calls go to ngrok URL (check Network tab)
- [ ] Order creation works
- [ ] Online payment flow works
- [ ] Payment verification works

---

## 🎉 Once Everything Works

**Phase 3 Complete!** Your preview deployment should now:
- ✅ Connect to local backend via ngrok
- ✅ No CORS errors
- ✅ Online payments work
- ✅ Order creation works
- ✅ All API calls succeed

**Next:** You can continue developing and testing on preview deployments. Remember to keep backend and ngrok running while testing!

---

## 📝 Quick Reference

**Start Backend:**
```bash
node server.cjs
```

**Start ngrok (separate terminal):**
```bash
ngrok http 8082
```

**Get ngrok URL:**
```powershell
.\get-ngrok-url.ps1
```

**Check ngrok web interface:**
- http://127.0.0.1:4040

**Your current ngrok URL:**
- `https://haven-lachrymose-hyperdelicately.ngrok-free.dev`
