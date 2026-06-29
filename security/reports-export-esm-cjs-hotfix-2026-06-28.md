# Reports export ESM/CJS hotfix

**Date:** 2026-06-28  
**Severity:** Production crash (500 on `GET /api/admin/reports/export`)  
**Verdict:** **PASS**

---

## Root cause

`api/_lib/reports-export-route.cjs` is CommonJS (`.cjs`) but used top-level:

```js
const { writeAdminMutationAudit } = require('./admin-mutation-audit.js');
```

`admin-mutation-audit.js` is an ES module (`export async function writeAdminMutationAudit`). Node.js on Vercel rejects `require()` of ESM, crashing the route before any auth or export logic runs.

Other API handlers (e.g. `misc.js`) already use `import` because they are ESM. This route was added as CJS to match Express registration patterns.

---

## Fix

Replaced static `require()` with a cached dynamic import helper, loaded inside the async route handler:

```js
let adminMutationAuditPromise = null;

function getAdminMutationAudit() {
  if (!adminMutationAuditPromise) {
    adminMutationAuditPromise = import('./admin-mutation-audit.js');
  }
  return adminMutationAuditPromise;
}
```

Both audit paths (success + failure) now use:

```js
const { writeAdminMutationAudit } = await getAdminMutationAudit();
await writeAdminMutationAudit(db, { ... });
```

No changes to auth, permissions, data loading, Excel generation, or audit payload shape.

---

## Files changed

| File | Change |
|------|--------|
| `api/_lib/reports-export-route.cjs` | Dynamic `import()` for audit module |
| `api/_lib/reports-export-route.test.cjs` | ESM/CJS interop tests (3 new cases) |

---

## Tests run

| Command | Result |
|---------|--------|
| `node --test api/_lib/reports-export-route.test.cjs` | **PASS** — 13/13 |
| `node --test api/_lib/reports-excel-fee-parity.test.cjs` | **PASS** — 4/4 |
| `npm run test:admin-api-authz-coverage` | **PASS** — 37/37 |
| `npm run security:admin-auth` | **PASS** |
| `npm run security:public-routes` | **PASS** |
| `npm run security:rls` | **PASS** |
| `npm run build` | **PASS** |

### Grep

```bash
rg -n "require\(['\"]\.\/admin-mutation-audit\.js['\"]\)" api
```

**0 hits** in `api/`.

```bash
rg -n "admin-mutation-audit\.js" api/_lib/reports-export-route.cjs
```

Shows `import('./admin-mutation-audit.js')` via `getAdminMutationAudit()`.

---

## Final verdict: **PASS**

Route module loads in Node without ESM/CJS error. Audit logging preserved on success and failure. Security gates unchanged.
