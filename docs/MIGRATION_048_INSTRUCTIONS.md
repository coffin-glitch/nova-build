# Migration 048 Instructions - Add admin_notes to auction_awards

## Status
✅ Migration file created: `db/migrations/048_add_admin_notes_to_auction_awards.sql`  
⚠️ **Migration not yet applied to database**

## What This Fixes
The "Failed to award bid" error when clicking "Adjudicate" button. The error occurs because the code tries to insert `admin_notes` into `auction_awards` table but the column doesn't exist yet.

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run this SQL:

```sql
-- Migration 048: Add admin_notes column to auction_awards table
ALTER TABLE auction_awards 
ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN auction_awards.admin_notes IS 'Optional notes from admin when adjudicating/awarding an auction';
```

4. Click "Run" to execute

### Option 2: Via Supabase CLI
```bash
supabase db push
```
(If you have Supabase migrations configured)

### Option 3: Via Railway (if deployed there)
1. Go to your Railway project
2. Open the database service
3. Click "Database" tab
4. Run the SQL from the migration file in the query editor

## Verify It Worked
Run this query to confirm the column exists:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'auction_awards' 
AND column_name = 'admin_notes';
```

You should see:
```
column_name  | data_type | is_nullable
-------------+-----------+------------
admin_notes  | text      | YES
```

## After Applying
Once the migration is applied, the adjudication system will work completely:
- ✅ Admin can click "Adjudicate" 
- ✅ Select winner and add admin notes
- ✅ Award is created successfully
- ✅ Notifications sent to all bidders
- ✅ Load assignment created

## Related Files
- Migration: `db/migrations/048_add_admin_notes_to_auction_awards.sql`
- Code fix: `lib/auctions.ts` (line 439)
- Route fix: `app/api/admin/bids/[bidNumber]/award/route.ts`
- Documentation: `docs/ADJUDICATE_SYSTEM_FULL_ANALYSIS.md`

