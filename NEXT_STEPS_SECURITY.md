# Next Steps After Adding FLOUCI_WEBHOOK_SECRET

## ✅ What You've Done
- Added `FLOUCI_WEBHOOK_SECRET` to your `.env` file

## 📋 Next Steps

### Step 1: Run Database Migration (REQUIRED)
The security audit logs table needs to be created:

```bash
# If using Supabase CLI
supabase migration up

# Or manually run the SQL file in Supabase dashboard:
# supabase/migrations/20250221000000-create-security-audit-logs.sql
```

**Why:** This creates the `security_audit_logs` table that stores all security events.

---

### Step 2: Verify Configuration
Check if all security settings are configured:

```bash
npm run security:check
```

This will show you:
- ✅ What's configured
- ⚠️ What's recommended
- ℹ️ What's optional

---

### Step 3: Test Security Features

#### Quick Test (Automated)
```bash
node tests/test-security.js
```

#### Manual Testing
See `tests/security-tests.md` for detailed test instructions.

**Key Tests:**
1. **Webhook Signature** - Try sending a webhook with invalid signature
2. **Rate Limiting** - Make 21 requests to QR code endpoint
3. **Order Verification** - Try generating tickets for unpaid order
4. **CAPTCHA** - Try ticket generation without CAPTCHA token

---

### Step 4: Verify Security Audit Logs
After testing, check the logs:

```sql
-- View recent security events
SELECT * FROM security_audit_logs 
ORDER BY created_at DESC 
LIMIT 20;

-- View by event type
SELECT event_type, COUNT(*) as count, MAX(created_at) as last_occurrence
FROM security_audit_logs
GROUP BY event_type
ORDER BY count DESC;
```

---

### Step 5: Monitor in Production

Once deployed:

1. **Check Security Alerts:**
   - If `SECURITY_ALERT_EMAIL` is set, you'll receive email alerts for suspicious activity
   - Check `security_audit_logs` table regularly

2. **Review Logs Weekly:**
   ```sql
   -- Weekly security review
   SELECT 
     event_type,
     COUNT(*) as occurrences,
     COUNT(DISTINCT ip_address) as unique_ips,
     MAX(created_at) as last_occurrence
   FROM security_audit_logs
   WHERE created_at > NOW() - INTERVAL '7 days'
   GROUP BY event_type
   ORDER BY occurrences DESC;
   ```

3. **Monitor Suspicious Activity:**
   ```sql
   -- Check for suspicious activity alerts
   SELECT * FROM security_audit_logs
   WHERE event_type = 'suspicious_activity_alert'
   ORDER BY created_at DESC;
   ```

---

## 🔍 How Webhook Signature Works Now

With `FLOUCI_WEBHOOK_SECRET` set:

1. **Flouci sends webhook** → Your server receives it
2. **Signature check** → If Flouci sends a signature header, we verify it
3. **Payment verification** → We still verify with Flouci API (primary security)
4. **Process payment** → If all checks pass

**Note:** Flouci may not send signatures by default. The signature check is an extra layer. The primary security is the API verification.

---

## ✅ Verification Checklist

- [ ] Database migration applied (`security_audit_logs` table exists)
- [ ] `FLOUCI_WEBHOOK_SECRET` added to `.env`
- [ ] Configuration checked: `npm run security:check`
- [ ] Security features tested
- [ ] Security audit logs working (check database)
- [ ] `SECURITY_ALERT_EMAIL` configured (optional but recommended)

---

## 🚨 Important Notes

1. **Webhook Secret is Optional:**
   - The webhook is already secure via API verification
   - Signature is an extra layer (if Flouci supports it)

2. **Primary Security:**
   - Payment verification API call (already implemented)
   - This is the main security mechanism

3. **Testing:**
   - In development, some features are disabled
   - Set `NODE_ENV=production` to test all features

---

## 📞 Need Help?

- Check `tests/security-tests.md` for detailed test instructions
- Review `SECURITY_IMPLEMENTATION_SUMMARY.md` for feature details
- Check server logs for security events
- Review `security_audit_logs` table for audit trail

