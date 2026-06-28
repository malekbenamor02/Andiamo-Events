# Ambassador Email Sync Context Report

## 1. Executive Summary

The admin dashboard treats **ambassador applications** and **approved ambassadors** as two separate data sources backed by two Postgres tables: `ambassador_applications` and `ambassadors`. The Ambassador Applications tab displays `ambassador_applications.email`. The Ambassadors tab displays and edits `ambassadors.email`. When an admin saves an ambassador edit, the backend updates only the `ambassadors` row (`PATCH /api/admin/ambassadors/:id`). There is no code path that writes the new email back to `ambassador_applications`, and after save the dashboard reloads applications from that table via bootstrap. The email therefore stays stale in the Applications tab.

## 2. Files Found

| File | Purpose | Relevant details |
| ---- | ------- | ---------------- |
| `src/pages/admin/Dashboard.tsx` | Admin dashboard shell; owns `applications` and `ambassadors` state | Loads both lists via `adminApi.fetchDashboardBootstrap()`; `handleSaveAmbassador` calls `adminApi.updateAmbassador`; `handleApprove` calls `adminApi.updateApplication`; comment at line 1565: ambassador applications realtime removed |
| `src/pages/admin/components/ApplicationsTab.tsx` | Ambassador Applications tab wrapper | Sub-views: “All applications” and “Draft selections”; passes `applications` state to list component |
| `src/pages/admin/components/applications/ApplicationsListCore.tsx` | Applications table UI | Renders `application.email` from `ambassador_applications` data; matches ambassadors by phone or email for ville fallback |
| `src/pages/admin/components/AmbassadorsTab.tsx` | Ambassadors tab UI | Lists `ambassadors`; edit opens dialog; on edit, fetches applications to populate `age` / `social_link`; displays `ambassador.email` |
| `src/pages/admin/components/EditAmbassadorForm.tsx` | Ambassador edit form fields | Binds email to `ambassador.email` in local edit state |
| `src/pages/admin/types.ts` | TS types | `AmbassadorApplication.email`; `Ambassador.email`; comment that `age` / `social_link` live on applications |
| `src/pages/admin/lib/filterApplications.ts` | Application list filtering | Uses `ambassadorMap` (from ambassadors) only for ville filtering, not email |
| `src/lib/adminApi.ts` | Frontend admin HTTP client | `fetchDashboardBootstrap`, `listAmbassadors`, `updateAmbassador`, `listAmbassadorApplications`, `updateApplication` |
| `src/lib/api-routes.ts` | API route constants | `ADMIN_DASHBOARD_BOOTSTRAP`, `ADMIN_AMBASSADORS`, `ADMIN_AMBASSADOR(id)`, `ADMIN_AMBASSADOR_APPLICATIONS`, `ADMIN_UPDATE_APPLICATION` |
| `api/_lib/admin-data-routes.js` | Service-role admin CRUD | Bootstrap read; `GET/PATCH/DELETE /api/admin/ambassadors`; `GET /api/admin/ambassador-applications`; `provisionAmbassadorForApplication()` on approve |
| `api/_lib/admin-data-route-helpers.js` | Auth, allowlists, password hashing | `AMBASSADORS: 'ambassadors:manage'`, `APPLICATIONS: 'applications:manage'`; `buildAmbassadorWritePayload` normalizes email to lowercase |
| `api/_lib/admin-mutation-audit.js` | Admin mutation audit helper | Writes to `admin_logs` on ambassador create/update/delete |
| `api/misc.js` | Vercel serverless entry for many admin routes | Delegates to `handleAdminDataRoutes`; implements `POST /api/admin-update-application` with ambassador provisioning |
| `vercel.json` | Production rewrites | `/api/admin/*` ambassador routes and `/api/admin-update-application` → `api/misc.js` |
| `shared/admin/tabDefinitions.data.json` | Tab permissions | `ambassadors` → `ambassadors:manage`; `applications` → `applications:manage` |
| `supabase/migrations/20250716190755-03575ecb-f9ca-44ac-b573-a9f324e75073.sql` | Initial `ambassador_applications` schema | Original columns; no email column yet |
| `supabase/migrations/20250102000000-add-email-to-ambassador-applications.sql` | Adds application email | `ambassador_applications.email TEXT` + index |
| `supabase/migrations/20250718000000-create-ambassadors-table.sql` | Creates `ambassadors` table | `phone TEXT UNIQUE NOT NULL`, `email TEXT` (nullable, no unique constraint) |
| `supabase/migrations/20250203000000-add-suspended-status-to-applications.sql` | Application status + partial unique indexes | Partial unique on `phone_number` and `email` for `pending`/`approved` rows |
| `server.cjs` | Local Node server | Contains a simpler duplicate `POST /api/admin-update-application` without provisioning; **not** used on Vercel (see `vercel.json`) |

