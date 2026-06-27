# Career Documents Fix (STG-002)

## Old flow

1. Browser uploads via anon Supabase client → **public** `career-documents` bucket.
2. Public URL stored in `form_data[field_key]`.
3. Admin opens direct URL in Career tab.

## New flow

### Public upload

- `POST /api/careers/upload-document` (multipart, no auth)
- Service role upload to **private** `career-documents`
- Path: `{uuid}/{random}{ext}` — no user-controlled path segments
- Validation: PDF/DOC/DOCX/JPEG/PNG, max 10 MB
- Response: `storageRef` = `storage:career-documents/{path}|{originalName}`
- Careers form stores `storageRef` in form field (not a URL)

### Admin view

- `GET /api/admin/careers/applications/:id` enriches `file_signed_urls` (15 min)
- Optional: `GET .../document-url?field=` for single field
- CareerTab download links use signed URLs

## Files changed

- `api/_lib/career-document-storage.cjs` (new)
- `api/_lib/register-storage-security-routes.cjs`
- `careerRoutes.cjs` — signed URLs on application detail
- `src/lib/career/api.ts` — `uploadCareerDocument`
- `src/pages/Careers.tsx`
- `src/pages/admin/components/CareerTab.tsx`
- Removed client upload from `src/lib/upload.ts`

## Legacy applications

Form values that are still full `https://...career-documents/...` URLs are resolved server-side for signed URL generation (path extracted, not content downloaded in audit).
