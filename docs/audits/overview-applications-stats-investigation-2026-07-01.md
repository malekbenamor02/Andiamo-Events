# Overview Applications Stats Investigation

**Date:** 2026-07-01  
**Scope:** Investigation only — no code changes applied.

---

## 1. Reproduction / Screenshot Context

**Location:** Admin → **Overview** tab → **Applications** panel (right column, progress bars).

**Observed values (from screenshot):**

| Metric | Value |
|--------|------:|
| Pending | 625 |
| Approved | 68 |
| Rejected | 253 |
| **Displayed Total** | **1000** |
| Sum of shown rows | **946** |
| **Missing from breakdown** | **54** |

**User-reported problems:**

1. Total (1000) does not equal Pending + Approved + Rejected (946).
2. Paused applications are not shown in the Overview Applications section.

---

## 2. Files Inspected

| File | Relevance |
|------|-----------|
| `src/pages/admin/components/OverviewTab.tsx` | Renders Applications panel, progress bars, Total |
| `src/pages/admin/Dashboard.tsx` | Loads `applications` via bootstrap; computes `pendingApplications`, `approvedCount`; passes props to Overview |
| `src/pages/admin/components/ApplicationsTab.tsx` | Ambassador Applications tab (separate UI, same data) |
| `src/pages/admin/components/applications/ApplicationsListCore.tsx` | Status filters including **Paused** (`suspended`) and **Removed** |
| `src/pages/admin/lib/filterApplications.ts` | Client-side status filtering for Applications tab |
| `src/lib/adminApi.ts` | `fetchDashboardBootstrap()`, `listAmbassadorApplications()` |
| `api/_lib/admin-data-routes.js` | `GET /api/admin/dashboard/bootstrap`, `GET /api/admin/ambassador-applications` |
| `api/misc.js` | `fetchAllPaginated()` helper documenting PostgREST **1000-row cap** (not used for applications bootstrap) |
| `supabase/migrations/20250716190755-*.sql` | Original `ambassador_applications` table |
| `supabase/migrations/20250131000004-add-removed-status-and-reapply-delay.sql` | Adds `removed` status |
| `supabase/migrations/20250203000000-add-suspended-status-to-applications.sql` | Adds `suspended` status (UI label: Paused) |
| `supabase/migrations/20250215000001-update-ambassadors-status-enum.sql` | Separate `ambassadors.status` enum (ACTIVE/PAUSED/…) |

---

## 3. Frontend Overview Flow

### Component chain

```
Dashboard.tsx
  └─ fetchAllData() → adminApi.fetchDashboardBootstrap()
  └─ setApplications(appsData)
  └─ pendingApplications = applications.filter(app => app.status === 'pending')
  └─ approvedCount = applications.filter(app => app.status === 'approved' && matching ambassador)
  └─ OverviewTab
       └─ rejectedCount = applications.filter(a => a.status === 'rejected').length
       └─ totalApps = applications.length
       └─ Applications panel (progress bars + Total)
```

### Applications panel rendering (`OverviewTab.tsx`)

**Total:**

```193:194:src/pages/admin/components/OverviewTab.tsx
  const rejectedCount = applications.filter((a) => a.status === "rejected").length;
  const totalApps = applications.length;
```

**Rows shown (only three):**

```363:381:src/pages/admin/components/OverviewTab.tsx
              {[
                {
                  label: c.pending,
                  count: pendingApplications.length,
                  pct: totalApps > 0 ? (pendingApplications.length / totalApps) * 100 : 0,
                  bar: "bg-amber-500",
                },
                {
                  label: c.approved,
                  count: approvedCount,
                  pct: totalApps > 0 ? (approvedCount / totalApps) * 100 : 0,
                  bar: "bg-emerald-500",
                },
                {
                  label: c.rejected,
                  count: rejectedCount,
                  pct: totalApps > 0 ? (rejectedCount / totalApps) * 100 : 0,
                  bar: "bg-red-500",
                },
              ].map((row) => (
```

**Total row:**

```396:398:src/pages/admin/components/OverviewTab.tsx
              <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
                <span className="text-muted-foreground">{c.totalApplications}</span>
                <span className="font-semibold tabular-nums text-primary">{totalApps}</span>
```

