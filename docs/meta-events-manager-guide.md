# Meta Events Manager Guide – Andiamo Events

This guide explains how to use **Meta Events Manager** and **Meta Ads** to get more conversions and value from the Meta Pixel. It is the operational how-to for your team. For event definitions and parameters, see [meta-ads-events-plan.md](meta-ads-events-plan.md).

---

## 1. Introduction and what we send

The Andiamo Events app sends the following events to the Meta Pixel (Pixel ID is set via `VITE_META_PIXEL_ID`; see env configuration):

| Event | When it fires |
|-------|----------------|
| **PageView** | On every route change (SPA navigation). |
| **PassPurchaseVisit** | User lands on the pass purchase page for an event (purchase allowed). |
| **PassSelect** | User adds a pass to the selection (quantity 0 → >0). |
| **OrderSubmitOnline** | Order created successfully with online payment (before redirect to payment). |
| **OrderSubmitAmbassador** | Order created successfully with ambassador cash payment. |
| **Purchase** | Standard Meta event fired for online orders (value, currency, content_ids). |
| **AmbassadorApplicationVisit** | User visits the ambassador application page (when applications are open). |
| **AmbassadorApplicationSubmitSuccess** | User submits the ambassador application successfully. |

Using these in Events Manager and Ads Manager gives you better **optimization** (Meta can optimize for your real conversions), **remarketing** (target or exclude specific funnel steps), and **reporting** (funnel and value in one place).

---

## 2. Verify events in Events Manager

### Where to open Events Manager

