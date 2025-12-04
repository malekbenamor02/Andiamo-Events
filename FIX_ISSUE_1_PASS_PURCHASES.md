# 🔧 FIX ISSUE #1: Missing `pass_purchases` Table

## Issue Summary
- **Problem:** Code references `pass_purchases` table that doesn't exist
- **Impact:** Ticket validation endpoint broken, scans cannot be created
- **Solution:** Update code to use `tickets` table with proper joins

---

## 1. SQL Migration

**File:** `supabase/migrations/20250202000000-fix-pass-purchases-to-tickets.sql`

```sql
-- ============================================
-- Fix Issue #1: Replace pass_purchases with tickets table
-- ============================================

-- Step 1: Drop invalid foreign key constraint on scans table
-- (if it exists, it references non-existent pass_purchases table)
DO $$ 
DECLARE
  constraint_name TEXT;
BEGIN
  -- Find the constraint name
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_schema = kcu.constraint_schema
    AND tc.constraint_name = kcu.constraint_name
  WHERE tc.constraint_schema = 'public' 
    AND tc.table_name = 'scans'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'ticket_id'
    AND kcu.referenced_table_name = 'pass_purchases';
  
  -- Drop it if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.scans DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Dropped invalid foreign key constraint: %', constraint_name;
  END IF;
END $$;

-- Step 2: Ensure scans.ticket_id references tickets table
-- Check if constraint already exists with correct reference
DO $$ 
BEGIN
  -- Check if correct constraint exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_schema = kcu.constraint_schema
      AND tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_schema = tc.constraint_schema
      AND ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_schema = 'public' 
      AND tc.table_name = 'scans'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'ticket_id'
      AND ccu.table_name = 'tickets'
  ) THEN
    -- Add correct foreign key constraint
    ALTER TABLE public.scans 
      ADD CONSTRAINT scans_ticket_id_fkey 
      FOREIGN KEY (ticket_id) 
      REFERENCES public.tickets(id) 
      ON DELETE CASCADE;
    
    RAISE NOTICE 'Added foreign key constraint: scans.ticket_id -> tickets.id';
  ELSE
    RAISE NOTICE 'Foreign key constraint already exists correctly';
  END IF;
END $$;

-- Step 3: Drop pass_purchases table if it exists (legacy table)
-- WARNING: Only drop if table is empty or you're sure it's not needed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'pass_purchases'
  ) THEN
    -- Check if table has data
    IF EXISTS (SELECT 1 FROM public.pass_purchases LIMIT 1) THEN
      RAISE WARNING 'pass_purchases table exists with data - NOT DROPPING. Please migrate data manually.';
    ELSE
      DROP TABLE IF EXISTS public.pass_purchases CASCADE;
      RAISE NOTICE 'Dropped empty pass_purchases table';
    END IF;
  ELSE
    RAISE NOTICE 'pass_purchases table does not exist - nothing to drop';
  END IF;
END $$;

-- Step 4: Verify scans table structure
-- Ensure ticket_id column exists and is correct type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'scans' 
    AND column_name = 'ticket_id'
  ) THEN
    ALTER TABLE public.scans ADD COLUMN ticket_id UUID;
    RAISE NOTICE 'Added ticket_id column to scans table';
  END IF;
END $$;

-- Step 5: Add index for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_scans_ticket_id ON public.scans(ticket_id);

-- Step 6: Add comment for documentation
COMMENT ON COLUMN public.scans.ticket_id IS 'References tickets.id (not pass_purchases). Updated in migration 20250202000000.';

```

---

## 2. Backend Code Changes

**File:** `server.cjs` (lines 1023-1172)

### Current Code (BROKEN):
```javascript
app.post('/api/validate-ticket', async (req, res) => {
  try {
    const { qrCode, eventId, ambassadorId, deviceInfo, scanLocation } = req.body;

    if (!qrCode || !eventId || !ambassadorId) {
      return res.status(400).json({ 
        error: 'Missing required fields: qrCode, eventId, ambassadorId' 
      });
    }

    // Find the ticket by QR code
    const { data: ticket, error: ticketError } = await supabase
      .from('pass_purchases')  // ❌ TABLE DOESN'T EXIST
      .select(`
        *,
        events (
          id,
          name,
          date,
          venue,
          city
        )
      `)
      .eq('qr_code', qrCode)  // ❌ WRONG COLUMN NAME
      .single();

    // ... rest of code uses ticket.customer_name, ticket.pass_type, ticket.event_id
```

