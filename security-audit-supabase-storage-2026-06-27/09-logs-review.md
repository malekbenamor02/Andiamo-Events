# 09 — Storage Logs Review

**Source:** Supabase MCP `get_logs` service=`storage` (last 24 hours, sampled 2026-06-27)

---

## Activity summary

| Category | Observation |
|----------|-------------|
| Normal public asset traffic | High volume of **HTTP 200** GETs to `/object/public/images/posters/*.webp`, `/object/info/public/images/...`, hero-images |
| Ticket QR access | **HTTP 200** GETs to `/object/public/tickets/tickets/{uuid}/{uuid}.png` |
| User agents | Mix of `undefined` (internal/info requests), `Brevo/1.0` (email image proxy), `node` (server-side fetch), `Shap-User/0.1.0` (external crawler on posters) |
| Failed RLS / unauthorized uploads | **Not prominent** in sampled window (anon uploads would not appear if not attempted in prod during window) |
| Listing attempts | Not clearly labeled in logs |
| academy-payment-proofs | **No public access paths** in sample |
| Private buckets | No successful public GETs for `events` or `academy-payment-proofs` |

---

## Ticket QR log evidence (masked)

Sample log lines (paths partially masked):

```
GET | 200 | ... | /object/public/tickets/tickets/a9303f0f-****/f7dcdb7c-****.png | Brevo/1.0
GET | 200 | ... | /object/public/tickets/tickets/a9303f0f-****/f7dcdb7c-****.png | node
GET | 200 | ... | /object/info/public/tickets/tickets/a9303f0f-****/f7dcdb7c-****.png | undefined
```

**Interpretation:** Ticket QR PNGs are actively fetched over **unauthenticated public URLs**, including by email infrastructure (Brevo).

---

## Marketing asset traffic

Poster and hero image requests from multiple edge regions (MRS, CDG, AMS, etc.) — expected CDN behavior.

External crawler (`Shap-User/0.1.0`) fetching poster URLs — expected for public marketing content.

---

## Suspicious activity

| Signal | Seen? | Notes |
|--------|-------|-------|
| High-volume ticket QR downloads from single IP | Not identified in sample | Full log analytics not run |
| Mass upload errors (403) | Not in sample | |
| Access to academy proofs via public path | **No** | |
| Unusual user agents on ticket URLs | Brevo/node only — expected |

IPs are **not printed** in this report per audit rules.

---

## Logging gaps

- No application-level audit log for storage upload/delete in Supabase logs alone.
- Cannot correlate anon abuse uploads from this 24h sample (spot checks performed separately).

---

## Conclusion

Logs **confirm** public ticket QR delivery path is live in production. No evidence of academy proof public leakage via storage endpoint.
