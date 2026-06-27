# Post-migration bucket state

Queried via Supabase SQL after `fix_storage_bucket_security` migration.

## Buckets

| id | public | file_size_limit | allowed_mime_types (summary) |
|----|--------|-----------------|------------------------------|
| academy-payment-proofs | false | 5242880 (5 MB) | jpeg, png, pdf |
| career-documents | false | 10485760 (10 MB) | pdf, doc/docx, jpeg, png |
| events | false | null | null |
| hero-images | **true** | 26214400 (25 MB) | images + mp4/webm |
| images | **true** | 26214400 (25 MB) | images + mp4/webm |
| tickets | false | 1048576 (1 MB) | image/png |

## Storage policies (storage.objects)

| policyname | cmd | scope |
|------------|-----|-------|
| Service role can upload ticket QR codes | INSERT | tickets + service_role |
| Service role can update ticket QR codes | UPDATE | tickets + service_role |
| Service role can delete ticket QR codes | DELETE | tickets + service_role |
| Service role manage career documents | ALL | career-documents + service_role |
| Service role manage academy payment proofs | ALL | academy-payment-proofs + service_role |
| Service role manage marketing images | ALL | images + service_role |
| Service role manage hero images | ALL | hero-images + service_role |

**Absent (removed):** `Allow all operations for images`, `Public can upload/delete images`, `Public can upload/delete hero images`, `Public can upload career documents`, `Public can view career documents`, `Public can view ticket QR codes`.

## Object inventory (no deletes)

`SELECT COUNT(*) FROM storage.objects WHERE bucket_id IN ('tickets','career-documents')` → **1551** objects retained.
