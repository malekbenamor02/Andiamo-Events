# ClickToPay / ClicToPay Integration Guide

This document explains how to integrate **ClickToPay / ClicToPay (SMT)** into another project using the flow already implemented in this repository as a reference.

It is written as a **practical implementation guide**, not as a product spec. You can follow it step by step in a new app.

## 1. What This Integration Does

The integration uses the standard hosted-payment-page flow:

1. Your frontend creates or selects an order in your system.
2. Your backend calls ClicToPay `register.do`.
3. ClicToPay returns a hosted payment URL (`formUrl`).
4. The customer is redirected to that hosted page.
5. After payment, ClicToPay redirects the customer back to your app.
6. Your backend verifies payment status using `getOrderStatusExtended.do` or `getOrderStatus.do`.
7. If the payment is confirmed, your system marks the order as paid and triggers the post-payment actions.

## 2. Important Rules

- Never call ClicToPay directly from the frontend.
- Never expose ClicToPay credentials in browser code.
- Never trust the amount sent by the frontend.
- Always calculate the payable amount on the backend from your database or trusted server-side order state.
- Always verify the payment with the gateway before marking an order as paid.
- Use HTTPS for return URLs in production.

## 3. Required Credentials And URLs

You need the following from SMT / ClicToPay:

- API username
- API password
- test gateway access
- production gateway access
- test cards / production passage test grid
- confirmation on whether your return URLs must be whitelisted

### Test environment

- Base URL: `https://test.clictopay.com/payment/rest`
- Portal: `https://test.clictopay.com/epg_gui/#login`

### Production environment

- Base URL: `https://ipay.clictopay.com/payment/rest`
- Portal: `https://portal.clictopay.com/epg_gui/#login`

## 4. Environment Variables

Add these variables to the new project:

```env
# ClicToPay credentials
CLICTOPAY_API_USER=your_api_user
CLICTOPAY_API_PASSWORD=your_api_password

# Test:
# https://test.clictopay.com/payment/rest
# Production:
# https://ipay.clictopay.com/payment/rest
CLICTOPAY_BASE_URL=https://test.clictopay.com/payment/rest

# Public frontend URL used to build return URLs
PUBLIC_APP_URL=https://yourdomain.com
```

Notes:

- In local development, ClicToPay cannot redirect to `localhost`.
- For local testing, use a public HTTPS tunnel or deploy a preview build.
- In production, set `CLICTOPAY_BASE_URL` explicitly so you never accidentally hit the test gateway.

## 5. Minimum Data Model

Your order table should contain at least:

- `id`
- `status`
- `total_amount`
- `payment_status`
- `payment_gateway_reference`
- `payment_response_data`
- `created_at`
- `updated_at`

Recommended values:

- order status before payment: `PENDING_ONLINE`
- payment status before payment: `PENDING_PAYMENT`
- order status after success: `PAID`
- payment status after success: `PAID`
- payment status after failure: `FAILED`

`payment_gateway_reference` should store the ClicToPay `orderId` returned by `register.do`.

## 6. End-To-End Flow

### Step 1: Create the order in your system

Before redirecting to ClicToPay, create an order in your own database first.

At this stage:

- reserve stock if your business flow needs it
- save customer info
- set order status to something like `PENDING_ONLINE`
- compute the final amount server-side

Do not send users to ClicToPay before you have a persistent order in your DB.

### Step 2: Build a backend endpoint to generate the payment

Create a backend endpoint such as:

- `POST /api/clictopay-generate-payment`

Input:

```json
{
  "orderId": "your-local-order-id"
}
```

Responsibilities of this endpoint:

1. Validate `orderId`.
2. Load the order from your database.
3. Reject if the order is missing, already paid, canceled, or not eligible for online payment.
4. Recompute or confirm the authoritative amount from your DB.
5. Build the success and failure return URLs.
6. Call ClicToPay `register.do`.
7. Save the returned gateway order reference.
8. Return the `formUrl` to the frontend.

### Step 3: Call `register.do`

The implementation in this repository uses:

```txt
POST {CLICTOPAY_BASE_URL}/register.do
Content-Type: application/x-www-form-urlencoded
```

Request parameters:

- `userName`
- `password`
- `amount`
- `orderNumber`
- `returnUrl`
- `failUrl`
- `description`

Example payload:

```txt
userName=YOUR_API_USER
password=YOUR_API_PASSWORD
amount=12500
orderNumber=ORDER12345
returnUrl=https://yourdomain.com/payment-processing?orderId=LOCAL_ORDER_ID&return=1
failUrl=https://yourdomain.com/payment-processing?orderId=LOCAL_ORDER_ID&return=1&status=failed
description=Order ORDER12345
```

### Amount format

In this repository, the amount sent to ClicToPay is:

```txt
Math.round(amountInTND * 1000)
```

That means the code assumes ClicToPay expects the amount in **millimes**.

Example:

- `12.500 TND` becomes `12500`
- `47.000 TND` becomes `47000`

You should still confirm this with the official SMT manual for your merchant setup.

### `orderNumber` format

Use a stable merchant-side reference.

The reference implementation uses:

