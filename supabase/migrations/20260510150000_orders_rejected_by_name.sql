-- Snapshot of rejecting admin display name on orders (COD admin rejection UI; avoids relying only on admins FK embed).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rejected_by_name TEXT;

COMMENT ON COLUMN public.orders.rejected_by_name IS 'Snapshot of admin name/email at rejection time (shown in admin order activity when join to admins is empty).';
