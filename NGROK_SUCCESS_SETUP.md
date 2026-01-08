# ✅ ngrok Authentication Success!

**Your ngrok auth token has been configured successfully!**

---

## 🎯 What Happens Next

### **Step 1: Start Your Backend**
Make sure your backend server is running on port 8082:

```bash
node server.cjs
```

You should see: `Server running on port 8082`

---

### **Step 2: Start ngrok Tunnel**

**Option A: Use the batch file**
```bash
start-ngrok.bat
```

**Option B: Manual command**
```bash
ngrok http 8082
```

**The window will now stay open!** ✅

You'll see output like:
```
Forwarding    https://abc123.ngrok.io -> http://localhost:8082
```

---

### **Step 3: Get Your HTTPS URL**

**Option A: Check the ngrok window**
- Look at the terminal where ngrok is running
- Copy the HTTPS URL shown (e.g., `https://abc123.ngrok.io`)

**Option B: Use the helper script**
```powershell
.\get-ngrok-url.ps1
```
This will:
- Connect to ngrok's local API
- Display the HTTPS URL
- Copy it to your clipboard automatically

**Option C: Check the web interface**
- Open browser: http://127.0.0.1:4040
- You'll see the ngrok dashboard with tunnel info

---

### **Step 4: Set in Vercel**

1. Go to: https://vercel.com/dashboard
2. Select your **Andiamo-Events** project
3. Go to: **Settings** → **Environment Variables**
4. Click **Add** or **Edit**:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://abc123.ngrok.io` (your ngrok URL from Step 3)
   - **Environment:** Select **Preview** (or **Production** if needed)
5. Click **Save**
6. **Redeploy** your preview deployment

---

### **Step 5: Test the Preview**

After redeploying:
1. Visit your Vercel preview URL
2. Try creating an order or using online payment
3. Check browser console - **no more CORS errors!** ✅
4. Check network tab - API calls should go to your ngrok URL

---

## 🔍 Verify Everything Works

### **Check ngrok is running:**
```powershell
.\get-ngrok-url.ps1
```

### **Test backend is accessible:**
Open in browser: `https://YOUR-NGROK-URL.ngrok.io/api/health`
(If you have a health endpoint)

### **Check Vercel environment variable:**
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Should see: `VITE_API_URL` with your ngrok URL

---

## ⚠️ Important Notes

### **ngrok URL Changes Each Time**
- **Free ngrok:** URL changes every time you restart ngrok
- **Paid ngrok:** Can get static URLs (optional upgrade)

**Solution:** After each ngrok restart, update `VITE_API_URL` in Vercel.

### **Keep ngrok Running**
- **The ngrok window MUST stay open** while testing
- Closing it stops the tunnel
- Preview will fail if ngrok is not running

### **Backend Must Be Running**
- Backend on `localhost:8082` must be running
- ngrok tunnels to it, but doesn't start it
- Always start backend first, then ngrok

---

## 🎉 You're All Set!

✅ ngrok authenticated  
✅ Ready to start tunnel  
✅ Instructions above for getting URL  
✅ Next: Set in Vercel and redeploy  

**Once ngrok URL is set in Vercel, your preview deployment will work perfectly!**

---

## 📝 Quick Reference Commands

```bash
# Start backend
node server.cjs

# Start ngrok (in separate terminal)
ngrok http 8082

# Get ngrok URL
.\get-ngrok-url.ps1

# Or visit web interface
# http://127.0.0.1:4040
```
