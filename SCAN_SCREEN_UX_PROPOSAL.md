# Scanner Screen — UX/UI Proposal for Event Conditions

**Focus:** Real event conditions — fast queue, low light, stress, offline risk.  
**Scope:** UI/UX and interaction only; no business-logic changes.  
**Constraints:** Dark mode, 50% brightness readable, scanning speed first.

---

## 1. Prioritized Improvements

### High impact (do first)

| # | Improvement | Reason |
|---|-------------|--------|
| 1 | **Single primary CTA after scan: "Scan next"** | Removes decision: one tap to continue. Saves 1–2 s per guest in a queue. |
| 2 | **Status-first result: big status + icon, then details** | Valid/invalid/duplicate/expired must be obvious in &lt;0.5 s in sun or low light. |
| 3 | **Stronger contrast for status and key text** | `#B0B0B0` fails at 50% brightness outdoors. Bump to `#D4D4D4` (muted) and `#FFFFFF` for primary. |
| 4 | **Clear information hierarchy in result card** | Pass type and name largest; ID/email/ts smaller. Speeds up gate decision. |
| 5 | **Haptics + short sound for VALID/INVALID/ALREADY** | Eyes on phone/queue; audio+touch confirm without looking. |
| 6 | **"Undo" window after valid scan (e.g. 3–5 s)** | Catches mis-scans before next; no extra tap in happy path. |

### Medium impact

| # | Improvement | Reason |
|---|-------------|--------|
| 7 | **Session stats: Valid as primary, problems highlighted** | Valid = throughput; invalid/duplicate/expired need attention without hunting. |
| 8 | **Recent scans: color edge, compact rows, tap to expand** | At-a-glance status; details on demand; less scrolling. |
| 9 | **Offline + last-sync indicator (non-blocking)** | Reduces stress when network is flaky; clear “we’re synced” vs “pending”. |
| 10 | **"Scan next" persists when result is shown** | One zone to tap; no hunting for the right button. |
| 11 | **Micro-animation on status (pulse/check/error)** | Reinforces status in peripheral vision. |

### Low impact (nice to have)

| # | Improvement | Reason |
|---|-------------|--------|
| 12 | **Low-battery warning (e.g. &lt;20%)** | Avoids surprise shutdown during rush. |
| 13 | **Optional capacity / progress (e.g. “~120/500”)** | Useful only if you have a target; else skip. |
| 14 | **Slightly larger camera viewfinder when scanning** | More forgiving in low light; keep Stop easily tappable. |

---

## 2. Redesigned Layout (Component Hierarchy + Spacing + Typography)

### Component hierarchy

```
ScannerScreen (min-h-screen, flex flex-col, p-4 pb-28)
├── HeaderStrip (flex, justify-between, items-center, mb-3)
│   ├── EventName (truncate, 1 line)
│   └── IconGroup (History, Logout) — 44×44 tap targets
│
├── [State A: Idle] IdleActions (flex gap-2, mb-3)
│   ├── StartScanningButton (primary, flex-1, h-12)
│   └── ManualEntryButton (outline, h-12)
│
├── [State B: Scanning] 
│   ├── CameraView (rounded-lg, border-2, max-h-[40vh], mb-2)
│   ├── ScanningHint (text muted, mb-2) "Point at QR code"
│   └── StopScanButton (outline, self-end, h-10)
│
├── [State C: Validating] ValidatingOverlay (py-8, spinner + "Validating…")
│
├── [State D: Result] ResultCard (mt-3, p-4, rounded-xl, border-2, status-based)
│   ├── StatusBlock (icon + label, dominant)
│   ├── TicketDetails (hierarchy below)
│   ├── [if valid] UndoHint + UndoCountdown (small, 3–5s)
│   └── PrimaryActions (flex gap-2, mt-4)
│       ├── [valid] ScanNextButton (primary, flex-1, h-12)
│       ├── [valid, optional] UndoButton (outline, 3–5s only)
│       └── [invalid/dup/exp] ScanNextButton (primary, flex-1, h-12)
│
├── SessionStatsSection (mt-4, p-3, rounded-lg, bg-[#1C1C1C], border)
│   └── (see §6)
│
├── RecentScansSection (mt-2, compact)
│   └── (see §7)
│
└── ManualEntryModal (existing, keep)
```

### Spacing (Tailwind)

