# QR Code Scanner for Entry — Implementation Plan

**Purpose:** Build a professional, modern, responsive QR scanner app for event entry.  
**Scope:** Plan only — no code changes.  
**References:** `SCAN_APP_SPECIFICATION.md`, `SCAN_APP_DESIGN.md`.

---

## 1. What We’re Building

- **QR Scanner app** for ambassadors and admins to validate tickets at the door.
- **Web-first PWA** (runs in browser on phones/tablets/desktop, add-to-home-screen).
- **Main flow:** Login → Select event → Scan QR (or manual token) → See result (valid / invalid / already used / wrong event / expired) → Optional history and stats.

---

## 2. Platform & Tech Choices

| Area | Choice | Why |
|------|--------|-----|
| **Platform** | **Web PWA** | Fits current Vite/React stack, no app store, works on any device with a browser. |
| **QR on web** | **`html5-qrcode`** or **`@yudiel/react-qr-scanner`** | Camera via `getUserMedia`, works on iOS Safari and Android Chrome. |
| **Styling** | **Tailwind** + **SCAN_APP_DESIGN.md** | Same as Andiamo; dark theme, red accent, Montserrat. |
| **UI components** | **Existing shadcn/Radix** | Buttons, dialogs, inputs, toasts. |
| **Auth** | **Reuse ambassador + admin** | Ambassador login and admin login; scanner is a “mode” after login. |
| **API base** | **Existing `getApiBaseUrl()` + `API_ROUTES`** | Same as rest of app. |

**Later (optional):** React Native or native app if you need app-store distribution or deeper device integration.

---

## 3. Backend: Gaps vs Spec

### 3.1 `POST /api/validate-ticket` — Align with spec

**Current:**  
- Body: `qrCode`, `eventId`, `ambassadorId`, `deviceInfo`, `scanLocation`  
- Lookup: `pass_purchases` by `qr_code`  
- `scans.ticket_id` → `pass_purchases.id`

**Spec / `qr_tickets`:**  
- Body: `secure_token`, `event_id`, `scanner_id`, `scanner_type`, `scan_location`, `device_info`  
- Lookup: `qr_tickets` by `secure_token`  
- `scans` should work with the ticket used for the scan.

**Plan:**

1. **Support `secure_token` as primary**
   - Accept either `secure_token` or `qrCode` in the body (for a transition period).
   - If `secure_token`:
     - Resolve via `qr_tickets` (and related `tickets` / `orders` / `events`).
     - Map to the id that `scans` expects (or extend `scans` to store `qr_ticket_id` / `ticket_id` consistently).
   - If only `qrCode`: keep current `pass_purchases` + `qr_code` behavior.

2. **Unify request/response with spec**
   - Request: add `scanner_id`, `scanner_type`; treat `event_id`/`eventId` and `scan_location`/`scan_location` as one set of names.
   - Response: match spec (e.g. `result`, `ticket` with `buyer_name`, `pass_type`, `order_number`, `event_name`, etc.; `previous_scan` for `already_scanned`).

3. **Auth**
   - Validate that the caller is an authenticated ambassador or admin; derive `scanner_id` and `scanner_type` from session/JWT instead of trusting the client.

4. **`scans` and `qr_tickets`**
   - Decide how `scans.ticket_id` links to `qr_tickets`/`tickets`/`pass_purchases` so every scan is stored consistently. If `qr_tickets` is source of truth for scanning, add a migration or column so scans can reference it (or always resolve `ticket_id` from `qr_tickets.ticket_id` and existing FKs).

5. **`wrong_event`**
   - Implement `wrong_event` when the ticket’s `event_id` ≠ requested `event_id`; return `correct_event` as in spec.

### 3.2 New or extended API endpoints

