-- Add admin_notes column to orders table for storing admin notes/comments

DO $$ 
BEGIN
  -- Add admin_notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'orders' 
    AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN admin_notes TEXT;
    COMMENT ON COLUMN public.orders.admin_notes IS 'Admin notes/comments for orders - can be added by administrators to track special instructions or observations';
  END IF;
END $$;

-- Add index for admin_notes searches (if needed in future)
-- Note: We're not adding an index by default since TEXT columns with frequent searches might need full-text search instead
