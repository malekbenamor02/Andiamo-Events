# Bucket Configuration (post-migration)

| Bucket | public | file_size_limit | allowed_mime_types |
|--------|--------|-----------------|-------------------|
| tickets | **false** | 1 MB | image/png |
| career-documents | **false** | 10 MB | pdf, doc, docx, jpeg, png |
| academy-payment-proofs | **false** | 5 MB | jpeg, png, pdf |
| events | **false** | (unchanged) | (unchanged) |
| images | **true** | 25 MB | jpeg, png, webp, gif, avif, mp4, webm |
| hero-images | **true** | 25 MB | jpeg, png, webp, gif, avif, mp4, webm |

Anon/authenticated write policies: **none** on any bucket after migration.

Service role: ALL on tickets (legacy objects), career-documents, academy-payment-proofs, images, hero-images.
