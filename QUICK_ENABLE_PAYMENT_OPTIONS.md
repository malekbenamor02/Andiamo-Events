# Quick Guide: Enable Payment Options

## Problem
Payment options are not showing because they're all disabled by default in the database.

## Solution 1: Quick SQL (Fastest)

Run this in **Supabase SQL Editor**:

```sql
-- Enable Online Payment
UPDATE public.payment_options 
SET enabled = true, updated_at = NOW()
WHERE option_type = 'online';

-- Enable Ambassador Cash Payment
UPDATE public.payment_options 
SET enabled = true, updated_at = NOW()
WHERE option_type = 'ambassador_cash';

-- Enable External App Payment (optional - configure link first)
UPDATE public.payment_options 
SET enabled = true, 
    external_link = 'https://your-payment-app.com',
    app_name = 'AIO Events',
    updated_at = NOW()
WHERE option_type = 'external_app';
```

**Verify:**
```sql
SELECT option_type, enabled, app_name, external_link 
FROM public.payment_options 
ORDER BY option_type;
```

## Solution 2: Admin Dashboard (Recommended)

I've created a `PaymentOptionsManager` component. Add it to your admin dashboard:

1. **Add to Admin Dashboard:**
   - Import: `import { PaymentOptionsManager } from '@/components/admin/PaymentOptionsManager';`
   - Add a new tab/section for "Payment Settings"
   - Render: `<PaymentOptionsManager language={language} />`

2. **Or use the component directly:**
   - Go to admin dashboard
   - Add a new section/tab
   - Include the PaymentOptionsManager component

## Solution 3: Direct Database Update

If you have database access, you can also update directly:
- Go to Supabase Dashboard → Table Editor → `payment_options`
- Click on each row
- Toggle `enabled` to `true`
- Save

## After Enabling

Once enabled, payment options will appear in the PassPurchase page after:
1. Customer enters their information
2. Customer selects passes
3. Payment options section will show enabled options

## Current Status

By default, all payment options are **disabled** (`enabled = false`). You need to enable at least one for users to see payment methods.

