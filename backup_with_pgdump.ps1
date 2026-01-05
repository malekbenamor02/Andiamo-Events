# PowerShell Script to Create Database Backup using pg_dump
# Requires PostgreSQL client tools to be installed

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database Backup using pg_dump" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if pg_dump is available
$pgDumpPath = Get-Command pg_dump -ErrorAction SilentlyContinue
if (-not $pgDumpPath) {
    Write-Host "ERROR: pg_dump not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install PostgreSQL client tools:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor Cyan
    Write-Host "2. Install (select 'Command Line Tools')" -ForegroundColor Cyan
    Write-Host "3. Restart terminal and run this script again" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "OR you can proceed with migrations and rely on Supabase automatic backups" -ForegroundColor Yellow
    Write-Host "  (Supabase creates automatic daily backups - you can restore from dashboard)" -ForegroundColor Yellow
    exit 1
}

Write-Host "pg_dump found: $($pgDumpPath.Source)" -ForegroundColor Green
Write-Host ""

# Create backups directory
if (-not (Test-Path backups)) {
    New-Item -ItemType Directory -Path backups | Out-Null
    Write-Host "Created backups directory" -ForegroundColor Green
}

# Set password as environment variable
$env:PGPASSWORD='vVY.@YDN*6M@a56'

# Create backup with timestamp
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "backups/backup_before_migration_$timestamp.sql"

Write-Host "Creating backup..." -ForegroundColor Yellow
Write-Host "This may take 1-2 minutes..." -ForegroundColor Yellow
Write-Host ""

# Create backup
pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f $backupFile 2>&1 | Out-Host

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Backup created successfully!" -ForegroundColor Green
    Write-Host "File: $backupFile" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    
    # Check file size
    $fileInfo = Get-Item $backupFile
    Write-Host ""
    Write-Host "File size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now proceed with migrations!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERROR: Backup failed." -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Red
    exit 1
}

