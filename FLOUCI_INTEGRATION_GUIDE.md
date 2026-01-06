# Flouci Payment API Integration Guide

## ✅ Integration Complete

The Flouci Payment API has been successfully integrated into your Andiamo Events platform. This guide explains what was implemented and how to configure it.

## 📋 What Was Implemented

### 1. **Flouci Payment Service** (`src/lib/flouci/paymentService.ts`)
   - `generateFlouciPayment()` - Creates a payment request with Flouci
   - `verifyFlouciPayment()` - Verifies payment status
   - Helper functions for TND to millimes conversion

### 2. **Payment Processing Page** (`src/pages/PaymentProcessing.tsx`)
   - Handles the complete payment flow
   - Generates Flouci payment when order is created
   - Redirects user to Flouci payment page
   - Verifies payment on return from Flouci
   - Updates order status automatically

### 3. **Webhook Endpoint** (`server.cjs` - `/api/flouci-webhook`)
   - Server-to-server payment confirmation
   - Verifies payment authenticity with Flouci API
   - Updates order status automatically
   - Handles SUCCESS, FAILURE, and EXPIRED statuses

### 4. **Environment Variables**
   - Added Flouci API keys to `env.example`
   - Both frontend (VITE_) and backend keys needed

## 🔧 Configuration Steps

### Step 1: Get Flouci API Keys

1. Log in to your Flouci merchant account
2. Navigate to API settings
3. Get your **Public Key** and **Secret Key**

### Step 2: Add Environment Variables

Add these to your `.env` file (backend only - secret key is never exposed to frontend):

```env
# Flouci Payment API Configuration (Backend only - secret key never exposed to frontend)
FLOUCI_PUBLIC_KEY=your_flouci_public_key_here
FLOUCI_SECRET_KEY=your_flouci_secret_key_here
```

**Important:**
- Only backend keys are needed (server.cjs)
- Secret key is never sent to frontend - all API calls go through backend endpoints
- This ensures security and prevents key exposure

### Step 3: Configure Webhook URL

In your Flouci merchant dashboard:
1. Go to Webhook settings
2. Set webhook URL to: `https://your-domain.com/api/flouci-webhook`
   - For local development: `http://localhost:8081/api/flouci-webhook`
   - For production: `https://your-production-domain.com/api/flouci-webhook`

### Step 4: Enable Online Payment Option

Make sure the "Online Payment" option is enabled in your database:

```sql
UPDATE public.payment_options 
SET enabled = true, updated_at = NOW()
WHERE option_type = 'online';
```

Or use the Admin Dashboard to enable it.

## 🔄 Payment Flow

1. **Customer selects "Online Payment"** in PassPurchase page
2. **Order is created** with status `PENDING_ONLINE`
3. **User is redirected** to `/payment-processing?orderId={orderId}`
4. **Payment Processing page:**
   - Fetches order details
   - Calls backend API to generate Flouci payment (keeps secret key secure)
   - Backend stores `payment_id` in order
   - Redirects user to Flouci payment page
5. **User completes payment** on Flouci
6. **Flouci redirects back** to `/payment-processing?orderId={orderId}&status=success`
7. **Payment Processing page verifies** payment via backend API (keeps secret key secure)
8. **Order status updated** to `PAID` if successful
9. **Webhook also called** (server-to-server) for reliability

## 📊 Order Status Flow

- **Initial**: `PENDING_ONLINE` (when order created)
- **After Payment**: `PAID` (if successful) or remains `PENDING_ONLINE` (if failed)
- **Payment Gateway Reference**: Stored in `payment_gateway_reference` column
- **Payment Response**: Stored in `payment_response_data` (JSONB)

## 🔍 Testing

### Test Payment Flow

1. Create a test order with online payment
2. You'll be redirected to Flouci payment page
3. Use Flouci test credentials to complete payment
4. Check order status in admin dashboard
5. Verify webhook is called (check server logs)

### Test Webhook Locally

For local testing, you can use a tool like:
- **ngrok**: `ngrok http 8081` to expose your local server
- Set webhook URL in Flouci to: `https://your-ngrok-url.ngrok.io/api/flouci-webhook`

## 🛠️ Troubleshooting

### Payment Not Redirecting
- Check if Flouci API keys are set correctly in backend `.env`
- Check browser console for errors
- Check backend server logs for API errors
- Verify order was created successfully

### Webhook Not Working
- Check server logs for webhook requests
- Verify webhook URL is accessible from internet
- Check Flouci dashboard for webhook delivery status
- Ensure `FLOUCI_PUBLIC_KEY` and `FLOUCI_SECRET_KEY` are set in backend

### Payment Verification Fails
- Check backend API keys are correct in `.env`
- Verify payment_id is valid
- Check backend server logs for API errors
- Check Flouci API status

## 📝 Important Notes

1. **Amount Conversion**: Flouci uses millimes (1 TND = 1000 millimes). The service automatically converts.

2. **Webhook Reliability**: The webhook provides server-to-server confirmation, but the frontend also verifies on return for immediate user feedback.

3. **Payment Timeout**: Default session timeout is 30 minutes (1800 seconds). You can adjust in `PaymentProcessing.tsx`.

4. **Security**: Secret key is never exposed to frontend. All Flouci API calls go through backend endpoints (`/api/flouci-generate-payment` and `/api/flouci-verify-payment`).

5. **Order Updates**: Both webhook and frontend verification update the order. The webhook is the source of truth for reliability.

## 🚀 Next Steps

1. Add your Flouci API keys to environment variables
2. Configure webhook URL in Flouci dashboard
3. Enable online payment option in database
4. Test with a small amount
5. Monitor webhook logs for any issues

## 📚 Flouci API Documentation

For more details, refer to the Flouci Payment API documentation:
- Generate Payment: https://docs.flouci.com/api-reference/generate-transaction
- Verify Payment: https://docs.flouci.com/api-reference/verify-transaction
- Webhooks: See Flouci dashboard for webhook configuration

---

**Integration completed successfully!** 🎉