| Zone | Values | Notes |
|------|--------|-------|
| Screen padding | `p-4`, `pb-28` | Keep; safe area via `pb-[max(1.5rem,env(safe-area-inset-bottom))]` on phones. |
| Between major blocks | `mb-3` (12px) | Header → Actions, Camera → Hint, Result → Stats. |
| Inside ResultCard | `p-4`, `space-y-3` | Status block `mb-3`; details `space-y-1.5`. |
| Stats section | `p-3`, inner `gap-2` | Dense but scannable. |
| Recent list | `space-y-1` | Tighter for speed; §7. |

### Typography (readable at 50% brightness)

| Element | Font size | Weight | Color | Example |
|---------|-----------|--------|-------|---------|
| Event name (header) | 16px | 600 | `#FFFFFF` | `text-base font-semibold text-white` |
| Status label (VALID/INVALID/etc.) | 20–22px | 700 | Status color | `text-xl font-bold` + status |
| Pass type | 17–18px | 600 | `#FFFFFF` | `text-[17px] font-semibold` |
| Recipient/Buyer name | 16px | 500 | `#F5F5F5` | `text-base font-medium text-[#F5F5F5]` |
| Invitation ID, Email, Scanned ts | 13–14px | 400 | `#A3A3A3` | `text-sm text-[#A3A3A3]` |
| Session stats labels | 13px | 500 | `#A3A3A3` | `text-[13px] font-medium` |
| Session stats values | 15px | 600 | `#FFFFFF` / status | `text-[15px] font-semibold` |
| Recent scan primary | 14px | 500 | `#F5F5F5` | `text-sm font-medium` |
| Recent scan secondary | 12px | 400 | `#A3A3A3` | `text-xs` |

**Rule:** No important decision-making text below `#A3A3A3` or &lt;13px at 50% brightness.

---

## 3. Status Feedback: VALID, INVALID, ALREADY SCANNED, EXPIRED

### Colors (dark BG, 50% brightness)

| Status | Border/glow | BG tint | Text | Token |
|--------|-------------|---------|------|-------|
| VALID | `#22C55E` | `#22C55E` 12% | `#22C55E` | `status-valid` |
| INVALID | `#EF4444` | `#EF4444` 12% | `#EF4444` | `status-invalid` |
| ALREADY SCANNED | `#F59E0B` | `#F59E0B` 12% | `#F59E0B` | `status-already` |
| EXPIRED | `#A3A3A3` | `#525252` 80% | `#D4D4D4` | `status-expired` |
| WRONG_EVENT | `#F59E0B` | same as ALREADY | `#F59E0B` | `status-wrong` |

Use `border-2` and `bg-[color]/[0.12]` so status is obvious in low light.

### Icons (Lucide, 28–32px in result card)

| Status | Icon | Semantic |
|--------|------|----------|
| VALID | `CheckCircle2` | Success |
| INVALID | `XCircle` | Error |
| ALREADY SCANNED | `ScanSearch` or `Copy` | Duplicate |
| EXPIRED | `Clock` | Time |
| WRONG_EVENT | `MapPinOff` or `ArrowRightLeft` | Wrong place |

Place icon left of the status label, same row.

### Micro-animations (CSS, ~200–400ms)

- **VALID:**  
  - Icon: `scale(0.85)→1` + light opacity `0.7→1` with `cubic-bezier(0.34, 1.56, 0.64, 1)`.  
  - Optional: soft green pulse on the result card border once.
- **INVALID / ALREADY / EXPIRED:**  
  - Icon: `scale(0.9)→1` + opacity `0.8→1`; no pulse.

Use `transform` and `opacity` only; avoid layout thrash.

### Sound (optional, short, non-blocking)

| Status | Suggestion |
|--------|------------|
| VALID | Single, medium-pitch beep (e.g. 400 Hz, 80 ms). |
| INVALID | Two short lower beeps (e.g. 300 Hz, 60 ms × 2). |
| ALREADY SCANNED | One lower, one medium (different from VALID/INVALID). |
| EXPIRED | Same as INVALID or one low long beep. |

Respect system/device mute; make sound toggle in app settings.

### Haptics (optional)

- **VALID:** `navigator.vibrate(50)` or `window.navigator.vibrate?.([30, 20, 30])`.  
- **INVALID / ALREADY:** `navigator.vibrate([40, 30, 40])` (double pattern).  
- **EXPIRED:** `navigator.vibrate(80)` (one longer).  
- **Validating:** No vibration.

