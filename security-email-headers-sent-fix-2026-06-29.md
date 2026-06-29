# ERR_HTTP_HEADERS_SENT — `/api/send-email` fix report

**Date:** 2026-06-29  
**Status:** Fixed locally, tested, not deployed

---

## Root cause

`POST /api/send-email` in `api/misc.js` called `applyClearAdminTokenCookie(res)` **after** `gateAdminPermission()` had already sent an HTTP response.

### Control-flow path that caused double-send

1. Request hits `POST /api/send-email` with missing, invalid, or expired `adminToken` cookie (or other auth failure).
2. `gateAdminPermission(req, res, 'marketing:manage')` runs `verifyAdminAuth`, gets `valid: false`, and sends `res.status(401).json({...})` — **first response committed**.
3. `gateAdminPermission` returns `null`; the route handler continued:
   ```js
   if (!authResult) {
     applyClearAdminTokenCookie(res);  // res.setHeader('Set-Cookie', ...) — TOO LATE
     return;
   }
   ```
4. `applyClearAdminTokenCookie` calls `res.setHeader` after headers were already sent → **`ERR_HTTP_HEADERS_SENT`** (stack line ~2534).
5. That exception is caught by the route's `catch` block, which logs `Email sending failed:` (misleading — this was an auth/cookie ordering bug, not SMTP failure) and calls `res.status(500).json(...)` → **second `ERR_HTTP_HEADERS_SENT`** (stack line ~2660).
6. The exception propagates to the outer `api/misc.js` router `catch`, which calls `res.status(500).json(...)` again → **third `ERR_HTTP_HEADERS_SENT`** (stack line ~8939).

The production log sequence (`Email sending failed` → `API Router Error` → outer catch) matches this cascade exactly.

---

## Exact route affected

| Route | Method | Permission |
|-------|--------|------------|
| `/api/send-email` | `POST` | `marketing:manage` |

---

## Fix

### 1. Remove post-response cookie clear in send-email route (`api/misc.js`)

**Before (buggy):**
```js
const authResult = await gateAdminPermission(req, res, 'marketing:manage');
if (!authResult) {
  applyClearAdminTokenCookie(res);  // after response already sent
  return;
}
```

**After:**
```js
const authResult = await gateAdminPermission(req, res, 'marketing:manage');
if (!authResult) return;
```

Removed unused `applyClearAdminTokenCookie` import from `api/misc.js`.

### 2. Centralize cookie clearing in `gateAdminPermission` (`api/_lib/admin-permission-gate-http.js`)

Cookie clearing now happens **before** the JSON body is sent on authentication failure, matching the pattern in `api/_lib/verify-admin-http.js`:

```js
if (!authResult.valid) {
  applyClearAdminTokenCookie(res);
  res.status(authResult.statusCode || 401).json({ ... });
  return null;
}
```

Permission-denied (`403`) responses do **not** clear the cookie — the session is still valid; only the permission is missing.

### 3. Defensive guards (last resort, after root-cause fix)

- `/api/send-email` `catch`: `if (res.headersSent) return;` before sending 500.
- Outer `api/misc.js` router `catch`: same guard before sending 500.

These prevent log noise if an unexpected error occurs after a response was already committed; they do not mask the original bug.

---

## Why the fix prevents double response

| Step | Before | After |
|------|--------|-------|
| Auth failure | `gateAdminPermission` sends 401 JSON, then route calls `setHeader` | `gateAdminPermission` calls `setHeader` then sends 401 JSON — single response |
| Route after auth fail | Attempted cookie clear on closed response | `if (!authResult) return;` — no further writes |
| Error cascade | Cookie error → catch 500 → outer catch 500 | Guards skip extra writes if headers already sent |

---

## Files changed

| File | Change |
|------|--------|
| `api/misc.js` | Remove post-auth `applyClearAdminTokenCookie`; add `headersSent` guards in send-email catch and outer catch; remove unused import |
| `api/_lib/admin-permission-gate-http.js` | Call `applyClearAdminTokenCookie` before JSON on auth failure |
| `api/_lib/send-email-headers-sent.test.cjs` | **New** — regression tests |

---

## Tests added

`api/_lib/send-email-headers-sent.test.cjs`:

| Test | Asserts |
|------|---------|
| `gateAdminPermission` — missing token | `Set-Cookie` is set **before** `json`; exactly one JSON response |
| send-email route static analysis | No `applyClearAdminTokenCookie` after `gateAdminPermission`; uses `if (!authResult) return` |
| send-email success path | Contains `return res.status(200).json({ success: true })` |
| send-email failure catch | Contains `Email sending failed` log and `if (res.headersSent)` guard |
| `applyClearAdminTokenCookie` order | Cookie before JSON on strict mock |
| Reproduces production bug | Calling `applyClearAdminTokenCookie` after `json` throws `ERR_HTTP_HEADERS_SENT` |
| Outer catch guard | `if (res.headersSent)` present before 500 JSON |

Strict response mock throws `ERR_HTTP_HEADERS_SENT` if `setHeader`, `status`, or `json` is called after the first `json`.

---

## Commands run and results

```bash
node --test api/_lib/send-email-headers-sent.test.cjs
# 7 tests, 7 pass

npm run test:admin-auth-order
# 86 tests, 86 pass

npm run build
# exit 0 — vite build + prerender succeeded
```

---

## Remaining risk

| Risk | Severity | Notes |
|------|----------|-------|
| Other routes with manual post-gate cookie logic | Low | Grep shows only `/api/send-email` had this anti-pattern; all other `gateAdminPermission` callers use `if (!authResult) return` only |
| Cookie cleared on all auth failures (including 500 config errors) | Low | Matches `verify-admin-http.js` behavior; only affects invalid/missing token paths in practice for send-email |
| No end-to-end SMTP integration test | Low | Email send path is unchanged; only auth response ordering was fixed |
| `gateAdminPermission` cookie clear on 403 invalid role | None | 403 from `effectivePermissionDenied` does not clear cookie — intentional |

---

## Deployment note

**Not deployed.** Deploy when ready after review.
