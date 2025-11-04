-- Migration 083: Add unique constraint on carrier_bids for (bid_number, supabase_user_id)
-- Description: Creates a unique constraint to replace the old (bid_number, clerk_user_id) constraint
-- This is required for the ON CONFLICT clause in upsertCarrierBid to work properly

BEGIN;

-- Drop the old unique constraint if it exists (should have been removed in migration 078, but being safe)
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  FOR constraint_record IN (
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'carrier_bids' 
    AND constraint_type = 'UNIQUE'
    AND constraint_name LIKE '%bid%user%'
  ) LOOP
    EXECUTE format('ALTER TABLE carrier_bids DROP CONSTRAINT IF EXISTS %I CASCADE', constraint_record.constraint_name);
  END LOOP;
END $$;

-- Add unique constraint on (bid_number, supabase_user_id)
-- This ensures one bid per user per bid_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'carrier_bids' 
    AND constraint_name = 'carrier_bids_bid_number_supabase_user_id_unique'
  ) THEN
    ALTER TABLE carrier_bids 
    ADD CONSTRAINT carrier_bids_bid_number_supabase_user_id_unique 
    UNIQUE (bid_number, supabase_user_id);
    
    RAISE NOTICE 'Added unique constraint on (bid_number, supabase_user_id)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists';
  END IF;
END $$;

COMMIT;

-- Display summary
DO $$
BEGIN
  RAISE NOTICE '✅ Migration complete: Unique constraint added to carrier_bids';
  RAISE NOTICE '⚠️  Ensure supabase_user_id is NOT NULL for all carrier_bids rows';
END $$;

