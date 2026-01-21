# Bulk SMS Feature - Comprehensive Implementation Plan

## Overview
Create a comprehensive bulk SMS feature in the Marketing tab that allows admins to select phone numbers from multiple data sources, filter them, remove duplicates, compose messages, send SMS, and view results.

---

## 1. Data Sources Analysis

### 1.1 Phone Number Sources
1. **Ambassador Applications** (`ambassador_applications`)
   - Column: `phone_number`
   - Additional data: `city`, `ville`, `status` (pending/approved/rejected/removed)
   - Filter options: status, city, ville

2. **Orders** (`orders`)
   - Column: `user_phone`
   - Additional data: `city`, `ville`, `status`, `payment_method`, `source`
   - Filter options: city, ville, status, payment_method, source
   - **Special requirement**: Must support city and ville filtering

3. **AIO Events Submissions** (`aio_events_submissions`)
   - Column: `phone`
   - Additional data: `city`, `ville`, `status`, `event_id`
   - Filter options: city, ville, status, event_id

4. **Approved Ambassadors** (`ambassadors`)
   - Column: `phone`
   - Additional data: `city`, `ville`, `status` (should be 'approved')
   - Filter options: city, ville

5. **Phone Subscribers** (`phone_subscribers`) - Existing
   - Column: `phone_number`
   - Additional data: `city` (optional), `subscribed_at`
   - Currently used in Broadcast Mode

---

## 2. UI/UX Design Plan

### 2.1 Marketing Tab Structure
```
Marketing Tab
├── SMS Marketing Sub-tab (refactor existing)
│   ├── SMS Balance Card (keep existing)
│   ├── Test SMS Card (keep existing)
│   ├── **NEW: Bulk SMS Selection Card** (main feature)
│   │   ├── Source Selection (checkboxes)
│   │   ├── Filters Section
│   │   ├── Preview & Count
│   │   ├── Message Composition
│   │   ├── Send Button
│   │   └── Results Display
│   └── SMS Logs Card (keep existing, enhance)
└── Email Marketing Sub-tab (keep existing)
```

### 2.2 Bulk SMS Selection Card Components

#### 2.2.1 Source Selection Section
- **Checkboxes for each source:**
  - ☐ Ambassador Applications
  - ☐ Orders (Clients)
  - ☐ AIO Events Submissions
  - ☐ Approved Ambassadors
  - ☐ Phone Subscribers (existing)

- **Source-specific info:**
  - Show count per source (e.g., "Ambassador Applications: 1,234 numbers")
  - Show last updated date if available
  - Visual indicator if source has no phone numbers

#### 2.2.2 Filters Section (Dynamic based on selected sources)

**For Ambassador Applications:**
- Status filter: All / Pending / Approved / Rejected / Removed
- City filter: Dropdown (all cities from CITIES constant)
- Ville filter: Dropdown (populated based on selected city)

**For Orders (Clients):**
- City filter: Dropdown (required when Orders selected)
- Ville filter: Dropdown (populated based on selected city)
- Status filter: All / COMPLETED / PAID / etc.
- Payment method filter: All / COD / Online / etc.
- Source filter: All / platform_cod / platform_online / ambassador_manual

**For AIO Events Submissions:**
- City filter: Dropdown
- Ville filter: Dropdown
- Status filter: All / submitted / processed
- Event filter: Dropdown (all events)

**For Approved Ambassadors:**
- City filter: Dropdown
- Ville filter: Dropdown

**For Phone Subscribers:**
- City filter: Dropdown (if city column exists)
- Date range filter: From / To (subscribed_at)

#### 2.2.3 Preview & Count Section
- **Total unique phone numbers:** Display count (after deduplication)
- **Breakdown by source:** Show how many from each selected source
- **Preview table:** 
  - Show first 10-20 phone numbers with source label
  - "Show all" button to expand
  - Export preview button
- **Duplicate removal indicator:** 
  - "X duplicates removed" message
  - Show which sources had duplicates

