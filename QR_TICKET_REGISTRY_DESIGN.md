# QR Ticket Registry Design

**Date:** 2025-01-02  
**Type:** Structure Design - NO CODE CHANGES  
**Purpose:** Design denormalized QR Ticket Registry for external scanner access

---

## ✅ CONFIRMATION: QR GENERATION IS COMPATIBLE

### Current QR Generation Status

**✅ QR Identity:**
- `tickets.secure_token` (UUID v4) - Perfect
- Generated at: `server.cjs:7149` - `const secureToken = uuidv4();`
- Encoded in QR: `server.cjs:7152` - `QRCode.toBuffer(secureToken, ...)`
- Stored & Indexed: `tickets.secure_token` (TEXT, UNIQUE)

**✅ All Required Data Available at Generation Time:**

At ticket generation (`generateTicketsAndSendEmail()` - `server.cjs:6888`), the system has access to:

1. **Order Data** (via `orderId`):
   - `orders.source` - Sales channel
   - `orders.payment_method` - Payment type
   - `orders.ambassador_id` - Seller (nullable)
   - `orders.user_name` - Buyer name
   - `orders.user_phone` - Buyer phone
   - `orders.user_email` - Buyer email
   - `orders.event_id` - Event reference

2. **Event Data** (via `orders.event_id`):
   - `events.id` - Event ID
   - `events.name` - Event name
   - `events.date` - Event date
   - `events.venue` - Event venue
   - `events.city` - Event city

3. **Pass Data** (via `orderPasses`):
   - `order_passes.id` - Pass ID
   - `order_passes.pass_type` - Pass type (VIP/Standard/etc.)
   - `order_passes.price` - Pass price

4. **Ambassador Data** (via `orders.ambassador_id`):
   - `ambassadors.id` - Ambassador ID
   - `ambassadors.full_name` - Ambassador name
   - `ambassadors.phone` - Ambassador phone

5. **Ticket Data** (generated):
   - `tickets.id` - Ticket ID
   - `tickets.secure_token` - QR token
   - `tickets.qr_code_url` - QR image URL
   - `tickets.status` - Ticket status
   - `tickets.generated_at` - Generation timestamp

**Verdict:** ✅ **100% Compatible** - All required data is available at ticket generation time.

---

## 🎯 QR TICKET REGISTRY STRUCTURE

### Table Name: `qr_tickets` (or `ticket_qr_registry`)

**Purpose:** Denormalized read-only registry containing all ticket context for external scanner queries.

**Key Design Principles:**
- ✅ Keyed by `secure_token` (the QR payload)
- ✅ Contains all context in one place (no joins required)
- ✅ Populated at ticket generation time
- ✅ Read-only for external scanners
- ✅ Append-only or regenerated (not mutable by scanners)

### Complete Structure

```sql
CREATE TABLE qr_tickets (
  -- Primary Key & QR Identity
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  secure_token TEXT NOT NULL UNIQUE,  -- QR payload (UUID v4)
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  
  -- Order & Sale Context
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('platform_online', 'platform_cod', 'ambassador_manual')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('online', 'cod', 'external_app', 'ambassador_cash')),
  
  -- Seller Information
  ambassador_id UUID REFERENCES ambassadors(id) ON DELETE SET NULL,
  ambassador_name TEXT,  -- Denormalized for quick access
  ambassador_phone TEXT,  -- Denormalized for quick access
  
  -- Buyer Information
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_email TEXT,
  buyer_city TEXT NOT NULL,
  buyer_ville TEXT,  -- Neighborhood (if applicable)
  
  -- Event Information
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  event_name TEXT,
  event_date TIMESTAMP WITH TIME ZONE,
  event_venue TEXT,
  event_city TEXT,
  
  -- Pass Information
  order_pass_id UUID NOT NULL REFERENCES order_passes(id) ON DELETE CASCADE,
  pass_type TEXT NOT NULL,  -- e.g., 'VIP', 'Standard', 'Premium'
  pass_price NUMERIC(10, 2) NOT NULL,  -- Unit price for this pass
  
  -- Ticket State
  ticket_status TEXT NOT NULL CHECK (ticket_status IN ('PENDING', 'GENERATED', 'DELIVERED', 'FAILED', 'CANCELLED')),
  
  -- QR Code Metadata
  qr_code_url TEXT,  -- Public URL to QR code image
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign Key Constraints
  CONSTRAINT qr_tickets_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT qr_tickets_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT qr_tickets_order_pass_id_fkey FOREIGN KEY (order_pass_id) REFERENCES order_passes(id) ON DELETE CASCADE
);
```

