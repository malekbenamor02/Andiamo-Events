@echo off
title ngrok Tunnel - localhost:8082
color 0A

echo.
echo ========================================
echo   NGROK TUNNEL - Andiamo Events
echo ========================================
echo.
echo Checking if ngrok is installed...
where ngrok >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] ngrok is not installed!
    echo.
    echo Please install ngrok:
    echo   1. npm install -g ngrok
    echo   2. Or download from: https://ngrok.com/download
    echo.
    echo After installing, run this script again.
    echo.
    pause
    exit /b 1
)

echo [OK] ngrok found!
echo.
echo Checking if backend is running on port 8082...
netstat -ano | findstr :8082 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Port 8082 is not in use!
    echo.
    echo Please start your backend server first:
    echo   node server.cjs
    echo.
    echo Then run this script again.
    echo.
    pause
    exit /b 1
)

echo [OK] Backend is running on port 8082!
echo.
echo ========================================
echo   Starting ngrok tunnel...
echo ========================================
echo.
echo IMPORTANT:
echo   - This window MUST stay open
echo   - Look for the HTTPS URL below
echo   - Copy it and set in Vercel as VITE_API_URL
echo   - Press Ctrl+C to stop ngrok
echo.
echo ========================================
echo.

REM Start ngrok - this will show output and keep window open
ngrok http 8082

REM If we get here, ngrok exited
echo.
echo ========================================
echo   ngrok has stopped
echo ========================================
echo.
echo Check for errors above.
echo.
echo If ngrok needs authentication:
echo   1. Sign up at https://ngrok.com (free)
echo   2. Get your auth token from dashboard
echo   3. Run: ngrok config add-authtoken YOUR_TOKEN
echo.
pause
