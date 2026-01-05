@echo off
REM Database Backup Script for Windows
REM Run this script to create a backup of your database before migrations

echo ========================================
echo Database Backup Script
echo ========================================
echo.

REM Set connection details (from your connection string)
set PGHOST=db.ykeryyraxmtjunnotoep.supabase.co
set PGPORT=5432
set PGDATABASE=postgres
set PGUSER=postgres
set PGPASSWORD=vVY.@YDN*6M@a56

REM Create backups directory if it doesn't exist
if not exist "backups" mkdir backups

REM Generate backup filename with timestamp
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set mytime=%mytime: =0%
set BACKUP_FILE=backups\backup_before_migration_%mydate%_%mytime%.sql

echo Creating backup...
echo Backup file: %BACKUP_FILE%
echo.

REM Create backup using pg_dump
REM Note: You need PostgreSQL client tools installed
"C:\Program Files\PostgreSQL\15\bin\pg_dump.exe" -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -F p -f "%BACKUP_FILE%" 2>backup_error.log

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo Backup created successfully!
    echo File: %BACKUP_FILE%
    echo ========================================
    echo.
    echo You can now proceed with migrations.
) else (
    echo.
    echo ========================================
    echo ERROR: Backup failed!
    echo Check backup_error.log for details
    echo ========================================
    echo.
    echo Make sure you have PostgreSQL client tools installed.
    echo You can download them from: https://www.postgresql.org/download/windows/
)

pause