### Indexes (Performance)

```sql
-- Primary lookup: QR code by secure_token (MOST IMPORTANT)
CREATE UNIQUE INDEX idx_qr_tickets_secure_token ON qr_tickets(secure_token);

-- Fast ticket lookup
CREATE INDEX idx_qr_tickets_ticket_id ON qr_tickets(ticket_id);

-- Fast order lookup
CREATE INDEX idx_qr_tickets_order_id ON qr_tickets(order_id);

-- Fast event lookup
CREATE INDEX idx_qr_tickets_event_id ON qr_tickets(event_id) WHERE event_id IS NOT NULL;

-- Fast seller lookup
CREATE INDEX idx_qr_tickets_ambassador_id ON qr_tickets(ambassador_id) WHERE ambassador_id IS NOT NULL;

-- Fast status filtering
CREATE INDEX idx_qr_tickets_status ON qr_tickets(ticket_status);

-- Fast event date filtering
CREATE INDEX idx_qr_tickets_event_date ON qr_tickets(event_date) WHERE event_date IS NOT NULL;
```

---

## 📊 DATA MAPPING: SOURCE TABLES → REGISTRY

### Field Mapping

| Registry Field | Source Table | Source Field | Notes |
|----------------|--------------|--------------|-------|
| `secure_token` | `tickets` | `secure_token` | Direct copy |
| `ticket_id` | `tickets` | `id` | Foreign key |
| `order_id` | `tickets` | `order_id` | Via ticket |
| `source` | `orders` | `source` | Denormalized |
| `payment_method` | `orders` | `payment_method` | Denormalized |
| `ambassador_id` | `orders` | `ambassador_id` | Denormalized |
| `ambassador_name` | `ambassadors` | `full_name` | Denormalized (via join) |
| `ambassador_phone` | `ambassadors` | `phone` | Denormalized (via join) |
| `buyer_name` | `orders` | `user_name` | Denormalized |
| `buyer_phone` | `orders` | `user_phone` | Denormalized |
| `buyer_email` | `orders` | `user_email` | Denormalized |
| `buyer_city` | `orders` | `city` | Denormalized |
| `buyer_ville` | `orders` | `ville` | Denormalized |
| `event_id` | `orders` | `event_id` | Via order |
| `event_name` | `events` | `name` | Denormalized (via join) |
| `event_date` | `events` | `date` | Denormalized (via join) |
| `event_venue` | `events` | `venue` | Denormalized (via join) |
| `event_city` | `events` | `city` | Denormalized (via join) |
| `order_pass_id` | `tickets` | `order_pass_id` | Via ticket |
| `pass_type` | `order_passes` | `pass_type` | Denormalized (via join) |
| `pass_price` | `order_passes` | `price` | Denormalized (via join) |
| `ticket_status` | `tickets` | `status` | Direct copy |
| `qr_code_url` | `tickets` | `qr_code_url` | Direct copy |
| `generated_at` | `tickets` | `generated_at` | Direct copy |

---

## 🔄 POPULATION STRATEGY

### When to Populate

**Option 1: At Ticket Generation (Recommended)**
- Populate registry immediately after ticket creation
- Location: `generateTicketsAndSendEmail()` - `server.cjs:7198` (after ticket insert)
- Pros: Always in sync, no delay
- Cons: Slight overhead at generation time

**Option 2: Materialized View**
- Create PostgreSQL materialized view
- Refresh on schedule or trigger
- Pros: Automatic, no code changes
- Cons: May have slight delay, requires refresh logic

**Option 3: Trigger-Based**
- PostgreSQL trigger on `tickets` insert/update
- Automatically populates registry
- Pros: Automatic, always in sync
- Cons: Trigger complexity, potential performance impact

### Recommended: At Generation Time

**Location in Code:**
- `server.cjs:7198` - After `tickets.insert()` succeeds
- `api/misc.js:1526` - After `tickets.insert()` succeeds
- `api/admin-approve-order.js:492` - After `tickets.insert()` succeeds
- `src/lib/ticketGenerationService.tsx:246` - After ticket update with QR URL

