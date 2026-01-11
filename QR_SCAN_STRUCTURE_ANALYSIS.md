# QR Scan Structure Analysis

**Date:** 2025-01-02  
**Type:** Structure Design & Analysis - NO CODE CHANGES  
**Purpose:** Validate and design correct database structure for QR scanning aligned with ticket generation

---

## ✅ QR IDENTITY CONFIRMATION

### Single Source of Truth: `tickets.secure_token`

**Confirmed:**
- **QR Payload:** `tickets.secure_token` (UUID v4)
- **Generation Location:** `server.cjs:7149` - `const secureToken = uuidv4();`
- **QR Encoding:** `server.cjs:7152` - `QRCode.toBuffer(secureToken, ...)`
- **Storage:** `tickets.secure_token` (TEXT, UNIQUE, indexed)
- **QR Image Storage:** Supabase Storage at `tickets/${orderId}/${secureToken}.png`
- **QR URL:** `tickets.qr_code_url` (public URL to stored image)

**Verdict:** ✅ `tickets.secure_token` is the single, authoritative QR identity.

---

## ❌ PASS_PURCHASES STATUS: LEGACY & UNUSED

### Evidence of Legacy Status

**Current Scan Implementation:**
- **Scan Endpoint:** `/api/validate-ticket` - `server.cjs:1726`
- **Queries:** `pass_purchases` table by `qr_code` field - `server.cjs:1738-1749`
- **Scans Table:** References `pass_purchases(id)` - `supabase/migrations/20250802000000-create-scans-table.sql:4`

**New Ticket Generation (Active System):**
- **Primary:** `server.cjs:7188` - Inserts into `tickets` table
- **Alternative:** `api/misc.js:1509` - Inserts into `tickets` table
- **Alternative:** `api/admin-approve-order.js:474` - Inserts into `tickets` table
- **Alternative:** `src/lib/ticketGenerationService.tsx:176` - Inserts into `tickets` table

**No Active Usage of `pass_purchases` for New Tickets:**
- ❌ No code found that inserts into `pass_purchases` for new ticket generation
- ❌ No code found that generates QR codes for `pass_purchases`
- ✅ All ticket generation flows use `tickets` table exclusively

**Verdict:** ✅ `pass_purchases` is **LEGACY** and **UNUSED** for new ticket generation. The scan system is misaligned with the generation system.

---

## 🔴 CURRENT SCAN TABLE ISSUES

### Table: `scans` (Current Implementation)

**Location:** `supabase/migrations/20250802000000-create-scans-table.sql`