### Progress bar denominator

All three bars use **`totalApps` (= `applications.length`)** as the denominator (`pct: count / totalApps * 100`).

There is **no** hardcoded `1000` in Overview UI code.

### Special `approvedCount` logic (Dashboard)

Overview **Approved** is **not** `applications.filter(status === 'approved').length`:

```7549:7557:src/pages/admin/Dashboard.tsx
  const pendingApplications = applications.filter(app => app.status === 'pending');
  // Count approved applications that have corresponding ambassadors (1:1 relationship)
  const approvedCount = applications.filter(app => 
    app.status === 'approved' && 
    ambassadors.some(amb => 
      amb.phone === app.phone_number || 
      (app.email && amb.email && app.email === amb.email)
    )
  ).length;
```

So **approved applications without a matching ambassador record are counted in Total but not in the Approved bar.**

---

## 4. Data Source Flow

### Frontend request

On dashboard load:

```5176:5181:src/pages/admin/Dashboard.tsx
      const bootstrap = await adminApi.fetchDashboardBootstrap();
      const appsData = bootstrap.applications;
      // ...
      setApplications(appsData || []);
```

`adminApi.fetchDashboardBootstrap()` → `GET /api/admin/dashboard/bootstrap` (`src/lib/adminApi.ts`).

Standalone applications endpoint (same unpaginated query pattern):

`GET /api/admin/ambassador-applications` via `adminApi.listAmbassadorApplications()`.

### Backend handler (`api/_lib/admin-data-routes.js`)

```44:54:api/_lib/admin-data-routes.js
    if (hasEffectivePermission(permissions, PERM.APPLICATIONS)) {
      const appsCols =
        'id, full_name, age, city, ville, social_link, phone_number, email, motivation, status, created_at, updated_at, reapply_delay_date, manually_added, reviewed_by_admin_id, reviewed_at, reviewed_by_name, meta_attribution, meta_lead_sent_at';
      const appsRes = await db
        .from('ambassador_applications')
        .select(appsCols)
        .order('created_at', { ascending: false });
      // ...
      payload.applications = appsRes.data || [];
```

**No `.limit()` / pagination / count query.**

Same for standalone GET:

```313:318:api/_lib/admin-data-routes.js
    const { data, error } = await ctx.db
      .from('ambassador_applications')
      .select('*')
      .order('created_at', { ascending: false });
```

### Database table

- **Table:** `public.ambassador_applications`
- **No stats RPC or aggregate view** used for Overview metrics.
- All counts are **client-side** filters on the loaded array.

### PostgREST 1000-row cap (important)

Elsewhere in the codebase, PostgREST’s default page size is explicitly documented:

```166:167:api/misc.js
/** Fetch all rows from a PostgREST query (default 1000-row page cap). */
async function fetchAllPaginated(buildPageQuery, pageSize = 1000) {
```

Bootstrap **does not** use `fetchAllPaginated`. Supabase/PostgREST returns **at most 1000 rows** per select unless paginated or `Range` headers are used.

**If the database has ≥ 1000 application rows, `applications.length` will be exactly 1000** (newest first due to `order('created_at', { ascending: false })`), regardless of true DB count.

The screenshot Total of **1000** is consistent with this cap, not with a hardcoded constant.

---

## 5. Status Model

### `ambassador_applications.status` (DB constraint, current migrations)

From `20250203000000-add-suspended-status-to-applications.sql`:

```sql
CHECK (status IN ('pending', 'approved', 'rejected', 'removed', 'suspended'))
```

**`paused` is not a DB status.** UI label **“Paused”** maps to status **`suspended`** (`ApplicationsListCore.tsx` SelectItem value `suspended`).

### Separate table: `ambassadors.status`

After `20250215000001-update-ambassadors-status-enum.sql`, ambassador accounts use values like **ACTIVE**, **PAUSED**, **PENDING**, **REJECTED** — independent from application row status.

Pausing an ambassador in the Ambassadors tab updates **`ambassadors.status`** via API; application status sync on PATCH **does not include status** (`buildApplicationSyncPatchFromAmbassadorRow` only syncs profile fields like email/phone — `api/_lib/admin-data-route-helpers.js`).

### Status coverage table

