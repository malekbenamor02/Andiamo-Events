# Supabase Slow Query / Realtime Audit Report

**Audit date:** 2026-06-27  
**Mode:** Read-only audit. No application code, migrations, database objects, or environment variables were changed. Only this report file was created.

---

## 1. Executive Summary

**Overall verdict:** The slow-query report is dominated by **Supabase Realtime internal WAL polling** (`realtime.list_changes`), not by ordinary missing-index SELECT slowness. Roughly **94%+ of captured DB time** comes from Realtime. Application-level hotspots are secondary but real: **`site_logs` admin reads over a large table (~282k rows)**, **high-volume client logging**, and a **pg_cron job calling `auto_fail_expired_pending_online_orders()` every 5 minutes**.

**Top root cause:** Realtime publication includes **high-churn tables** (`orders`, `marketing_campaign_recipients`, `marketing_campaigns`, `ambassador_applications`) while the frontend still opens **multiple browser Realtime channels** (public site wrapper + admin dashboards). Even where app code removed some subscriptions (orders, ambassador applications), **publication entries remain in production**, so WAL/replication work continues whenever those tables change.

**Highest-risk code areas:**

| Area | Risk |
|------|------|
| `orders` still in `supabase_realtime` publication (high-write) | Critical publication risk |
| `MaintenanceMode.tsx` Realtime on every public page load | High (broad public subscription surface) |
| Duplicate `career_applications` subscriptions (Dashboard + CareerTab) | High |
| `api/_lib/admin-logs-route.js` loads full `site_logs` date window with `count: 'exact'` | High read-path risk |
| `src/main.tsx` + `ScrollToTop.tsx` client logging volume | Medium–High write volume |
| pg_cron `auto_fail_expired_pending_online_orders()` every 5 min | Medium frequency/load |

**Missing-index vs Realtime:** This is **primarily high-frequency Realtime load**, not a classic “one slow SELECT needs an index” problem. `site_logs` **does have** a `created_at DESC` index in production, but slowness persists because of **table size (~282k rows), `count: 'exact'`, and fetching large windows without DB-level pagination**.

**Code changes made:** None, except creating this report at `docs/audits/supabase-slow-query-realtime-audit-report.md`.

---

## 2. Inputs Reviewed

### Slow-query report summary (provided)

| Finding | Approx. values |
|---------|----------------|
| `realtime.list_changes(...)` variant 1 | ~17M calls, ~4.95 ms mean, ~71.5% DB time |
| `realtime.list_changes(...)` variant 2 | ~2.67M calls, ~12.05% DB time |
| `realtime.list_changes(...)` variant 3 | ~2.35M calls, ~11.26% DB time |
| Realtime subscription churn signals | `insert into realtime.subscription`, `pg_publication_tables` |
| `site_logs` date-range SELECT | ~927 ms mean, ~2914 ms max |
| `site_logs` anon inserts | 115k+ and 41k+ patterns |
| `auto_fail_expired_pending_online_orders()` | ~31,402 calls, ~50.7 ms mean |
| `team_members` `ORDER BY created_at` | ~3,290 calls, ~87 ms mean |

### Repository paths inspected

- `src/` — Realtime subscriptions, logging, team page, admin dashboard
- `api/` — `misc.js`, `admin-logs-route.js`, `client-site-log.js`, `admin-data-routes.js`
- `server.cjs` — legacy duplicate admin logs route
- `supabase/migrations/` — publications, indexes, expiry functions, RLS
- `vercel.json` — API route rewrites (no Vercel Cron definitions for order expiry)
- `docs/fcm-notification-system-plan.md`
- `package.json` scripts (not mutated)

### Read-only SQL queries run (Supabase MCP, project `ykeryyraxmtjunnotoep`)

```sql
select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
select jobid, schedule, command, active from cron.job order by jobid;
select schemaname, tablename, indexname, indexdef from pg_indexes where schemaname = 'public' and tablename in ('site_logs', 'orders', 'team_members') order by tablename, indexname;
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'site_logs';
select relname, n_live_tup from pg_stat_user_tables where schemaname = 'public' and relname in ('site_logs','orders','team_members','career_applications');
```

DB read-only access **was available** and used.

---

## 3. Top Findings Ranked by Impact

