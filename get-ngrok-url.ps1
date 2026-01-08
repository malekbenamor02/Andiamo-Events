# Get ngrok HTTPS URL from local API
# Run this script after starting ngrok: ngrok http 8082

try {
    $response = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -Method Get -TimeoutSec 3 -ErrorAction Stop
    $httpsTunnel = $response.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
    
    if ($httpsTunnel) {
        Write-Host ''
        Write-Host '========================================' -ForegroundColor Green
        Write-Host '  NGROK TUNNEL IS RUNNING!' -ForegroundColor Green
        Write-Host '========================================' -ForegroundColor Green
        Write-Host ''
        Write-Host 'YOUR HTTPS URL:' -ForegroundColor Yellow
        Write-Host $httpsTunnel.public_url -ForegroundColor White -BackgroundColor DarkGreen
        Write-Host ''
        Write-Host 'Set this in Vercel as: VITE_API_URL' -ForegroundColor Cyan
        Write-Host ''
        Write-Host '========================================' -ForegroundColor Green
        Write-Host ''
        
        # Copy to clipboard
        Set-Clipboard -Value $httpsTunnel.public_url
        Write-Host '✅ URL copied to clipboard!' -ForegroundColor Green
        Write-Host ''
    } else {
        Write-Host 'No HTTPS tunnel found. Make sure ngrok is running: ngrok http 8082' -ForegroundColor Yellow
    }
} catch {
    Write-Host 'Error: Could not connect to ngrok API (port 4040)' -ForegroundColor Red
    Write-Host ''
    Write-Host 'Make sure:' -ForegroundColor Yellow
    Write-Host '  1. ngrok is running: ngrok http 8082' -ForegroundColor White
    Write-Host '  2. Or visit: http://127.0.0.1:4040 in your browser' -ForegroundColor White
    Write-Host ''
}
