## Meta Ads Events Plan – Andiamo Events

This document describes how to mirror our Google Analytics 4 events into Meta Pixel events, so we can use them in Meta Ads for conversion optimization, remarketing, and lookalikes.

The goal is: **same business meaning, same funnel, same parameters** across GA4 and Meta.

---

### 1. Overview of Core Events

We already send the following events to GA4:

- **`pass_purchase_visit`**: user visits the pass purchase flow.
- **`pass_select`**: user selects (adds) at least one pass.
- **`order_submit_online`**: order created with online payment.
- **`order_submit_ambassador`**: order created with ambassador cash payment.

For Meta, we will mirror them as Pixel events:

- **Meta event `PassPurchaseVisit`** ⇔ GA4 `pass_purchase_visit`
- **Meta event `PassSelect`** ⇔ GA4 `pass_select`
- **Meta event `OrderSubmitOnline`** ⇔ GA4 `order_submit_online`
- **Meta event `OrderSubmitAmbassador`** ⇔ GA4 `order_submit_ambassador`

We keep **names in PascalCase for Meta** and **snake_case for GA4**, but business meaning and parameters stay aligned.

---

### 2. Meta Pixel Integration – High-Level

Later, we will:

1. **Add Meta Pixel base code** to the app (likely via a `meta.ts` helper, similar to `ga.ts` and `clarity.ts`):
   - Read `VITE_META_PIXEL_ID` from env.
   - Initialize `fbq('init', PIXEL_ID)` once.
   - Provide helper: `trackMetaEvent(name: string, params?: Record<string, any>)`.

2. **Call `trackMetaEvent` in the same places** where we already call `trackEvent` (GA4 helper) in:
   - `PassPurchase.tsx` (visit, pass selection, order submit events).

3. **Avoid double-firing**:
   - All business events will be fired through a single abstraction per place in the code, which calls both GA and Meta helpers to keep them synchronized.

---

### 3. Event Definitions for Meta

Below are the four core events, with:

- **Where they fire** (in the app).
- **Meta event name**.
- **Key parameters** (Meta Pixel `fbq('trackCustom', ...)`).
- **How to use them in Meta Ads**.

#### 3.1 `PassPurchaseVisit`

- **When (frontend):**
  - In `PassPurchase.tsx`, once the event is loaded and pass purchase is allowed (not past/completed).
  - Same condition as GA4 `pass_purchase_visit`.

- **Meta event name:**
  - `PassPurchaseVisit` (custom event).

- **Parameters (example):**
  - `event_id` – internal event ID from DB.
  - `event_name` – event name (e.g. "New Year Party").
  - `language` – 'en' or 'fr'.
  - `page_path` – URL path (e.g. `/party-2025` or `/pass-purchase?eventId=123`).

- **Usage in Meta:**
  - **Custom Audience**: people who visited purchase page (intent) but did not buy.
  - **Exclusions**: exclude `OrderSubmitOnline` / `OrderSubmitAmbassador` from this audience to build an "abandoned purchase flow" segment.

#### 3.2 `PassSelect`

- **When (frontend):**
  - In `PassPurchase.tsx` `updatePassQuantity` handler.
  - Fired **once per pass** when quantity goes from `0` to `>0` (first time user selects that pass).

- **Meta event name:**
  - `PassSelect` (custom event).

- **Parameters (example):**
  - `event_id`
  - `event_name`
  - `pass_id`
  - `pass_name`
  - `quantity` – current quantity after selection.
  - `price` – unit price for this pass.
  - `language`

- **Usage in Meta:**
  - **Custom Audience**: people who actually selected a pass – stronger intent than just viewing the page.
  - **Lookalike source**: create a lookalike based on users who reached `PassSelect` (early funnel).
  - **Funnel analysis (Meta side)**: see which campaigns send users that select passes, not just click links.

#### 3.3 `OrderSubmitOnline`

- **When (frontend):**
  - In `PassPurchase.tsx`, inside `handleSubmit`, **after** `createOrder` succeeds and `paymentMethod === PaymentMethod.ONLINE`, before navigating to `/payment-processing`.
  - Represents a successfully created order where the customer chose online payment.

- **Meta event name:**
  - `OrderSubmitOnline` (custom event)  
  - Optionally also map it to standard Meta `Purchase` with `fbq('track', 'Purchase', ...)` for maximum optimization.

- **Parameters (example):**
  - `order_id` – internal order ID.
  - `event_id`
  - `event_name`
  - `value` – total price (TND).
  - `currency` – `'TND'`.
  - `payment_method` – `'online'`.
  - `total_quantity` – total number of passes.
  - `language`
  - `items` – array of:
    - `item_id` – pass ID.
    - `item_name` – pass name.
    - `quantity`
    - `price`

