# Direct SQL Execution via Supabase Dashboard
# Since CLI has issues, this opens the dashboard with the SQL ready

$projectRef = "ykeryyraxmtjunnotoep"
$sqlUrl = "https://supabase.com/dashboard/project/$projectRef/sql/new"

Write-Host "`n=== MIGRATION EXECUTION ===" -ForegroundColor Cyan
Write-Host "The Supabase SQL Editor should be open in your browser." -ForegroundColor Yellow
Write-Host "`n📋 SQL to Execute:" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green

Get-Content "RUN_THIS_IN_SUPABASE.sql"

Write-Host "`n✅ Instructions:" -ForegroundColor Cyan
Write-Host "1. The SQL Editor should be open in your browser" -ForegroundColor White
Write-Host "2. Copy the SQL above (or from RUN_THIS_IN_SUPABASE.sql file)" -ForegroundColor White
Write-Host "3. Paste it into the SQL Editor" -ForegroundColor White
Write-Host "4. Click the 'Run' button" -ForegroundColor White
Write-Host "`n⚠️  Security Note: Change your database password after this!" -ForegroundColor Red

# Also copy to clipboard for easy pasting
Get-Content "RUN_THIS_IN_SUPABASE.sql" | Set-Clipboard
Write-Host "`n✅ SQL copied to clipboard! Just paste (Ctrl+V) in the SQL Editor." -ForegroundColor Green

