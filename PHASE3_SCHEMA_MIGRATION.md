# Phase 3: Schema Migration - Implementation Summary

## ✅ Completed Components

### 1. Database Migration (`db/migrations/053_add_supabase_user_id_columns.sql`)

**Purpose**: Add `supabase_user_id` columns to all tables for dual-auth support.

**Key Features**:
- ✅ **Non-Breaking**: All columns are nullable, existing queries continue to work
- ✅ **Safe**: Uses `DO $$ BEGIN ... END $$` blocks with existence checks
- ✅ **Indexed**: Creates indexes on all new columns for performance
- ✅ **Documented**: Each column has comments explaining its purpose

**Tables Updated**:
1. `user_roles_cache` - `supabase_user_id`
2. `carrier_profiles` - `supabase_user_id` (with unique index)
3. `carrier_bids` - `supabase_user_id`
4. `auction_awards` - `supabase_winner_user_id`, `supabase_awarded_by`
5. `conversations` - `supabase_carrier_user_id`, `supabase_admin_user_id`
6. `conversation_messages` - `supabase_sender_id`
7. `message_reads` - `supabase_user_id`
8. `carrier_chat_messages` - `supabase_carrier_user_id`
9. `admin_messages` - `supabase_carrier_user_id`, `supabase_admin_user_id`
10. `load_offers` - `supabase_carrier_user_id`
11. `assignments` - `supabase_user_id`
12. `telegram_bid_offers` - `supabase_user_id`
13. `carrier_bid_history` - `supabase_carrier_user_id`
14. `notification_triggers` - `supabase_carrier_user_id`
15. `notification_logs` - `supabase_carrier_user_id`
16. `carrier_favorites` - `supabase_carrier_user_id`
17. `carrier_notification_preferences` - `supabase_carrier_user_id` (unique)
18. `bid_messages` - `supabase_sender_id`

**Views Created**:
- `user_id_mapping` - Easy lookup view for Clerk ↔ Supabase user ID mappings

### 2. Backfill Script (`scripts/backfill-supabase-user-ids.ts`)

**Purpose**: Map existing Clerk users to Supabase users by email.

**Features**:
- ✅ **Dry-run mode**: Test without making changes (`--dry-run`)
- ✅ **Batch processing**: Configurable batch size (default: 100)
- ✅ **Error handling**: Continues on errors, reports at end
- ✅ **Progress tracking**: Shows progress and summary
- ✅ **Comprehensive**: Updates all related tables

**Usage**:
```bash
# Dry run first (recommended)
tsx scripts/backfill-supabase-user-ids.ts --dry-run

# Run for real
tsx scripts/backfill-supabase-user-ids.ts

# Custom batch size
tsx scripts/backfill-supabase-user-ids.ts --batch-size=50
```

**What it does**:
1. Gets all Clerk users from `user_roles_cache`
2. For each user, finds matching Supabase user by email
3. Updates `user_roles_cache.supabase_user_id`
4. Updates `carrier_profiles.supabase_user_id`
5. Updates all related tables (bids, messages, etc.)

### 3. Updated Auth Helper (`lib/auth-unified.ts`)

**Changes**:
- ✅ `getSupabaseUserRole()` now queries `user_roles_cache` by `supabase_user_id`
- ✅ Falls back to email-based lookup if `supabase_user_id` not set
- ✅ Imports `sql` and `getSupabaseService` for database queries

---

## 🔒 Safety Guarantees

### Non-Breaking Migration

1. **All columns nullable**: Existing queries using `clerk_user_id` continue to work
2. **No data loss**: No existing data is modified or deleted
3. **Reversible**: Can rollback by dropping columns (though not recommended)
4. **Idempotent**: Can run migration multiple times safely (checks for column existence)

### Testing Strategy

**Before Running Migration**:
1. ✅ Backup database
2. ✅ Run migration on staging first
3. ✅ Test all critical queries
4. ✅ Verify no performance degradation

**After Running Migration**:
1. ✅ Run backfill script in dry-run mode
2. ✅ Review unmapped users
3. ✅ Run backfill script for real
4. ✅ Verify data integrity

---

## 📋 Execution Steps

### Step 1: Run Migration

```bash
# Connect to your database
psql $DATABASE_URL -f db/migrations/053_add_supabase_user_id_columns.sql

# Or using Supabase CLI
supabase db push
```