## 3. Ambassador Applications Tab Flow

**Component/file used**

- Tab: `src/pages/admin/components/ApplicationsTab.tsx`
- Table: `src/pages/admin/components/applications/ApplicationsListCore.tsx`
- Parent state: `src/pages/admin/Dashboard.tsx` (`applications`, `filteredApplications`)

**API endpoint called**

- Initial load (with rest of dashboard): `GET /api/admin/dashboard/bootstrap` via `adminApi.fetchDashboardBootstrap()`
- Bootstrap applications slice is also available standalone as `GET /api/admin/ambassador-applications` (`adminApi.listAmbassadorApplications()`), used by selections sub-features and ambassador edit dialog, but the tab’s primary list comes from bootstrap state in `Dashboard.tsx`

**Response shape (visible in code)**

Bootstrap returns:

```json
{
  "applications": [ /* rows from ambassador_applications */ ],
  "events": [ ... ],
  "ambassadors": [ ... ]
}
```

Standalone applications endpoint returns:

```json
{ "data": [ /* ambassador_applications rows, select * */ ] }
```

Selected columns in bootstrap (explicit allowlist):

`id, full_name, age, city, ville, social_link, phone_number, email, motivation, status, created_at, updated_at, reapply_delay_date, manually_added, reviewed_by_admin_id, reviewed_at, reviewed_by_name, meta_attribution, meta_lead_sent_at`

**Database table/source**

- `public.ambassador_applications` via service-role Supabase client in `api/_lib/admin-data-routes.js`

**Which email field is displayed**

- `application.email` — the `email` column on `ambassador_applications`

**Reads from application data or approved ambassador data?**

- Reads from **application data** (`applications` React state populated from `ambassador_applications`).
- For **ville** only, when the application row has no `ville`, the UI may show the matching ambassador’s `ville` as a fallback by matching `amb.phone === application.phone_number` or `amb.email === application.email` (`ApplicationsListCore.tsx`).

## 4. Ambassadors Tab Flow

**Component/file used**

- `src/pages/admin/components/AmbassadorsTab.tsx`
- Edit form: `src/pages/admin/components/EditAmbassadorForm.tsx`
- Save handler defined in parent: `Dashboard.tsx` → `handleSaveAmbassador`

**API endpoint called**

- List: `GET /api/admin/dashboard/bootstrap` (field `ambassadors`) or `GET /api/admin/ambassadors`
- On edit click: additionally `GET /api/admin/ambassador-applications` to load `age` and `social_link` from the matching approved application (matched by `phone_number`)
- On save: `PATCH /api/admin/ambassadors/:id` via `adminApi.updateAmbassador`

**Response shape (visible in code)**

Ambassadors list columns:

`id, full_name, phone, email, city, ville, extra_villes, status, approved_by, approved_at, created_at, updated_at, requires_password_change`

PATCH response:

```json
{
  "data": { /* updated ambassadors row */ },
  "temporaryPassword": "..." // optional, if password generated
}
```

**Database table/source**

- `public.ambassadors` via service-role client in `api/_lib/admin-data-routes.js`

**Which email field is displayed**