**Data Available at This Point:**
- ✅ `ticketData` - Just inserted ticket
- ✅ `order` - Order data (already fetched)
- ✅ `orderPasses` - Pass data (already fetched)
- ✅ `order.events` - Event data (if joined)
- ✅ `order.ambassadors` - Ambassador data (if joined)

**Population Logic (Conceptual):**

```javascript
// After ticket insert succeeds (ticketData available)
// After order fetch (order available)
// After orderPasses fetch (orderPasses available)

const pass = orderPasses.find(p => p.id === ticketData.order_pass_id);
const ambassador = order.ambassadors || null;
const event = order.events || null;

const registryEntry = {
  secure_token: ticketData.secure_token,
  ticket_id: ticketData.id,
  order_id: order.id,
  source: order.source,
  payment_method: order.payment_method,
  ambassador_id: order.ambassador_id,
  ambassador_name: ambassador?.full_name || null,
  ambassador_phone: ambassador?.phone || null,
  buyer_name: order.user_name,
  buyer_phone: order.user_phone,
  buyer_email: order.user_email,
  buyer_city: order.city,
  buyer_ville: order.ville || null,
  event_id: order.event_id,
  event_name: event?.name || null,
  event_date: event?.date || null,
  event_venue: event?.venue || null,
  event_city: event?.city || null,
  order_pass_id: pass.id,
  pass_type: pass.pass_type,
  pass_price: pass.price,
  ticket_status: ticketData.status,
  qr_code_url: ticketData.qr_code_url,
  generated_at: ticketData.generated_at
};

await dbClient.from('qr_tickets').insert(registryEntry);
```

---

## 🔍 EXTERNAL SCANNER USAGE

### Scanner Query Pattern

**Single Lookup by QR Code:**

```sql
SELECT * FROM qr_tickets WHERE secure_token = '<scanned_qr_value>';
```

**Result Contains Everything:**

```json
{
  "secure_token": "550e8400-e29b-41d4-a716-446655440000",
  "ticket_id": "123e4567-e89b-12d3-a456-426614174000",
  "order_id": "789e0123-e45b-67c8-d901-234567890abc",
  
  "source": "platform_online",
  "payment_method": "online",
  
  "ambassador_id": null,
  "ambassador_name": null,
  "ambassador_phone": null,
  
  "buyer_name": "John Doe",
  "buyer_phone": "27123456",
  "buyer_email": "john@example.com",
  "buyer_city": "Tunis",
  "buyer_ville": null,
  
  "event_id": "def45678-e90a-b12c-d345-678901234efg",
  "event_name": "Summer Festival 2025",
  "event_date": "2025-07-15T20:00:00Z",
  "event_venue": "Olympic Stadium",
  "event_city": "Tunis",
  
  "order_pass_id": "ghi78901-f23a-45b6-c789-012345678hij",
  "pass_type": "VIP",
  "pass_price": 150.00,
  
  "ticket_status": "DELIVERED",
  "qr_code_url": "https://...",
  "generated_at": "2025-01-02T10:30:00Z"
}
```

### What Scanner Can Answer Instantly

✅ **Is ticket real?** - Record exists  
✅ **Which event?** - `event_name`, `event_date`, `event_venue`  
✅ **Which pass type?** - `pass_type`  
✅ **Who bought it?** - `buyer_name`, `buyer_phone`, `buyer_email`  
✅ **Who sold it?** - `ambassador_name`, `ambassador_phone` (if not NULL)  
✅ **From which source?** - `source` ('platform_online' | 'platform_cod' | 'ambassador_manual')  
✅ **Payment method?** - `payment_method`  
✅ **Is ticket valid?** - `ticket_status` ('GENERATED' | 'DELIVERED' = valid)  
✅ **When generated?** - `generated_at`  
✅ **QR image URL?** - `qr_code_url`  

**No joins required. No legacy tables. No ambiguity.**

---

## 🔐 SECURITY & ACCESS CONTROL

### Read-Only Access for External Scanners

**Option 1: Database Role**
```sql
-- Create read-only role
CREATE ROLE qr_scanner_role;

-- Grant SELECT only
GRANT SELECT ON qr_tickets TO qr_scanner_role;

-- External scanner uses this role
```

**Option 2: API Endpoint**
```javascript
// GET /api/qr-tickets/:secureToken
// Returns registry entry for scanner
// No write access
```

**Option 3: Supabase RLS Policy**
```sql
-- Public read access (if secure_token is considered secure enough)
CREATE POLICY "Public can read QR tickets by token" ON qr_tickets
  FOR SELECT USING (true);
```

