# 🔐 ngrok Authentication Setup

**If ngrok terminal closes immediately, it likely needs authentication!**

---

## 🚨 Problem: ngrok Closes Immediately

**This usually means:** ngrok needs authentication token.

ngrok v5+ requires a free account and authentication token.

---

## ✅ SOLUTION: Setup ngrok Authentication

### **Step 1: Create Free ngrok Account**

1. Go to: https://dashboard.ngrok.com/signup
2. Sign up for free account (email + password)
3. Confirm email

---

### **Step 2: Get Your Auth Token**

1. After signup, go to: https://dashboard.ngrok.com/get-started/your-authtoken
2. You'll see your auth token (looks like: `2abc123def456ghi789jkl012mno345pqr_6stu789vwx012yz345`)
3. **Copy it!**

---

### **Step 3: Configure ngrok**

**Run this command in terminal:**

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN_HERE
```

**Replace `YOUR_AUTH_TOKEN_HERE` with your actual token from Step 2.**

**Example:**
```bash
ngrok config add-authtoken 2abc123def456ghi789jkl012mno345pqr_6stu789vwx012yz345
```

**You should see:** `Authtoken saved to configuration file`

---

### **Step 4: Start ngrok**

Now ngrok will work! Run:

```bash
ngrok http 8082
```

**This window will stay open and show:**
```
Forwarding    https://abc123.ngrok.io -> http://localhost:8082
```

**Copy the HTTPS URL:** `https://abc123.ngrok.io`

---

### **Step 5: Set in Vercel**

1. Go to: https://vercel.com/dashboard
2. Your Project → Settings → Environment Variables
3. Add: `VITE_API_URL` = `https://abc123.ngrok.io`
4. Save and redeploy

---

## 🔍 Verify ngrok is Running

**After authentication is set up, ngrok will:**
- ✅ Stay open when you run `ngrok http 8082`
- ✅ Show tunnel URL immediately
- ✅ Keep running until you press Ctrl+C

**To verify:**
- Open browser: http://127.0.0.1:4040
- Should show ngrok web interface with tunnel info

---

## ⚠️ Common Issues

### **"ngrok: command not found"**
- ngrok not in PATH
- Run: `npm install -g ngrok`
- Or add ngrok to PATH manually

### **"authtoken is invalid"**
- Token copied incorrectly
- Get new token from dashboard
- Make sure there are no spaces

### **"port 8082: address already in use"**
- Backend already running (that's good!)
- Make sure backend is running first
- Then start ngrok

---

## ✅ After Setup

Once ngrok is authenticated:
- ✅ Window stays open
- ✅ Shows HTTPS URL
- ✅ Preview can connect to backend
- ✅ No more CORS errors!

---

**The authentication setup is ONE-TIME. After that, ngrok just works!** 🎉