- `ambassador.email` from `ambassadors.email` (masked in table via `maskEmail()`)

**How edit form submits changes**

1. User clicks Edit → `AmbassadorsTab` fetches applications, merges `age` / `social_link` into local `editingAmbassador` state, opens dialog.
2. User edits fields including email in `EditAmbassadorForm`.
3. Save calls `onSaveAmbassador(ambassador)` → `Dashboard.handleSaveAmbassador`.
4. `handleSaveAmbassador` builds `updateData` with `full_name`, `phone`, `email`, `city`, `ville`, `extra_villes`, `status`, optional `password`.
5. Calls `adminApi.updateAmbassador(ambassador.id, updateData)`.
6. Calls `fetchAllData()` which reloads bootstrap (applications + ambassadors from DB).

Note: `age` and `social_link` shown in the edit form are **not** included in `updateData` and are **not** persisted to either table on save.

## 5. Ambassador Update Flow

**API route/function**

- `PATCH /api/admin/ambassadors/:id` in `api/_lib/admin-data-routes.js` (invoked through `api/misc.js` on Vercel)

**Validation done**

- Server-side allowlist via `rejectUnexpectedFields`: `full_name`, `phone`, `email`, `city`, `ville`, `extra_villes`, `status`, `requires_password_change`, `password`, `generatePassword`
- `buildAmbassadorWritePayload()` trims strings, strips non-digits from phone, lowercases email, validates password length / rejects bcrypt hashes from client
- Client-side in `handleSaveAmbassador`: age range, Instagram URL prefix, password length, city/ville rules

**Auth/permission check**

- `requireAdmin()` → JWT/cookie admin auth via `verifyAdminAuth`
- Permission: `ambassadors:manage` (`ADMIN_DATA_ROUTE_PERMISSIONS.AMBASSADORS`)
- Uses service-role Supabase client (`createServiceRoleClient`)

**Table updated**

- `public.ambassadors` only

**Columns updated (when present in PATCH body)**

- `full_name`, `phone`, `email`, `city`, `ville`, `extra_villes`, `status`, `requires_password_change`, `password` (hashed server-side), `updated_at`
- On approve status with admin id: may set `approved_by`, `approved_at`

**Whether application table is also updated**

- **No.** No `ambassador_applications` update in the PATCH handler.
- `handleSaveAmbassador` performs a **client-only** optimistic patch on `applications` state for `age`, `social_link`, and `ville` matched by `app.phone_number === ambassador.phone` — it does **not** include `email`, and this is overwritten immediately by `fetchAllData()`.

**Whether audit log is written**

- Yes. `writeAdminMutationAudit()` inserts into `admin_logs` with action `ambassador.updated`, `target_type: 'ambassador'`, `details: { fields: Object.keys(row), passwordChanged }`.

**Password side effect**

- If password changed: `revokeAllAmbassadorSessions()` from `api/_lib/ambassador-auth.cjs`.

## 6. Database / Schema Context

**Relevant table names**

- `public.ambassador_applications` — application / review records
- `public.ambassadors` — approved ambassador accounts (login, orders, admin management)
- `public.admin_logs` — admin mutation audit trail
- `public.ambassador_application_selections` / `public.ambassador_application_selection_items` — draft selection batches (not email-related)

**Relevant columns**

`ambassador_applications`:

- `id`, `full_name`, `age`, `city`, `ville`, `social_link`, `phone_number`, `email`, `motivation`, `status`, `created_at`, `updated_at`, `reapply_delay_date`, `manually_added`, `reviewed_by_admin_id`, `reviewed_at`, `reviewed_by_name`, `meta_attribution`, `meta_lead_sent_at` (latter columns referenced in bootstrap select)

`ambassadors`:

- `id`, `full_name`, `phone`, `email`, `city`, `ville`, `extra_villes`, `password`, `status`, `approved_by`, `approved_at`, `created_at`, `updated_at`, `requires_password_change` (last column referenced in API select; see Unknowns)