#### 2.2.4 Message Composition Section
- **Textarea** for SMS message (keep existing styling)
- **Character counter** (keep existing)
- **Message count estimator** (keep existing: ~160 chars per SMS)
- **Preview button:** Show how message will look
- **Templates dropdown:** Pre-defined message templates (optional enhancement)

#### 2.2.5 Send Button & Status
- **Send button:** 
  - Disabled if no numbers selected or message empty
  - Show count: "Send to X numbers"
  - Loading state during sending
- **Progress indicator:** 
  - Progress bar showing X/Y sent
  - Real-time updates
  - Cancel button (optional)

#### 2.2.6 Results Display Section
- **Summary card:**
  - Total sent
  - Total failed
  - Success rate percentage
  - Time taken
- **Detailed results table:**
  - Phone number
  - Source label
  - Status (sent/failed)
  - Error message (if failed)
  - Timestamp
  - Filter/search in results
- **Export results button:** Export to Excel
- **View in SMS Logs button:** Link to SMS Logs section

---

## 3. Backend API Plan

### 3.1 New Endpoints

#### 3.1.1 `GET /api/admin/phone-numbers/sources`
**Purpose:** Get phone numbers from selected sources with filters

**Request:**
```json
{
  "sources": {
    "ambassador_applications": {
      "enabled": true,
      "filters": {
        "status": ["pending", "approved"],
        "city": "Tunis",
        "ville": null
      }
    },
    "orders": {
      "enabled": true,
      "filters": {
        "city": "Tunis",
        "ville": "Lac",
        "status": ["COMPLETED", "PAID"],
        "payment_method": null,
        "source": null
      }
    },
    "aio_events_submissions": {
      "enabled": false,
      "filters": {}
    },
    "approved_ambassadors": {
      "enabled": false,
      "filters": {}
    },
    "phone_subscribers": {
      "enabled": false,
      "filters": {}
    }
  },
  "includeMetadata": true  // Include source, city, ville for each number
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "phoneNumbers": [
      {
        "phone": "27169458",
        "source": "ambassador_applications",
        "sourceId": "uuid",
        "city": "Tunis",
        "ville": null,
        "metadata": {
          "status": "approved",
          "full_name": "John Doe"
        }
      },
      {
        "phone": "98765432",
        "source": "orders",
        "sourceId": "uuid",
        "city": "Tunis",
        "ville": "Lac",
        "metadata": {
          "order_number": 123,
          "user_name": "Jane Doe"
        }
      }
    ],
    "counts": {
      "total": 150,
      "unique": 145,
      "duplicates": 5,
      "bySource": {
        "ambassador_applications": 80,
        "orders": 70
      }
    },
    "duplicates": [
      {
        "phone": "27169458",
        "sources": ["ambassador_applications", "orders"]
      }
    ]
  }
}
```

#### 3.1.2 `POST /api/admin/bulk-sms/send`
**Purpose:** Send bulk SMS to selected phone numbers

**Request:**
```json
{
  "phoneNumbers": ["27169458", "98765432", ...],
  "message": "Your SMS message here",
  "sources": {
    "ambassador_applications": true,
    "orders": true,
    ...
  },
  "filters": {
    // Same as GET endpoint filters
  },
  "metadata": {
    "campaignName": "Optional campaign name",
    "adminId": "uuid"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "sent": 145,
    "failed": 5,
    "results": [
      {
        "phone": "27169458",
        "status": "sent",
        "source": "ambassador_applications",
        "sentAt": "2024-01-01T12:00:00Z",
        "apiResponse": {...}
      },
      {
        "phone": "98765432",
        "status": "failed",
        "source": "orders",
        "error": "Invalid phone number",
        "apiResponse": {...}
      }
    ],
    "smsLogIds": ["uuid1", "uuid2", ...]  // IDs in sms_logs table
  }
}
```

#### 3.1.3 `GET /api/admin/phone-numbers/counts`
**Purpose:** Get quick counts per source (for UI display)

**Request:**
```json
{
  "sources": ["ambassador_applications", "orders", ...]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ambassador_applications": {
      "total": 1234,
      "withPhone": 1200,
      "byStatus": {
        "pending": 100,
        "approved": 800,
        "rejected": 200,
        "removed": 100
      }
    },
    "orders": {
      "total": 5678,
      "withPhone": 5600,
      "byCity": {
        "Tunis": 2000,
        "Sfax": 1500,
        ...
      }
    },
    ...
  }
}
```

