#!/bin/bash
# Database Backup Script for Linux/Mac
# Run this script to create a backup of your database before migrations

echo "========================================"
echo "Database Backup Script"
echo "========================================"
echo ""

# Set connection details (from your connection string)
export PGHOST=db.ykeryyraxmtjunnotoep.supabase.co
export PGPORT=5432
export PGDATABASE=postgres
export PGUSER=postgres
export PGPASSWORD='vVY.@YDN*6M@a56'

# Create backups directory if it doesn't exist
mkdir -p backups

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/backup_before_migration_${TIMESTAMP}.sql"

echo "Creating backup..."
echo "Backup file: $BACKUP_FILE"
echo ""

# Create backup using pg_dump
pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -F p -f "$BACKUP_FILE" 2>backup_error.log

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "Backup created successfully!"
    echo "File: $BACKUP_FILE"
    echo "========================================"
    echo ""
    echo "You can now proceed with migrations."
else
    echo ""
    echo "========================================"
    echo "ERROR: Backup failed!"
    echo "Check backup_error.log for details"
    echo "========================================"
    echo ""
    echo "Make sure you have PostgreSQL client tools installed."
    echo "Install with: sudo apt-get install postgresql-client (Ubuntu/Debian)"
    echo "Or: brew install postgresql (Mac)"
fi

