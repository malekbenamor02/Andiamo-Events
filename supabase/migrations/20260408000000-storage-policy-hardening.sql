-- Storage policy hardening for media buckets used by client-side Supabase uploads.
-- Goal:
-- 1) Remove broad SELECT policies that enable listing all files in public buckets.
-- 2) Keep only the minimum INSERT/DELETE policies required by current frontend flow.
--
-- Note: Buckets remain public so direct public URLs still work.

-- HERO IMAGES -----------------------------------------------------------------
DROP POLICY IF EXISTS "Hero images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload hero images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update hero images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete hero images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload hero images" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete hero images" ON storage.objects;

CREATE POLICY "Public can upload hero images" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'hero-images');

CREATE POLICY "Public can delete hero images" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'hero-images');

-- IMAGES (posters/gallery/sponsors/campaign-email) ----------------------------
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete images" ON storage.objects;

CREATE POLICY "Public can upload images" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'images');

CREATE POLICY "Public can delete images" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'images');

-- CAREER DOCUMENTS -------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view career documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload career documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload career documents" ON storage.objects;

CREATE POLICY "Public can upload career documents" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'career-documents');

-- TICKETS ---------------------------------------------------------------------
-- Keep bucket public for direct QR URL access, but remove broad SELECT policy
-- that allows listing all files.
DROP POLICY IF EXISTS "Public can view ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete ticket QR codes" ON storage.objects;

CREATE POLICY "Service role can upload ticket QR codes" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tickets' AND
    auth.role() = 'service_role'
  );

CREATE POLICY "Service role can update ticket QR codes" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'tickets' AND
    auth.role() = 'service_role'
  )
  WITH CHECK (
    bucket_id = 'tickets' AND
    auth.role() = 'service_role'
  );

CREATE POLICY "Service role can delete ticket QR codes" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'tickets' AND
    auth.role() = 'service_role'
  );

