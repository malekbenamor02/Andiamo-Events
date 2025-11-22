# Run Supabase Migration Script
# This script runs the migration SQL directly on your Supabase database

$password = "vVY.@YDN*6M@a56"
$projectRef = "ykeryyraxmtjunnotoep"
$sqlFile = "supabase/migrations/20250102000000-add-email-to-ambassador-applications.sql"

Write-Host "Reading migration SQL file..." -ForegroundColor Cyan
$sql = Get-Content $sqlFile -Raw

Write-Host "Attempting to run migration via Supabase CLI..." -ForegroundColor Cyan

# Try using supabase db push with password flag
Write-Host "Running: supabase db push -p [password]" -ForegroundColor Yellow
$process = Start-Process -FilePath "supabase" -ArgumentList "db", "push", "-p", $password, "--linked" -NoNewWindow -Wait -PassThru

if ($process.ExitCode -eq 0) {
    Write-Host "`n✅ Migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n⚠️ Migration may have failed. Exit code: $($process.ExitCode)" -ForegroundColor Yellow
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nCLI method failed. Please use the Supabase Dashboard method:" -ForegroundColor Yellow
    Write-Host "1. Open: https://supabase.com/dashboard/project/$projectRef/sql/new" -ForegroundColor Cyan
    Write-Host "2. Copy the SQL from: $sqlFile" -ForegroundColor Cyan
    Write-Host "3. Paste and click 'Run'" -ForegroundColor Cyan
}

