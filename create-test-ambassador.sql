-- Create a test ambassador account for the scanner app
-- Phone: 27169458
-- Password: 1234567890
-- Status: approved

INSERT INTO ambassadors (
  full_name,
  phone,
  password,
  city,
  status,
  commission_rate,
  created_at,
  updated_at
) VALUES (
  'Test Ambassador',
  '27169458',
  '1234567890',
  'Tunis',
  'approved',
  10.00,
  NOW(),
  NOW()
) ON CONFLICT (phone) DO UPDATE SET
  password = EXCLUDED.password,
  status = EXCLUDED.status,
  updated_at = NOW(); 