- your local `order_number` if available
- otherwise a sanitized order id without hyphens

Keep it short, unique, and alphanumeric if possible.

### Expected response

You usually want:

- `orderId` from ClicToPay
- `formUrl` from ClicToPay

After success:

- store `orderId` in `payment_gateway_reference`
- return `formUrl` to the frontend

## 7. Example Backend Logic

Below is the structure you should implement in any Node backend:

```ts
app.post('/api/clictopay-generate-payment', async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: 'orderId is required' });
  }

  const order = await getOrderFromDatabase(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.status === 'PAID') {
    return res.status(400).json({ error: 'Order already paid' });
  }

  if (order.status !== 'PENDING_ONLINE') {
    return res.status(400).json({ error: 'Order is not ready for payment' });
  }

  const amountInTND = computeTrustedOrderAmount(order);
  const amountForGateway = String(Math.round(amountInTND * 1000));

  const returnUrl = `${process.env.PUBLIC_APP_URL}/payment-processing?orderId=${order.id}&return=1`;
  const failUrl = `${process.env.PUBLIC_APP_URL}/payment-processing?orderId=${order.id}&return=1&status=failed`;

  const payload = new URLSearchParams({
    userName: process.env.CLICTOPAY_API_USER!,
    password: process.env.CLICTOPAY_API_PASSWORD!,
    amount: amountForGateway,
    orderNumber: order.orderNumber,
    returnUrl,
    failUrl,
    description: `Order ${order.orderNumber}`,
  });

  const response = await fetch(
    `${process.env.CLICTOPAY_BASE_URL}/register.do`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    }
  );

  const data = await response.json();

  if (!data.formUrl) {
    return res.status(500).json({ error: 'Failed to generate payment', details: data });
  }

  await saveGatewayReference(order.id, data.orderId);

  return res.json({
    success: true,
    formUrl: data.formUrl,
    orderId: order.id,
  });
});
```

## 8. Frontend Flow

Create a dedicated payment-processing page in the new project, for example:

- `/payment-processing`

This page should support two modes:

1. **Init mode**
2. **Return mode**

### Init mode

This is the page state right after your checkout creates the order.

Example URL:

```txt
/payment-processing?orderId=LOCAL_ORDER_ID&init=1
```

Behavior:

1. Read `orderId`.
2. Call `POST /api/clictopay-generate-payment`.
3. Receive `formUrl`.
4. Redirect the browser to `formUrl`.

### Return mode

This is the state after the customer comes back from ClicToPay.

Example URL:

```txt
/payment-processing?orderId=LOCAL_ORDER_ID&return=1
```

Behavior:

1. Read `orderId`.
2. Call your backend confirm endpoint.
3. Let the backend verify the payment status with ClicToPay.
4. Show success or failure based only on the backend response.

Important:

- Do not trust `status=success` or any query param coming from the browser URL.
- The frontend should display the result.
- The backend should decide the truth.

## 9. Confirm Payment Endpoint

Create a backend endpoint such as:

- `POST /api/clictopay-confirm-payment`

Input:

```json
{
  "orderId": "your-local-order-id"
}
```

Responsibilities:

1. Load the local order.
2. Check that it has a stored `payment_gateway_reference`.
3. Call ClicToPay status API with that gateway order id.
4. Decide whether the payment is truly successful.
5. Update your order and payment status.
6. Trigger ticket generation, email sending, stock finalization, or any other post-payment action.
7. Make the endpoint idempotent.

## 10. How To Verify Payment

The reference project verifies payment with:

- `getOrderStatusExtended.do`
- fallback to `getOrderStatus.do`

Request:

```txt
POST {CLICTOPAY_BASE_URL}/getOrderStatusExtended.do
Content-Type: application/x-www-form-urlencoded
```

Parameters:

- `userName`
- `password`
- `orderId`

Example:

```txt
userName=YOUR_API_USER
password=YOUR_API_PASSWORD
orderId=GATEWAY_ORDER_ID
```

### Success rule used in this project

This repository treats the payment as successful only when the gateway response indicates a successful status, especially:

- `orderStatus === 2`
- and no rejecting error code

That is the safest rule to keep in the new project too.

You should also log and persist a sanitized version of the response for audit purposes.

## 11. Example Confirm Logic

```ts
app.post('/api/clictopay-confirm-payment', async (req, res) => {
  const { orderId } = req.body;
  const order = await getOrderFromDatabase(orderId);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.status === 'PAID') {
    return res.json({ success: true, alreadyPaid: true, status: 'PAID', orderId });
  }

  if (!order.payment_gateway_reference) {
    return res.status(400).json({ error: 'No gateway reference stored for this order' });
  }

  const payload = new URLSearchParams({
    userName: process.env.CLICTOPAY_API_USER!,
    password: process.env.CLICTOPAY_API_PASSWORD!,
    orderId: order.payment_gateway_reference,
  });

  let statusData: any;

  const extendedRes = await fetch(
    `${process.env.CLICTOPAY_BASE_URL}/getOrderStatusExtended.do`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    }
  );

  statusData = await extendedRes.json();

  const orderStatus = Number(statusData.orderStatus);
  const errorCode = String(statusData.errorCode ?? '0');
  const success = orderStatus === 2 && errorCode === '0';

  await saveSanitizedGatewayResponse(order.id, statusData);

  if (!success) {
    await markOrderAsFailed(order.id);
    return res.json({
      success: false,
      status: 'FAILED',
      orderId,
      message: statusData.errorMessage || 'Payment not confirmed',
    });
  }

  await markOrderAsPaid(order.id);
  await triggerPostPaymentActions(order.id);

  return res.json({
    success: true,
    status: 'PAID',
    orderId,
  });
});
```