| Rank | Area | Severity | Evidence | Impact | Recommended next action |
|------|------|----------|----------|--------|-------------------------|
| 1 | Realtime WAL / `list_changes` | **Critical** | Slow-query report ~94%+ DB time; production publication includes `orders`, `marketing_campaign_*`, `ambassador_applications`, `career_applications` | Dominant DB cost driver | Remove unnecessary tables from `supabase_realtime`; keep only tables with active, justified subscriptions |
| 2 | `orders` in Realtime publication | **Critical** | `20250720000000-enable-realtime-orders.sql`; DB query confirms `orders` published; app disabled orders subscription in `Dashboard.tsx` | Every order write feeds Realtime WAL pipeline | `ALTER PUBLICATION supabase_realtime DROP TABLE orders` after confirming no consumer |
| 3 | Public-site Realtime channels | **High** | `MaintenanceMode.tsx` wraps all routes in `App.tsx`; subscribes on every visit | Subscription churn across all public traffic | Replace with polling or server-driven config; remove Realtime from global layout |
| 4 | Duplicate `career_applications` subscriptions | **High** | `Dashboard.tsx` INSERT listener + `CareerTab.tsx` `event: "*"` when careers tab open | Duplicate channels per admin session | Consolidate to one admin channel; narrow event filter |
| 5 | `site_logs` admin read path | **High** | `admin-logs-route.js` uses `count: 'exact'` + date range, no DB `.range()`; ~282k rows in prod | ~927 ms mean queries; memory merge of 4 log sources | Push pagination to SQL; drop exact count or use estimated count; narrow default window |
| 6 | Client logging volume | **High** | `ScrollToTop.tsx` page view per route; `main.tsx` fetch/console/error hooks | Large insert volume (historical anon pattern + ongoing API inserts) | Sample/throttle page views; reduce fetch error logging noise |
| 7 | `auto_fail_expired_pending_online_orders` pg_cron | **Medium** | `cron.job` jobid 2: `*/5 * * * *`; ~31k calls matches ~109 days at 5-min interval | Recurring scan/update load on `orders` | Review frequency; add/verify partial index for `PENDING_ONLINE` scan; consider batch cap |
| 8 | `marketing_campaign_*` in publication | **Medium** | `20260324000000-marketing-campaign-scheduled-realtime.sql`; cron updates recipients every 2 min | WAL churn during campaigns; no frontend Realtime subscriber found | Remove from publication unless admin Realtime UI is planned |
| 9 | `ambassador_applications` in publication | **Medium** | In production publication; code comment says realtime removed | Publication overhead without app subscriber | Drop from publication |
| 10 | `team_members` public anon fetch | **Low** (current prod) | `TeamSection.tsx` anon select; prod `n_live_tup = 0`; no `created_at` index | Low today; risk if team data grows | Cache via API/ISR; add `created_at` index if table grows |

---

## 4. Realtime Subscription Audit

### Summary counts

- **6** `postgres_changes` subscription sites found in `src/`
- **5** tables targeted by subscriptions: `site_content` (3), `career_applications` (2)
- **All 6** have `supabase.removeChannel(channel)` cleanup on unmount
- **0** subscriptions found for `orders`, `marketing_campaigns`, or `ambassador_applications` in current frontend code

### Per-subscription inventory