| Endpoint | Purpose | Used by |
|----------|---------|---------|
| `GET /api/events` or `GET /api/events/active` | List events (e.g. `date >= today`) for event selector | Scanner |
| `GET /api/scans` or use existing ambassador/admin APIs | Scan history (filter by event, date, result, scanner) | History screen |
| `GET /api/scan-statistics` or similar | Aggregates: valid, invalid, already_scanned, by time, by pass type | Stats screen |
| `POST /api/scan-sync` | Submit queued offline scans when back online | Offline (Phase 2) |

**Auth:** Reuse ambassador/admin auth; scope by role (ambassador: own scans and assigned events; admin: all).

---

## 4. Frontend: Screens and Flows

### 4.1 Routes (under `/scanner` or `/scan`)

- `/scanner` — Redirect: if no event selected → event selection; else → main scan screen.
- `/scanner/events` — Event selection.
- `/scanner/scan` — Main scanner (camera + overlay + controls).
- `/scanner/history` — Scan history (list, filters, search).
- `/scanner/stats` — Statistics.
- `/scanner/settings` — Sound, haptics, default location, offline, about.

**Entry:** From ambassador dashboard or admin dashboard: “Open scanner” → `/scanner` (or `/scanner/events`).  
**Auth guard:** Reuse existing ambassador/admin route protection; unauthenticated → redirect to ambassador or admin login.

### 4.2 Screen-by-screen

- **Event selection**  
  - List active events (from `GET /api/events` or `.../active`).  
  - Search, cards with name/date/venue, “Select”.  
  - Persist selected `event_id` (e.g. `localStorage` + context) so `/scanner/scan` knows which event.

