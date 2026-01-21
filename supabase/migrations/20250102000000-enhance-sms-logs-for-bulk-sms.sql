-- Enhance sms_logs table to track source and campaign information for bulk SMS feature
-- This allows tracking which source (ambassador_applications, orders, etc.) each SMS came from

-- Add new columns for source tracking
ALTER TABLE public.sms_logs 
ADD COLUMN IF NOT EXISTS source TEXT,  -- 'ambassador_applications', 'orders', 'aio_events_submissions', 'approved_ambassadors', 'phone_subscribers'
ADD COLUMN IF NOT EXISTS source_id UUID,  -- ID of the record in the source table
ADD COLUMN IF NOT EXISTS campaign_name TEXT,  -- Optional campaign identifier
ADD COLUMN IF NOT EXISTS admin_id UUID;  -- Admin who sent the SMS

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sms_logs_source ON public.sms_logs(source);
CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign ON public.sms_logs(campaign_name);
CREATE INDEX IF NOT EXISTS idx_sms_logs_admin_id ON public.sms_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_sms_logs_source_id ON public.sms_logs(source_id);

-- Add comments for documentation
COMMENT ON COLUMN public.sms_logs.source IS 'Source of the phone number: ambassador_applications, orders, aio_events_submissions, approved_ambassadors, or phone_subscribers';
COMMENT ON COLUMN public.sms_logs.source_id IS 'ID of the record in the source table (e.g., order ID, application ID)';
COMMENT ON COLUMN public.sms_logs.campaign_name IS 'Optional campaign name for grouping SMS sends';
COMMENT ON COLUMN public.sms_logs.admin_id IS 'ID of the admin who sent the SMS';
