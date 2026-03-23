# Meta Pixel Implementation Playbook

This is the execution guide for Andiamo's Meta measurement program: KPI mapping, event dictionary, QA, reporting views, retargeting audiences, and weekly optimization cadence.

## 1) KPI Mapping

| KPI | Primary signal(s) | Where to read | Target/Guardrail |
|---|---|---|---|
| AI Optimization (Learning) | `Purchase`, `Lead`, ad set delivery status | Ads Manager (Delivery) | Keep ad sets out of `Learning Limited`; aim for 50+ optimization events/week per ad set |
| Retargeting | `ViewContent`, `InitiateCheckout`, `Purchase`, `PassSelect`, `PassPurchaseVisit` | Audiences + Ads results | Positive incremental ROAS vs prospecting benchmark |
| Audience Insights | Breakdown by age, gender, placement, region, device | Ads Manager breakdowns | Shift spend to top slices weekly |
| ROAS | Purchase value + spend | Ads Manager columns (`Purchase ROAS`) | Campaign-specific threshold (for example >= 2.0) |
| CPA / CPL | Cost per `Purchase` / `Lead` | Ads Manager (`Cost per result`) | Segment-specific cap by campaign type |

## 2) Event Dictionary (Source of Truth)

### Standard Events

| Event | Trigger | Required params | Notes |
|---|---|---|---|
| `PageView` | Route change | none | Sent globally on SPA navigation |
| `ViewContent` | Pass purchase page loaded (purchase available) | `content_type`, `content_ids`, `content_name` | Standard product/content signal |
| `InitiateCheckout` | Valid checkout submit flow starts | `value`, `currency`, `num_items`, `content_ids`, `content_type` | Mid-funnel optimization |
| `Purchase` | Order created successfully | `value`, `currency`, `content_ids`, `content_type`, `num_items` | Sent browser + server (CAPI) with dedup `event_id` |
| `Lead` | Ambassador application submitted successfully | `content_name`, `status`, `city`, `ville` | Standard lead optimization event |

### Custom Events

| Event | Trigger |
|---|---|
| `PassPurchaseVisit` | User enters pass purchase flow |
| `PassSelect` | User selects first quantity of pass |
| `OrderSubmitOnline` | Online order creation succeeds |
| `OrderSubmitAmbassador` | Ambassador-cash order creation succeeds |
| `AmbassadorApplicationVisit` | User visits ambassador application page |
| `AmbassadorApplicationSubmitSuccess` | Ambassador application submission succeeds |

### CAPI / Dedup Inputs

- `metaEventId` -> used as Pixel `eventID` and CAPI `event_id`.
- `metaFbp`, `metaFbc` -> browser cookie attribution forwarded to backend.
- `metaEventSourceUrl` -> page URL sent to CAPI.

## 3) QA Checklist (Events Manager)

Use this sequence in `Test Events`:

- Open pass purchase page -> verify `PageView`, `PassPurchaseVisit`, `ViewContent`.
- Add first pass quantity -> verify `PassSelect`.
- Submit valid order -> verify `InitiateCheckout` then `Purchase`.
- Submit ambassador application -> verify `AmbassadorApplicationSubmitSuccess` and `Lead`.
- Confirm no duplicate `Purchase` for a single order (browser + server dedup should collapse by shared `event_id`).
- Resolve diagnostics for missing `value`/`currency`, low match quality, or duplicate signals.

## 4) Ads Manager Saved Reporting Views

Create a saved column set named `Andiamo - Conversion Core`:

- Delivery
- Results
- Cost per result
- Amount spent
- Purchases
- Purchase conversion value
- Purchase ROAS
- Leads
- CPC (link)
- CTR (link click-through rate)
- Frequency

Create breakdown presets:

- `Audience`: Age, Gender
- `Delivery`: Placement, Device platform
- `Geo`: Region / City
- `Time`: Day

## 5) Retargeting Audience Matrix

| Audience | Include | Exclude | Window |
|---|---|---|---|
| All visitors | `PageView` | none | 30/60/180d |
| Product viewers | `ViewContent` | `Purchase` | 14-30d |
| Checkout no purchase | `InitiateCheckout` | `Purchase` | 3-14d |
| Purchasers | `Purchase` | none | 180d |
| Leads | `Lead` | none | 180d |

Exclusion rules:

- Prospecting excludes `Purchase` last 180d.
- Mid-funnel retargeting excludes converted `Purchase` users.
- High-intent retargeting tiers should be mutually exclusive by event depth.

## 6) Weekly Optimization SOP

Every week:

1. Check ad sets in `Learning Limited`.
2. Consolidate fragmented ad sets or broaden targeting where event volume is low.
3. Reallocate budget from high-CPA segments to high-ROAS segments.
4. Inspect audience breakdown winners and adjust budgets/creative by top slices.
5. Rotate retargeting creatives if frequency rises and CTR declines.
6. Document decisions in a changelog (what changed, why, and expected effect).

## 7) Operational Guardrails

- Keep attribution window consistent while comparing periods.
- Do not compare ROAS/CPA across campaigns with different optimization goals without labeling.
- If CAPI is disabled or token expires, keep browser Pixel active and monitor diagnostics.
- Any event schema change must update this playbook and QA checklist in the same release.
