# 05 — Signed URL Review

**Code search:** `createSignedUrl`, `createSignedUrls`, `signedUrl`, `signed_url`, `proof_signed_url` across repository.

---

## Findings summary

| Flow | Location | Bucket | Expiry | Who can request | Auth before sign | Client-side? | Risk |
|------|----------|--------|--------|-----------------|------------------|--------------|------|
| Academy payment proof view | `academyRoutes.cjs` L951–956 | `academy-payment-proofs` | **3600 s (1 h)** | Admin with `academy:manage` | **Yes** — `requireAdminAuth` + loads registration by ID | **No** — service role client | **Low** |
| Ticket QR display | N/A — uses **public URLs** | `tickets` | None (permanent public) | Anyone with URL | **No** | N/A | **Critical** |
| Career document after upload | `uploadCareerDocument` → `getPublicUrl` | `career-documents` | None (permanent public) | Anyone with URL | **No** | **Yes** (browser) | **Critical** |
| Marketing/event images | `upload.ts` → `getPublicUrl` | `images`, `hero-images` | None (public) | Anyone | N/A (intentional public) | **Yes** | **Low–Medium** |

**No `createSignedUrl` usage found in frontend (`src/**`).**

---

## Flow 1: Academy payment proof (GOOD PATTERN)

**Route:** `GET /api/admin/academy/registrations/:id`  
**File:** `academyRoutes.cjs`

```javascript
const { data: signed } = await db.storage
  .from('academy-payment-proofs')
  .createSignedUrl(data.payment_proof_path, 3600);
```

| Control | Status |
|---------|--------|
| Server-side only | Yes |
| Service role DB client | Yes (`getServiceDb()`) |
| Admin auth | Yes |
| Permission | `academy:manage` |
| Path from DB row (not user-supplied arbitrary path) | Yes — `payment_proof_path` from registration record |
| Expiry | 1 hour — acceptable; could reduce to 15–30 min |
| Logged in response | URL returned to admin UI only |

**Verdict:** **Safe** — model to replicate for other private files.

---

## Flow 2: Ticket QR URLs (NO SIGNING — PUBLIC)

**Files:** `api/misc.js`, `api/admin-approve-order.js`, `api/_lib/r2-media.cjs`

After service-role upload:

```javascript
storageClient.storage.from('tickets').getPublicUrl(fileName);
```

| Control | Status |
|---------|--------|
| Signed URL | **No** |
| Bucket | **Public** |
| URL stored in DB | `tickets.qr_code_url`, `qr_tickets.qr_code_url` |
| Emailed to customers | Yes (HTML `<img src="${ticket.qr_code_url}">`) |
| R2 fallback | `uploadTicketQrToR2OrSupabase` — still **public CDN URL** when R2 enabled |

**Verdict:** **Unsafe** for gate credentials — URLs are long-lived and unauthenticated.

---

## Flow 3: Career documents (NO SIGNING — PUBLIC)

**File:** `src/lib/upload.ts` → `uploadCareerDocument`

Uses browser Supabase client + `getPublicUrl`. URL stored in career application form payload.

**Verdict:** **Unsafe** — applicant PII documents.

---

## Flow 4: Admin marketing uploads (PUBLIC BY DESIGN)

**Files:** `src/lib/upload.ts`, admin Dashboard, `EmailCampaignEditor.tsx`

`getPublicUrl` after anon-key upload — appropriate for public website images **if** upload were restricted to authenticated admins at the storage layer (currently **not** — see `06-upload-flow-review.md`).

---

## `getPublicUrl` inventory (frontend)

| File | Bucket | Private file risk |
|------|--------|-------------------|
| `src/lib/upload.ts` | images, hero-images, career-documents | career-documents **should not use getPublicUrl** |
| `src/lib/favicon.ts` | images (fallback) | Public favicon — OK |

---

## Signed URL security checklist

| Requirement | Status |
|-------------|--------|
| Private files signed server-side only | **Partial** — academy proofs only |
| Browser must not sign private URLs | **Pass** |
| Short expiry | **Pass** for academy (1h) |
| User-controlled paths validated | **Pass** for academy (DB-bound path) |
| Arbitrary path signing endpoint | **None found** |
| Signed URLs in logs | Not audited at app level; avoid logging full URLs |

---

## Recommendations (see fix plan)

1. Replace ticket `getPublicUrl` with short-lived signed URLs at email/send time, or move QRs to private bucket + scanner-only backend validation without public image URL.
2. Move career uploads to server-side API (like academy proofs) with admin signed URL for HR review.
3. Keep academy proof pattern; consider 900s expiry.
