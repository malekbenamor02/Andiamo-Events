# Payment fulfillment regression fix — 2026-06-27

## 1. Root cause

After deploy **`b7366df`** (security cleanup, June 27 2026), `/api/clictopay-confirm-payment` narrowed a PostgREST select on `order_passes` and included a column that **does not exist** on that table:

```js
.from('order_passes')
.select('id, quantity, pass_type, price, order_pass_id')  // BUG
.eq('order_id', orderId);
```

- `order_pass_id` is on **`tickets`**, not **`order_passes`**.
- PostgREST error → `"No passes found"` → no tickets, no email/SMS.
- Order still became **PAID**; frontend hid fulfillment failure.

**Affected example:** Order **#998935** (`29259041-8285-46b7-9312-bcbe70ef50ab`).

---

## 2. Exact broken line/query

**Route:** `POST /api/clictopay-confirm-payment` (pre-fix inline handler in `api/misc.js`)

```js
.select('id, quantity, pass_type, price, order_pass_id')  // invalid on order_passes
```

---

## 3. Files changed

| File | Change |
|------|--------|
| `api/_lib/paid-order-fulfillment.cjs` | Idempotent fulfillment; RPC locked inserts; dry-run side-effect free |
| `api/_lib/fulfillment-ticket-plan.cjs` | **New.** `buildTicketInsertPlan()` — deterministic `pass_sequence` slots |
| `api/_lib/clictopay-payment-verify.cjs` | **New.** Gateway amount/currency/reference/paid validation |
| `api/_lib/clictopay-confirm-payment.cjs` | **New.** Hardened confirm handler (gateway before fulfillment) |
| `api/_lib/safe-email-delivery-log.cjs` | Non-fatal `email_delivery_logs` insert |
| `api/_lib/payment-fulfillment.test.cjs` | 21 tests (concurrency, security, dry-run, mocks) |
| `api/misc.js` | Delegates to `handleClicToPayConfirmPayment` |
| `supabase/migrations/20260627140000_order_fulfillment_concurrency.sql` | **New.** `pass_sequence` + unique index + advisory-lock RPC |
| `scripts/recover-paid-order-fulfillment.mjs` | `--batch-underfulfilled`, `--since`, dry-run guarantees |
| `src/pages/PaymentProcessing.tsx` | Fulfillment-pending UI states |
| `package.json` | `test:payment-fulfillment` script |

---

## 4. Fulfillment behavior before fix

1. Payment confirmed → **PAID**.
2. Invalid `order_passes` select → no tickets.
3. Email/SMS skipped.
4. UI showed full success on PAID only.
5. Already-PAID re-confirm skipped ticket recovery (initially).

---

## 5. Fulfillment behavior after fix

### Helper: `fulfillPaidOrderTicketsAndEmail()`

**Location:** `api/_lib/paid-order-fulfillment.cjs`

1. Order must be **PAID** (blocks unpaid/fake DB rows from public confirm alone).
2. Valid `order_passes` columns only.
3. `buildTicketInsertPlan()` assigns missing `(order_pass_id, pass_sequence)` slots.
4. Inserts via `insert_fulfillment_tickets_locked` RPC (advisory lock + `ON CONFLICT DO NOTHING`).
5. Email after tickets; `emailSent = true` on successful send regardless of log table.
6. SMS only on new tickets (or `forceSms` / recovery `forceEmail` path); skips if `sms_logs` already has `sent`.
7. Repeated confirm: no duplicate tickets; no email/SMS spam when already delivered.

### Concurrency protection

**Method:** Postgres **transaction advisory lock** + **partial unique index** (belt and suspenders).

Migration: `20260627140000_order_fulfillment_concurrency.sql`

| Layer | Mechanism |
|-------|-----------|
| Application | `insertTicketsUnderLock()` → RPC `insert_fulfillment_tickets_locked(p_order_id, p_rows)` |
| Lock | `pg_advisory_xact_lock(hashtext(p_order_id::text))` serializes concurrent confirms per order |
| DB constraint | `UNIQUE (order_pass_id, pass_sequence) WHERE pass_sequence IS NOT NULL` |
| Slot assignment | `pass_sequence` 0 … `quantity-1` per `order_pass` via `buildTicketInsertPlan()` |

**Proof:** Test `insertTicketsUnderLock concurrent behavior` — second batch returns `inserted: 0, skipped: 1` for same slot.

**Deploy requirement:** Apply migration **before** or **with** code deploy. Without RPC, code falls back to direct insert + warning (weaker concurrency guarantee).

### Public confirm security (`/api/clictopay-confirm-payment`)

**Handler:** `api/_lib/clictopay-confirm-payment.cjs` → `handleClicToPayConfirmPayment`

