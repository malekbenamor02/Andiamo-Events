# Overview Activity Orders / Revenue Investigation

**Date:** 2026-07-01  
**Scope:** Investigation only — no application code changes applied.

---

## 1. Screenshot / Question Context

**Location:** Admin → **Overview** tab → **Activity** chart → **Last 7 days**

**Chart series (from screenshot and code):**

| Line | Color (approx.) | Label |
|------|-----------------|-------|
| applications | Red / primary | Ambassador applications submitted |
| orders | Green | Order count |
| revenue | Yellow / amber | Revenue (TND) |

**Question:** Are **Orders** and **Revenue** based only on paid/confirmed orders and paid revenue, or do they also count unpaid/pending/COD/unconfirmed orders (and POS)?

**Short answer:**

| Metric | Paid-only? | Summary |
|--------|------------|---------|
| **Orders** | **No** | Counts **all** ambassador/COD + online orders **created** that calendar day, with almost no status/payment filter. |
| **Revenue** | **Mostly yes** | Sums revenue only from **paid/collected** orders: online `PAID`/`COMPLETED`, ambassador `PAID`/`COMPLETED`. Pending/unpaid/COD-not-collected do **not** add to revenue. |
| **POS** | **Not in chart** | POS is excluded from the Activity chart entirely. |

**Orders and Revenue use different semantics** — the chart can show high order counts with low revenue (or vice versa) when many orders are pending/unpaid.

---

## 2. Files Inspected

| File | Why it matters |
|------|----------------|
| `src/pages/admin/components/OverviewTab.tsx` | Renders Activity `LineChart`, series keys, “Last 7 days” label |
| `src/pages/admin/Dashboard.tsx` | `activityChartData` useMemo (core calculation); data loading for chart |
| `src/lib/orders/orderRevenue.ts` | `getOrderLineRevenue`, `getOrderReportRevenue` — amount math |
| `src/lib/adminOrdersApi.ts` | `chartOnlineOrders`, `listOnlineOrders`, `posOverviewOrders` client calls |
| `api/_lib/admin-orders-routes.cjs` | `GET /api/admin/orders/chart`, `/online`, `/pos-overview`, `/analytics/orders` |
| `api/_lib/admin-data-routes.js` | `GET /api/admin/dashboard/bootstrap` — `applications` array |
| `api/misc.js` | `GET /api/admin/ambassador-sales/orders`, `fetchAllPaginated` (1000-row cap doc) |
| `src/lib/constants/orderStatuses.ts` | `PaymentMethod`, status enums |
| `src/lib/constants/orderStatusCatalog.js` | Canonical `status` / `payment_status` strings |
| `src/types/orders.ts` | Order fields (`total_price`, `total_with_fees`, timestamps) |
| `supabase/migrations/20250201000004-fix-orders-table-structure.sql` | `completed_at` column exists |
| `docs/audits/overview-applications-stats-investigation-2026-07-01.md` | Prior cap investigation for applications bootstrap |
| `package.json` | Build/test scripts |

**Verified absent:** `paid_at`, `confirmed_at`, and `order_status` columns — searched `supabase/` migrations; no matches. Chart logic does not reference them.

---

## 3. Frontend Chart Flow

### Component rendering the chart

`OverviewTab.tsx` receives `activityChartData` as a prop and renders a Recharts `LineChart` with three lines: `applications`, `orders`, `revenue`.

```305:386:src/pages/admin/components/OverviewTab.tsx
      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {c.activity}
            </span>
            <span className="text-[11px] text-muted-foreground">{c.last7}</span>
          </div>
          ...
                <LineChart data={activityChartData} ...>
                  ...
                  <Line dataKey="applications" ... yAxisId="left" name="applications" />
                  <Line dataKey="orders" ... yAxisId="left" name="orders" />
                  <Line dataKey="revenue" ... yAxisId="right" name="revenue" />
```

Tooltip formats revenue as `TND`; orders/applications as raw counts.

### Chart data variable

Computed in `Dashboard.tsx` as `activityChartData` (useMemo), passed to `OverviewTab`.

### Calculation (frontend-side aggregation)

