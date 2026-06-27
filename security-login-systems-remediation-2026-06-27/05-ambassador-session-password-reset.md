# Ambassador Session and Password Reset

## Admin password reset revokes sessions

**File:** `api/_lib/admin-data-routes.js`

On `PATCH /api/admin/ambassadors/:id` when `row.password` is set:

1. Hash applied server-side (existing flow)
2. `requires_password_change = true` (unless explicitly overridden in body) via `buildAmbassadorWritePayload`
3. `revokeAllAmbassadorSessions(db, ambassadorId, 'admin_password_reset')`

## requires_password_change enforcement

### Backend

- `requireAmbassadorAuth` returns **403** `password_change_required` when flag is true (except endpoints that pass `allowPasswordChangePending: true`)
- Allowed with pending flag: `GET /api/ambassador/me`, `POST /api/ambassador-update-password`
- Blocked: events, orders, performance, confirm-cash, cancel-order
- Login response includes `requires_password_change`
- Password update clears flag, validates 8+ complexity, revokes all sessions

### Frontend

- `ProtectedAmbassadorRoute` redirects to `/ambassador/change-password`
- New page: `src/pages/ambassador/ChangePassword.tsx`
- Login redirect when flag set

## Password policy

- Reuses `validateNewPassword` from influencer module (8+ chars, upper, lower, digit)
- Admin-set passwords min length raised from 6 to 8 in `admin-data-route-helpers.js`

## Tests

- Existing `ambassador-auth.test.cjs` session tests still pass
- Manual: admin reset → old cookie invalid on `/api/ambassador/orders`
