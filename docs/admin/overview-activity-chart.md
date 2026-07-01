# Overview Activity Chart — Reference

**Last updated:** 2026-07-01  
**Location:** Admin Dashboard → **Overview** tab → **Paid activity** panel  
**Subtitle:** “Last 7 days” / “7 derniers jours”

This document describes the Activity line chart: what it measures, how data is aggregated, and tooltip breakdown fields.

---

## Product question

> Of the orders **created** on each day, how many became paid, how much paid revenue did they produce, and what pending pipeline was also created that day?

---

## UI summary

| Element | EN | FR |
|---------|----|----|
| Title | Paid activity | Activité payée |
| Subtitle | Last 7 days | 7 derniers jours |
| Footnote | Paid orders and revenue are grouped by order creation date. | Les commandes payées et le revenu sont regroupés par date de création de commande. |

### Main chart lines (3)

| Line | Color | Axis | Meaning |
|------|-------|------|---------|
| Applications | Primary | Left | Ambassador applications **submitted** that UTC day |
| Paid orders | Green `#10b981` | Left | **Paid/collected** orders **created** that UTC day |
| Paid revenue | Amber `#f59e0b` | Right | Paid revenue from those orders (integer TND) |

**Pending pipeline is not a chart line** — it appears only in the tooltip.

### Tooltip (hover desktop / tap mobile)

Shows full date (e.g. `Monday, 01/07/2026`) plus:

- Applications  
- Orders created: Paid / Pending / Total  
- Revenue: Paid revenue / Pending pipeline / Total potential  

---

## Data flow

```
OverviewTab
  └─ activityChartData
       └─ Dashboard.tsx
            └─ GET /api/admin/dashboard/activity?event_id=…&days=7
                 └─ api/_lib/admin-dashboard-activity.cjs
```

- **Source of truth:** server API only (client fallback removed).  
- **On API failure:** previous chart data kept when available; warning message shown.  
- **Loading:** skeleton on first load; stale data dimmed with “Updating…” on event switch.

---

## API

**`GET /api/admin/dashboard/activity`**

| Param | Required | Default |
|-------|----------|---------|
| `event_id` | Yes | — |
| `days` | No | `7` (max 30) |

**Permission:** `dashboard:view`

### Response shape

```typescript
interface DashboardActivityDay {
  name: string;              // UTC weekday abbrev (Mon, Tue, …)
  date: string;              // YYYY-MM-DD UTC
  applications: number;

  orders: number;            // paid orders created this day (main line)
  revenue: number;           // paid revenue (main line), integer TND

  pendingOrders: number;     // tooltip only
  pendingRevenue: number;    // pending pipeline (tooltip only), integer TND
  totalCreatedOrders: number;
  totalPotentialRevenue: number;
}
```

---

## Bucketing (UTC)

| Series | Timestamp |
|--------|-----------|
| Applications | `ambassador_applications.created_at` |
| Paid orders / paid revenue | `orders.created_at` |
| Pending orders / pending pipeline | `orders.created_at` |

**Not used for this chart:** `completed_at`, `payment_status_set_at`.

Orders **created before** the 7-day UTC window are excluded even if paid later inside the window.

---

## Paid order rules

### Online
- `source = platform_online`
- `payment_method = online`
- `payment_status = PAID` OR `status ∈ {PAID, COMPLETED}`
- Exclude: `REMOVED_BY_ADMIN`, `REFUNDED`

### COD / Ambassador cash
- `payment_method = ambassador_cash`
- `source ∈ {platform_cod, ambassador_manual}`
- `status ∈ {PAID, COMPLETED, MANUAL_COMPLETED}`

### POS
- `source = point_de_vente`
- `status ∈ {PAID, COMPLETED}`

### Excluded sources
- `official_invitation`, `Invitation`

---

## Pending order rules (tooltip only)

Aligned with Overview KPI pending logic.

### Online pending
- Same source/method as online paid
- Not paid; not terminal
- Include: `PENDING_ONLINE`, `REDIRECTED`, `PENDING_PAYMENT`, null `payment_status`
- Exclude terminal: `CANCELLED*`, `REJECTED`, `FAILED`, `REFUNDED`, `EXPIRED`, `REMOVED_BY_ADMIN`

### COD pending
- `status ∈ {PENDING_CASH, PENDING_ADMIN_APPROVAL, PENDING_AMBASSADOR_CONFIRMATION, APPROVED}`

### POS pending
- `status = PENDING_ADMIN_APPROVAL` (only real POS pending state in codebase)

---

## Revenue calculation

| Type | Helper | Notes |
|------|--------|-------|
| **Paid revenue** | `getOrderReportRevenue()` for online paid; `getOrderTicketsAndRevenue()` for COD/POS | Online includes fees when paid |
| **Pending pipeline** | `getOrderTicketsAndRevenue().revenue` | Line subtotal only — **no** online payment fees |

All daily revenue fields rounded with `Math.round()` to integer TND.

---

## Server queries

Orders fetched with **`created_at` between window start/end** (UTC), per channel:

- `platform_online`
- `ambassador_cash` + COD sources
- `point_de_vente`

Paginated at 1000 rows per page. Classification (paid vs pending vs skip) happens in memory.

---

## Files

| File | Role |
|------|------|
| `api/_lib/admin-dashboard-activity.cjs` | Server aggregation |
| `api/_lib/admin-dashboard-activity.test.cjs` | Server tests |
| `src/lib/adminApi.ts` | Types + fetch |
| `src/pages/admin/Dashboard.tsx` | Load + pass props |
| `src/pages/admin/components/OverviewTab.tsx` | Chart + tooltip UI |
| `src/lib/orders/activityChartOrders.ts` | Client predicates (tests/parity) |

---

## Tests

```bash
node --test api/_lib/admin-dashboard-activity.test.cjs
npx vitest run src/lib/orders/activityChartOrders.test.ts
```

---

## Quick reference

```
PAID ACTIVITY (Last 7 UTC days, per event)

applications     = submissions that day (created_at)
orders (green)   = paid orders CREATED that day
revenue (orange) = paid revenue from those orders
tooltip pending  = pipeline orders CREATED that day (not on chart lines)
```
