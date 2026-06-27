# 08 — Frontend Storage Review

---

## Supabase client configuration

**File:** `src/integrations/supabase/client.ts`

| Check | Result |
|-------|--------|
| Publishable/anon key in frontend | **Yes** — `VITE_SUPABASE_ANON_KEY` (expected) |
| Service role key in frontend | **Not found** |
| `SUPABASE_SERVICE_ROLE` in `src/**` | Only error-message scrubbing patterns / admin UI hints — **not a key** |

**Verdict:** **Pass** — no service role exposure in source.

---

## Direct storage access from browser

| Module | Operations | Buckets | Auth model |
|--------|------------|---------|------------|
| `src/lib/upload.ts` | upload, getPublicUrl, remove | images, hero-images, career-documents | Anon key only |
| `src/lib/favicon.ts` | list, upload, remove, getPublicUrl | images (fallback) | Anon key; prefers admin `/api/media/*` |
| `src/integrations/supabase/client.ts` | Client export | All (RLS-gated) | Anon key |

**No `createSignedUrl` in frontend.**

---

## `getPublicUrl` usage

| File | Bucket | Appropriate? |
|------|--------|--------------|
| `upload.ts` | images, hero-images | **Yes** (public marketing assets) |
| `upload.ts` | career-documents | **No** — private applicant data |
| `favicon.ts` | images | **Yes** |

---

## Private bucket names in client

Bucket names (`images`, `tickets`, etc.) appear in code — **informational only**, not a vulnerability by itself.

---

## Sensitive paths/tokens in frontend JS

| Item | Exposed? |
|------|----------|
| Ticket `secure_token` in bundle | **No** — server-generated |
| QR URLs in static JS | **No** — loaded from API/DB at runtime |
| Career document URLs | Stored in form state after upload — **not hardcoded** |
| Admin proof signed URLs | Returned from API at runtime to authenticated admin |

**Build/dist scan:** No `SERVICE_ROLE` matches in `dist/**` (grep).

---

## Admin dashboard storage pattern

`src/pages/admin/Dashboard.tsx` imports `uploadImage`, `uploadHeroImage` from `@/lib/upload` — **direct Supabase storage from browser** after admin UI login.

**Gap:** Application admin auth ≠ Supabase storage auth. Any party with anon key can replicate uploads (verified in `03-anon-access-tests.md`).

---

## R2 public assets

When `VITE_PUBLIC_ASSETS_BASE_URL` is set, image helpers may point to Cloudflare R2 CDN for delivery — separate from Supabase storage but same public-read model for media.

Ticket QRs on R2 remain **public CDN URLs** (`r2-media.cjs`).

---

## Frontend verdict

| Check | Status |
|-------|--------|
| Anon key only in client | **OK** |
| Service role not in bundle | **OK** |
| getPublicUrl not used for academy proofs | **OK** |
| getPublicUrl used for career documents | **FAIL** |
| Client-side upload to open buckets | **FAIL** (storage RLS) |

---

## Recommended architecture (by asset type)

| Asset | Current | Target |
|-------|---------|--------|
| Marketing images | Client → Supabase anon | Admin API → R2 or authenticated storage |
| Career docs | Client → public Supabase | Server upload → private bucket → admin signed URL |
| Ticket QRs | Server → public URL | Private bucket + email inline CID or short signed URL |
| Academy proofs | Server → private + signed | Keep |
