-- Backfill ville in ambassador_applications from corresponding ambassadors
-- This updates applications that have city = 'Sousse' but no ville
-- by copying the ville from the corresponding ambassador record

UPDATE public.ambassador_applications app
SET ville = amb.ville
FROM public.ambassadors amb
WHERE app.city = 'Sousse'
  AND app.ville IS NULL
  AND (app.phone_number = amb.phone OR (app.email IS NOT NULL AND app.email = amb.email))
  AND amb.ville IS NOT NULL;

-- Also update applications that have ville in ambassadors but not in applications
-- for cases where ambassador was created/updated but application wasn't
UPDATE public.ambassador_applications app
SET ville = amb.ville
FROM public.ambassadors amb
WHERE app.city = 'Sousse'
  AND (app.ville IS NULL OR app.ville = '')
  AND amb.ville IS NOT NULL
  AND amb.ville != ''
  AND (
    app.phone_number = amb.phone 
    OR (app.email IS NOT NULL AND app.email = amb.email AND app.email != '')
  );

-- Verify the update
SELECT 
  city,
  COUNT(*) as total,
  COUNT(ville) as with_ville,
  COUNT(*) - COUNT(ville) as without_ville
FROM public.ambassador_applications
WHERE city = 'Sousse'
GROUP BY city;