| Check | Implementation |
|-------|----------------|
| Client input | Only `orderId` — no trust of frontend payment flags |
| Gateway verify | Always `fetchClicToPayOrderStatus(payment_gateway_reference)` before fulfillment |
| Paid status | `orderStatus === 2`, `errorCode === 0`, no decline message |
| Order reference | `orderNumber` / `mdOrder` / gateway id must match order |
| Amount | Gateway millimes vs `total_with_fees` / computed fee-inclusive total (±1 millime) |
| Currency | `TND`, `788`, `DTN`, `DT` when present |
| Unpaid order | `PENDING_ONLINE` + gateway fail → **FAILED** or **UNKNOWN**; **no tickets** |
| Fake PAID via public API | Cannot mark unpaid PAID without gateway; fulfillment requires `status === 'PAID'` **and** gateway OK on confirm path |
| Already PAID recovery | Still requires gateway verification before `fulfillPaidOrderTicketsAndEmail` |
| Repeat confirm | Email/SMS only if tickets new or delivery incomplete; not endless resend |

**Recovery script** (`scripts/recover-paid-order-fulfillment.mjs`) bypasses ClicToPay intentionally — service-role operator tool only.

### Dry-run guarantee

`--dry-run`:

- Creates **0** tickets (no RPC/insert).
- Sends **0** emails (`sendTransactionalEmail` not called).
- Sends **0** SMS (no HTTP call).
- Sets `emailSent/smsSent/emailAttempted/smsAttempted` all **false**.
- Populates `dryRunActions[]` with planned steps only.

---

## 6. Backfill / recovery

### Order #998935

```bash
export SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."

node scripts/recover-paid-order-fulfillment.mjs --order-number 998935 --dry-run
node scripts/recover-paid-order-fulfillment.mjs --order-number 998935
```

Re-confirm (requires live ClicToPay verify):

```bash
curl -X POST "$BASE/api/clictopay-confirm-payment" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"29259041-8285-46b7-9312-bcbe70ef50ab"}'
```

### Batch dry-run (under-fulfilled PAID online orders)

```bash
node scripts/recover-paid-order-fulfillment.mjs --batch-underfulfilled --since 2026-06-27 --dry-run
```

Uses `orders.approved_at` (populated when online orders become PAID via confirm handler).

### Corrected recovery SQL (WHERE-based)

```sql
SELECT
  o.id,
  o.order_number,
  o.user_email,
  o.approved_at,
  COALESCE(pass.expected_tickets, 0) AS expected_tickets,
  COALESCE(tix.ticket_count, 0) AS ticket_count
FROM public.orders o
LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(op.quantity), 0)::int AS expected_tickets
  FROM public.order_passes op
  WHERE op.order_id = o.id
) pass ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS ticket_count
  FROM public.tickets t
  WHERE t.order_id = o.id
) tix ON true
WHERE o.status = 'PAID'
  AND (o.payment_method = 'online' OR o.source = 'platform_online')
  AND o.approved_at >= TIMESTAMPTZ '2026-06-27 00:00:00+00'
  AND COALESCE(tix.ticket_count, 0) < COALESCE(pass.expected_tickets, 0)
ORDER BY o.approved_at ASC;
```

**Date column:** `orders.approved_at` — set in confirm handler when marking PAID (`api/_lib/clictopay-confirm-payment.cjs`).

---

## 7. Tests added

**Script:** `npm run test:payment-fulfillment` (21 tests)

| Test | Purpose |
|------|---------|
| Static column guards + migration RPC/index | Regression on invalid select / concurrency schema |
| `buildTicketInsertPlan` | Deterministic slots; no duplicate sequences |
| `insertTicketsUnderLock` concurrent mock | Second insert skipped (RPC conflict behavior) |
| `validateClicToPayPaymentForOrder` | Paid/unpaid/amount validation |
| PAID + zero tickets → 1 ticket + email | Recovery path |
| Unpaid order → error, 0 tickets | Public safety |
| Second fulfillment run | No duplicates; no email/SMS |
| Dry-run | Zero tickets/email/SMS; `dryRunActions` populated |
| `email_delivery_logs` missing | `emailSent` stays true |
| ClicToPay confirm module | Gateway verify before fulfillment |
| `PaymentProcessing.tsx` | Fulfillment visibility |

---

## 8. Commands run and results (pre-production hardening)

```text
npm run test:payment-fulfillment   → PASS (21/21)
npm run security:admin-auth       → PASS
npm run security:public-routes    → PASS
npm run test:admin-auth-order     → PASS (13/13)
npm run build                   → PASS
```

Recovery on production: **not run** (no credentials in dev shell).

---

## 9. Remaining risks

| Risk | Mitigation |
|------|-----------|
| Migration not applied before deploy | RPC fallback weaker; apply `20260627140000` in same release |
| Gateway unreachable on already-PAID recovery | Returns `UNKNOWN` / verify error — use service-role recovery script |
| Legacy tickets without `pass_sequence` | Plan treats them as implicit slots 0..n-1 |
| `email_delivery_logs` missing | Observability only; send success decoupled |
| Batch script loads nested tickets (PostgREST) | Use SQL for large batches; script fine for moderate counts |

---

## 10. Deployment notes

