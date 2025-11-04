#!/bin/bash
# Script to safely run the clerk_user_id removal migration
# This script:
# 1. Creates a backup
# 2. Verifies the database state
# 3. Runs the migration

set -e  # Exit on error

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Clerk User ID Removal Migration - Safe Execution            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable not set"
  echo "   Please set it before running this script"
  exit 1
fi

# Step 1: Create backup
echo "📦 Step 1: Creating Database Backup..."
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/backup_before_clerk_removal_$(date +%Y%m%d_%H%M%S).sql"
echo "   Backup file: $BACKUP_FILE"

if command -v pg_dump &> /dev/null; then
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
  echo "   ✅ Backup created successfully"
else
  echo "   ⚠️  pg_dump not found. Please create backup manually:"
  echo "   pg_dump \$DATABASE_URL > $BACKUP_FILE"
  read -p "   Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo ""
echo "🔍 Step 2: Verifying Database State..."
echo "   Running verification queries..."

# Step 2: Verify state (basic check)
psql "$DATABASE_URL" -t -c "
SELECT 
  CASE 
    WHEN (
      SELECT COUNT(*) FROM carrier_profiles 
      WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL
    ) = 0 
    AND (
      SELECT COUNT(*) FROM carrier_bids 
      WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL
    ) = 0
    THEN '✅ All data has supabase_user_id'
    ELSE '❌ WARNING: Some data only has clerk_user_id'
  END as verification_status;
" || {
  echo "   ❌ Verification query failed"
  exit 1
}

echo ""
echo "🚀 Step 3: Running Migration..."
echo "   Migration file: db/migrations/078_remove_clerk_user_id_complete.sql"
echo ""
read -p "   ⚠️  This will permanently remove all clerk_user_id columns. Continue? (yes/no) " -r
echo
if [[ ! $REPLY == "yes" ]]; then
  echo "   Migration cancelled"
  exit 0
fi

# Step 3: Run migration
if psql "$DATABASE_URL" -f db/migrations/078_remove_clerk_user_id_complete.sql; then
  echo ""
  echo "✅ Migration completed successfully!"
  echo ""
  echo "📊 Verification: Checking that clerk_user_id columns are removed..."
  psql "$DATABASE_URL" -c "
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN '✅ All clerk_user_id columns removed'
        ELSE '⚠️  Some clerk_user_id columns still exist: ' || COUNT(*)
      END as status
    FROM information_schema.columns
    WHERE column_name LIKE '%clerk_user_id%'
    AND table_schema = 'public';
  "
  echo ""
  echo "✨ Migration complete! Database now uses supabase_user_id exclusively."
else
  echo ""
  echo "❌ Migration failed!"
  echo "   Backup is available at: $BACKUP_FILE"
  echo "   Please review the error and restore if needed:"
  echo "   psql \$DATABASE_URL < $BACKUP_FILE"
  exit 1
fi


