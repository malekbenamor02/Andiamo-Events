# Refactoring Large Files (e.g. Ambassador Dashboard)

Large single-file pages (like `src/pages/ambassador/Dashboard.tsx` at ~1900+ lines) are hard to maintain, review, and debug. This guide explains what to do and how to split them.

**Full plan for all big files (admin Dashboard, ambassador Dashboard, Events, PassPurchase, email.ts, etc.) and phased execution order:** see **[REFACTORING_PLAN.md](./REFACTORING_PLAN.md)**.

---

## Admin Dashboard (priority P0)

`src/pages/admin/Dashboard.tsx` is **~19,500 lines** (one component, 20+ tabs, 100+ `useState`). Refactor in this order:

1. **Types** → `src/pages/admin/types.ts` (AdminDashboardProps, AmbassadorApplication, EventPass, Event, Ambassador, PassPurchase, ConfirmDeleteTarget, HeroImage, AboutImage, etc.).
2. **One tab per component** under `src/pages/admin/components/`: OverviewTab, EventsTab, AdminsTab, AmbassadorsTab, ApplicationsTab, SponsorsTab, TeamTab, ContactTab, TicketsTab, OnlineOrdersTab, AmbassadorSalesTab, MarketingTab, AioEventsTab, LogsTab, SettingsTab. (OfficialInvitations, Scanners, Pos already use extracted components.)
3. **Hooks** under `src/pages/admin/hooks/`: e.g. useAdminDashboardData, useAdminEvents, useAdminAdmins, useAdminAmbassadors, useAdminApplications, useAdminMarketing, useAdminSettings, useAdminLogs, useAdminAioEvents, useAdminOrders.
4. **Dashboard.tsx** → thin orchestrator: call hooks, render Tabs + TabsContent that render the tab components. Target: ~200–400 lines.

