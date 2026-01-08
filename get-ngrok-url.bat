@echo off
REM Get ngrok tunnel URL
powershell -ExecutionPolicy Bypass -File "%~dp0get-ngrok-url.ps1"
pause