| File | Location | Table / channel | Filter | Event | Cleanup | Risk | Notes |
|------|----------|-----------------|--------|-------|---------|------|-------|
| `src/components/layout/MaintenanceMode.tsx` | `useEffect` ~L82–101 | `site_content` / `maintenance-settings-changes` | `key=eq.maintenance_settings` | `*` | Yes | **High** | Wraps entire app via `App.tsx`; runs on **every public page** for all visitors. **`site_content` is NOT in production `supabase_realtime` publication** — subscription may reconnect without delivering events. Deps: `[language, location.pathname]` → **re-subscribes on every route change**. |
| `src/lib/salesSettings.ts` | `subscribeToSalesSettings()` | `site_content` / `sales-settings-changes` | `key=eq.sales_settings` | `*` | Yes | **Medium** | Used from ambassador dashboard only. `site_content` not in publication (see above). |
| `src/pages/ambassador/Application.tsx` | `useEffect` ~L151–169 | `site_content` / `ambassador-application-settings-changes` | `key=eq.ambassador_application_settings` | `*` | Yes | **Medium** | Public ambassador application page. `site_content` not in publication. |
| `src/pages/admin/Dashboard.tsx` | `useEffect` ~L1571–1602 | `career_applications` / `admin-career-applications-realtime` | None (table-level) | `INSERT` only | Yes | **High** | Broad table subscription on admin dashboard (always mounted while admin logged in). Deps: `[language]` only — stable. |
| `src/pages/admin/components/CareerTab.tsx` | `useEffect` ~L329–347 | `career_applications` / `admin-career-applications-list-realtime` | None | `*` | Yes | **High** | **Second channel** on same table when careers tab active. Also **15s HTTP polling** (`setInterval`). Deps: `[loadApplications]` — **re-subscribes when filters change**. |
| `src/pages/ambassador/Dashboard.tsx` | `useEffect` ~L294–301 | via `subscribeToSalesSettings()` | `site_content` filter | `*` | Yes | **Medium** | Cleanup via returned `unsubscribe()`. |

### Removed / disabled Realtime (important context)

```1565:1568:src/pages/admin/Dashboard.tsx
  // Ambassador applications realtime removed — use admin API bootstrap refresh instead (RLS Wave B).

  // Orders realtime disabled (RLS Wave B): refresh after mutations and on event change.
  // Tradeoff: no live INSERT notifications; lower risk than anon realtime on privileged table.
```

Orders and ambassador-applications **frontend** subscriptions were intentionally removed, but **publication entries were not removed** in migrations reviewed.

### Risk themes

| Theme | Assessment |
|-------|------------|
| Broad subscription | `career_applications` table-level (no row filter) on admin UI |
| Missing cleanup | **None found** — all sites call `removeChannel` |
| Dependency churn | **Yes** — `MaintenanceMode` re-subscribes on `pathname`; `CareerTab` on filter changes |
| High-write table subscribed | **`orders` published** but not subscribed in code — publication still costly |
| Public anonymous pages | **Yes** — `MaintenanceMode` on all public routes |
| Per-row/modal subscriptions | **Not found** |

---

## 5. Supabase Realtime Publication Review

### Tables in migrations (`ALTER PUBLICATION supabase_realtime`)

| Table | Migration | In repo migration? |
|-------|-----------|-------------------|
| `orders` | `20250720000000-enable-realtime-orders.sql` | Yes |
| `career_applications` | `20260305300000-career-applications-realtime.sql` | Yes |
| `marketing_campaign_recipients` | `20260324000000-marketing-campaign-scheduled-realtime.sql` | Yes |
| `marketing_campaigns` | `20260324000000-marketing-campaign-scheduled-realtime.sql` | Yes |

### Tables in **production** (`pg_publication_tables`, read-only query)

| Table | Active app Realtime subscriber? | Assessment |
|-------|--------------------------------|------------|
| `ambassador_applications` | **No** (removed in code) | **High-risk — remove from publication** |
| `career_applications` | **Yes** (Dashboard + CareerTab) | Reasonable if consolidated to one channel |
| `marketing_campaign_recipients` | **No** (MarketingTab uses HTTP fetch/poll) | **High-risk during campaigns** — many row updates every 2 min via pg_cron |
| `marketing_campaigns` | **No** | **Reconsider** — low-frequency updates; publication likely unnecessary |
| `orders` | **No** (explicitly disabled) | **Critical — remove from publication** |

### Not in publication (notable)

- `site_content` — app subscribes in 3 places but table is **not** published. Subscriptions may cause Realtime connection overhead without useful events.

### High-risk tables that should probably not stay in Realtime

1. **`orders`** — high write rate (payments, status, POS, ambassador cash)
2. **`marketing_campaign_recipients`** — bulk UPDATE during email cron (every 2 min)
3. **`ambassador_applications`** — no current subscriber

### Tables reasonable to keep (with conditions)

- **`career_applications`** — if admin notifications remain a requirement; should be **one** filtered subscription, not two broad ones

### Unclear — owner confirmation needed

- Was `ambassador_applications` added to publication manually in Supabase dashboard (no `ADD TABLE` migration found in repo)?
- Is there any external/mobile client subscribing to `orders` Realtime outside this repo?

---

## 6. `site_logs` Write Path Audit

