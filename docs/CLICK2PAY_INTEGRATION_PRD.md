# Click2Pay (ClicToPay) Payment Gateway Integration — PRD

**Product Requirements Document**  
**Version:** 1.0  
**Date:** February 9, 2025  
**Project:** Andiamo Events — Online Payment Integration  
**Gateway:** ClicToPay (Société Monétique Tunisie / Click2Pay)

---

## 1. Executive Summary

This PRD defines the integration of **ClicToPay (Click2Pay)** as the online payment gateway for Andiamo Events. ClicToPay is operated by Société Monétique Tunisie (SMT) and supports VISA, Mastercard, and CIB cards in TND.

The current state has no active online payment gateway—online orders are created with status `PENDING_ONLINE` and require manual admin confirmation. This integration will enable real-time card payments with automatic order confirmation and ticket delivery upon successful payment.

---

## 2. Current System Analysis

### 2.1 Online Order Flow (As-Is)

| Step | Component | Current Behavior |
|------|-----------|------------------|
| 1 | **PassPurchase.tsx** | User selects passes, payment method `online`, submits form |
| 2 | **orderService.createOrder()** | Calls `POST /api/orders/create` |
| 3 | **api/orders-create.js** | Creates order with `status: PENDING_ONLINE`, `source: platform_online`, `payment_method: online` |
| 4 | **PassPurchase.tsx** | Shows success message: "Your order has been submitted. You will receive payment instructions by email." |
| 5 | **Admin** | Manually marks order as PAID when payment received |
| 6 | **Ticket generation** | Triggered when admin sets status to PAID |

**Relevant Files:**
- `src/pages/PassPurchase.tsx` — Order form, payment method selection, success handling
- `src/lib/orders/orderService.ts` — `createOrder()`, `getOrderById()`, `updateOrderStatus()`
- `api/orders-create.js` — Order creation, stock reservation, initial status logic
- `src/types/orders.ts` — Order types including `payment_gateway_reference`, `payment_response_data`, `payment_status`
- `supabase/migrations/20250201000014-add-online-order-payment-fields.sql` — Payment-related DB columns

### 2.2 Database Schema (Existing)

The `orders` table already has:
- `payment_status` — `PENDING_PAYMENT`, `PAID`, `FAILED`, `REFUNDED`
- `payment_gateway_reference` — Transaction/order ID from gateway
- `payment_response_data` — JSONB for full gateway response
- `transaction_id` — Alternative transaction identifier

### 2.3 Payment Options System

- `payment_options` table: `online`, `external_app`, `ambassador_cash`
- `PaymentOptionSelector` — Renders available methods
- `usePaymentOptions` — Fetches enabled options

---

## 3. Click2Pay API Overview

### 3.1 Credentials & Endpoints

**Test environment**

| Parameter | Value |
|-----------|-------|
| **API Base URL (Test)** | `https://test.clictopay.com/payment/rest/` |
| **Register Endpoint** | `register.do` |
| **Full URL** | `https://test.clictopay.com/payment/rest/register.do` |
| **Portal (Console)** | `https://test.clictopay.com/epg_gui/#login` |
| **API User** | `1480981307` |
| **API Password** | (test password from SMT) |
| **Console User** | `BORN_TO_LEAD_BTL` |

**Production environment**

| Parameter | Value |
|-----------|-------|
| **API Base URL (Prod)** | `https://ipay.clictopay.com/payment/rest` |
| **Full register URL** | `https://ipay.clictopay.com/payment/rest/register.do` |
| **Portal (Console)** | `https://portal.clictopay.com/epg_gui/#login` |
| **API User** | `1480981307` |
| **API Password** | (production password from SMT — set in `.env` only) |
| **Console User** | `BORN_TO_LEAD_BTL` (for portal login only; backend uses API User) |

### 3.2 API Flow (from Manuel Intégration V2.2 & Community Implementations)

1. **Registration (register.do)**  
   - Backend calls `register.do` with amount, order reference, description, return URLs.  
   - Response includes `orderId` and `formUrl` (or equivalent redirect URL).  
   - Customer is redirected to `formUrl` to complete payment.

2. **Customer Payment**  
   - Customer enters card details on ClicToPay hosted page.  
   - Supports VISA, Mastercard, CIB (per SMT production test grid).

3. **Callback / Return**  
   - ClicToPay redirects customer to `returnUrl` with status and `orderId` (or similar).  
   - Some integrations also use a server-to-server callback/webhook.

4. **Verification (if available)**  
   - Optional `getOrderStatus.do` or equivalent to verify payment status before marking order PAID.