| Status | Exists in DB/code? | Counted in Overview Total? | Displayed in Overview panel? | Displayed in Applications tab? |
|--------|--------------------|----------------------------|------------------------------|--------------------------------|
| `pending` | Yes | Yes | Yes (Pending row) | Yes (filter + list) |
| `approved` | Yes | Yes | Partially — only if linked ambassador (`approvedCount`) | Yes |
| `rejected` | Yes | Yes | Yes (Rejected row) | Yes |
| `suspended` (UI: **Paused**) | Yes | Yes | **No** | Yes (filter “Paused”) |
| `removed` | Yes | Yes | **No** | Yes (filter “Removed”) |
| `approved` without ambassador match | Yes (status still `approved`) | Yes | **No** (excluded from Approved bar) | Yes (shows as approved in list) |

---

## 6. Root Cause Assessment

**Two compounding issues explain the screenshot — not a single hardcoded “1000”.**

### Issue A — Total often stuck at 1000 (fetch cap)

**Evidence:**

- Total = `applications.length` (not a constant).
- Bootstrap loads applications with a plain `.select()` and **no pagination**.
- PostgREST default max rows = **1000** (documented in `api/misc.js`).
- Screenshot Total = **exactly 1000** → strong indicator the loaded array hit the cap.

**Effect:** If DB has 1000+ applications, Overview Total **under-reports** true DB size and omits older rows entirely from all metrics.

**Not the cause of 946 ≠ 1000 within the loaded set** — that gap is Issue B.

### Issue B — Breakdown omits statuses + Approved uses subset logic (explains 54 missing)

Within the loaded 1000 rows:

```
625 (pending) + 68 (approvedCount) + 253 (rejected) = 946
1000 - 946 = 54 unaccounted in UI
```

Those **54** are applications in `applications` with statuses/conditions **not represented** in any of the three bars:

1. **`suspended`** (Paused) — counted in Total, **no Overview row** (confirmed: Overview only maps pending/approved/rejected).
2. **`removed`** — counted in Total, **no Overview row**.
3. **`approved` without matching ambassador** — counted in Total, **excluded from Approved** because `approvedCount` requires ambassador phone/email match.

Any combination summing to 54 is plausible; **`suspended` + `removed` + orphan approved** is the expected mix given code paths.

**Paused hypothesis:** Valid. Paused applications use status **`suspended`** in `ambassador_applications`. They are **not shown** in Overview but **are included** in Total. Applications tab supports filtering them (`ApplicationsListCore.tsx` value `suspended`, label “Paused”).

**Not caused by:**

- Hardcoded `1000` in Overview component (verified — uses `.length`).
- Separate stats API returning wrong totals (no stats API; same bootstrap array everywhere).
- Mock/fallback data for applications (bootstrap from DB).

### Progress bars

Bars divide by `totalApps` (= capped `applications.length`). When Issue B applies, bars **under-sum to 100%** visually (946/1000 = 94.6% combined bar coverage) because hidden categories are in the denominator but not shown as rows.

---

## 7. Impact

| Area | Impact |
|------|--------|
| **Dashboard accuracy** | **Display only** — Overview Total and breakdown can mislead admins. |
| **Paused visibility** | Paused (`suspended`) apps exist in data and Applications tab but **invisible on Overview**. |
| **Admin decision-making** | Pending/Approved/Rejected appear complete but **54+ apps are hidden** from breakdown; Total may cap at 1000. |
| **Application workflow** | **No DB corruption** — approve/reject/pause workflows unchanged; this is aggregation/UI logic. |
| **Database integrity** | **Not affected** — counts are computed client-side from partial fetch. |

Ambassador **pause** on the Ambassadors tab updates `ambassadors.status`; application row may remain `approved` in DB after refresh (status not synced server-side). Overview Approved metric already diverges from simple `status === 'approved'` count.

---

## 8. Recommended Fix Options

### Option A — Paginate bootstrap applications fetch (fix 1000 cap)

**Files:** `api/_lib/admin-data-routes.js` (bootstrap + `GET /api/admin/ambassador-applications`)

**Change:** Use paginated fetch (reuse pattern from `fetchAllPaginated` in `api/misc.js`) or `{ count: 'exact' }` + ranged selects until all rows loaded.