1. Go to [business.facebook.com](https://business.facebook.com) and open your Business Account.
2. In the left menu: **All tools** → **Measure & report** → **Events Manager** (or **Data sources** → **Pixels**).
3. Select your **Pixel** (the one used by the app, e.g. ID `930929995973320`).

### Test Events (before or after go-live)

1. In the Pixel view, open the **Test Events** tab.
2. Use **Test events** with your browser or device (follow the in-app instructions to connect your browser).
3. On your site, perform:
   - **Navigate** a few routes → you should see **PageView** for each.
   - **Open a pass purchase page** (e.g. `/event/{slug}` or pass-purchase with `eventId`) → **PassPurchaseVisit**.
   - **Add a pass** (quantity 0 → 1) → **PassSelect**.
   - **Complete an order** (online or ambassador) → **OrderSubmitOnline** or **OrderSubmitAmbassador**, and for online also **Purchase**.
   - **Open the ambassador application page** → **AmbassadorApplicationVisit**.
   - **Submit the ambassador application successfully** → **AmbassadorApplicationSubmitSuccess**.
4. In Test Events, confirm:
   - Event names match exactly (e.g. `PassPurchaseVisit`, `OrderSubmitOnline`).
   - Key parameters are present: `event_id`, `event_name`, `value`, `currency`, `language`, `page_path` where relevant.

### Overview / Event activity (after go-live)

- In the Pixel’s **Overview** or **Event activity**, check that events are coming in over time.
- Use filters by event name and date to confirm volume and parameters.

---

## 3. Custom conversions (main value for optimization)

**Custom conversions** turn your Pixel events into goals that campaigns can optimize for. They also let you report on “conversions” and use value when you send it.

### How to create a custom conversion

1. In **Events Manager**, select your Pixel.
2. Go to **Custom conversions** (or **Overview** → **Custom conversions**).
3. Click **Create custom conversion**.
4. **Data source:** your Pixel.
5. **Conversion event:** choose **Custom** and type the **exact** event name (case-sensitive).
6. Optionally set **Category** and **Conversion name** for reporting.
7. If the event sends a value (e.g. order total in TND), enable **Use value from event** when the option is available so Meta can use it for value-based optimization.

### Conversions to create

| Conversion name | Custom event name | Use value? |
|-----------------|-------------------|------------|
| **Online order** | `OrderSubmitOnline` | Yes (TND) |
| **Ambassador order** | `OrderSubmitAmbassador` | Yes (TND) |
| *(Optional)* Pass purchase visit | `PassPurchaseVisit` | No |
| *(Optional)* Pass selected | `PassSelect` | No |
| *(Optional)* Ambassador application submitted | `AmbassadorApplicationSubmitSuccess` | No |

Create at least **Online order** and **Ambassador order**. Use **Ambassador application submitted** if you run campaigns to recruit ambassadors. The optional ones are useful if you want to optimize or report on upper-funnel steps (e.g. “Started checkout” or “Added pass”).

---

## 4. Using conversions in Meta Ads campaigns

### Where to set the conversion goal

1. In **Ads Manager**, create or edit a campaign.
2. Set **Campaign objective** (e.g. **Sales** or **Leads**, depending on goal).
3. At the **Ad set** level, find **Conversion** or **Optimization and delivery**.
4. Under **Conversion**, choose **Conversions** and select your **custom conversion**:
   - For campaigns focused on **online sales** → select **Online order** (from `OrderSubmitOnline`).
   - For campaigns focused on **ambassador-driven sales** → select **Ambassador order** (from `OrderSubmitAmbassador`).

### Value optimization

- If you created the custom conversion with **Use value from event** (TND), Meta can optimize for **value** (revenue) instead of just conversion count. Enable value optimization in the ad set when the option is available.

### Attribution window

- Meta uses an attribution window (e.g. 7-day click, 1-day view). Reported conversions will respect this window; adjust in the ad set or account settings if needed.

---

## 5. Custom audiences for remarketing and exclusions

Custom audiences based on Pixel events let you **remarket** to people who did (or did not) complete a step, and **exclude** converters from prospecting to save budget.

### Where to create them

- **Events Manager:** Pixel → **Audiences** (or **Custom audiences**).
- Or **Ads Manager:** **Audiences** → **Create audience** → **Custom audience** → **Website** (or **Pixel**), then define rules by **Events**.

### Audiences to build

| Audience name | Include | Exclude | Retention (example) |
|---------------|---------|---------|----------------------|
| **Abandoned purchase flow** | PassPurchaseVisit or PassSelect | OrderSubmitOnline AND OrderSubmitAmbassador | 14–30 days |
| **High-intent (pass selected)** | PassSelect | (Optional) OrderSubmitOnline, OrderSubmitAmbassador | 7–14 days |
| **Online purchasers** | OrderSubmitOnline | — | 180 days or longer |
| **Ambassador purchasers** | OrderSubmitAmbassador | — | 180 days or longer |

- **Abandoned purchase flow:** Use for remarketing (e.g. “Complete your order”).
- **High-intent:** Use for remarketing or higher-funnel campaigns.
- **Online / Ambassador purchasers:** Use for cross-sell, exclusions from prospecting, or as **source for lookalike audiences**.

---

## 6. Lookalike audiences

**Lookalike audiences** help you reach people similar to your converters so you can scale.

### How to create a lookalike

1. **Audiences** → **Create audience** → **Lookalike**.
2. **Source:** Select a **Custom audience** based on your Pixel (e.g. **Online purchasers** or **Ambassador purchasers**). You can also use a conversion event as source if the UI allows.
3. **Location:** Choose the country/countries (e.g. Tunisia).
4. **Audience size:** Start with **1–2%** for scaling; **0.5–1%** for higher intent.

### Which lookalike for which campaign

- **Online sales campaigns** → Lookalike from **Online purchasers** (or from OrderSubmitOnline custom audience).
- **Ambassador / community campaigns** → Lookalike from **Ambassador purchasers** (or OrderSubmitAmbassador custom audience).

---

## 7. Event match quality and diagnostics

### Where to find it

- In **Events Manager**, select your Pixel, then open **Diagnostics** (or **Event match quality** / **Data quality**, depending on the UI).

### Why it matters

- Higher **event match quality** means Meta can attribute and optimize better. It depends on parameters sent (e.g. `event_id`, `value`, `content_ids`), and on not blocking the Pixel (ad blockers, consent, iOS restrictions).

### Practical tips

- The app already sends key parameters (event_id, event_name, value, currency, items). Keep them in place.
- If many users block scripts or use strict privacy settings, consider **Conversions API (CAPI)** later to send events server-side and improve match quality.

---

## 8. Quick reference checklist

**After going live (one-time):**

- [ ] Open Events Manager and confirm the correct Pixel is used.
- [ ] Use **Test Events** to verify PageView, PassPurchaseVisit, PassSelect, OrderSubmitOnline, OrderSubmitAmbassador, Purchase, AmbassadorApplicationVisit, and AmbassadorApplicationSubmitSuccess.
- [ ] Create custom conversion **Online order** (event: `OrderSubmitOnline`, use value).
- [ ] Create custom conversion **Ambassador order** (event: `OrderSubmitAmbassador`, use value).
- [ ] In Ads Manager, set campaign/ad set conversion goal to the right custom conversion and enable value optimization if desired.
- [ ] Create **Abandoned purchase flow** audience (PassPurchaseVisit or PassSelect, exclude both order events).
- [ ] Create **Online purchasers** and **Ambassador purchasers** audiences.
- [ ] Create **Lookalike** from Online purchasers and from Ambassador purchasers.

**Ongoing:**

- [ ] Check **Overview / Event activity** and **Diagnostics** periodically.
- [ ] Use **Abandoned purchase** and **Purchasers** audiences in remarketing and exclusions.
- [ ] Use **Lookalikes** for prospecting campaigns.

---

## 9. What else can add value

- **Aggregated Event Measurement (AEM):** On iOS, Meta may limit which events are available. In Events Manager you can set **event priority** so the most important events (e.g. Purchase, OrderSubmitOnline) are prioritized when limits apply.
- **Standard events:** The app already sends the standard **Purchase** event for online orders (value, currency, content_ids). Other standard events (e.g. ViewContent, AddToCart) could be added in the future if you want more funnel steps in Meta’s standard reporting.
- **Conversions API (CAPI):** Sending the same events from your server (in addition to the Pixel) can improve event match quality and resilience to browser blocking. This is a technical follow-up; see your technical docs or roadmap if you decide to implement it.