Check `'vibrate' in navigator`; no-op if unsupported.

---

## 4. Information Hierarchy in the Result Card

**Rule:** First line = pass + who; next = supporting (ID, contact, time). Invitation vs buyer is a variant of “who”.

### Order and size (top → bottom)

| Priority | Field | Size | Weight | Color | Notes |
|----------|-------|------|--------|-------|--------|
| 1 | Status (VALID / INVALID / etc.) | 20–22px | 700 | Status | With icon; always first. |
| 2 | Pass type | 17–18px | 600 | `#FFFFFF` | e.g. "VIP", "Standard". |
| 3 | Recipient (invitation) or Buyer | 16px | 500 | `#F5F5F5` | Main identifier. |
| 4 | Invitation ID (if invitation) | 14px | 500 | `#A3A3A3` | e.g. "INV-0123". |
| 5 | Email or Contact | 13px | 400 | `#A3A3A3` | One line; truncate with ellipsis. |
| 6 | Scanned at | 12px | 400 | `#737373` | Only for valid; e.g. "14:32:05". |

**Secondary (only when relevant):**

- **ALREADY SCANNED:** “Previously: [scanner], [time]” — 13px, `#F59E0B`.  
- **WRONG_EVENT:** “Correct event: [name], [date]” — 13px, `#A3A3A3`.

### Layout sketch (ResultCard)

```
┌─────────────────────────────────────────────────────────┐
│ [✓] VALID                                    [status]  │
│                                                         │
│ VIP                              ← pass_type, 17px      │
│ Marie Dupont                     ← recipient/buyer 16px │
│ INV-0042 · marie@…               ← invitation + email   │
│ 14:32:05                         ← scanned_at           │
│                                                         │
│ [ Undo 4s ]   [ Scan next ]      ← buttons              │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Button Behavior: Before vs After Scan

### Before first scan (idle)

- **Primary:** `Start scanning` (or `Start`). Icon: `Play` or `ScanLine`. Full-width or `flex-1`, `h-12`, `rounded-lg`.  
- **Secondary:** `Manual entry`. Icon: `PenLine`. Outline, same height.  
- **Header:** History, Logout only. No Stop.

### While scanning

- **Stop** visible next to “Point at QR code”. Outline, `h-10`, red border/text.  
- No “Scan next” yet.

### After result (valid or invalid/dup/exp)

- **Primary (always):** `Scan next`.  
  - Label: “Scan next” (not “Start”).  
  - Same style as “Start scanning” so tap zone is consistent.  
  - On press: clear result, `onStart()` (restart camera).  
  - Place: bottom of `ResultCard`, full-width, `h-12`, `mt-4`.
- **Undo (valid only, 3–5 s window):**  
  - Shown as `Undo (4s)` next to “Scan next” or above it; countdown 5→0.  
  - On press: call an `onUndo(scanId)` (or equivalent) and clear result + show toast “Undo sent” if your backend supports it; if not, hide button and document as “reserved for future.”  
  - After 0: hide Undo; only “Scan next” remains.

### Timeout (camera)

- **Restart** = same behavior as “Start scanning” (restart camera).  
- No “Scan next” in timeout state.

### Component naming

- `StartScanningButton` — idle.  
- `ScanNextButton` — after result; reuses `onStart` internally.  
- `UndoButton` — optional, valid-only, with `UndoCountdown` (e.g. 5–0).

---

## 6. Session Stats Redesign (Actionable)

### Goals

- Valid = “good throughput.”  
- Invalid / Already / Expired = “needs attention” without reading all numbers.

### Layout (compact block)

- **Row 1 — Valid (primary):**  
  - `Valid` label (13px, `#A3A3A3`) + `{count}` (15–18px, `#22C55E`).  
  - Optional: slim **progress bar** for “valid vs total” (e.g. `height: 4px`, `bg-[#22C55E]`, `rounded-full`; width = `(valid / total) * 100%`).  
- **Row 2 — Problems (only if &gt; 0):**  
  - `Invalid` `{n}` (red), `Already` `{n}` (amber), `Expired` `{n}` (gray), `Wrong` `{n}` (amber).  
  - Separator: `·` or `|` in `#525252`.  
  - Slight emphasis if `invalid + already_scanned + expired ≥ 3` (e.g. amber left border or “Review” chip; no extra tap needed for core flow).  