```924:956:src/pages/admin/Dashboard.tsx
  // Activity chart: last 7 days with Applications, Orders (ambassador + online), Revenue, Events created, Approved (per day)
  const activityChartData = useMemo(() => {
    const out: { name: string; applications: number; approved: number; orders: number; revenue: number; eventsCreated: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayLabel = format(d, 'EEE');
      const appCount = applications.filter((a: { created_at?: string }) => format(new Date(a.created_at || 0), 'yyyy-MM-dd') === dateStr).length;
      ...
      const dayAmbassador = codAmbassadorOrders.filter((o: { created_at?: string }) => format(new Date(o.created_at || 0), 'yyyy-MM-dd') === dateStr);
      const dayOnline = onlineOrdersForChart.filter((o: { created_at?: string }) => format(new Date(o.created_at || 0), 'yyyy-MM-dd') === dateStr);
      const ambassadorRevenue = dayAmbassador
        .filter((o: any) => ['PAID', 'COMPLETED'].includes(o.status))
        .reduce((s: number, o: any) => s + getOrderLineRevenue(o), 0);
      const chartOnlinePaid = (o: any) =>
        o.payment_status === 'PAID' || o.status === 'PAID' || o.status === 'COMPLETED';
      const onlineRevenue = dayOnline
        .filter((o: any) => chartOnlinePaid(o))
        .reduce((s: number, o: any) => s + getOrderReportRevenue(o), 0);
      ...
      out.push({
        name: dayLabel,
        applications: appCount,
        ...
        orders: dayAmbassador.length + dayOnline.length,
        revenue: Math.round(ambassadorRevenue + onlineRevenue),
        ...
      });
    }
    return out;
  }, [applications, codAmbassadorOrders, onlineOrdersForChart, events]);
```

### Date range logic (“Last 7 days”)

| Aspect | Behavior |
|--------|----------|
| **Where computed** | Frontend only (`Dashboard.tsx`) |
| **Window** | 7 **calendar days**: today + previous 6 days (`i = 6 … 0`) |
| **Timezone** | **Browser local timezone** via `date-fns` `format(..., 'yyyy-MM-dd')` |
| **Grouping timestamp** | **`created_at` only** — not `updated_at`, `completed_at`, `payment_status_set_at`, etc. |
| **X-axis labels** | `format(d, 'EEE')` — weekday abbreviations (Thu–Wed in screenshot) |

**Note on screenshot:** All three series at **zero on Wednesday** is consistent with “today” being the current (possibly incomplete) calendar day with no `created_at` rows yet, not necessarily a bug.

---

## 4. Data Source Flow

```
OverviewTab
  └─ activityChartData (prop)
       └─ Dashboard.tsx useMemo
            ├─ applications          ← bootstrap GET /api/admin/dashboard/bootstrap
            ├─ codAmbassadorOrders   ← GET /api/admin/ambassador-sales/orders?limit=1000&event_id=…
            └─ onlineOrdersForChart  ← GET /api/admin/orders/chart?event_id=…
```

### Frontend requests

| Data | Trigger | API |
|------|---------|-----|
| `applications` | Dashboard bootstrap on load | `GET /api/admin/dashboard/bootstrap` |
| `codAmbassadorOrders` | `selectedEventId` change + ambassador-sales access | `GET /api/admin/ambassador-sales/orders?limit=1000&event_id=…` |
| `onlineOrdersForChart` | `selectedEventId` change + (`online-orders` or `overview` tab access) | `GET /api/admin/orders/chart?event_id=…` |

```1711:1730:src/pages/admin/Dashboard.tsx
  /** One source of truth: changing the header event reloads ambassador + online data and the overview activity chart for that event. */
  useEffect(() => {
    if (!selectedEventId) return;
    if (canAccessTab('ambassador-sales')) {
      void fetchAmbassadorSalesData();
    }
    ...
    if (canAccessTab('online-orders') || canAccessTab('overview')) {
      (async () => {
        try {
          const result = await adminOrdersApi.chartOnlineOrders(selectedEventId);
          setOnlineOrdersForChart(result.data || []);
        } catch {
          setOnlineOrdersForChart([]);
        }
      })();
    }
  }, [selectedEventId, canAccessTab]);
```

