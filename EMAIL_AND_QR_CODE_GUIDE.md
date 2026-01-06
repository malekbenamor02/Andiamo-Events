# Email & QR Code System Guide

## Overview

This system automatically generates QR code tickets and sends them via email when a payment is completed successfully.

## How It Works

### 1. Payment Flow

1. Customer completes payment via Flouci
2. Flouci webhook triggers (`/api/flouci-webhook`)
3. Order status updated to `PAID`
4. **Automatic ticket generation** starts
5. **Email sent** with QR codes to customer

### 2. QR Code Generation

**Process:**
- Each ticket gets a unique UUID (secure token)
- UUID is converted to QR code image (PNG, 300x300px)
- QR code uploaded to Supabase Storage
- Public URL saved to ticket record

**Technical Details:**
- **Library**: `qrcode` (Node.js)
- **Storage**: Supabase Storage bucket `tickets`
- **Path**: `tickets/{orderId}/{secureToken}.png`
- **Format**: PNG image

### 3. Email Sending

**Template:**
- Matches ambassador email style
- Includes all QR codes grouped by pass type
- Shows order details, passes summary, payment confirmation
- Responsive design with dark mode support

**Configuration Required:**
- `EMAIL_USER` - Your email address
- `EMAIL_PASS` - Your email password
- `EMAIL_HOST` - SMTP server (e.g., `mail.routing.net`)
- `EMAIL_PORT` - SMTP port (usually `587`)

## Testing

### Manual Test Tool

Use the built-in test page:
- **URL**: `http://localhost:8080/test-email.html`
- **Requires**: Admin login
- **Usage**: Enter order ID and click "Generate Tickets & Send Email"

### API Endpoints

**Generate Tickets & Send Email:**
```
POST /api/generate-tickets-for-order
Body: { "orderId": "..." }
Auth: Admin required
```

**Test Email Configuration:**
```
POST /api/test-email
Body: { "to": "your-email@example.com" }
Auth: Admin required
```

## Troubleshooting

### Email Not Sending

**Check Server Logs:**
- Look for: `✅ Email sent successfully!` or `❌ Error sending confirmation email:`
- Verify: `✅ Email service configured`

**Common Issues:**

1. **Email service not configured**
   - **Symptom**: "Email service not configured"
   - **Fix**: Set `EMAIL_USER`, `EMAIL_PASS`, and `EMAIL_HOST` in environment

2. **SMTP authentication failed**
   - **Symptom**: Error code `EAUTH` or `535`
   - **Fix**: Verify email credentials are correct

3. **Email sent but not received**
   - Check spam/junk folder
   - Verify email address in order
   - Check email provider settings

### Check Email Delivery Logs

```sql
SELECT * FROM email_delivery_logs 
WHERE order_id = 'your-order-id' 
ORDER BY created_at DESC;
```

### Check Tickets

```sql
SELECT * FROM tickets 
WHERE order_id = 'your-order-id';
```

## Files

- **Backend**: `server.cjs` - `generateTicketsAndSendEmail()` function
- **Test Tool**: `public/test-email.html` - Manual testing interface
- **Email Template**: Built-in HTML template matching ambassador style

## Summary

✅ **Fully Automated** - No manual intervention needed  
✅ **QR Codes Generated** - Unique code per ticket  
✅ **Email Sent Automatically** - After successful payment  
✅ **Professional Template** - Matches ambassador emails  
✅ **Error Handling** - Comprehensive logging and error messages

