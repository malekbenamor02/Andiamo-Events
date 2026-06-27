# Production storage migration result

**Project:** `ykeryyraxmtjunnotoep` (West EU Paris)  
**Migration:** `20260627140000_fix_storage_bucket_security.sql`  
**Applied:** 2026-06-27 (via Supabase MCP `apply_migration`, name `fix_storage_bucket_security`)  
**Result:** **SUCCESS**

## Phase 1 — Backup / PITR gate

| Check | Result |
|-------|--------|
| Backup available (WAL-G) | **Yes** (`walg_enabled: true`) |
| PITR available | **No** (`pitr_enabled: false`) |
| Region | `eu-west-3` |
| Confirmation method | `supabase backups list` (linked project CLI) |
| Confirmed by | Automated agent pre-migration gate |

**Note:** Daily physical backups (WAL-G) are enabled. Point-in-time recovery is **not** on this plan. Migration is metadata-only (bucket flags + RLS policies); no object deletes. Owner may enable PITR on a future plan upgrade.

## Phase 2 — Migration apply

| Item | Status |
|------|--------|
| Method | Supabase MCP `apply_migration` |
| SQL file | `supabase/migrations/20260627140000_fix_storage_bucket_security.sql` |
| Errors | None |
| Objects deleted | **No** (pre: exposed buckets; post object count in tickets+career-documents: **1551**) |
| Buckets re-publicized | **No** |

## Post-migration bucket summary

| Bucket | public | file_size_limit |
|--------|--------|-----------------|
| tickets | **false** | 1 MB |
| career-documents | **false** | 10 MB |
| images | **true** | 25 MB |
| hero-images | **true** | 25 MB |
| academy-payment-proofs | **false** | 5 MB |
| events | **false** | (unchanged) |

## Post-migration policies (storage.objects)

Only service-role-scoped policies remain:

- Service role can upload/update/delete ticket QR codes
- Service role manage career documents
- Service role manage academy payment proofs
- Service role manage marketing images
- Service role manage hero images

Dangerous anon policies (`Allow all operations for images`, public upload/delete on images/hero/career) **removed**.

## Deployed code prerequisite

Production routes verified before migration (commit `92623c8`):

- `GET /api/tickets/qr/{uuid}` → 404
- `POST /api/careers/upload-document` (no file) → 400
- `POST /api/admin/media/upload` (no cookie) → 401
