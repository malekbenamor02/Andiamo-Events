# Manual Backup Instructions - Supabase SQL Editor

## Method 1: Download Existing Backup (Easiest)

1. Go to Supabase Dashboard → Database → Backups
2. Click "Download" button next to the most recent backup
3. Save the file - it's your backup! ✅

---

## Method 2: Export via SQL Editor (Manual - For Specific Tables)

If you need to export specific tables or create a backup right now:

### Step 1: Open SQL Editor
1. In Supabase Dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**

### Step 2: Export Key Tables

Run these queries one by one and copy the results:

**Export Ambassadors:**
```sql
SELECT * FROM ambassadors;
```
- Click Run
- Copy all results
- Save to: `backup_ambassadors.sql`

**Export Orders:**
```sql
SELECT * FROM orders;
```
- Click Run
- Copy all results
- Save to: `backup_orders.sql`

**Export Ambassador Applications:**
```sql
SELECT * FROM ambassador_applications;
```
- Click Run
- Copy all results
- Save to: `backup_ambassador_applications.sql`

**Export Payment Options (if exists):**
```sql
SELECT * FROM payment_options;
```

**Export Order Passes:**
```sql
SELECT * FROM order_passes;
```

**Export Order Logs:**
```sql
SELECT * FROM order_logs;
```

### Step 3: Export Table Structure (Optional)

To get the table structure (CREATE TABLE statements):

```sql
SELECT 
    'CREATE TABLE ' || table_name || ' (' || 
    string_agg(column_name || ' ' || data_type, ', ') || 
    ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name;
```

---

## Method 3: Use Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Install CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref ykeryyraxmtjunnotoep

# Dump database
supabase db dump -f backup.sql
```

---

## ⚠️ Important Notes

1. **Supabase Automatic Backups:**
   - Backups are created daily at midnight (your project's region time)
   - They are stored for a period (check your plan)
   - These are FULL database backups (recommended!)

2. **Download Existing Backup:**
   - This is the BEST option if you just need a recent backup
   - The backup includes everything (tables, functions, triggers, etc.)
   - You can restore it later if needed

3. **Manual SQL Export:**
   - Only exports data (not structure, functions, triggers)
   - Good for quick data backup
   - Not a complete backup solution

4. **Before Migrations:**
   - Either download the latest automatic backup (easiest!)
   - OR export tables manually using SQL Editor
   - OR wait until after midnight for next automatic backup

---

## ✅ Recommended: Download Existing Backup

**For your migration purposes, just download the most recent automatic backup!**

1. You're already on the backups page
2. Click "Download" on the backup from "02 Jan 2026 00:48:07"
3. Save it as `backup_before_migration.sql`
4. You're done! ✅

This is the safest and most complete backup option.