## 12. Idempotency Requirements

This is extremely important.

Your confirm endpoint may be called:

- multiple times by the frontend
- after page refreshes
- after retries
- after temporary gateway/network failures

So your logic must be safe if repeated:

- if the order is already paid, return success without reprocessing
- do not generate tickets twice
- do not send duplicate emails or SMS
- do not decrement stock twice

## 13. What To Store From Gateway Responses

Do not store sensitive cardholder data.

Store only safe fields such as:

- `orderNumber`
- `orderStatus`
- `errorCode`
- `errorMessage`
- `amount`
- `currency`
- `actionCode`
- `actionCodeDescription`
- `paymentWay`
- `date`
- `authDateTime`
- `feeAmount`
- `orderDescription`

If the gateway sends nested objects, keep only the fields required for debugging and audit.

## 14. Recommended Frontend UX

On the payment page, show 4 possible states:

- loading
- redirecting
- success
- failed

Recommended behavior:

- while generating payment: show a loader
- while redirecting: show "Redirecting to payment..."
- on success: show confirmation and next action
- on failure: allow retry or return to checkout

Do not show success immediately after redirect. Only show success after backend confirmation.

## 15. Return URL Strategy

Recommended return URLs:

- success: `https://yourdomain.com/payment-processing?orderId=LOCAL_ORDER_ID&return=1`
- failure: `https://yourdomain.com/payment-processing?orderId=LOCAL_ORDER_ID&return=1&status=failed`

Even for the failure URL, still confirm with the backend, because query params are not authoritative.

## 16. Local Development And Testing

### Localhost limitation

ClicToPay cannot redirect to plain `localhost` in real integration scenarios.

Use one of these options:

- deploy to a preview environment
- use a secure public tunnel
- use a staging domain

### Safe testing setup

Recommended:

1. Use test credentials.
2. Use `https://test.clictopay.com/payment/rest`.
3. Use a non-production database if possible.
4. Create clearly labeled test orders or test events.
5. Verify that no real charges are made.

## 17. Production Passage Checklist

Before go-live:

1. Confirm the exact amount unit expected by your merchant contract.
2. Confirm whether return URLs must be whitelisted by SMT.
3. Test successful transactions.
4. Test declined transactions.
5. Test incorrect CVV, invalid date, insufficient balance, and limit scenarios if SMT provides them.
6. Verify that the order is marked paid only after backend confirmation.
7. Verify that tickets/emails/SMS are sent only once.
8. Switch `CLICTOPAY_BASE_URL` to production.
9. Replace test credentials with production credentials.
10. Re-run SMT passage tests before final activation.

## 18. Common Mistakes To Avoid

- Sending the amount from the frontend without server validation
- Marking the order as paid immediately after the browser returns
- Using the ClicToPay redirect alone as proof of payment
- Forgetting to store the gateway `orderId`
- Using `localhost` as the return URL
- Saving full raw payment payloads that may contain unnecessary sensitive data
- Failing to make the confirm endpoint idempotent
- Accidentally using test gateway URLs in production

## 19. Suggested File Structure For A New Project

Example:

```txt
src/
  pages/
    PaymentProcessing.tsx
server/
  routes/
    clictopay-generate-payment.ts
    clictopay-confirm-payment.ts
lib/
  payments/
    clictopay.ts
```

Recommended responsibilities:

- `PaymentProcessing.tsx`: UI and redirect/confirm orchestration
- `clictopay-generate-payment.ts`: register payment
- `clictopay-confirm-payment.ts`: verify and finalize payment
- `clictopay.ts`: shared gateway helper functions

## 20. Copy/Paste Integration Checklist

Use this checklist when porting the integration into another project:

- Add environment variables.
- Create order statuses and payment statuses.
- Add DB fields for gateway reference and payment response.
- Implement `POST /api/clictopay-generate-payment`.
- Implement `POST /api/clictopay-confirm-payment`.
- Build `/payment-processing` frontend page.
- Redirect checkout to `/payment-processing?orderId=...&init=1`.
- On return, call the confirm endpoint.
- Mark order as paid only after successful gateway verification.
- Trigger post-payment business logic.
- Test in sandbox.
- Switch to production only after full validation.

## 21. Final Recommendation

If you want the cleanest version in another project, keep the integration split into only **two backend endpoints** and **one frontend page**:

- `POST /api/clictopay-generate-payment`
- `POST /api/clictopay-confirm-payment`
- `/payment-processing`

That is the simplest stable architecture and matches the working flow already used in this repository.