- **Row 3 (optional):**  
  - “By pass: VIP 12, Standard 8” — 12px, `#737373`; collapse to one line, truncate if long.

### Capacity (optional)

- Only if you have a **target** (e.g. 500):  
  - `~120/500` or `24%` next to Valid, 12px.  
  - Or a second slim bar: `total / capacity`.  
- If no target, omit.

### Spacing and container

- Container: `p-3`, `rounded-lg`, `bg-[#1C1C1C]`, `border border-[#2A2A2A]`.  
- Between rows: `gap-1.5` or `space-y-1.5`.  
- Progress bars: `h-1` or `h-1.5`, `mt-1`, `rounded-full`, `bg-[#2A2A2A]`; fill = status color.

---

## 7. Recent Scans List Redesign

### Objectives

- Quick status read (color edge).  
- Dense but tappable; expand for details.  
- Limit to last **N** (e.g. 5–6) for speed; “See full history” if needed.

### Row (default)

- **Left edge:** 3–4px vertical stripe in status color (`#22C55E` / `#EF4444` / `#F59E0B` / `#A3A3A3`).  
- **Body:**  
  - **Primary:** Time (e.g. `14:32`) 12px `#737373` + status chip (Valid / Invalid / Already / Exp / Wrong) 11–12px + name (truncate) 14px `#F5F5F5`.  
  - **Secondary:** Pass type 12px `#A3A3A3`.  
- **Spacing:** `py-2`, `gap-2`; `space-y-1` between rows.  
- **Tap:** Toggle “expanded” for that row.

### Expanded row (on tap)

- Same + one extra line: full name, pass, and if available Invitation ID or “Correct event” for wrong_event.  
- Slight `bg-[#252525]` or `pl-2` indent to show expansion.  
- **Max height:** list `max-h-32` or ~6 rows; scroll if more.  
- **Limit:** 5–6 items; then “View full history” linking to `/scanner/history`.

### Component structure

- `RecentScansList` (container).  
- `RecentScanRow` (with `isExpanded`, `onToggle`).  
  - `StatusEdge` (3–4px, full height, status color).  
  - `RecentScanRowContent` (time, chip, name, pass).  
  - `RecentScanRowExpanded` (optional, conditional).

---

## 8. Dark Mode Contrast for Outdoor / Low Brightness

### Principles

- At 50% brightness, prefer **WCAG AA** for important text (≈4.5:1 on background).  
- Status and primary actions must stay above ~4:1.

### Recommended palette (on `#1A1A1A` / `#1C1C1C`)

