# Final production deployment plan — Supabase Storage remediation

**Order: code first → verify routes → migration second. Fix forward only.**

## Phase 0 — Preconditions (STOP if any fail)

- [ ] Branch `security/fix-supabase-storage-exposure` reviewed and merged (or deploy from branch).
- [ ] Supabase **PITR / backups** confirmed (Dashboard → Database → Backups).
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in **Vercel Production** (not exposed to client).
- [ ] Stakeholders informed: old public ticket/career Storage URLs will stop working after migration.

## Phase 1 — Deploy code (no migration)

1. Deploy to Vercel production **without** running `20260627140000_fix_storage_bucket_security.sql`.
2. Confirm deployment succeeded (Vercel dashboard).
3. Run checks in `10-pre-migration-route-checks.md`:
   - `GET /api/tickets/qr/{uuid}` → 404 or 200, **not 500**
   - `POST /api/careers/upload-document` (no file) → **400**
   - `POST /api/admin/media/upload` (no cookie) → **401**
4. Product smoke (pre-migration):
   - Admin login → upload image in Dashboard
   - Career application with PDF upload
   - Create test ticket → QR URL uses site API path

**Gate:** If routes return 500 or 404 for new endpoints → **stop**, fix deploy, do not migrate.

## Phase 2 — Apply storage migration

1. Open Supabase SQL editor (production project `ykeryyraxmtjunnotoep`).
2. Run `supabase/migrations/20260627140000_fix_storage_bucket_security.sql` (copy in `02-storage-migration.sql`).
3. Verify buckets:
   - `tickets`, `career-documents` → `public = false`
   - `images`, `hero-images` → `public = true`
4. **Do not** re-public `tickets` or `career-documents` if something breaks.
5. **Do not** delete production objects as rollback.

## Phase 3 — Post-migration verification

```bash
npm run security:storage
```

**Expected:** 0 failures; anon upload/delete blocked on sensitive + marketing buckets.

### Security spot checks

- Anon GET old real ticket QR public URL → **not 200**
- Anon GET career document public URL → **not 200**
- Anon upload/delete on `images` / `hero-images` → fail

### Functional smoke

- Ticket QR via `/api/tickets/qr/:token` still works
- Scanner app still validates tokens
- Career upload + admin signed URL view works
- Admin media upload/delete works
- Public site images / hero still render

## Rollback / fix-forward

| Symptom | Action |
|---------|--------|
| Admin upload 503 | Verify `SUPABASE_SERVICE_ROLE_KEY`; confirm service-role storage policies exist |
| Ticket QR 404 for valid ticket | Confirm service DB lookup; token must be UUID in `tickets` / `qr_tickets` |
| Career admin can't view doc | Check `careers:manage` permission; signed URL TTL 900s |
| Anon can still upload | Re-run migration; inspect `storage.objects` policies in Supabase |
| **Never** | Set `tickets` or `career-documents` public again without explicit owner sign-off |

## Evidence index

| File | Purpose |
|------|---------|
| `01-git-diff-stat.txt` | Change scope |
| `02-storage-migration.sql` | SQL to apply |
| `03-create-drop-policy-check.md` | Idempotent policy pairing |
| `04-bucket-public-private-final.md` | Target bucket matrix |
| `05`–`07` | Code review sign-offs |
| `08-storage-regression-script.md` | `npm run security:storage` |
| `09-build-output.txt` | Build proof |
| `10-pre-migration-route-checks.md` | Deploy gate HTTP tests |
| `12-risk-register.md` | Residual risks |