### 3.3 Typical Request Parameters (register.do)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userName` | string | Yes | API user ID (e.g. `1480981307`) |
| `password` | string | Yes | API password |
| `amount` | number | Yes | Amount in TND (or millimes—check manual) |
| `orderNumber` | string | Yes | Unique order reference (e.g. order UUID or order_number) |
| `returnUrl` | string | Yes | URL to redirect after payment (success/failure) |
| `failUrl` | string | No | Alternative failure return URL |
| `description` | string | No | Order description |

**Note:** Exact parameter names and formats must be confirmed from **Manuel Intégration V2.2.pdf**. The PDF should specify:
- Parameter names (camelCase vs snake_case)
- Amount unit (TND vs millimes)
- Authentication method (query params vs headers)

### 3.4 Accepted Cards (per SMT Production Test Grid)

- **VISA** (International)
- **Mastercard** (National)
- **CIB** (International)

---

## 4. Integration Architecture

### 4.1 High-Level Flow (To-Be)

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ PassPurchase│────▶│ POST /api/orders │────▶│ Create order    │────▶│ Redirect to  │
│ (Frontend)  │     │ /create          │     │ PENDING_ONLINE  │     │ /payment-    │
└─────────────┘     └──────────────────┘     └─────────────────┘     │ processing   │
                                                                      └──────┬───────┘
                                                                             │
                                                                             ▼
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────┐
│ PaymentSuccess│◀───│ Return from      │◀────│ ClicToPay       │◀────│ Generate     │
│ or Error     │     │ ClicToPay        │     │ hosted page     │     │ payment via  │
└─────────────┘     └──────────────────┘     └─────────────────┘     │ register.do  │
                                                                      └──────────────┘
```

### 4.2 Backend Endpoints to Implement

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/clictopay-generate-payment` | POST | Fetch order, call `register.do`, return redirect URL |
| `/api/clictopay-callback` | GET/POST | Handle ClicToPay return (query params or POST body) |
| `/api/clictopay-verify-payment` | POST | (Optional) Verify payment status before marking PAID |

### 4.3 Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| **PaymentProcessing** | `/payment-processing?orderId=xxx` | Initialize payment, redirect to ClicToPay, handle return |
| **PaymentSuccess** | (Component) | Shown after successful payment |

---

## 5. Technical Requirements

### 5.1 Environment Variables

```env
# ClicToPay / Click2Pay Configuration (set in .env or Vercel; never commit real passwords)
CLICTOPAY_API_USER=your_api_user_from_smt
CLICTOPAY_API_PASSWORD=your_api_password_from_smt
# Test: https://test.clictopay.com/payment/rest
# Prod:  https://ipay.clictopay.com/payment/rest
CLICTOPAY_BASE_URL=https://test.clictopay.com/payment/rest

# Public URL for callbacks (must be HTTPS in production)
VITE_PUBLIC_URL=https://yourdomain.com
```

### 5.2 Backend Logic

1. **Generate Payment**  
   - Validate `orderId`, fetch order from DB.  
   - Ensure order is `PENDING_ONLINE` and not already PAID.  
   - Calculate amount from `order_passes` (authoritative).  
   - Call ClicToPay `register.do`.  
   - Store `orderId` (or equivalent) from response in `payment_gateway_reference`.  
   - Return `formUrl` to frontend for redirect.

2. **Callback**  
   - Parse status from ClicToPay return.  
   - If success: update order to `PAID`, set `payment_status`, trigger ticket generation and email.  
   - If failure: set `payment_status` to `FAILED`, release stock if applicable.  
   - Idempotency: do not process the same `orderId` twice if already PAID.

3. **Amount Handling**  
   - Amount must be computed from DB (`order_passes`), never from client.  
   - Confirm with manual whether amount is in TND or millimes.

### 5.3 Frontend Logic

1. **PassPurchase.tsx**  
   - When `paymentMethod === ONLINE`: after `createOrder()` succeeds, redirect to `/payment-processing?orderId={order.id}` instead of showing "payment instructions" message.

2. **PaymentProcessing.tsx** (to recreate)  
   - On load: fetch order, check if already PAID.  
   - If not PAID: call `/api/clictopay-generate-payment`, get `formUrl`, redirect to ClicToPay.  
   - On return (with `?orderId=...&status=...` or equivalent): call `/api/clictopay-verify-payment` or rely on callback to update order; show success/error.

3. **PaymentSuccess.tsx**  
   - Recreate component used after successful payment.

### 5.4 Security

- API credentials must **never** be exposed to frontend.  
- All ClicToPay calls must be server-side (`server.cjs` or Vercel API routes).  
- Callback URL must validate incoming request (e.g. check `orderId` exists and belongs to merchant).  
- Use HTTPS for all callback URLs in production.

