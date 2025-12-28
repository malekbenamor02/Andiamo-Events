# 🚨 CRITICAL: Database Migration Required

## Issue
The code has been updated to use the new pass system architecture, but the database migration has not been applied yet. You're seeing errors like:

```
Could not find the 'is_primary' column of 'event_passes' in the schema cache
```

## Solution: Apply the Migration

You need to run the migration file in your Supabase database:

**Migration file:** `supabase/migrations/20250201000028-reset-pass-system.sql`

### Option 1: Using Supabase CLI (Recommended)

```bash
# If you have Supabase CLI installed
supabase db push

# Or apply specific migration
supabase migration up
```

### Option 2: Using Supabase Dashboard (Manual)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `supabase/migrations/20250201000028-reset-pass-system.sql`
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)

### Option 3: Using Supabase Migration Tool

If you're using Supabase's migration system:

```bash
# Make sure you're in the project root
cd /path/to/Andiamo-Events

# Apply migrations
supabase db push
```

## What This Migration Does

1. ✅ Renames `is_default` → `is_primary` in `event_passes` table
2. ✅ Enforces price > 0 (not >= 0)
3. ✅ Removes `standard_price` and `vip_price` from `events` table
4. ✅ Ensures each event has exactly one primary pass
5. ✅ Adds database-level constraints to prevent invalid data

## After Running the Migration

1. **Refresh your browser** - Clear cache if needed
2. **Restart your dev server** if running
3. The errors should disappear

## Verification

After running the migration, verify it worked:

```sql
-- Check if is_primary column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'event_passes' 
AND column_name IN ('is_primary', 'is_default');

-- Should show 'is_primary' (not 'is_default')
```

## ⚠️ Important Notes

- **Backup your database** before running migrations in production
- This migration **deletes passes with price <= 0**
- This migration **removes standard_price and vip_price columns** (no going back)
- Make sure all events have at least one pass before running this

## Need Help?

If you encounter errors:
1. Check Supabase logs in the dashboard
2. Verify the migration file syntax
3. Ensure you have proper database permissions

