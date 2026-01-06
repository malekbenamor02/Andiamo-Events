# Secure QR Code SMS Implementation

## Overview

This system implements secure, one-time access QR code URLs sent via SMS to customers. URLs expire on first access or based on event date.

## Features Implemented

✅ **URL expires on first successful access**
✅ **Show QR code immediately when accessed**
✅ **Allow download/save of QR code**
✅ **Log all access attempts**
✅ **Event-based fallback expiration**

## How It Works

### 1. Ticket Generation
- When tickets are generated, each ticket gets:
  - `secure_token`: Used for QR code generation (for scanning at event)
  - `secure_access_token`: Unique token for secure URL access (for SMS)
  - `url_expires_at`: Event date + 1 day (or 30 days if no event date)
  - `url_accessed`: false (initially)
  - `url_accessed_at`: null (initially)

### 2. SMS Sending
- When SMS is sent to customer:
  - System fetches all tickets for the order
  - Builds secure URLs: `{API_URL}/api/qr-code/{secure_access_token}`
  - Includes URLs in SMS message
  - Only includes unaccessed tickets

### 3. URL Access
- Customer clicks URL in SMS
- System validates:
  - Token exists
  - URL not already accessed
  - Not expired (event date + 1 day)
- If valid:
  - Marks URL as accessed
  - Logs successful access
  - Shows QR code with download option
- If invalid:
  - Logs failed access attempt
  - Shows appropriate error message

## Database Changes

### New Fields in `tickets` Table
- `secure_access_token`: Unique token for URL access
- `url_accessed`: Boolean flag
- `url_accessed_at`: Timestamp of first access
- `url_expires_at`: Expiration date (event date + 1 day)

### New Table: `qr_code_access_logs`
- Logs all access attempts (successful and failed)
- Tracks: IP address, user agent, access result, error messages

## API Endpoints

### GET `/api/qr-code/:accessToken`
- **Purpose**: Secure QR code access endpoint
- **Access**: Public (no auth required)
- **Behavior**:
  - Validates access token
  - Checks if already accessed
  - Checks expiration
  - Logs access attempt
  - Serves QR code with download option
  - Marks URL as accessed

### POST `/api/send-order-confirmation-sms`
- **Updated**: Now includes secure QR code URLs
- **Behavior**:
  - Fetches tickets with secure access tokens
  - Builds secure URLs
  - Includes URLs in SMS message

## Security Features

1. **One-Time Access**: URL expires on first access
2. **Event-Based Expiration**: URL expires on event date + 1 day
3. **Access Logging**: All attempts logged for security monitoring
4. **Token Validation**: Secure tokens prevent unauthorized access
5. **Error Handling**: Clear error messages for invalid/expired URLs

## SMS Message Format

```
Votre commande #123 est confirmée!
Passes: 2× VIP (150 DT)
Total: 300 DT
Votre ambassadeur: John Doe
Téléphone: 21612345678
Il vous contactera bientôt.

🎫 Vos QR Codes:
Ticket 1: https://andiamo-events.tn/api/qr-code/abc123...
Ticket 2: https://andiamo-events.tn/api/qr-code/def456...

⚠️ Chaque lien ne peut être utilisé qu'une seule fois.
```

## Access Logging

All access attempts are logged in `qr_code_access_logs` table:
- **success**: URL accessed successfully
- **expired**: URL expired (event date passed)
- **already_accessed**: URL already used
- **invalid_token**: Token doesn't exist
- **event_expired**: Event date + 1 day passed

## Migration

Run the migration to add new fields:
```sql
-- File: supabase/migrations/20250220000000-add-secure-qr-access.sql
```

## Testing

1. Generate tickets for an order
2. Send SMS to customer
3. Click URL in SMS
4. Verify QR code is shown
5. Verify URL cannot be accessed again
6. Check access logs in database

## Configuration

Set these environment variables:
- `VITE_API_URL` or `API_URL`: Base URL for secure links (default: `https://andiamo-events.tn`)

## Notes

- URLs are one-time use only
- Expiration is based on event date + 1 day
- All access attempts are logged
- QR codes can be downloaded from the access page
- Mobile devices auto-trigger download