### Insert paths

| File | Path | Client/server | Auth |
|------|------|---------------|------|
| `api/_lib/client-site-log.js` | `POST /api/site-logs` | Browser → API → service role insert | Rate-limited (30/IP/min); field allowlist |
| `src/lib/logger.ts` | Calls `POST /api/site-logs` | Client-initiated | No direct Supabase insert |
| `api/misc.js` ~L6208 | `logInvitationAction()` | Server service role | Admin actions |
| `server.cjs` ~L2630 | invitation logging | Server service role | Legacy path |

### Direct browser Supabase insert?

**No in current code.** `logger.ts` explicitly routes through API:

```88:90:src/lib/logger.ts
    // Insert log via server API (site_logs RLS deny-all for browser Supabase)
    await postClientSiteLog({
```

### Production RLS (read-only query)

- Policy: `site_logs_deny_all` — `FOR ALL TO public USING (false)`

Historical slow-query **anon insert** patterns likely reflect **pre-hardening** period when `Allow public log inserts` existed (`20250130000000-create-site-logs-table.sql`) or reporting window predates `20260627120000_fix_critical_rls_exposure.sql`.

### Logging triggers (volume drivers)

| Source | Behavior |
|--------|----------|
| `src/components/layout/ScrollToTop.tsx` | **`logPageView` on every `pathname` change** — all guest traffic |
| `src/main.tsx` | Global `error`, `unhandledrejection`, `console.warn/error`, **wrapped `fetch`** logs 4xx/5xx |
| `src/components/ErrorBoundary.tsx` | React errors |
| Auth/forms | Admin/ambassador login, contact, suggestions, newsletter |

### Rate limiting / sampling

- **Rate limit:** yes, in `client-site-log.js` (30 req/IP/minute, in-memory bucket)
- **Sampling/throttle:** **not found** for page views or fetch errors
- **Payload size:** `error_stack`, `details` JSON, `page_url`, `user_agent` (up to 512 chars) — can be large

### Security / performance risks

1. **Volume risk:** page-view-per-navigation + fetch error logging → explains **~282k rows** in production
2. **Abuse risk (mitigated):** API rate limit helps; RLS deny-all blocks direct anon PostgREST inserts today
3. **Retention:** `cleanup_old_logs()` exists in migration but **no pg_cron job** found in production for it

---

## 7. `site_logs` Read Path Audit

### Readers

| File | Endpoint / usage | Pattern |
|------|------------------|---------|
| `api/_lib/admin-logs-route.js` | `GET /api/admin/logs` | Primary comprehensive logs API |
| `server.cjs` | Duplicate handler | Same pattern as above |
| `api/_lib/admin-data-routes.js` | `GET /api/admin/site-logs` | Simple `limit` (default 200), no date filter |
| `src/pages/admin/Dashboard.tsx` | `fetchLogs()` → `/api/admin/logs` | Offset pagination in UI |
| `src/pages/admin/Dashboard.tsx` | `fetchSiteLogs()` → `adminApi.listSiteLogs(500)` | Legacy site logs list |
| `src/pages/admin/components/LogsTab.tsx` | Displays paginated logs | Offset UI |

### `admin-logs-route.js` behavior (matches slow-query pattern)

```113:142:api/_lib/admin-logs-route.js
      let siteLogsQuery = supabase
        .from('site_logs')
        .select('*', { count: 'exact' });
      // ... filters including gte/lte created_at ...
      siteLogsQuery = siteLogsQuery.order('created_at', { ascending: sortOrder === 'asc' });
      const { data: siteLogs, error: siteLogsError } = await siteLogsQuery;
```

| Check | Result |
|-------|--------|
| Exact count | **Yes** — `count: 'exact'` on `site_logs` |
| Offset pagination at DB | **No** — fetches full filtered set, merges 4 sources in memory, then `.slice(offset, offset+limit)` |
| Date-range filter | **Yes** — default last 30 days if unspecified |
| `ORDER BY created_at DESC` | **Yes** |
| Auto-refresh | **Yes** — 30s interval when admin enables auto-refresh on logs tab |

### Index status

- **Migration:** `idx_site_logs_created_at ON site_logs(created_at DESC)` in `20250130000000-create-site-logs-table.sql`
- **Production:** index **confirmed present**
- Slowness likely from **row volume + exact count + wide `SELECT *`** over 30 days, not missing index alone

