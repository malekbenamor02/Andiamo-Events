# 04 — Admin Flow Smoke Tests

## Completed without credentials

| Check | Expected | Actual | Pass |
|-------|----------|--------|------|
| `/api/verify-admin` no cookie | 401 | 401 | ✅ |
| `/api/admin/dashboard/bootstrap` no cookie | 401 | 401 | ✅ |
| Frontend bcrypt usage | None in `src/` | No matches | ✅ |
| `hashedPassword` client rejection | Server rejects | `misc.js` rejects `hashedPassword` / bcrypt-shaped password | ✅ |
| Admin list column projection | No password in ambassador list cols | Explicit column list excludes password | ✅ (code) |

## Not tested (requires approved test admin accounts)

| Flow | Reason |
|------|--------|
| Admin login | No credentials in validation session |
| Dashboard load after login | — |
| Orders / tickets / ambassadors tabs | — |
| Restricted admin 403 on `/api/admin/sms-logs` etc. | — |
| Super admin full access | — |
| Applications tab + draft selections | **Likely broken** — see FIND-002 |
| Logs tab permission gating | — |
| Session invalidation after JWT rotation | Rotation not confirmed in this session |

## Code observation — application selections

`src/pages/admin/hooks/useApplicationSelections.ts` still uses browser Supabase against `ambassador_application_selections` / `_items`. Post-migration deny-all RLS returns empty data. **Fix forward:** route through admin API + service role (do not reopen RLS).