**Email columns**

- `ambassador_applications.email` — `TEXT`, nullable
- `ambassadors.email` — `TEXT`, nullable

**Relationship between application and ambassador records**

- **No foreign key** between `ambassador_applications` and `ambassadors` found in migrations.
- Application code links rows **logically by phone** (primary) and **email** (secondary), e.g. `findAmbassadorInList`, orphaned-count checks, ville fallback.
- On approval, `provisionAmbassadorForApplication()` in `admin-data-routes.js` upserts `ambassadors` matched by `phone` and copies `full_name`, `email`, `city`, `ville` from the application row.

**Foreign keys found**

- `orders.ambassador_id` → `ambassadors(id)` (in order-management migration)
- Not found: FK from `ambassador_applications` to `ambassadors`

**Unique constraints found**

- `ambassadors.phone` — `UNIQUE NOT NULL` (create table migration)
- `ambassador_applications` partial unique indexes (pending/approved only):
  - `idx_ambassador_applications_phone_unique` on `phone_number`
  - `idx_ambassador_applications_email_unique` on `email`
- `ambassadors.email` — **no unique constraint** in migrations reviewed

**RPC/trigger found that touches ambassador email**

- Not found in current codebase.

## 7. Confirmed Root Cause

Changing email in the Ambassadors tab updates **`ambassadors.email` only** via `PATCH /api/admin/ambassadors/:id` in `api/_lib/admin-data-routes.js`. The Ambassador Applications tab reads and displays **`ambassador_applications.email`** loaded from `GET /api/admin/dashboard/bootstrap` (or `GET /api/admin/ambassador-applications`). There is **no sync, update, trigger, or join write** that copies an ambassador email change back to the matching application row. After save, `fetchAllData()` reloads applications from `ambassador_applications`, so the Applications tab continues to show the old email.

The only built-in email copy direction in code is **application → ambassador** during approval (`provisionAmbassadorForApplication`), not the reverse.

## 8. Existing Security / Permission Behavior

**Admin auth check**

- All admin data routes use `requireAdmin()` → `verifyAdminAuth(req)` with HttpOnly `adminToken` JWT cookie.

**Permission checks**

- Ambassadors CRUD: `ambassadors:manage`
- Applications read / selections / approve-reject: `applications:manage`
- Tab access defined in `shared/admin/tabDefinitions.data.json` maps tabs to these permissions.

**Service role usage**