### Token Security

- ✅ `secure_token` is UUID v4 (unguessable)
- ✅ No sequential patterns
- ✅ No business logic exposed
- ✅ Token is the only required input

---

## 🔄 UPDATE STRATEGY

### When to Update Registry

**Scenario 1: Ticket Status Changes**
- If `tickets.status` changes (e.g., CANCELLED)
- Update `qr_tickets.ticket_status` to match
- Location: After ticket status update

**Scenario 2: Order Updates (Rare)**
- If order data changes (e.g., buyer email correction)
- Update corresponding `qr_tickets` records
- Location: After order update

**Scenario 3: Event Updates**
- If event date/venue changes
- Update all `qr_tickets` for that event
- Location: After event update

**Recommended:**
- Registry is mostly append-only
- Updates only for critical status changes (CANCELLED)
- Event updates are rare and can be batch updated

---

## ✅ COMPATIBILITY CHECKLIST

### Current System Compatibility

| Requirement | Status | Evidence |
|-------------|--------|----------|
| QR token is UUID v4 | ✅ YES | `server.cjs:7149` - `uuidv4()` |
| QR token is stored | ✅ YES | `tickets.secure_token` (UNIQUE, indexed) |
| Order data available | ✅ YES | Fetched at `server.cjs:7050-7074` |
| Event data available | ✅ YES | Joined in order query |
| Pass data available | ✅ YES | Fetched at `server.cjs:7076-7079` |
| Ambassador data available | ✅ YES | Can be joined via `orders.ambassador_id` |
| Buyer data available | ✅ YES | `orders.user_name`, `user_phone`, `user_email` |
| Source data available | ✅ YES | `orders.source` |
| Payment method available | ✅ YES | `orders.payment_method` |
| All data at generation time | ✅ YES | All fetched before ticket creation |

**Verdict:** ✅ **100% Compatible** - No changes needed to generation logic.

---

## 📋 IMPLEMENTATION CHECKLIST (Conceptual)

### Step 1: Create Registry Table
- [ ] Create `qr_tickets` table with all fields
- [ ] Create indexes (especially `secure_token` unique index)
- [ ] Add foreign key constraints

### Step 2: Populate at Generation
- [ ] Add registry insert after ticket creation
- [ ] Include all denormalized data
- [ ] Handle NULL values (ambassador, event)

### Step 3: Access Control
- [ ] Create read-only role or API endpoint
- [ ] Test scanner query by `secure_token`
- [ ] Verify all fields are accessible

### Step 4: Update Logic (Optional)
- [ ] Add update trigger for ticket status changes
- [ ] Add update logic for order/event changes (if needed)

### Step 5: Validation
- [ ] Verify registry entry matches source tables
- [ ] Test scanner query performance
- [ ] Verify no data loss

---

## 🎯 FINAL ANSWER

### Do you need scan logic in your system?
**❌ NO** - External scanner handles scanning logic.

### Do you need a scan table?
**❌ NO** - Not if scan is external. Scanner manages its own scan history.

### What do you need?
**✅ QR Ticket Registry (`qr_tickets`)** containing:
- QR token (`secure_token`)
- Sale source (`source`)
- Seller (`ambassador_id`, `ambassador_name`)
- Buyer (`buyer_name`, `buyer_phone`, `buyer_email`)
- Event (`event_name`, `event_date`, `event_venue`)
- Pass (`pass_type`, `pass_price`)
- Ticket state (`ticket_status`)

### Is your QR generation already compatible?
**✅ YES — 100%**

All required data is:
- ✅ Available at generation time
- ✅ Properly structured
- ✅ Accessible via existing queries
- ✅ Ready for denormalization

**No changes needed to generation logic. Only add registry population.**

---

## 📊 SUMMARY

**Current State:**
- ✅ QR generation: Perfect
- ✅ Data availability: Complete
- ❌ Registry: Not yet created

**Required:**
- ✅ Create `qr_tickets` table
- ✅ Populate at ticket generation
- ✅ Expose read-only access

**Result:**
- ✅ External scanner: One lookup by `secure_token`
- ✅ Complete context: All data in one record
- ✅ No joins: Zero complexity for scanner
- ✅ No legacy tables: Clean architecture
- ✅ Future-proof: Scalable structure

---

**END OF DESIGN**