### Recommended future fix (do not implement in this audit)

1. Apply `.range(offset, offset+limit-1)` at DB level for `site_logs` only
2. Replace `count: 'exact'` with estimated count or separate cheap count query with narrow filters
3. Default to 7-day window; require explicit opt-in for 30 days
4. Schedule `cleanup_old_logs()` via pg_cron or external cron
5. Consider BRIN or partitioning if table stays >500k rows

---

## 8. Order Expiry Function / Cron Audit

### `auto_fail_expired_pending_online_orders()`

**Definitions:**  
- `supabase/migrations/20260311000001-auto-fail-expired-online-orders.sql` (30 min cutoff)  
- `supabase/migrations/20260320120000-pending-online-expire-17-minutes.sql` (17 min cutoff — latest in repo)

**Logic (latest migration):**

```14:20:supabase/migrations/20260320120000-pending-online-expire-17-minutes.sql
  FOR expired_order IN
    SELECT id, stock_released
    FROM public.orders
    WHERE source = 'platform_online'
      AND status = 'PENDING_ONLINE'
      AND created_at < timeout_cutoff
    FOR UPDATE SKIP LOCKED
```

| Aspect | Finding |
|--------|---------|
| Tables scanned | `orders` |
| Concurrency | `FOR UPDATE SKIP LOCKED` — reasonable |
| Batch limit | **None** — processes all matching rows per run |
| Indexes | `idx_orders_online_active_created_desc`, `idx_orders_status`, `idx_orders_source`, `idx_orders_created_at` exist; **no dedicated partial index** on `(source, status, created_at) WHERE status = 'PENDING_ONLINE'` |

### Production pg_cron (read-only)

| jobid | schedule | command |
|-------|----------|---------|
| 2 | `*/5 * * * *` | `SELECT public.auto_fail_expired_pending_online_orders()` |

~31,402 calls in slow-query report ≈ **5-minute cadence over ~109 days** — consistent with this job, not accidental over-triggering.

### Parallel API path (different implementation)

`GET/POST /api/auto-fail-pending-online-orders` in `api/misc.js` (~L5000–5130) performs **inline JS updates** (does not call the SQL function). Uses `PENDING_ONLINE` + `payment_status = 'PENDING_PAYMENT'` filter. **Not found** called from frontend; intended for external/Vercel cron per `vercel.json` rewrite.

**Risk:** two implementations (pg_cron SQL function vs API route) could diverge in behavior.

### `auto_reject_expired_pending_cash_orders()`

**Definitions:** `20250227000000`, `20250301000003-fix-auto-reject-expired-orders.sql`

| Aspect | Finding |
|--------|---------|
| Trigger | `GET/POST /api/auto-reject-expired-orders` (`api/misc.js` ~L4919) via external cron (documented every 5 min in `20250228000001-setup-auto-reject-cron.sql`) |
| pg_cron for cash reject | **Not found** in production `cron.job` |
| Indexes | `idx_orders_status_expires_at`, `idx_orders_expires_at` exist |
| Extra work | API does `count: 'exact'` diagnostic query before RPC |

### Recommended future fix (do not implement)

1. Consolidate online expiry to **one** path (pg_cron **or** API, not both)
2. Add partial index: `(created_at) WHERE source = 'platform_online' AND status = 'PENDING_ONLINE'`
3. Add `LIMIT` batch inside function for large backlogs
4. Document external cron URL/secret for cash reject in repo (CRON_SETUP.md referenced but **not found** in repository)

---

## 9. `team_members` Query Audit

### Usage

| File | Context |
|------|---------|
| `src/components/home/TeamSection.tsx` | Public home/about — anon Supabase client |
| `api/_lib/admin-team-routes.cjs` | Admin CRUD via service role |
| `src/pages/About.tsx` | Renders `TeamSection` |

### Query pattern

```14:17:src/components/home/TeamSection.tsx
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: true });
```

| Check | Result |
|-------|--------|
| Public/anon | **Yes** — browser anon key |
| Every page load | On About page mount only (not global) |
| Caching | **None** — direct Supabase call in `useEffect` |
| Offset pagination | **No** |
| Production row count | **0** (`n_live_tup`) |
| `created_at` index | **Missing** in production (only `team_members_pkey`) |