### 3.2 Existing Endpoints to Keep/Enhance

- `POST /api/send-sms` - Keep existing, may need rate limiting enhancement
- `GET /api/sms-balance` - Keep existing
- `GET /api/admin/sms-logs` - Enhance to support filtering by source, campaign

---

## 4. Database Schema Considerations

### 4.1 Enhance `sms_logs` Table
Add columns to track source and campaign:
```sql
ALTER TABLE sms_logs 
ADD COLUMN IF NOT EXISTS source TEXT,  -- 'ambassador_applications', 'orders', etc.
ADD COLUMN IF NOT EXISTS source_id UUID,  -- ID of the record in source table
ADD COLUMN IF NOT EXISTS campaign_name TEXT,  -- Optional campaign identifier
ADD COLUMN IF NOT EXISTS admin_id UUID;  -- Admin who sent the SMS

CREATE INDEX IF NOT EXISTS idx_sms_logs_source ON sms_logs(source);
CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign ON sms_logs(campaign_name);
```

### 4.2 No New Tables Required
- Use existing tables for phone number sources
- Use existing `sms_logs` table (enhanced)

---

## 5. Frontend Implementation Plan

### 5.1 New Components to Create

#### 5.1.1 `BulkSmsSelector.tsx`
**Location:** `src/components/admin/BulkSmsSelector.tsx`

**Props:**
```typescript
interface BulkSmsSelectorProps {
  language: 'en' | 'fr';
  onSend: (data: BulkSmsData) => Promise<void>;
}
```

**Features:**
- Source selection checkboxes
- Dynamic filters based on selected sources
- Preview section
- Message composition
- Send button with progress

#### 5.1.2 `PhoneNumberPreview.tsx`
**Location:** `src/components/admin/PhoneNumberPreview.tsx`

**Props:**
```typescript
interface PhoneNumberPreviewProps {
  phoneNumbers: PhoneNumberWithMetadata[];
  language: 'en' | 'fr';
  onExport?: () => void;
}
```

**Features:**
- Display phone numbers with source labels
- Show city/ville if available
- Expandable list
- Export to Excel

#### 5.1.3 `BulkSmsResults.tsx`
**Location:** `src/components/admin/BulkSmsResults.tsx`

**Props:**
```typescript
interface BulkSmsResultsProps {
  results: BulkSmsResult[];
  language: 'en' | 'fr';
  onExport?: () => void;
}
```

**Features:**
- Summary statistics
- Detailed results table
- Filter/search results
- Export functionality

### 5.2 State Management

**New State in Dashboard.tsx:**
```typescript
// Bulk SMS state
const [selectedSources, setSelectedSources] = useState<SourceSelection>({
  ambassador_applications: false,
  orders: false,
  aio_events_submissions: false,
  approved_ambassadors: false,
  phone_subscribers: false
});

const [sourceFilters, setSourceFilters] = useState<SourceFilters>({
  ambassador_applications: { status: [], city: null, ville: null },
  orders: { city: null, ville: null, status: [], payment_method: null, source: null },
  aio_events_submissions: { city: null, ville: null, status: [], event_id: null },
  approved_ambassadors: { city: null, ville: null },
  phone_subscribers: { city: null, dateFrom: null, dateTo: null }
});

const [previewPhoneNumbers, setPreviewPhoneNumbers] = useState<PhoneNumberWithMetadata[]>([]);
const [loadingPreview, setLoadingPreview] = useState(false);
const [bulkSmsMessage, setBulkSmsMessage] = useState("");
const [sendingBulkSms, setSendingBulkSms] = useState(false);
const [bulkSmsResults, setBulkSmsResults] = useState<BulkSmsResult[] | null>(null);
```

### 5.3 API Integration Functions

