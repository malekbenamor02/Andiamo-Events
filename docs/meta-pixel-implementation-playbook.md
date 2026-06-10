# Meta Pixel Implementation Playbook

Execution guide for Andiamo's Meta measurement: one confirmed **`Purchase`** conversion with CAPI deduplication.

## 1) KPI mapping

| KPI | Primary signal | Where to read |
|-----|----------------|---------------|
| Sales optimization | `Purchase` | Ads Manager → Results |
| ROAS | Purchase value + spend | Purchase ROAS column |
| CPA | Cost per `Purchase` | Cost per result |
| Match quality | Hashed user data on CAPI | Events Manager → Diagnostics |

## 2) Event dictionary

| Event | Trigger | Required params |
|-------|---------|-----------------|
| `PageView` | Route change | — |
| **`Purchase`** | Online PAID or ambassador order created | `value`, `currency`, `content_ids`, `num_items`, `order_id`, `event_id` + user data |
| `Lead` | Ambassador application submit | `content_name`, `city`, `ville` |

**Removed from pass checkout:** `PassPurchaseVisit`, `PassSelect`, `InitiateCheckout`, `OrderSubmitOnline`, `OrderSubmitAmbassador`, `ViewContent`.

### CAPI / dedup

- `eventId` at checkout → Pixel `eventID` + CAPI `event_id`
- `meta_attribution` on order: `fbp`, `fbc`, `eventSourceUrl`, `clientUserAgent`, `clientIp`
- `meta_purchase_sent_at` — server idempotency

## 3) QA checklist (Events Manager)

- Ambassador order → `Purchase` with value, user data, single count (dedup)
- Online paid → CAPI `Purchase` on confirm; browser `Purchase` if user hits success page
- No PII in payment redirect URLs (snapshot in sessionStorage)
- Diagnostics: no missing `value`/`currency`

## 4) Ads Manager saved view

Column set **Andiamo - Conversion Core:**

- Results, Cost per result, Amount spent
- Purchases, Purchase conversion value, Purchase ROAS
- Frequency, CTR

Optimize ad sets on **Purchase** only.

## 5) Retargeting (optional)

| Audience | Include | Exclude |
|----------|---------|---------|
| Purchasers | `Purchase` | — |
| All visitors | `PageView` | `Purchase` |

## 6) Weekly cadence

- Check Purchase volume vs orders in admin
- Review Event match quality
- Confirm ad sets optimize on **Purchase**, not legacy custom events
