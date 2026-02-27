# Refactoring Plan: Large Files

This document lists all large files that should be refactored, in priority order, with a concrete extraction plan. Goal: improve maintainability and make bugs easier to find and fix.

---

## Ground rules (refactor only)

- **No feature changes** — Extracted components, hooks, and types must not change existing functionality. Behavior stays the same.
- **No logic changes** — Do not introduce new logic or modify existing behavior. This is purely structural refactoring for maintainability.
- **Site uptime and performance** — The refactor must not cause downtime or degrade performance. No breaking changes to APIs, routes, or user flows.
- **Incremental steps** — Execute in small steps. After each extraction (e.g. one types file, one tab, one hook), verify that the app still works and run tests. Only then move to the next step. This keeps the site stable and makes it easy to roll back if needed.

---

## Quick reference

### 1. Refactoring phases

- **Phase 1 (P0):** Refactor the Admin Dashboard and `lib/email.ts`. Largest and most impactful.
- **Phase 2 (P1):** Refactor the Ambassador Dashboard, Events, and PassPurchase.
- **Phase 3 (P2):** Tackle the remaining large components and services.

### 2. Admin Dashboard extraction (step-by-step)

1. **Move types** — Extract types from `Dashboard.tsx` into `src/pages/admin/types.ts` (e.g. `AdminDashboardProps`, `AmbassadorApplication`, `EventPass`, etc.).
2. **Extract tab components** — For each tab, create a component under `src/pages/admin/components/` (e.g. `OverviewTab.tsx`, `EventsTab.tsx`, `AdminsTab.tsx`). Each component holds the UI logic for that tab.
3. **Extract hooks** — Introduce hooks per section: e.g. `useAdminDashboardData` for data fetching, `useAdminEvents`, `useAdminAdmins`, etc., under `src/pages/admin/hooks/`.
4. **Thin the Dashboard** — After extractions, `Dashboard.tsx` only orchestrates the page layout and calls hooks to render the tab components.

### 3. Refactoring other large files (ambassador, Events, PassPurchase, etc.)

For each large page or component:

- **Types** — Move to separate files (e.g. `src/pages/ambassador/types.ts`).
- **Translations/constants** — Extract static text and translations into separate files.
- **UI components** — Break UI into smaller components (e.g. `AmbassadorDashboardHeader.tsx`, `AmbassadorNewOrdersTab.tsx`).
- **Data & logic** — Extract into custom hooks (e.g. `useAmbassadorDashboard`, `useAmbassadorOrders`).
- **Helpers** — Extract helper functions into utility files where useful.

### 4. Target file sizes

- **Dashboard.tsx:** ~100–400 lines (after refactoring).
- **Each tab component:** ~100–300 lines.
- **Each hook:** ~50–150 lines.
- **Type/translation files:** As needed.

### 5. Execution order

1. Start with the **Admin Dashboard**: types → tab components → hooks → thin `Dashboard.tsx`.
2. Then the **Ambassador Dashboard**, following the same pattern.
3. Then split **lib/email.ts** into smaller template files (e.g. `email-templates/approval.ts`, `rejection.ts`).
4. Then **Events** and **PassPurchase**, following the refactoring guidelines.
5. Finally **Phase 3** components and services.

**Important:** Work incrementally. After each step (e.g. one new file or one extracted component), run the app and test the affected area. Only proceed when that step works. This preserves site integrity and allows safe rollback.

---

## 1. Big Files Inventory (by line count)

