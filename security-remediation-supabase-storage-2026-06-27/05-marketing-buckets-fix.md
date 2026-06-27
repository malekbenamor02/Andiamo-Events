# Marketing Buckets Fix (STG-003–005)

## Problem

- `images`: policy `Allow all operations for images` (ALL / public)
- Anon upload + delete verified in audit
- Admin Dashboard used browser Supabase client directly

## Solution

### Code

- `src/lib/adminMediaUpload.ts` — authenticated API client
- `src/lib/upload.ts` — calls `/api/admin/media/upload` and `/api/admin/media/delete`
- `src/lib/favicon.ts` — fallback uses admin media API (not anon storage)
- `api/_lib/register-storage-security-routes.cjs` — service role Supabase upload when R2 disabled; R2 path unchanged
- `server.cjs` / `api/media.js` — register storage security routes

### Migration (post-deploy)

Drops all anon INSERT/DELETE policies on `images`, `hero-images`, `career-documents`.

Adds service-role-only ALL policies for admin server uploads on `images` and `hero-images`.

Public **read** remains via `public: true` bucket flag + direct CDN URLs for marketing assets.

## Routes

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/admin/media/upload` | Admin |
| POST | `/api/media/upload` | Admin (alias) |
| POST | `/api/admin/media/delete` | Admin |
| POST | `/api/media/delete` | Admin (alias) |
| POST | `/api/media/favicon/cleanup` | Admin |

Scopes: `images` (folder whitelist), `hero`, `favicon`.
