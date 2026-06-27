# Code Search Proof

## No getPublicUrl in ticket generation (api/)

```
git grep getPublicUrl api/
# (no matches after remediation)
```

## No client career-documents bucket access (src/)

```
git grep "from('career-documents')" src/
# (no matches)
```

## No direct anon admin media upload (src/lib/upload.ts)

Uses `/api/admin/media/upload` via `adminMediaUpload.ts`.

## Service role not in frontend bundle

Only error-scrubbing references in `internalErrorPatterns.ts`, tests, admin UI env hints.

## New routes

- `/api/tickets/qr/:secureToken`
- `/api/careers/upload-document`
- `/api/admin/media/upload`
- `/api/admin/media/delete`