### Backend handlers

**Online chart rows** — `api/_lib/admin-orders-routes.cjs`:

```101:129:api/_lib/admin-orders-routes.cjs
  // GET /api/admin/orders/chart — last 7 days online orders for overview chart
  app.get('/api/admin/orders/chart', ... requireAdminPermission('orders:manage'), async (req, res) => {
    ...
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await db
      .from('orders')
      .select('id, created_at, total_price, total_with_fees, status, payment_status, payment_method, notes, order_passes (quantity, price)')
      .eq('source', 'platform_online')
      .gte('created_at', sevenDaysAgo.toISOString())
      .eq('event_id', event_id);
```

**Ambassador/COD rows** — `api/misc.js`:

```5076:5095:api/misc.js
        function buildAmbassadorOrdersSelect(selectStr) {
          let q = dbClient
            .from('orders')
            .select(selectStr, { count: 'exact' })
            .eq('payment_method', 'ambassador_cash')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
          ...
          if (status === 'REMOVED_BY_ADMIN') {
            q = q.eq('status', 'REMOVED_BY_ADMIN');
          } else {
            q = q.neq('status', 'REMOVED_BY_ADMIN');
```

Frontend then keeps only `payment_method === 'ambassador_cash'` **and** `source` in `['platform_cod', 'ambassador_manual']`:

```2456:2460:src/pages/admin/Dashboard.tsx
      const codAmbassadorData = allOrdersData.filter((order: any) => 
        order.payment_method === 'ambassador_cash' && 
        ['platform_cod', 'ambassador_manual'].includes(order.source)
      );
```

**Applications** — bootstrap, no pagination:

```75:82:api/_lib/admin-data-routes.js
      const appsRes = await db
        .from('ambassador_applications')
        .select(appsCols)
        .order('created_at', { ascending: false });
      ...
      payload.applications = appsRes.data || [];
```

### Aggregation location

| Series | Aggregated where | Server-side aggregates? |
|--------|------------------|-------------------------|
| applications | Frontend (filter bootstrap array by day) | No |
| orders | Frontend (count loaded arrays by day) | No |
| revenue | Frontend (filter + sum loaded arrays by day) | No |

**Not mock/fallback data** — real API/bootstrap arrays; empty array on fetch failure for online chart.

### DB table

All order series read from **`public.orders`** (+ embedded `order_passes`). Applications from **`public.ambassador_applications`**.

---

## 5. Orders Calculation

### Definition

**Orders (daily count)** = count of `codAmbassadorOrders` created that day **plus** count of `onlineOrdersForChart` created that day.

**No filter** on `status`, `payment_status`, or payment completion for the **count**.

### Filters at fetch time (what enters the arrays)

| Source | Included | Excluded at fetch |
|--------|----------|-------------------|
| Ambassador/COD | `payment_method = ambassador_cash`, not `REMOVED_BY_ADMIN`, sources `platform_cod` / `ambassador_manual`, `event_id` match, max **1000** newest rows | `REMOVED_BY_ADMIN` |
| Online chart | `source = platform_online`, `created_at >= server_now - 7 calendar days`, `event_id` match | No status filter; **`REMOVED_BY_ADMIN` not excluded** (unlike `/orders/online`) |

Compare online list endpoint (used by Online Orders tab):

```72:78:api/_lib/admin-orders-routes.cjs
        let query = db
          .from('orders')
          .select(ONLINE_ORDERS_SELECT)
          .eq('source', 'platform_online')
          .neq('status', 'REMOVED_BY_ADMIN')
          .order('created_at', { ascending: false })
          .limit(lim);
```

### Timestamp for grouping

**`created_at`** (order creation), formatted to `yyyy-MM-dd` in **browser local timezone**.

### Order type / status inclusion table

