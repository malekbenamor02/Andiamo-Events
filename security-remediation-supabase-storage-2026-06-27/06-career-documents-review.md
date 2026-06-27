# Career documents review

## Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Browser no longer uploads directly to `career-documents` | **PASS** | `git grep "from('career-documents')" src/` — no matches; removed from `src/lib/upload.ts` |
| Career upload goes through backend | **PASS** | `POST /api/careers/upload-document` in `register-storage-security-routes.cjs`; frontend `uploadCareerDocument()` in `src/lib/career/api.ts` |
| Backend validates MIME / type / size | **PASS** | `validateCareerDocumentFile()` in `career-document-storage.cjs` — allowlist MIME + ext, max 10 MB, blocks `.html`, `.svg`, `.exe`, etc. |
| Backend generates safe random object path | **PASS** | `buildStoragePath()` → `{uuid}/{randomHex}{ext}`; rejects `..` in parsers |
| Admin document view requires permission | **PASS** | `requireAdminAuth` + `requireAdminPermission('careers:manage')` on application detail + `GET /api/admin/careers/applications/:id/document-url` |
| Admin signed URL expiry is short | **PASS** | `SIGNED_URL_TTL_SEC = 900` (15 min) in `career-document-storage.cjs` |
| No permanent public URL stored | **PASS** | Form stores `storage:career-documents/{path}|{originalName}` via `encodeStorageRef()`; not `getPublicUrl` |

## Data flow

1. Applicant selects file → `uploadCareerDocument()` → multipart POST to API.
2. Service role uploads to private bucket; API returns `storageRef`.
3. Application `form_data` stores ref string only.
4. Admin opens application → `file_signed_urls` populated server-side in `careerRoutes.cjs` via `signedUrlForFormValue()`.
5. Legacy public URLs parsed only for backward compatibility (`parseLegacyCareerPublicUrl`); new submissions use storage ref.

## Post-migration expectation

- Anon public GET to real career document URLs → **not 200**.
- Anon upload to `career-documents` → **403/400** (currently **200** pre-migration — expected FAIL until SQL applied).