### Recommended future fix (do not implement)

1. Serve team via cached API route or static ISR (data changes rarely)
2. Add `CREATE INDEX ON team_members (created_at ASC)` if table grows
3. Select only public columns instead of `*`

---

## 10. Index Coverage Review

| Table | Query pattern | Existing index? | Missing / suspected? | Recommendation |
|-------|---------------|-----------------|----------------------|----------------|
| `site_logs` | `created_at` range + `ORDER BY created_at DESC` + pagination | **Yes** — `idx_site_logs_created_at DESC` | Composite `(created_at DESC, log_type)` may help filtered admin views | Fix query shape first (DB pagination); consider composite if filters stay slow |
| `site_logs` | `log_type`, `category` filters | **Yes** — separate indexes | — | Monitor after read-path fix |
| `orders` | `PENDING_ONLINE` + `created_at < cutoff` (auto-fail) | Partial online indexes exist | Dedicated partial index on `PENDING_ONLINE` + `created_at` | Add partial index in future migration |
| `orders` | `PENDING_CASH` + `expires_at < now()` (cash reject) | `idx_orders_status_expires_at` | Likely adequate | Verify with `EXPLAIN` under load |
| `orders` | Realtime WAL | N/A | Realtime cost is publication-level | Remove from publication |
| `team_members` | `ORDER BY created_at ASC` | **No** | `team_members(created_at ASC)` | Low priority until row count > 0 |
| `career_applications` | Realtime + admin list | Not audited in depth | — | Low row count (69) today |

---

## 11. Security Concerns

| Concern | Evidence | Current state |
|---------|----------|---------------|
| Public anon `site_logs` insert | Historical migration allowed public INSERT; slow-query anon patterns | **Mitigated** — `site_logs_deny_all` in production |
| Client log spam | `ScrollToTop` + global error hooks | Partially mitigated by 30/min IP rate limit on API |
| Realtime on privileged data | `orders`, `ambassador_applications` still published | **Risk** — publication should match least privilege |
| `career_applications` SELECT policy | `career_applications_select USING (true)` in realtime migration | Any anon client with Realtime could receive events if subscribed |
| `site_content` Realtime subscriptions | Public pages open channels | Low data leak (filters on keys) but unnecessary attack/connection surface |
| Service role logging | `client-site-log.js` uses service role server-side only | Appropriate pattern |

Factual note: `team_members_public_select USING (true)` allows public read — intentional for marketing page.

---

## 12. Recommended Fix Plan for Later

### Phase 1: Realtime publication cleanup

| Item | Detail |
|------|--------|
| **Goal** | Cut ~94% Realtime DB time |
| **Files likely affected** | New migration only; verify `Dashboard.tsx` comments |
| **DB changes** | `DROP TABLE orders, ambassador_applications, marketing_campaign_recipients, marketing_campaigns FROM PUBLICATION supabase_realtime` (keep only `career_applications` if needed) |
| **Tests** | Admin career notification still works; no regression in order admin UI |
| **Rollback** | `ADD TABLE` back to publication |

### Phase 2: Subscription lifecycle fixes

| Item | Detail |
|------|--------|
| **Goal** | Stop subscription churn |
| **Files** | `MaintenanceMode.tsx`, `CareerTab.tsx`, `Dashboard.tsx`, `salesSettings.ts`, `Application.tsx` |
| **DB changes** | If keeping `site_content` realtime, add to publication **or** remove subscriptions |
| **Tests** | Navigate public site — single stable channel; change career filters — no channel storm |
| **Rollback** | Revert frontend subscription changes |

### Phase 3: `site_logs` hardening / indexing

| Item | Detail |
|------|--------|
| **Goal** | Sub-100ms admin log reads |
| **Files** | `admin-logs-route.js`, `logger.ts`, `ScrollToTop.tsx`, `main.tsx` |
| **DB changes** | Optional composite index; **schedule `cleanup_old_logs()`** |
| **Tests** | Logs tab pagination; verify row count decreases over time |
| **Rollback** | Restore previous API query pattern |

### Phase 4: Cron / order expiry optimization

