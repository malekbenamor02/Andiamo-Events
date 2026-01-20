# QR Scanner — Full Setup and Implementation Plan

**Purpose:** Build a **separate** scan-operator system with super-admin control, global Start/Stop, and a scanner app that works on iOS/Android.  
**Scope:** Plan and setup only — no code changes.  
**References:** `SCAN_APP_SPECIFICATION.md`, `SCAN_APP_DESIGN.md`, `QR_SCANNER_IMPLEMENTATION_PLAN.md`.

---

## 1. Overview

### 1.1 What We're Building

| Part | Description |
|------|-------------|
| **Scanners (scan operators)** | Separate user type; **created only by super admin**. Own login (email/username + password), not ambassador/admin. |
| **Super Admin tab "Scanners"** | Create scanner logins; see **history per scanner**, **statistics per scanner**, **charts**, **numbers**; **Start / Stop Scan** buttons to enable/disable the whole system. |
| **Scan system on/off** | When **stopped**: scanner app shows *"Scan don't start yet"* and makes **no API calls** (except one status check). When **started**: full flow. |
| **Scanner app (PWA)** | Login → select **upcoming event** → **Start** → camera searches for QR until found or **timeout** → **Restart** on timeout → on QR found: show result, **stop** search → user presses **Start** again for next scan. Supports **tickets** and **invitations** (same `qr_tickets` table). |
| **Result display** | By status: **Valid** (pass type, buyer, ambassador, update status, save time + scanner); **Used** (who scanned, when, ambassador); **Invalid / Wrong event / Expired** (message + any info). **Invitations**: status, buyer/recipient, all info. |
| **Scanner's own views** | History of scans; counts: total, per pass type, per status. |
| **Super Admin dashboard** | Same data globally: all scans, all scanners, charts, numbers; plus **Start / Stop Scan**. |

### 1.2 Platforms

- **Scanner app:** Web PWA (runs in browser on **iOS and Android**; add-to-home-screen).  
- **Super Admin:** Existing admin dashboard (new tab; super_admin only).

---

## 2. Database: New and Changed Objects

### 2.1 New Table: `scanners`

Scan operators; created only by super admin.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK, default `gen_random_uuid()` | |
| `name` | TEXT | NOT NULL | Display name |
| `email` | TEXT | NOT NULL UNIQUE | Login identifier |
| `password_hash` | TEXT | NOT NULL | bcrypt |
| `is_active` | BOOLEAN | DEFAULT true | Can be disabled without delete |
| `created_by` | UUID | FK → `admins(id)` | Super admin who created |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** `email` (unique), `created_by`, `is_active`.  
**RLS:** Only super_admin (via service role or `admins.role = 'super_admin'`) can SELECT/INSERT/UPDATE/DELETE. Scanner login uses a dedicated API that checks `password_hash`; no direct Supabase auth.

---

### 2.2 New Table: `scan_system_config`

Global on/off and optional settings. One row (singleton).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | UUID | PK | |
| `scan_enabled` | BOOLEAN | NOT NULL DEFAULT false | **Start = true, Stop = false** |
| `updated_by` | UUID | FK → `admins(id)` | Last super admin who toggled |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | |

**Seed:** One row with `scan_enabled = false`.  
**RLS:** Only super_admin can UPDATE. SELECT can be allowed for an unauthenticated or light endpoint used by the scanner app to get `scan_enabled` (or we use a dedicated public/anon-friendly `GET /api/scan-system-status` that returns only `{ enabled: boolean }` and does not expose other data).

---

### 2.3 Changes to `scans`

| Change | Details |
|--------|---------|
| `scanner_id` | UUID REFERENCES `scanners(id)`. NOT NULL when the scan is done via the scanner app. |
| `qr_ticket_id` | UUID REFERENCES `qr_tickets(id)`. Nullable. Set when lookup is by `secure_token` → `qr_tickets`. |
| `ticket_id` | Keep for legacy `pass_purchases` flow; make nullable or keep as-is and use only when `qr_ticket_id` is null. |
| `scan_result` | Extend CHECK to include `'wrong_event'`. |
| `ambassador_id` | Keep: for legacy or for "selling ambassador" (from `qr_tickets.ambassador_id`). For scanner app, the "who scanned" is `scanner_id`. |

