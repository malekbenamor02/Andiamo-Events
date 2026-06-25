# Admin tab access — implementation handover

## Migration

**File:** `supabase/migrations/20260625120000_admin_tab_access.sql`

**Table:** `public.admin_tab_access`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | `gen_random_uuid()` |
| `admin_id` | uuid FK → `admins(id)` ON DELETE CASCADE | |
| `tab_key` | text | Must match `tabDefinitions.data.json` |
| `show_in_mobile` | boolean | Bottom nav visibility |
| `mobile_order` | integer nullable | Ordering hint |
| `created_at` / `updated_at` | timestamptz | `updated_at` trigger |

**RPC:** `replace_admin_tab_access(p_admin_id uuid, p_rows jsonb)` — atomic delete + insert.

**RLS:** Deny all (service role via Node API only).

## Resolution rules

Implemented in `shared/admin/tabAccess.cjs` (`resolveAdminEffectiveAccess`):

1. **`super_admin`** — always all tabs, `permissions: ['*']`, global mobile defaults. Rows in `admin_tab_access` are ignored and cleared on save.
2. **No rows** — role defaults from `shared/admin/permissions.cjs` (unchanged legacy behavior).
3. **Explicit rows** — only listed tabs; permissions derived from each tab’s `requiredPermission`; mobile tabs from `show_in_mobile=true`.

## API changes

### `GET /api/verify-admin`

Adds `mobileTabs: string[]`.

### `GET /api/admin/admins`

Each admin includes:

```json
"tab_access": {
  "is_explicit": true,
  "allowed_tab_keys": ["overview", "events"],
  "mobile_tab_keys": ["overview"]
}
```

### `POST` / `PATCH /api/admin/admins`

Optional (super_admin only):

```json
{
  "allowed_tab_keys": ["overview", "events", "pos"],
  "mobile_tab_keys": ["overview", "pos"]
}
```

- `allowed_tab_keys: null` — clear explicit config (role defaults).
- Omit fields — no change to tab config.
- `[]` — explicit zero tabs.
- Sensitive tabs (`admins`, `settings`, `logs`) cannot be granted to `admin` role.

Audit: `admin.tab_access.updated` in `admin_logs` (server-side).

## Security

- Effective permissions computed on every `verifyAdminSession` from DB.
- `requireAdminPermission` uses `req.adminPermissions` + `hasEffectivePermission` (not role-only).
- Tab payload validated server-side; unknown/duplicate keys rejected.

## Backward compatibility

Existing admins have no `admin_tab_access` rows → same role-based tabs and permissions as before.

## Files changed

**New:** migration, `shared/admin/tabAccess.cjs`, `shared/admin/tabAccess.mjs`, `shared/admin/tabAccess.test.cjs`, `src/pages/admin/components/AdminTabAccessEditor.tsx`, this doc.

**Modified:** `permissions.cjs`, `permissions.mjs`, `admin-authorization.mjs`, `admin-authorization-express.cjs`, `admin-admins-routes.cjs`, `verify-admin-http.js`, `admin-verify.js`, `server.cjs`, `useAdminRole.ts`, `admin-verify-cache.ts`, `ProtectedAdminRoute.tsx`, `adminTabRegistry.tsx`, `Dashboard.tsx`, `AdminsTab.tsx`, `AdminDesktopSidebarRail.tsx`, `types.ts`.

## Test / build commands

```bash
node --test shared/admin/tabAccess.test.cjs shared/admin/permissions.test.cjs
npm run build
```

## Manual QA

1. As super_admin, edit a regular admin → set allowed tabs + mobile subset → save.
2. Log in as that admin → desktop sidebar, mobile drawer, and bottom bar match config.
3. Call a restricted API (e.g. `events:manage`) without permission → 403.
4. Toggle “Use role defaults” → admin regains standard role tabs.
5. Existing admins without rows still see default role tabs.

## Follow-ups

- Refactor mobile Sheet in `Dashboard.tsx` to map `allowedTabItems` (reduces duplication).
- Consider returning `mobile_order` to frontend for custom per-admin bottom nav ordering UI.
