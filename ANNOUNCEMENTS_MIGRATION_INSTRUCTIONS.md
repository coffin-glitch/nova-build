# Announcements System Migration Instructions

## ⚠️ IMPORTANT: Run Migration First

The announcements system requires database tables to be created. You must run the migration before using the announcements feature.

## Quick Start

### Option 1: Run Migration Script (Recommended)

```bash
npx tsx scripts/run-announcements-migration.ts
```

### Option 2: Run Migration Manually via Supabase

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `db/migrations/114_create_announcements_system.sql`
4. Paste and run it

### Option 3: Run Migration via psql

```bash
psql $DATABASE_URL -f db/migrations/114_create_announcements_system.sql
```

## What the Migration Creates

- ✅ `announcements` table - Stores announcement content
- ✅ `announcement_reads` table - Tracks which carriers have read each announcement
- ✅ Updates `notifications` table to include 'announcement' type
- ✅ Creates indexes for performance

## Verify Migration

After running the migration, verify it worked:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('announcements', 'announcement_reads');

-- Should return 2 rows
```

## Troubleshooting

If you see 500 errors:
1. ✅ Make sure the migration has been run
2. ✅ Check that your `DATABASE_URL` is correct
3. ✅ Verify you're connected to the right database
4. ✅ Check server logs for specific SQL errors

