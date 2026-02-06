# Direct QR Tickets (Database Only)

You can add QR tickets **directly in the database**. They will:

- **Be scannable** at the door (scanner looks up by `secure_token` in `qr_tickets`).
- **Not appear** in Orders, Invitations, or any app tabs (no order, no ticket, no invitation).
- **Not be counted** in order totals, ticket counts, or invitation counts.

No application code changes are required.

---

## 1. Run the migration (once)

Apply the migration that adds the `direct_qr` source:

- From project root:  
  `npx supabase db push`  
  or run the SQL in `supabase/migrations/20250902000000-add-direct-qr-tickets-source.sql` in the Supabase SQL Editor.

---

## 2. Insert a direct QR ticket

Insert **only** into `public.qr_tickets`. Do **not** create rows in `orders`, `tickets`, or `order_passes`.

**Required:**

- `secure_token` — **unique** value that will be encoded in the QR code (e.g. `gen_random_uuid()`). The scanner validates by this.
- `source` — `'direct_qr'`
- `payment_method` — one of: `'online'`, `'cod'`, `'external_app'`, `'ambassador_cash'`, `'pos'` (e.g. `'ambassador_cash'`)
- `buyer_name`, `buyer_phone`, `buyer_city` — NOT NULL in schema
- `pass_type` — e.g. `'VIP'`, `'Standard'`
- `pass_price` — numeric, e.g. `0` or the pass price
- `ticket_status` — `'VALID'`
- `generated_at` — e.g. `NOW()`

**Optional but useful for scanner/event:**

- `event_id` — UUID of the event (from `events.id`)
- `event_name`, `event_date`, `event_venue`, `event_city`
- `buyer_email`, `buyer_ville`
- `qr_code_url` — leave NULL if you generate the QR image elsewhere

**Must be NULL for direct_qr:**

- `ticket_id`, `order_id`, `order_pass_id`, `invitation_id`

**Example (Supabase SQL Editor):**

```sql
INSERT INTO public.qr_tickets (
  secure_token,
  source,
  payment_method,
  ticket_id,
  order_id,
  order_pass_id,
  invitation_id,
  buyer_name,
  buyer_phone,
  buyer_city,
  pass_type,
  pass_price,
  ticket_status,
  generated_at,
  event_id,
  event_name,
  event_date
) VALUES (
  gen_random_uuid(),           -- secure_token (use this value in the QR code)
  'direct_qr',
  'ambassador_cash',
  NULL,
  NULL,
  NULL,
  NULL,
  'Guest Name',
  '+1234567890',
  'City',
  'VIP',
  0,
  'VALID',
  NOW(),
  'your-event-uuid-here',      -- from events.id
  'Event Name',
  '2025-02-15 20:00:00+00'
);
```

To get the inserted `secure_token` (to encode in the QR):

```sql
INSERT INTO public.qr_tickets (...)
VALUES (gen_random_uuid(), ...)
RETURNING secure_token;
```

Use that returned `secure_token` as the **exact string** encoded in the QR code (same as the app does). Anyone scanning that QR will be validated against `qr_tickets` by `secure_token`.

---

## 3. Summary

| What                | Action |
|---------------------|--------|
| **Database**        | Run migration `20250902000000-add-direct-qr-tickets-source.sql` once. |
| **Add a ticket**     | `INSERT` into `qr_tickets` only, with `source = 'direct_qr'` and all link IDs NULL. |
| **QR code**         | Encode the row’s `secure_token` in the QR (same format as normal tickets). |
| **Code**            | No changes; scanner already uses `qr_tickets` by `secure_token`. |

These tickets will not show in Orders, Invitations, or totals; they will only be scannable.
