-- ============================================
-- Add Event Slug Column for Friendly URLs
-- ============================================
-- This migration adds a slug column to the events table to enable
-- friendly URLs like "andiamoevents.com/name-of-event" instead of
-- "andiamoevents.com/pass-purchase?eventId=uuid"
--
-- Features:
-- 1. Adds slug column to events table
-- 2. Creates PostgreSQL function to generate slugs from event names
-- 3. Generates slugs for all existing events
-- 4. Handles uniqueness (appends event ID if duplicate)
-- 5. Creates unique index on slug column
-- 6. Creates trigger to auto-generate slugs on insert/update

-- ============================================
-- ADD SLUG COLUMN
-- ============================================

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS slug TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.events.slug IS 'URL-friendly slug generated from event name. Used for friendly URLs like /name-of-event';

-- ============================================
-- CREATE SLUG GENERATION FUNCTION
-- ============================================

-- Function to generate a URL-friendly slug from text
-- This mirrors the JavaScript generateSlug function in src/lib/utils.ts
CREATE OR REPLACE FUNCTION public.generate_slug(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  -- Return empty string if input is null or empty
  IF input_text IS NULL OR TRIM(input_text) = '' THEN
    RETURN '';
  END IF;

  -- Step 1: Convert to lowercase and trim
  result := LOWER(TRIM(input_text));

  -- Step 2: Remove accented characters (basic normalization)
  -- Note: PostgreSQL's unaccent extension would be better, but we'll do basic replacement
  result := TRANSLATE(result, 
    'àáâãäåèéêëìíîïòóôõöùúûüýÿñç',
    'aaaaaaeeeeiiiiooooouuuuyync'
  );

  -- Step 3: Replace spaces and underscores with hyphens
  result := REGEXP_REPLACE(result, '[\s_]+', '-', 'g');

  -- Step 4: Remove all non-alphanumeric characters except hyphens
  result := REGEXP_REPLACE(result, '[^a-z0-9-]', '', 'g');

  -- Step 5: Replace multiple consecutive hyphens with a single hyphen
  result := REGEXP_REPLACE(result, '-+', '-', 'g');

  -- Step 6: Remove leading and trailing hyphens
  result := TRIM(BOTH '-' FROM result);

  -- Return empty string if result is empty
  RETURN COALESCE(NULLIF(result, ''), '');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- GENERATE SLUGS FOR EXISTING EVENTS
-- ============================================

-- Generate slugs for all existing events
-- If a slug is duplicate, append the event ID to ensure uniqueness
DO $$
DECLARE
  event_record RECORD;
  base_slug TEXT;
  final_slug TEXT;
  slug_exists BOOLEAN;
  counter INTEGER;
BEGIN
  FOR event_record IN SELECT id, name FROM public.events WHERE slug IS NULL OR slug = '' LOOP
    -- Generate base slug from event name
    base_slug := public.generate_slug(event_record.name);
    
    -- If base slug is empty, use event ID as fallback
    IF base_slug = '' THEN
      base_slug := 'event-' || event_record.id::TEXT;
    END IF;
    
    final_slug := base_slug;
    counter := 0;
    slug_exists := TRUE;
    
    -- Check for uniqueness and append counter if needed
    WHILE slug_exists LOOP
      SELECT EXISTS(
        SELECT 1 FROM public.events 
        WHERE slug = final_slug AND id != event_record.id
      ) INTO slug_exists;
      
      IF slug_exists THEN
        counter := counter + 1;
        final_slug := base_slug || '-' || counter::TEXT;
      END IF;
    END LOOP;
    
    -- Update the event with the generated slug
    UPDATE public.events 
    SET slug = final_slug 
    WHERE id = event_record.id;
  END LOOP;
END $$;

-- ============================================
-- ADD CONSTRAINTS AND INDEXES
-- ============================================

-- Make slug NOT NULL after populating all existing events
ALTER TABLE public.events 
ALTER COLUMN slug SET NOT NULL;

-- Create unique index on slug column
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug_unique ON public.events(slug);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events(slug);

-- ============================================
-- CREATE TRIGGER FOR AUTO-GENERATION
-- ============================================

-- Function to auto-generate slug on insert/update if not provided
CREATE OR REPLACE FUNCTION public.auto_generate_event_slug()
RETURNS TRIGGER AS $$
DECLARE
  generated_slug TEXT;
  final_slug TEXT;
  slug_exists BOOLEAN;
  counter INTEGER;
BEGIN
  -- Only generate slug if it's NULL or empty
  IF NEW.slug IS NULL OR TRIM(NEW.slug) = '' THEN
    -- Generate base slug from event name
    generated_slug := public.generate_slug(NEW.name);
    
    -- If base slug is empty, use event ID as fallback
    IF generated_slug = '' THEN
      generated_slug := 'event-' || NEW.id::TEXT;
    END IF;
    
    final_slug := generated_slug;
    counter := 0;
    slug_exists := TRUE;
    
    -- Check for uniqueness and append counter if needed
    WHILE slug_exists LOOP
      SELECT EXISTS(
        SELECT 1 FROM public.events 
        WHERE slug = final_slug AND id != NEW.id
      ) INTO slug_exists;
      
      IF slug_exists THEN
        counter := counter + 1;
        final_slug := generated_slug || '-' || counter::TEXT;
      END IF;
    END LOOP;
    
    NEW.slug := final_slug;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate slug before insert
DROP TRIGGER IF EXISTS trigger_auto_generate_event_slug_insert ON public.events;
CREATE TRIGGER trigger_auto_generate_event_slug_insert
  BEFORE INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_event_slug();

-- Create trigger to auto-generate slug before update (only if name changed and slug is empty)
DROP TRIGGER IF EXISTS trigger_auto_generate_event_slug_update ON public.events;
CREATE TRIGGER trigger_auto_generate_event_slug_update
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name AND (NEW.slug IS NULL OR TRIM(NEW.slug) = ''))
  EXECUTE FUNCTION public.auto_generate_event_slug();
