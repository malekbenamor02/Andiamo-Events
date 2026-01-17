# Official Invitations - Database Structure

## Overview
Official invitations will be stored in a **separate table** (`official_invitations`), NOT in the `orders` table. However, each QR code will still be stored in the `qr_tickets` table so they can be scanned using the existing scanning system.

---

## 1. New Table: `official_invitations`

**Purpose:** Stores invitation orders/groups (one row per invitation order)

```sql
CREATE TABLE public.official_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Recipient Information
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_email TEXT, -- Optional (for email delivery)
  
  -- Event Association
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  
  -- Pass Type Information
  pass_type TEXT NOT NULL, -- Pass type name (e.g., 'VIP', 'Standard')
  pass_type_id UUID REFERENCES public.event_passes(id) ON DELETE SET NULL, -- Link to event_passes
  
  -- Invitation Details
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0), -- Number of QR codes
  invitation_number TEXT UNIQUE NOT NULL, -- Sequential invitation number (e.g., INV-0001, INV-0002)
  
  -- Zone Information (from pass type)
  zone_name TEXT, -- Zone name from pass type
  zone_description TEXT, -- Zone description from pass type
  
  -- Status & Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  email_delivery_status TEXT CHECK (email_delivery_status IN ('pending', 'sent', 'failed', 'pending_retry')),
  
  -- Metadata
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL, -- Super admin who created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Optional: Custom message from admin
  custom_message TEXT
);

-- Indexes
CREATE INDEX idx_official_invitations_event ON public.official_invitations(event_id);
CREATE INDEX idx_official_invitations_invitation_number ON public.official_invitations(invitation_number);
CREATE INDEX idx_official_invitations_status ON public.official_invitations(status);
CREATE INDEX idx_official_invitations_created_by ON public.official_invitations(created_by);
CREATE INDEX idx_official_invitations_created_at ON public.official_invitations(created_at DESC);
CREATE INDEX idx_official_invitations_recipient_phone ON public.official_invitations(recipient_phone);
```

---

## 2. Modify `qr_tickets` Table

**Purpose:** Add link to invitations so QR codes can be associated with invitations

**Option A: Add `invitation_id` column (Recommended)**
```sql
-- Add invitation_id column to qr_tickets
ALTER TABLE public.qr_tickets 
  ADD COLUMN IF NOT EXISTS invitation_id UUID REFERENCES public.official_invitations(id) ON DELETE CASCADE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_qr_tickets_invitation_id ON public.qr_tickets(invitation_id) WHERE invitation_id IS NOT NULL;
```

**Why this approach:**
- QR codes are already in `qr_tickets` table (for scanning)
- Adding `invitation_id` links them back to the invitation
- Existing scanning system works without changes
- Can query all QR codes for an invitation easily

---

## 3. Invitation Number Generation

**Option A: Sequential with prefix (INV-0001, INV-0002, ...)**
```sql
-- Create sequence for invitation numbers
CREATE SEQUENCE IF NOT EXISTS invitation_number_seq START 1;

-- Function to generate invitation number
CREATE OR REPLACE FUNCTION generate_invitation_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'INV-' || LPAD(nextval('invitation_number_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Set default value
ALTER TABLE public.official_invitations 
  ALTER COLUMN invitation_number 
  SET DEFAULT generate_invitation_number();
```

**Option B: Random 6-digit number (like orders)**
```sql
-- Use same function as order_number but with INV prefix
CREATE OR REPLACE FUNCTION generate_invitation_number()
RETURNS TEXT AS $$
DECLARE
  new_number INTEGER;
  exists_check INTEGER;
  max_attempts INTEGER := 100;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- Generate random 6-digit number (100000 to 999999)
    new_number := floor(random() * 900000 + 100000)::INTEGER;
    
    -- Check if this number already exists
    SELECT COUNT(*) INTO exists_check
    FROM public.official_invitations
    WHERE invitation_number = 'INV-' || new_number::TEXT;
    
    -- If number doesn't exist, return it
    IF exists_check = 0 THEN
      RETURN 'INV-' || new_number::TEXT;
    END IF;
    
    -- Prevent infinite loop
    attempts := attempts + 1;
    IF attempts >= max_attempts THEN
      new_number := (EXTRACT(EPOCH FROM NOW())::BIGINT % 900000 + 100000)::INTEGER;
      RETURN 'INV-' || new_number::TEXT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

**Recommendation:** Use Option A (sequential) for easier tracking, or Option B (random) for consistency with order numbers.

---

## 4. RLS Policies

```sql
-- Enable RLS
ALTER TABLE public.official_invitations ENABLE ROW LEVEL SECURITY;