| Order type/status | Included in Activity Orders? | Evidence |
|-------------------|------------------------------|----------|
| Paid online | **Yes** | Counted via `dayOnline.length`; no paid filter on count — `Dashboard.tsx` L950 |
| Pending online payment (`PENDING_ONLINE`, `PENDING_PAYMENT`) | **Yes** | Same count logic; not filtered out |
| Failed / cancelled online | **Yes** | Chart API has no status exclusion; count includes all fetched rows |
| COD ambassador cash (any non-removed status) | **Yes** | `dayAmbassador.length` — `Dashboard.tsx` L950 |
| COD pending (`PENDING_CASH`, etc.) | **Yes** | Counted; revenue excluded separately |
| POS (`source = point_de_vente`) | **No** | Not loaded for chart; only `posOrdersForOverview` for KPI strip |
| Refunded | **Yes** (if still in fetched set) | Count includes row; chart API does not exclude `REFUNDED` |
| Removed by admin (online) | **Yes** (if in chart API result) | Chart route lacks `.neq('status', 'REMOVED_BY_ADMIN')` |
| Removed by admin (ambassador) | **No** | API excludes — `api/misc.js` L5086 |

---

## 6. Revenue Calculation

### Definition

**Revenue (daily)** = sum of paid ambassador revenue + sum of paid online revenue, rounded to integer TND.

### Ambassador / COD revenue

- **Filter:** `status` in `['PAID', 'COMPLETED']` only
- **Amount:** `getOrderLineRevenue(o)` — line items / `order_passes`, or discounted subtotal from `notes`, or `total_price` / `total`
- **Not included:** `MANUAL_COMPLETED` (used elsewhere in codebase for completed manual/COD flows)

### Online revenue

- **Filter:** `payment_status === 'PAID'` **OR** `status === 'PAID'` **OR** `status === 'COMPLETED'`
- **Amount:** `getOrderReportRevenue(o)` — for paid online, prefers `total_with_fees`, then `notes.payment_fees.total_with_fees`, then computed fee on subtotal; includes payment fees when paid

```126:168:src/lib/orders/orderRevenue.ts
export function getOrderReportRevenue(order: { ... }): number {
  const line = getOrderLineRevenue(order);
  if (order.payment_method !== PaymentMethod.ONLINE) {
    return line;
  }
  const paidOnline =
    order.payment_status === 'PAID' || order.status === 'PAID' || order.status === 'COMPLETED';
  if (!paidOnline) {
    return line;
  }
  const twf = Number(order.total_with_fees);
  ...
```

### Fields used

| Field | Used? | Purpose |
|-------|-------|---------|
| `status` | Yes | Revenue filters; ambassador paid = `PAID`/`COMPLETED` |
| `payment_status` | Yes | Online paid check |
| `payment_method` | Yes | API filters; fee logic in `getOrderReportRevenue` |
| `source` | Yes | `platform_online` (chart API); COD source filter on client |
| `total_price` | Yes | Fallback revenue |
| `total_with_fees` | Yes | Paid online revenue (preferred) |
| `amount` | **No** | Not referenced in chart path |
| `created_at` | Yes | Day bucket only |
| `updated_at` | No | |
| `completed_at` | No | Exists on table but unused in chart |
| `paid_at` / `confirmed_at` | **Do not exist** | Verified: no columns in migrations |

Discounts: applied via `notes` promo/presale discounted subtotal in `getOrderDiscountedSubtotalFromNotes`.

### Revenue source / status table

| Revenue source/status | Included in Activity Revenue? | Evidence |
|-----------------------|-------------------------------|----------|
| Paid online orders | **Yes** | `chartOnlinePaid` + `getOrderReportRevenue` — `Dashboard.tsx` L940–944 |
| Pending/unpaid online orders | **No** | Filtered out by `chartOnlinePaid` |
| COD pending / not collected | **No** | Ambassador revenue requires `PAID`/`COMPLETED` — L937–938 |
| COD completed/collected (`PAID`/`COMPLETED`) | **Yes** | `getOrderLineRevenue` on filtered rows |
| COD `MANUAL_COMPLETED` | **No** | Not in `['PAID', 'COMPLETED']` filter |
| POS paid sales | **No** | POS not in chart data sources |
| Cancelled/refunded orders | **No** (revenue) | Unpaid/refunded fail `chartOnlinePaid`; cancelled COD not `PAID`/`COMPLETED` |

**Important:** Unpaid online orders still **increment Orders** but contribute **zero** to Revenue — this explains diverging green vs yellow lines in the screenshot.