**Constraint:** At least one of `ticket_id` or `qr_ticket_id` set when we have a matched ticket/invitation; both can be null for "invalid" (no matching `qr_tickets`/`pass_purchases`).

**RLS:** Scanners can INSERT (with their `scanner_id`). Scanners can SELECT own scans. Super_admin and admins can SELECT/manage all. Update policies so `scanner_id` is used for scanner auth (via API, not Supabase auth.uid).

---

### 2.4 `qr_tickets` and Invitations (no schema change)

- **Tickets:** `source` in (`platform_online`,`platform_cod`,`ambassador_manual`); `ticket_id`, `order_id`, `order_pass_id` set; `invitation_id` null. `buyer_name`, `ambassador_name`, `pass_type`, etc. present.
- **Invitations:** `source = 'official_invitation'`; `invitation_id` set; `ticket_id`, `order_id`, `order_pass_id` null. `buyer_name` = recipient; `ambassador_name` null.  
- **Lookup:** Always by `secure_token`. Validation and display logic branch on `source` and `invitation_id` to show "Invitation" vs "Ticket" and to pull extra invitation fields from `official_invitations` when needed.

---

## 3. Super Admin Tab: "Scanners"

### 3.1 Tab and Access

- **Location:** New `TabsTrigger` and `TabsContent` in `Dashboard.tsx`, e.g. `value="scanners"`.
- **Visibility:** Only if `currentAdminRole === 'super_admin'`.
- **Protection:** Add `'scanners'` to the list of tabs that redirect non–super-admins (like `'official-invitations'`, `'admins'`, `'settings'`, `'logs'`).

---

### 3.2 Sub-sections in the Scanners Tab

#### A) Global: Start / Stop Scan

- **UI:** Two buttons or one toggle: **Start Scan** / **Stop Scan**.
- **Backend:** `PATCH /api/admin/scan-system-config` (or `POST /api/admin/scan-system/start`, `.../stop`). Body or logic: `scan_enabled: true | false`. Requires super_admin.
- **Effect:** Updates `scan_system_config.scan_enabled` and `updated_by`, `updated_at`.
- **Feedback:** Current state shown (e.g. "Scan is **on**" / "Scan is **off**"). Optional: last updated by and at.

---

#### B) Scanners List and CRUD

- **List:** Table/cards: name, email, is_active, created_at, created_by (super admin name). Actions: Edit, Deactivate/Activate, (optional) Delete or “Remove” that keeps scans but blocks login).
- **Create:** Form: name, email, password (and confirm). Call `POST /api/admin/scanners`. Only super_admin.
- **Edit:** Change name, email, is_active; optional “change password”. `PATCH /api/admin/scanners/:id`.

**APIs:**
- `GET /api/admin/scanners` — list scanners (super_admin).
- `POST /api/admin/scanners` — create (super_admin; hash password server-side).
- `PATCH /api/admin/scanners/:id` — update (super_admin).
- `DELETE /api/admin/scanners/:id` — optional; or only “deactivate”.

---

#### C) Per-Scanner: History, Statistics, Charts, Numbers

- **Scope:** One scanner at a time. Selector: dropdown or sidebar of scanners.
- **History:** Table of scans by that scanner: time, event, `secure_token` (masked), result (valid/used/invalid/wrong_event/expired), pass type, buyer/recipient, ambassador (if ticket). Filters: event, date range, result. Pagination.
- **Numbers:**
  - Total scans.
  - Per status: valid, already_scanned (used), invalid, wrong_event, expired.
  - Per pass type: counts.
- **Charts:**
  - Scans over time (e.g. by hour or day).
  - Pie/bar: by status, by pass type.

**API:**  
- `GET /api/admin/scanners/:id/scans` — list with filters (event_id, date_from, date_to, scan_result).  
- `GET /api/admin/scanners/:id/statistics` — aggregates and, if needed, time-series for charts.

---

#### D) Global View (All Scanners)