-- Only super admins can view all invitations
CREATE POLICY "Super admins can view all invitations"
  ON public.official_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );

-- Only super admins can create invitations
CREATE POLICY "Super admins can create invitations"
  ON public.official_invitations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );

-- Only super admins can update invitations
CREATE POLICY "Super admins can update invitations"
  ON public.official_invitations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );

-- Only super admins can delete invitations
CREATE POLICY "Super admins can delete invitations"
  ON public.official_invitations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );
```

---

## 5. Data Flow

### Creating an Invitation:

1. **Create invitation record** in `official_invitations`:
   - recipient_name, recipient_phone, event_id, pass_type, quantity
   - invitation_number auto-generated
   - status = 'pending'

2. **Generate QR codes** (quantity times):
   - For each QR code (1 to quantity):
     - Generate unique `secure_token` (UUID v4)
     - Create entry in `qr_tickets` table:
       - `secure_token`: unique token
       - `invitation_id`: link to invitation
       - `event_id`: from invitation
       - `buyer_name`: recipient_name
       - `buyer_phone`: recipient_phone
       - `pass_type`: from invitation
       - `ticket_status`: 'VALID'
       - `source`: 'official_invitation' (need to add this to CHECK constraint)
       - All other event/pass details
     - Generate QR code image
     - Upload to Supabase Storage
     - Update `qr_code_url` in `qr_tickets`

3. **Send email** with all QR codes

4. **Update invitation**:
   - status = 'sent'
   - sent_at = NOW()
   - email_delivery_status = 'sent'

### Scanning QR Codes:

- QR codes are in `qr_tickets` table (same as regular tickets)
- Existing scanner queries `qr_tickets` by `secure_token`
- Status checking works the same: VALID, USED, INVALID, etc.
- **No changes needed to scanning system!**

---

## 6. What We Need to Add/Modify

### Database Changes:

1. ✅ **Create `official_invitations` table** (new table)
2. ✅ **Add `invitation_id` column** to `qr_tickets` table
3. ✅ **Add `'official_invitation'` to `qr_tickets.source` CHECK constraint**
4. ✅ **Create invitation number sequence/function**
5. ✅ **Add RLS policies** for `official_invitations` table
6. ✅ **Create indexes** for performance

### No Changes Needed:

- ❌ **No changes to `orders` table** (invitations are separate)
- ❌ **No changes to scanning system** (uses existing `qr_tickets` table)
- ❌ **No changes to `tickets` table** (we use `qr_tickets` directly)

---

## 7. Summary

**What We're Adding:**

1. **New Table:** `official_invitations`
   - Stores invitation orders (one row per invitation)
   - Contains recipient info, event, pass type, quantity
   - Has invitation_number (INV-0001 format)

2. **Modify:** `qr_tickets` table
   - Add `invitation_id` column (optional, nullable)
   - Add `'official_invitation'` to source CHECK constraint
   - Each QR code links back to its invitation

3. **QR Codes:**
   - Each invitation can have multiple QR codes (based on quantity)
   - All QR codes stored in `qr_tickets` table
   - Each QR code has `invitation_id` linking to invitation
   - QR codes are scannable using existing scanner

**Benefits:**
- ✅ Invitations separate from orders (clean separation)
- ✅ QR codes work with existing scanner (no changes needed)
- ✅ Can track all QR codes per invitation
- ✅ Can query invitation by invitation_number
- ✅ Can query all QR codes for an invitation
