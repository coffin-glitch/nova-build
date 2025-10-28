#!/bin/bash

# NOVA Build - Complete Supabase Migration Script
# This script migrates all local PostgreSQL data to Supabase

set -e

echo "🚀 Starting NOVA Build Supabase Migration..."

# Configuration
LOCAL_DB="nova_build"
SUPABASE_URL="postgresql://postgres.rbiomzdrlmsexehrhowa:LVJPHzZbah5pW4Lp@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require"
BACKUP_DIR="./migration_backup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "📊 Step 1: Analyzing local database..."

# Get table list from local database
LOCAL_TABLES=$(psql -d "$LOCAL_DB" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" | grep -v "table_name" | grep -v "^-" | grep -v "^(" | grep -v "^$" | tr -d ' ')

echo "Found $(echo "$LOCAL_TABLES" | wc -l) tables in local database:"
echo "$LOCAL_TABLES"

echo ""
echo "📊 Step 2: Analyzing Supabase database..."

# Get table list from Supabase database
SUPABASE_TABLES=$(psql "$SUPABASE_URL" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" | grep -v "table_name" | grep -v "^-" | grep -v "^(" | grep -v "^$" | tr -d ' ')

echo "Found $(echo "$SUPABASE_TABLES" | wc -l) tables in Supabase database:"
echo "$SUPABASE_TABLES"

echo ""
echo "📋 Step 3: Creating migration plan..."

# Create migration SQL file
MIGRATION_FILE="$BACKUP_DIR/supabase_migration_$TIMESTAMP.sql"

cat > "$MIGRATION_FILE" << 'EOF'
-- NOVA Build Supabase Migration
-- Generated: TIMESTAMP_PLACEHOLDER

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables in Supabase (in reverse dependency order)
EOF

# Add DROP statements for existing Supabase tables
for table in $SUPABASE_TABLES; do
    echo "DROP TABLE IF EXISTS $table CASCADE;" >> "$MIGRATION_FILE"
done

echo "" >> "$MIGRATION_FILE"
echo "-- Create all tables from local database" >> "$MIGRATION_FILE"

echo ""
echo "📦 Step 4: Exporting schema from local database..."

# Export schema from local database
pg_dump -d "$LOCAL_DB" --schema-only --no-owner --no-privileges >> "$MIGRATION_FILE"

echo ""
echo "📦 Step 5: Exporting data from local database..."

# Export data from local database
DATA_FILE="$BACKUP_DIR/local_data_$TIMESTAMP.sql"
pg_dump -d "$LOCAL_DB" --data-only --no-owner --no-privileges > "$DATA_FILE"

echo ""
echo "🔄 Step 6: Applying schema to Supabase..."

# Apply schema to Supabase
psql "$SUPABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "📥 Step 7: Importing data to Supabase..."

# Import data to Supabase
psql "$SUPABASE_URL" -f "$DATA_FILE"

echo ""
echo "✅ Step 8: Verifying migration..."

# Verify table counts
echo "Verifying table counts..."
for table in $LOCAL_TABLES; do
    LOCAL_COUNT=$(psql -d "$LOCAL_DB" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
    SUPABASE_COUNT=$(psql "$SUPABASE_URL" -t -c "SELECT COUNT(*) FROM $table;" | tr -d ' ')
    
    if [ "$LOCAL_COUNT" = "$SUPABASE_COUNT" ]; then
        echo "✅ $table: $LOCAL_COUNT rows migrated successfully"
    else
        echo "❌ $table: Local=$LOCAL_COUNT, Supabase=$SUPABASE_COUNT - MISMATCH!"
    fi
done

echo ""
echo "🎯 Step 9: Updating environment configuration..."

# Update .env.local to use Supabase
if [ -f ".env.local" ]; then
    cp ".env.local" ".env.local.backup.$TIMESTAMP"
    
    # Update DATABASE_URL to Supabase
    sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres.rbiomzdrlmsexehrhowa:LVJPHzZbah5pW4Lp@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require|' ".env.local"
    
    echo "✅ Updated .env.local to use Supabase"
else
    echo "❌ .env.local not found"
fi

echo ""
echo "📊 Migration Summary:"
echo "===================="
echo "Local Tables: $(echo "$LOCAL_TABLES" | wc -l)"
echo "Supabase Tables: $(echo "$SUPABASE_TABLES" | wc -l)"
echo "Migration File: $MIGRATION_FILE"
echo "Data File: $DATA_FILE"
echo "Backup: .env.local.backup.$TIMESTAMP"

echo ""
echo "🎉 Supabase migration completed successfully!"
echo ""
echo "Next steps:"
echo "1. Test the application with Supabase connection"
echo "2. Verify all functionality works correctly"
echo "3. Update any hardcoded database references"
echo "4. Monitor performance and optimize if needed"

