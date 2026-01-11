# Troubleshooting: qr_tickets Table Empty

## 🔍 Diagnostic Steps

### Step 1: Check if Table Exists
Run in Supabase SQL Editor:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'qr_tickets'
);
```

**Expected:** `true`

**If false:** Run migration `20250101000000-create-qr-tickets-table.sql`

---

### Step 2: Check Constraint
Run in Supabase SQL Editor:
```sql
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'qr_tickets_ticket_status_check';
```

**Expected:** Constraint should allow: `'VALID', 'USED', 'INVALID', 'WRONG_EVENT', 'EXPIRED'`

**If wrong:** Run migration `20250102000000-fix-qr-tickets-constraint.sql`

---

### Step 3: Check RLS Policies
Run in Supabase SQL Editor:
```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'qr_tickets';
```

**Expected:** Should have:
- `Public can read QR tickets by token` (SELECT)
- `Allow service role inserts` (INSERT)
- `Allow service role updates` (UPDATE)

**If missing:** Run migration `20250102000001-fix-qr-tickets-rls-for-inserts.sql`

---

### Step 4: Check Service Role Key
Verify in your environment:
- `SUPABASE_SERVICE_ROLE_KEY` is set
- Code uses `supabaseService` client (not just `supabase`)

**Check in code:**
```javascript
const dbClient = supabaseService || supabase;
console.log('Using service role:', !!supabaseService);
```

---

### Step 5: Check Error Logs
After generating a ticket, check server logs for:
- `✅ QR Registry populated for ticket {secure_token}` (SUCCESS)
- `❌ QR Registry Insert Error` (FAILURE - will show exact error)

**Common errors:**
- `new row violates row-level security policy` → RLS blocking insert
- `violates check constraint` → Constraint mismatch
- `relation "qr_tickets" does not exist` → Table not created
- `column "xxx" does not exist` → Schema mismatch

---

## 🛠️ Quick Fixes

### Fix 1: Run All Migrations
Run these migrations in order:
1. `20250101000000-create-qr-tickets-table.sql`
2. `20250102000000-fix-qr-tickets-constraint.sql`
3. `20250102000001-fix-qr-tickets-rls-for-inserts.sql`

### Fix 2: Verify Service Role Key
Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in your environment.

### Fix 3: Test Insert Manually
Run in Supabase SQL Editor (as service role):
```sql
INSERT INTO public.qr_tickets (
  secure_token,
  ticket_id,
  order_id,
  source,
  payment_method,
  buyer_name,
  buyer_phone,
  buyer_city,
  order_pass_id,
  pass_type,
  pass_price,
  ticket_status,
  generated_at
) VALUES (
  'test-token-123',
  (SELECT id FROM tickets LIMIT 1),
  (SELECT id FROM orders LIMIT 1),
  'platform_online',
  'online',
  'Test Buyer',
  '1234567890',
  'Test City',
  (SELECT id FROM order_passes LIMIT 1),
  'Standard',
  100.00,
  'VALID',
  NOW()
);
```

**If this fails:** Check the exact error message.

---

## 📋 Verification Checklist

- [ ] Table `qr_tickets` exists
- [ ] Constraint allows `'VALID'` status
- [ ] RLS policies allow service role inserts
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] Code uses `supabaseService` client
- [ ] Error logs show success or specific error
- [ ] Manual insert test works

---

## 🎯 Next Steps

1. **Check server logs** after generating a ticket
2. **Look for** `✅ QR Registry populated` or `❌ QR Registry Insert Error`
3. **Share the error message** if inserts are failing
4. **Verify migrations** have been run in Supabase dashboard
