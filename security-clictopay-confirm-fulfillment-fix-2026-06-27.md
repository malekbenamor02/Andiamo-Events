# ClicToPay confirm fulfillment path fix — 2026-06-27

## Root cause

After the `total_price` fix, `/api/clictopay-confirm-payment` successfully loaded orders and verified ClicToPay payment, then crashed during ticket/email fulfillment:

```
Cannot find module '/var/task/api/online-payment-fee.cjs'
```

`buildFulfillmentDepsFromMisc()` in `api/_lib/paid-order-fulfillment.cjs` resolves shared modules with:

```js
nodePath.join(fulfillmentLibDir, 'online-payment-fee.cjs')
```

It requires `fulfillmentLibDir` to be **`api/_lib`**.

Callers (`api/clictopay-confirm-payment.js`, `api/misc.js`) passed their entrypoint `__dirname` (**`api/`**), so Node looked for `api/online-payment-fee.cjs` instead of `api/_lib/online-payment-fee.cjs`.

This is **not** a Vercel routing issue and **not** a missing bundle: `vercel.json` already includes `api/_lib/**`. The module exists at the correct path; only the constructed require path was wrong.

## Files changed

| File | Change |
|------|--------|
| `api/_lib/paid-order-fulfillment.cjs` | Renamed parameter to `fulfillmentLibDir`; added `assertFulfillmentLibDir()` validation |
| `api/_lib/clictopay-confirm-payment.cjs` | Context uses `fulfillmentLibDir` instead of `__dirname` |
| `api/clictopay-confirm-payment.js` | Passes `nodePath.join(__dirname, '_lib')` as `fulfillmentLibDir` |
| `api/misc.js` | Passes `fulfillmentLibDir: nodePath.join(__dirname, '_lib')` |
| `scripts/recover-paid-order-fulfillment.mjs` | Clarified variable name (path unchanged) |
| `api/_lib/payment-fulfillment.test.cjs` | Added lib-path regression tests |

## Exact fix

1. Entrypoints pass **`api/_lib`**, not `api/`.
2. Misleading `__dirname` parameter renamed to **`fulfillmentLibDir`**.
3. **`assertFulfillmentLibDir()`** throws before require if the resolved fee module path does not include `/_lib/online-payment-fee.cjs`, avoiding vague `MODULE_NOT_FOUND` in production.

No duplicate `online-payment-fee.cjs`, no Vercel `includeFiles` workaround, no weakening of payment verification or fulfillment security.

## Tests run

```bash
npm run test:payment-fulfillment
npm run build
```

(See CI/local output for pass/fail at deploy time.)

## Operational recovery (required after deploy)

Some orders were marked **PAID** in Supabase but have **zero tickets** and no confirmation email/SMS because the crash occurred **after** gateway verification and **before** fulfillment.

**Do not re-charge or re-run payment confirmation for these orders.**

Affected PAID online orders with missing tickets (as of 2026-06-27):

| Order # | Order ID | Approved (UTC) | Tickets |
|---------|----------|----------------|---------|
| 343250 | `18112b78-3fbe-4e79-a34e-77fd5122e845` | 2026-06-27 10:18 | 0 / 1 |
| 998935 | `29259041-8285-46b7-9312-bcbe70ef50ab` | 2026-06-27 04:14 | 0 / 1 |

Also check **PENDING_ONLINE** orders where the customer was charged but confirm never completed (e.g. #758365, #735459) — after deploy, run recovery or re-open the payment return URL once.

Recovery (idempotent, no re-payment):

```bash
node scripts/recover-paid-order-fulfillment.mjs --order-number 343250
node scripts/recover-paid-order-fulfillment.mjs --order-number 998935
node scripts/recover-paid-order-fulfillment.mjs --batch-underfulfilled --since 2026-06-27
```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment.

---

## Follow-up production error: uuid package missing

### Root cause

After the `fulfillmentLibDir` fix (`a2fdbef`), confirm reached `api/_lib/paid-order-fulfillment.cjs` but crashed during ticket creation:

```
Cannot find package 'uuid' imported from /var/task/api/_lib/paid-order-fulfillment.cjs
```

`paid-order-fulfillment.cjs` used `await import('uuid')` for `secure_token` generation. Although `uuid` is listed in `package.json` `dependencies`, Vercel’s serverless bundle for `clictopay-confirm-payment.js` does not reliably include packages only reached via **dynamic import** from nested `_lib` modules. Local tests passed because `uuid` is present in full `node_modules`.

This is **not** a ClicToPay verification failure and **not** fixed by adding Vercel `includeFiles` for `uuid`.

### File changed

| File | Change |
|------|--------|
| `api/_lib/random-uuid.cjs` | **New** — `crypto.randomUUID()` wrapper |
| `api/_lib/paid-order-fulfillment.cjs` | Use `randomUuid()` instead of `import('uuid')` |
| `api/admin-approve-order.js` | Same (prevent identical serverless failure) |
| `api/admin-pos.js` | Same |
| `api/misc.js` | Same |
| `api/_lib/payment-fulfillment.test.cjs` | Regression tests for no `uuid` import in fulfillment/API |

### `uuid` package

**Removed from server-side fulfillment and API ticket paths.** `uuid` remains in `dependencies` only for the browser (`src/pages/PassPurchase.tsx` idempotency key). No new dependency added.

### Tests run

```bash
npm run test:payment-fulfillment
npm run build
```

### Deployment risk

Low — `crypto.randomUUID()` is built into Node 18+ (Vercel runtime). Output format matches prior `uuid` v4 tokens expected by `tickets.secure_token`.

### Affected orders requiring recovery

Any order where payment was approved and status became **PAID** but fulfillment crashed on `uuid` (zero tickets, no email/SMS). **Do not re-charge.**

After deploy:

```bash
node scripts/recover-paid-order-fulfillment.mjs --batch-underfulfilled --since 2026-06-27
```

Re-query Supabase for `PAID` online orders with `ticket_count < expected_tickets` after deployment.
