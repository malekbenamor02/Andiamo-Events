# Scan App - Full Specification & Documentation

**Date:** 2025-03-01  
**Type:** Complete Application Specification  
**Purpose:** Comprehensive documentation of the QR code ticket scanning application for event entry validation

---

## 📱 APPLICATION OVERVIEW

### Purpose

The Scan App is a mobile application designed for event entry control and ticket validation. It allows ambassadors and administrators to scan QR codes from tickets at event entrances, validate ticket authenticity, prevent duplicate entries, and maintain a complete audit trail of all entry attempts.

### Core Value Proposition

- **Secure Entry Control**: Only valid, unused tickets grant entry to events
- **Real-time Validation**: Instant verification of ticket authenticity via API
- **Duplicate Prevention**: Prevents the same ticket from being used multiple times
- **Complete Audit Trail**: Records all scans with timestamps, locations, and scanner information
- **Offline Capability**: Queue scans when offline and sync when connection returns
- **Multi-role Support**: Supports ambassador and admin roles with appropriate permissions

---

## 🎯 CORE FUNCTIONALITY

### 1. QR Code Scanning

#### Primary Scanning Method

**Process:**
1. User opens the app and authenticates
2. User selects the current event
3. App opens device camera with viewfinder
4. User points camera at QR code on ticket
5. QR library automatically detects and decodes the code
6. Extracts `secure_token` (UUID v4) from QR code payload
7. Sends token to validation API for verification

**Technical Details:**
- **QR Payload**: `tickets.secure_token` (UUID v4 format)
- **QR Format**: Standard QR code (version and error correction level to be determined)
- **Camera Requirements**: Device must support camera access with auto-focus
- **Scanning Library**: React Native QR scanner library (react-native-qrcode-scanner or similar)

#### Manual Entry Mode (Fallback)

**When to Use:**
- QR code is damaged or unreadable
- Camera not available or permissions denied
- User prefers manual input

**Process:**
1. User taps "Manual Entry" button
2. User types or pastes `secure_token` (UUID format)
3. Same validation API flow as QR scanning
4. Validation and recording proceed identically

---

### 2. Ticket Validation

#### Validation Flow

**Step 1: QR Code Decode**
- Input: Scanned QR code image/data
- Action: Decode QR code to extract `secure_token` (UUID v4 string)
- Output: `secure_token` value

**Step 2: API Validation Request**
- **Endpoint**: `POST /api/validate-ticket`
- **Request Payload**:
```json
{
  "secure_token": "550e8400-e29b-41d4-a716-446655440000",
  "event_id": "event-uuid-here",
  "scanner_id": "ambassador-uuid-or-admin-uuid",
  "scanner_type": "ambassador" | "admin" | "system",
  "scan_location": "Main Entrance" | "VIP Entrance" | "Gate A", etc.,
  "device_info": "iPhone 13, iOS 17.0" | "Android Device, API 33",
  "ip_address": "192.168.1.1" (optional, server-side if available)
}
```

**Step 3: Server-Side Validation (Backend Process)**

The server performs the following checks:

1. **Ticket Existence Check**
   - Query: `SELECT * FROM tickets WHERE secure_token = <token>`
   - If not found → Return `INVALID` result

2. **Event Matching Check**
   - Verify: `ticket.event_id === request.event_id`
   - If different → Return `WRONG_EVENT` result

3. **Ticket Status Check**
   - Query: `SELECT ticket_status FROM qr_tickets WHERE secure_token = <token>`
   - Check status: `VALID`, `USED`, `INVALID`, `EXPIRED`
   - If `USED` or `INVALID` or `EXPIRED` → Return appropriate result

4. **Duplicate Scan Check**
   - Query: `SELECT * FROM scans WHERE ticket_id = <ticket.id> AND scan_result = 'valid'`
   - If exists → Return `ALREADY_SCANNED` result with previous scan details

5. **Event Date Validation** (if applicable)
   - Check: `event.date` vs current date/time
   - If event date passed → May mark as `EXPIRED` (depending on business rules)

**Step 4: Record Scan (If Valid)**

If all validations pass:
- Insert record into `scans` table:
  - `ticket_id` = ticket.id
  - `event_id` = event.id
  - `ambassador_id` or `scanner_id` = scanner's ID
  - `scan_time` = current timestamp
  - `scan_result` = 'valid'
  - `scan_location` = provided location
  - `device_info` = provided device info
  - `ip_address` = request IP (if available)

