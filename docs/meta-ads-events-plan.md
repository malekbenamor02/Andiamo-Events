## Meta Ads Events Plan – Andiamo Events

This document describes Meta measurement for pass sales: one confirmed **`Purchase`** conversion with customer data, attribution, and server-side Conversions API (CAPI).

---

### 1. Conversion event

| Event | When it fires |
|-------|----------------|
| **`Purchase`** (standard) | **Online:** ClicToPay confirms `PAID`. **Ambassador cash:** order created (`PENDING_CASH`). |

**Also sent (unchanged):**

| Event | When |
|-------|------|
| `PageView` | SPA route change |
| `Lead` | Ambassador application submitted |
| `AmbassadorApplicationVisit` / `AmbassadorApplicationSubmitSuccess` | Ambassador apply funnel (custom) |

Pass-purchase funnel events (`PassPurchaseVisit`, `PassSelect`, `InitiateCheckout`, `OrderSubmitOnline`, `OrderSubmitAmbassador`, `ViewContent`) are **removed**.

---

### 2. Architecture

- **Browser Pixel:** `src/lib/meta/` — `trackConfirmedPurchase()` with advanced matching (email, phone, name, city) and commerce params.
- **Conversions API:** `api/_lib/meta/conversions-api.cjs` — primary for online paid orders; deduplicated with browser via shared `event_id`.
- **Attribution storage:** `orders.meta_attribution` JSON at order create (`eventId`, `fbp`, `fbc`, `eventSourceUrl`, `clientUserAgent`, `clientIp`).
- **Idempotency:** `orders.meta_purchase_sent_at` prevents duplicate CAPI sends.

---

### 3. Purchase payload

**User data (hashed on server, plain for Pixel advanced matching):**

- Email, phone, first/last name (from full name), city, country `tn`

**Attribution:**

- `event_id`, `fbp`, `fbc`, `event_source_url`, `client_ip_address`, `client_user_agent`, `action_source: website`

**Commerce:**

- `value`, `currency: TND`, `content_ids`, `content_type: product`, `content_name`, `num_items`, `order_id`, `contents[]`, `payment_method`

---

### 4. Environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_META_PIXEL_ID` | Browser Pixel ID |
| `META_PIXEL_ID` | Server pixel ID (same value) |
| `META_CAPI_ACCESS_TOKEN` | Conversions API access token |
| `META_CAPI_TEST_EVENT_CODE` | Optional — Events Manager Test Events |

If CAPI env vars are missing, browser Pixel still works; server send is skipped with a warning.

---

### 5. Ads Manager setup

1. Optimize campaigns for standard **`Purchase`** with value (TND).
2. Do **not** create custom conversions for removed funnel events.
3. Use **Test Events** to verify one deduplicated `Purchase` per order.
4. Check **Event match quality** in Diagnostics after live traffic.

---

### 6. Code map

| Area | Files |
|------|-------|
| Client | `src/lib/meta/*`, `PassPurchase.tsx`, `PaymentProcessing.tsx` |
| Server | `api/_lib/meta/*`, `api/orders-create.js`, `api/misc.js` (ClicToPay confirm) |
| DB | `supabase/migrations/20260610120000_orders_meta_attribution.sql` |
