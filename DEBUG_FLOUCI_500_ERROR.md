# Debug Flouci 500 Error - Step by Step

Since you've added the API keys correctly but still get a 500 error, let's debug what Flouci is actually returning.

## Step 1: Check Backend Console Logs

When you try to make a payment, check your **backend server console** (where you run `node server.cjs`). You should see detailed logs like:

```
🔔 Flouci payment generation request: ...
📤 Calling Flouci API to generate payment...
📥 Flouci API response: { status: 200, success: true, ... }
```

**OR if there's an error:**
```
❌ Flouci payment generation failed: { status: 400, data: {...} }
```

**What to look for:**
1. What status code does Flouci return? (200, 400, 401, 403, 500?)
2. What's the `data.message` or `data.result.message`?
3. What's the full error response?

## Step 2: Common Flouci API Errors

### Error 1: Invalid API Keys (401/403)
**Symptom:** Flouci returns 401 or 403
**Solution:**
- Double-check keys are correct (no extra spaces, no quotes)
- Make sure you're using **merchant** keys, not test keys
- Verify keys in Flouci dashboard

### Error 2: Invalid Amount (400)
**Symptom:** `"Invalid amount"` or `"amount must be positive"`
**Solution:**
- Amount must be in millimes (1 TND = 1000 millimes)
- Amount must be > 0
- Check if order total is valid

### Error 3: Invalid URLs (400)
**Symptom:** `"Invalid success_link"` or `"Invalid webhook URL"`
**Solution:**
- URLs must be valid HTTP/HTTPS URLs
- Webhook URL must be publicly accessible (not localhost)
- Success/fail links can be localhost for testing

### Error 4: Missing Required Fields (400)
**Symptom:** `"Missing required field: ..."`
**Solution:**
- All required fields must be present
- Check backend logs to see what's being sent

## Step 3: Check Browser Network Tab

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Try making a payment
4. Click on the failed `flouci-generate-payment` request
5. Go to **Response** tab
6. See what error message Flouci returned

The response should look like:
```json
{
  "error": "Actual error message from Flouci",
  "details": { ... },
  "status": 400
}
```

## Step 4: Test API Keys Manually

You can test if your keys work by making a manual API call:

**Using curl (in terminal):**
```bash
curl -X POST 'https://developers.flouci.com/api/v2/generate_payment' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_PUBLIC_KEY:YOUR_SECRET_KEY' \
  -d '{
    "amount": 1000,
    "success_link": "https://example.com/success",
    "fail_link": "https://example.com/fail",
    "developer_tracking_id": "test-123"
  }'
```

**What to check:**
- If this works, keys are valid
- If this fails, see what error Flouci returns
- Compare the error with what your backend gets

## Step 5: Verify Environment Variables

Make sure your `.env` file has the keys correctly:

```env
FLOUCI_PUBLIC_KEY=FLWPUBK-xxxxxxxxxxxxx
FLOUCI_SECRET_KEY=FLWSECK-xxxxxxxxxxxxx
```

**Common mistakes:**
- ❌ Extra spaces: `FLOUCI_PUBLIC_KEY = value` (should be `FLOUCI_PUBLIC_KEY=value`)
- ❌ Quotes around values: `FLOUCI_PUBLIC_KEY="value"` (quotes are included in the value!)
- ❌ Wrong file: Keys in wrong `.env` file
- ❌ Server not restarted: Changes to `.env` require server restart

## Step 6: Check Backend Server Logs

After making a payment attempt, your backend console should show:

**If keys are missing:**
```
❌ Flouci API keys not configured
   FLOUCI_PUBLIC_KEY: Missing
   FLOUCI_SECRET_KEY: Missing
```

**If keys are set but API fails:**
```
📤 Calling Flouci API to generate payment...
📥 Flouci API response: { status: 400, success: false, ... }
❌ Flouci payment generation failed: {
  status: 400,
  data: { message: "Actual error from Flouci" }
}
```

**Copy the full error message** and share it - that will tell us exactly what's wrong!

## Step 7: Common Issues & Fixes

### Issue: "Invalid webhook URL"
**Fix:** Webhook is optional for testing. The code now skips webhook if it's localhost.

### Issue: "Invalid amount"
**Fix:** Check that order total is valid and > 0.

### Issue: "Unauthorized" or "Forbidden"
**Fix:** API keys are wrong or account not activated.

### Issue: Network timeout
**Fix:** Check internet connection, Flouci API might be down.

## What to Share for Help

If you're still stuck, share:

1. **Backend console error** (the full log output)
2. **Browser Network tab response** (the error JSON)
3. **Your `.env` file format** (don't share actual keys!)
4. **Flouci API response** from manual test (if you tried)

This will help identify the exact issue!

