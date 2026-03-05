-- Storage bucket for career application documents (CV, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('career-documents', 'career-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read (so admins can open CV links)
CREATE POLICY "Public can view career documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'career-documents');

-- Allow authenticated and anon insert for application uploads (candidates upload)
CREATE POLICY "Anyone can upload career documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'career-documents');
