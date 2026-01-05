# PowerShell Script to Create Database Backup
# Run this script to backup your database

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Database Backup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create backups directory
if (-not (Test-Path backups)) {
    New-Item -ItemType Directory -Path backups | Out-Null
    Write-Host "Created backups directory" -ForegroundColor Green
}

Write-Host "Step 1: Login to Supabase..." -ForegroundColor Yellow
Write-Host "This will open your browser - please authorize" -ForegroundColor Yellow
Write-Host ""

# Step 1: Login
$loginResult = npx supabase@latest login 2>&1
Write-Host $loginResult

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Login failed. Please run this command manually:" -ForegroundColor Red
    Write-Host "  npx supabase@latest login" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Then run this script again, or continue manually:" -ForegroundColor Yellow
    Write-Host "  npx supabase@latest link --project-ref ykeryyraxmtjunnotoep" -ForegroundColor Yellow
    Write-Host "  npx supabase@latest db dump -f backups/backup_before_migration.sql" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Step 2: Linking project..." -ForegroundColor Yellow
Write-Host ""

# Step 2: Link project
$linkResult = npx supabase@latest link --project-ref ykeryyraxmtjunnotoep 2>&1
Write-Host $linkResult

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Link failed. Please check your project reference." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Creating backup..." -ForegroundColor Yellow
Write-Host "This may take 1-2 minutes..." -ForegroundColor Yellow
Write-Host ""

# Step 3: Create backup
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupFile = "backups/backup_before_migration_$timestamp.sql"

$dumpResult = npx supabase@latest db dump -f $backupFile 2>&1
Write-Host $dumpResult

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
    Write-Host "ERROR: Backup failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}

