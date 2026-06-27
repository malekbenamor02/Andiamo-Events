-- Storage security remediation: private sensitive buckets, remove anon write/delete on public marketing buckets.
-- Apply AFTER deploying code that uses /api/tickets/qr/:token and server-side career uploads.
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Bucket visibility + limits
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/png']::text[]
WHERE id = 'tickets';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]::text[]
WHERE id = 'career-documents';

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm'
  ]::text[]
WHERE id = 'images';

UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm'
  ]::text[]
WHERE id = 'hero-images';

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'application/pdf']::text[]
WHERE id = 'academy-payment-proofs';

UPDATE storage.buckets
SET public = false
WHERE id = 'events';

-- ---------------------------------------------------------------------------
-- 2) Drop dangerous / anon write policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations for images" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public can delete hero images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload hero images" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload career documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view career documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload hero images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete hero images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload career documents" ON storage.objects;
DROP POLICY IF EXISTS "Public can view ticket QR codes" ON storage.objects;

-- ---------------------------------------------------------------------------
-- 3) Service role policies for private buckets (tickets legacy objects; career docs; academy proofs)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can upload ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to tickets 1d5g1yf_1" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to tickets 1d5g1yf_2" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to tickets 1d5g1yf_3" ON storage.objects;

CREATE POLICY "Service role can upload ticket QR codes" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'tickets' AND auth.role() = 'service_role');

CREATE POLICY "Service role can update ticket QR codes" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'tickets' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'tickets' AND auth.role() = 'service_role');

CREATE POLICY "Service role can delete ticket QR codes" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'tickets' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manage career documents" ON storage.objects;
CREATE POLICY "Service role manage career documents" ON storage.objects
  FOR ALL
  USING (bucket_id = 'career-documents' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'career-documents' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manage academy payment proofs" ON storage.objects;
CREATE POLICY "Service role manage academy payment proofs" ON storage.objects
  FOR ALL
  USING (bucket_id = 'academy-payment-proofs' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'academy-payment-proofs' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manage marketing images" ON storage.objects;
CREATE POLICY "Service role manage marketing images" ON storage.objects
  FOR ALL
  USING (bucket_id = 'images' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'images' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manage hero images" ON storage.objects;
CREATE POLICY "Service role manage hero images" ON storage.objects
  FOR ALL
  USING (bucket_id = 'hero-images' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'hero-images' AND auth.role() = 'service_role');

-- No broad anon/authenticated write policies remain on storage.objects for public buckets.