- Admin data routes use `createServiceRoleClient()` / `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS on private tables.
- `POST /api/admin-update-application` in `api/misc.js` also creates a service-role client.

**RLS-related code**

- Migration `20260627120000_fix_critical_rls_exposure.sql` sets `ambassador_applications_deny_all` (API-only access).
- Ambassadors table RLS hardened in same migration wave; admin access is through service-role API, not browser Supabase client.
- Comment in `Dashboard.tsx`: ambassador applications Supabase realtime removed; refresh via admin API bootstrap.

**Audit log**

- Ambassador create/update/delete writes to `admin_logs` via `writeAdminMutationAudit`.
- Application approve/reject sets `reviewed_by_admin_id`, `reviewed_at`, `reviewed_by_name` on the application row; separate `admin_logs` entry for application status change was **not found** in the approve handler reviewed.

## 9. Fix Options Based on Current Code

### Option A — Sync in `PATCH /api/admin/ambassadors/:id` (server-side)

**What would change**

- After updating `ambassadors`, also update matching `ambassador_applications` row(s) (typically match on `phone_number = ambassadors.phone`, optionally also prior email).
- Update at minimum `email`, and likely `full_name`, `city`, `ville` for consistency.

**Files likely affected**

- `api/_lib/admin-data-routes.js` (PATCH handler)
- Possibly `api/_lib/admin-data-route-helpers.js` for shared match/update helper
- Tests if they exist for admin data routes

**DB migration needed**

- No schema change required unless adding FK or trigger instead.

**Risk level**

- Medium — must handle partial unique index on `ambassador_applications.email` (conflict if new email already used by another pending/approved application); must define behavior when multiple application rows share a phone or when phone also changes.

**Recommendation**

- **Recommended** — Keeps both tabs consistent, matches existing approval-time copy pattern, single write path for admins.

---

### Option B — New admin endpoint to PATCH application rows; call from `handleSaveAmbassador`

**What would change**

- Add e.g. `PATCH /api/admin/ambassador-applications/:id` with allowlist including `email`.
- Frontend finds matching application by phone and calls it after ambassador PATCH.

**Files likely affected**

- `api/_lib/admin-data-routes.js`, `api/misc.js` routing (already delegated), `src/lib/adminApi.ts`, `src/lib/api-routes.ts`, `Dashboard.tsx`

**DB migration needed**

- No.

**Risk level**

- Medium — two API calls; race/consistency if one succeeds and one fails; frontend must reliably find correct application id.

**Recommendation**

- Acceptable but weaker than Option A (split transaction, duplicated matching logic).

---

### Option C — Display-only fix: Applications tab shows ambassador email for approved rows

**What would change**

- In `ApplicationsListCore.tsx`, for `status === 'approved'`, display email from matched `ambassadors` entry instead of `application.email`.

**Files likely affected**

- `ApplicationsListCore.tsx`, possibly export Excel helper

**DB migration needed**

- No.

**Risk level**

- Low for UI only, but data remains inconsistent in DB, exports, bulk email/SMS sources (`api/misc.js` marketing sources read `ambassador_applications.email`).

**Recommendation**

- **Not recommended** as sole fix — masks the underlying dual-source problem.

---

### Option D — Database trigger to mirror email changes

**What would change**

- Postgres trigger on `ambassadors` UPDATE OF `email` syncs to `ambassador_applications`.

**Files likely affected**

- New Supabase migration

**DB migration needed**

- Yes.

**Risk level**

- Medium-high — trigger logic must mirror app matching rules; harder to audit than explicit API code; unique index conflicts still apply.

**Recommendation**

- Only if team prefers DB-enforced sync over API layer; not present in codebase today.

---

### Option E — Consolidate to single source of truth (remove duplicate email storage)

**What would change**

- Stop storing email on one table or always join/view for reads.

**Files likely affected**

- Many: admin bootstrap, marketing bulk email sources, approval flow, types, both tabs

**DB migration needed**

- Likely yes (view or column deprecation).

**Risk level**

- High — large architectural change.

**Recommendation**

- Long-term direction only; out of scope for a minimal bug fix.

## 10. Recommended Direction

Implement **Option A**: extend `PATCH /api/admin/ambassadors/:id` in `api/_lib/admin-data-routes.js` to update the linked `ambassador_applications` row(s) when `email` (and related profile fields) change, using the same phone-based matching already used in `provisionAmbassadorForApplication` and throughout `Dashboard.tsx`. Handle unique-index conflicts explicitly (return 400 with clear error if the new email collides with another active application). Optionally extend the audit log `details` to note application sync. No schema migration required for the minimal email fix.

## 11. Unknowns

- **`ambassadors.requires_password_change` column**: Selected in admin API responses; no `ALTER TABLE ambassadors ADD requires_password_change` migration found under `supabase/migrations/` (column may exist in deployed DB from an uncommitted migration or manual change).
- **Whether `age` / `social_link` edits in the Ambassadors edit dialog are intended to persist**: Current save path does not send them to any API; any local state patch is replaced by `fetchAllData()`. Persistence behavior could not be confirmed from a write path.
- **Exact production behavior of `server.cjs` `POST /api/admin-update-application`**: A simpler handler exists locally without `provisionAmbassadorForApplication`; Vercel rewrites point to `api/misc.js`, which includes provisioning. Local dev routing depends on which server is run.
- **Which application row to update when multiple approved applications share the same phone**: Edit dialog picks the most recent approved application by `created_at`; PATCH sync should define the same rule explicitly (not codified server-side today for updates).
