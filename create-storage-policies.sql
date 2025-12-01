-- Storage Policies for Tickets Bucket
-- Copy and paste this entire file into Supabase SQL Editor
-- Note: If you get permission errors, create policies via Dashboard UI instead

-- Policy 2: Service role can upload ticket QR codes
CREATE POLICY "Service role can upload ticket QR codes" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tickets' AND
    auth.role() = 'service_role'
  );

-- Policy 3: Service role can update ticket QR codes
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

-- Policy 4: Service role can delete ticket QR codes
CREATE POLICY "Service role can delete ticket QR codes" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'tickets' AND
    auth.role() = 'service_role'
  );

-- Alternative: Single policy for all operations (uncomment to use instead of policies 2, 3, 4 above)
-- DROP POLICY IF EXISTS "Service role can upload ticket QR codes" ON storage.objects;
-- DROP POLICY IF EXISTS "Service role can update ticket QR codes" ON storage.objects;
-- DROP POLICY IF EXISTS "Service role can delete ticket QR codes" ON storage.objects;
-- 
-- CREATE POLICY "Service role full access to tickets" ON storage.objects
--   FOR ALL
--   USING (
--     bucket_id = 'tickets' AND
--     auth.role() = 'service_role'
--   )
--   WITH CHECK (
--     bucket_id = 'tickets' AND
--     auth.role() = 'service_role'
--   );

