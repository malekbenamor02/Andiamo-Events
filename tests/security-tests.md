# Security Features Testing Guide

This document provides comprehensive testing instructions for all security features.

## Prerequisites

1. Run the database migration: `supabase/migrations/20250221000000-create-security-audit-logs.sql`
2. Set environment variables in `.env`:
   - `FLOUCI_WEBHOOK_SECRET` (optional but recommended)
   - `FLOUCI_WEBHOOK_IPS` (optional, comma-separated)
   - `SECURITY_ALERT_EMAIL` (optional, for email alerts)
   - `ENABLE_SECURITY_LOGGING=true` (to enable logging in development)

## Test 1: Webhook Signature Verification

### Test 1.1: Valid Signature (if Flouci sends signatures)
```bash
# This test requires FLOUCI_WEBHOOK_SECRET to be set
curl -X POST http://localhost:8081/api/flouci-webhook \
  -H "Content-Type: application/json" \
  -H "x-flouci-signature: <valid_signature>" \
  -d '{"payment_id":"test123","status":"SUCCESS","developer_tracking_id":"order-id"}'
```

### Test 1.2: Invalid Signature
```bash
curl -X POST http://localhost:8081/api/flouci-webhook \
  -H "Content-Type: application/json" \
  -H "x-flouci-signature: invalid_signature_here" \
  -d '{"payment_id":"test123","status":"SUCCESS","developer_tracking_id":"order-id"}'
# Expected: 401 Unauthorized
# Check: security_audit_logs table for 'webhook_signature_failed' event
```

### Test 1.3: Missing Signature (when secret is configured)
```bash
curl -X POST http://localhost:8081/api/flouci-webhook \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"test123","status":"SUCCESS","developer_tracking_id":"order-id"}'
# Expected: Warning logged, but request continues (backward compatibility)
```

### Test 1.4: IP Whitelist (if configured)
```bash
# Set FLOUCI_WEBHOOK_IPS=1.2.3.4 in .env
# Then test from different IP
curl -X POST http://localhost:8081/api/flouci-webhook \
  -H "Content-Type: application/json" \
  -d '{"payment_id":"test123","status":"SUCCESS","developer_tracking_id":"order-id"}'
# Expected: 403 Forbidden if IP not whitelisted
# Check: security_audit_logs table for 'webhook_ip_blocked' event
```

## Test 2: Rate Limiting on QR Code Endpoint

### Test 2.1: Normal Access
```bash
# Access QR code URL normally (should work)
curl http://localhost:8081/api/qr-codes/valid-access-token-here
# Expected: 200 OK or appropriate response
```

### Test 2.2: Rate Limit Exceeded
```bash
# Make 21 requests rapidly (limit is 20 per 15 minutes)
for i in {1..21}; do
  curl http://localhost:8081/api/qr-codes/test-token-$i
  echo "Request $i"
done
# Expected: Last request returns 429 Too Many Requests
# Check: security_audit_logs table for 'rate_limit_exceeded' event
```

## Test 3: Order Ownership Verification

### Test 3.1: Valid Paid Order
```bash
# Use a real order ID that is PAID
curl -X POST http://localhost:8081/api/generate-tickets-for-order \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "orderId": "valid-paid-order-id",
    "recaptchaToken": "localhost-bypass-token"
  }'
# Expected: 200 OK, tickets generated
```

### Test 3.2: Invalid Order ID
```bash
curl -X POST http://localhost:8081/api/generate-tickets-for-order \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "orderId": "non-existent-order-id",
    "recaptchaToken": "localhost-bypass-token"
  }'
# Expected: 404 Not Found
# Check: security_audit_logs table for 'invalid_order_access' event
```

### Test 3.3: Unpaid Order
```bash
# Use an order ID that is not PAID
curl -X POST http://localhost:8081/api/generate-tickets-for-order \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "orderId": "unpaid-order-id",
    "recaptchaToken": "localhost-bypass-token"
  }'
# Expected: 403 Forbidden
# Check: security_audit_logs table for 'unauthorized_ticket_generation' event
```

## Test 4: Rate Limiting on SMS Endpoints

### Test 4.1: Normal SMS Request
```bash
curl -X POST http://localhost:8081/api/send-order-confirmation-sms \
  -H "Content-Type: application/json" \
  -d '{"orderId": "valid-order-id"}'
# Expected: 200 OK or appropriate response
```