**Expected Output**:
- No errors (migration is idempotent)
- Columns added to all tables
- Indexes created
- View created

### Step 2: Verify Migration

```sql
-- Check that columns were added
SELECT 
    table_name, 
    column_name 
FROM information_schema.columns 
WHERE column_name LIKE 'supabase_%' 
ORDER BY table_name, column_name;

-- Check indexes
SELECT 
    tablename, 
    indexname 
FROM pg_indexes 
WHERE indexname LIKE '%supabase%' 
ORDER BY tablename, indexname;
```

### Step 3: Run Backfill (Dry Run First)

```bash
# Set required environment variables
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Dry run
tsx scripts/backfill-supabase-user-ids.ts --dry-run

# Review output, then run for real
tsx scripts/backfill-supabase-user-ids.ts
```

### Step 4: Verify Backfill

```sql
-- Check mapping coverage
SELECT 
    COUNT(*) as total_users,
    COUNT(supabase_user_id) as mapped_users,
    COUNT(*) - COUNT(supabase_user_id) as unmapped_users,
    ROUND(100.0 * COUNT(supabase_user_id) / COUNT(*), 2) as coverage_percent
FROM user_roles_cache;

-- Check specific mappings
SELECT * FROM user_id_mapping 
WHERE mapping_status = 'mapped' 
LIMIT 10;

-- Check unmapped users
SELECT * FROM user_id_mapping 
WHERE mapping_status = 'unmapped';
```

---

## ⚠️ Important Notes

### Unmapped Users

Users that can't be mapped (no matching Supabase account) will have `supabase_user_id = NULL`. This is fine because:

1. **Backward compatible**: Existing queries using `clerk_user_id` still work
2. **Gradual migration**: Users will be mapped when they sign up via Supabase
3. **Manual mapping**: Can manually update if needed

### Email Matching

The backfill script matches users by email (case-insensitive). This means:

- ✅ Works if Clerk and Supabase users have same email
- ⚠️ Won't work if emails differ
- ⚠️ Won't work if user hasn't signed up in Supabase yet

### Performance

- **Indexes**: All `supabase_user_id` columns are indexed for fast lookups
- **Queries**: Can now query by either `clerk_user_id` or `supabase_user_id`
- **Views**: `user_id_mapping` view provides easy lookups

---

## 🔄 Next Steps (Phase 4)

After Phase 3 is complete:

1. **Update API routes** to use unified user ID helper
2. **Create helper functions** for querying by either ID type
3. **Gradually migrate queries** to support both ID types
4. **Test thoroughly** with both Clerk and Supabase users

**Example Query Helper** (to be created in Phase 4):
```typescript
// Helper to get user ID condition for queries
function getUserWhereClause(userId: string, provider: 'clerk' | 'supabase') {
  if (provider === 'supabase') {
    return sql`(supabase_user_id = ${userId} OR clerk_user_id IN (
      SELECT clerk_user_id FROM user_roles_cache WHERE supabase_user_id = ${userId}
    ))`;
  } else {
    return sql`(clerk_user_id = ${userId} OR supabase_user_id IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE clerk_user_id = ${userId}
    ))`;
  }
}
```

---

## 📊 Monitoring

### Key Metrics to Watch

1. **Mapping Coverage**:
   ```sql
   SELECT 
       COUNT(*) as total,
       COUNT(supabase_user_id) as mapped,
       ROUND(100.0 * COUNT(supabase_user_id) / COUNT(*), 2) as pct
   FROM user_roles_cache;
   ```

2. **Query Performance**:
   - Monitor query times for tables with `supabase_user_id`
   - Ensure indexes are being used (check `EXPLAIN ANALYZE`)

3. **Data Integrity**:
   - Verify no orphaned `supabase_user_id` values
   - Check that mappings are consistent across tables

---

## ✅ Verification Checklist

- [ ] Migration ran without errors
- [ ] All columns added successfully
- [ ] Indexes created
- [ ] View created
- [ ] Backfill dry-run completed
- [ ] Reviewed unmapped users
- [ ] Backfill completed successfully
- [ ] Verified mapping coverage
- [ ] Tested queries still work
- [ ] No performance regressions

---

**Status**: Phase 3 Complete ✅  
**Next**: Phase 4 - API Migration & RLS Policies  
**Last Updated**: 2025-01-30


