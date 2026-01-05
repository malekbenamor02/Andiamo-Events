# Quick Backup Guide
## Your Project Has Physical Backups (PITR) - Use CLI

Since your project has physical backups enabled, you need to use CLI to create backups.

---

## 🚀 Option 1: Use npx (No Installation - Easiest)

**Run this in PowerShell:**

```powershell
# 1. Login to Supabase (will open browser)
npx supabase@latest login

# 2. Link your project
npx supabase@latest link --project-ref ykeryyraxmtjunnotoep

# 3. Create backup
npx supabase@latest db dump -f backups/backup_before_migration.sql
```

That's it! ✅

---

## 🚀 Option 2: Use pg_dump (If PostgreSQL is Installed)

**First, check if pg_dump is available:**
```powershell
where pg_dump
```

**If it's installed, run:**
```powershell
$env:PGPASSWORD='vVY.@YDN*6M@a56'
pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backups/backup_before_migration.sql
```

**If not installed:**
- Download PostgreSQL from: https://www.postgresql.org/download/windows/
- Install (select "Command Line Tools")
- Restart terminal
- Run the command above

---

## 🚀 Option 3: Run the Batch Script

I created `create_backup_simple.bat` for you. Just:

1. Double-click `create_backup_simple.bat`
2. Follow the prompts
3. It will try npx first, then pg_dump as fallback

---

## ✅ Recommended: Option 1 (npx)

**This is the easiest - just run these 3 commands:**

```powershell
npx supabase@latest login
npx supabase@latest link --project-ref ykeryyraxmtjunnotoep
npx supabase@latest db dump -f backups/backup_before_migration.sql
```

No installation needed! 🎉

---

## 📝 What Happens

1. **Login:** Opens browser, you click "Authorize"
2. **Link:** Connects to your project
3. **Dump:** Downloads entire database to `backups/backup_before_migration.sql`

The backup file will include:
- All tables
- All data
- All functions
- All triggers
- Everything! ✅

---

## ✅ After Backup

1. Check file exists: `dir backups\backup_before_migration.sql`
2. Check file size (should be > 0 bytes)
3. You're ready for migrations! 🚀