**Current Structure:**
```sql
CREATE TABLE scans (
  id UUID PRIMARY KEY,
  ticket_id UUID REFERENCES pass_purchases(id) ON DELETE CASCADE,  -- ❌ WRONG TABLE
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE SET NULL,
  scan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scan_location TEXT,
  device_info TEXT,
  scan_result TEXT CHECK (scan_result IN ('valid', 'invalid', 'already_scanned', 'expired')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Critical Issues

| Issue | Severity | Description |
|-------|----------|-------------|
| **Wrong Foreign Key** | 🔴 CRITICAL | `ticket_id` references `pass_purchases(id)` but tickets are in `tickets` table |
| **Missing Order Link** | 🔴 CRITICAL | No `order_id` - cannot trace to `orders.source` without joins |
| **Missing Pass Link** | 🟡 HIGH | No `order_pass_id` - cannot identify pass type directly |
| **Missing Secure Token** | 🟡 HIGH | No `secure_token` - requires join to validate QR code match |
| **Ambiguous Scanner** | 🟡 HIGH | `ambassador_id` only - cannot track admin scans |
| **Missing Scanner Type** | 🟡 HIGH | No `scanner_type` - cannot distinguish admin vs ambassador |
| **Missing Scan Source** | 🟡 MEDIUM | No `scan_source` - cannot track where scan happened (gate/mobile/admin) |
| **Missing IP Address** | 🟡 MEDIUM | No `ip_address` - cannot audit scan location/security |
| **Field Naming** | 🟢 LOW | `scan_time` inconsistent with other tables using `*_at` suffix |

### What Cannot Be Answered with Current Structure

❌ **Which ticket is this?** - Cannot directly query by `secure_token`  
❌ **Which order?** - Requires join through non-existent relationship  
❌ **Sold via which source?** - Cannot access `orders.source` without complex joins  
❌ **Who sold it?** - Cannot access `orders.ambassador_id` without joins  
❌ **Which pass type?** - Cannot access `order_passes.pass_type` without joins  
❌ **Who scanned it (admin)?** - Only tracks ambassador scans  
❌ **Where was it scanned?** - `scan_location` exists but `scan_source` missing  

---

## ✅ REQUIRED SCAN TABLE STRUCTURE

### Proposed Table: `ticket_scans` (Correct Structure)

**Purpose:** Single source of truth for all QR code scans, aligned with `tickets` table.

```sql
CREATE TABLE ticket_scans (
  -- Primary Key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Ticket Identity (Direct Link)
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  secure_token TEXT NOT NULL,  -- Redundant but enables direct QR lookup
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_pass_id UUID NOT NULL REFERENCES order_passes(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Scan Result
  scan_result TEXT NOT NULL CHECK (scan_result IN (
    'valid',
    'already_used',
    'invalid',
    'expired',
    'wrong_event'
  )),
  
  -- Scanner Identity
  scanner_id UUID,  -- Can be admin.id OR ambassador.id
  scanner_type TEXT NOT NULL CHECK (scanner_type IN ('admin', 'ambassador', 'system')),
  scan_source TEXT CHECK (scan_source IN ('gate', 'admin', 'ambassador', 'mobile')),
  
  -- Scan Context
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scan_location TEXT,  -- Physical location (e.g., "Main Entrance", "VIP Gate")
  device_info TEXT,    -- Device/browser info
  ip_address TEXT,     -- IP address of scanner
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT ticket_scans_secure_token_fkey 
    FOREIGN KEY (secure_token) REFERENCES tickets(secure_token) ON DELETE CASCADE
);
```

### Indexes (Performance)

```sql
-- Fast QR code lookup
CREATE INDEX idx_ticket_scans_secure_token ON ticket_scans(secure_token);

-- Fast ticket lookup
CREATE INDEX idx_ticket_scans_ticket_id ON ticket_scans(ticket_id);

-- Fast order lookup
CREATE INDEX idx_ticket_scans_order_id ON ticket_scans(order_id);

-- Fast event lookup
CREATE INDEX idx_ticket_scans_event_id ON ticket_scans(event_id);

-- Fast scanner lookup
CREATE INDEX idx_ticket_scans_scanner_id ON ticket_scans(scanner_id) WHERE scanner_id IS NOT NULL;

-- Fast duplicate scan detection
CREATE INDEX idx_ticket_scans_ticket_valid ON ticket_scans(ticket_id, scan_result) 
  WHERE scan_result = 'valid';

-- Fast scan history by order
CREATE INDEX idx_ticket_scans_order_result ON ticket_scans(order_id, scanned_at DESC);
```

### Unique Constraint (Prevent Double Valid Scans)

```sql
-- Ensure only one valid scan per ticket
CREATE UNIQUE INDEX idx_ticket_scans_one_valid_scan 
  ON ticket_scans(ticket_id) 
  WHERE scan_result = 'valid';
```

**Note:** This allows multiple scan attempts (invalid, expired, etc.) but only one valid scan per ticket.

---

## 🔗 RELATIONSHIPS

### Foreign Key Chain

```
ticket_scans
  ├─ ticket_id → tickets.id
  ├─ secure_token → tickets.secure_token (redundant but enables direct QR lookup)
  ├─ order_id → orders.id
  ├─ order_pass_id → order_passes.id
  ├─ event_id → events.id
  └─ scanner_id → admins.id OR ambassadors.id (polymorphic, nullable)
```

### Data Access Path (No Guessing)

**From QR Code (`secure_token`) to Full Context:**

```
1. ticket_scans.secure_token = <scanned_value>
   ↓
2. ticket_scans.ticket_id → tickets.id
   ↓
3. tickets.order_id → orders.id
   ↓
4. orders.source → 'platform_cod' | 'platform_online' | 'ambassador_manual'  ✅ SOURCE
   ↓
5. orders.ambassador_id → ambassadors.id  ✅ SELLER
   ↓
6. orders.user_name, user_phone, user_email  ✅ BUYER
   ↓
7. ticket_scans.order_pass_id → order_passes.id
   ↓
8. order_passes.pass_type → 'VIP' | 'Standard' | etc.  ✅ PASS TYPE
   ↓
9. ticket_scans.event_id → events.id
   ↓
10. events.name, events.date, events.venue  ✅ EVENT
```

**All data accessible via direct foreign keys - no complex joins required.**

---

## 📊 FIELD MAPPING: CURRENT → CORRECT

### Current `scans` → Future `ticket_scans`

| Current Field | Future Field | Change | Reason |
|---------------|--------------|--------|--------|
| `id` | `id` | ✅ Keep | Primary key |
| `ticket_id` (→ pass_purchases) | `ticket_id` (→ tickets) | 🔴 **FIX** | Wrong table reference |
| `event_id` | `event_id` | ✅ Keep | Same |
| `ambassador_id` | `scanner_id` | 🟡 **RENAME** | More flexible (admin or ambassador) |
| - | `scanner_type` | 🟢 **ADD** | Distinguish admin/ambassador/system |
| - | `scan_source` | 🟢 **ADD** | Track where scan happened |
| `scan_time` | `scanned_at` | 🟡 **RENAME** | Consistent naming |
| `scan_location` | `scan_location` | ✅ Keep | Same |
| `device_info` | `device_info` | ✅ Keep | Same |
| - | `ip_address` | 🟢 **ADD** | Security/audit |
| `scan_result` | `scan_result` | 🟡 **ENHANCE** | Add 'wrong_event' option |
| `notes` | `notes` | ✅ Keep | Same |
| `created_at` | `created_at` | ✅ Keep | Same |
| `updated_at` | `updated_at` | ✅ Keep | Same |
| - | `secure_token` | 🟢 **ADD** | Direct QR lookup |
| - | `order_id` | 🟢 **ADD** | Direct order access |
| - | `order_pass_id` | 🟢 **ADD** | Direct pass type access |

---

## 🔄 SCAN VALIDATION FLOW (Conceptual)

### Step 1: QR Code Decode
- **Input:** Scanned QR code value (UUID string)
- **Action:** Decode QR code to get `secure_token`

### Step 2: Ticket Lookup
- **Query:** `SELECT * FROM tickets WHERE secure_token = <decoded_value>`
- **Result:** Ticket record with `order_id`, `order_pass_id`, `status`

### Step 3: Order Context Retrieval
- **Query:** `SELECT * FROM orders WHERE id = <ticket.order_id>`
- **Result:** `source`, `ambassador_id`, `user_name`, `user_phone`, `event_id`, `payment_method`

### Step 4: Pass Type Retrieval
- **Query:** `SELECT * FROM order_passes WHERE id = <ticket.order_pass_id>`
- **Result:** `pass_type`, `quantity`, `price`

### Step 5: Event Validation
- **Query:** `SELECT * FROM events WHERE id = <order.event_id>`
- **Result:** `name`, `date`, `venue`
- **Validation:** Check if event date is valid, event matches scan context

### Step 6: Duplicate Scan Check
- **Query:** `SELECT * FROM ticket_scans WHERE ticket_id = <ticket.id> AND scan_result = 'valid'`
- **Result:** If exists → `already_used`, else proceed

### Step 7: Record Scan
- **Insert:** `ticket_scans` with:
  - `ticket_id` = ticket.id
  - `secure_token` = ticket.secure_token
  - `order_id` = order.id
  - `order_pass_id` = order_pass.id
  - `event_id` = event.id
  - `scanner_id` = admin.id OR ambassador.id
  - `scanner_type` = 'admin' OR 'ambassador'
  - `scan_source` = 'gate' OR 'mobile' OR 'admin'
  - `scan_result` = 'valid' OR 'invalid' OR 'expired' OR 'wrong_event'
  - `scanned_at` = NOW()
  - `scan_location` = provided location
  - `device_info` = provided device info
  - `ip_address` = request IP

### Step 8: Response
- **Return:** Full ticket context including:
  - Ticket details
  - Order details (source, seller, buyer)
  - Pass type
  - Event details
  - Scan history

---

## 🎯 WHAT CAN BE ANSWERED WITH CORRECT STRUCTURE

### ✅ All Questions Answerable

| Question | How It's Answered |
|----------|-------------------|
| **Which ticket is this?** | `ticket_scans.ticket_id` → `tickets.id` |
| **Which event?** | `ticket_scans.event_id` → `events.id` |
| **Which pass type?** | `ticket_scans.order_pass_id` → `order_passes.pass_type` |
| **Who bought it?** | `ticket_scans.order_id` → `orders.user_name`, `user_phone`, `user_email` |
| **Who sold it?** | `ticket_scans.order_id` → `orders.ambassador_id` → `ambassadors.full_name` |
| **Sold via which source?** | `ticket_scans.order_id` → `orders.source` |
| **Is it already scanned?** | `SELECT * FROM ticket_scans WHERE ticket_id = ? AND scan_result = 'valid'` |
| **When was it scanned?** | `ticket_scans.scanned_at` |
| **Where was it scanned?** | `ticket_scans.scan_location` |
| **By whom was it scanned?** | `ticket_scans.scanner_id` + `scanner_type` |
| **What device scanned it?** | `ticket_scans.device_info` |
| **What IP scanned it?** | `ticket_scans.ip_address` |

### ✅ Audit Trail Complete

- **Who scanned:** `scanner_id` + `scanner_type`
- **When scanned:** `scanned_at`
- **Where scanned:** `scan_location` + `ip_address`
- **How scanned:** `scan_source` (gate/mobile/admin)
- **Result:** `scan_result` (valid/invalid/expired/etc.)
- **Full context:** All foreign keys provide complete traceability

---

## 🔗 HOW "SOLD BY WHICH SOURCE" IS RESOLVED

### No New Fields Required

**Source Resolution Path:**
```
ticket_scans.order_id
  ↓
orders.source  ← 'platform_cod' | 'platform_online' | 'ambassador_manual'
orders.ambassador_id  ← WHO SOLD IT (if not NULL)
orders.payment_method  ← 'online' | 'cod' | 'external_app' | 'ambassador_cash'
```

**Already Perfect:**
- ✅ `orders.source` already exists
- ✅ `orders.ambassador_id` already exists
- ✅ `orders.payment_method` already exists
- ✅ Normalized structure (no duplication)
- ✅ Scalable (works for all future sources)

**No Need For:**
- ❌ `sold_by_source` field in `ticket_scans` (redundant)
- ❌ `seller_id` field in `ticket_scans` (available via `orders.ambassador_id`)
- ❌ `payment_method` field in `ticket_scans` (available via `orders.payment_method`)

---

## 📋 SINGLE SOURCE OF TRUTH MAPPING

| Data Point | Source Table | Field | Notes |
|------------|--------------|-------|-------|
| **QR Identity** | `tickets` | `secure_token` | Single UUID v4 per ticket |
| **Ticket** | `tickets` | `id` | Primary ticket record |
| **Order** | `orders` | `id` | Parent order |
| **Seller** | `orders` | `ambassador_id` | Who sold (nullable for online) |
| **Source** | `orders` | `source` | Sales channel |
| **Buyer** | `orders` | `user_name`, `user_phone`, `user_email` | Customer info |
| **Pass** | `order_passes` | `id`, `pass_type` | Pass type details |
| **Event** | `events` | `id`, `name`, `date`, `venue` | Event context |
| **Scan History** | `ticket_scans` | All fields | Complete scan audit trail |

**Anything else is technical debt.**

---

## ✅ FINAL VERDICT

### Is the System Scan-Ready Long Term?

**Answer: ❌ NO**

### Current State

**✅ Ticket Generation:** Perfect
- Uses `tickets` table correctly
- `secure_token` is proper UUID v4
- QR codes generated and stored correctly
- All relationships properly established

**❌ Scan Validation:** Misaligned
- Queries wrong table (`pass_purchases` instead of `tickets`)
- Cannot directly access order context
- Cannot track admin scans
- Missing critical fields for audit trail
- Cannot answer "sold by which source" without complex joins

### Required Changes (Conceptual Only - No Code)

1. **Create `ticket_scans` table** aligned with `tickets` table
2. **Update scan endpoint** to query `tickets` by `secure_token`
3. **Add foreign keys** to `order_id`, `order_pass_id` for direct access
4. **Add scanner tracking** (`scanner_id`, `scanner_type`, `scan_source`)
5. **Add security fields** (`ip_address`)
6. **Add unique constraint** to prevent double valid scans
7. **Migrate existing scans** from `scans` to `ticket_scans` (if any exist)

### Long-Term Readiness

**After Alignment: ✅ YES**

- ✅ Direct QR code lookup via `secure_token`
- ✅ Complete order context via `order_id`
- ✅ Full seller traceability via `orders.ambassador_id`
- ✅ Source identification via `orders.source`
- ✅ Pass type identification via `order_pass_id`
- ✅ Complete audit trail
- ✅ Fraud detection capability
- ✅ Admin/ambassador scan distinction
- ✅ No email dependency
- ✅ Future-proof structure

---

## 🎯 SUMMARY

**Current Problem:**
- Generation uses `tickets` table ✅
- Scanning uses `pass_purchases` table ❌
- **Mismatch = Cannot scan new tickets**

**Solution:**
- Align scan table with generation table
- Use `ticket_scans` referencing `tickets.id`
- Preserve all existing data via foreign keys
- Enable complete traceability

**Result:**
- ✅ Scannable
- ✅ Traceable to seller
- ✅ Traceable to source
- ✅ All details available
- ✅ Future-proof

---

**END OF ANALYSIS**
