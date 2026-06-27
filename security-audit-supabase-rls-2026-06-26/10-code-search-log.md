# 10 — Code Search Log

Searches performed during read-only audit (2026-06-27).

---

## Search: `createClient(`

**Scope:** `*.{ts,tsx,js,jsx}`

**Files found (representative):**

| File | Lines | Risk notes |
|------|-------|------------|
| `src/integrations/supabase/client.ts` | 19 | Browser anon client |
| `src/lib/ticketGenerationService.tsx` | 83 | Browser anon — ticket CRUD |
| `api/admin-login.js` | 223 | Server anon — reads admins |
| `api/misc.js` | 276+ (many) | Server anon + service role |
| `api/_lib/admin-authorization.mjs` | 118 | Server — verify session |
| `api/orders-create.js` | 225+ | Order creation |
| `api/pos.js`, `api/scan.js`, `api/admin-pos.js` | various | POS/scanner |

---

## Search: `supabase.from(`

**Scope:** `*.{ts,tsx,js,jsx}`

**Important snippets:**

```5547:5549:src/pages/admin/Dashboard.tsx
        supabase.from('ambassador_applications').select(APPLICATIONS_LIST_COLUMNS).order('created_at', { ascending: false }),
        supabase.from('events').select(EVENTS_ADMIN_LIST_COLUMNS).order('date', { ascending: false }),
        supabase.from('ambassadors').select(AMBASSADORS_LIST_COLUMNS).order('created_at', { ascending: false }),
```

```721:721:src/pages/PassPurchase.tsx
          const { data: allRows, error: allErr } = await supabase.from('events').select('*');
```

```404:404:src/lib/ticketGenerationService.tsx
    await supabase.from('email_delivery_logs').insert({
```

**Risk:** Admin dashboard and ticket service use client Supabase for sensitive operations.

---

## Search: `from('admins'` / `from("admins"`

**Scope:** `*.{ts,tsx,js,jsx}`

| File | Lines |
|------|------:|
| `api/admin-login.js` | 226 |
| `api/admin-approve-order.js` | 115 |
| `api/scan.js` | 222, 260 |

**Risk:** No frontend direct admins query; backend uses anon key successfully due to RLS.

---

## Search: `from('orders'` / `from("orders"`

**Scope:** `*.{ts,tsx,js,jsx}` — 80+ matches

**Client-side (high risk):**

| File | Lines |
|------|------:|
| `src/lib/orders/orderService.ts` | 122, 187, 223, 250 |
| `src/lib/ambassadorOrders.ts` | 45, 54, 96, 123, 153 |
| `src/lib/ticketGenerationService.tsx` | 455 |

**Server-side:** `api/misc.js`, `api/orders-create.js`, `api/admin-pos.js`, `api/clictopay-generate-payment.js`

---

## Search: `from('tickets'` / `from("tickets"`

**Scope:** `*.{ts,tsx,js,jsx}`

**Client-side:**

```140:140:src/lib/ticketGenerationService.tsx
    .from('tickets')
```

Multiple INSERT/UPDATE at lines 153–498 in same file.

**Server-side:** `api/misc.js`, `api/admin-approve-order.js`, `api/admin-pos.js`

---

## Search: `localStorage`

| File | Lines | Notes |
|------|------:|-------|
| `src/integrations/supabase/client.ts` | 21 | Supabase Auth storage |
| `src/pages/admin/Dashboard.tsx` | 1078, 9374 | UI prefs |
| `src/pages/scanner/ScannerScan.tsx` | 26 | Scanner state |
| `src/hooks/usePhoneCapture.ts` | 14+ | Popup dismissal |
| `src/App.tsx` | 93, 113 | Theme |

**Risk:** Admin JWT not in localStorage (good).

---

## Search: `adminSession`

| File | Notes |
|------|-------|
| `src/pages/admin/components/AdminSessionCountdown.tsx` | UI component type only |
| `src/lib/admin-verify-cache.ts` | `ADMIN_SESSION_PENDING_KEY` — not adminSession |

---

## Search: `ambassadorSession`

| File | Notes |
|------|-------|
| `src/lib/api-client.ts` | 59–93 — ambassador session API handling |
| `src/pages/ambassador/Dashboard.tsx` | 280 — error log message |

No localStorage key named `ambassadorSession`.

---

## Search: `NEXT_PUBLIC_SUPABASE`

**Result:** 0 matches in codebase.

Project uses **Vite** convention `VITE_SUPABASE_*`.

---

## Search: `VITE_SUPABASE` / `SUPABASE_SERVICE_ROLE`

| Pattern | Hits |
|---------|------|
| `VITE_SUPABASE_URL` | client.ts, ticketGenerationService.tsx, env.example |
| `VITE_SUPABASE_ANON_KEY` | client.ts, env.example |
| `SUPABASE_SERVICE_ROLE_KEY` | api/* (server only), env.example |
| `service_role` in src | Error sanitization only |

---

## Search: `bcrypt` / `password_hash`

| File | Lines | Notes |
|------|------:|-------|
| `api/admin-login.js` | 231–238 | Server login |
| `src/pages/admin/Dashboard.tsx` | 239–240 | Client hash for new admin |
| `api/scan.js` | 190–286 | Scanner passwords |
| `api/pos.js` | 201–209 | POS login |

---

## Search: `verifyAdminAuth` / `verifyAdminSession`

40+ call sites in `api/misc.js`, plus `admin-pos.js`, `presale-route-admin-codes.js`, `admin-logs-route.js`, `event-promo-route-admin.js`.

---

## Search: `middleware`

**Result:** 0 middleware files — no global API auth middleware.

---

## Search: committed `.env*`

**Result:** 0 `.env` files; `env.example` only.