### Fixed Code:
```javascript
app.post('/api/validate-ticket', async (req, res) => {
  try {
    const { qrCode, eventId, ambassadorId, deviceInfo, scanLocation } = req.body;

    if (!qrCode || !eventId || !ambassadorId) {
      return res.status(400).json({ 
        error: 'Missing required fields: qrCode, eventId, ambassadorId' 
      });
    }

    // Find the ticket by secure_token (QR code contains secure_token)
    // Join through order_passes -> orders -> events to get all needed data
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        order_passes (
          pass_type,
          quantity,
          price,
          orders (
            id,
            user_name,
            user_email,
            event_id,
            events (
              id,
              name,
              date,
              venue,
              city
            )
          )
        )
      `)
      .eq('secure_token', qrCode)  // ✅ QR code contains secure_token
      .single();

    if (ticketError || !ticket) {
      return res.status(404).json({
        success: false,
        result: 'invalid',
        message: 'Ticket not found'
      });
    }

    // Extract nested data from joined tables
    const order = ticket.order_passes?.[0]?.orders;
    const event = order?.events;
    const passType = ticket.order_passes?.[0]?.pass_type;

    if (!order || !event) {
      return res.status(404).json({
        success: false,
        result: 'invalid',
        message: 'Ticket data incomplete'
      });
    }

    // Check if ticket is for the correct event
    if (order.event_id !== eventId) {
      return res.status(400).json({
        success: false,
        result: 'invalid',
        message: 'Ticket is not valid for this event'
      });
    }

    // Check if ticket is already scanned
    const { data: existingScan, error: scanError } = await supabase
      .from('scans')
      .select('*')
      .eq('ticket_id', ticket.id)
      .eq('scan_result', 'valid')
      .single();

    if (existingScan) {
      // Record the duplicate scan attempt
      await supabase.from('scans').insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'already_scanned',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Duplicate scan attempt'
      });

      return res.status(200).json({
        success: false,
        result: 'already_scanned',
        message: 'Ticket already scanned',
        ticket: {
          id: ticket.id,
          customer_name: order.user_name,  // ✅ Fixed: from orders.user_name
          event_name: event.name,
          ticket_type: passType,  // ✅ Fixed: from order_passes.pass_type
          scan_time: existingScan.scan_time
        }
      });
    }

    // Check if event date has passed
    const eventDate = new Date(event.date);
    const now = new Date();
    
    if (eventDate < now) {
      // Record the expired scan attempt
      await supabase.from('scans').insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'expired',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Event date has passed'
      });

      return res.status(200).json({
        success: false,
        result: 'expired',
        message: 'Event date has passed',
        ticket: {
          id: ticket.id,
          customer_name: order.user_name,  // ✅ Fixed
          event_name: event.name,
          ticket_type: passType  // ✅ Fixed
        }
      });
    }

    // Record the valid scan
    const { data: scanRecord, error: recordError } = await supabase
      .from('scans')
      .insert({
        ticket_id: ticket.id,
        event_id: eventId,
        ambassador_id: ambassadorId,
        scan_result: 'valid',
        device_info: deviceInfo,
        scan_location: scanLocation,
        notes: 'Valid ticket scan'
      })
      .select()
      .single();

    if (recordError) {
      console.error('Error recording scan:', recordError);
      return res.status(500).json({
        success: false,
        result: 'error',
        message: 'Failed to record scan'
      });
    }

    return res.status(200).json({
      success: true,
      result: 'valid',
      message: 'Ticket validated successfully',
      ticket: {
        id: ticket.id,
        customer_name: order.user_name,  // ✅ Fixed
        event_name: event.name,
        ticket_type: passType,  // ✅ Fixed
        scan_time: scanRecord.scan_time
      }
    });

  } catch (error) {
    console.error('Ticket validation error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
});
```

### Key Changes:
1. ✅ Changed `.from('pass_purchases')` → `.from('tickets')`
2. ✅ Changed `.eq('qr_code', qrCode)` → `.eq('secure_token', qrCode)`
3. ✅ Added proper joins: `tickets` → `order_passes` → `orders` → `events`
4. ✅ Updated field references:
   - `ticket.customer_name` → `order.user_name`
   - `ticket.pass_type` → `passType` (from `order_passes.pass_type`)
   - `ticket.event_id` → `order.event_id`
   - `ticket.events` → `event` (from joined data)

---

## 3. Frontend Code Changes

**Status:** ✅ **NO CHANGES REQUIRED**

The frontend doesn't directly query the `pass_purchases` table. The ticket validation endpoint is backend-only and called by ambassadors via the mobile app/scanning interface.

**Note:** If there are any frontend components that display ticket validation results, they should continue to work as the API response structure remains the same (same field names in response JSON).

---

## 4. TypeScript Types/Interfaces

### Current Types (No Changes Needed):
The existing `Ticket` interface in `src/lib/ticketGenerationService.tsx` is already correct:

```typescript
interface Ticket {
  id: string;
  order_id: string;
  order_pass_id: string;
  secure_token: string;  // ✅ Already correct
  qr_code_url: string | null;
  status: 'PENDING' | 'GENERATED' | 'DELIVERED' | 'FAILED';
  email_delivery_status: 'pending' | 'sent' | 'failed' | 'pending_retry' | null;
}
```

### Optional: Add Response Type for Ticket Validation
**File:** `src/types/ticket.ts` (NEW FILE - Optional)

```typescript
// Optional: Add this if you want type safety for ticket validation responses
export interface TicketValidationResponse {
  success: boolean;
  result: 'valid' | 'invalid' | 'already_scanned' | 'expired' | 'error';
  message: string;
  ticket?: {
    id: string;
    customer_name: string;
    event_name: string;
    ticket_type: string;
    scan_time?: string;
  };
}
```

**Note:** This is optional - the backend response structure doesn't change, so existing code will continue to work.

---

## 5. Data Impact Analysis

### Existing Data:
- ✅ **No data loss risk** - `pass_purchases` table doesn't exist, so no data to migrate
- ✅ **Scans table** - May have existing `ticket_id` values that reference non-existent table
  - **Impact:** These scans are already broken (FK constraint failed)
  - **Fix:** After migration, scans will reference `tickets` table correctly
  - **Action:** Existing broken scans will remain broken, but new scans will work

### Migration Safety:
- ✅ **Safe to run** - Only fixes foreign key constraint
- ✅ **No data modification** - Only schema changes
- ✅ **Backward compatible** - New code works with existing `tickets` table structure

### Rollback Plan:
If migration fails:
```sql
-- Rollback: Revert foreign key (if needed)
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_ticket_id_fkey;
```

---

## 6. Testing Checklist

After applying fix:
- [ ] Migration runs successfully
- [ ] Foreign key constraint created correctly
- [ ] Ticket validation endpoint works
- [ ] QR code scanning works (secure_token lookup)
- [ ] Scan records can be created
- [ ] Duplicate scan detection works
- [ ] Expired ticket detection works
- [ ] Response includes correct customer_name, event_name, ticket_type

---

## 7. Summary

### What Changes:
- ✅ Database: Fix `scans.ticket_id` foreign key to reference `tickets` table
- ✅ Backend: Update ticket validation endpoint to use `tickets` table with proper joins
- ✅ Frontend: No changes needed
- ✅ Types: No changes needed (optional type added)

### What Doesn't Change:
- ✅ API response structure (same field names)
- ✅ Frontend components (no changes needed)
- ✅ Existing data (no migration needed)

### Risk Level:
- 🟢 **LOW RISK** - Only fixes broken functionality, no data loss

---

**READY FOR APPROVAL**

Please review and approve before I apply these changes.

