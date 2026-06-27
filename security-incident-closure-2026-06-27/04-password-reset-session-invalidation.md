# 04 — Password Reset & Session Invalidation (FIND-007)

## Migration

`supabase/migrations/20260627140000_admin_session_invalidation.sql`

**Applied to production:** yes

## Database changes

| Column | Purpose |
|--------|---------|
| `requires_password_change` | Forces password update before full admin API access |
| `session_version` | Invalidates JWT cookies when incremented |

## Post-migration state (metadata only)

| Metric | Value |
|--------|-------|
| Admin accounts | 8 |
| `requires_password_change=true` | 8 (all) |
| `session_version` | 2 (all) |

## Code changes

| Component | Behavior |
|-----------|----------|
| `admin-login.js` | JWT includes `session_version`; returns `requiresPasswordChange` |
| `admin-authorization.mjs` | Rejects JWT when `session_version` mismatch |
| `admin-data-route-helpers.js` | Returns 403 `password_change_required` when flag set |
| `POST /api/admin/change-password` | Verifies current password, hashes new, clears flag, bumps `session_version`, reissues cookie |
| `verify-admin-http.js` | Returns `requiresPasswordChange` in verify response |

## Session invalidation

All pre-migration admin cookies are **invalid** (JWT lacks matching `session_version`).

## Password reset

All admins must log in and call `/api/admin/change-password` after code deploy.

## JWT_SECRET rotation

**Not performed automatically.** Recommended manual step in Vercel → rotate `JWT_SECRET` → redeploy for additional invalidation of any tokens signed with old secret.

## Verification

- Old cookies → `/api/verify-admin` **401** (expected after deploy + migration)
- New login → `requiresPasswordChange: true` until password changed
