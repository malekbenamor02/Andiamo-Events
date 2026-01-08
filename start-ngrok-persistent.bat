@echo off
REM Persistent ngrok Tunnel Starter
REM This window will stay open and show ngrok output

echo ========================================
echo   Andiamo Events - ngrok Tunnel
echo ========================================
echo.
echo Starting ngrok tunnel for localhost:8082...
echo.
echo IMPORTANT:
echo   - Keep this window OPEN
echo   - Copy the HTTPS URL shown below
echo   - Set it in Vercel as VITE_API_URL
echo   - Press Ctrl+C to stop
echo.
echo ========================================
echo.

REM Run ngrok (this will keep window open)
ngrok http 8082

REM If ngrok exits, pause so user can see any errors
echo.
echo ========================================
echo   ngrok has stopped
echo ========================================
echo.
pause
