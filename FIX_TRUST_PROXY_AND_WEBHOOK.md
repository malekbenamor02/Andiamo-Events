# Fix: Trust Proxy and Flouci SMT Error

## ✅ Fixed Issues

### **1. Trust Proxy Warning**
**Problem:** `ValidationError: The 'X-Forwarded-For' header is set but the Express 'trust proxy' setting is false`

**Root Cause:** Requests come through ngrok which sets `X-Forwarded-For` headers, but Express doesn't trust proxies by default.

**Solution:** Added `app.set('trust proxy', true);` to Express configuration.

**Status:** ✅ **FIXED**

---

### **2. Webhook URL Construction**
**Problem:** Webhook URL might not be using the correct backend URL.

**Solution:** 
- Updated webhook URL construction to always use `VITE_API_URL` (ngrok URL) when available
- Webhook URL now uses backend URL (ngrok) not frontend URL (Vercel)
- Added better logging for webhook URL setup

**Status:** ✅ **IMPROVED**

---

## ⚠️ Flouci SMT Error Investigation

### **Error Details:**
```
Status: 412 Precondition Failed
Error: "SMT operation failed."
Code: 1
```

### **Possible Causes:**

1. **ngrok Free Tier Warning Page**
   - ngrok free tier (`*.ngrok-free.dev`) shows a browser warning page
   - Webhooks are server-to-server and should work, but Flouci might check the URL before creating payment
   - **Solution:** Consider upgrading to paid ngrok for static URLs, OR wait and see if it works after trust proxy fix

2. **Webhook URL Not Accessible**
   - Flouci might be checking if the webhook URL is reachable
   - If ngrok is not running or URL changed, this would fail
   - **Solution:** Ensure ngrok tunnel is active and URL matches `VITE_API_URL` in Vercel

3. **Flouci API Requirements**
   - Flouci might have specific requirements for webhook URLs
   - The SMT (Secure Message Transfer?) operation might be checking webhook accessibility
   - **Solution:** Try testing the webhook endpoint manually:
     ```bash
     curl -X POST https://haven-lachrymose-hyperdelicately.ngrok-free.dev/api/flouci-webhook \
       -H "Content-Type: application/json" \
       -d '{"test": "data"}'
     ```

4. **Webhook URL Format**
   - Make sure webhook URL is exactly: `https://haven-lachrymose-hyperdelicately.ngrok-free.dev/api/flouci-webhook`
   - No trailing slashes
   - Must be HTTPS
   - **Solution:** Check console logs to verify webhook URL format

---

## 🔍 Next Steps to Debug SMT Error

### **Step 1: Restart Backend with Fix**
The trust proxy fix requires a backend restart:

```bash
# Stop current backend (Ctrl+C)
# Start again
node server.cjs
```

### **Step 2: Verify Webhook URL in Logs**
After restart, check console logs when creating payment:
- Should see: `✅ Webhook URL set: https://haven-lachrymose-hyperdelicately.ngrok-free.dev/api/flouci-webhook...`
- Or: `⚠️ No webhook URL provided`

### **Step 3: Test Webhook Endpoint Manually**
Verify the webhook endpoint is accessible:

```bash
curl -X POST https://haven-lachrymose-hyperdelicately.ngrok-free.dev/api/flouci-webhook \
  -H "Content-Type: application/json" \
  -d '{"payment_id": "test", "status": "SUCCESS", "developer_tracking_id": "test"}'
```

**Expected:** Should get a response (even if it's an error about missing fields, that means endpoint is reachable)

### **Step 4: Check Flouci Dashboard**
- Log into Flouci dashboard
- Check if there are any webhook requirements or settings
- Verify API keys are correct

### **Step 5: Try Without Webhook (Temporary)**
If webhook is causing the issue, temporarily remove it to test if payment generation works:

**Note:** This is just for testing - webhook is important for automatic order updates.

---

## 📝 Changes Made

### **server.cjs:**
```javascript
// Added trust proxy for ngrok
app.set('trust proxy', true);

// Improved webhook logging
console.log('✅ Webhook URL set:', webhookUrl.substring(0, 80) + '...');
```

### **src/pages/PaymentProcessing.tsx:**
```typescript
// Webhook URL now uses backend URL (ngrok) not frontend
const webhookUrl = apiBase ? `${apiBase}/api/flouci-webhook` : undefined;
```

---

## ✅ After Restart

1. **Restart backend:** `node server.cjs`
2. **Keep ngrok running:** `ngrok http 8082`
3. **Test payment creation** again
4. **Check logs** for webhook URL confirmation
5. **Verify** trust proxy warning is gone

---

## 🎯 Expected Results

After restart:
- ✅ No more trust proxy warning
- ✅ Webhook URL correctly uses ngrok URL
- ✅ Better logging shows webhook setup

For SMT error:
- If it persists, try testing webhook endpoint manually
- Consider Flouci dashboard for webhook requirements
- May need to upgrade ngrok or contact Flouci support

---

**All fixes pushed. Restart backend to apply changes!**

**Last redeploy:** 2025-02-02
