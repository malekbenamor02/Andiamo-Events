# 11 — Fix Plan (DO NOT APPLY)

**Status:** Planning document only. No changes were made during this audit.

---

## Immediate containment (P0 — same day)

1. **`tickets` bucket**
   - [ ] Set bucket to **`public: false`** in Supabase Dashboard (or migration in staging first).
   - [ ] **Do not delete** existing objects until replacement URL strategy is live.
   - [ ] Disable new `getPublicUrl` writes in API; generate **signed URLs** at email/render time (≤900–3600s) OR embed QR as **email attachment/CID** without persistent public URL.
   - [ ] Update `qr_code_url` column strategy: store storage path only, not public URL.
   - [ ] If R2 is primary, make ticket prefix **private** on R2 and use signed URLs.

2. **`career-documents` bucket**
   - [ ] Set bucket to **`public: false`**.
   - [ ] Add server upload endpoint (mirror academy pattern) for career form.
   - [ ] Store **storage path** in application record, not public URL.
   - [ ] Admin review via signed URL (HR/admin auth).

3. **Audit artifact cleanup**
   - [ ] Delete `security-audit-test-*.txt` from `career-documents` and `hero-images` via service role.

---

## Short-term fixes (P1 — 1–2 weeks)

### Storage policies

```sql
-- EXAMPLE ONLY — review in staging before production

-- 1) Remove dangerous ALL policy
DROP POLICY IF EXISTS "Allow all operations for images" ON storage.objects;

-- 2) Remove anonymous DELETE
DROP POLICY IF EXISTS "Public can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete hero images" ON storage.objects;

-- 3) Remove anonymous INSERT on all buckets
DROP POLICY IF EXISTS "Public can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload hero images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload career documents" ON storage.objects;

-- 4) Optional: allow SELECT for authenticated admins only (if direct admin download needed)
-- CREATE POLICY ... FOR SELECT TO authenticated USING (bucket_id = 'images' AND <admin check>);
```

### Application changes

- [ ] Route **all** admin media uploads through `/api/media/upload` (expand R2 routes to cover all Dashboard flows).
- [ ] Remove direct `supabase.storage` usage from `upload.ts` for production admin paths.
- [ ] Career form: POST multipart to new `/api/careers/upload-document` (rate limit + MIME + virus scan hook).
- [ ] Set bucket `file_size_limit` (e.g. 10 MB images, 5 MB career, 512 KB favicon).
- [ ] Set `allowed_mime_types` per bucket.

### Ticket email flow

- [ ] Refactor Brevo templates to use **signed URLs** generated at send time.
- [ ] Ensure scanner app validates tokens via **`/api/scan`** only — not by obscurity.

---

## Long-term architecture

| Asset class | Target pattern |
|-------------|----------------|
| Public marketing | R2/Supabase **public read**, **server-only write** (admin API) |
| Ticket QRs | **Private** object store; optional no URL at all (generate QR bytes inline in email PDF) |
| Career / academy proofs | **Private** bucket; **signed URL** on admin view; server upload on submit |
| Exports/reports | Never storage public; temp signed URLs or streaming download |

### Migration sequence

1. Deploy API changes that accept storage paths (dual-read old URLs + new paths).
2. Flip buckets to private in staging; run regression (purchase, email, scan, careers, academy).
3. Production bucket flag change during low-traffic window.
4. Background job: rewrite `qr_code_url` / career URL fields to paths only.
5. Optional: re-upload ticket QRs to private keys (if URLs were widely leaked, **rotate ticket tokens** — business decision).

---

## Tests to add

- [ ] `scripts/security/storage-anon-spot-check.mjs` in CI against staging (expect 403 on all uploads).
- [ ] Assert no `getPublicUrl` for `tickets` or `career-documents` in codebase (lint rule).
- [ ] E2E: order → email → ticket URL requires auth or expires.
- [ ] E2E: career submit → anon GET public URL returns 404/403.

---

## Policy verification SQL (post-fix)

Reuse queries from database RLS audit:

```sql
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'storage' ORDER BY tablename, policyname;

SELECT name, public, file_size_limit, allowed_mime_types FROM storage.buckets ORDER BY name;
```

Expected post-fix:

- Zero `{public}` INSERT/DELETE/ALL policies on any bucket.
- `tickets`, `career-documents`, `academy-payment-proofs` → `public = false`.
