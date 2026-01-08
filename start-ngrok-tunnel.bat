@echo off
REM ngrok Tunnel Starter for Andiamo Events
REM This script starts ngrok tunnel for localhost:8082

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
    echo   1. Download from: https://ngrok.com/download
    echo   2. Or install via npm: npm install -g ngrok
    echo   3. Or install via Chocolatey: choco install ngrok
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting ngrok tunnel for localhost:8082...
echo.
echo IMPORTANT:
echo   - Keep this window open while testing
echo   - Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
echo   - Set VITE_API_URL in Vercel environment variables
echo   - Redeploy preview after setting environment variable
echo.
echo Press Ctrl+C to stop the tunnel
echo.

REM Start ngrok
ngrok http 8082

pause
