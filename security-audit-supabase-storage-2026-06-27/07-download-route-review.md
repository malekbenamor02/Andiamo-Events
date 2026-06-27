# 07 — Download & Access Route Review

---

## Backend routes touching storage or file URLs

| Route | File | Auth | Permission | Service role | Arbitrary path? | Ownership check | Verdict |
|-------|------|------|------------|--------------|-----------------|-----------------|---------|
| `GET /api/admin/academy/registrations/:id` | `academyRoutes.cjs` | Admin JWT/cookie | `academy:manage` | Yes | **No** — path from DB row | Registration ID in URL must match row | **PASS** |
| `POST /api/academy/register` | `academyRoutes.cjs` | Public + rate limit | N/A | Yes (upload proof) | **No** — server-generated path | Registration ID | **PASS** |
| `POST /api/media/upload` | `register-media-routes.cjs` | **`requireAdminAuth`** | Admin | R2 credentials | **Partial** — scope/folder whitelisted | Admin only | **PASS** |
| `POST /api/media/delete` | `register-media-routes.cjs` | **`requireAdminAuth`** | Admin | R2 | Key from body; rejects `..` | Admin only | **PASS** |
| `POST /api/media/favicon/cleanup` | `register-media-routes.cjs` | **`requireAdminAuth`** | Admin | R2 | Prefix from `faviconType` regex | Admin only | **PASS** |
| Ticket generation (misc admin routes) | `api/misc.js` | Admin auth on parent routes | Varies | Yes | Path derived from order/invitation ID + new UUID | Order context | **PASS** for auth; **FAIL** for public URL output |
| Order approval QR generation | `api/admin-approve-order.js` | Admin approval flow | Admin | Yes | Order-scoped path | Order ID | Same |

---

## No dedicated download proxy found

There is **no** generic `/api/storage/download?bucket=&path=` route found in codebase search.

File access patterns:

1. **Direct public Supabase/R2 URLs** embedded in DB and emails (tickets, career, images).
2. **Signed URL** for academy proofs (admin only).

---

## Path traversal / bucket traversal

| Route | Traversal risk |
|-------|----------------|
| `/api/media/delete` | **Mitigated** — rejects `..` in key |
| `/api/media/upload` | **Mitigated** — scope enum + folder whitelist |
| Academy signed URL | **Mitigated** — path from DB, not query param |
| Client Supabase upload | **Partial** — user picks file content; path mostly server-side template except career filename |

---

## Arbitrary file download risk

| Attack | Possible? |
|--------|-----------|
| Unauthenticated API returns signed URL for any path | **No** — only academy admin route; path from DB |
| Change registration ID to access another proof | **Blocked** by admin auth + DB lookup (admin must be authenticated; IDOR should be retested with two admin roles) |
| Public URL guessing for tickets | **Theoretical UUID brute force impractical**; **URL leak** (email, logs, referrer) is practical |
| Public URL guessing for career docs | **Medium** — timestamp + filename pattern |

---

## Service role usage on download paths

Service role is used **server-side only** for:

- Uploading ticket QRs, academy proofs
- DB operations in ticket/email flows

It is **not** exposed to browser clients.

---

## Pass/fail summary

| Control | Result |
|---------|--------|
| Private files via authenticated signed URL | **PASS** (academy only) |
| No unauthenticated arbitrary download API | **PASS** |
| Ticket/career files not world-readable | **FAIL** (public buckets) |
| Path traversal on media API | **PASS** |
