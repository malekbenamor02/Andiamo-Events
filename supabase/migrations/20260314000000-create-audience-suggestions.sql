-- Create audience_suggestions table for public suggestions (events, artists, venues)
CREATE TABLE public.audience_suggestions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('event', 'artist', 'venue')),
    title TEXT NOT NULL,
    details TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.audience_suggestions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit (anonymous insert)
CREATE POLICY "audience_suggestions_insert" ON public.audience_suggestions
  FOR INSERT WITH CHECK (true);

-- Select/update/delete: application-level admin auth (same pattern as contact_messages)
CREATE POLICY "audience_suggestions_select" ON public.audience_suggestions
  FOR SELECT USING (true);

CREATE POLICY "audience_suggestions_update" ON public.audience_suggestions
  FOR UPDATE USING (true);

CREATE POLICY "audience_suggestions_delete" ON public.audience_suggestions
  FOR DELETE USING (true);
