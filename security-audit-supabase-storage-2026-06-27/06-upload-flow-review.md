# 06 — Upload Flow Review

---

## Summary table

| # | Flow | File(s) | Bucket | Side | Who can upload | Auth check | Path generation | MIME/size | upsert | Risk |
|---|------|---------|--------|------|----------------|------------|-----------------|-----------|--------|------|
| 1 | Event poster/gallery/sponsor | `src/lib/upload.ts`, `Dashboard.tsx` | `images` | Client | **Anyone with anon key** | **None at storage** | `{folder}/{timestamp}-{random}.ext` | No server validation; client File object | `false` | **High** |
| 2 | Hero image/video | `uploadHeroImage`, `Dashboard.tsx` | `hero-images` | Client | **Anyone** | **None at storage** | `{timestamp}-{random}.ext` | No | `false` | **High** |
| 3 | Career CV/document | `uploadCareerDocument`, `Careers.tsx` | `career-documents` | Client | **Anyone** | reCAPTCHA on form submit only; **not on storage** | `{timestamp}-{sanitizedName}` | No whitelist at storage | `false` | **Critical** |
| 4 | Marketing email image | `EmailCampaignEditor.tsx` | `images` | Client | Admin UI (app auth) | Admin session for UI; **storage open to anon** | `campaign-email/...` | No | `false` | **High** |
| 5 | Marketing email attachment | `uploadMarketingEmailAttachment` | `images` | Client | Admin UI | Same | `marketing-email-attachments/...` | No | `false` | **High** |
| 6 | Favicon | `src/lib/favicon.ts` | R2 or `images` | Client + API | Admin settings UI | `/api/media/upload` requires admin when R2; Supabase fallback uses anon | `favicon/{type}_{ts}.ext` | Partial | `false` | **Medium** |
| 7 | Ticket QR PNG | `api/misc.js`, `admin-approve-order.js` | `tickets` (or R2) | Server | Service role (order approval / ticket generation) | Backend business logic | `tickets/{orderId}/{secureToken}.png` | PNG only in code | **`true`** | **Critical** (public URL) |
| 8 | Invitation QR PNG | `api/misc.js` ~7064 | `tickets` | Server | Service role | Admin invitation route | `invitations/{id}/{secureToken}.png` | PNG | **`true`** | **Critical** |
| 9 | POS ticket QR | `api/admin-pos.js` | R2 or `tickets` | Server | Admin/POS auth + service role | Route auth | Same as tickets | PNG | via R2 helper | **Critical** if Supabase fallback |
| 10 | Academy payment proof | `academyRoutes.cjs` ~563 | `academy-payment-proofs` | Server | Public registration API | IP rate limit (5/hr); MIME check | `{registrationId}/{uuid}.ext` | 5 MB; MIME whitelist | `false` | **Low** |
| 11 | R2 admin media | `api/_lib/register-media-routes.cjs` | R2 (not Supabase) | Server | **`requireAdminAuth`** | Yes | Scoped by `scope` param | 45 MB; folder whitelist | N/A | **Low** |

---

## Detailed notes

### Client-side Supabase uploads (`src/lib/upload.ts`)

```typescript
await supabase.storage.from(bucket).upload(path, file, { cacheControl, upsert: false });
const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
```

- Uses **`VITE_SUPABASE_ANON_KEY`** — no admin JWT on storage requests.
- Admin Dashboard is protected by **application auth**, but storage RLS does not distinguish admin vs anonymous.
- **No MIME whitelist** at storage layer (only academy has server-side MIME check).
- **No size limit** at bucket configuration (`file_size_limit` null on all buckets).
- **User-controlled path:** partially — folder prefix is code-defined; career flow includes sanitized original filename.

### Career uploads (`Careers.tsx`)

1. User selects file → `uploadCareerDocument(file)` → public URL
2. URL embedded in application payload → `submitCareerApplication`

**Flags:**

- Public bucket stores PII documents
- Filename retains applicant-chosen name (sanitized)
- reCAPTCHA protects form API, not direct storage API abuse

### Ticket QR uploads (server)

- **`upsert: true`** on ticket PNGs — allows overwrite by service role (not anon).
- QR encodes **`secureToken`** — equivalent to publishing ticket secret.
- **`uploadTicketQrToR2OrSupabase`**: when R2 configured, uploads to **public R2 CDN** (`PUBLIC_ASSETS_BASE_URL`) — same confidentiality issue on CDN.

### Academy payment proof (server — reference implementation)

- Multer **5 MB** limit (`PROOF_MAX_BYTES`)
- MIME/extension allowlist in `isAllowedProofMime`
- Service role upload to **private** bucket
- Rollback registration if upload fails

---

## Dangerous patterns flagged

| Pattern | Present? | Where |
|---------|----------|-------|
| User-controlled path without sanitization | Partial | career filename; otherwise random |
| `upsert: true` on sensitive uploads | Yes | ticket QR (service role only) |
| No MIME whitelist | Yes | images, hero, career (storage level) |
| No size limit | Yes | all Supabase buckets |
| HTML/SVG/JS in public buckets | Possible | anon upload to images/hero |
| Predictable sensitive filenames | Yes | career `{ts}-{name}`; tickets `{token}.png` |
| Ticket QR in public bucket | **Yes** | `tickets` |
| Service role upload without auth | **No** | ticket routes require order/admin context |
| Antivirus scanning | **No** | not implemented |

---

## Upload flow verdict

| Category | Verdict |
|----------|---------|
| Academy payment proofs | **Safe** |
| Ticket/invitation QRs | **Unsafe** (public URL + token in QR) |
| Career documents | **Unsafe** |
| Marketing/admin images | **Unsafe write path** (anon upload/delete), OK read model |
| R2 admin `/api/media/upload` | **Safe** |
