# Vercel Preview Deployment Guide for Flouci Payment Testing

## ✅ Configuration Status

**Current Implementation:**
- ✅ Frontend auto-detects Vercel preview domains (`.vercel.app`)
- ✅ Backend webhook URL uses `API_BASE_URL` or `API_URL`
- ✅ HTTPS URLs enforced for all Flouci callbacks
- ✅ No localhost references in production code
- ✅ Payment logic frozen (no changes)

---

## 📋 Step-by-Step Deployment

### 1️⃣ Push to Vercel Preview

```bash
# Ensure you're on your feature branch
git push origin your-branch-name
```

Vercel will automatically create a Preview Deployment.

**Expected Preview URL format:**
```
https://andiamo-events-git-preview-XXXX-username.vercel.app
```

---

### 2️⃣ Set Environment Variables in Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

**Add these variables (Scope: Preview only):**

| Variable | Value | Purpose |
|----------|-------|---------|
| `VITE_PUBLIC_URL` | `https://andiamo-events-git-preview-XXXX-username.vercel.app` | Frontend callback URLs (success/fail links) |
| `API_BASE_URL` | `https://andiamo-events-git-preview-XXXX-XXXX-username.vercel.app` | Backend webhook URL construction |
| `NODE_ENV` | `preview` | Environment detection (optional) |

**⚠️ Important:**
- Replace `XXXX` with your actual preview subdomain
- `VITE_PUBLIC_URL` and `API_BASE_URL` should match your Preview URL
- Set scope to **"Preview"** only (not Production)

**Also ensure these are set (already should be):**
- `FLOUCI_PUBLIC_KEY`
- `FLOUCI_SECRET_KEY`
- `FLOUCI_WEBHOOK_SECRET` (optional, for signature verification)
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS`
- `WINSMS_API_KEY`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

---

### 3️⃣ Verify Configuration

**Frontend (PaymentProcessing.tsx):**
- ✅ Uses `VITE_PUBLIC_URL` if set, otherwise auto-detects `.vercel.app`
- ✅ Builds `successLink` and `failLink` from `publicUrl`
- ✅ Sends only `orderId`, `successLink`, `failLink` (no amount)

**Backend (server.cjs):**
- ✅ Webhook URL built from `API_BASE_URL` or `API_URL`
- ✅ Validates URLs are HTTPS
- ✅ Rejects localhost URLs

**Webhook Endpoint:**
- ✅ Available at: `/api/flouci/webhook`
- ✅ Should respond to GET requests (404/405 is OK)
- ✅ Must respond to POST requests with 200

---

### 4️⃣ Redeploy Preview

After setting environment variables:

```bash
# Option 1: Trigger redeploy via Vercel Dashboard
# Go to Deployments → Select preview → Redeploy

# Option 2: Push an empty commit (if needed)
git commit --allow-empty -m "Trigger redeploy for env vars"
git push
```

---

## 🧪 Post-Deployment Verification

### Manual Test Checklist

**Test 1: Webhook Endpoint Reachability**
```bash
# Should return 404 or 405 (method not allowed) for GET
curl https://your-preview-url.vercel.app/api/flouci/webhook