- Update ticket status (if applicable):
  - Update `qr_tickets.ticket_status` to `'USED'`
  - Update `tickets.status` if needed

**Step 5: API Response**

**Success Response (Valid Ticket):**
```json
{
  "success": true,
  "result": "valid",
  "message": "Ticket validated successfully",
  "ticket": {
    "ticket_id": "ticket-uuid",
    "secure_token": "550e8400-e29b-41d4-a716-446655440000",
    "buyer_name": "John Doe",
    "buyer_phone": "+1234567890",
    "buyer_email": "john@example.com",
    "pass_type": "VIP",
    "order_id": "order-uuid",
    "order_number": 1234,
    "source": "platform_online",
    "payment_method": "online",
    "ambassador_name": "Jane Ambassador" (if applicable),
    "event_name": "Summer Festival 2025",
    "event_date": "2025-07-15T20:00:00Z",
    "event_venue": "Grand Hall",
    "event_city": "Casablanca",
    "scanned_at": "2025-07-15T19:30:00Z"
  },
  "scan_record": {
    "scan_id": "scan-uuid",
    "scan_time": "2025-07-15T19:30:00Z"
  }
}
```

**Error Response Examples:**

**Already Scanned:**
```json
{
  "success": false,
  "result": "already_scanned",
  "message": "This ticket has already been used",
  "previous_scan": {
    "scanned_at": "2025-07-15T18:00:00Z",
    "scanner_name": "Jane Ambassador",
    "scanner_type": "ambassador",
    "scan_location": "VIP Entrance",
    "ticket_id": "ticket-uuid"
  }
}
```

**Invalid Ticket:**
```json
{
  "success": false,
  "result": "invalid",
  "message": "Ticket not found or invalid"
}
```

**Wrong Event:**
```json
{
  "success": false,
  "result": "wrong_event",
  "message": "This ticket is for a different event",
  "correct_event": {
    "event_id": "other-event-uuid",
    "event_name": "Winter Gala 2025",
    "event_date": "2025-12-15T20:00:00Z"
  }
}
```

**Expired Ticket:**
```json
{
  "success": false,
  "result": "expired",
  "message": "This ticket has expired",
  "event_date": "2025-06-15T20:00:00Z",
  "current_date": "2025-07-15T19:30:00Z"
}
```

**Step 6: Client Response Handling**

The app receives the API response and:

1. **Valid Ticket:**
   - Display success animation (green checkmark, sound)
   - Show ticket information panel:
     - Ticket holder name
     - Pass type (VIP/Standard/etc.)
     - Order number
     - Purchase source
     - Purchase date/time
     - Ambassador name (if applicable)
   - Mark ticket as scanned in local history
   - Add to scan history list
   - Update statistics
   - Enable next scan (auto-return to camera after 3-5 seconds)

2. **Invalid/Error Responses:**
   - Display error animation (red X, error sound)
   - Show error message with reason
   - Display previous scan details (if already_scanned)
   - Allow retry or next scan
   - Log attempt in scan history with error status

---

### 3. Scan Recording & History

#### Local Scan History

**Storage:**
- Store recent scans locally (last 100-200 scans)
- Persist to device storage (AsyncStorage or SQLite)
- Sync with server when online

**Scan History Entry:**
```typescript
interface ScanHistoryEntry {
  scan_id: string;
  ticket_id: string;
  secure_token: string;
  result: 'valid' | 'invalid' | 'already_scanned' | 'wrong_event' | 'expired';
  buyer_name: string;
  pass_type: string;
  order_number?: number;
  scanned_at: string;
  scan_location?: string;
  ticket_details?: TicketDetails;
  error_message?: string;
}
```

**History Features:**
- View recent scans (chronological list)
- Filter by:
  - Result type (valid/invalid/duplicate)
  - Date range
  - Event
  - Pass type
- Search by:
  - Buyer name
  - Phone number
  - Order number
  - Secure token
- Export scan history (CSV/JSON format)

#### Server-Side Scan Records

**Table: `scans` (or `ticket_scans`)**

All scans are recorded in the database:
- Valid scans: `scan_result = 'valid'`
- Invalid attempts: `scan_result = 'invalid'`
- Duplicate attempts: `scan_result = 'already_scanned'`
- Wrong event attempts: `scan_result = 'wrong_event'`
- Expired ticket attempts: `scan_result = 'expired'`

