# Marketing media (`images` / `hero-images`) review

## Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| `images` / `hero-images` public read only | **PASS** (post-migration) | Migration keeps `public = true`; drops anon upload/delete policies; service-role-only write policies |
| Anon upload/delete/list blocked or restricted | **PASS** (post-migration) | Pre-migration: anon upload **200** on both buckets, anon delete images **200** — **FAIL until migration**. Anon list returns 200 with empty/minimal data (review only). |
| Admin upload/delete through backend | **PASS** | `POST /api/admin/media/upload`, `POST /api/admin/media/delete` with `requireAdminAuth`; frontend `src/lib/adminMediaUpload.ts` + `src/lib/upload.ts` |
| MIME / type / size validation | **PASS** | Multer 25 MB limit; `shouldEncodeToWebpAvif` pipeline; bucket `allowed_mime_types` in migration; `IMAGE_FOLDERS` allowlist for `images` scope |
| No arbitrary bucket/path delete | **PASS** | Delete handler: `ALLOWED_BUCKETS = {'images','hero-images'}`; rejects `..` in path; no user-controlled bucket outside allowlist |

## Upload scopes

| Scope | Bucket | Path pattern | Auth |
|-------|--------|--------------|------|
| `images` + folder | `images` | `{folder}/{timestamp}_{rand}…` | Admin cookie |
| `hero` | `hero-images` | `hero/{timestamp}_{rand}…` | Admin cookie |
| `favicon` | `images` (or R2) | `favicon/{type}_{timestamp}…` | Admin cookie |

R2 path used when `isR2MediaEnabled()`; Supabase fallback uses service role via `getServiceDb()`.

## Minor residual

- `src/lib/favicon.ts` has Supabase anon fallback `remove()` when admin cleanup API returns 404/R2_DISABLED — will fail after migration (low impact; primary path uses `/api/media/favicon/cleanup` with service role).
