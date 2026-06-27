# 01 — Storage Bucket Inventory

**Source:** `SELECT id, name, public, file_size_limit, allowed_mime_types, created_at FROM storage.buckets` (Supabase MCP, 2026-06-27)  
**Object counts:** `SELECT bucket_id, COUNT(*) FROM storage.objects GROUP BY bucket_id`

---

## Summary table

| Bucket | Public | Objects | MIME restrictions | Size limit | Likely purpose (code) | Should be public? | Risk | Notes |
|--------|--------|---------|-------------------|------------|----------------------|-------------------|------|-------|
| `academy-payment-proofs` | **No** | 16 | None | None | Academy registration payment proof uploads (`academyRoutes.cjs` → service role) | **No** | **Low** | Private bucket; no storage policies; API-only via service role. Path `{registrationId}/{uuid}.ext`. |
| `career-documents` | **Yes** | 112 | None | None | Career application CVs (`src/lib/upload.ts` → `uploadCareerDocument`, `Careers.tsx`) | **No** | **Critical** | Public bucket. Filenames like `{timestamp}-{sanitizedOriginalName}` expose doc type (e.g. `Resume`, `Profes`, `job-ap`). |
| `events` | **No** | 1 | None | None | Legacy/unknown (no active code reference found) | **No** | **Low** | Private; anon public-URL endpoint returns "Bucket not found". |
| `hero-images` | **Yes** | 9 | None | None | Homepage hero media (`uploadHeroImage`, admin Dashboard) | **Yes** (assets only) | **High** | Anon INSERT/DELETE allowed by policy. Also mirrored to R2 when configured. |
| `images` | **Yes** | 234 | None | None | Posters, gallery, sponsors, seating charts, favicon fallback, marketing attachments (`uploadImage`, `favicon.ts`) | **Yes** (assets only) | **High** | `"Allow all operations for images"` ALL policy. Anon list/upload/delete verified. |
| `tickets` | **Yes** | 1,431 | None | None | Ticket/invitation QR PNGs (`api/misc.js`, `api/admin-approve-order.js`, `api/_lib/r2-media.cjs`) | **No** | **Critical** | Paths: `tickets/{orderId}/{secureToken}.png`, `invitations/{invitationId}/{secureToken}.png`. QR image encodes token. Fallback when R2 not configured. |

---

## Sensitive-data buckets (detailed)

### `tickets` — ticket QR codes

- **Public flag:** `true`
- **Count:** 1,431 objects
- **Path patterns (masked samples):**
  - `tickets/0456ffc3-****-****-****-************/` (9 objects under prefix)
  - `invitations/add4de4c-****-****-****-************/` (20 objects)
- **Code:** Backend generates QR from `secureToken` (UUID), uploads with service role, stores `getPublicUrl()` in `tickets.qr_code_url`.
- **Should be private:** Yes — use signed URLs or non-guessable proxy download after auth.
- **Risk:** **Critical** — public read of ticket gate credential.

### `career-documents` — applicant uploads

- **Public flag:** `true`
- **Count:** 112 objects
- **Name length:** 20–90 chars; prefixes include job/CV-related tokens (masked in SQL aggregate).
- **Code:** `uploadCareerDocument()` uploads from browser with anon key; URL stored in application payload.
- **Should be private:** Yes — admin-only signed URLs or server proxy.
- **Risk:** **Critical** — PII document exposure.

### `academy-payment-proofs` — payment proof images/PDFs

- **Public flag:** `false`
- **Count:** 16 objects
- **Code:** `POST /api/academy/register` uploads via **service role** to `{registrationId}/{uuid}.ext`.
- **Access:** Admin `GET /api/admin/academy/registrations/:id` returns `proof_signed_url` (1h expiry).
- **Should be private:** Yes (current design correct).
- **Risk:** **Low**

---

## Non-sensitive public asset buckets

### `images` / `hero-images`

- Intended for public website assets (posters, hero banners, sponsors).
- **Problem:** Not confidentiality of existing assets, but **integrity/abuse** — any anonymous client can upload/delete/list (see `03-anon-access-tests.md`).

---

## Legacy / minimal use

### `events`

- Private bucket, 1 object, no matching upload flow in current codebase grep.
- Treat as legacy; confirm contents before deletion in a future maintenance window.
