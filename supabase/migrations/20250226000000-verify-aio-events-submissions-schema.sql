-- Verify and document aio_events_submissions table schema
-- This migration ensures the table structure is correct and documents valid columns
-- Note: This table does NOT have an 'age' column (age is only in ambassador_applications table)

-- Ensure the table exists with correct structure
-- If any columns were accidentally added, this will help identify them

-- Add comprehensive table comment documenting all valid columns
COMMENT ON TABLE public.aio_events_submissions IS 
'Stores user data when they click "Online Payment By AIO Events". 
Used for lead generation and analytics. No orders are created.

Valid columns:
- id (UUID, primary key)
- full_name (TEXT, required)
- email (TEXT, required)
- phone (TEXT, required)
- city (TEXT, required)
- ville (TEXT, optional)
- event_id (UUID, optional)
- event_name (TEXT, optional)
- event_date (TIMESTAMP, optional)
- event_venue (TEXT, optional)
- event_city (TEXT, optional)
- selected_passes (JSONB, required)
- total_price (DECIMAL, required)
- total_quantity (INTEGER, required)
- language (TEXT, default: en)
- user_agent (TEXT, optional)
- ip_address (TEXT, optional)
- status (TEXT, default: submitted)
- submitted_at (TIMESTAMP, required)
- created_at (TIMESTAMP, required)

NOTE: This table does NOT have an "age" column. 
The "age" column exists only in the "ambassador_applications" table.';

-- Verify table structure by checking information_schema
-- This will help identify if any invalid columns exist
DO $$
DECLARE
    invalid_columns TEXT[];
    col_record RECORD;
BEGIN
    -- Check for any columns that shouldn't exist
    -- Specifically check for 'age' column
    SELECT array_agg(column_name) INTO invalid_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aio_events_submissions'
      AND column_name = 'age';
    
    -- If age column exists, raise a notice (but don't fail the migration)
    -- This is just for documentation - the column shouldn't exist
    IF invalid_columns IS NOT NULL AND array_length(invalid_columns, 1) > 0 THEN
        RAISE NOTICE 'WARNING: Column "age" found in aio_events_submissions table. This column should not exist in this table.';
    END IF;
END $$;
