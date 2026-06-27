# Final storage incident status

**Incident:** Public Supabase Storage exposure (tickets QR PNGs, career documents, anon write on marketing buckets)  
**Status:** **CONTAINED** (migration applied; automated verification green)  
**Closure:** **Pending owner manual smoke + pentester retest**

## Timeline

| Phase | Status |
|-------|--------|
| Audit | Complete (`security-audit-supabase-storage-2026-06-27/`) |
| Code remediation | Deployed (`92623c8` on `security/fix-supabase-storage-exposure`) |
| Pre-migration route gates | Pass |
| Storage migration | Applied 2026-06-27 via MCP |
| Post-migration `security:storage` | **13 PASS / 0 FAIL** (exit 0) |
| Automated smoke tests | Pass |

## Containment achieved

- `tickets` and `career-documents` buckets are **private**
- Anon upload/delete on sensitive and marketing buckets **blocked**
- Legacy public Storage GET paths return **400**, not 200
- New ticket QR access via **`/api/tickets/qr/:token`** (backend validation)
- Career uploads via **backend API** + admin **signed URLs**
- Admin media via **authenticated backend API**
- **No storage objects deleted** (1551 objects in tickets+career-documents retained)
- **No unsafe policies reintroduced** (no anon upload/delete, no `USING(true)` write policies)
- **Database RLS unchanged** by this migration

## Remaining risks

| ID | Severity | Item |
|----|----------|------|
| R-01 | Low | PITR not enabled on project plan — only WAL-G daily backups |
| R-02 | Low | ~1,431 legacy ticket PNGs remain in private bucket (orphan storage cost) |
| R-03 | Low | Old emails may cache legacy public QR image URLs until expiry |
| R-04 | Info | Manual admin upload / career signed URL / scanner E2E not automated in this run |
| R-05 | Info | `events` bucket (1 legacy object) — review when convenient |

## Pentester retest recommendation

**Yes — Storage can be retested now.**

Suggested retest scope:

1. Anon cannot read real ticket QR or career document via public Storage URL
2. Anon cannot upload/delete to `tickets`, `career-documents`, `images`, `hero-images`
3. `GET /api/tickets/qr/{valid-token}` works for legitimate tickets only
4. Career upload requires backend; admin view requires auth + signed URL
5. Admin media upload requires cookie; public images still render
6. Confirm no `service_role` key in frontend bundle
7. Confirm database RLS posture unchanged (separate from Storage)

## Unsafe rollback

Do **not** set `tickets` or `career-documents` public without explicit owner acceptance of re-exposure risk.
