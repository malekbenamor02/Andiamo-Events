# Meta Events Manager Guide – Andiamo Events

Operational guide for verifying and optimizing Meta **`Purchase`** conversions for pass sales.

---

## 1. What we send

| Event | When |
|-------|------|
| **PageView** | Every route change |
| **Purchase** | Confirmed sale (online PAID or ambassador order created) |
| **Lead** | Ambassador application success |
| Custom ambassador apply events | Application page visit / submit |

We no longer send pass-purchase funnel events (`PassPurchaseVisit`, `PassSelect`, `InitiateCheckout`, `OrderSubmitOnline`, `OrderSubmitAmbassador`).

---

## 2. Verify in Events Manager

1. Open [business.facebook.com](https://business.facebook.com) → **Events Manager** → your Pixel.
2. Use **Test Events** tab.
3. Set `META_CAPI_TEST_EVENT_CODE` in env during QA (optional).
4. Test flows:
   - **Ambassador cash order** → `Purchase` (browser + server, deduplicated by `event_id`).
   - **Online order** → `Purchase` on payment confirm (CAPI always; browser if user returns to success page).

Confirm **Event match quality** shows email/phone/name/city parameters.

---

## 3. Campaign optimization

- **Objective:** Sales / Conversions
- **Optimization event:** **`Purchase`** (standard)
- **Value:** enable TND value from `Purchase` events

Do not optimize on removed custom funnel events.

---

## 4. Environment variables

```
VITE_META_PIXEL_ID=...
META_PIXEL_ID=...          # same pixel ID
META_CAPI_ACCESS_TOKEN=...
META_CAPI_TEST_EVENT_CODE=...   # optional, QA only
```

---

## 5. QA checklist

- [ ] Ambassador order: one deduplicated `Purchase` with value + user data
- [ ] Online order (return to site): browser + CAPI `Purchase`, same `event_id`
- [ ] Online order (no return): CAPI `Purchase` still fires on confirm
- [ ] Retry / already paid: no duplicate CAPI (`meta_purchase_sent_at` guard)
- [ ] Ads Manager campaign uses standard **Purchase** conversion

---

## 6. Related docs

- Event definitions: [meta-ads-events-plan.md](meta-ads-events-plan.md)
- Reporting / cadence: [meta-pixel-implementation-playbook.md](meta-pixel-implementation-playbook.md)