**Audit Trail:**
- Every scan attempt is recorded (not just successful ones)
- Complete history of entry attempts
- Used for analytics, fraud detection, and reporting

---

## 🎨 USER INTERFACE FEATURES

### 1. Authentication & Login Screen

**Features:**
- Login form with username/email and password
- Remember me option
- Forgot password link
- Role-based redirect after login:
  - Ambassadors → Ambassador dashboard
  - Admins → Admin dashboard

**Authentication:**
- Uses Supabase authentication or custom JWT
- Session management with token refresh
- Secure token storage (keychain/keystore)

---

### 2. Event Selection Screen

**Purpose:** Select the current event before scanning begins

**Features:**
- List of active events (events where date >= today)
- Search/filter events by name, city, or date
- Event cards showing:
  - Event name
  - Event date and time
  - Venue and city
  - Event status
- Tap event to select and lock scanning to that event
- Selected event displayed prominently at top of scanning screen

**Business Logic:**
- Only one event can be active for scanning at a time
- Cannot scan until event is selected
- Event selection persists across app sessions
- Can change event at any time (requires confirmation if scans exist)

---

### 3. Main Scanning Screen

**Layout:**

```
┌─────────────────────────────────────┐
│  [Event Name]              [Menu]   │
│  July 15, 2025 - Grand Hall         │
├─────────────────────────────────────┤
│                                     │
│         [Camera Viewfinder]         │
│                                     │
│      ┌───────────────────┐          │
│      │   QR Code Frame   │          │
│      └───────────────────┘          │
│                                     │
├─────────────────────────────────────┤
│  [Flash]  [Manual Entry]  [History] │
└─────────────────────────────────────┘
```

**Features:**

**Camera Viewfinder:**
- Full-screen or prominent camera view
- Scanning frame overlay (guides user to center QR code)
- Auto-focus on QR code detection
- Flashlight toggle button
- Zoom controls (if needed)

**Controls:**
- **Flash Button**: Toggle camera flash on/off
- **Manual Entry Button**: Open manual token input dialog
- **History Button**: View recent scans
- **Menu/Settings Button**: Access app settings

**Real-time Feedback:**
- Vibrate/haptic feedback when QR code detected
- Visual highlight when QR code is in frame
- Loading indicator during API validation
- Success/error animations overlay

**Ticket Information Panel** (after successful scan):

```
┌─────────────────────────────────────┐
│  ✅ VALID TICKET                    │
├─────────────────────────────────────┤
│  Name: John Doe                     │
│  Pass: VIP                          │
│  Order: #1234                       │
│  Source: Online                     │
│  Scanned: 19:30:00                  │
├─────────────────────────────────────┤
│  [Close]  [Next Scan]               │
└─────────────────────────────────────┘
```

---

### 4. Manual Entry Dialog

**Features:**
- Text input field for `secure_token`
- Paste button for clipboard
- UUID format validation (visual feedback)
- Submit button to validate
- Same validation flow as QR scanning
- Cancel button to return to camera

**Input Validation:**
- Check UUID format (8-4-4-4-12 hex digits)
- Visual feedback: green when valid format, red when invalid
- Auto-format as user types (add hyphens)

---

### 5. Scan History Screen

**Layout:**

```
┌─────────────────────────────────────┐
│  Scan History              [Filter] │
├─────────────────────────────────────┤
│  🔍 [Search...]                     │
├─────────────────────────────────────┤
│  ✅ John Doe - VIP                  │
│     Order #1234 - 19:30:00          │
│  ❌ Invalid Ticket                  │
│     19:28:15                        │
│  ⚠️  Jane Smith - Standard          │
│     Already scanned at 18:00:00     │
└─────────────────────────────────────┘
```

**Features:**
- List of recent scans (most recent first)
- Color-coded results:
  - Green: Valid scans
  - Red: Invalid/error scans
  - Yellow: Duplicate attempts
- Tap scan to view full details
- Pull-to-refresh to sync with server
- Load more (pagination)
- Filter and search functionality
- Export button (CSV/JSON)

**Scan Detail View:**
- Full ticket information
- Scan metadata (time, location, device)
- Previous scan details (if duplicate)
- Related order information

---

### 6. Statistics Dashboard

**Purpose:** View scanning statistics and analytics

**Features:**