1. **Do not deploy automatically.**
2. Apply migration `20260627140000_order_fulfillment_concurrency.sql` to production.
3. Deploy API + frontend together.
4. Staging: test payment + `--dry-run` recovery.
5. Production: recover **#998935**, then `--batch-underfulfilled --since 2026-06-27 --dry-run`.

---

## 11. Rollback notes

- Do not rollback ticket fix without valid `order_passes` select.
- Migration adds nullable `pass_sequence` + index — safe to keep even if code rolled back.
- Orders fulfilled after deploy keep their tickets.

---

## 12. Final release gates (pre-production)

### Gate 1 — RPC security ✅

| Check | Result |
|-------|--------|
| `REVOKE` from PUBLIC, anon, authenticated | ✅ In migration SQL + verified grants: only `postgres`, `service_role` have EXECUTE |
| Grant to service_role only | ✅ |
| `SET search_path = public` | ✅ `proconfig = {search_path=public}` |
| Validates `p_order_id` (PAID order exists) | ✅ |
| Ignores foreign `order_pass_id` (must belong to `p_order_id`, sequence in range) | ✅ SQL checks `order_passes.op.order_id = p_order_id` |

### Gate 2 — Production fallback ✅

| Check | Result |
|-------|--------|
| Direct insert disabled in production by default | ✅ `insertTicketsUnderLock` |
| RPC missing → fail in production | ✅ `failed: true`, `error: Ticket fulfillment RPC unavailable in production` |
| Unsafe fallback only with `ALLOW_UNSAFE_FULFILLMENT_FALLBACK=1` | ✅ Tested |

### Gate 3 — Migration verification ✅

Applied to linked Supabase project `ykeryyraxmtjunnotoep` via MCP (`order_fulfillment_concurrency`):

| Object | Verified |
|--------|----------|
| `tickets.pass_sequence` | ✅ column exists |
| `idx_tickets_order_pass_pass_sequence` | ✅ partial unique index |
| `insert_fulfillment_tickets_locked` | ✅ RPC returns `{ok:false,error:'order not PAID'}` for probe UUID |

Local verifier: `node scripts/verify-order-fulfillment-migration.mjs` (needs env vars).

### Gate 4 — Ticket insert path audit

| Path | Auth | Uses helper / pass_sequence | Notes |
|------|------|---------------------------|-------|
| `api/_lib/clictopay-confirm-payment.cjs` → `fulfillPaidOrderTicketsAndEmail` | Public + gateway | ✅ RPC + pass_sequence | **Primary online path** |
| `scripts/recover-paid-order-fulfillment.mjs` | Service role | ✅ Same helper | Operator recovery |
| `api/admin-approve-order.js` | Admin auth | ❌ Legacy inline insert | COD/admin approval; **no pass_sequence**; separate flow — follow-up to migrate |
| `api/misc.js` `/api/admin-skip-ambassador-confirmation` | Admin auth | ❌ Duplicated legacy insert | Same as admin-approve; **follow-up** |
| `api/admin-pos.js` | Admin POS | ❌ Direct insert | POS sales; **legacy**; out of online regression scope |

Online ClicToPay regression is covered by the helper path only.

### Gate 5 — Live staging payment test ⏳ MANUAL

Not run from this session (requires browser + ClicToPay test card on deployed staging URL).

**Checklist after deploy:**

1. Complete one test online payment → order **PAID**
2. Ticket count = sum(`order_passes.quantity`)
3. Email attempted/sent
4. Second `POST /api/clictopay-confirm-payment` → **0** new tickets
5. Frontend: full success only when `fulfillmentComplete === true`

### Gate 6 — Recovery #998935 ⏳ POST-DEPLOY

**Current DB state** (2026-06-27): order **#998935** PAID, `approved_at` set, **0/1 tickets**.

After code deploy:

```bash
node scripts/recover-paid-order-fulfillment.mjs --order-number 998935 --dry-run
node scripts/recover-paid-order-fulfillment.mjs --order-number 998935
# Re-run → expect ticketsCreatedCount: 0
```

### Gate 7 — Commands ✅

```text
npm run test:payment-fulfillment   → PASS (24/24)
npm run security:admin-auth       → PASS
npm run security:public-routes    → PASS
npm run test:admin-auth-order     → PASS (13/13)
npm run build                   → PASS
```

---

## Function / route reference

| Symbol | Location |
|--------|----------|
| `fulfillPaidOrderTicketsAndEmail` | `api/_lib/paid-order-fulfillment.cjs` |
| `insert_fulfillment_tickets_locked` | `supabase/migrations/20260627140000_*.sql` |
| `buildTicketInsertPlan` | `api/_lib/fulfillment-ticket-plan.cjs` |
| `validateClicToPayPaymentForOrder` | `api/_lib/clictopay-payment-verify.cjs` |
| `handleClicToPayConfirmPayment` | `api/_lib/clictopay-confirm-payment.cjs` |
| `POST /api/clictopay-confirm-payment` | `api/misc.js` → handler above |
| Recovery CLI | `scripts/recover-paid-order-fulfillment.mjs` |