| Item | Detail |
|------|--------|
| **Goal** | Reduce recurring `orders` scan cost |
| **Files** | `api/misc.js`, SQL function migrations |
| **DB changes** | Partial index; optional batch `LIMIT`; unify pg_cron vs API |
| **Tests** | Pending online orders expire correctly; no stuck inventory |
| **Rollback** | Restore cron schedule / previous function body |

### Phase 5: Public static data caching

| Item | Detail |
|------|--------|
| **Goal** | Remove repeat anon queries |
| **Files** | `TeamSection.tsx`, optional new API route |
| **DB changes** | `team_members(created_at)` index if needed |
| **Tests** | About page team section; CDN/cache headers |
| **Rollback** | Revert to direct Supabase client fetch |

---

## 13. Exact Search Evidence

Commands run (ripgrep via IDE grep tool):

```bash
rg -n "supabase\.channel|\.channel\(|postgres_changes|removeChannel|removeAllChannels|unsubscribe|supabase_realtime|alter publication" .
rg -n "site_logs|error_stack|log_type|from\(['\"]site_logs['\"]\)|insert.*site_logs" .
rg -n "auto_fail_expired_pending_online_orders|auto_reject_expired_pending_cash_orders|cron\.schedule|pg_cron|cron\.job|expires_at" .
rg -n "team_members|from\(['\"]team_members['\"]\)|order\(['\"]created_at" .
rg -n "count:\s*['\"]exact['\"]|range\(|limit\(|offset" src api supabase shared .
rg -n "create index|CREATE INDEX|site_logs|orders.*expires_at|team_members.*created_at" supabase .
```

### Summarized hit counts (application code, excluding evidence zip folders)

| Pattern | Notable hits |
|---------|--------------|
| Realtime / channel | 6 subscription sites in `src/`; 4 publication migrations |
| `site_logs` | `logger.ts`, `client-site-log.js`, `admin-logs-route.js`, `admin-data-routes.js`, `misc.js`, `Dashboard.tsx` |
| Expiry / cron | SQL functions in 4 migrations; `misc.js` API endpoints; pg_cron job confirmed in DB |
| `team_members` | `TeamSection.tsx`, `admin-team-routes.cjs` |
| `count: 'exact'` | `admin-logs-route.js` (`site_logs`), multiple admin order analytics routes |
| Indexes | `idx_site_logs_created_at` in migration; many `orders` indexes; **no** `team_members.created_at` |

---

## 14. Open Questions

1. **Reporting window:** What date range does the slow-query report cover? (31,402 auto-fail calls suggest ~109 days at 5-min cron.)
2. **`ambassador_applications` publication:** Added in production but no repo migration — was this manual? Any external consumer?
3. **`site_content` Realtime intent:** Should maintenance/sales/ambassador settings use Realtime, polling, or SSE? Table is not currently published.
4. **`cleanup_old_logs` scheduling:** Is retention enforced anywhere outside pg_cron (external job, manual)?
5. **Cash order expiry cron:** Is `/api/auto-reject-expired-orders` configured in cron-job.org / similar? Not in Supabase `cron.job`.
6. **Duplicate expiry implementations:** Should production use pg_cron SQL function or `/api/auto-fail-pending-online-orders` for online orders?
7. **`team_members` slow queries:** Production table is empty — were slow queries from another environment or historical data?
8. **Marketing Realtime:** Was publication added for a planned admin live dashboard that was never implemented? (`CAMPAIGN_TABLE_POLL_MS` defined but no `setInterval` found using it.)

---

## 15. Final Verdict

**Main bottleneck:** Supabase Realtime internal `list_changes` driven by **over-broad publication** (especially `orders` and marketing tables) combined with **multiple browser Realtime channels** (public layout + admin). This is **not** primarily a missing-index problem.

**First fix to do later:** Remove **`orders`** (and other unused tables) from `supabase_realtime` publication, then eliminate **`MaintenanceMode.tsx` per-navigation Realtime re-subscription** on public traffic.

**What should not be touched yet:**

- Do not add indexes blindly to `site_logs` before fixing the admin logs query to paginate at the database.
- Do not re-enable `orders` Realtime in the frontend without RLS review.
- Do not reduce `auto_fail` cron frequency until confirming no customer-facing expiry regressions.
- Do not delete historical `site_logs` without a retention policy sign-off.

---

*End of audit report.*
