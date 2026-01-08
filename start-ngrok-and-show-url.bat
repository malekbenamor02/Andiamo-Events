@echo off
REM ngrok Tunnel Starter - Keeps window open and shows URL
REM This script starts ngrok and displays the tunnel URL

echo ========================================
echo   Andiamo Events - ngrok Tunnel Setup
echo ========================================
echo.

REM Check if ngrok is installed
where ngrok >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] ngrok is not installed or not in PATH
    echo.
    echo Please install ngrok:
    echo   1. npm install -g ngrok
    echo   2. Or download from: https://ngrok.com/download
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting ngrok tunnel for localhost:8082...
echo.
echo IMPORTANT: Keep this window open!
echo.
echo Waiting for ngrok to start...
timeout /t 3 /nobreak >nul

REM Start ngrok in background and get URL
start /B ngrok http 8082 >nul 2>&1

REM Wait a bit for ngrok to initialize
timeout /t 5 /nobreak >nul

REM Try to get the URL from ngrok API
echo.
echo ========================================
echo   Getting Tunnel URL...
echo ========================================
echo.

powershell -ExecutionPolicy Bypass -Command "try { $response = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/tunnels' -Method Get -ErrorAction Stop; $httpsTunnel = $response.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1; if ($httpsTunnel) { Write-Host '========================================' -ForegroundColor Green; Write-Host '  YOUR NGROK HTTPS URL:' -ForegroundColor Green; Write-Host '========================================' -ForegroundColor Green; Write-Host ''; Write-Host $httpsTunnel.public_url -ForegroundColor White -BackgroundColor DarkGreen; Write-Host ''; Write-Host '========================================' -ForegroundColor Green; Write-Host ''; Write-Host 'NEXT STEPS:' -ForegroundColor Cyan; Write-Host '1. Copy the URL above'; Write-Host '2. Go to Vercel Dashboard'; Write-Host '3. Settings ^> Environment Variables'; Write-Host '4. Add: VITE_API_URL = ' -NoNewline; Write-Host $httpsTunnel.public_url -ForegroundColor White; Write-Host '5. Redeploy preview'; Write-Host '' } else { Write-Host 'Tunnel starting... Check http://127.0.0.1:4040' -ForegroundColor Yellow } } catch { Write-Host 'ngrok is starting... Please check http://127.0.0.1:4040 in your browser' -ForegroundColor Yellow; Write-Host 'Or wait a few seconds and run: get-ngrok-url.bat' -ForegroundColor Yellow }"

echo.
echo ========================================
echo   ngrok is running in the background
echo ========================================
echo.
echo To view ngrok web interface:
echo   Open: http://127.0.0.1:4040
echo.
echo To stop ngrok:
echo   Press Ctrl+C or close this window
echo.
echo To get the URL again:
echo   Run: get-ngrok-url.bat
echo.
echo ========================================
echo.

REM Keep window open and show ngrok status
:loop
timeout /t 30 /nobreak >nul
echo [INFO] ngrok tunnel is still running... (Press Ctrl+C to stop)
goto loop