---

## 7. Applications Calculation

- **Source:** In-memory `applications` from dashboard bootstrap (not `applicationStats` exact counts).
- **Logic:** Count rows where `format(created_at, 'yyyy-MM-dd')` matches each of the 7 calendar days.
- **Filter:** None by status — all statuses counted on submission day.
- **Accuracy:** Same **~1000-row PostgREST cap** risk as documented in `overview-applications-stats-investigation-2026-07-01.md` — bootstrap query has no pagination/`fetchAllPaginated`.
- **Not server-side daily aggregates.**

---

## 8. Cap / Accuracy Risk

| Risk | Present? | Details |
|------|----------|---------|
| **1000-row cap** | **Yes** | Bootstrap `applications`; ambassador orders `limit=1000`; chart online query has **no `.limit()`** → PostgREST default **1000 rows** |
| **Timezone mismatch** | **Yes** | Frontend buckets by **local calendar day**; chart API filters `created_at >= server_now - 7 days` (server TZ, typically UTC on Vercel). Edge days can disagree. |
| **Wrong timestamp** | **Possible** | Uses **`created_at`**, not payment/completion time — paid order can appear on creation day, not payment day. |
| **Unpaid revenue risk** | **No for revenue** | Revenue is paid-filtered. |
| **Orders vs revenue semantics** | **Yes** | Orders count all statuses; revenue paid-only — misleading if read as “confirmed business.” |
| **COD/POS mismatch** | **Yes** | COD pending counted in orders not revenue; POS omitted from chart but included in super-admin KPI strip (`dashboardOrderStats`). |
| **Frontend/backend mismatch** | **Yes** | Ambassador fetch has **no 7-day server filter** (1000 newest globally for event); online fetch has 7-day server filter; frontend re-buckets both locally. |
| **MANUAL_COMPLETED gap** | **Yes** | May count as order but not revenue. |

---

## 9. Root Cause Assessment

**Orders are NOT paid-only.** The chart counts every ambassador/COD and online order **created** on each day (subject to fetch caps and fetch-time exclusions).

**Revenue IS paid/collected-only** (with caveats):

- Online: requires `payment_status === 'PAID'` or `status` in `PAID`/`COMPLETED`.
- Ambassador: requires `status` in `PAID`/`COMPLETED` only (excludes `MANUAL_COMPLETED`).
- Pending COD, pending online, failed, cancelled, expired orders: **in Orders, not in Revenue**.
- POS: **neither Orders nor Revenue** in Activity chart.

**Mixed behavior is intentional in code but likely unintentional for product semantics:** the green “orders” line measures **order creation volume**; the yellow “revenue” line measures **recognized paid revenue by creation day** — not the same business definition.

Screenshot pattern (orders rising while revenue flat, then revenue spike): consistent with many pending/unpaid orders created first, then payments completing later — but both still bucketed by **`created_at`**, not payment time.

---

## 10. Business Logic Recommendation

*(Do not implement — for review only.)*

Suggested target semantics for Overview Activity:

| Series | Recommended meaning |
|--------|---------------------|
| **Applications** | Submissions per day (`created_at`), using **exact server counts** (not capped bootstrap array). |
| **Orders** | **Valid confirmed orders per day** — paid online + collected COD + completed POS (if Overview should represent whole business). Exclude cancelled/failed/expired/removed/refunded. |
| **Revenue** | **Paid/collected revenue only**, bucketed by **payment/completion date** (`completed_at` or `payment_status_set_at`), not creation date. Include online fees for paid online. COD only when `COMPLETED`/`PAID`/`MANUAL_COMPLETED`. Include POS if Overview is total business view. |

Align chart with welcome-strip KPIs (`dashboardOrderStats`) or document clearly that Activity “orders” ≠ “paid orders.”

---

## 11. Recommended Fix Options

### Option A — Frontend-only: align Orders count with Revenue filters (minimal)

**Files:** `src/pages/admin/Dashboard.tsx` (`activityChartData` useMemo)

**Logic:** Change `orders` to count only the same rows included in revenue (plus optionally pending if “pipeline” desired — recommend **not**).