- **History:** All scans, filter by scanner, event, date, result. Same columns as per-scanner.
- **Numbers:** Totals; per status; per pass type; per scanner (e.g. table).
- **Charts:** Same as per-scanner but across all scanners; optional “by scanner” series.

**APIs:**
- `GET /api/admin/scan-history` — list with filters: `scanner_id`, `event_id`, `date_from`, `date_to`, `scan_result`. Pagination.
- `GET /api/admin/scan-statistics` — global aggregates and, if needed, by scanner, by event, time-series.

---

### 3.3 UI Layout Suggestion (Scanners Tab)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Start Scan]  [Stop Scan]     Status: Scan is ON / OFF              │
├─────────────────────────────────────────────────────────────────────┤
│ Scanners                    [+ Create Scanner]                      │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Name     │ Email           │ Active │ Created  │ Actions        │ │
│ │ Scanner1 │ s1@...          │ ✓      │ ...      │ Edit | Deactivate│
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ View: [All Scanners ▼]  or  [Scanner: Scanner1 ▼]                   │
│                                                                     │
│ Numbers:  Total: 120  │ Valid: 100 │ Used: 10 │ Invalid: 6 │ ...   │
│           By pass: VIP 50, Standard 60, ...                         │
│                                                                     │
│ [Charts: Scans over time | By status | By pass type | By scanner]   │
│                                                                     │
│ History (filter: event, date, result)                               │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Time     │ Event    │ Result  │ Pass   │ Buyer    │ Ambassador  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Scanner App: Flow and Screens

### 4.1 Status Check (When Scan System Is Stopped)

- **On load, on resume, and optionally on interval:** Call **only**  
  `GET /api/scan-system-status`  
  Response: `{ enabled: boolean }`.  
- **If `enabled === false`:**
  - Show full-screen message: *"Scan don't start yet"* (or similar).
  - **Do not call** any other API: no events, no validate-ticket, no history, no stats. No camera, no Start.
- **If `enabled === true`:** Proceed to normal flow (login if not logged in, then event selection, etc.).

---

### 4.2 Login

- **Route:** `/scanner` or `/scanner/login`.
- **Form:** Email, Password. Submit → `POST /api/scanner-login`.
- **Backend:** Find `scanners` by `email`, `is_active = true`; verify `password_hash` (bcrypt); return a scanner JWT or session (e.g. `scanner_token` in HTTP-only cookie or `Authorization`). Payload should include `scanner_id`, `email`.
- **On success:** Redirect to event selection or to `/scanner/events`.

---

### 4.3 Event Selection

- **Route:** `/scanner/events`.
- **Data:** `GET /api/scanner/events` or `GET /api/events/upcoming` — events with `event_type = 'upcoming'` and `date >= now` (or equivalent). Only when `scan_system_config.scan_enabled = true` (backend enforces).
- **UI:** List/cards of upcoming events. Tap one → set selected `event_id` in state/context and go to Scan screen.

---

### 4.4 Scan Screen — Start, Timeout, Restart, Result

**Route:** `/scanner/scan`.

**Behavior:**

1. **Idle (before Start):**  
   - Show: selected event, **Start** button. No camera, no API.

2. **User presses Start:**  
   - Start camera and QR detection (e.g. `html5-qrcode` or `@yudiel/react-qr-scanner`).  
   - Start a **timeout** (e.g. 60–120 s, configurable later).  
   - Show: "Searching for QR code..." and a **Restart** button (or same button label that becomes "Restart" when timed out).

3. **Timeout before a QR is found:**  
   - Stop camera and detection.  
   - Show: "Timeout. Press Restart to try again." and **Restart** button.  
   - On Restart: same as Start (camera + new timeout).

4. **QR found (decode `secure_token`):**  
   - **Immediately stop** camera and detection.  
   - Call `POST /api/validate-ticket` with at least:  
     `secure_token`, `event_id`, `scanner_id` (from scanner auth; do not trust client), `scan_location`, `device_info`.  
   - **Backend:**  
     - If `scan_enabled === false`: return 503 or 423 with `{ enabled: false }`; app can fall back to "Scan don't start yet".  
     - Else: resolve via `qr_tickets` (tickets and invitations). Run existing validation rules (event match, status, already scanned, expired, wrong event).  
     - Write `scans` with `scanner_id`, `qr_ticket_id` (and `ticket_id` null for `qr_tickets`-based flow), `scan_result`, `ambassador_id` from `qr_tickets` if present.  
     - For **valid:** update `qr_tickets.ticket_status` to `USED` (and any linked `tickets` if applicable).

