# Backup Using Supabase CLI
## For Projects with Physical Backups (PITR) Enabled

**Your project has physical backups enabled, so you need to use Supabase CLI to create backups.**

---

## 📋 Step 1: Install Supabase CLI

### Option A: Using npm (Recommended - Works on Windows/Mac/Linux)

1. **Make sure you have Node.js installed:**
   - Download from: https://nodejs.org/
   - Or check if you have it: Open terminal and run `node --version`

2. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

   Or if you prefer using npx (no installation needed):
   ```bash
   npx supabase@latest
   ```

### Option B: Using Scoop (Windows only)

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Option C: Using Homebrew (Mac only)

```bash
brew install supabase/tap/supabase
```

---

## 📋 Step 2: Login to Supabase

1. **Open terminal/PowerShell**
2. **Login:**
   ```bash
   supabase login
   ```
3. **It will open your browser** - click "Authorize" to connect
4. **You should see:** "Successfully logged in"

---

## 📋 Step 3: Link Your Project

Link to your project using the project reference:

```bash
supabase link --project-ref ykeryyraxmtjunnotoep
```

**Note:** Your project reference is: `ykeryyraxmtjunnotoep` (from your connection string)

---

## 📋 Step 4: Create Backup

1. **Create backups directory:**
   ```bash
   mkdir backups
   ```

2. **Dump the database:**
   ```bash
   supabase db dump -f backups/backup_before_migration.sql
   ```

   Or with timestamp:
   ```bash
   supabase db dump -f backups/backup_before_migration_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql
   ```
   (For PowerShell - Windows)

3. **Wait for completion** - it will download the entire database structure and data

---

## ✅ Verify Backup

Check if the backup file was created:

```bash
# Windows PowerShell
Get-ChildItem backups\backup_before_migration*.sql

# Should show file with size > 0
```

---

## 🔄 Alternative: Using Connection String Directly

If linking doesn't work, you can use the connection string directly with pg_dump:

### First, install PostgreSQL client tools:

1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Install (make sure "Command Line Tools" is selected)
3. Add to PATH (usually done automatically)

### Then run pg_dump:

```bash
# Windows PowerShell
$env:PGPASSWORD='vVY.@YDN*6M@a56'
pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backups/backup_before_migration.sql
```

Or create a batch file:

```batch
@echo off
set PGPASSWORD=vVY.@YDN*6M@a56
pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backups\backup_before_migration.sql
pause
```

---

## 📝 Quick Start (Copy-Paste)

If you have Node.js installed, run these commands:

```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Login
supabase login

# 3. Link project
supabase link --project-ref ykeryyraxmtjunnotoep

# 4. Create backup
mkdir backups
supabase db dump -f backups/backup_before_migration.sql
```

---

## ❓ Troubleshooting

### "supabase: command not found"
- Make sure Node.js is installed
- Try: `npm install -g supabase` again
- Or use: `npx supabase@latest` instead

### "Cannot link project"
- Make sure you're logged in: `supabase login`
- Check your project reference is correct
- Try using connection string method instead

### "pg_dump: command not found"
- Install PostgreSQL client tools
- Make sure it's in your PATH
- Restart terminal after installation

---

## ✅ After Backup

Once you have the backup file:

1. ✅ Check file size (should be > 0 bytes)
2. ✅ Save it in a safe location
3. ✅ You're ready to proceed with migrations!

---

**Your backup file will be at:** `backups/backup_before_migration.sql`