**Pros:** Smallest diff; orders/revenue lines comparable.  
**Cons:** Still capped arrays; still `created_at` bucketing; no POS; timezone/cap issues remain.  
**Risk:** Low  
**Tests:** Manual chart checks; optional unit test on pure aggregation helper extracted from useMemo.

---

### Option B — Server-side daily aggregates API (recommended for accuracy)

**Files:** New route e.g. `api/_lib/admin-orders-routes.cjs` (`GET /api/admin/dashboard/activity?event_id=&days=7`); `Dashboard.tsx`; `adminOrdersApi.ts`

**Logic:** SQL/`count` queries per day for:

- applications: `count(*)` from `ambassador_applications` grouped by date
- orders: count with status/payment filters
- revenue: `sum(...)` with paid filters, optional POS join

Use `fetchAllPaginated` pattern or `date_trunc` aggregates — no row cap.

**Pros:** Accurate counts; single timezone policy; matches business rules explicitly.  
**Cons:** More backend work; must define rules in one place.  
**Risk:** Medium  
**Tests:** New `api/_lib/admin-activity-chart.test.cjs`; manual cross-check vs Reports.

---

### Option C — Reuse Reports analytics patterns

**Files:** Extend `GET /api/admin/analytics/orders` or add sibling endpoint; wire chart to that instead of raw row arrays.

**Logic:** Mirror Reports paid/pending splits (`admin-orders-routes.cjs` L189–208 already filters `status IN ('PAID','COMPLETED')` for paid query).

**Pros:** Consistency with Reports & Analytics tab.  
**Cons:** Reports uses different permission (`reports:view` vs `orders:manage`); may need POS channel rules; still need daily grouping endpoint.  
**Risk:** Medium  
**Tests:** Parity tests against existing reports export tests.

---

## 12. Verification Plan

### Manual (after any future fix)

1. **Paid online order** — create/pay; confirm day bucket in chart for orders **and** revenue.
2. **Unpaid online order** — `PENDING_ONLINE` / `PENDING_PAYMENT`; confirm intended include/exclude for orders vs revenue.
3. **COD pending** — `PENDING_CASH`; should not add revenue; decide if it should add orders.
4. **COD completed** — `COMPLETED` or `MANUAL_COMPLETED`; confirm revenue inclusion if business requires.
5. **POS sale** — super_admin; confirm whether Overview Activity should show it (currently does not).
6. **Cancelled/refunded** — confirm excluded from revenue; decide on orders count.
7. **Event filter** — change header event; chart updates for selected event only.
8. **>1000 orders in 7 days** — stress test cap (Option B required to pass).

### Automated

| Command | Purpose |
|---------|---------|
| `npm run build` | **Passed** during this investigation (2026-07-01) |
| `npm run test:admin-api-authz-coverage` | Auth coverage for admin order routes |
| `npm test` | Vitest suite (no dedicated Activity chart tests found) |

**Suggested new tests:**

- API: daily aggregate endpoint returns correct counts for fixture orders across statuses.
- Frontend: unit test for day-bucketing + paid filters (if logic stays client-side).

---

## Appendix: Inconsistencies vs Other Dashboard Areas

| Area | Orders definition | Revenue definition | POS | Data limit |
|------|-------------------|--------------------|-----|------------|
| **Activity chart** | All created (ambassador + online) | Paid only | No | ~1000 rows |
| **Welcome KPI strip** (`dashboardOrderStats`) | N/A (shows revenue/tickets) | Paid + **pending** split; POS for super_admin | Yes (super_admin) | 1000 amb / 4000 online |
| **Online Orders tab** | Lists all non-removed online (up to 4000) | N/A in list | No | 4000 |
| **Ambassador Sales / COD tab** | Full list with filters | N/A in chart | No | 1000 |
| **Reports analytics** | Paid status server filter | Paid/pending queries | Separate POS query | 10000 limit |

**Key inconsistency:** Activity **orders** line is the **broadest** order count; Activity **revenue** is **narrower** than welcome strip **totalRevenue** (which includes pending revenue — `dashboardOrderStats.totalRevenue = paidRevenue + pendingRevenue`).

---

*End of investigation report.*