5. **Show result (any status):**  
   - **Valid:**  
     - Pass type, buyer name, ambassador name (or "—" for invitations).  
     - "Status updated. Scanned at &lt;time&gt; by &lt;scanner name&gt;."  
   - **Used (already_scanned):**  
     - Who scanned it (scanner name from previous `scans.scanner_id`), when, and for tickets: ambassador (seller) from `qr_tickets.ambassador_name`.  
   - **Invalid / Wrong event / Expired:**  
     - Message and, when available, buyer/pass/event info from `qr_tickets` or from `previous_scan` for wrong_event.

6. **Invitations:**  
   - When `qr_tickets.source = 'official_invitation'` and `invitation_id` is set:  
     - Show "Invitation", status, buyer (recipient), pass type, event; no ambassador.  
     - Same status rules: VALID → USED; already_scanned → show who and when.

7. **After result:**  
   - **Do not** auto-start the camera again.  
   - Show a single **Start** button. User presses Start to begin the next scan (back to step 2).

---

### 4.5 History and Numbers (Scanner’s Own)

- **Route:** `/scanner/history`.
- **API:** `GET /api/scanner/scans` — only rows where `scanner_id = <current scanner>`. Filters: event_id, date_from, date_to, scan_result. Pagination.
- **UI:** List of scans: time, event, result, pass type, buyer/recipient, ambassador (if any). Tapping a row can show a small detail (same fields as result overlay).

- **Numbers:**  
  - On same screen or a small header: total scans, counts per status, per pass type.  
  - Can be part of `GET /api/scanner/scans` (meta) or `GET /api/scanner/statistics`.

---

### 4.6 Optional: Settings and Logout

- **Settings:** e.g. timeout duration, sound on/off. Stored locally or via a dedicated `scanner_preferences` later.
- **Logout:** Clear scanner token and redirect to `/scanner/login`.

---

## 5. API Summary

### 5.1 Public / Scanner (Minimal When Disabled)

| Method | Route | Auth | When | Purpose |
|--------|-------|------|------|---------|
| GET | `/api/scan-system-status` | None (or optional) | Always | Return `{ enabled }`. Scanner uses this to decide whether to show "Scan don't start yet" and to avoid other calls. |

---

### 5.2 Scanner Auth

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/scanner-login` | — | Body: `email`, `password`. Returns scanner token; sets cookie or `Authorization`. |

---

### 5.3 Scanner App (Only When `scan_enabled === true`; Enforced in Each)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/scanner/events` | Scanner | Upcoming events for selector. |
| POST | `/api/validate-ticket` | Scanner | Body: `secure_token`, `event_id`, `scan_location`, `device_info`. `scanner_id` from token. Validates, writes scan, returns result and display fields. Rejects if `scan_enabled === false`. |
| GET | `/api/scanner/scans` | Scanner | Own scan history; filters. |
| GET | `/api/scanner/statistics` | Scanner | Own: totals, by status, by pass type. |

---

### 5.4 Super Admin (Scanners Tab)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/admin/scan-system-status` | Admin (super_admin) | `{ enabled }` (and optional `updated_at`, `updated_by`). |
| PATCH | `/api/admin/scan-system-config` | Super_admin | Set `scan_enabled`. |
| GET | `/api/admin/scanners` | Super_admin | List scanners. |
| POST | `/api/admin/scanners` | Super_admin | Create scanner (hash password). |
| PATCH | `/api/admin/scanners/:id` | Super_admin | Update scanner. |
| DELETE | `/api/admin/scanners/:id` | Super_admin | Optional. |
| GET | `/api/admin/scanners/:id/scans` | Super_admin | Scans for one scanner; filters. |
| GET | `/api/admin/scanners/:id/statistics` | Super_admin | Stats for one scanner. |
| GET | `/api/admin/scan-history` | Super_admin | All scans; filters. |
| GET | `/api/admin/scan-statistics` | Super_admin | Global stats; optional by scanner, by event, time-series. |