**Overview Cards:**
- Total scans today
- Valid scans count
- Invalid attempts count
- Duplicate attempts count
- Success rate percentage

**Charts/Graphs:**
- Scans per hour (line chart)
- Pass type distribution (pie chart)
- Scan results breakdown (bar chart)
- Scans by location (if multiple locations)

**Time Filters:**
- Today
- This week
- This month
- Custom date range

**Export Options:**
- Export statistics as PDF/CSV
- Email reports
- Share reports

---

### 7. Settings Screen

**Features:**

**Account:**
- Profile information
- Change password
- Logout

**Scanning Settings:**
- Enable/disable sound feedback
- Enable/disable haptic feedback
- Enable/disable auto-focus
- Default scan location (if applicable)
- Camera preferences (resolution, quality)

**Offline Mode:**
- View offline queue
- Manual sync trigger
- Offline mode settings

**Notifications:**
- Enable/disable push notifications
- Notification preferences

**About:**
- App version
- Build number
- Support contact
- Terms of service
- Privacy policy

---

## 👥 USER ROLES & PERMISSIONS

### Ambassador Role

**Capabilities:**
- Scan tickets for assigned events (events where ambassador is active)
- View own scan history
- View statistics for own scans
- Manual entry mode
- Offline scanning with sync

**Restrictions:**
- Cannot scan tickets for events they're not assigned to
- Limited access to admin features
- Cannot modify scan records
- Cannot view all ambassadors' statistics

### Admin Role

**Capabilities:**
- Scan tickets for ALL events
- View all scan history (all scanners)
- View comprehensive statistics (all events, all scanners)
- Access all scanning features
- Export all data
- Manage events
- View ambassador performance

**Additional Features:**
- System-wide analytics
- Cross-event reporting
- Ambassador management
- Event management

### System Role

**Automated Scanning:**
- Automated gate scanners
- API-based integrations
- System-to-system validations

---

## 🔄 SCAN RESULT TYPES

### 1. VALID

**Definition:** Ticket is valid, unused, and matches the selected event

**Response:**
- Success animation (green checkmark, success sound)
- Ticket information display
- Scan recorded as `scan_result = 'valid'`
- Ticket status updated to `USED`
- Entry granted

**User Action:**
- Allow entry
- Show ticket details
- Enable next scan

---

### 2. ALREADY_SCANNED

**Definition:** Ticket was previously validated and scanned successfully

**Response:**
- Warning animation (yellow alert, warning sound)
- Show previous scan details:
  - Previous scan time
  - Previous scanner name
  - Previous scan location
- Scan recorded as `scan_result = 'already_scanned'`
- Entry denied

**User Action:**
- Deny entry
- Show previous scan information
- Log duplicate attempt
- Alert security (if configured)

---

### 3. INVALID

**Definition:** Ticket not found in database or corrupted QR code

**Response:**
- Error animation (red X, error sound)
- Error message: "Ticket not found or invalid"
- Scan recorded as `scan_result = 'invalid'`
- Entry denied

**User Action:**
- Deny entry
- Show error message
- Suggest manual entry if QR damaged
- Log invalid attempt

---

### 4. WRONG_EVENT

**Definition:** Ticket belongs to a different event than selected

**Response:**
- Warning animation (yellow alert)
- Error message: "This ticket is for a different event"
- Show correct event information:
  - Correct event name
  - Correct event date
- Scan recorded as `scan_result = 'wrong_event'`
- Entry denied

**User Action:**
- Deny entry
- Inform user of correct event
- Suggest selecting correct event (if applicable)
- Log wrong event attempt

---

### 5. EXPIRED

**Definition:** Event date has passed or ticket validity period expired

**Response:**
- Error animation (red X, error sound)
- Error message: "This ticket has expired"
- Show expiration information:
  - Event date
  - Current date
  - Days since expiration
- Scan recorded as `scan_result = 'expired'`
- Entry denied

**User Action:**
- Deny entry
- Inform user of expiration
- Log expired ticket attempt

---

## 📊 STATISTICS & REPORTING

### Real-time Statistics

**Metrics Tracked:**
- Total scans (all time, today, this week, this month)
- Valid scans count
- Invalid attempts count
- Duplicate attempts count
- Success rate percentage
- Scans per hour
- Average scan time
- Peak scanning hours

**Pass Type Statistics:**
- Scans per pass type (VIP, Standard, etc.)
- Pass type distribution percentage
- Revenue per pass type (if available)

