@echo off
REM Simple Backup Script using Supabase CLI (npx) or pg_dump
echo ========================================
echo Database Backup Script
echo ========================================
echo.

REM Create backups directory
if not exist backups mkdir backups

echo Trying Supabase CLI via npx...
echo.

REM Try using npx supabase (doesn't require installation)
npx supabase@latest login
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Linking project...
    npx supabase@latest link --project-ref ykeryyraxmtjunnotoep
    
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo Creating backup...
        npx supabase@latest db dump -f backups\backup_before_migration.sql
        if %ERRORLEVEL% EQU 0 (
            echo.
            echo ========================================
            echo Backup created successfully!
            echo File: backups\backup_before_migration.sql
            echo ========================================
            goto :end
        )
    )
)

echo.
echo Supabase CLI method failed. Trying pg_dump...
echo.

REM Fallback: Use pg_dump if PostgreSQL is installed
where pg_dump >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using pg_dump...
    set PGPASSWORD=vVY.@YDN*6M@a56
    pg_dump -h db.ykeryyraxmtjunnotoep.supabase.co -p 5432 -U postgres -d postgres -F p -f backups\backup_before_migration.sql
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ========================================
        echo Backup created successfully using pg_dump!
        echo File: backups\backup_before_migration.sql
        echo ========================================
        goto :end
    )
) else (
    echo ERROR: pg_dump not found. Please install PostgreSQL client tools.
    echo Download from: https://www.postgresql.org/download/windows/
)

echo.
echo ========================================
echo Backup failed. Please see BACKUP_USING_SUPABASE_CLI.md for manual instructions.
echo ========================================

:end
pause