---

## 6. `POST /api/validate-ticket` — Behavior (Scanner, `secure_token`)

- **Auth:** Must receive a valid **scanner** token. `scanner_id` from token, not body.
- **Check:** If `scan_system_config.scan_enabled === false` → 503/423, `{ enabled: false }`.
- **Input:** `secure_token`, `event_id`, `scan_location`, `device_info`. Optionally support legacy `qrCode` + `pass_purchases` for a transition; below assumes `secure_token` + `qr_tickets`.

**Logic:**

1. **Lookup** `qr_tickets` by `secure_token`. If not found → `result: 'invalid'`, record scan with `qr_ticket_id` null, `scanner_id`, `scan_result: 'invalid'`.
2. **Wrong event:** If `qr_tickets.event_id !== event_id` → `result: 'wrong_event'`, `correct_event: { event_id, event_name, event_date }`. Record `scan_result: 'wrong_event'`, `qr_ticket_id`, `scanner_id`.
3. **Already used:** If `ticket_status = 'USED'` or there is an existing `scans` with `qr_ticket_id` and `scan_result = 'valid'` → `result: 'already_scanned'`, `previous_scan: { scanned_at, scanner_name, scanner_id }`. Record `scan_result: 'already_scanned'`.
4. **Expired:** If `event_date` &lt; now → `result: 'expired'`. Record `scan_result: 'expired'`.
5. **Valid:**  
   - Update `qr_tickets.ticket_status` to `USED`.  
   - Insert `scans`: `qr_ticket_id`, `scanner_id`, `event_id`, `scan_result: 'valid'`, `ambassador_id` from `qr_tickets`, `scan_location`, `device_info`, `scan_time = now()`.  
   - Response: `result: 'valid'`, `ticket` (or `invitation`) with:  
     - `pass_type`, `buyer_name`, `ambassador_name` (null for invitations), `event_name`, `event_date`, `event_venue`; for invitations add e.g. `invitation_number`, `recipient_*` from `official_invitations` if needed.

**Response shape (all cases):**  
`{ success, result, message, ticket?: {...}, previous_scan?: {...}, correct_event?: {...} }` so the app can render one overlay per status.

---

## 7. Result Overlay — Fields to Show

| Status | Show |
|--------|------|
| **Valid** | Pass type, buyer/recipient name, ambassador name (or "—" for invitations), event; "Scanned at &lt;time&gt; by &lt;scanner&gt;"; status updated to USED. |
| **Used (already_scanned)** | Who scanned (scanner name), when; for tickets: ambassador (seller); pass type, buyer. |
| **Invalid** | "Ticket not found or invalid." |
| **Wrong event** | Message + correct event name, date. |
| **Expired** | Message + event date, current date. |
| **Invitation** | Same status rules; replace "ambassador" with "—" and add invitation-specific fields (e.g. invitation number) if useful. |

---

## 8. Scanner App: Technical (Mobile, Security)

### 8.1 PWA and Devices

- **PWA:** `manifest.json`, service worker (e.g. Vite PWA). Installable on iOS and Android.
- **Camera:** `getUserMedia`; start only after user gesture (Start). On permission denied: message and, if possible, a "Manual entry" fallback (token input) that still calls `validate-ticket` with `secure_token`.
- **HTTPS:** Required for camera on mobile.

### 8.2 Timeout and Restart

- Timeout: e.g. 60–120 s. On expiry: stop video track and decoder; show Restart.  
- Restart: same as Start (re-request stream if needed, new timeout).

### 8.3 “No Other Requests When Disabled”

- App calls **only** `GET /api/scan-system-status` when `enabled === false`.
- No `/scanner/events`, no `validate-ticket`, no `/scanner/scans`, no `/scanner/statistics` in that state.  
- If a request is made by mistake (e.g. race), backend returns 503/423 for validate-ticket and 403 or 503 for others when `scan_enabled === false`.

### 8.4 Security

