# Official Invitations Feature - Analysis & Implementation Plan

## Overview
Add a new "Official Invitations" tab in the admin dashboard (super admin only) that allows sending official event invitations via email with embedded QR codes. The QR codes should be generated, stored, and trackable like regular ticket QR codes.

---

## 1. Database Schema

### 1.1 New Table: `official_invitations`
```sql
CREATE TABLE public.official_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Recipient Information
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_phone TEXT, -- Optional
  
  -- Event Association (Optional - can be general invitation)
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  
  -- QR Code Data
  qr_code_token TEXT NOT NULL UNIQUE, -- Secure token for QR code (like tickets)
  qr_code_url TEXT, -- Public URL to QR code image in storage
  qr_code_data TEXT, -- Optional: Additional data encoded in QR
  
  -- Invitation Details
  invitation_type TEXT DEFAULT 'general' CHECK (invitation_type IN ('general', 'vip', 'press', 'sponsor', 'special')),
  custom_message TEXT, -- Optional custom message from admin
  invitation_number TEXT UNIQUE, -- Sequential invitation number (e.g., INV-0001)
  
  -- Status & Tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'opened', 'scanned')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  scanned_at TIMESTAMP WITH TIME ZONE,
  scan_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL, -- Super admin who created
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT official_invitations_email_check CHECK (recipient_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Indexes
CREATE INDEX idx_official_invitations_email ON public.official_invitations(recipient_email);
CREATE INDEX idx_official_invitations_event ON public.official_invitations(event_id);
CREATE INDEX idx_official_invitations_token ON public.official_invitations(qr_code_token);
CREATE INDEX idx_official_invitations_status ON public.official_invitations(status);
CREATE INDEX idx_official_invitations_created_by ON public.official_invitations(created_by);
CREATE INDEX idx_official_invitations_created_at ON public.official_invitations(created_at DESC);
```

### 1.2 New Table: `invitation_scans` (Optional - for tracking)
```sql
CREATE TABLE public.invitation_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID REFERENCES public.official_invitations(id) ON DELETE CASCADE,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scanned_by TEXT, -- Optional: name of person who scanned
  location TEXT, -- Optional: location where scanned
  device_info JSONB, -- Optional: device/browser info
  notes TEXT
);

CREATE INDEX idx_invitation_scans_invitation ON public.invitation_scans(invitation_id);
CREATE INDEX idx_invitation_scans_scanned_at ON public.invitation_scans(scanned_at DESC);
```

### 1.3 Sequence for Invitation Numbers
```sql
CREATE SEQUENCE IF NOT EXISTS invitation_number_seq START 1;
```

### 1.4 RLS Policies
```sql
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
```

---

## 2. Frontend Components

### 2.1 New Tab in Admin Dashboard
**Location:** `src/pages/admin/Dashboard.tsx`

**Tab Structure:**
- Add new `TabsTrigger` with value `"invitations"` (only visible if `isSuperAdmin === true`)
- Add corresponding `TabsContent` for invitations management

**Tab Features:**
1. **Create Invitation Form:**
   - Recipient Name (required)
   - Recipient Email (required, validated)
   - Recipient Phone (optional)
   - Event Selection (optional dropdown - can be "General Invitation")
   - Invitation Type (dropdown: general, vip, press, sponsor, special)
   - Custom Message (optional textarea)
   - Send Immediately checkbox (or save as draft)

2. **Invitations List:**
   - Table showing all sent invitations
   - Columns: Name, Email, Event, Type, Status, Sent Date, Scan Count, Actions
   - Filters: Status, Event, Type, Date Range
   - Search: By name or email
   - Actions: View Details, Resend, Delete, View QR Code

3. **Statistics Card:**
   - Total Invitations Sent
   - Opened Count
   - Scanned Count
   - Pending Count

### 2.2 Components to Create
- `InvitationForm.tsx` - Form for creating new invitations
- `InvitationsList.tsx` - Table/list of invitations
- `InvitationDetails.tsx` - Modal/dialog showing invitation details
- `InvitationQRCode.tsx` - Component to display QR code

### 2.3 Super Admin Check
**Location:** `src/pages/admin/Dashboard.tsx`

Use existing `useAdminRole()` hook:
```typescript
const { data: adminRole } = useAdminRole();
const isSuperAdmin = adminRole?.isSuperAdmin ?? false;

// Conditionally render tab
{isSuperAdmin && (
  <TabsTrigger value="invitations">Official Invitations</TabsTrigger>
)}
```