**New functions in Dashboard.tsx:**
```typescript
// Fetch phone numbers preview
const fetchPhoneNumbersPreview = async () => {
  // Call GET /api/admin/phone-numbers/sources
  // Update previewPhoneNumbers state
};

// Send bulk SMS
const handleSendBulkSms = async () => {
  // Validate selections
  // Call POST /api/admin/bulk-sms/send
  // Update bulkSmsResults
  // Refresh SMS logs
};

// Get source counts
const fetchSourceCounts = async () => {
  // Call GET /api/admin/phone-numbers/counts
  // Display in UI
};
```

### 5.4 Refactoring Existing Code

**In Marketing Tab SMS Sub-tab:**
1. **Remove/Refactor "Broadcast Mode" card:**
   - Keep functionality but integrate into new Bulk SMS Selector
   - Phone subscribers becomes one of the selectable sources

2. **Remove/Refactor "Targeted Mode" card:**
   - Ambassador applications by city becomes part of source selection
   - City filter becomes part of filters section

3. **Keep "Test SMS" card:** No changes needed

4. **Keep "SMS Balance" card:** No changes needed

5. **Enhance "SMS Logs" card:**
   - Add filter by source
   - Add filter by campaign
   - Show source label in log entries

---

## 6. Data Processing Logic

### 6.1 Phone Number Deduplication
```typescript
function deduplicatePhoneNumbers(phoneNumbers: PhoneNumberWithMetadata[]): {
  unique: PhoneNumberWithMetadata[];
  duplicates: DuplicateInfo[];
} {
  const seen = new Map<string, PhoneNumberWithMetadata>();
  const duplicates: DuplicateInfo[] = [];
  
  phoneNumbers.forEach(num => {
    const normalized = normalizePhoneNumber(num.phone);
    if (seen.has(normalized)) {
      const existing = seen.get(normalized)!;
      duplicates.push({
        phone: normalized,
        sources: [existing.source, num.source]
      });
    } else {
      seen.set(normalized, num);
    }
  });
  
  return {
    unique: Array.from(seen.values()),
    duplicates
  };
}
```

### 6.2 Phone Number Normalization
```typescript
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove country code if present (+216)
  if (cleaned.startsWith('216')) {
    cleaned = cleaned.substring(3);
  }
  
  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');
  
  // Validate Tunisian format (8 digits, starts with 2, 4, 5, or 9)
  if (!/^[2594]\d{7}$/.test(cleaned)) {
    throw new Error(`Invalid phone number: ${phone}`);
  }
  
  return cleaned;
}
```

### 6.3 Filter Application
- Apply filters per source before fetching
- Combine results from all selected sources
- Deduplicate after combining
- Sort by source, then by phone number

---

## 7. Testing Plan

### 7.1 API Testing

#### 7.1.1 `GET /api/admin/phone-numbers/sources`
**Test Cases:**
1. ✅ Single source (ambassador_applications) with no filters
2. ✅ Single source with status filter
3. ✅ Single source with city filter
4. ✅ Single source with city + ville filter
5. ✅ Multiple sources with different filters
6. ✅ Verify deduplication works correctly
7. ✅ Verify counts are accurate
8. ✅ Test with invalid filters (should return error)
9. ✅ Test with no enabled sources (should return empty)
10. ✅ Test with sources that have no phone numbers

#### 7.1.2 `POST /api/admin/bulk-sms/send`
**Test Cases:**
1. ✅ Send to 1 phone number
2. ✅ Send to 10 phone numbers
3. ✅ Send to 100+ phone numbers (test batching)
4. ✅ Send with invalid phone numbers (should handle gracefully)
5. ✅ Send with empty message (should return error)
6. ✅ Send with very long message (multi-part SMS)
7. ✅ Verify SMS logs are created correctly
8. ✅ Verify source metadata is saved
9. ✅ Test rate limiting (if implemented)
10. ✅ Test with WinSMS API failure (should log errors)

#### 7.1.3 `GET /api/admin/phone-numbers/counts`
**Test Cases:**
1. ✅ Get counts for all sources
2. ✅ Get counts for single source
3. ✅ Verify counts match actual data
4. ✅ Test with non-existent source (should handle gracefully)

