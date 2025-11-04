-- Migration 053: Add Supabase User ID Support (Phase 3)
-- Description: Adds supabase_user_id columns to all tables for dual-auth support
-- This migration is NON-BREAKING: all columns are nullable, existing queries continue to work

-- ============================================================================
-- TABLE: user_roles_cache
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_roles_cache' AND column_name = 'supabase_user_id'
    ) THEN
        ALTER TABLE user_roles_cache ADD COLUMN supabase_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_user_roles_cache_supabase_user_id 
            ON user_roles_cache(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        
        -- Add comment
        COMMENT ON COLUMN user_roles_cache.supabase_user_id IS 
            'Supabase user ID for dual-auth support. Maps to clerk_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: carrier_profiles
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_profiles' AND column_name = 'supabase_user_id'
    ) THEN
        ALTER TABLE carrier_profiles ADD COLUMN supabase_user_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_carrier_profiles_supabase_user_id 
            ON carrier_profiles(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_carrier_profiles_supabase_user_id_lookup 
            ON carrier_profiles(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        
        COMMENT ON COLUMN carrier_profiles.supabase_user_id IS 
            'Supabase user ID for dual-auth support. Maps to clerk_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: carrier_bids
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_bids' AND column_name = 'supabase_user_id'
    ) THEN
        ALTER TABLE carrier_bids ADD COLUMN supabase_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_carrier_bids_supabase_user_id 
            ON carrier_bids(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_carrier_bids_bid_number_supabase_user_id 
            ON carrier_bids(bid_number, supabase_user_id) 
            WHERE supabase_user_id IS NOT NULL;
        
        COMMENT ON COLUMN carrier_bids.supabase_user_id IS 
            'Supabase user ID for dual-auth support. Maps to clerk_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: auction_awards (winner_user_id and awarded_by)
-- ============================================================================
DO $$ 
BEGIN
    -- Add supabase_user_id for winner
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_awards' AND column_name = 'supabase_winner_user_id'
    ) THEN
        ALTER TABLE auction_awards ADD COLUMN supabase_winner_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_auction_awards_supabase_winner_user_id 
            ON auction_awards(supabase_winner_user_id) WHERE supabase_winner_user_id IS NOT NULL;
        
        COMMENT ON COLUMN auction_awards.supabase_winner_user_id IS 
            'Supabase user ID of winning carrier. Maps to winner_user_id via email.';
    END IF;
    
    -- Add supabase_user_id for awarded_by (admin)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'auction_awards' AND column_name = 'supabase_awarded_by'
    ) THEN
        ALTER TABLE auction_awards ADD COLUMN supabase_awarded_by TEXT;
        CREATE INDEX IF NOT EXISTS idx_auction_awards_supabase_awarded_by 
            ON auction_awards(supabase_awarded_by) WHERE supabase_awarded_by IS NOT NULL;
        
        COMMENT ON COLUMN auction_awards.supabase_awarded_by IS 
            'Supabase user ID of admin who awarded. Maps to awarded_by via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: conversations
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_conversations_supabase_carrier_user_id 
            ON conversations(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN conversations.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'supabase_admin_user_id'
    ) THEN
        ALTER TABLE conversations ADD COLUMN supabase_admin_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_conversations_supabase_admin_user_id 
            ON conversations(supabase_admin_user_id) WHERE supabase_admin_user_id IS NOT NULL;
        
        COMMENT ON COLUMN conversations.supabase_admin_user_id IS 
            'Supabase user ID of admin. Maps to admin_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: conversation_messages
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversation_messages' AND column_name = 'supabase_sender_id'
    ) THEN
        ALTER TABLE conversation_messages ADD COLUMN supabase_sender_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_conversation_messages_supabase_sender_id 
            ON conversation_messages(supabase_sender_id) WHERE supabase_sender_id IS NOT NULL;
        
        COMMENT ON COLUMN conversation_messages.supabase_sender_id IS 
            'Supabase user ID of sender. Maps to sender_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: message_reads
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'message_reads' AND column_name = 'supabase_user_id'
    ) THEN
        ALTER TABLE message_reads ADD COLUMN supabase_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_message_reads_supabase_user_id 
            ON message_reads(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        
        COMMENT ON COLUMN message_reads.supabase_user_id IS 
            'Supabase user ID. Maps to user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: carrier_chat_messages
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_chat_messages' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE carrier_chat_messages ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_carrier_chat_messages_supabase_user_id 
            ON carrier_chat_messages(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN carrier_chat_messages.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: admin_messages
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_messages' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE admin_messages ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_admin_messages_supabase_carrier_user_id 
            ON admin_messages(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN admin_messages.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admin_messages' AND column_name = 'supabase_admin_user_id'
    ) THEN
        ALTER TABLE admin_messages ADD COLUMN supabase_admin_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_admin_messages_supabase_admin_user_id 
            ON admin_messages(supabase_admin_user_id) WHERE supabase_admin_user_id IS NOT NULL;
        
        COMMENT ON COLUMN admin_messages.supabase_admin_user_id IS 
            'Supabase user ID of admin. Maps to admin_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: load_offers
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'load_offers' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE load_offers ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_load_offers_supabase_carrier_user_id 
            ON load_offers(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN load_offers.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: assignments
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'assignments' AND column_name = 'supabase_user_id'
    ) THEN
        ALTER TABLE assignments ADD COLUMN supabase_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_assignments_supabase_user_id 
            ON assignments(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        
        COMMENT ON COLUMN assignments.supabase_user_id IS 
            'Supabase user ID. Maps to user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: telegram_bid_offers
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'telegram_bid_offers' AND column_name = 'supabase_user_id'
    ) THEN
        ALTER TABLE telegram_bid_offers ADD COLUMN supabase_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_telegram_bid_offers_supabase_user_id 
            ON telegram_bid_offers(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
        
        COMMENT ON COLUMN telegram_bid_offers.supabase_user_id IS 
            'Supabase user ID. Maps to user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: carrier_bid_history
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_bid_history' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE carrier_bid_history ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_carrier_bid_history_supabase_user_id 
            ON carrier_bid_history(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN carrier_bid_history.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: notification_triggers
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_triggers' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE notification_triggers ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_notification_triggers_supabase_user_id 
            ON notification_triggers(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN notification_triggers.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: notification_logs
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_logs' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE notification_logs ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_notification_logs_supabase_user_id 
            ON notification_logs(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN notification_logs.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: carrier_favorites
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_favorites' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE carrier_favorites ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_carrier_favorites_supabase_user_id 
            ON carrier_favorites(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_carrier_favorites_bid_number_supabase_user_id 
            ON carrier_favorites(bid_number, supabase_carrier_user_id) 
            WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN carrier_favorites.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: carrier_notification_preferences
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'carrier_notification_preferences' AND column_name = 'supabase_carrier_user_id'
    ) THEN
        ALTER TABLE carrier_notification_preferences ADD COLUMN supabase_carrier_user_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_carrier_notification_preferences_supabase_user_id 
            ON carrier_notification_preferences(supabase_carrier_user_id) WHERE supabase_carrier_user_id IS NOT NULL;
        
        COMMENT ON COLUMN carrier_notification_preferences.supabase_carrier_user_id IS 
            'Supabase user ID of carrier. Maps to carrier_user_id via email.';
    END IF;
END $$;

-- ============================================================================
-- TABLE: bid_messages
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bid_messages' AND column_name = 'supabase_sender_id'
    ) THEN
        ALTER TABLE bid_messages ADD COLUMN supabase_sender_id TEXT;
        CREATE INDEX IF NOT EXISTS idx_bid_messages_supabase_sender_id 
            ON bid_messages(supabase_sender_id) WHERE supabase_sender_id IS NOT NULL;
        
        COMMENT ON COLUMN bid_messages.supabase_sender_id IS 
            'Supabase user ID of sender. Maps to sender_id via email.';
    END IF;
END $$;

-- ============================================================================
-- Create user mapping view for easy lookups
-- ============================================================================
CREATE OR REPLACE VIEW user_id_mapping AS
SELECT 
    urc.clerk_user_id,
    urc.supabase_user_id,
    urc.email,
    urc.role,
    cp.id as carrier_profile_id,
    CASE 
        WHEN urc.supabase_user_id IS NOT NULL THEN 'mapped'
        ELSE 'unmapped'
    END as mapping_status
FROM user_roles_cache urc
LEFT JOIN carrier_profiles cp ON urc.clerk_user_id = cp.clerk_user_id;

COMMENT ON VIEW user_id_mapping IS 
    'View for easy lookup of Clerk to Supabase user ID mappings via email';

-- ============================================================================
-- Migration complete
-- ============================================================================
-- All supabase_user_id columns are NULLABLE to ensure backward compatibility.
-- Existing queries using clerk_user_id will continue to work.
-- After running the backfill script (scripts/backfill-supabase-user-ids.ts),
-- the supabase_user_id columns will be populated.
-- ============================================================================