---

## 3. Backend API Endpoints

### 3.1 New Endpoints in `api/misc.js` and `server.cjs`

#### 3.1.1 `POST /api/admin/official-invitations`
**Purpose:** Create and send a new official invitation

**Request Body:**
```json
{
  "recipient_name": "John Doe",
  "recipient_email": "john@example.com",
  "recipient_phone": "+21612345678", // Optional
  "event_id": "uuid-here", // Optional, null for general
  "invitation_type": "vip", // general, vip, press, sponsor, special
  "custom_message": "You're invited to our exclusive event!" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "invitation_number": "INV-0001",
    "qr_code_url": "https://...",
    "status": "sent"
  }
```

**Logic:**
1. Verify admin is super admin
2. Validate email format
3. Generate unique QR code token (similar to ticket tokens)
4. Generate invitation number from sequence
5. Create invitation record in database
6. Generate QR code image
7. Upload QR code to Supabase Storage (`invitations/` bucket or `tickets/` bucket)
8. Send email with QR code embedded
9. Update invitation status to "sent"
10. Return invitation data

#### 3.1.2 `GET /api/admin/official-invitations`
**Purpose:** Fetch list of invitations with filters

**Query Parameters:**
- `status` - Filter by status
- `event_id` - Filter by event
- `invitation_type` - Filter by type
- `search` - Search by name or email
- `limit` - Pagination limit
- `offset` - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [...invitations],
  "count": 100
}
```

#### 3.1.3 `GET /api/admin/official-invitations/:id`
**Purpose:** Get single invitation details

#### 3.1.4 `POST /api/admin/official-invitations/:id/resend`
**Purpose:** Resend invitation email

#### 3.1.5 `DELETE /api/admin/official-invitations/:id`
**Purpose:** Delete invitation (soft delete or hard delete)

#### 3.1.6 `GET /api/validate-invitation/:token`
**Purpose:** Validate invitation QR code when scanned (public endpoint)

**Response:**
```json
{
  "valid": true,
  "invitation": {
    "id": "uuid",
    "recipient_name": "John Doe",
    "event": {...},
    "status": "sent"
  }
}
```

---

## 4. Email Template

### 4.1 Template Structure
**Location:** `src/lib/email.ts`

**Function:** `createOfficialInvitationEmail(invitationData)`

**Template Features:**
- Professional design matching existing email templates
- Andiamo Events branding/logo
- QR code image embedded (not attached)
- Custom message section (if provided)
- Event details (if event is specified)
- Support section (contact information)
- "Developed by Malek Ben Amor" footer section
- Responsive design (mobile-friendly)
- Dark mode support (if applicable)

### 4.2 Email Template HTML Structure
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Official Invitation - Andiamo Events</title>
  <!-- Inline CSS for email compatibility -->
</head>
<body>
  <!-- Header with Logo -->
  <div class="header">
    <img src="[LOGO_URL]" alt="Andiamo Events" />
  </div>
  
  <!-- Greeting -->
  <div class="greeting">
    <h1>You're Invited!</h1>
    <p>Dear <strong>[RECIPIENT_NAME]</strong>,</p>
  </div>
  
  <!-- Custom Message (if provided) -->
  <div class="custom-message">
    [CUSTOM_MESSAGE]
  </div>
  
  <!-- Event Details (if event specified) -->
  <div class="event-details">
    <h2>[EVENT_NAME]</h2>
    <p>Date: [EVENT_DATE]</p>
    <p>Venue: [EVENT_VENUE]</p>
  </div>
  
  <!-- QR Code Section -->
  <div class="qr-code-section">
    <h3>Your Invitation QR Code</h3>
    <p>Please present this QR code at the event entrance:</p>
    <img src="[QR_CODE_URL]" alt="Invitation QR Code" />
    <p class="qr-note">Invitation Number: [INVITATION_NUMBER]</p>
  </div>
  
  <!-- Instructions -->
  <div class="instructions">
    <h3>Important Information</h3>
    <ul>
      <li>Please arrive on time</li>
      <li>Present this QR code at the entrance</li>
      <li>Valid for one-time use</li>
    </ul>
  </div>
  
  <!-- Support Section -->
  <div class="support-section">
    <h3>Need Help?</h3>
    <p>If you have any questions or need assistance, please contact us:</p>
    <ul>
      <li>Email: support@andiamoevents.com</li>
      <li>Phone: [SUPPORT_PHONE]</li>
      <li>Website: [WEBSITE_URL]</li>
    </ul>
  </div>
  
  <!-- Footer -->
  <div class="footer">
    <p>Thank you for being part of Andiamo Events!</p>
    <p class="developer-credit">
      Developed by <strong>Malek Ben Amor</strong>
    </p>
    <p class="copyright">© [YEAR] Andiamo Events. All rights reserved.</p>
  </div>
</body>
</html>
```