### 7.2 Frontend Testing

#### 7.2.1 Component Testing
1. ✅ BulkSmsSelector renders correctly
2. ✅ Source selection updates state
3. ✅ Filters appear/disappear based on source selection
4. ✅ Preview updates when filters change
5. ✅ Message composition works
6. ✅ Send button disabled when invalid
7. ✅ Progress indicator shows during sending
8. ✅ Results display correctly after sending

#### 7.2.2 Integration Testing
1. ✅ Full flow: Select sources → Apply filters → Preview → Send → View results
2. ✅ Error handling: API failures, network errors
3. ✅ Loading states: All async operations show loading
4. ✅ Data refresh: Results update SMS logs section

### 7.3 Edge Cases
1. ✅ No phone numbers in any source
2. ✅ All phone numbers are duplicates
3. ✅ Very large selection (1000+ numbers)
4. ✅ Special characters in message
5. ✅ Unicode/emoji in message
6. ✅ Empty filters (should fetch all)
7. ✅ Invalid city/ville combinations
8. ✅ Concurrent sends (should prevent or queue)

---

## 8. Error Handling

### 8.1 API Errors
- **Invalid filters:** Return 400 with specific error message
- **No phone numbers found:** Return 200 with empty array (not an error)
- **SMS API failure:** Log error, mark as failed, continue with other numbers
- **Database errors:** Return 500 with generic message (log details server-side)

### 8.2 Frontend Errors
- **Network errors:** Show toast notification, allow retry
- **Validation errors:** Show inline errors, disable send button
- **Timeout errors:** Show warning, allow user to check SMS logs

---

## 9. Performance Considerations

### 9.1 Backend
- **Batch processing:** Process SMS in chunks (e.g., 50 at a time)
- **Database queries:** Use indexes, limit result sets, use pagination if needed
- **Rate limiting:** Implement rate limiting for SMS API calls
- **Caching:** Cache source counts (refresh every 5 minutes)

### 9.2 Frontend
- **Lazy loading:** Load preview data only when needed
- **Virtual scrolling:** For large preview lists
- **Debouncing:** Debounce filter changes to avoid excessive API calls
- **Optimistic updates:** Show preview immediately, fetch details in background

---

## 10. Security Considerations

### 10.1 Authentication & Authorization
- ✅ All endpoints require admin authentication (`requireAdminAuth`)
- ✅ Verify admin has permission to send SMS
- ✅ Log admin ID with each SMS send

### 10.2 Input Validation
- ✅ Validate phone numbers (Tunisian format)
- ✅ Sanitize SMS message (remove dangerous characters)
- ✅ Validate filters (prevent SQL injection)
- ✅ Limit message length (prevent abuse)

### 10.3 Rate Limiting
- ✅ Limit number of SMS per admin per hour/day
- ✅ Limit number of phone numbers per request
- ✅ Implement queue system for large batches

---

## 11. Implementation Phases

### Phase 1: Backend API (Week 1)
1. Create database migration for `sms_logs` enhancements
2. Implement `GET /api/admin/phone-numbers/sources`
3. Implement `GET /api/admin/phone-numbers/counts`
4. Implement `POST /api/admin/bulk-sms/send`
5. Write API tests
6. Test with real data

### Phase 2: Frontend Components (Week 2)
1. Create `BulkSmsSelector` component
2. Create `PhoneNumberPreview` component
3. Create `BulkSmsResults` component
4. Integrate into Marketing tab
5. Add state management
6. Connect to API endpoints

### Phase 3: Refactoring (Week 2-3)
1. Refactor existing "Broadcast Mode" card
2. Refactor existing "Targeted Mode" card
3. Enhance SMS Logs section
4. Update translations
5. Remove old code

### Phase 4: Testing & Polish (Week 3)
1. Write component tests
2. Write integration tests
3. Test edge cases
4. Performance optimization
5. UI/UX polish
6. Documentation

---

## 12. File Structure

