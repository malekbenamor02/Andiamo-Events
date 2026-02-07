-- Create csp_reports table for Content Security Policy violation reports
-- Browsers send these reports when CSP rules are violated (report-uri)

CREATE TABLE IF NOT EXISTS public.csp_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_uri TEXT NOT NULL,
  referrer TEXT,
  violated_directive TEXT NOT NULL,
  effective_directive TEXT,
  original_policy TEXT,
  blocked_uri TEXT NOT NULL,
  source_file TEXT,
  line_number INTEGER,
  column_number INTEGER,
  status_code INTEGER,
  raw_report JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_csp_reports_created_at ON public.csp_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_csp_reports_blocked_uri ON public.csp_reports(blocked_uri);
CREATE INDEX IF NOT EXISTS idx_csp_reports_violated_directive ON public.csp_reports(violated_directive);

ALTER TABLE public.csp_reports ENABLE ROW LEVEL SECURITY;

-- Allow service role to insert (API uses service role for unauthenticated report submissions)
CREATE POLICY "Allow service role insert csp_reports" ON public.csp_reports
  FOR INSERT WITH CHECK (true);

-- Allow admins to select (API enforces admin auth)
CREATE POLICY "Allow select csp_reports" ON public.csp_reports
  FOR SELECT USING (true);

COMMENT ON TABLE public.csp_reports IS 'Content Security Policy violation reports from browsers';