### 4.3 Email Styling
- Use inline CSS (email clients don't support external stylesheets)
- Match existing email template colors (#E21836 for primary, etc.)
- Responsive design with media queries
- Fallback fonts (Arial, sans-serif)
- Proper image alt text
- Table-based layout for better email client compatibility

---

## 5. QR Code Generation

### 5.1 QR Code Token Generation
**Similar to ticket QR codes:**
- Generate secure random token: `encode(gen_random_bytes(32), 'hex')`
- Format: `INV-{token}` or just `{token}`
- Store in `qr_code_token` field

### 5.2 QR Code Image Generation
**Location:** `server.cjs` (backend)

**Process:**
1. Use `qrcode` npm package (already used for tickets)
2. Generate QR code image from token
3. Upload to Supabase Storage:
   - Bucket: `tickets` or new `invitations` bucket
   - Path: `invitations/{invitation_id}/{token}.png`
4. Get public URL
5. Store URL in `qr_code_url` field

**Code Reference:**
- See `src/lib/ticketGenerationService.tsx` for QR code generation pattern
- See `server.cjs` `/api/generate-qr-code` endpoint

### 5.3 QR Code Data
The QR code should encode:
- Invitation token
- Optional: Invitation ID
- Optional: Event ID (if applicable)
- Format: JSON string or URL with query params

**Example:**
```
https://andiamoevents.com/validate-invitation?token=INV-abc123...
```
or
```json
{"type":"invitation","token":"INV-abc123","id":"uuid"}
```

---

## 6. Storage & File Management

### 6.1 Supabase Storage Bucket
**Option 1:** Use existing `tickets` bucket
- Path: `invitations/{invitation_id}/{token}.png`

**Option 2:** Create new `invitations` bucket
- Same structure as tickets bucket
- Separate organization

### 6.2 Storage Policies
```sql
-- Allow public read access to invitation QR codes
CREATE POLICY "Public can view invitation QR codes"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'invitations' AND (storage.foldername(name))[1] = 'invitations');

-- Only super admins can upload invitation QR codes
CREATE POLICY "Super admins can upload invitation QR codes"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'invitations' 
    AND EXISTS (
      SELECT 1 FROM public.admins
      WHERE admins.id = auth.uid()
      AND admins.role = 'super_admin'
    )
  );
```

---

## 7. Permissions & Security

### 7.1 Super Admin Only
- All endpoints check for `role === 'super_admin'`
- Frontend tab only visible to super admins
- RLS policies enforce super admin requirement

### 7.2 API Authentication
- Use existing `verifyAdminAuth` middleware
- Add role check: `admin.role === 'super_admin'`
- Return 403 if not super admin

### 7.3 QR Code Validation
- Public endpoint for validation (needed for scanning)
- Rate limiting recommended
- Log all scan attempts
- Return minimal data (no sensitive info)

---

## 8. Implementation Steps

### Phase 1: Database Setup
1. ✅ Create migration file: `20250229000000-create-official-invitations-system.sql`
2. ✅ Create `official_invitations` table
3. ✅ Create `invitation_scans` table (optional)
4. ✅ Create sequence for invitation numbers
5. ✅ Set up RLS policies
6. ✅ Create indexes
7. ✅ Set up storage bucket and policies

### Phase 2: Backend API
1. ✅ Add `POST /api/admin/official-invitations` endpoint
2. ✅ Add `GET /api/admin/official-invitations` endpoint
3. ✅ Add `GET /api/admin/official-invitations/:id` endpoint
4. ✅ Add `POST /api/admin/official-invitations/:id/resend` endpoint
5. ✅ Add `DELETE /api/admin/official-invitations/:id` endpoint
6. ✅ Add `GET /api/validate-invitation/:token` endpoint (public)
7. ✅ Implement QR code generation logic
8. ✅ Implement email sending logic

### Phase 3: Email Template
1. ✅ Create `createOfficialInvitationEmail()` function
2. ✅ Design HTML template with:
   - Support section
   - Developer credit section
   - QR code embedding
   - Responsive design
3. ✅ Test email rendering in various clients

### Phase 4: Frontend
1. ✅ Add "Official Invitations" tab (super admin only)
2. ✅ Create invitation form component
3. ✅ Create invitations list component
4. ✅ Create invitation details modal
5. ✅ Add filters and search
6. ✅ Add statistics cards
7. ✅ Integrate with API endpoints

### Phase 5: Testing
1. ✅ Test invitation creation
2. ✅ Test email delivery
3. ✅ Test QR code generation and storage
4. ✅ Test QR code scanning/validation
5. ✅ Test permissions (non-super admin access)
6. ✅ Test resend functionality
7. ✅ Test deletion

### Phase 6: Documentation
1. ✅ Update API documentation
2. ✅ Add user guide for super admins
3. ✅ Document QR code validation process

---

## 9. API Routes to Add

**Location:** `src/lib/api-routes.ts`

```typescript
export const API_ROUTES = {
  // ... existing routes
  
  // Official Invitations (Super Admin Only)
  OFFICIAL_INVITATIONS: '/api/admin/official-invitations',
  OFFICIAL_INVITATION_BY_ID: (id: string) => `/api/admin/official-invitations/${id}`,
  RESEND_INVITATION: (id: string) => `/api/admin/official-invitations/${id}/resend`,
  VALIDATE_INVITATION: (token: string) => `/api/validate-invitation/${token}`,
};
```

---

## 10. Dependencies

### Already Available:
- `qrcode` - For QR code generation (used in tickets)
- `@supabase/supabase-js` - For database and storage
- Email sending infrastructure (existing)

### May Need:
- None (all dependencies already exist)

---

## 11. Email Template Preview

### Support Section Example:
```html
<div style="background: #F5F5F5; padding: 30px; border-radius: 8px; margin: 40px 0;">
  <h3 style="color: #E21836; margin-bottom: 15px;">Need Help?</h3>
  <p style="color: #666; margin-bottom: 10px;">
    If you have any questions or need assistance, please contact our support team:
  </p>
  <ul style="color: #666; line-height: 1.8;">
    <li><strong>Email:</strong> support@andiamoevents.com</li>
    <li><strong>Phone:</strong> +216 XX XXX XXX</li>
    <li><strong>Website:</strong> <a href="https://andiamoevents.com" style="color: #E21836;">andiamoevents.com</a></li>
  </ul>
</div>
```

### Developer Credit Section Example:
```html
<div style="text-align: center; padding: 20px; border-top: 1px solid #E0E0E0; margin-top: 40px;">
  <p style="color: #999; font-size: 12px; margin: 5px 0;">
    Developed by <strong style="color: #E21836;">Malek Ben Amor</strong>
  </p>
  <p style="color: #999; font-size: 11px; margin: 5px 0;">
    © 2025 Andiamo Events. All rights reserved.
  </p>
</div>
```

---

## 12. Notes & Considerations

1. **Invitation Types:** Consider if different types need different email templates or QR code formats
2. **Bulk Invitations:** Future enhancement - send multiple invitations at once
3. **Invitation Expiry:** Consider adding expiry dates for invitations
4. **Scan Tracking:** Decide if detailed scan tracking is needed (device, location, etc.)
5. **Resend Limits:** Consider rate limiting for resend functionality
6. **Email Delivery Tracking:** Integrate with email delivery logs if available
7. **QR Code Format:** Decide on QR code data format (URL vs JSON)
8. **Mobile Optimization:** Ensure QR code is scannable on mobile devices
9. **Accessibility:** Ensure email template is accessible (alt text, proper contrast)

---

## Summary

This feature requires:
- ✅ 1 new database table (`official_invitations`)
- ✅ 1 optional tracking table (`invitation_scans`)
- ✅ 5-6 new API endpoints
- ✅ 1 email template function
- ✅ 1 new admin dashboard tab (super admin only)
- ✅ 3-4 new React components
- ✅ QR code generation (reuse existing logic)
- ✅ Storage bucket setup (or reuse existing)

**Estimated Complexity:** Medium
**Estimated Time:** 2-3 days for full implementation