**Location Statistics** (if multiple locations):
- Scans per location
- Location success rates
- Location peak times

### Reporting Features

**Export Formats:**
- CSV (Excel-compatible)
- JSON (API/data integration)
- PDF (human-readable reports)

**Report Types:**
- Daily scan report
- Event summary report
- Ambassador performance report
- Pass type analysis report
- Error analysis report

**Delivery Methods:**
- In-app download
- Email delivery
- API endpoint (for integrations)

---

## 🌐 OFFLINE CAPABILITY

### Offline Mode Features

**When Offline:**
- App detects network unavailability
- Switches to offline mode automatically
- Shows offline indicator in UI
- Queues scans for later sync

**Offline Queue:**
- Scans are stored locally with:
  - Secure token
  - Event ID
  - Scanner ID
  - Timestamp
  - Device info
  - Scan location
- Limited validation (basic UUID format check only)
- Full validation deferred until online

**When Connection Returns:**
- Automatic sync in background
- Sync on app open
- Manual sync trigger available
- Sync progress indicator

**Offline Queue Management:**
- View queued scans
- Retry failed syncs
- Clear queue (with confirmation)
- Queue size limits (prevent storage issues)

### Cached Data

**What's Cached:**
- Active events list
- Recent ticket validations (last 24 hours)
- Scanner profile information
- App settings

**Cache Management:**
- Auto-refresh when online
- Manual refresh option
- Cache expiration policies
- Clear cache option

---

## 🔒 SECURITY FEATURES

### Authentication & Authorization

**Secure Authentication:**
- Encrypted password storage
- JWT token-based sessions
- Token refresh mechanism
- Secure token storage (keychain/keystore)
- Session timeout after inactivity

**Role-Based Access:**
- Ambassador: Limited to assigned events
- Admin: Full access to all events
- Permission checks on all API calls
- Server-side validation of permissions

### Data Security

**Encrypted Communications:**
- HTTPS for all API calls
- Certificate pinning (optional, for high security)
- Encrypted local storage for sensitive data

**Secure Token Handling:**
- Secure tokens stored securely
- No token logging in plain text
- Secure token transmission

### Fraud Prevention

**Rate Limiting:**
- API rate limits to prevent abuse
- Scan attempt limits per scanner
- Cooldown periods after excessive attempts

**Fraud Detection:**
- Monitor for suspicious patterns:
  - Multiple rapid duplicate scans
  - Same ticket scanned from multiple locations
  - Unusual scan times/locations
- Alert on suspicious activity
- Flag problematic scanners

**Audit Trail:**
- All scans recorded (valid and invalid)
- Complete history of entry attempts
- Cannot modify or delete scan records
- Immutable audit log

### Privacy

**Data Privacy:**
- Minimal data collection (only necessary fields)
- Secure handling of customer information
- Compliance with data protection regulations
- User consent for data collection

**Data Retention:**
- Configurable data retention policies
- Secure data deletion
- Anonymization options for old data

---

## 🔧 TECHNICAL REQUIREMENTS

### Platform Support

**Mobile Platforms:**
- iOS 13.0 or later
- Android API 21 (Android 5.0) or later

**Web Platform** (Optional):
- Modern browsers (Chrome, Safari, Firefox, Edge)
- Progressive Web App (PWA) support

### Hardware Requirements

**Camera:**
- Rear-facing camera (primary requirement)
- Auto-focus capability
- Flash support (optional but recommended)

**Storage:**
- Minimum 50MB free storage
- More for offline queue and cached data

**Network:**
- Internet connection for API calls
- Wi-Fi or cellular data
- Offline mode support

### Performance Requirements

**Scanning Performance:**
- QR code detection: < 1 second
- Camera initialization: < 2 seconds
- API response time: < 2 seconds (target)
- Overall scan-to-result time: < 3-4 seconds

**App Performance:**
- Smooth camera performance (30+ FPS)
- Low battery consumption
- Efficient memory usage
- Quick app startup (< 3 seconds)

### Dependencies & Libraries

**QR Code Scanning:**
- `react-native-qrcode-scanner` or similar
- Camera library: `react-native-vision-camera` or `expo-camera`

**State Management:**
- React Context API or Redux

**Storage:**
- AsyncStorage (React Native) or Keychain/Keystore
- SQLite (optional, for complex local data)