---

## 6. Callback URLs & Testing Strategy

### 6.1 What Link to Use for ClicToPay (returnUrl / failUrl)

ClicToPay needs your site’s URL to redirect customers after payment. The link sent in the API call must be **public, reachable, and HTTPS**.

| Environment | Recommended URL | Notes |
|-------------|-----------------|-------|
| **Production** | `https://andiamoevents.com/payment-processing` | Primary domain. Append `?orderId={orderId}` when redirecting. |
| **Staging / Test** | Same as production, or `https://staging.andiamoevents.com/...` if you have a staging subdomain | ClicToPay test mode can use the same production domain. |
| **Local dev** | Not usable — ClicToPay cannot reach `localhost` | Use a tunnel (ngrok, Cloudflare Tunnel) to get an HTTPS URL, or test on a deployed preview. |

**What to send to SMT / ClicToPay:**
- **returnUrl (success):** `https://andiamoevents.com/payment-processing?orderId={orderId}` (or similar with query params)
- **failUrl (failure):** Same base URL with a status param, e.g. `https://andiamoevents.com/payment-processing?orderId={orderId}&status=failed`

**Important:** Confirm in Manuel Intégration V2.2 whether SMT requires callback URLs to be pre-registered or whitelisted. If yes, send them:

```
Success return: https://andiamoevents.com/payment-processing
Failure return: https://andiamoevents.com/payment-processing
```

(Parameter names and exact format depend on the API.)

### 6.2 Testing Without Affecting Production

**Issue:** If you create a test event on the production site, it will be visible to real users and stored in the production database.

**Options:**

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A. Staging deployment** | Use a separate deployment (e.g. `staging.andiamoevents.com` or Vercel preview) with a test Supabase project | Events and orders stay separate from production | Requires staging env and DB |
| **B. Test on production with fake events** | Create events with names like `[TEST] Event Name` or `[DEV]`, set dates in the past or far future | No extra infra | Test events visible to users; production DB is used |
| **C. Test on production with real events** | Use a low-profile or upcoming real event | Realistic flow | Real users can buy; careful with stock and notifications |
| **D. Vercel preview + same DB** | Deploy to a Vercel preview URL, keep production Supabase | Public HTTPS for ClicToPay; same data as prod | Test events appear in production; use clearly marked test events |

**Recommended approach:**

1. **ClicToPay test mode:** Use `test.clictopay.com` and test credentials — no real money is charged.
2. **URL for testing:** Use your live domain `https://andiamoevents.com` (or a Vercel preview URL) so ClicToPay can reach your callbacks.
3. **Events and data:**
   - If you have **staging + test DB:** Create test events there and test end-to-end on staging.
   - If you only have **production:** Create one or more test events (e.g. name: `[TEST] ClicToPay`, date in the future), run the flow, then hide or delete them when done.
4. **Isolation:** Mark test events clearly (e.g. `[TEST]` in name, or a `is_test` flag if available) and avoid sending SMS/email for them if possible.

### 6.3 Step-by-Step: What to Do

| Step | Action | Notes |
|------|--------|-------|
| 1 | Deploy ClicToPay integration to a publicly reachable URL (e.g. Vercel preview or production) | ClicToPay must be able to call your return URL |
| 2 | Set `VITE_PUBLIC_URL` (or equivalent) to that URL | e.g. `https://andiamoevents.com` or `https://xxx.vercel.app` |
| 3 | Ensure ClicToPay uses TEST credentials and `test.clictopay.com` | No real charges |
| 4 | Create a test event (staging or prod) | Use `[TEST]` in name if on production |
| 5 | Place a test order with online payment | Use SMT test cards if provided |
| 6 | Complete payment on ClicToPay test page | Customer is redirected back to your return URL |
| 7 | Verify: order marked PAID, tickets generated, no real charge | |
| 8 | When satisfied: obtain production credentials from SMT, switch env, re-run SMT test grid | |

### 6.4 What to Send to SMT for Configuration

If SMT/ClicToPay needs to whitelist or configure your URLs, provide:

| Item | Value |
|------|-------|
| **Merchant site URL** | `https://andiamoevents.com` |
| **Success callback / return URL** | `https://andiamoevents.com/payment-processing` |
| **Failure callback / return URL** | `https://andiamoevents.com/payment-processing` |
| **Contact** | Your technical contact for integration |

(Exact terminology and format depend on SMT’s process and the Manuel Intégration.)

---

## 7. Database Considerations

- **No schema changes required** — existing `payment_gateway_reference`, `payment_response_data`, `payment_status` are sufficient.
- Optional: add `payment_created_at` if needed for idempotency or retries.

