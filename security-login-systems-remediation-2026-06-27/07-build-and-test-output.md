# Build and Test Output

## Commands run (2026-06-27)

### Unit tests

```bash
npm run test:login-security
```

**Result:** 16/16 pass

- `api/_lib/scanner-auth.test.cjs`
- `api/_lib/scanner-login-rate-limit.test.cjs`
- `api/_lib/ambassador-auth.test.cjs`

### Production build

```bash
npm run build
```

**Result:** Exit 0 — Vite build + academy prerender succeeded.

### RLS regression

```bash
npm run security:rls
```

**Result:** Exit 0 — anon private table counts 0; write probes denied; public tables OK.

## Manual tests (post-deploy checklist)

| # | Test | Expected |
|---|------|----------|
| 1 | Scanner login brute (7 bad attempts) | 429 |
| 2 | validate-ticket no cookie | 401 |
| 3 | validate-ticket deactivated scanner JWT | 401 |
| 4 | Double scan same ticket | 1 valid, 1 already_scanned |
| 5 | Admin scanner route invalidated session | 401 |
| 6 | Admin password reset ambassador | Old session 401 |
| 7 | Ambassador requires_password_change | 403 on orders until change |

Do not capture response bodies containing PII in evidence logs.