- **Usage in Meta:**
  - **Main conversion for online sales**:
    - In Events Manager: define a **Custom Conversion** based on `OrderSubmitOnline`.
    - Use it in campaigns (Optimize for: **Purchases / Custom conversion**).
  - **Value optimization**:
    - Use `value` + `currency` to let Meta optimize for higher-value orders.
  - **Lookalike audiences**:
    - Create lookalikes from people who triggered `OrderSubmitOnline` (high-intent, card-ready audience).

#### 3.4 `OrderSubmitAmbassador`

- **When (frontend):**
  - In `PassPurchase.tsx`, inside `handleSubmit`, **after** `createOrder` succeeds and `paymentMethod === PaymentMethod.AMBASSADOR_CASH`, before showing the success screen.
  - Represents orders assigned to ambassadors (cash payment).

- **Meta event name:**
  - `OrderSubmitAmbassador` (custom event).

- **Parameters (example):**
  - `order_id`
  - `event_id`
  - `event_name`
  - `value` – total price (TND).
  - `currency` – `'TND'`.
  - `payment_method` – `'ambassador_cash'`.
  - `total_quantity`
  - `language`
  - `ambassador_id` – selected ambassador (if available).
  - `items` – same structure as for `OrderSubmitOnline`.

- **Usage in Meta:**
  - **Separate conversion for ambassador-driven sales**:
    - Custom Conversion: `OrderSubmitAmbassador`.
    - Use this in campaigns focused on ambassador / community marketing.
  - **Ambassador performance insights (ad level)**:
    - Compare campaigns that drive more `OrderSubmitAmbassador` vs `OrderSubmitOnline`.
  - **Lookalike audiences**:
    - Create lookalikes from `OrderSubmitAmbassador` for campaigns focused on people likely to use ambassadors.

---

### 4. Meta Custom Conversions Setup (Later)

When we implement the Pixel events, the next steps in **Meta Events Manager** will be:

1. **Verify events are received:**
   - Use the **Test Events** tab and open the site.
   - Confirm `PassPurchaseVisit`, `PassSelect`, `OrderSubmitOnline`, `OrderSubmitAmbassador` appear.

2. **Create custom conversions:**
   - **Conversion 1 – Online Orders**
     - Data source: your Pixel.
     - Event: `OrderSubmitOnline`.
     - Value: use `value` (TND).
   - **Conversion 2 – Ambassador Orders**
     - Data source: your Pixel.
     - Event: `OrderSubmitAmbassador`.
     - Value: use `value` (TND).

3. **Map to campaign goals:**
   - For campaigns targeting online sales → use **Online Orders** conversion.
   - For campaigns targeting ambassador sales → use **Ambassador Orders** conversion.

4. **Build audiences:**
   - **Abandoned purchase flow**:
     - Include: `PassPurchaseVisit` (or `PassSelect`).
     - Exclude: `OrderSubmitOnline` AND `OrderSubmitAmbassador`.
   - **High-intent audience**:
     - Include: `PassSelect`.
   - **Purchasers:**
     - Separate audiences for `OrderSubmitOnline` and `OrderSubmitAmbassador`.
   - **Lookalikes:**
     - Lookalike from `OrderSubmitOnline` (for online purchase campaigns).
     - Lookalike from `OrderSubmitAmbassador` (for ambassador-focused campaigns).

---

### 5. Technical Work Checklist (For Later)

When we are ready to implement Meta:

- **Env & config**
  - Add `VITE_META_PIXEL_ID` to environment variables.

- **Code**
  - Create `src/lib/meta.ts`:
    - Initialize Pixel with `fbq('init', PIXEL_ID)`.
    - Export `trackMetaEvent(name, params)`.
  - In `PassPurchase.tsx`:
    - Where `trackEvent('pass_purchase_visit', ...)` is called, also call `trackMetaEvent('PassPurchaseVisit', ...)`.
    - Where `trackEvent('pass_select', ...)` is called, also call `trackMetaEvent('PassSelect', ...)`.
    - Where `trackEvent('order_submit_online', ...)` is called, also call `trackMetaEvent('OrderSubmitOnline', ...)` (and possibly `fbq('track', 'Purchase', ...)`).
    - Where `trackEvent('order_submit_ambassador', ...)` is called, also call `trackMetaEvent('OrderSubmitAmbassador', ...)`.

- **Testing**
  - Use Meta’s **Test Events** and **Diagnostics** to confirm payloads.

Once these steps are executed, Meta Ads will have the **same funnel visibility** as GA4, making optimization and reporting consistent across both platforms. 

