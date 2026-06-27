# 06 — Service Role & Mass Assignment

## Service role key exposure

| Check | Result |
|-------|--------|
| `NEXT_PUBLIC_*` / `VITE_*` service role | **Not found** in repo grep |
| Production Vercel env | `SUPABASE_SERVICE_ROLE_KEY` present (server only) |
| `dist/assets/*.js` grep | No service_role / JWT patterns |
| Client bundle Supabase | Anon key only (via Vite env at build time) |

**Pass** — service role appears server-only.

## Service role route review (code)

| Module | Auth | Allowlist |
|--------|------|-----------|
| `api/_lib/service-role-client.js` | Requires env key | N/A |
| `api/_lib/admin-data-routes.js` | `requireAdmin()` + permission | `pickAllowedFields` / `rejectUnexpectedFields` |
| `api/_lib/admin-data-route-helpers.js` | Permission map per route | Ambassador/contact/subscriber field lists |
| `api/misc.js` phone-subscribe | Public | Uses service role for duplicate check + insert |
| `api/orders-create.js` | Public checkout | Service role for order pipeline |

Public routes using service role (`phone-subscribe`, order create) are **intentional** and do not expose the key.

## Mass assignment controls (code review)

| Control | Location |
|---------|----------|
| `rejectUnexpectedFields()` | admin-data-routes PATCH/POST handlers |
| `pickAllowedFields()` | Strips disallowed keys before DB write |
| `looksLikeBcryptHash()` | Rejects client-supplied bcrypt hashes |
| `hashedPassword` rejection | `misc.js` admin-update-application |

### Allowed ambassador writable fields

`full_name`, `phone`, `email`, `city`, `ville`, `extra_villes`, `status`, `requires_password_change`, `password` (plaintext → server hash)

## Live mass-assignment attempts

| Attempt | Result |
|---------|--------|
| Unauthenticated POST `/api/admin/ambassadors` with `role`, `is_admin`, etc. | **401** (blocked before DB) |
| Authenticated PATCH with unexpected fields | **Not tested** — needs admin cookie |

**Pass (unauthenticated).** Authenticated allowlist enforcement should be verified with test admin in follow-up.

## Fields tested conceptually (safe / no auth)

`role`, `is_admin`, `created_at`, `approved_by`, `payment_status`, `secure_token`, `password_hash`, `reviewed_by_admin_id` — all blocked at auth layer when unauthenticated.