- **Main scan**
  - Header: selected event name, date, venue; change event; settings/menu.
  - **Camera:** Full-width (mobile) or left column (desktop).  
    - QR viewfinder overlay (e.g. red frame, optional scanning line) per SCAN_APP_DESIGN.
  - **Controls:** Flash, Manual entry, History, (Settings on mobile in bottom bar).
  - **Validation:** On QR decode → call `POST /api/validate-ticket` with `secure_token` (or `qrCode` during transition) and `event_id`, `scanner_id`, `scanner_type`, `scan_location`, `device_info`.
  - **Result overlay (modal):**  
    - Valid: green, ticket summary (name, pass, order #, etc.), “Close” / “Next scan”.  
    - Invalid / already_scanned / wrong_event / expired: red/amber, message, and for `already_scanned`: previous_scan.  
  - **After result:** Auto-return to camera after a few seconds (configurable) or on “Next scan”.  
  - **Manual entry:** Modal with one input (UUID `secure_token`), paste, format hint, Validate/Cancel. Same `validate-ticket` call.

- **History**
  - List of scans (newest first): result icon, name, pass, order, time, optional location.  
  - Filters: All / Valid / Invalid / Already scanned / Date.  
  - Search: name, order, token.  
  - Tap row → detail (full ticket + scan metadata).  
  - Pull-to-refresh, “Load more” if paginated.

- **Stats**
  - Cards: Valid, Invalid, Already scanned, Success rate.  
  - Time range: Today / Week / Month.  
  - Simple charts: scans over time, by result, by pass type (use existing `recharts`).

- **Settings**
  - Sound on/off, haptic on/off, auto-return delay, default scan location.  
  - Offline: show queued count, “Sync now” (when we add offline).  
  - About: version, support, logout.

### 4.3 Responsive and UX (from SCAN_APP_DESIGN)

- **Breakpoints:** Mobile &lt; 768px, tablet 768–1023px, desktop 1024px+.  
- **Mobile:** Bottom bar for Flash / Manual entry / History / Settings; stats bar between camera and controls; camera max-height so controls stay visible; 44px min touch targets; `font-size: 16px` on inputs to avoid iOS zoom; safe-area insets.  
- **Desktop:** Camera + “Recent scans” side panel; same overlays and modals, larger controls.  
- **Feedback:** Success (green check + sound + haptic), error (red + sound + haptic), warning (amber).  
- **Loading:** “Validating…” during the `validate-ticket` request; disable camera/Manual until response.

---

## 5. Data and State

- **Selected event:** React context or `localStorage` + context; key e.g. `scanner_selected_event_id`.
- **Scan history (in-memory for “Recent” on scan screen):** Last N scans from the current session; can be backed by the same list as History (e.g. first page of `GET /api/scans` for this event).
- **Scanner identity:** From auth (ambassador or admin): `scanner_id`, `scanner_type`.  
- **Device info:** `navigator.userAgent` or a short device string.  
- **Scan location:** From settings or a picker; required if backend expects it (or allow null initially).

---

## 6. Implementation Phases

### Phase 1 — Core (MVP)

1. **Backend**
   - Extend `validate-ticket` to accept `secure_token` and resolve via `qr_tickets`; keep `qrCode` + `pass_purchases` as fallback.
   - Align request/response with spec (`scanner_id`, `scanner_type`, `wrong_event`, `previous_scan`, etc.).
   - Add `GET /api/events` or `GET /api/events/active` for the scanner.
   - Ensure `scans` is written correctly for both `qr_tickets` and legacy `pass_purchases` paths.

2. **Frontend — structure**
   - Routes: `/scanner`, `/scanner/events`, `/scanner/scan`, `/scanner/history`, `/scanner/settings` (stats can be Phase 2).
   - Auth guard and “Open scanner” entry from ambassador/admin.

3. **Frontend — event selection**
   - Fetch events, search, select, persist.

4. **Frontend — main scan**
   - Integrate QR library (`html5-qrcode` or `@yudiel/react-qr-scanner`), camera permission handling.
   - Overlay (frame, “Point at QR”).
   - Call `validate-ticket` on decode; show result overlay (valid / invalid / already_scanned / wrong_event / expired).
   - Manual entry modal and same `validate-ticket` call.
   - Flash toggle; “Recent” on desktop (reuse history fetch).

5. **Frontend — history**
   - `GET /api/scans` (or existing ambassador/admin scan endpoint); list, filters, search, detail.

6. **Frontend — settings**
   - Sound, haptics, default location, about, logout.

7. **Design**
   - Apply SCAN_APP_DESIGN (colors, typography, components, layout) across scanner routes.

### Phase 2 — Polish and stats

- **Statistics screen:** `GET /api/scan-statistics`, cards and charts.
- **Offline:** Detect offline, queue scans in IndexedDB, `POST /api/scan-sync` when online; show queue and “Sync” in Settings.
- **PWA:** `manifest.json`, service worker, “Add to home screen” (can use Vite PWA plugin).
- **Small UX improvements:** Animations (success/error), optional scan sound/haptics toggles, better error messages.

### Phase 3 — Optional

- **`wrong_event` in DB:** e.g. `scans.scan_result = 'wrong_event'` if not already.
- **Admin-only:** Broader history, cross-event stats, export.
- **Native app:** If you need app-store or offline-first native, plan a separate React Native (or native) project that reuses the same `/api/validate-ticket` and `/api/events`, `/api/scans`, `/api/scan-statistics`, `/api/scan-sync`.

---

## 7. File and Route Map (for implementation)

- **Routes (e.g. in `App.tsx` or router config):**
  - `/scanner` → `ScannerLayout` or `ScannerIndex` (redirect to events or scan).
  - `/scanner/events` → `ScannerEvents`.
  - `/scanner/scan` → `ScannerScan`.
  - `/scanner/history` → `ScannerHistory`.
  - `/scanner/stats` → `ScannerStats`.
  - `/scanner/settings` → `ScannerSettings`.

- **New dirs/files (suggested):**
  - `src/pages/scanner/`  
    - `index.tsx` (or `ScannerIndex.tsx`)  
    - `Events.tsx`  
    - `Scan.tsx`  
    - `History.tsx`  
    - `Stats.tsx`  
    - `Settings.tsx`
  - `src/contexts/ScannerContext.tsx` (selected event, device info, scanner id/type).
  - `src/components/scanner/`  
    - `QRScanner.tsx` (camera + QR lib + overlay)  
    - `ScanResultOverlay.tsx`  
    - `ManualEntryModal.tsx`  
    - `RecentScansList.tsx` (desktop side panel)

- **API / lib:**
  - `src/lib/api-routes.ts`: add `EVENTS_ACTIVE`, `SCANS`, `SCAN_STATISTICS`, `SCAN_SYNC` if new.
  - `src/lib/` or `src/api/`: `validateTicket`, `fetchActiveEvents`, `fetchScans`, `fetchScanStatistics`, `syncScans` (for offline).

- **Backend:**
  - `server.cjs`:  
    - `POST /api/validate-ticket`: `secure_token` + `qrCode` handling, `scanner_id`/`scanner_type`, `wrong_event`, `previous_scan`.  
  - New or extended:  
    - `GET /api/events` or `GET /api/events/active`  
    - `GET /api/scans` (or reuse existing)  
    - `GET /api/scan-statistics`  
    - `POST /api/scan-sync` (Phase 2)

---

## 8. Dependencies to Add

- **QR:** `html5-qrcode` or `@yudiel/react-qr-scanner` (and ensure `getUserMedia` is available; HTTPS in production).
- **PWA (Phase 2):** `vite-plugin-pwa` (or similar).

No other mandatory deps; use existing Tailwind, shadcn, `recharts`, `date-fns`, `lucide-react`.

---

## 9. Risks and Decisions

| Topic | Risk / decision | Mitigation |
|-------|------------------|------------|
| **QR model:** `qr_code` vs `secure_token` | Two systems in DB; tickets may use one or the other | Support both in `validate-ticket`; document which QR format (UUID vs hex) is used where; migrate to `secure_token` as canonical. |
| **`scans.ticket_id` → `pass_purchases`** | `qr_tickets` uses `tickets`; `scans` uses `pass_purchases` | Map `qr_tickets.ticket_id` to the correct FK for `scans`, or add `scans.qr_ticket_id` and backfill; decide in Phase 1. |
| **Camera on iOS Safari** | Strict rules for `getUserMedia` (HTTPS, user gesture) | Use HTTPS; start camera only after user taps “Start scanning” or “Allow”; handle permission denied with fallback to Manual entry. |
| **Ambassador vs admin** | Different scan lists and stats visibility | Reuse existing ambassador/admin checks; `GET /api/scans` and `GET /api/scan-statistics` filter by `scanner_id` or role. |

---

## 10. Definition of “Professional, Modern, Responsive”

- **Professional:** Clear flows, correct validation rules, aligned with spec and design; audit trail in `scans`; sensible errors and messages.
- **Modern:** Dark theme, simple typography, subtle motion, glass-style panels where in the design; fast camera and validation.
- **Responsive:** Usable on phones (portrait), tablets, and desktops; touch-friendly on mobile; keyboard and screen-reader friendly where possible (per SCAN_APP_DESIGN).

---

## 11. Order of Work (summary)

1. **Backend:** `validate-ticket` (secure_token, spec-shaped request/response, `wrong_event`), `GET /api/events` or `.../active`, `GET /api/scans` (or reuse), and `scans`/`qr_tickets`/`pass_purchases` consistency.
2. **Frontend:** Routes, auth, `ScannerContext`, event selection, main scan (QR + manual + result overlay), history, settings.
3. **Design:** Apply SCAN_APP_DESIGN across scanner; test on 320px, 768px, 1024px+.
4. **Phase 2:** Stats, offline + sync, PWA.
5. **Phase 3:** Extra admin features, optional native app.

---

**Next step:** When you’re ready to implement, start with Phase 1 backend `validate-ticket` and `GET /api/events` (or `.../active`), then the scanner routes and the main Scan screen.
