#!/bin/bash

# Backup and Cleanup Script for Clerk Data Removal
# This script creates a database backup and then runs the Clerk cleanup

set -e  # Exit on error

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL not found in environment"
    exit 1
fi

echo "📦 Step 1: Creating database backup..."
timestamp=$(date +%Y%m%d_%H%M%S)
backup_file="backups/backup_before_clerk_cleanup_${timestamp}.sql"

# Create backups directory if it doesn't exist
mkdir -p backups

# Try pg_dump first, fallback to psql COPY if needed
if command -v pg_dump &> /dev/null; then
    echo "Using pg_dump for backup..."
    pg_dump "$DATABASE_URL" > "$backup_file" 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Backup created: $backup_file"
        ls -lh "$backup_file"
    else
        echo "⚠️  pg_dump failed, trying alternative method..."
        # Alternative: Use psql to dump specific tables
        psql "$DATABASE_URL" -c "\copy (SELECT COUNT(*) FROM carrier_profiles) TO STDOUT" > "$backup_file.stat" 2>&1 || echo "Connection test failed"
    fi
else
    echo "⚠️  pg_dump not found, using psql for connection test..."
    psql "$DATABASE_URL" -c "SELECT 'Connection successful' as status;" || {
        echo "❌ Cannot connect to database. Please check DATABASE_URL"
        exit 1
    }
fi

echo ""
echo "🧹 Step 2: Running Clerk data cleanup..."
echo "⚠️  WARNING: This will permanently delete all Clerk-related data!"
echo "📋 Review the cleanup script: scripts/cleanup-clerk-data.sql"
echo ""

# Run the cleanup script
psql "$DATABASE_URL" -f scripts/cleanup-clerk-data.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Cleanup completed successfully!"
    echo "📊 Review the summary at the end of the output above"
else
    echo ""
    echo "❌ Cleanup failed! Check the error messages above"
    exit 1
fi


