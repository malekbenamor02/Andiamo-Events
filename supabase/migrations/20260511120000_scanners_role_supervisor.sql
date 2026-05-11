-- Scanner vs supervisor role (same portal; supervisor gets extra read APIs in app layer).
ALTER TABLE public.scanners
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'scanner';

ALTER TABLE public.scanners
  DROP CONSTRAINT IF EXISTS scanners_role_check;

ALTER TABLE public.scanners
  ADD CONSTRAINT scanners_role_check
  CHECK (role IN ('scanner', 'supervisor'));

COMMENT ON COLUMN public.scanners.role IS 'scanner: gate only; supervisor: gate + lookup + event-wide scan views.';
