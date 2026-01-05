# Manual Backup Steps
## You Need to Run These Commands Yourself

Since the backup requires browser authentication, you need to run these commands in your own terminal.

---

## ✅ Quick Steps (Copy-Paste These)

**Open PowerShell or Command Prompt and run:**

```powershell
# Step 1: Login (will open browser)
npx supabase@latest login

# Step 2: Link your project
npx supabase@latest link --project-ref ykeryyraxmtjunnotoep

# Step 3: Create backup
npx supabase@latest db dump -f backups/backup_before_migration.sql
```

---

## 📋 Detailed Steps

### Step 1: Open Terminal
- Press `Win + R`
- Type `powershell` or `cmd`
- Press Enter

### Step 2: Navigate to Project Folder (if needed)
```powershell
cd C:\Users\ASUS\Andiamo-Events
```

### Step 3: Create Backups Folder
```powershell
mkdir backups
```

### Step 4: Login to Supabase
```powershell
npx supabase@latest login
```
- **This will open your browser**
- Click "Authorize" in the browser
- Return to terminal - you should see "Successfully logged in"

### Step 5: Link Your Project
```powershell
npx supabase@latest link --project-ref ykeryyraxmtjunnotoep
```
- You may be asked to select your project
- Select your project from the list

### Step 6: Create Backup
```powershell
npx supabase@latest db dump -f backups/backup_before_migration.sql
```
- This will download your entire database
- Wait for it to complete (may take 1-2 minutes)

### Step 7: Verify Backup
```powershell
dir backups\backup_before_migration.sql
```
- Check that file exists and has size > 0 bytes

---

## ✅ Done!

Your backup is ready at: `backups\backup_before_migration.sql`

You can now proceed with the migrations! 🚀

---

## ❓ Alternative: Use pg_dump (If You Have PostgreSQL)

If you have PostgreSQL installed, you can skip Supabase CLI and use pg_dump directly:

```powershell
$env:PGPASSWORD='vVY.@YDN*6M@a56'
pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backups/backup_before_migration.sql
```

But the npx method is easier! ✅