| Priority | File | Lines | Notes |
|----------|------|-------|--------|
| **P0** | `src/pages/admin/Dashboard.tsx` | **~19,500** | Single giant component; 20+ tabs; 100+ useState. |
| **P0** | `src/lib/email.ts` | **~2,920** | Many email templates in one file. |
| **P1** | `src/pages/ambassador/Dashboard.tsx` | **~1,930** | One big page + one small component. |
| **P1** | `src/pages/Events.tsx` | **~1,430** | Events list + modal + gallery logic. |
| **P1** | `src/pages/PassPurchase.tsx` | **~1,190** | Pass selection, checkout, payment flow. |
| **P2** | `src/components/admin/PosTab.tsx` | **~945** | POS management tab. |
| **P2** | `src/components/admin/OfficialInvitationsList.tsx` | **~855** | Invitations table + actions. |
| **P2** | `src/pages/ambassador/Application.tsx` | **~826** | Ambassador application form. |
| **P2** | `src/pages/GalleryEvent.tsx` | **~796** | Gallery page. |
| **P2** | `src/components/ui/sidebar.tsx` | **~761** | Sidebar (may be generated; lower priority). |
| **P2** | `src/components/admin/StockManagement.tsx` | **~749** | Stock UI. |
| **P2** | `src/components/admin/BulkSmsSelector.tsx` | **~709** | SMS selector UI. |
| **P2** | `src/lib/ticketGenerationService.tsx` | **~653** | Ticket generation logic + templates. |
| **P2** | `src/pages/scanner/ScannerScan.tsx` | **~596** | Scanner scan UI. |
| **P2** | `src/hooks/useAnalytics.ts` | **~585** | Analytics data hooks. |

**Additional (medium):**  
`admin/Login.tsx` (~480), `OfficialInvitationForm.tsx` (~476), `HeroSection.tsx` (~454), `UpcomingEvent.tsx` (~456), etc.

---

## 2. Priority and Phases

- **Phase 1 (P0):** Admin Dashboard + `email.ts`. Highest impact and risk.
- **Phase 2 (P1):** Ambassador Dashboard, Events, PassPurchase.
- **Phase 3 (P2):** Remaining large components and libs (PosTab, OfficialInvitations, Application, GalleryEvent, StockManagement, BulkSmsSelector, ticketGenerationService,  ScannerScan, useAnalytics).

---

## 3. Admin Dashboard (`src/pages/admin/Dashboard.tsx`) — Extraction Plan

**Current state:** One file ~19,500 lines; 20+ tabs; 100+ `useState`; many interfaces; already uses: `ReportsAnalytics`, `OfficialInvitationForm`, `OfficialInvitationsList`, `ScannersTab`, `PosTab`, `BulkSmsSelector`.

### Step 1: Types and interfaces

**Create:** `src/pages/admin/types.ts` (or `src/types/admin.ts`)

Move and export:

- `AdminDashboardProps`
- `AmbassadorApplication`
- `EventPass`
- `Event` (admin-specific shape if different from public)
- `Ambassador`
- `PassPurchase`
- `ConfirmDeleteTarget`
- Inline types for HeroImage, AboutImage, and any other small interfaces used only in admin.

Use these types in Dashboard and in new tab components.

### Step 2: Tab components (one file per tab)

Each tab becomes its own component under `src/pages/admin/components/` (or `src/components/admin/dashboard/`). Dashboard only renders `<Tabs>` and `<TabsContent>` that delegate to these.

| Tab value | New component file | Approx. content |
|-----------|--------------------|------------------|
| `overview` | `OverviewTab.tsx` | KPIs, charts, quick stats (lines ~10221–10924) |
| `events` | `EventsTab.tsx` | Events list, add/edit event, event dialog, pass management (lines ~10925–12268) |
| `admins` | `AdminsTab.tsx` | Admins list, add/edit admin, delete confirm (lines ~12269–12584) |
| `official-invitations` | Already `OfficialInvitationsList` | Keep; ensure Dashboard only wraps it in TabsContent |
| `scanners` | Already `ScannersTab` | Same |
| `pos` | Already `PosTab` | Same |
| `ambassadors` | `AmbassadorsTab.tsx` | Ambassadors list, add/edit, delete (lines ~12625–13268) |
| `applications` | `ApplicationsTab.tsx` | Ambassador applications list, approve/reject (lines ~13269–13857) |
| `sponsors` | `SponsorsTab.tsx` | Sponsors CRUD (lines ~13858–14044) |
| `team` | `TeamTab.tsx` | Team members CRUD (lines ~14045–14282) |
| `contact` | `ContactTab.tsx` | Contact / site content (lines ~14283–14479) |
| `tickets` | `TicketsTab.tsx` | Tickets view (lines ~14480–14484) |
| `online-orders` | `OnlineOrdersTab.tsx` | Online orders list (lines ~14485–14793) |
| `ambassador-sales` | `AmbassadorSalesTab.tsx` | Sub-tabs: COD orders, order logs, performance (lines ~14794–15287) |
| `marketing` | `MarketingTab.tsx` | Sub-tabs: SMS + Email (lines ~15288–16095) |
| `aio-events` | `AioEventsTab.tsx` | AIO submissions (lines ~16096–16263) |
| `logs` | `LogsTab.tsx` | Comprehensive logs (lines ~16264–16731) |
| `settings` | `SettingsTab.tsx` | Sales, expiration, maintenance, hero, about, favicon (lines ~16732–end) |