**Networking:**
- Axios or Fetch API
- Offline queue management library

**UI Components:**
- React Native UI libraries
- Custom components for animations

---

## 📱 USER EXPERIENCE (UX)

### Visual Feedback

**Success State:**
- Green checkmark animation
- Success sound (optional, configurable)
- Haptic feedback (vibration)
- Green color theme
- Confirmation message

**Error State:**
- Red X animation
- Error sound (optional, configurable)
- Haptic feedback (error pattern)
- Red color theme
- Clear error message

**Warning State:**
- Yellow alert icon
- Warning sound (optional)
- Yellow color theme
- Warning message with details

**Loading State:**
- Spinner or progress indicator
- "Validating..." message
- Disable camera/inputs during validation

### Accessibility

**Features:**
- Screen reader support (VoiceOver, TalkBack)
- High contrast mode support
- Large text support
- Color-blind friendly color schemes
- Voice announcements for scan results

**UI Considerations:**
- Large touch targets (minimum 44x44 points)
- Clear visual hierarchy
- Readable fonts and sizes
- Sufficient color contrast

### Error Handling

**Network Errors:**
- Clear error messages
- Retry options
- Offline mode fallback
- Connection status indicator

**Camera Errors:**
- Permission denied: Clear instructions to enable
- Camera unavailable: Manual entry fallback
- Low light: Flash suggestion

**Validation Errors:**
- Clear error messages
- Actionable suggestions
- Retry options

---

## 🚀 DEPLOYMENT & DISTRIBUTION

### Mobile App Distribution

**iOS:**
- App Store distribution
- TestFlight for beta testing
- Enterprise distribution (if applicable)

**Android:**
- Google Play Store distribution
- APK distribution (if applicable)
- Beta testing channels

### Version Management

**Versioning:**
- Semantic versioning (MAJOR.MINOR.PATCH)
- Build numbers for tracking
- Release notes per version

**Update Mechanism:**
- App Store/Play Store updates
- Optional: In-app update prompts
- Backward compatibility considerations

---

## 📋 FUTURE ENHANCEMENTS (Optional)

### Potential Features

**Advanced Analytics:**
- Predictive analytics
- Customer behavior analysis
- Revenue forecasting

**Integration Features:**
- Third-party ticket system integration
- Payment gateway integration
- CRM system integration

**Enhanced Security:**
- Biometric authentication (Face ID, Touch ID)
- Two-factor authentication (2FA)
- Blockchain-based ticket verification

**Additional Capabilities:**
- Photo capture on scan (for verification)
- Voice notes on scans
- Custom scan workflows
- Multi-language support

---

## 📞 SUPPORT & MAINTENANCE

### Support Features

**In-App Support:**
- Help center/FAQ
- Contact support button
- Feedback form
- Bug reporting

**Documentation:**
- User guide
- Admin guide
- API documentation (if applicable)
- Troubleshooting guide

### Maintenance

**Regular Updates:**
- Bug fixes
- Security patches
- Feature enhancements
- Performance optimizations

**Monitoring:**
- App crash reporting
- Performance monitoring
- Usage analytics
- Error tracking

---

## 📄 APPENDIX

### Database Tables Reference

**Primary Tables:**
- `tickets`: Ticket records with secure tokens
- `qr_tickets`: Denormalized QR ticket registry
- `scans` (or `ticket_scans`): Scan records and audit trail
- `orders`: Order information linked to tickets
- `order_passes`: Pass type information per order
- `events`: Event information
- `ambassadors`: Ambassador/user information

### API Endpoints Reference

**Main Endpoint:**
- `POST /api/validate-ticket`: Validate ticket and record scan

**Additional Endpoints (if needed):**
- `GET /api/events`: List active events
- `GET /api/scans`: Get scan history
- `GET /api/statistics`: Get scanning statistics
- `POST /api/scan-sync`: Sync offline scans

### Glossary

**Terms:**
- **Secure Token**: UUID v4 value encoded in QR code
- **Scan Result**: Validation outcome (valid/invalid/duplicate/etc.)
- **Ambassador**: Event staff member who scans tickets
- **Admin**: System administrator with full access
- **Offline Queue**: Locally stored scans waiting for sync
- **Scan Location**: Physical location where scan occurred (e.g., "Main Entrance")

---

**End of Specification**

This document serves as the complete specification for the Scan App. All features, flows, and technical requirements are documented here for development reference.
