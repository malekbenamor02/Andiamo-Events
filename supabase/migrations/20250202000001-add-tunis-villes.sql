-- Add villes (neighborhoods) for Tunis
-- These are the neighborhoods/districts that belong to Tunis city

-- Insert villes for Tunis
INSERT INTO public.villes (name, city_id)
SELECT 
  ville_name,
  (SELECT id FROM public.cities WHERE name = 'Tunis')
FROM (VALUES
  ('Aouina'),
  ('Ariana'),
  ('Bardo'),
  ('Carthage'),
  ('Ennasser/Ghazela'),
  ('Ezzahra/Boumhel'),
  ('Gammarth'),
  ('Jardin de Carthage'),
  ('Megrine/Rades'),
  ('Menzah 7/8/9'),
  ('Mourouj'),
  ('Soukra')
) AS v(ville_name)
ON CONFLICT (name, city_id) DO NOTHING;

-- Verify the insertions
SELECT 
  c.name as city,
  v.name as ville
FROM public.villes v
JOIN public.cities c ON v.city_id = c.id
WHERE c.name = 'Tunis'
ORDER BY v.name;
