# PowerShell script to get ngrok tunnel URL
# Run this after starting ngrok

Write-Host "Checking ngrok tunnel status..." -ForegroundColor Cyan
Write-Host ""

Start-Sleep -Seconds 2

try {
    $response = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -Method Get -ErrorAction Stop
    
    $httpsTunnel = $response.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
    
    if ($httpsTunnel) {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  NGROK TUNNEL ACTIVE" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "HTTPS URL:" -ForegroundColor Yellow
        Write-Host $httpsTunnel.public_url -ForegroundColor White -BackgroundColor DarkGreen
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "NEXT STEPS:" -ForegroundColor Cyan
        Write-Host "1. Copy the HTTPS URL above"
        Write-Host "2. Go to Vercel Dashboard → Settings → Environment Variables"
        Write-Host "3. Add: VITE_API_URL = " -NoNewline
        Write-Host $httpsTunnel.public_url -ForegroundColor White
        Write-Host "4. Redeploy preview"
        Write-Host ""
    } else {
        Write-Host "No HTTPS tunnel found. Make sure ngrok is running." -ForegroundColor Red
    }
} catch {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  NGROK NOT RUNNING" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start ngrok first:" -ForegroundColor Yellow
    Write-Host "  ngrok http 8082" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use the helper script:" -ForegroundColor Yellow
    Write-Host "  start-ngrok-tunnel.bat" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run this script again to get the URL." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
