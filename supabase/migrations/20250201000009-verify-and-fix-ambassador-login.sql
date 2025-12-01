-- Verify and fix ambassador login issues
-- This migration checks if ambassadors exist and updates their passwords correctly

-- First, check which ambassadors exist
SELECT 
  phone,
  full_name,
  ville,
  status,
  LENGTH(password) as password_length,
  LEFT(password, 10) as password_preview
FROM public.ambassadors
WHERE phone = '90234567'
  OR phone IN ('20123456', '20234567', '20345678', '20456789', '20567890', '20678901',
               '20789012', '20890123', '20901234', '50123456', '50234567', '50345678',
               '50456789', '50567890', '50678901', '50789012', '50890123', '50901234',
               '90123456', '90234567', '90345678', '90456789', '90567890', '90678901',
               '90789012', '90890123')
ORDER BY phone;

-- Update all test ambassadors with correct password hash
-- Password: "test123"
-- Correct bcryptjs hash: $2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.
UPDATE public.ambassadors
SET 
  password = $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$,
  status = 'approved',  -- Ensure status is approved
  updated_at = NOW()
WHERE phone IN (
  '20123456', '20234567', '20345678', '20456789', '20567890', '20678901',
  '20789012', '20890123', '20901234', '50123456', '50234567', '50345678',
  '50456789', '50567890', '50678901', '50789012', '50890123', '50901234',
  '90123456', '90234567', '90345678', '90456789', '90567890', '90678901',
  '90789012', '90890123'
);

-- Verify the specific ambassador you're trying to login with
SELECT 
  phone,
  full_name,
  ville,
  status,
  CASE 
    WHEN password = $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$ THEN 'Password is correct'
    ELSE 'Password needs update'
  END as password_status,
  city
FROM public.ambassadors
WHERE phone = '90234567';




