# How to Enable Payment Options

## Problem
Payment options are not showing because they're all **disabled by default** in the database.

## Quick Solution (Choose One)

### Option 1: Quick SQL (Fastest - 30 seconds)

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Run this SQL:

```sql
-- Enable Online Payment
UPDATE public.payment_options 
SET enabled = true, updated_at = NOW()
WHERE option_type = 'online';

-- Enable Ambassador Cash Payment
UPDATE public.payment_options 
SET enabled = true, updated_at = NOW()
WHERE option_type = 'ambassador_cash';

-- Optional: Enable External App Payment (configure link first)
-- UPDATE public.payment_options 
-- SET enabled = true, 
--     external_link = 'https://your-payment-app.com',
--     app_name = 'AIO Events',
--     updated_at = NOW()
-- WHERE option_type = 'external_app';
```

3. **Refresh your page** - payment options will appear!

### Option 2: Admin Dashboard (Recommended for ongoing management)

I've created a `PaymentOptionsManager` component. To add it to your admin dashboard:

1. **Open** `src/pages/admin/Dashboard.tsx`
2. **Find the tabs section** (look for `TabsList` and `TabsTrigger`)
3. **Add a new tab** for "Payment Settings" or add it to an existing "Settings" tab
4. **Import the component:**
   ```typescript
   import { PaymentOptionsManager } from '@/components/admin/PaymentOptionsManager';
   ```
5. **Add the tab content:**
   ```tsx
   <TabsTrigger value="payment-settings">
     Payment Settings
   </TabsTrigger>
   
   <TabsContent value="payment-settings">
     <PaymentOptionsManager language={language} />
   </TabsContent>
   ```

### Option 3: Direct Database Update

1. Go to **Supabase Dashboard** → **Table Editor** → `payment_options`
2. Click on each row
3. Toggle `enabled` to `true`
4. Click **Save**

## Verify It Works

After enabling, check:
1. Go to `/pass-purchase?eventId=YOUR_EVENT_ID`
2. Enter customer information
3. Select passes
4. **Payment options should now appear!**

## Current Status

By default, all payment options are **disabled** (`enabled = false`). You need to enable at least one for users to see payment methods.

## What Each Option Does

- **Online Payment** (`online`): Standard online payment (gateway integration pending)
- **External App Payment** (`external_app`): Redirects to external payment app (requires `external_link`)
- **Ambassador Cash Payment** (`ambassador_cash`): Cash payment via ambassador

