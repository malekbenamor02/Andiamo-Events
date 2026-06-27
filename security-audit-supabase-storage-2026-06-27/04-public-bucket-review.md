# 04 — Public Bucket Review

**Public buckets in production:** `images`, `hero-images`, `career-documents`, `tickets`

---

## 1. `images` (234 objects)

| Check | Result |
|-------|--------|
| Intended content | Event posters, gallery, sponsors, seating charts, favicon, marketing email assets |
| Sensitive paths observed | Folders: `posters/`, `gallery/`, `sponsors/`, `seating-charts/`, `campaign-email/`, `marketing-email-attachments/`, `favicon/` |
| PII in object names | No emails/phones observed in SQL prefix samples; timestamp-random naming |
| Directory listing via API | **Partial** — anon list returned folder names |
| Predictability | Low for filenames (`{timestamp}-{random}.webp`) |
| HTML/JS upload risk | **Yes** — anon can upload any extension; no MIME whitelist at bucket level |
| Risk | **High** (integrity/abuse), not confidentiality of existing posters |

---

## 2. `hero-images` (9 objects)

| Check | Result |
|-------|--------|
| Intended content | Homepage hero images/videos |
| Sensitive data | None expected |
| Anon upload/delete | Upload **allowed**; delete policy exists |
| Predictability | `{timestamp}-{random}.webp` pattern |
| Risk | **High** (defacement), **Low** confidentiality |

---

## 3. `career-documents` (112 objects) — **SENSITIVE**

| Check | Result |
|-------|--------|
| Intended content | CVs, PDFs, application documents from `/careers` form |
| Should be public? | **No** |
| Bucket flag | **`public: true`** — direct URL works without auth |
| Object name indicators (masked SQL aggregates) | Prefixes include tokens like `Resume`, `Profes`, `job-ap`, `IMG_` — applicant-identifying patterns |
| Directory listing | List API returned empty at root (SELECT policy removed) |
| Predictability | **Medium** — `{timestamp}-{sanitizedOriginalFilename}`; timestamp narrows search window |
| PII exposure | **Yes** — full document content readable via URL |
| Risk | **Critical** |

**Evidence:** Migration `20260304110000-career-documents-bucket.sql` created bucket as public with `Public can view career documents`. Migration `20260408000000` removed SELECT policy but **left bucket public**.

---

## 4. `tickets` (1,431 objects) — **SENSITIVE**

| Check | Result |
|-------|--------|
| Intended content | PNG QR codes for tickets and official invitations |
| Should be public? | **No** |
| Bucket flag | **`public: true`** |
| Path structure | `tickets/{orderUuid}/{secureTokenUuid}.png`, `invitations/{invitationUuid}/{secureTokenUuid}.png` |
| Token in URL path | **Yes** — filename is the ticket `secure_token` |
| QR payload | PNG encodes the same `secure_token` string (verified in code: `QRCode.toBuffer(secureToken)`) |
| Directory listing | List API empty in tests |
| Predictability | UUID paths — not brute-force friendly alone, but URLs are stored in DB, emailed (Brevo), shown in admin UI, and appear in **storage logs** |
| Storage log sample (masked) | `GET 200 ... /object/public/tickets/tickets/a9303f0f-****/f7dcdb7c-****.png` |
| Risk | **Critical** |

**Code references:**

- `api/misc.js` ~3804–3820: `getPublicUrl` after service-role upload
- `api/admin-approve-order.js` ~481–497: same pattern
- `api/_lib/r2-media.cjs`: prefers R2 public CDN when configured; Supabase public URL fallback

---

## Public URL format

```
https://ykeryyraxmtjunnotoep.supabase.co/storage/v1/object/public/{bucket}/{path}
```

Private buckets (`academy-payment-proofs`, `events`) return **Bucket not found** on this endpoint (verified).

---

## Directory listing vs direct URL

| Bucket | API list (anon) | Direct public URL |
|--------|-----------------|---------------------|
| images | **Some folders visible** | All objects |
| hero-images | Empty in test | All objects |
| career-documents | Empty in test | **All objects** |
| tickets | Empty in test | **All objects** |

---

## Sensitive content checklist (public buckets)

| Data type | Found in public buckets? |
|-----------|--------------------------|
| Customer emails in filenames | Not observed in aggregates |
| Phone numbers in filenames | Not observed |
| Ticket secure tokens | **Yes** — in ticket QR paths |
| QR codes | **Yes** — 1,431 in `tickets` |
| Invoices/receipts | Not observed in storage object names |
| Payment proofs | **No** — private bucket |
| CVs / application docs | **Yes** — `career-documents` |
| Admin exports | Not observed |

---

## Conclusion

Two public buckets contain **confidential data** and must be made private with signed-URL or proxy access. Two marketing buckets are appropriately public for delivery but **must not allow anonymous write/delete**.
