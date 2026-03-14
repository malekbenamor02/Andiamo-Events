## Meta Ads Events Plan – Andiamo Events

This document describes the Meta Pixel events we send for Meta Ads: conversion optimization, remarketing, and lookalikes.

---

### 1. Overview of Core Events

We send the following custom events to the Meta Pixel (PascalCase names):

- **`PassPurchaseVisit`**: user visits the pass purchase flow.
- **`PassSelect`**: user selects (adds) at least one pass.
- **`OrderSubmitOnline`**: order created with online payment.
- **`OrderSubmitAmbassador`**: order created with ambassador cash payment.
- **`AmbassadorApplicationVisit`**: user visits the ambassador application page (when applications are open).
- **`AmbassadorApplicationSubmitSuccess`**: user submits the ambassador application successfully.

---

### 2. Meta Pixel Integration – High-Level

The app uses a `meta.ts` helper that:

1. **Loads the Pixel** and reads `VITE_META_PIXEL_ID` from env.
2. **Initializes** with `fbq('init', PIXEL_ID)` once.
3. **Exposes** `trackMetaEvent(name, params)` and fires it from:
   - `PassPurchase.tsx` (visit, pass selection, order submit events).
   - `Application.tsx` (ambassador application page visit, application submit success).

---

### 3. Event Definitions for Meta

Below are the core events, with:

- **Where they fire** (in the app).
- **Meta event name**.
- **Key parameters** (Meta Pixel `fbq('trackCustom', ...)`).
- **How to use them in Meta Ads**.

#### 3.1 `PassPurchaseVisit`

- **When (frontend):**
  - In `PassPurchase.tsx`, once the event is loaded and pass purchase is allowed (not past/completed).

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

#### 3.5 `AmbassadorApplicationVisit`

- **When (frontend):**
  - In `Application.tsx`, once the ambassador application page is loaded and applications are open (not closed by site settings).

- **Meta event name:**
  - `AmbassadorApplicationVisit` (custom event).

- **Parameters (example):**
  - `language` – 'en' or 'fr'.
  - `page_path` – URL path (e.g. `/ambassador/apply` or the route used for the application page).

- **Usage in Meta:**
  - **Custom Audience**: people who visited the ambassador application page (intent to apply).
  - **Funnel**: exclude `AmbassadorApplicationSubmitSuccess` to build an "visited but did not submit" segment for remarketing.

#### 3.6 `AmbassadorApplicationSubmitSuccess`

- **When (frontend):**
  - In `Application.tsx`, inside `handleSubmit`, after the API returns success (application submitted successfully).

- **Meta event name:**
  - `AmbassadorApplicationSubmitSuccess` (custom event).

- **Parameters (example):**
  - `language`
  - `page_path`
  - `city` – user’s city.
  - `ville` – sub-city/area when applicable (e.g. Sousse/Tunis).

- **Usage in Meta:**
  - **Custom Conversion**: define a conversion based on `AmbassadorApplicationSubmitSuccess` for recruitment/ambassador campaigns.
  - **Custom Audience**: people who submitted an application (for exclusions or lookalike source).
  - **Lookalike**: create lookalikes from applicants for ambassador-focused campaigns.

---

### 4. Meta Custom Conversions Setup (Later)

When we implement the Pixel events, the next steps in **Meta Events Manager** will be:

1. **Verify events are received:**
   - Use the **Test Events** tab and open the site.
   - Confirm `PassPurchaseVisit`, `PassSelect`, `OrderSubmitOnline`, `OrderSubmitAmbassador`, `AmbassadorApplicationVisit`, `AmbassadorApplicationSubmitSuccess` appear.

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

### 5. Technical Summary

- **Env:** `VITE_META_PIXEL_ID` in environment variables.
- **Code:** `src/lib/meta.ts` initializes the Pixel and exports `trackMetaEvent`; `PassPurchase.tsx` fires pass-purchase events; `Application.tsx` (ambassador) fires `AmbassadorApplicationVisit` and `AmbassadorApplicationSubmitSuccess`.
- **Testing:** Use Meta’s **Test Events** and **Diagnostics** to confirm payloads. 