---

## 8. Production Passage Tests (SMT Requirements)

Per the Société Monétique Tunisie "Tests de passage en production" grid:

| Test N° | Description | Expected Result |
|---------|-------------|-----------------|
| 0001, 0002 | Transaction autorisée | Autorisée |
| 0004 | Plafond atteint | Non Autorisée |
| 0005 | Solde insuffisant | Non Autorisée |
| 0007 | Carte non valide | Non Autorisée |
| 0008 | Validité incorrecte | Non Autorisée |
| 0009 | CVV2 incorrecte | Non Autorisée |

**Cards to test:**
- VISA
- Mastercard (National)
- CIB (International)

**Process:**
1. Execute tests in order.  
2. Fill N° Autorisation for successful transactions.  
3. Sign and send grid by email and fax 71 82 28 88.  
4. Production go-live only after SMT validation and bank approval.

---

## 9. Implementation Phases

### Phase 1: Backend (1–2 days)
- [ ] Add ClicToPay env variables to `env.example` and `.env`
- [ ] Implement `POST /api/clictopay-generate-payment` in `server.cjs` (or `api/` for Vercel)
- [ ] Implement callback handler (GET/POST as per manual)
- [ ] Confirm parameter names and amount unit from PDF

### Phase 2: Frontend (1–2 days)
- [ ] Recreate `PaymentProcessing.tsx` with ClicToPay flow
- [ ] Recreate `PaymentSuccess.tsx` component
- [ ] Update `PassPurchase.tsx` to redirect to `/payment-processing` for online
- [ ] Add route in `App.tsx`
- [ ] Update success message for online flow

### Phase 3: Testing & Docs (1 day)
- [ ] End-to-end test with test credentials
- [ ] Update `Terms.tsx` / legal text for ClicToPay
- [ ] Update CSP in `vercel.json` to allow `*.clictopay.com` if needed
- [ ] Document production URL and credentials handover

### Phase 4: Production Passage
- [ ] Complete SMT test grid with provided test cards
- [ ] Obtain production credentials and URL from SMT
- [ ] Switch env to production
- [ ] Final validation with SMT and bank

---

## 10. API Reference Checklist (from Manuel Intégration V2.2)

**To be extracted from PDF by implementer:**

- [ ] Exact `register.do` request parameters and format
- [ ] Response structure (orderId, formUrl / redirect URL)
- [ ] **Status verification:** `getOrderStatusExtended.do` or `getOrderStatus.do` — parameters (e.g. userName, password, orderId), response field for success (orderStatus = 2)
- [ ] Callback parameters and format (query vs POST)
- [ ] Success/failure status values
- [ ] Amount unit (TND vs millimes)
- [ ] Error codes and handling
- [ ] Webhook vs redirect-only model

**Security (implemented):** The confirm flow does **not** trust the frontend. Only `orderId` is accepted. The backend calls ClicToPay's status API (`getOrderStatusExtended.do` with fallback to `getOrderStatus.do`) and marks the order PAID only when the gateway returns orderStatus = 2. Confirm with Manuel Intégration V2.2 for the exact endpoint name and response shape.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PDF not fully machine-readable | Manual extraction of API spec; validate against PHP/WordPress implementations |
| Callback not received | Implement polling/verification endpoint as fallback |
| Amount mismatch | Always compute amount from `order_passes` in backend |
| Double-charge | Idempotency checks on callback; do not process if order already PAID |

---

## 12. Appendix

### A. Credentials (reference only — use env vars, never commit real passwords)
```
Test:
  URL:     https://test.clictopay.com/payment/rest/register.do
  Portal:  https://test.clictopay.com/epg_gui/#login
  API user / password: from SMT (set CLICTOPAY_API_USER, CLICTOPAY_API_PASSWORD)
  Console: separate login for portal (not used by backend)

Prod:
  URL:     https://ipay.clictopay.com/payment/rest/register.do
  Portal:  https://portal.clictopay.com/epg_gui/#login
  API user / password: from SMT (set in .env / Vercel only)
```

### B. Files to Create/Modify
- **Create:** `src/pages/PaymentProcessing.tsx`, `src/components/payment/PaymentSuccess.tsx`
- **Create:** Backend handlers for ClicToPay
- **Modify:** `PassPurchase.tsx`, `App.tsx`, `env.example`, `vercel.json`, `Terms.tsx`

### C. Reference Documentation
- **Manuel Intégration V2.2.pdf** — Primary source for API spec
- GitHub: ClicToPay Tunisia implementations (PHP, WordPress, PrestaShop)
- SMT Production Test Grid — Required before go-live
