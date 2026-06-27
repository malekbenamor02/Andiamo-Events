# 01 — Application Selections Fix (FIND-002)

## Problem

`useApplicationSelections.ts` queried `ambassador_application_selections` / `_items` via browser Supabase. Deny-all RLS returned empty data.

## Solution

Backend routes in `api/_lib/admin-data-routes.js` (permission: `applications:manage`):

| Method | Route |
|--------|-------|
| GET | `/api/admin/application-selections?include_archived=0\|1` |
| POST | `/api/admin/application-selections` `{ name }` |
| PATCH | `/api/admin/application-selections/:id` `{ name?, status? }` |
| GET | `/api/admin/application-selection-items?selection_id=` |
| POST | `/api/admin/application-selection-items` `{ selection_id, application_ids[] }` |
| POST | `/api/admin/application-selection-items/remove` bulk remove |
| DELETE | `/api/admin/application-selection-items/:applicationId?selection_id=` |

Server sets `created_by_*` / `added_by_*` from authenticated admin. Field allowlists enforced.

## Frontend

- `src/pages/admin/hooks/useApplicationSelections.ts` → `adminApi`
- `src/lib/adminApi.ts` — new methods
- `src/lib/api-routes.ts` — route constants
- `ApplicationsTab.tsx` / `ApplicationSelectionsPanel.tsx` — removed client admin-id params

## Verification

- Grep: **no** `ambassador_application_selection` in `src/`
- Build: **PASS**
- Production API: **pending Vercel deploy**

## RLS

**Not reopened.** Tables remain deny-all.