# Should accept POST (will return 400 without valid payload, but endpoint exists)
curl -X POST https://your-preview-url.vercel.app/api/flouci/webhook
```

**Test 2: Successful Payment Flow**
1. Create an order (status should be `PENDING_ONLINE`)
2. Initiate payment → Redirects to Flouci
3. Complete payment on Flouci
4. Verify:
   - ✅ Order status becomes `PAID`
   - ✅ Tickets generated in database
   - ✅ Email received (with QR codes)
   - ✅ SMS received (order ID + total only, no URLs)

**Test 3: Failed Payment Flow**
1. Create an order
2. Initiate payment → Redirects to Flouci
3. Cancel/fail payment on Flouci
4. Verify:
   - ✅ Order status remains `PENDING_ONLINE`
   - ✅ `payment_status` = `FAILED`
   - ✅ No tickets generated
   - ✅ No email sent
   - ✅ No SMS sent

**Test 4: Pending Payment Flow**
1. Create an order
2. Initiate payment
3. Don't complete on Flouci (or simulate pending state)
4. Verify:
   - ✅ Frontend shows "verifying" status
   - ✅ Order remains `PENDING_ONLINE`
   - ✅ Webhook finalizes later (or manual verification works)
   - ✅ Once verified, tickets + email + SMS sent

**Test 5: Refresh During Payment**
1. Initiate payment
2. Refresh page while on Flouci checkout
3. Verify:
   - ✅ No duplicate payment generated
   - ✅ No duplicate tickets
   - ✅ No duplicate emails/SMS

---

## 🔍 Troubleshooting

### Issue: Webhook URL not being set

**Symptom:** Payment generates but webhook is not called

**Check:**
1. `API_BASE_URL` or `API_URL` is set in Vercel environment variables
2. Value is the full Preview URL (with `https://`)
3. Value does not include trailing slash
4. Value does not include `/api` suffix

**Correct:**
```
API_BASE_URL=https://andiamo-events-git-preview-xxxx.vercel.app
```

**Incorrect:**
```
API_BASE_URL=https://andiamo-events-git-preview-xxxx.vercel.app/
API_BASE_URL=https://andiamo-events-git-preview-xxxx.vercel.app/api
```

---

### Issue: Callback URLs are HTTP instead of HTTPS

**Symptom:** Flouci rejects payment request

**Check:**
1. `VITE_PUBLIC_URL` is set correctly
2. Preview URL auto-detection is working (check console logs)
3. No localhost fallback is being used

**Solution:**
- Set `VITE_PUBLIC_URL` explicitly to your Preview URL

---

### Issue: Webhook returns 404

**Symptom:** Flouci cannot reach webhook endpoint

**Check:**
1. Preview deployment is live
2. `/api/flouci/webhook` endpoint exists in `server.cjs`
3. Vercel rewrites are configured correctly in `vercel.json`

**Verify:**
```bash
curl -X POST https://your-preview-url.vercel.app/api/flouci/webhook \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"test","status":"SUCCESS","developer_tracking_id":"test"}'
```

Should return 200 (even if order not found, endpoint should respond)

---

### Issue: Payment logic broken

**If payment flow doesn't work:**
- ✅ **DO NOT** modify `/api/flouci/generate`
- ✅ **DO NOT** modify `/api/flouci/verify`
- ✅ **DO NOT** modify `/api/flouci/webhook`
- ✅ **DO NOT** modify `generateTicketsAndSendEmail()`

**Check environment variables only:**
- Flouci API keys
- Database connection
- Email/SMS configuration

---

## ✅ Production Readiness Checklist

Before promoting Preview to Production:

- [ ] All manual tests pass
- [ ] Webhook receives Flouci calls
- [ ] Redirects work correctly
- [ ] Verification is authoritative (not redirect-based)
- [ ] No duplicate payments/tickets/emails
- [ ] Email contains QR codes
- [ ] SMS contains only order ID + total (no URLs)
- [ ] Environment variables set for Production scope
- [ ] Production URL updated in environment variables

---

## 🔒 Security Reminder

**Never:**
- ❌ Expose Flouci secret key to frontend
- ❌ Send amounts from frontend
- ❌ Trust redirect status alone
- ❌ Trust webhook payload alone
- ❌ Generate tickets before verified payment
- ❌ Send URLs/QR codes in SMS

**Always:**
- ✅ Verify payment with Flouci API
- ✅ Calculate amounts from database
- ✅ Generate tickets only after `order.status === PAID`
- ✅ Send email before SMS
- ✅ Use HTTPS URLs only

---

## 📝 Notes

- Preview deployments are perfect for testing payment flows
- Environment variables must be set per environment (Preview vs Production)
- Vercel automatically provides HTTPS for all deployments
- Payment logic is frozen - only configuration changes allowed