```
src/
├── components/
│   └── admin/
│       ├── BulkSmsSelector.tsx          (NEW)
│       ├── PhoneNumberPreview.tsx       (NEW)
│       └── BulkSmsResults.tsx           (NEW)
├── lib/
│   ├── api-routes.ts                    (UPDATE: add new routes)
│   └── phone-numbers.ts                 (NEW: utility functions)
├── pages/
│   └── admin/
│       └── Dashboard.tsx                 (UPDATE: refactor marketing tab)
└── types/
    └── bulk-sms.ts                      (NEW: TypeScript interfaces)

server.cjs                                (UPDATE: add new endpoints)
supabase/migrations/
    └── YYYYMMDDHHMMSS-enhance-sms-logs.sql  (NEW)
```

---

## 13. TypeScript Interfaces

```typescript
// src/types/bulk-sms.ts

export interface SourceSelection {
  ambassador_applications: boolean;
  orders: boolean;
  aio_events_submissions: boolean;
  approved_ambassadors: boolean;
  phone_subscribers: boolean;
}

export interface AmbassadorApplicationsFilters {
  status?: ('pending' | 'approved' | 'rejected' | 'removed')[];
  city?: string | null;
  ville?: string | null;
}

export interface OrdersFilters {
  city?: string | null;
  ville?: string | null;
  status?: string[];
  payment_method?: string | null;
  source?: string | null;
}

export interface AioEventsFilters {
  city?: string | null;
  ville?: string | null;
  status?: string[];
  event_id?: string | null;
}

export interface ApprovedAmbassadorsFilters {
  city?: string | null;
  ville?: string | null;
}

export interface PhoneSubscribersFilters {
  city?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}

export interface SourceFilters {
  ambassador_applications: AmbassadorApplicationsFilters;
  orders: OrdersFilters;
  aio_events_submissions: AioEventsFilters;
  approved_ambassadors: ApprovedAmbassadorsFilters;
  phone_subscribers: PhoneSubscribersFilters;
}

export interface PhoneNumberWithMetadata {
  phone: string;
  source: keyof SourceSelection;
  sourceId: string;
  city?: string | null;
  ville?: string | null;
  metadata?: Record<string, any>;
}

export interface BulkSmsData {
  phoneNumbers: string[];
  message: string;
  sources: SourceSelection;
  filters: SourceFilters;
  metadata?: {
    campaignName?: string;
    adminId?: string;
  };
}

export interface BulkSmsResult {
  phone: string;
  status: 'sent' | 'failed';
  source: keyof SourceSelection;
  sourceId?: string;
  error?: string;
  sentAt?: string;
  apiResponse?: any;
}

export interface BulkSmsResponse {
  total: number;
  sent: number;
  failed: number;
  results: BulkSmsResult[];
  smsLogIds: string[];
}
```

---

## 14. Success Criteria

✅ Admin can select multiple phone number sources
✅ Admin can apply filters per source (especially city/ville for orders)
✅ Duplicate phone numbers are automatically removed
✅ Preview shows accurate count and sample numbers
✅ SMS can be sent to selected numbers
✅ Results are displayed with success/failure status
✅ SMS logs are updated with source information
✅ All existing functionality (test SMS, balance, logs) still works
✅ UI is intuitive and responsive
✅ Performance is acceptable for 1000+ phone numbers
✅ All tests pass
✅ No security vulnerabilities

---

## 15. Notes & Considerations

1. **Backward Compatibility:** Keep existing Broadcast Mode and Targeted Mode functionality working during transition, or provide migration path.

2. **Phone Number Format:** Ensure all phone numbers are normalized to Tunisian format (8 digits, starts with 2, 4, 5, or 9).

3. **SMS Cost:** Consider showing estimated cost before sending (if SMS pricing is known).

4. **Campaign Tracking:** Optional feature to name campaigns for analytics.

5. **Scheduling:** Future enhancement to schedule SMS sends.

6. **Templates:** Future enhancement for message templates.

7. **A/B Testing:** Future enhancement for testing different messages.

8. **Compliance:** Ensure SMS sending complies with local regulations (opt-out, etc.).

---

## End of Plan

This plan provides a comprehensive roadmap for implementing the bulk SMS feature. Each phase should be completed and tested before moving to the next phase.
