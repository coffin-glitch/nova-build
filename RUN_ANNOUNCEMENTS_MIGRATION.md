# 🚀 Run Announcements Migration - Quick Guide

## The Error
```
relation "announcements" does not exist
```

This means the database tables haven't been created yet. You need to run the migration.

## ✅ Quick Fix: Run via Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to your Supabase project
   - Click on **SQL Editor** in the left sidebar

2. **Copy the Migration SQL**
   - Open the file: `db/migrations/114_create_announcements_system.sql`
   - Copy ALL the contents

3. **Paste and Run**
   - Paste the SQL into the Supabase SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)

4. **Verify**
   - You should see "Success. No rows returned"
   - The tables are now created!

## Alternative: Run via Command Line

If you have `DATABASE_URL` set in your environment:

```bash
# Load environment variables first
source .env.local  # or export DATABASE_URL=...

# Then run the migration
npx tsx scripts/run-announcements-migration.ts
```

Or directly with psql:

```bash
psql $DATABASE_URL -f db/migrations/114_create_announcements_system.sql
```

## What Gets Created

✅ `announcements` table - Stores announcement content  
✅ `announcement_reads` table - Tracks read status  
✅ Updates `notifications` table - Adds 'announcement' type  
✅ Creates indexes - For performance  

## After Running

Once the migration is complete, refresh your browser and the announcements system should work!