### Test 4.2: Rate Limit Exceeded
```bash
# Make 11 requests rapidly (limit is 10 per hour)
for i in {1..11}; do
  curl -X POST http://localhost:8081/api/send-order-confirmation-sms \
    -H "Content-Type: application/json" \
    -d "{\"orderId\": \"test-order-$i\"}"
  echo "Request $i"
done
# Expected: Last request returns 429 Too Many Requests
# Check: security_audit_logs table for 'rate_limit_exceeded' event
```

## Test 5: Request Origin Validation

### Test 5.1: Valid Origin (in production)
```bash
# Set NODE_ENV=production
curl -X POST http://localhost:8081/api/generate-tickets-for-order \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "orderId": "valid-order-id",
    "recaptchaToken": "localhost-bypass-token"
  }'
# Expected: Request proceeds if origin is in ALLOWED_ORIGINS
```

### Test 5.2: Invalid Origin (in production)
```bash
# Set NODE_ENV=production
curl -X POST http://localhost:8081/api/generate-tickets-for-order \
  -H "Content-Type: application/json" \
  -H "Origin: http://malicious-site.com" \
  -d '{
    "orderId": "valid-order-id",
    "recaptchaToken": "localhost-bypass-token"
  }'
# Expected: 403 Forbidden
# Check: security_audit_logs table for 'origin_validation_failed' event
```

## Test 6: Monitoring/Alerting System

### Test 6.1: Trigger Suspicious Activity
```bash
# Make multiple failed webhook signature attempts
for i in {1..6}; do
  curl -X POST http://localhost:8081/api/flouci-webhook \
    -H "Content-Type: application/json" \
    -H "x-flouci-signature: invalid_signature" \
    -d '{"payment_id":"test","status":"SUCCESS","developer_tracking_id":"test"}'
done
# Expected: After 3-5 attempts, check:
# 1. security_audit_logs table for 'suspicious_activity_alert' event
# 2. Email sent to SECURITY_ALERT_EMAIL (if configured)
# 3. Console log: "🚨 SUSPICIOUS ACTIVITY ALERT"
```

## Test 7: CAPTCHA on Public Endpoints

### Test 7.1: Missing CAPTCHA Token
```bash
curl -X POST http://localhost:8081/api/generate-tickets-for-order \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"orderId": "valid-order-id"}'
# Expected: 400 Bad Request - "reCAPTCHA verification required"
```

### Test 7.2: Invalid CAPTCHA Token
```bash
curl -X POST http://localhost:8081/api/generate-tickets-for-order \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "orderId": "valid-order-id",
    "recaptchaToken": "invalid-token"
  }'
# Expected: 400 Bad Request - "reCAPTCHA verification failed"
# Check: security_audit_logs table for 'captcha_verification_failed' event
```

### Test 7.3: Valid CAPTCHA (localhost bypass)
```bash
curl -X POST http://localhost:8081/api/generate-tickets-for-order \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "orderId": "valid-paid-order-id",
    "recaptchaToken": "localhost-bypass-token"
  }'
# Expected: 200 OK (if order is valid and paid)
```

## Test 8: Security Audit Logging

### Test 8.1: Verify Logging is Working
```sql
-- Check security_audit_logs table after running any of the above tests
SELECT * FROM security_audit_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

### Test 8.2: Check Log Details
```sql
-- View detailed logs for a specific event type
SELECT 
  event_type,
  endpoint,
  ip_address,
  severity,
  details,
  created_at
FROM security_audit_logs
WHERE event_type = 'rate_limit_exceeded'
ORDER BY created_at DESC;
```

### Test 8.3: Check Suspicious Activity Alerts
```sql
-- View all suspicious activity alerts
SELECT * FROM security_audit_logs
WHERE event_type = 'suspicious_activity_alert'
ORDER BY created_at DESC;
```

## Verification Checklist

After running all tests, verify:

- [ ] Webhook signature verification logs events
- [ ] Rate limiting works on QR code endpoint
- [ ] Rate limiting works on SMS endpoints
- [ ] Order ownership verification blocks unpaid orders
- [ ] Origin validation works in production mode
- [ ] Suspicious activity alerts are triggered
- [ ] CAPTCHA verification works for public endpoints
- [ ] All security events are logged to security_audit_logs table
- [ ] Email alerts are sent (if SECURITY_ALERT_EMAIL is configured)

## Notes

- In development mode, some features are disabled (rate limiting, origin validation)
- Set `NODE_ENV=production` or `ENABLE_SECURITY_LOGGING=true` to test all features
- Use `localhost-bypass-token` for CAPTCHA in development
- Check server console logs for security alerts and warnings

