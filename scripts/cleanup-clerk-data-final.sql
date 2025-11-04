-- Script to permanently delete all Clerk-related data from the database
-- This version checks for table/column existence before deleting
-- WARNING: This is irreversible! 

-- Step 1: Delete from tables that definitely exist and have Clerk data

BEGIN;

-- Delete carrier profile history for Clerk-only users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carrier_profile_history') THEN
    DELETE FROM carrier_profile_history 
    WHERE carrier_user_id NOT IN (
      SELECT supabase_user_id FROM carrier_profiles WHERE supabase_user_id IS NOT NULL
    )
    AND carrier_user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from carrier_profile_history';
  END IF;
END $$;

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

-- Delete assignments - use carrier_user_id column
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'assignments') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'assignments' AND column_name = 'carrier_user_id'
    ) THEN
      DELETE FROM assignments 
      WHERE supabase_user_id IS NULL 
      AND carrier_user_id IS NOT NULL
      AND carrier_user_id NOT IN (
        SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
      );
      RAISE NOTICE 'Deleted from assignments';
    END IF;
  END IF;
END $$;

-- Delete telegram bid offers (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'telegram_bid_offers') THEN
    DELETE FROM telegram_bid_offers 
    WHERE supabase_user_id IS NULL 
    AND user_id IS NOT NULL
    AND user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from telegram_bid_offers';
  END IF;
END $$;

-- Delete carrier bid history (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carrier_bid_history') THEN
    DELETE FROM carrier_bid_history 
    WHERE supabase_carrier_user_id IS NULL 
    AND carrier_user_id IS NOT NULL
    AND carrier_user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from carrier_bid_history';
  END IF;
END $$;

-- Delete carrier favorites (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carrier_favorites') THEN
    DELETE FROM carrier_favorites 
    WHERE supabase_carrier_user_id IS NULL 
    AND carrier_user_id IS NOT NULL
    AND carrier_user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from carrier_favorites';
  END IF;
END $$;

-- Delete notification triggers (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_triggers') THEN
    DELETE FROM notification_triggers 
    WHERE supabase_carrier_user_id IS NULL 
    AND carrier_user_id IS NOT NULL
    AND carrier_user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from notification_triggers';
  END IF;
END $$;

-- Delete notification logs (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_logs') THEN
    DELETE FROM notification_logs 
    WHERE supabase_carrier_user_id IS NULL 
    AND carrier_user_id IS NOT NULL
    AND carrier_user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from notification_logs';
  END IF;
END $$;

-- Delete carrier notification preferences (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carrier_notification_preferences') THEN
    DELETE FROM carrier_notification_preferences 
    WHERE supabase_carrier_user_id IS NULL 
    AND carrier_user_id IS NOT NULL
    AND carrier_user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from carrier_notification_preferences';
  END IF;
END $$;

-- Delete conversations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
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
    RAISE NOTICE 'Deleted from conversations';
  END IF;
END $$;

-- Delete conversation messages (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_messages') THEN
    DELETE FROM conversation_messages 
    WHERE supabase_sender_id IS NULL 
    AND sender_id IS NOT NULL
    AND sender_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from conversation_messages';
  END IF;
END $$;

-- Delete message reads (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'message_reads') THEN
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
      RAISE NOTICE 'Deleted from message_reads';
    END IF;
  END IF;
END $$;

-- Delete carrier chat messages (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'carrier_chat_messages') THEN
    DELETE FROM carrier_chat_messages 
    WHERE supabase_carrier_user_id IS NULL 
    AND carrier_user_id IS NOT NULL
    AND carrier_user_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from carrier_chat_messages';
  END IF;
END $$;

-- Delete admin messages (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_messages') THEN
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
    RAISE NOTICE 'Deleted from admin_messages';
  END IF;
END $$;

-- Delete bid messages (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bid_messages') THEN
    DELETE FROM bid_messages 
    WHERE supabase_sender_id IS NULL 
    AND sender_id IS NOT NULL
    AND sender_id NOT IN (
      SELECT supabase_user_id FROM user_roles_cache WHERE supabase_user_id IS NOT NULL
    );
    RAISE NOTICE 'Deleted from bid_messages';
  END IF;
END $$;

-- Finally, delete carrier profiles with only clerk_user_id (no supabase_user_id)
DELETE FROM carrier_profiles 
WHERE supabase_user_id IS NULL 
AND clerk_user_id IS NOT NULL;

COMMIT;

-- Display summary
SELECT 
  'Summary' as info,
  'Cleanup completed!' as message,
  (SELECT COUNT(*) FROM carrier_profiles WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL) as remaining_clerk_profiles,
  (SELECT COUNT(*) FROM carrier_bids WHERE supabase_user_id IS NULL AND clerk_user_id IS NOT NULL) as remaining_clerk_bids;