For each tab component:

- Receive **props** for: data, loading, handlers (e.g. `onApprove`, `onReject`, `onSave`), `language`.
- Move **tab-local state** into that component (or into a dedicated hook for that tab).
- Keep **shared state** (e.g. events list, applications list) in Dashboard or in a parent hook that passes them down.

### Step 3: Data and logic → hooks

Introduce hooks so Dashboard and tab components don’t hold 100+ `useState` and all `useEffect`/handlers.

Suggested hooks (under `src/pages/admin/hooks/` or `src/hooks/admin/`):

| Hook | Responsibility |
|------|----------------|
| `useAdminDashboardData()` | Initial load: applications, events, ambassadors, passPurchases, admins, current admin role/id/name/email. Returns data + loading + refetch. |
| `useAdminEvents(events, setEvents)` | Event CRUD, edit state, event dialog, pass management (or split into `useAdminEvents` + `useEventPassManagement`). |
| `useAdminAdmins(admins, setAdmins)` | Admins CRUD, add/edit dialog state. |
| `useAdminAmbassadors(ambassadors, setAmbassadors)` | Ambassadors CRUD, add/edit/delete state. |
| `useAdminApplications(applications, setApplications)` | Approve/reject, email state, credentials. |
| `useAdminSponsors(sponsors, setSponsors)` | Sponsors CRUD. |
| `useAdminTeam(teamMembers, setTeamMembers)` | Team CRUD. |
| `useAdminMarketing()` | SMS: subscribers, broadcast, targeted, test, balance, logs. Email: subscribers, import, send, test. |
| `useAdminSettings()` | Sales, expiration, maintenance, ambassador application, hero, about, favicon. |
| `useAdminLogs()` | Logs list, filters, pagination, log drawer. |
| `useAdminAioEvents()` | AIO submissions list + pagination. |
| `useAdminOrders()` or reuse existing | Online orders, ambassador COD orders, order logs, performance (or split per tab). |

Dashboard then:

- Calls these hooks (or a single `useAdminDashboard()` that composes them).
- Passes returned data and handlers into the tab components.

### Step 4: Shared UI pieces

- **Dialogs** used in multiple places (e.g. confirm delete) → `src/components/admin/dialogs/ConfirmDeleteDialog.tsx` (or similar).
- **Event form / event dialog** → can live inside `EventsTab.tsx` or be extracted to `EventForm.tsx` / `EventDialog.tsx` if the file is still large.
- **Repeated card/table layouts** → small presentational components where it reduces duplication.

### Step 5: Target

- **Dashboard.tsx:** ~200–400 lines (imports, hooks, layout, `<Tabs>` / `<TabsContent>` that render the tab components).
- **Each tab component:** ~200–800 lines (some tabs are large; can be split further later).
- **Each hook:** ~80–300 lines depending on domain.

---

## 4. Ambassador Dashboard (`src/pages/ambassador/Dashboard.tsx`)

See **REFACTORING_LARGE_FILES.md** for the full plan. Summary:

- Types → `pages/ambassador/types.ts`
- Translations → `pages/ambassador/translations.ts`
- Components: header, status message, NewOrdersTab, HistoryTab, PerformanceTab, ProfileTab, CancelOrderDialog, EditProfileDialog, OrderExpirationTimer
- Hooks: `useAmbassadorDashboard`, `useAmbassadorOrders`, `useAmbassadorPerformance`, `useAmbassadorProfile`
- Helpers → `lib/` or `pages/ambassador/utils/`
- Target: Dashboard.tsx ~100–250 lines.

---

## 5. Other Large Files — Brief Strategy