- Scanner passwords: bcrypt, never logged or returned.
- Scanner token: JWT or signed cookie, short-lived with refresh or re-login.
- `scanner_id` in `scans` and in validate-ticket always from server-side auth, never from body.
- Validate-ticket and scanner/* require valid scanner token and `scan_enabled === true`.

---

## 9. File and Route Map

### 9.1 Scanner App (Frontend)

- **Base path:** e.g. `/scanner`.  
- **Routes:**
  - `/scanner` — if not scanner-auth → Login; else redirect to `/scanner/events` or `/scanner/scan` if event already chosen.
  - `/scanner/login` — scanner login form.
  - `/scanner/events` — upcoming events; select → save event and go to `/scanner/scan`.
  - `/scanner/scan` — main scan UI (Start / timeout / Restart / result overlay).
  - `/scanner/history` — own history and numbers.

- **New dirs/files:**
  - `src/pages/scanner/ScannerLogin.tsx`
  - `src/pages/scanner/ScannerEvents.tsx`
  - `src/pages/scanner/ScannerScan.tsx`
  - `src/pages/scanner/ScannerHistory.tsx`
  - `src/contexts/ScannerContext.tsx` — scanner auth state, selected event, device info.
  - `src/components/scanner/QRScannerWithTimeout.tsx` — camera, decode, timeout, Restart, callbacks.
  - `src/components/scanner/ScanResultOverlay.tsx` — one UI for valid/used/invalid/wrong_event/expired and invitation.
  - `src/components/auth/ProtectedScannerRoute.tsx` — guard that checks scanner token and, on load, `GET /api/scan-system-status`; if disabled, show "Scan don't start yet" and render no further children that call APIs.

- **App.tsx:**  
  - Add routes under `/scanner` (and, if used, a `/scanner` layout that wraps `ProtectedScannerRoute` or a status check).

### 9.2 Super Admin (Dashboard)

- **Dashboard.tsx:**
  - New `TabsTrigger` and `TabsContent` for `scanners`.
  - In `TabsContent` for scanners`:
    - Start/Stop Scan block.
    - Scanners CRUD block.
    - Selector: All vs one scanner.
    - Numbers block (total, by status, by pass, by scanner).
    - Charts (recharts): over time, by status, by pass type, by scanner.
    - History table with filters.

- **Optional components:**
  - `src/components/admin/ScannersCRUD.tsx`
  - `src/components/admin/ScanSystemControl.tsx`
  - `src/components/admin/ScanHistoryTable.tsx`
  - `src/components/admin/ScanStatisticsCharts.tsx`

### 9.3 API (Backend)

- **server.cjs (or api/):**
  - `GET /api/scan-system-status`
  - `POST /api/scanner-login`
  - `GET /api/scanner/events`
  - `POST /api/validate-ticket` (extend for scanner auth, `scan_enabled`, `secure_token` → `qr_tickets`, `scans` with `scanner_id`, `qr_ticket_id`, `wrong_event`)
  - `GET /api/scanner/scans`
  - `GET /api/scanner/statistics`
  - `GET /api/admin/scan-system-status` (optional; can reuse logic)
  - `PATCH /api/admin/scan-system-config`
  - `GET /api/admin/scanners`
  - `POST /api/admin/scanners`
  - `PATCH /api/admin/scanners/:id`
  - `DELETE /api/admin/scanners/:id` (optional)
  - `GET /api/admin/scanners/:id/scans`
  - `GET /api/admin/scanners/:id/statistics`
  - `GET /api/admin/scan-history`
  - `GET /api/admin/scan-statistics`

### 9.4 Lib and Config

- **api-routes.ts:** Add constants for the new routes.
- **Migrations:**
  - `scanners` table.
  - `scan_system_config` table + seed.
  - `scans`: add `scanner_id`, `qr_ticket_id`; extend `scan_result` CHECK with `'wrong_event'`; adjust RLS for scanners.

---

## 10. Migrations Checklist

1. **`yyyymmdd-create-scanners-table.sql`**
   - CREATE `scanners` (id, name, email, password_hash, is_active, created_by, created_at, updated_at).  
   - Indexes; RLS for super_admin only (via service role in API).

2. **`yyyymmdd-create-scan-system-config.sql`**
   - CREATE `scan_system_config` (id, scan_enabled, updated_by, updated_at).  
   - INSERT one row: `scan_enabled = false`.

3. **`yyyymmdd-alter-scans-for-scanners.sql`**
   - ADD `scanner_id` UUID REFERENCES `scanners(id)`.
   - ADD `qr_ticket_id` UUID REFERENCES `qr_tickets(id)`.
   - ALTER `scan_result` CHECK to include `'wrong_event'`.
   - Backfill not required for existing rows (`scanner_id`, `qr_ticket_id` nullable).
   - Update RLS: allow INSERT when `scanner_id` is set and matches authenticated scanner (enforced in API); allow SELECT for own `scanner_id`; keep admin/super_admin full access.

---

## 11. Implementation Order (Summary)

1. **DB:** Create `scanners`, `scan_system_config`; alter `scans` (scanner_id, qr_ticket_id, wrong_event, RLS).
2. **APIs:**
   - `GET /api/scan-system-status`
   - `POST /api/scanner-login`
   - `PATCH /api/admin/scan-system-config`
   - `GET /api/admin/scanners`, `POST`, `PATCH`, `DELETE`
3. **Validate-ticket:** Scanner auth, `scan_enabled` check, `secure_token` → `qr_tickets` (tickets + invitations), write `scans` with `scanner_id` and `qr_ticket_id`, return all statuses and display fields.
4. **APIs:** `GET /api/scanner/events`, `GET /api/scanner/scans`, `GET /api/scanner/statistics`, `GET /api/admin/scanners/:id/scans`, `GET /api/admin/scanners/:id/statistics`, `GET /api/admin/scan-history`, `GET /api/admin/scan-statistics`.
5. **Super Admin tab:** Scanners CRUD, Start/Stop, per-scanner and global history, numbers, charts.
6. **Scanner app:**
   - Status gate: call only `GET /api/scan-system-status` when unknown; if disabled, show "Scan don't start yet", no other calls.
   - Login, Events, Scan (Start / timeout / Restart / result / Start again), History and numbers.
7. **PWA and mobile:** manifest, service worker, camera + HTTPS, timeout/Restart UX on iOS and Android.

---

## 12. Dependencies

- **QR:** `html5-qrcode` or `@yudiel/react-qr-scanner`.
- **PWA:** `vite-plugin-pwa` (or similar).
- **Password:** `bcrypt` or `bcryptjs` (likely already in project for admins).
- **Charts:** `recharts` (already used).
- **Auth:** JWT or signed cookies for scanner token (reuse existing patterns where possible).

---

## 13. Risks and Decisions

| Topic | Decision / Risk | Mitigation |
|-------|------------------|------------|
| **`scans` and `pass_purchases`** | Current `scans.ticket_id` → `pass_purchases`. New flow uses `qr_tickets` and `scans.qr_ticket_id`. | Support both: `validate-ticket` with `secure_token` writes `qr_ticket_id`; legacy `qrCode` can keep `ticket_id` to `pass_purchases` during transition. |
| **Invitations in same table** | `qr_tickets` holds both tickets and invitations. | Branch on `source` and `invitation_id`; invitations have no `ambassador_name`; join `official_invitations` only when extra fields are needed. |
| **“No requests when disabled”** | Scanner must avoid almost all calls when `scan_enabled === false`. | Single allowed call: `GET /api/scan-system-status`. App logic and `ProtectedScannerRoute` (or equivalent) block all other requests when `enabled === false`. |
| **iOS camera** | `getUserMedia` and permissions. | HTTPS; start camera only after Start (user gesture); handle denial with message and optional manual token entry. |
| **Timeout value** | 60–120 s. | Make configurable in a later phase (e.g. in `scan_system_config` or scanner app settings). |
| **Scanner token storage** | Cookie vs `localStorage`. | Prefer HTTP-only cookie for `scanner_token` to limit XSS; or short-lived JWT in memory + refresh. |

---

**Next step:** Implement migrations for `scanners`, `scan_system_config`, and `scans` changes; then `GET /api/scan-system-status`, `POST /api/scanner-login`, and `PATCH /api/admin/scan-system-config` plus the super-admin Start/Stop UI.
