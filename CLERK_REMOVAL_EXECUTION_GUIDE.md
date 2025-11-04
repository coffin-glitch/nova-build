# Clerk User ID Removal - Execution Guide

## ✅ Preparation Complete

All code has been updated to use `supabase_user_id` exclusively. The migration script is ready.

## 🚀 Execution Steps

### Step 1: Review Migration Script
```bash
cat db/migrations/078_remove_clerk_user_id_complete.sql
```

### Step 2: Create Database Backup

**Option A: Using pg_dump**
```bash
pg_dump $DATABASE_URL > backups/backup_before_clerk_removal_$(date +%Y%m%d_%H%M%S).sql
```

**Option B: Using Supabase CLI**
```bash
supabase db dump > backups/backup_before_clerk_removal_$(date +%Y%m%d_%H%M%S).sql
```

### Step 3: Verify Database State
```bash
psql $DATABASE_URL -f scripts/verify-clerk-removal-ready.sql
```

This checks:
- All tables have supabase_user_id columns
- All data has supabase_user_id values
- No orphaned clerk_user_id data

### Step 4: Run Migration

**Option A: Using Safe Script (Recommended)**
```bash
./scripts/run-clerk-removal-migration.sh
```

**Option B: Direct psql**
```bash
psql $DATABASE_URL -f db/migrations/078_remove_clerk_user_id_complete.sql
```

**Option C: Using Supabase Migration**
```bash
# Copy migration to supabase/migrations if using Supabase CLI
cp db/migrations/078_remove_clerk_user_id_complete.sql supabase/migrations/
supabase db push
```

## ⚠️ Safety Features

The migration script includes:
- ✅ Existence checks before dropping columns
- ✅ Transaction wrapping (can rollback)
- ✅ Primary key handling
- ✅ Foreign key constraint removal
- ✅ Index cleanup

## 🔍 Post-Migration Verification

After running, verify with:
```sql
-- Check that clerk_user_id columns are gone
SELECT table_name, column_name
FROM information_schema.columns
WHERE column_name LIKE '%clerk%'
AND table_schema = 'public';

-- Should return 0 rows
```

## 📊 Expected Results

After migration:
- ✅ All `clerk_user_id` columns removed
- ✅ PRIMARY KEYs migrated to `supabase_user_id`
- ✅ All foreign keys updated
- ✅ All indexes updated
- ✅ Database uses only Supabase authentication

## 🆘 Rollback (if needed)

If you need to rollback:
```bash
psql $DATABASE_URL < backups/backup_before_clerk_removal_YYYYMMDD_HHMMSS.sql
```

## ✨ Done!

After successful migration, your database will be fully Supabase-only!
