-- Script to permanently delete all Clerk-related data from the database
-- WARNING: This is irreversible! Run this only after confirming all users have migrated to Supabase
-- 
-- This script will:
-- 1. Delete all carrier profiles with only clerk_user_id (no supabase_user_id)
-- 2. Delete all carrier bids with only clerk_user_id
-- 3. Delete all auction awards with only clerk winner_user_id
-- 4. Delete all load offers with only clerk carrier_user_id
-- 5. Delete all assignments with only clerk user_id (if column exists)
-- 6. Delete all other related Clerk data
-- 7. Delete all carrier profile history for Clerk users
--
-- IMPORTANT: Backup your database before running this!

BEGIN;

-- Delete carrier profile history for Clerk-only users
DELETE FROM carrier_profile_history 
WHERE carrier_user_id NOT IN (
  SELECT supabase_user_id FROM carrier_profiles WHERE supabase_user_id IS NOT NULL
)
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete carrier bids with only clerk_user_id
DELETE FROM carrier_bids 
WHERE supabase_user_id IS NULL 
AND clerk_user_id IS NOT NULL;

-- Delete auction awards with only winner_user_id (Clerk)
DELETE FROM auction_awards 
WHERE supabase_winner_user_id IS NULL 
AND winner_user_id IS NOT NULL
AND winner_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete load offers with only carrier_user_id (Clerk)
DELETE FROM load_offers 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete assignments - check if user_id column exists first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignments' AND column_name = 'user_id'
  ) THEN
    DELETE FROM assignments 
    WHERE supabase_user_id IS NULL 
    AND user_id IS NOT NULL
    AND user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
  END IF;
END $$;

-- Delete telegram bid offers with only user_id (Clerk)
DELETE FROM telegram_bid_offers 
WHERE supabase_user_id IS NULL 
AND user_id IS NOT NULL
AND user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete carrier bid history with only carrier_user_id (Clerk)
DELETE FROM carrier_bid_history 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete carrier favorites with only carrier_user_id (Clerk)
DELETE FROM carrier_favorites 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete notification triggers with only carrier_user_id (Clerk)
DELETE FROM notification_triggers 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete notification logs with only carrier_user_id (Clerk)
DELETE FROM notification_logs 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete carrier notification preferences with only carrier_user_id (Clerk)
DELETE FROM carrier_notification_preferences 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete conversations with only Clerk user IDs
DELETE FROM conversations 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

DELETE FROM conversations 
WHERE supabase_admin_user_id IS NULL 
AND admin_user_id IS NOT NULL
AND admin_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete conversation messages with only Clerk sender_id
DELETE FROM conversation_messages 
WHERE supabase_sender_id IS NULL 
AND sender_id IS NOT NULL
AND sender_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete message reads with only Clerk user_id - check if column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'message_reads' AND column_name = 'user_id'
  ) THEN
    DELETE FROM message_reads 
    WHERE supabase_user_id IS NULL 
    AND user_id IS NOT NULL
    AND user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
  END IF;
END $$;

-- Delete carrier chat messages with only Clerk carrier_user_id
DELETE FROM carrier_chat_messages 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete admin messages with only Clerk user IDs
DELETE FROM admin_messages 
WHERE supabase_carrier_user_id IS NULL 
AND carrier_user_id IS NOT NULL
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

DELETE FROM admin_messages 
WHERE supabase_admin_user_id IS NULL 
AND admin_user_id IS NOT NULL
AND admin_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Delete bid messages with only Clerk sender_id
DELETE FROM bid_messages 
WHERE supabase_sender_id IS NULL 
AND sender_id IS NOT NULL
AND sender_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
);

-- Finally, delete carrier profiles with only clerk_user_id (no supabase_user_id)
DELETE FROM carrier_profiles 
WHERE supabase_user_id IS NULL 
AND clerk_user_id IS NOT NULL;

COMMIT;

-- Display summary of remaining Clerk records (if any)
SELECT 
  'carrier_profile_history' as table_name,
  COUNT(*) as remaining_clerk_records
FROM carrier_profile_history 
WHERE carrier_user_id NOT IN (
  SELECT supabase_user_id FROM carrier_profiles WHERE supabase_user_id IS NOT NULL
)
AND carrier_user_id NOT IN (
  SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
)
UNION ALL
SELECT 'carrier_bids', COUNT(*) FROM carrier_bids WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL
UNION ALL
SELECT 'auction_awards', COUNT(*) FROM auction_awards WHERE supabase_winner_user_id IS NULL AND winner_user_id IS NOT NULL
UNION ALL
SELECT 'load_offers', COUNT(*) FROM load_offers WHERE supabase_carrier_user_id IS NULL AND carrier_user_id IS NOT NULL
UNION ALL
SELECT 'carrier_profiles', COUNT(*) FROM carrier_profiles WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL;


