# Production Deployment Plan

## Preconditions

- [ ] Code merged and deployed to Vercel (production).
- [ ] Verify live routes:
  - `GET /api/tickets/qr/{valid-uuid}` → 404 or 200 (not 500)
  - `POST /api/careers/upload-document` → 400 without file (not 404)
  - `POST /api/admin/media/upload` → 401 without admin cookie

## Step 1 — Deploy code

Deploy branch `security/fix-supabase-storage-exposure` without running migration.

## Step 2 — Smoke test (pre-migration)

- [ ] Admin login → upload poster in Dashboard (uses admin API)
- [ ] Career application with document upload
- [ ] Generate test order QR → email shows API URL domain

## Step 3 — Apply migration

Run `supabase/migrations/20260627140000_fix_storage_bucket_security.sql` in Supabase SQL editor (production).

**Do not** set buckets public again if something breaks.

## Step 4 — Post-migration verification

```bash
npm run security:storage
```

Expect: anon upload/delete → 403/400; ticket/career public GET → not 200.

## Step 5 — Product smoke tests

See `09-manual-smoke-tests.md`.

## Rollback / fix-forward

| Issue | Action |
|-------|--------|
| Admin upload fails | Check `SUPABASE_SERVICE_ROLE_KEY` on Vercel; check service role policies exist |
| Ticket email QR broken | Confirm API route live; token in URL must be UUID |
| Career admin can't view doc | Check signed URL generation; careers:manage permission |
| **Do not** re-public `tickets` or `career-documents` without explicit owner acceptance |

## PITR

Confirm Supabase PITR enabled before migration (Dashboard → Database → Backups). Migration is metadata-only (no object deletes).
