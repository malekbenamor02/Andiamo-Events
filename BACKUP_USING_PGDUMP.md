# Backup Using pg_dump (Direct Method)
## Alternative to Supabase CLI

Since Supabase CLI requires Docker, we'll use `pg_dump` directly instead.

---

## 📋 Option 1: Install PostgreSQL Client Tools (Recommended)

### Step 1: Download PostgreSQL

1. Go to: https://www.postgresql.org/download/windows/
2. Click "Download the installer"
3. Download PostgreSQL (any version - you only need the client tools)

### Step 2: Install PostgreSQL

1. Run the installer
2. **IMPORTANT:** During installation:
   - Select "Command Line Tools" component
   - You can skip installing the server if you only want client tools
3. Complete the installation
4. **Restart your terminal/PowerShell**

### Step 3: Verify Installation

```powershell
pg_dump --version
```

Should show version number (e.g., "pg_dump (PostgreSQL) 15.x")

### Step 4: Create Backup

```powershell
# Set password as environment variable
$env:PGPASSWORD='vVY.@YDN*6M@a56'

# Create backup
pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backups/backup_before_migration.sql
```

---

## 📋 Option 2: Use Online pg_dump Tool

If you don't want to install PostgreSQL, you can use an online tool or Docker (but that defeats the purpose).

---

## ✅ Option 3: Skip Manual Backup (Use Automatic Backups)

**Since your project has automatic physical backups enabled:**

Supabase creates automatic backups daily. You can:
1. Proceed with migrations
2. If something goes wrong, restore from Supabase dashboard:
   - Database → Backups → Point in time
   - Select a restore point before migrations
   - Restore

**This is safer than no backup, but manual backup is still recommended.**

---

## 🚀 Quick Script (After Installing PostgreSQL)

Create a file `backup_with_pgdump.ps1`:

```powershell
# Create backups directory
if (-not (Test-Path backups)) {
    New-Item -ItemType Directory -Path backups | Out-Null
}

# Set password
$env:PGPASSWORD='vVY.@YDN*6M@a56'

# Create backup with timestamp
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "backups/backup_before_migration_$timestamp.sql"

Write-Host "Creating backup..." -ForegroundColor Yellow
pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f $backupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup created: $backupFile" -ForegroundColor Green
    $fileInfo = Get-Item $backupFile
    Write-Host "File size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
} else {
    Write-Host "ERROR: Backup failed. Is pg_dump installed?" -ForegroundColor Red
}
```

Then run:
```powershell
.\backup_with_pgdump.ps1
```

