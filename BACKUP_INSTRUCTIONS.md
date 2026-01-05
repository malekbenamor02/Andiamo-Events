# Database Backup Instructions
## Create a Backup Before Running Migrations

**IMPORTANT:** Always backup your database before running migrations!

---

## 🔧 Method 1: Using Supabase CLI (REQUIRED for Physical Backups)

**⚠️ IMPORTANT:** Your project has **physical backups (PITR)** enabled, which means you **cannot download logical backups** from the dashboard. You **must use Supabase CLI**.

### Quick Start:
```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link your project
supabase link --project-ref ykeryyraxmtjunnotoep

# 4. Create backup
mkdir backups
supabase db dump -f backups/backup_before_migration.sql
```

**👉 See `BACKUP_USING_SUPABASE_CLI.md` for detailed instructions!**

---

## 📋 Method 1b: Using pg_dump (Alternative)

If you can't use Supabase CLI, install PostgreSQL client tools and use pg_dump:

1. **Install PostgreSQL** from https://www.postgresql.org/download/windows/
2. **Run:**
   ```bash
   set PGPASSWORD=vVY.@YDN*6M@a56
   pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backup_before_migration.sql
   ```

---

## 💻 Method 2: Using pg_dump Command Line

### For Windows:

1. **Install PostgreSQL Client Tools** (if not already installed):
   - Download from: https://www.postgresql.org/download/windows/
   - Or use the installer from: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **Run the backup script:**
   ```cmd
   create_database_backup.bat
   ```

3. **OR run manually:**
   ```cmd
   "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backup.sql
   ```
   - It will prompt for password: `vVY.@YDN*6M@a56`

### For Linux/Mac:

1. **Install PostgreSQL Client Tools** (if not already installed):
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql-client
   
   # Mac (using Homebrew)
   brew install postgresql
   ```

2. **Make script executable and run:**
   ```bash
   chmod +x create_database_backup.sh
   ./create_database_backup.sh
   ```

3. **OR run manually:**
   ```bash
   export PGPASSWORD='vVY.@YDN*6M@a56'
   pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backup_$(date +%Y%m%d_%H%M%S).sql
   ```

---

## 🌐 Method 3: Using Supabase CLI

1. **Install Supabase CLI:**
   ```bash
   # Windows (using scoop)
   scoop install supabase
   
   # Mac/Linux
   brew install supabase/tap/supabase
   ```

2. **Login to Supabase:**
   ```bash
   supabase login
   ```

3. **Link your project:**
   ```bash
   supabase link --project-ref ykeryyraxmtjunnotoep
   ```

4. **Create backup:**
   ```bash
   supabase db dump -f backup.sql
   ```

---

## 📋 Method 4: Manual SQL Export (Quick but limited)

If you just want to export specific tables:

1. **Open Supabase SQL Editor**
2. **Run this query to export ambassadors:**
   ```sql
   SELECT * FROM ambassadors;
   ```
   - Copy results to a text file: `ambassadors_backup.txt`

3. **Run this query to export orders:**
   ```sql
   SELECT * FROM orders;
   ```
   - Copy results to a text file: `orders_backup.txt`

4. **Save both files**

**⚠️ Note:** This is NOT a complete backup, but good for quick data export.

---

## ✅ Recommended: Supabase Dashboard Backup

**The Supabase Dashboard backup method is the easiest and most reliable:**

1. ✅ No command line required
2. ✅ Handles all tables automatically
3. ✅ Can restore easily from dashboard
4. ✅ Includes all database objects (tables, functions, triggers, etc.)

---

## 🔍 Verify Your Backup

After creating a backup, verify it:

```bash
# Check file size (should not be 0 bytes)
ls -lh backup.sql

# For Windows
dir backup.sql

# Check first few lines (should contain SQL)
head -20 backup.sql
```

---

## 📦 Where to Store Backup

- ✅ Store in a safe location (not in the project folder if it's in git)
- ✅ Name it clearly: `backup_before_migration_2025-02-15.sql`
- ✅ Keep multiple backups if you're doing multiple migrations
- ✅ Consider cloud storage (Dropbox, Google Drive) for important backups

---

## 🔄 Restoring from Backup (if needed)

### Using Supabase Dashboard:
1. Go to Database → Backups
2. Select your backup
3. Click Restore

### Using psql command line:
```bash
psql -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -f backup.sql
```

---

## ⚠️ Security Note

Your database connection string contains credentials. After running backups:
- ✅ Delete backup scripts that contain passwords
- ✅ Store backups securely
- ✅ Don't commit credentials to git

---

## ✅ Quick Checklist

- [ ] Backup created using one of the methods above
- [ ] Backup file size is reasonable (not 0 bytes)
- [ ] Backup file stored in safe location
- [ ] Ready to proceed with migrations

---

**Once you have a backup, you can proceed with the migrations!** 🚀

