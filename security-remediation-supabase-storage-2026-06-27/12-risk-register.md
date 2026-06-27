# Risk register — remaining items and owner actions

| ID | Severity | Risk | Owner action | Status |
|----|----------|------|--------------|--------|
| R-01 | **Blocker** | Code not deployed to production | Deploy branch; complete `10-pre-migration-route-checks.md` | Open |
| R-02 | **Blocker** | Storage migration not applied; anon upload/delete still succeeds on marketing/career buckets | Apply migration only after R-01 passes | Open |
| R-03 | **Blocker** | `npm run security:storage` fails (4 pre-migration FAILs) | Re-run after migration; must exit 0 | Open |
| R-04 | High | `SUPABASE_SERVICE_ROLE_KEY` not verified on Vercel Production | Owner: confirm env var before deploy smoke | Unverified |
| R-05 | High | PITR/backups not confirmed | Owner: Supabase Dashboard → Backups before migration | Unverified |
| R-06 | Medium | Legacy ticket public URLs in old emails / cached images | Expected breakage after migration; API route is replacement | Accept / monitor |
| R-07 | Medium | ~1,431 legacy QR PNGs in `tickets` bucket | Orphan storage; optional service-role cleanup later | Deferred |
| R-08 | Medium | Mixed git diff includes non-storage admin RLS work | Deploy only storage-reviewed files or split PR | Review |
| R-09 | Low | `events` bucket (1 legacy object) | Inventory; delete if confirmed unused | Deferred |
| R-10 | Low | Audit test `.txt` objects in `career-documents` / `hero-images` | Delete via service role during maintenance | Deferred |
| R-11 | Low | Favicon anon Supabase fallback in `src/lib/favicon.ts` | Remove fallback or route through admin API only | Deferred |
| R-12 | Low | Ticket QR rate limit 60/min/IP | Monitor scanner + email prefetch; tune if 429s | Monitor |
| R-13 | Info | Untracked new files not yet committed | Stage + commit storage remediation before deploy | Open |

## Production approval

| Criterion | Approved? |
|-----------|-----------|
| Evidence package complete | **Yes** |
| Code ready in repo | **Yes** |
| Production deploy + migration | **No** — blocked on R-01, R-04, R-05 |

**Verdict: NOT approved for production migration** until code deploy gates pass and owner confirms env/backups.
