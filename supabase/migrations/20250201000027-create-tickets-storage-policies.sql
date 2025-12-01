-- Storage policies for tickets bucket
-- 
-- ⚠️ IMPORTANT: This SQL file cannot be run directly due to permission restrictions.
-- Storage policies on storage.objects require owner privileges that SQL migrations don't have.
-- 
-- You MUST create these policies via the Supabase Dashboard UI:
-- 1. Go to Storage > tickets bucket > Policies tab
-- 2. Click "New Policy" for each policy below
-- 3. Or see STORAGE_POLICIES_SETUP.md for detailed step-by-step instructions
--
-- The policies are documented below for reference:

-- Drop existing policies if they exist (to allow re-running this migration)
DROP POLICY IF EXISTS "Public can view ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update ticket QR codes" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete ticket QR codes" ON storage.objects;

-- Policy 1: Public can view ticket QR codes (for email display and verification)
CREATE POLICY "Public can view ticket QR codes" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'tickets');

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

-- Add comments for documentation
COMMENT ON POLICY "Public can view ticket QR codes" ON storage.objects IS 'Allows public read access to ticket QR code images so they can be displayed in emails and verified at events';
COMMENT ON POLICY "Service role can upload ticket QR codes" ON storage.objects IS 'Allows service role to upload ticket QR code images from the backend';
COMMENT ON POLICY "Service role can update ticket QR codes" ON storage.objects IS 'Allows service role to update ticket QR code images';
COMMENT ON POLICY "Service role can delete ticket QR codes" ON storage.objects IS 'Allows service role to delete ticket QR code images';

