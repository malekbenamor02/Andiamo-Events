# Vercel API Count & Career Solution

## Current API count (serverless functions)

Vercel counts **one serverless function per file** in the `api/` folder. You have:

| # | File | Notes |
|---|------|--------|
| 1 | `api/admin-login.js` | Admin auth |
| 2 | `api/admin-approve-order.js` | Order approval |
| 3 | `api/verify-admin.js` | Session verify |
| 4 | `api/orders-create.js` | Create order |
| 5 | `api/aio-events-save-submission.js` | AIO form |
| 6 | `api/passes-[eventId].js` | Dynamic pass by event |
| 7 | `api/misc.js` | **Unified** – many routes (logout, send-email, ambassador, POS, SMS, etc.) |
| 8 | `api/admin/logs.js` | Admin logs |
| 9 | `api/pos.js` | POS API |
| 10 | `api/admin-pos.js` | Admin POS |
| 11 | `api/scan.js` | Scanner + scan admin |
| 12 | `api/clictopay-generate-payment.js` | ClicToPay payment |

**Total: 12 serverless functions.**  
Vercel (Hobby) limit: **11** → you are **1 over** even before adding career.

---

## Career routes (from `careerRoutes.cjs`)

If career were deployed as a separate serverless function, it would add **1 more** (13 total).  
Career uses **31 route handlers** (many paths with params), but they can all be served by **one** backend:

- Public: `/api/careers/page-content`, `/api/careers/domains`, `/api/careers/domains/:slug`, `/api/careers/city-options`, `/api/careers/gender-options`, `/api/career-application`, `/api/career-application/check-duplicate`
- Admin: `/api/admin/careers/*` (settings, domains, templates, fields, applications, city/gender options, etc.)

---

## Constraint: do not touch any payment APIs

**Leave all payment-related APIs unchanged.** Do not merge, move, or refactor:

- `api/clictopay-generate-payment.js` (ClicToPay)
- Any rewrites/routes for `/api/clictopay-*`, `/api/orders/create`, payment options, or other payment flows.

---

## Solution (stay at 11, add career, no breaking changes)

### 1. Reduce from 12 → 11 by merging a non-payment function into `misc.js`

Pick **one** non-payment function to merge into `misc.js` so you free one slot. Good candidates:

- **`api/verify-admin.js`** – session verify (small, auth-only), or  
- **`api/aio-events-save-submission.js`** – AIO form submit

Example (verify-admin):

- In **`vercel.json`**: add a rewrite so `/api/verify-admin` → **`/api/misc.js`** (and remove or stop using the standalone `api/verify-admin.js` entry in rewrites if it points to its own file).
- In **`api/misc.js`**: in the path dispatch, add a branch for `path === '/api/verify-admin'` (GET) and run the same logic currently in `api/verify-admin.js` (move the code into `misc.js` or call a shared helper).

Result: **11 serverless functions** (one less file counted), **no payment APIs changed**.

### 2. Serve all career routes through `misc.js` (no new function)

- **Do not** add a new `api/careers.js` (or any new api file) for career.
- In **`vercel.json`**:
  - Add **rewrites** for every career path to **`/api/misc.js`**, for example:
    - `/api/careers/page-content` → `/api/misc.js`
    - `/api/careers/domains` → `/api/misc.js`
    - `/api/careers/domains/:slug` → `/api/misc.js`
    - `/api/careers/city-options` → `/api/misc.js`
    - `/api/careers/gender-options` → `/api/misc.js`
    - `/api/career-application` → `/api/misc.js`
    - `/api/career-application/check-duplicate` → `/api/misc.js`
    - `/api/admin/careers/settings` → `/api/misc.js`
    - `/api/admin/careers/domains` → `/api/misc.js`
    - … (and all other `/api/admin/careers/*` patterns you use)
- In **`api/misc.js`**:
  - In the existing path-based dispatch (where you already branch on `path`), add branches for:
    - `path.startsWith('/api/careers')` or `path === '/api/career-application'` or `path.startsWith('/api/admin/careers')`
  - For those requests, call the **same** career logic that `careerRoutes.cjs` uses. Two ways to avoid duplication:
    - **Option A (recommended):** Extract the core career logic (DB, Supabase, validation) into a shared module (e.g. `lib/career-handlers.js` or `careerHandlers.cjs`). `careerRoutes.cjs` keeps registering Express routes that call these handlers (unchanged for local `server.cjs`). `misc.js` imports the same handlers and calls them when the path matches (with a thin adapter from `(req, res)` to your handler signature if needed).
    - **Option B:** From `misc.js`, call your existing Node server (e.g. internal HTTP request to the same app). That adds latency and complexity; Option A is cleaner.

Result: **Still 11 functions**, with career public page and admin tab working the same as today.

---

## Summary

| Action | Effect |
|--------|--------|
| **Do not touch** any payment APIs (ClicToPay, orders/create, payment flows) | Payment stays unchanged |
| Merge one **non-payment** function into `misc.js` (e.g. `verify-admin` or `aio-events-save-submission`) + adjust rewrites | 12 → **11** functions |
| Route all career paths to `misc.js` + add career dispatch in `misc.js` | Career works, **no new** function |
| Keep `careerRoutes.cjs` + `server.cjs` as-is for local dev | No breaking changes |

Final count: **11 serverless functions**, career and admin tab supported, **payment APIs untouched**.