Details (line ranges per tab, hook responsibilities, folder layout): **[REFACTORING_PLAN.md § Admin Dashboard](./REFACTORING_PLAN.md#3-admin-dashboard-srcpagesadmindashboardtsx--extraction-plan)**.

---

## Why split?

- **Easier to find bugs**: Smaller files = faster to locate and fix.
- **Easier to test**: You can test hooks and components in isolation.
- **Fewer merge conflicts**: Multiple people can work on different components.
- **Reuse**: Extracted components/hooks can be reused elsewhere.
- **Mental load**: One file should do one job; the page just composes pieces.

---

## What to extract (in order)

### 1. **Types & interfaces** → `types/` or next to the feature

Move `Order`, `Ambassador`, `AmbassadorDashboardProps` (and any shared types) to:

- `src/types/ambassador.ts` or  
- `src/pages/ambassador/types.ts`

Then: `import type { Order, Ambassador } from './types';`

### 2. **Translations / constants** → `constants` or `i18n`

The big `t` object (en/fr strings) in Dashboard should live in:

- `src/pages/ambassador/translations.ts` or  
- `src/lib/i18n/ambassadorDashboard.ts`

Export something like `getAmbassadorDashboardTranslations(lang: 'en' | 'fr')` and use it in the page.

### 3. **Small UI components** → `components/` (feature or shared)

Already extracted: `OrderExpirationTimer`.  
Also extract:

- **Dashboard header** (welcome + logout) → `AmbassadorDashboardHeader.tsx`
- **Suspended / Sales disabled message** (the two full-page cards) → `AmbassadorStatusMessage.tsx` (with a `variant: 'suspended' | 'salesDisabled'`)
- **New Orders table** (one tab’s content) → `AmbassadorNewOrdersTab.tsx`
- **History table** → `AmbassadorHistoryTab.tsx`
- **Performance tab** (all the KPI cards) → `AmbassadorPerformanceTab.tsx`
- **Profile tab** → `AmbassadorProfileTab.tsx`
- **Cancel order dialog** → `CancelOrderDialog.tsx`
- **Edit profile dialog** → `EditProfileDialog.tsx`

Put them under:

- `src/components/ambassador/` (if used only in ambassador area), or  
- `src/pages/ambassador/components/` (if only used by this page).

### 4. **Data & logic** → **custom hooks**

Move all data fetching and handlers into hooks so the page only composes UI and calls hooks.

- **`useAmbassadorDashboard()`**  
  - Reads session, loads ambassador, `salesEnabled`, `newOrders`, `historyOrders`, `performance`.  
  - Exposes: `ambassador`, `loading`, `newOrders`, `historyOrders`, `performance`, `salesEnabled`, `fetchData`, `refetch` (or similar).

- **`useAmbassadorOrders(ambassadorId)`**  
  - Fetches new + history orders, exposes `accept`, `cancel`, `complete` handlers and maybe `getOrderPassesFromOrder`.  
  - Can live in `src/hooks/useAmbassadorOrders.ts` or `src/pages/ambassador/hooks/useAmbassadorOrders.ts`.

- **`useAmbassadorPerformance(ambassadorId)`**  
  - Fetches performance and computes commission (or keep commission in the same hook as orders if it’s one API).  
  - Exposes `performance` and maybe `refetch`.

- **`useAmbassadorProfile(ambassador)`**  
  - Handles update profile (password), `profileForm`, `handleUpdateProfile`, `setProfileForm`, etc.

After this, `Dashboard.tsx` should only:

- Call these hooks.
- Render layout (tabs) and the extracted components (header, tabs content, dialogs).
- Pass props/callbacks from hooks to components.

### 5. **Helpers** → `lib/` or `utils/`

- `getOrderPassesFromOrder(order)` → e.g. `src/lib/orders/orderPasses.ts` or `src/pages/ambassador/utils/orderPasses.ts`.
- Commission calculation (base + bonuses) → e.g. `src/lib/ambassador/commission.ts` or inside `useAmbassadorPerformance`.

---

## Suggested folder structure (ambassador feature)

```
src/
  pages/
    ambassador/
      Dashboard.tsx          # Thin: hooks + layout + composition only
      Application.tsx
      Auth.tsx
      components/            # Page-specific components
        AmbassadorDashboardHeader.tsx
        AmbassadorStatusMessage.tsx
        AmbassadorNewOrdersTab.tsx
        AmbassadorHistoryTab.tsx
        AmbassadorPerformanceTab.tsx
        AmbassadorProfileTab.tsx
        CancelOrderDialog.tsx
        EditProfileDialog.tsx
        OrderExpirationTimer.tsx   # (moved from Dashboard)
      hooks/
        useAmbassadorDashboard.ts
        useAmbassadorOrders.ts
        useAmbassadorPerformance.ts
        useAmbassadorProfile.ts
      translations.ts
      types.ts
  lib/
    ambassador/
      commission.ts          # optional: if you want to reuse commission logic
  types/
    ambassador.ts            # or keep in pages/ambassador/types.ts
```

---

## Target size for `Dashboard.tsx`

After refactor, aim for:

- **Dashboard.tsx**: ~100–250 lines (imports, 2–4 hook calls, layout + tab content that only renders the new components and dialogs).
- Each tab component: ~100–300 lines.
- Each hook: ~50–150 lines.
- Types/translations: as needed.

---

## Apply the same idea elsewhere

For any other large page (e.g. `Events.tsx`, `PassPurchase.tsx`, `UpcomingEvent.tsx`), and for large lib files (`email.ts`, `ticketGenerationService.tsx`, `useAnalytics.ts`):

1. **Types** → separate file.
2. **Copy/translations** → separate file.
3. **Sections of JSX** → components (by tab, by section, by dialog).
4. **Data + handlers** → custom hooks.
5. **Pure helpers** → `lib/` or `utils/`.
6. **Page file** → thin orchestrator.

Do one extraction at a time (e.g. first types + translations, then one tab, then one hook), run the app and tests, then continue. This keeps refactors safe and reviewable.

**Full list of big files, priorities, and per-file strategy:** **[REFACTORING_PLAN.md](./REFACTORING_PLAN.md)**.
