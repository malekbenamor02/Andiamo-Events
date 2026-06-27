# Expected post-migration bucket state

Source: `supabase/migrations/20260627140000_fix_storage_bucket_security.sql`

| Bucket | `public` | Size limit | MIME restrictions | Anon write/delete | Intended use |
|--------|----------|------------|-------------------|-------------------|--------------|
| **tickets** | **false** | 1 MB | `image/png` only | **Blocked** | Legacy QR PNGs remain in bucket; **new** tickets use `GET /api/tickets/qr/:secureToken` (no public URL). Service role only for object CRUD. |
| **career-documents** | **false** | 10 MB | PDF, DOC/DOCX, JPEG, PNG | **Blocked** | Applicant uploads via `POST /api/careers/upload-document` (service role). Admin views via short signed URLs (900s). |
| **images** | **true** (read) | 25 MB | images + mp4/webm | **Blocked** (post-migration) | Public marketing assets. Admin upload/delete via `/api/admin/media/*` (service role). |
| **hero-images** | **true** (read) | 25 MB | images + mp4/webm | **Blocked** (post-migration) | Hero carousel / video. Admin upload/delete via backend. |
| **academy-payment-proofs** | **false** | 5 MB | JPEG, PNG, PDF | **Blocked** (unchanged) | Already private; service role manage policy retained. |
| **events** | **false** | (unchanged) | (unchanged) | **Blocked** (unchanged) | Legacy bucket (1 object per audit). No active app code references. **Confirmed intended state: private.** No change to re-public. |

## Absolute rules (enforced by migration + code)

- Do **not** set `tickets` or `career-documents` public again.
- Do **not** add broad public upload/delete policies.
- Do **not** use `USING (true)` / `WITH CHECK (true)` for Storage write policies.

## Pre-migration vs post-migration

| Check | Pre-migration (current prod) | Post-migration (expected) |
|-------|------------------------------|---------------------------|
| `tickets` public GET fake path | 400 (bucket public but path missing) | 400 / not 200 for real legacy paths |
| `career-documents` public GET | 400 | not 200 for real paths |
| Anon upload `images` / `hero-images` | **200** (FAIL) | 403/400 |
| Anon delete `images` | **200** (FAIL) | 403/400 |
