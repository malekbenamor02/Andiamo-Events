# Ambassador Email Sync Fix Report

## 1. Summary

Fixed the stale email (and related profile fields) in the Ambassador Applications tab after editing an approved ambassador in the Ambassadors tab. The existing `PATCH /api/admin/ambassadors/:id` handler now syncs selected profile fields to the linked approved `ambassador_applications` row on the server, using the ambassador’s **current phone** to find the application before any phone change. Email and phone updates are pre-validated against pending/approved application uniqueness so the ambassador row is not updated when the linked application sync would conflict.

## 2. Files Changed

| File | Why |
| ---- | --- |
| `api/_lib/admin-data-route-helpers.js` | Added sync helpers: patch builder, linked-application lookup, conflict validation, unique-violation detection |
| `api/_lib/admin-data-routes.js` | Extended `PATCH /api/admin/ambassadors/:id` with pre-fetch, conflict checks, application update, extended audit details |
| `api/_lib/admin-ambassador-application-sync.test.cjs` | Automated unit tests for sync helpers and conflict validation |
| `docs/ambassador-email-sync-fix-report.md` | This report |

No frontend changes were required (`fetchAllData()` already reloads bootstrap after save).

## 3. Backend Behavior

On `PATCH /api/admin/ambassadors/:id`:

1. Existing auth (`ambassadors:manage`), allowlist, and `buildAmbassadorWritePayload()` normalization unchanged.
2. Current ambassador row loaded by id (`phone`, `email`, `full_name`, `city`, `ville`).
3. Sync patch built from update payload fields only:

   | Ambassador field | Application field |
   | ---------------- | ----------------- |
   | `full_name` | `full_name` |
   | `phone` | `phone_number` |
   | `email` | `email` |
   | `city` | `city` |
   | `ville` | `ville` |

4. Linked application: latest `ambassador_applications` row with `status = 'approved'` and `phone_number = currentAmbassador.phone` (ordered by `created_at` desc, limit 1).
5. If linked application exists and sync fields present → conflict pre-check on email/phone (pending + approved, excluding linked id).
6. `ambassadors` row updated (password hashing, session revocation unchanged).
7. If linked application exists → `ambassador_applications` updated with sync patch + `updated_at`.
8. Audit log `ambassador.updated` extended with `syncedApplicationId` / `syncedApplicationFields`, or `applicationSyncSkipped: true` when no linked approved application was found but sync fields were requested.

Not synced: `status`, password, `requires_password_change`, `extra_villes`, `approved_by`, `approved_at`, `age`, `social_link`.

## 4. Data Integrity

- **Email**: normalized to lowercase (via existing `buildAmbassadorWritePayload`); conflict query checks `pending` and `approved` applications, excluding the linked application id.
- **Phone**: normalized to digits-only; same conflict rules on `phone_number`.
- **Pre-validation**: conflicts return `400` via `jsonBadRequest` **before** the ambassador update runs.
- **Post-update unique violations**: if the application update still hits a Postgres unique constraint (`23505` or duplicate-key message), returns `400` with a generic safe message (ambassador may already be updated — see Remaining Risks).
- **No linked application**: ambassador update succeeds; audit records `applicationSyncSkipped: true` when sync-relevant fields were in the payload.

## 5. Security

- **Auth**: unchanged `requireAdmin()` + JWT cookie verification.
- **Permission**: unchanged `ambassadors:manage`.
- **Service role**: unchanged service-role Supabase client for both tables.
- **Allowlist**: unchanged request body allowlist; no new client-facing application PATCH route.
- **Audit**: `ambassador.updated` still written; adds sync metadata only (no password, hash, or token data).
- **Errors**: conflict and unique-violation responses use generic user-facing messages; detailed errors logged server-side only.

## 6. Tests

**Command run:**

```bash
node --test api/_lib/admin-ambassador-application-sync.test.cjs
```

**Cases covered:**

1. Sync patch maps email, phone, full_name, city, ville; excludes password/status/extra_villes.
2. Partial updates (email-only) produce partial sync patch.
3. Password-only update → empty sync patch.
4. Unique violation helper detects Postgres constraint errors.
5. Linked application lookup by approved phone (mock db).
6. Email conflict blocks sync (mock db).
7. Phone conflict blocks sync (mock db).
8. Same contact on linked row allowed when updating other fields.

Full HTTP integration tests for `handleAdminDataRoutes` were not added (no existing harness for that module). Manual verification steps below apply for end-to-end confirmation.

## 7. Manual Verification

Required checks (not run in this session — perform in admin UI against staging/production):

1. Open Admin Dashboard → Ambassadors tab.
2. Edit an approved ambassador email → Save.
3. Confirm Ambassadors tab shows new email.
4. Open Ambassador Applications tab → matching approved application shows same email.
5. Hard refresh → both tabs still match after bootstrap reload.
6. Repeat for phone, full_name, city, ville.
7. Attempt email/phone that belongs to another pending/approved application → expect clean 400 error, ambassador unchanged.
8. Password-only update → ambassador password changes, application email unchanged.

## 8. Remaining Risks

- **Non-atomic two-table update**: ambassador is updated first, then application. Pre-validation prevents most failures; a rare race or unexpected DB constraint could leave ambassador updated while application sync fails (API returns 400/500 with explicit message). No DB transaction/RPC was added per scope constraints.
- **Multiple approved applications per phone**: only the latest by `created_at` is synced; older rows are untouched (matches existing edit-dialog behavior).
- **Ambassador with no approved application**: profile changes apply to `ambassadors` only; Applications tab unaffected (`applicationSyncSkipped` in audit).

## 9. Rollback

1. Revert changes to `api/_lib/admin-data-routes.js` and `api/_lib/admin-data-route-helpers.js` (remove sync block in PATCH handler and helper exports).
2. Delete `api/_lib/admin-ambassador-application-sync.test.cjs` if rolling back tests.
3. Redeploy API (`api/misc.js` delegates to `admin-data-routes.js`; no migration to reverse).
4. Optionally re-align any rows that were synced during the fix window by manual admin edit or one-off SQL if needed.