| Pros | Cons |
|------|------|
| Fixes Total cap at 1000 | Larger payload / slower bootstrap for very large datasets |
| Applications tab gets full data too | May need performance tuning |

**Risk:** Low–medium  
**Tests:** Integration test with >1000 seeded rows; assert bootstrap returns full count.

---

### Option B — Add Overview rows for all statuses + fix Approved definition

**Files:** `src/pages/admin/components/OverviewTab.tsx`, optionally `src/pages/admin/Dashboard.tsx`

**Change:**

- Add **Paused** (`suspended`) and **Removed** rows to Applications panel.
- Change Approved to `applications.filter(a => a.status === 'approved').length` **or** rename current metric to “Approved with ambassador account”.
- Ensure `pending + approved + rejected + suspended + removed === totalApps` (or document orphan approved separately).

| Pros | Cons |
|------|------|
| Fixes 946 vs 1000 confusion within loaded data | Does not fix 1000 cap alone |
| Matches Applications tab status model | Requires copy/UX decision on Approved definition |

**Risk:** Low  
**Tests:** Unit test Overview stats reducer with mixed statuses.

---

### Option C — Server-side status counts endpoint

**Files:** New API handler (e.g. in `admin-data-routes.js`), `OverviewTab.tsx` / `Dashboard.tsx`

**Change:** `GET /api/admin/ambassador-applications/stats` returning `{ pending, approved, rejected, suspended, removed, total }` via SQL `COUNT(*) FILTER (WHERE status = …)`.

| Pros | Cons |
|------|------|
| Accurate regardless of row cap | New endpoint + permission wiring |
| Fast for large tables | Overview still needs full list for Recent Activity unless refactored |

**Risk:** Medium  
**Tests:** API test against known seed counts; compare to SQL ground truth.

**Recommended combination:** **A + B** (full fetch + complete Overview breakdown). **C** if bootstrap payload size becomes a problem.

---

## 9. Verification Plan

### Manual (after fix)

1. **Overview math:** Pending + Approved + Rejected + Paused + Removed (+ any “orphan approved” bucket) = Total.
2. **Paused visibility:** Pause an ambassador / filter Applications tab by **Paused** — count should appear on Overview if status is `suspended`.
3. **Cap check:** If DB has >1000 applications, Total should exceed 1000 (or show explicit “1000+” with accurate stats endpoint).
4. **Applications tab parity:** Filter each status; sum of filter counts (with “All Statuses”) should match Overview Total.
5. **No regression:** Pending/Approved/Rejected filters and approve/reject workflows still work.

### Automated

```bash
npm run build
npm run test:admin-api-authz-coverage   # existing; does not cover application stats today
```

**Suggested new tests (none exist today):**

- `api/_lib/admin-applications-bootstrap-pagination.test.cjs` — bootstrap returns >1000 rows when DB has them.
- Frontend unit test for Overview status aggregation with fixtures including `suspended`, `removed`, orphan `approved`.

### DevTools / DB checks (investigation confirmation)

1. Network: `GET /api/admin/dashboard/bootstrap` → count `payload.applications.length` (expect 1000 if capped).
2. SQL (read-only):  
   `SELECT status, COUNT(*) FROM ambassador_applications GROUP BY status ORDER BY status;`  
   Compare sums to Overview rows + identify `suspended`/`removed` counts matching ~54 gap.
3. SQL total:  
   `SELECT COUNT(*) FROM ambassador_applications;`  
   If >1000 while Overview shows 1000 → confirms cap issue.

---

## Appendix: Overview vs Applications tab

| Aspect | Overview | Applications tab |
|--------|----------|-------------------|
| Data source | Same `applications` state from bootstrap | Same `applications` state |
| Default filter | None (uses full array for Total) | **`pending` only** (`Dashboard.tsx` `applicationStatusFilter` default) |
| Status filters | 3 rows only | All 5 statuses + “All Statuses” |
| Approved metric | Ambassador-linked subset | Filter `status === 'approved'` (all approved rows) |
| Count label | Total = `applications.length` | `{filteredApplications.length} applications` |

Default Applications tab shows **625 pending** (matches screenshot Pending), not 1000 — expected because tab defaults to pending filter while Overview Total uses full loaded array.
