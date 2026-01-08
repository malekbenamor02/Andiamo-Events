-- Ensure Bardo exists for Tunis
-- This is a fix for the "Invalid ville: Bardo does not exist for city Tunis" error
-- Safe to run multiple times (idempotent)

INSERT INTO public.villes (name, city_id)
SELECT 
  'Bardo',
  (SELECT id FROM public.cities WHERE name = 'Tunis')
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.villes 
  WHERE name = 'Bardo' 
  AND city_id = (SELECT id FROM public.cities WHERE name = 'Tunis')
);

-- Also ensure all other Tunis villes from the migration exist
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
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.villes 
  WHERE name = v.ville_name 
  AND city_id = (SELECT id FROM public.cities WHERE name = 'Tunis')
);