| Role | Hex | Use | Contrast (on #1A1A1A) |
|------|-----|-----|------------------------|
| Primary text | `#FFFFFF` | Event name, pass type, primary CTA label | ~16:1 |
| Secondary text | `#F5F5F5` | Recipient/buyer name | ~15:1 |
| Muted | `#A3A3A3` | Labels, ID, email, secondary info | ~6:1 |
| De-emphasized | `#737373` | Scanned at, “By pass”, time in list | ~4.5:1 |
| Avoid at 50% | `#B0B0B0` | Replace with `#A3A3A3` or `#F5F5F5` where it matters | — |

### Status on dark

- **VALID** `#22C55E`: ~4.5:1 on `#1A1A1A`; OK.  
- **INVALID** `#EF4444`, **ALREADY** `#F59E0B`: similar; ensure 4:1+.  
- **EXPIRED** `#A3A3A3` or `#D4D4D4`: ensure at least 4:1.

### Surfaces

- **Card / result:** `#1F1F1F` or `#252525`; borders `#2A2A2A` or `#404040` if you need a bit more separation in sun.  
- **Stats / recent:** `#1C1C1C`–`#252525`; avoid pure black `#000` next to `#1A1A1A` to reduce harsh edges.

### Check

- Test at 50% system brightness in daylight (or sim); all statuses and primary/secondary text must be readable without zooming.

---

## 9. Offline, Sync, and Low-Battery Indicators (Non‑Cluttering)

### Placement

- **Header strip (top-right), or a slim top banner (4–6px height):**  
  - One small region for: `[offline?] [last sync] [low battery?]`.  
  - Do not cover event name or main CTAs.

### Offline

- **Icon:** `WifiOff` 14–16px, `#EF4444` or `#F59E0B`.  
- **Tooltip or inline:** “Offline — scans will sync when back.”  
- **Behavior:**  
  - Validate can fail; show “Network error” in result card.  
  - Optionally: queue scans locally (only if you add that logic; here we only define the indicator).  
- **When online again:** icon disappears or switches to “Synced” (see below).

### Last sync

- **When online:** `Cloud` or `Check` 12–14px, `#22C55E` or `#A3A3A3`, + “Just now” / “2 min ago” (12px, `#737373`).  
- **Update:**  
  - “Just now” after a successful `loadScansAndStats` or after a successful validate that triggers refresh.  
  - Then relative: “1 min ago”, “5 min ago” (e.g. via a `lastSyncedAt` state and a 60s interval).  
- **Placement:** Next to Offline in the same group; hidden when Offline is shown.

### Low battery

- **When `navigator.getBattery?.()` or similar is &lt; ~20%:** `BatteryWarning` or `BatteryLow` 14px, `#F59E0B`.  
- **Optional tooltip:** “Low battery”.  
- **If API not available:** omit; no empty state.

### Layout (concrete)

- **Option A — In header, right of event name:**  
  - `[Event name --------- ] [History] [Logout] [Offline|Sync] [Battery?]`  
  - Icons only; 36–40px tap area; no text in default. Tooltip on long-press or `title`.  
- **Option B — Thin top strip:**  
  - `[ Offline — scans will sync when back ]` or `[ Synced 2 min ago ]` or `[ Low battery ]`  
  - One line, 12px, `#A3A3A3`; `#EF4444` for offline, `#F59E0B` for battery.  
  - Shown only when at least one of: offline, low battery, or “synced X ago” (e.g. &gt;1 min).  

Prefer **Option A** to avoid pushing main content down; use **Option B** only if you want maximum visibility for sync/offline.

### Component names

- `OfflineIndicator`  
- `LastSyncIndicator`  
- `LowBatteryIndicator`  
- `ConnectionStatusGroup` (wraps the three in header or strip)

---

## 10. Implementation Cheat Sheet

### New or renamed components

| Component | Role |
|-----------|------|
| `ScannerHeader` | Event name + History + Logout + `ConnectionStatusGroup` |
| `IdleActions` | Start scanning + Manual entry |
| `CameraView` | Wrapper for `#scanner-qr-reader`; same logic |
| `ScanningHint` | “Point at QR code” + Stop |
| `ResultCard` | StatusBlock + TicketDetails + Undo (optional) + ScanNextButton |
| `StatusBlock` | Icon + status label; takes `result` and maps to colors/icons |
| `TicketDetails` | Pass, Recipient/Buyer, Invitation ID, Contact, Scanned at — hierarchy as in §4 |
| `ScanNextButton` | Primary CTA after result; calls `onStart` |
| `UndoButton` + `UndoCountdown` | Valid-only, 5→0 s; `onUndo` if supported |
| `SessionStatsBlock` | Valid + bar; problem counts; optional “By pass” |
| `RecentScansList` | 5–6 `RecentScanRow`; StatusEdge, tap-to-expand |
| `ConnectionStatusGroup` | Offline / LastSync / LowBattery |

### Tailwind / CSS tokens to add

```css
/* Status */
.status-valid   { --c: #22C55E; }
.status-invalid { --c: #EF4444; }
.status-already { --c: #F59E0B; }
.status-expired { --c: #A3A3A3; }
.status-wrong   { --c: #F59E0B; }

/* Contrast-friendly muted (replace #B0B0B0 where it matters) */
.text-muted-strong { color: #A3A3A3; }
.text-muted-soft   { color: #737373; }
```

### Animation (example, VALID)

```css
@keyframes statusValidIn {
  0%   { opacity: 0.7; transform: scale(0.92); }
  100% { opacity: 1;   transform: scale(1);   }
}
.status-valid .StatusBlock { animation: statusValidIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
```

### Haptics (example)

```ts
function triggerHaptic(status: 'valid' | 'invalid' | 'already' | 'expired') {
  if (!('vibrate' in navigator)) return;
  switch (status) {
    case 'valid':   navigator.vibrate(50); break;
    case 'invalid':
    case 'already': navigator.vibrate([40, 30, 40]); break;
    case 'expired': navigator.vibrate(80); break;
  }
}
```

---

**End of proposal.** Use this as the UX/UI spec for the scanner screen; implement in small steps (e.g. §3 status + §4 hierarchy first, then §5 buttons, §6–§7, §9 last).
