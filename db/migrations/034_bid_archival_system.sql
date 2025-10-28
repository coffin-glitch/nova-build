-- Migration: Bid Archival System
-- Description: Implements automatic archival of expired bids and historical tracking

-- Create archived_bids table for storing expired bids
CREATE TABLE IF NOT EXISTS archived_bids (
    id SERIAL PRIMARY KEY,
    bid_number VARCHAR(50) UNIQUE NOT NULL,
    distance_miles INTEGER NOT NULL,
    pickup_timestamp TIMESTAMPTZ NOT NULL,
    delivery_timestamp TIMESTAMPTZ NOT NULL,
    stops JSONB NOT NULL,
    tag VARCHAR(20),
    source_channel VARCHAR(50) NOT NULL,
    forwarded_to VARCHAR(50),
    received_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ DEFAULT NOW(),
    original_id INTEGER -- Reference to original telegram_bids record
);

-- Create indexes for archived_bids
CREATE INDEX IF NOT EXISTS idx_archived_bids_date ON archived_bids(archived_at);
CREATE INDEX IF NOT EXISTS idx_archived_bids_bid_number ON archived_bids(bid_number);
CREATE INDEX IF NOT EXISTS idx_archived_bids_received_at ON archived_bids(received_at);

-- Create carrier_bid_history table for tracking carrier bid history
CREATE TABLE IF NOT EXISTS carrier_bid_history (
    id SERIAL PRIMARY KEY,
    carrier_user_id VARCHAR(255) NOT NULL,
    bid_number VARCHAR(50) NOT NULL,
    bid_amount_cents INTEGER NOT NULL,
    bid_status VARCHAR(20) NOT NULL, -- 'won', 'lost', 'pending', 'cancelled'
    bid_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for carrier_bid_history
CREATE INDEX IF NOT EXISTS idx_carrier_bid_history_user ON carrier_bid_history(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_carrier_bid_history_bid_number ON carrier_bid_history(bid_number);
CREATE INDEX IF NOT EXISTS idx_carrier_bid_history_status ON carrier_bid_history(bid_status);
CREATE INDEX IF NOT EXISTS idx_carrier_bid_history_created_at ON carrier_bid_history(created_at);

-- Create notification_triggers table for smart notifications
CREATE TABLE IF NOT EXISTS notification_triggers (
    id SERIAL PRIMARY KEY,
    carrier_user_id VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- 'similar_load', 'exact_match', 'price_drop', 'new_route'
    trigger_config JSONB NOT NULL, -- Configuration for the trigger
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for notification_triggers
CREATE INDEX IF NOT EXISTS idx_notification_triggers_user ON notification_triggers(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_triggers_type ON notification_triggers(trigger_type);
CREATE INDEX IF NOT EXISTS idx_notification_triggers_active ON notification_triggers(is_active);

-- Create notification_logs table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_logs (
    id SERIAL PRIMARY KEY,
    carrier_user_id VARCHAR(255) NOT NULL,
    trigger_id INTEGER REFERENCES notification_triggers(id),
    notification_type VARCHAR(50) NOT NULL,
    bid_number VARCHAR(50),
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivery_status VARCHAR(20) DEFAULT 'sent' -- 'sent', 'delivered', 'failed'
);

-- Create indexes for notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_user ON notification_logs(carrier_user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(delivery_status);

-- Add columns to existing tables if they don't exist
DO $$ 
BEGIN
    -- Add archival tracking to telegram_bids
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'telegram_bids' AND column_name = 'is_archived') THEN
        ALTER TABLE telegram_bids ADD COLUMN is_archived BOOLEAN DEFAULT false;
    END IF;
    
    -- Add archival timestamp to telegram_bids
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'telegram_bids' AND column_name = 'archived_at') THEN
        ALTER TABLE telegram_bids ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;
    
    -- Add bid outcome to carrier_bids
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carrier_bids' AND column_name = 'bid_outcome') THEN
        ALTER TABLE carrier_bids ADD COLUMN bid_outcome VARCHAR(20) DEFAULT 'pending';
    END IF;
    
    -- Add final bid amount to carrier_bids
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'carrier_bids' AND column_name = 'final_amount_cents') THEN
        ALTER TABLE carrier_bids ADD COLUMN final_amount_cents INTEGER;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_telegram_bids_is_archived ON telegram_bids(is_archived);
CREATE INDEX IF NOT EXISTS idx_telegram_bids_archived_at ON telegram_bids(archived_at);
CREATE INDEX IF NOT EXISTS idx_carrier_bids_outcome ON carrier_bids(bid_outcome);

-- Create function to automatically archive expired bids
CREATE OR REPLACE FUNCTION archive_expired_bids()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Archive bids that are expired and not already archived
    WITH archived AS (
        INSERT INTO archived_bids (
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at, original_id
        )
        SELECT 
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at, id
        FROM telegram_bids
        WHERE is_archived = false 
        AND NOW() > (received_at::timestamp + INTERVAL '25 minutes')
        RETURNING id
    )
    UPDATE telegram_bids 
    SET is_archived = true, archived_at = NOW()
    WHERE id IN (SELECT original_id FROM archived);
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old archived bids (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_archived_bids()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM archived_bids 
    WHERE archived_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get carrier bid history
CREATE OR REPLACE FUNCTION get_carrier_bid_history(p_user_id VARCHAR(255))
RETURNS TABLE (
    bid_number VARCHAR(50),
    bid_amount_cents INTEGER,
    bid_status VARCHAR(20),
    bid_notes TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    distance_miles INTEGER,
    pickup_timestamp TIMESTAMPTZ,
    delivery_timestamp TIMESTAMPTZ,
    stops JSONB,
    tag VARCHAR(20),
    source_channel VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cb.bid_number,
        cb.amount_cents,
        COALESCE(cb.bid_outcome, 'pending')::VARCHAR(20),
        cb.notes,
        cb.created_at,
        cb.updated_at,
        COALESCE(tb.distance_miles, 0),
        COALESCE(tb.pickup_timestamp, cb.created_at),
        COALESCE(tb.delivery_timestamp, cb.created_at + INTERVAL '1 day'),
        COALESCE(tb.stops, '[]'::JSONB),
        tb.tag,
        COALESCE(tb.source_channel, 'unknown')
    FROM carrier_bids cb
    LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
    WHERE cb.clerk_user_id = p_user_id
    ORDER BY cb.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to check for similar loads (for notifications)
CREATE OR REPLACE FUNCTION find_similar_loads(
    p_carrier_user_id VARCHAR(255),
    p_distance_threshold INTEGER DEFAULT 50,
    p_state_preferences TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    bid_number VARCHAR(50),
    similarity_score INTEGER,
    distance_miles INTEGER,
    pickup_timestamp TIMESTAMPTZ,
    delivery_timestamp TIMESTAMPTZ,
    stops JSONB,
    tag VARCHAR(20),
    source_channel VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    WITH carrier_preferences AS (
        SELECT 
            COALESCE(distance_threshold_miles, 50) as dist_threshold,
            COALESCE(state_preferences, ARRAY[]::TEXT[]) as states
        FROM carrier_notification_preferences 
        WHERE carrier_user_id = p_carrier_user_id
        LIMIT 1
    ),
    favorite_routes AS (
        SELECT DISTINCT
            tb.distance_miles,
            tb.stops,
            tb.tag,
            tb.pickup_timestamp,
            tb.delivery_timestamp
        FROM carrier_favorites cf
        JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
        WHERE cf.carrier_user_id = p_carrier_user_id
    )
    SELECT 
        tb.bid_number,
        CASE 
            WHEN ABS(tb.distance_miles - fr.distance_miles) <= cp.dist_threshold THEN 100 - ABS(tb.distance_miles - fr.distance_miles)
            ELSE 0
        END::INTEGER as similarity_score,
        tb.distance_miles,
        tb.pickup_timestamp,
        tb.delivery_timestamp,
        tb.stops,
        tb.tag,
        tb.source_channel
    FROM telegram_bids tb
    CROSS JOIN carrier_preferences cp
    CROSS JOIN favorite_routes fr
    WHERE tb.is_archived = false
    AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
    AND (
        cp.states = ARRAY[]::TEXT[] OR 
        tb.tag = ANY(cp.states)
    )
    AND ABS(tb.distance_miles - fr.distance_miles) <= cp.dist_threshold
    ORDER BY similarity_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Insert sample notification preferences for existing users
INSERT INTO carrier_notification_preferences (carrier_user_id, email_notifications, similar_load_notifications, distance_threshold_miles, state_preferences, equipment_preferences, min_distance, max_distance)
SELECT DISTINCT 
    clerk_user_id,
    true,
    true,
    50,
    ARRAY[]::TEXT[],
    ARRAY[]::TEXT[],
    0,
    2000
FROM carrier_bids
WHERE clerk_user_id NOT IN (SELECT carrier_user_id FROM carrier_notification_preferences)
ON CONFLICT (carrier_user_id) DO NOTHING;

-- Create a view for easy access to active bids (non-archived)
CREATE OR REPLACE VIEW active_telegram_bids AS
SELECT * FROM telegram_bids 
WHERE is_archived = false 
AND NOW() <= (received_at::timestamp + INTERVAL '25 minutes');

-- Create a view for archived bids with metadata
CREATE OR REPLACE VIEW archived_bids_with_metadata AS
SELECT 
    ab.*,
    EXTRACT(EPOCH FROM (ab.archived_at - ab.received_at)) / 3600 as hours_active,
    CASE 
        WHEN ab.tag IS NOT NULL THEN ab.tag
        ELSE 'UNKNOWN'
    END as state_tag
FROM archived_bids ab;

COMMENT ON TABLE archived_bids IS 'Stores expired bids that have been automatically archived';
COMMENT ON TABLE carrier_bid_history IS 'Tracks complete history of carrier bids for historical analysis';
COMMENT ON TABLE notification_triggers IS 'Stores intelligent notification triggers for carriers';
COMMENT ON TABLE notification_logs IS 'Logs all notifications sent to carriers';
COMMENT ON FUNCTION archive_expired_bids() IS 'Automatically archives expired bids';
COMMENT ON FUNCTION cleanup_old_archived_bids() IS 'Cleans up archived bids older than 90 days';
COMMENT ON FUNCTION get_carrier_bid_history(VARCHAR) IS 'Returns complete bid history for a carrier';
COMMENT ON FUNCTION find_similar_loads(VARCHAR, INTEGER, TEXT[]) IS 'Finds similar loads for notification triggers';