| File | Strategy |
|------|----------|
| **Events.tsx** (~1,430) | Extract: types; i18n strings; `EventCard`, `EventModal`, `EventGallery`, `EventDetails`; hook `useEventsPage(events)` for modal state, filters, keyboard/swipe. Page = layout + hook + composition. |
| **PassPurchase.tsx** (~1,190) | Extract: types; copy; `PassSelector`, `CheckoutForm`, `PaymentSummary`; hooks `usePassPurchase(eventId)`, `useCheckout(form)`. Page = steps + components. |
| **lib/email.ts** (~2,920) | Split by purpose: `email-templates/approval.ts`, `rejection.ts`, `credentials.ts`, `orderConfirmation.ts`, `marketing.ts`, etc. Keep shared `sendEmail` and config in `email.ts` or `email-client.ts`. |
| **PosTab.tsx** (~945) | Extract: types; sub-components for outlets, users, stock, orders; hook `usePosTab()` for data and actions. |
| **OfficialInvitationsList.tsx** (~855) | Extract: types; `InvitationRow`, filters; hook `useOfficialInvitations()`. |
| **ambassador/Application.tsx** (~826) | Extract: form sections (personal, contact, motivation); validation; i18n. |
| **GalleryEvent.tsx** (~796) | Extract: gallery grid, lightbox, media viewer; hook for current event and media index. |
| **StockManagement.tsx** (~749) | Extract: table row, pass row, dialogs; hook for stock data and updates. |
| **BulkSmsSelector.tsx** (~709) | Extract: phone list, filters, preview; hook for selection and send. |
| **ticketGenerationService.tsx** (~653) | Split: template builders (HTML) vs generation logic; or one file per template type. |
| **ScannerScan.tsx** (~596) | Extract: scan result UI, history list; hook for scan and list state. |
| **useAnalytics.ts** (~585) | Split by domain: `useOverviewAnalytics`, `useSalesAnalytics`, `useEventsAnalytics`, shared helpers. |

---

## 6. Execution Order (Recommended)

1. **Admin Dashboard**
   - 1.1 Types → `admin/types.ts`
   - 1.2 One tab at a time: start with **Overview** or **Settings** (or smallest tab) to establish pattern
   - 1.3 Introduce one or two hooks (e.g. `useAdminDashboardData`, `useAdminSettings`)
   - 1.4 Continue tab-by-tab + hook-by-hook until Dashboard is thin
2. **Ambassador Dashboard**
   - Follow REFACTORING_LARGE_FILES.md (types → translations → components → hooks).
3. **email.ts**
   - Split templates into separate files; keep one place for `sendEmail` and config.
4. **Events.tsx, PassPurchase.tsx**
   - Types, components, hooks as in the table above.
5. **Remaining P2**
   - PosTab, OfficialInvitationsList, Application, GalleryEvent, StockManagement, BulkSmsSelector, ticketGenerationService,  ScannerScan, useAnalytics — in any order, using the same ideas (extract types, UI pieces, hooks).

---

## 7. Rules of Thumb

- **One extraction at a time:** e.g. one tab or one hook, then run app and fix.
- **Don’t change behavior:** refactor only; no new features in the same PR.
- **Target file size:** pages 100–400 lines; components 100–350; hooks 50–250; types/translations as needed.
- **Naming:** `*Tab.tsx` for tab content; `use*` for hooks; `*Dialog`, `*Form` for UI.

---

## 8. Where to Put New Files

```
src/
  pages/
    admin/
      Dashboard.tsx           # Thin orchestrator
      types.ts
      components/             # Tab components
        OverviewTab.tsx
        EventsTab.tsx
        AdminsTab.tsx
        ...
      hooks/
        useAdminDashboardData.ts
        useAdminEvents.ts
        ...
    ambassador/
      Dashboard.tsx
      types.ts
      translations.ts
      components/
      hooks/
  components/
    admin/                    # Shared admin components (existing)
      PosTab.tsx
      ScannersTab.tsx
      ...
  lib/
    email/
      index.ts                # sendEmail, config
      templates/
        approval.ts
        rejection.ts
        ...
```

This plan should be enough to start Phase 1 (admin Dashboard + email) and Phase 2 (ambassador Dashboard, Events, PassPurchase) without changing architecture, and to tackle the rest in Phase 3.
