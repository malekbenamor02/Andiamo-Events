# 🚀 PHASE 2: NGROK TUNNEL SETUP GUIDE
**Date:** 2025-02-02  
**Status:** 📋 Setup Instructions  
**Purpose:** Expose localhost:8082 backend to preview frontend

---

## 🎯 QUICK START (5 MINUTES)

### **Step 1: Install ngrok**

**Option A: Using npm (Recommended)**
```bash
npm install -g ngrok
```

**Option B: Download Binary**
- Go to: https://ngrok.com/download
- Download for Windows
- Extract to a folder in your PATH

**Option C: Using Chocolatey (Windows)**
```bash
choco install ngrok
```

---

### **Step 2: Start Your Backend Server**

Make sure your backend is running:
```bash
node server.cjs
# Should see: Server running on port 8082
```

**Keep this terminal open!**

---

### **Step 3: Start ngrok Tunnel**

**Open a NEW terminal window** (keep backend running in first terminal):

```bash
ngrok http 8082
```

**You'll see output like:**
```
Session Status                online
Account                       Your Name (Plan: Free)
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok.io -> http://localhost:8082
```

**Copy the HTTPS URL:** `https://abc123.ngrok.io`

---

### **Step 4: Set VITE_API_URL in Vercel**

1. **Go to Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Select your project: `Andiamo-Events`

2. **Go to Settings → Environment Variables**

3. **Add New Variable:**
   - **Name:** `VITE_API_URL`
   - **Value:** `https://abc123.ngrok.io` (your ngrok URL)
   - **Environment:** Select all (Production, Preview, Development)

4. **Save**

5. **Redeploy:**
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"
   - OR: Push a new commit to trigger auto-deploy

---

### **Step 5: Verify It Works**

1. **Check Vercel deployment logs:**
   - Should see environment variable loaded

2. **Test in preview:**
   - Open preview URL
   - Open browser console
   - Should see: `apiBase: 'https://abc123.ngrok.io'`
   - Try creating an order
   - Should connect to backend (no CORS errors)

---

## ⚠️ IMPORTANT NOTES

### **Tunnel URL Changes (Free Tier)**
- ngrok free tier: URL changes every time you restart ngrok
- **Solution:** Keep ngrok running, or upgrade to paid plan for static URL

### **Keep Both Running**
- ✅ Backend server (`node server.cjs`) - Terminal 1
- ✅ ngrok tunnel (`ngrok http 8082`) - Terminal 2
- Both must stay running for preview to work

### **If Tunnel Stops**
- Preview will fail to connect
- Restart ngrok and update `VITE_API_URL` in Vercel
- Redeploy preview

---

## 🔍 TROUBLESHOOTING

### **"ngrok: command not found"**
- ngrok not in PATH
- Use full path: `C:\path\to\ngrok.exe http 8082`
- Or add ngrok to PATH

### **"Address already in use"**
- Port 8082 already in use
- Check if backend is already running
- Or use different port: `ngrok http 3000` (if backend on 3000)

### **"Tunnel not forwarding"**
- Check backend is running on port 8082
- Check ngrok web interface: http://127.0.0.1:4040
- Verify tunnel is "online"

### **"Still getting CORS errors"**
- Check `VITE_API_URL` is set in Vercel
- Redeploy after setting environment variable
- Check browser console for actual API URL being used

---

## ✅ VERIFICATION CHECKLIST

After setup, verify:

- [ ] Backend server running on port 8082
- [ ] ngrok tunnel active and showing HTTPS URL
- [ ] `VITE_API_URL` set in Vercel environment variables
- [ ] Vercel preview redeployed
- [ ] Browser console shows correct `apiBase` URL
- [ ] No CORS errors in console
- [ ] Order creation works
- [ ] Payment flow works

---

## 🎯 NEXT STEPS

After Phase 2 is complete:
- ✅ Phase 3: Verification & Testing
- ✅ Test all flows end-to-end
- ✅ Document for team

---

**Ready to proceed with Phase 2 setup!**
