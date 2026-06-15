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
| **`Lead`** | Ambassador application submit (API success) | `event_id` + user data (browser advanced matching; CAPI hashed `user_data`) |

**Removed from pass checkout:** `PassPurchaseVisit`, `PassSelect`, `InitiateCheckout`, `OrderSubmitOnline`, `OrderSubmitAmbassador`, `ViewContent`.

**Removed from ambassador funnel:** `AmbassadorApplicationVisit`, `AmbassadorApplicationSubmitSuccess`.

### CAPI / dedup

**Purchase:**

- `eventId` at checkout → Pixel `eventID` + CAPI `event_id`
- `meta_attribution` on order: `fbp`, `fbc`, `eventSourceUrl`, `clientUserAgent`, `clientIp`
- `meta_purchase_sent_at` — server idempotency

**Lead:**

- `metaEventId` at submit → Pixel `eventID` + CAPI `event_id`
- `meta_attribution` on `ambassador_applications`: `fbp`, `fbc`, `eventSourceUrl`, `clientUserAgent`, `clientIp`
- `meta_lead_sent_at` — server idempotency (single source of truth before CAPI send)
- Unique index on `meta_attribution->>'eventId'` — frontend retry protection
- Structured logs: `META_LEAD_CAPI_SUCCESS`, `META_LEAD_CAPI_FAILED`, `META_LEAD_CAPI_SKIPPED`, `META_LEAD_CAPI_WARNING`
- Optional debug: `META_DEBUG_LEAD=true` (redacted payload + API response, no raw PII)

## 3) QA checklist (Events Manager)

- Ambassador application → one deduplicated `Lead` (browser + CAPI, same `event_id`)
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
