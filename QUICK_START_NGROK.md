# 🚀 QUICK START: ngrok Tunnel

## ⚡ FASTEST WAY (2 Steps)

### **Step 1: Open a NEW Terminal/PowerShell Window**

**Keep your backend running in Terminal 1**, then open **Terminal 2** and run:

```bash
ngrok http 8082
```

**This will:**
- ✅ Start ngrok tunnel
- ✅ Show you the HTTPS URL immediately
- ✅ Keep the window open (don't close it!)

**You'll see output like:**
```
Forwarding    https://abc123.ngrok.io -> http://localhost:8082
```

**Copy the HTTPS URL:** `https://abc123.ngrok.io`

---

### **Step 2: Set in Vercel**

1. Go to: https://vercel.com/dashboard
2. Your Project → **Settings** → **Environment Variables**
3. Click **Add New**
4. **Name:** `VITE_API_URL`
5. **Value:** `https://abc123.ngrok.io` (your ngrok URL)
6. **Environment:** Select **All** (Production, Preview, Development)
7. Click **Save**
8. **Redeploy:** Go to Deployments → Click "..." → **Redeploy**

---

## ✅ DONE!

After redeploy:
- ✅ Preview will use your ngrok URL
- ✅ No more CORS errors
- ✅ Order creation will work
- ✅ Payment flow will work

---

## ⚠️ IMPORTANT

**Keep ngrok running:**
- ✅ Keep the ngrok terminal window open
- ✅ If you close it, tunnel stops
- ✅ Preview will fail until you restart ngrok

**If ngrok URL changes:**
- Free tier: URL changes when you restart ngrok
- Update `VITE_API_URL` in Vercel
- Redeploy preview

---

## 🔍 Get URL Anytime

If ngrok is running, open in browser:
- **Web Interface:** http://127.0.0.1:4040
- Shows tunnel URL and request logs

---

**That's it! Simple and fast.** 🎉
