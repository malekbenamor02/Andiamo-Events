-- Admin / super_admin attribution for application reviews and manual online payment_status changes.

ALTER TABLE public.ambassador_applications
  ADD COLUMN IF NOT EXISTS reviewed_by_admin_id UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT;

COMMENT ON COLUMN public.ambassador_applications.reviewed_by_admin_id IS 'Admin who approved or rejected this application.';
COMMENT ON COLUMN public.ambassador_applications.reviewed_at IS 'When the application was approved or rejected.';
COMMENT ON COLUMN public.ambassador_applications.reviewed_by_name IS 'Snapshot of admin display name at review time (for admin UI without joining admins).';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status_set_by UUID REFERENCES public.admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_status_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status_set_by_name TEXT;

COMMENT ON COLUMN public.orders.payment_status_set_by IS 'Admin who last set payment_status manually (online orders).';
COMMENT ON COLUMN public.orders.payment_status_set_at IS 'When payment_status was last set manually by an admin.';
COMMENT ON COLUMN public.orders.payment_status_set_by_name IS 'Snapshot of admin display name when payment_status was set manually.';
