-- Add test ambassadors for all Sousse villes (2 ambassadors per ville)
-- Password for all test ambassadors: "test123"
-- Using bcrypt hash compatible with bcryptjs
-- This hash is for password "test123" and works with bcryptjs library used in the application

-- If passwords don't work, you can reset them through the admin panel

-- Insert test ambassadors for each ville
-- Ville 1: Sahloul
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Ahmed Ben Ali', '20123456', 'ahmed.sahloul1@test.com', 'Sousse', 'Sahloul', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Fatima Trabelsi', '20234567', 'fatima.sahloul1@test.com', 'Sousse', 'Sahloul', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 2: Khezama
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Mohamed Khelifi', '20345678', 'mohamed.khezama1@test.com', 'Sousse', 'Khezama', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Salma Hammami', '20456789', 'salma.khezama1@test.com', 'Sousse', 'Khezama', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 3: Hammam-Sousse
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Youssef Bouslama', '20567890', 'youssef.hammam1@test.com', 'Sousse', 'Hammam-Sousse', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Aicha Mezzi', '20678901', 'aicha.hammam1@test.com', 'Sousse', 'Hammam-Sousse', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 4: Jawhara
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Karim Jebali', '20789012', 'karim.jawhara1@test.com', 'Sousse', 'Jawhara', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Nour Ben Ammar', '20890123', 'nour.jawhara1@test.com', 'Sousse', 'Jawhara', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 5: Msaken
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Omar Fadhel', '20901234', 'omar.msaken1@test.com', 'Sousse', 'Msaken', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Hiba Ksouri', '50123456', 'hiba.msaken1@test.com', 'Sousse', 'Msaken', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 6: Kalâa Kebira
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Tarek Bouazizi', '50234567', 'tarek.kalaa1@test.com', 'Sousse', 'Kalâa Kebira', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Lina Gharbi', '50345678', 'lina.kalaa1@test.com', 'Sousse', 'Kalâa Kebira', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 7: Kalâa Seghira
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Walid Nasri', '50456789', 'walid.kalaa2@test.com', 'Sousse', 'Kalâa Seghira', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Sana Mansouri', '50567890', 'sana.kalaa2@test.com', 'Sousse', 'Kalâa Seghira', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 8: Akouda
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Bilel Chaabane', '50678901', 'bilel.akouda1@test.com', 'Sousse', 'Akouda', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Rim Ben Youssef', '50789012', 'rim.akouda1@test.com', 'Sousse', 'Akouda', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 9: Hergla
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Anis Mahjoub', '50890123', 'anis.hergla1@test.com', 'Sousse', 'Hergla', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Mariem Zaidi', '50901234', 'mariem.hergla1@test.com', 'Sousse', 'Hergla', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 10: Bouhsina
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Hamza Khelil', '90123456', 'hamza.bouhsina1@test.com', 'Sousse', 'Bouhsina', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Ines Bouslama', '90234567', 'ines.bouhsina1@test.com', 'Sousse', 'Bouhsina', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 11: Sidi Abdelhamid
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Zied Marzouk', '90345678', 'zied.sidi1@test.com', 'Sousse', 'Sidi Abdelhamid', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Yasmine Fadhel', '90456789', 'yasmine.sidi1@test.com', 'Sousse', 'Sidi Abdelhamid', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 12: Sidi Bou Ali
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Mehdi Ben Salah', '90567890', 'mehdi.sidi2@test.com', 'Sousse', 'Sidi Bou Ali', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Sarra Ksibi', '90678901', 'sarra.sidi2@test.com', 'Sousse', 'Sidi Bou Ali', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Ville 13: Enfidha
INSERT INTO public.ambassadors (full_name, phone, email, city, ville, password, status, commission_rate, created_at, updated_at)
VALUES 
  ('Rami Ben Amor', '90789012', 'rami.enfidha1@test.com', 'Sousse', 'Enfidha', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW()),
  ('Leila Hamdi', '90890123', 'leila.enfidha1@test.com', 'Sousse', 'Enfidha', $hash$2b$10$oVIX9u54hhO28EDTfVIwpOps9DqAKMZu3hHzu9nM9Nr0AONuxxRn.$hash$, 'approved', 10.0, NOW(), NOW())
ON CONFLICT (phone) DO NOTHING;

-- Verify the insertions
SELECT 
  ville,
  COUNT(*) as ambassador_count,
  STRING_AGG(full_name, ', ') as ambassadors
FROM public.ambassadors
WHERE ville IN ('Sahloul', 'Khezama', 'Hammam-Sousse', 'Jawhara', 'Msaken', 'Kalâa Kebira', 'Kalâa Seghira', 'Akouda', 'Hergla', 'Bouhsina', 'Sidi Abdelhamid', 'Sidi Bou Ali', 'Enfidha')
  AND status = 'approved'
GROUP BY ville
ORDER BY ville;
