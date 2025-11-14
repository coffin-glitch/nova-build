-- Migration: Create notification_logs archival system
-- Description: Creates archival table and function for cleaning up old notification logs
-- Date: 2025-01-14

-- Create archival table for old notification logs
CREATE TABLE IF NOT EXISTS notification_logs_archive (
    id SERIAL PRIMARY KEY,
    carrier_user_id VARCHAR(255),
    supabase_carrier_user_id TEXT,
    trigger_id INTEGER,
    notification_type VARCHAR(50) NOT NULL,
    bid_number VARCHAR(50),
    message TEXT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL,
    delivery_status VARCHAR(20) DEFAULT 'sent',
    archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes on archive table for potential queries
CREATE INDEX IF NOT EXISTS idx_notification_logs_archive_user 
ON notification_logs_archive(supabase_carrier_user_id) 
WHERE supabase_carrier_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notification_logs_archive_sent_at 
ON notification_logs_archive(sent_at);

CREATE INDEX IF NOT EXISTS idx_notification_logs_archive_type 
ON notification_logs_archive(notification_type);

-- Function to archive old notification logs (older than 90 days)
CREATE OR REPLACE FUNCTION archive_old_notification_logs()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move logs older than 90 days to archive table
    WITH archived AS (
        INSERT INTO notification_logs_archive (
            carrier_user_id,
            supabase_carrier_user_id,
            trigger_id,
            notification_type,
            bid_number,
            message,
            sent_at,
            delivery_status
        )
        SELECT 
            carrier_user_id,
            supabase_carrier_user_id,
            trigger_id,
            notification_type,
            bid_number,
            message,
            sent_at,
            delivery_status
        FROM notification_logs
        WHERE sent_at < NOW() - INTERVAL '90 days'
        RETURNING id
    )
    SELECT COUNT(*) INTO archived_count FROM archived;
    
    -- Delete archived logs from main table
    DELETE FROM notification_logs
    WHERE sent_at < NOW() - INTERVAL '90 days';
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up archive table (optional - for very old archives)
-- Keeps last 1 year of archived data
CREATE OR REPLACE FUNCTION cleanup_old_archived_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notification_logs_archive
    WHERE archived_at < NOW() - INTERVAL '1 year';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE notification_logs_archive IS 
  'Archived notification logs older than 90 days. Used for historical analytics and compliance.';

COMMENT ON FUNCTION archive_old_notification_logs() IS 
  'Archives notification logs older than 90 days to notification_logs_archive table. Returns count of archived records.';

COMMENT ON FUNCTION cleanup_old_archived_logs() IS 
  'Removes archived logs older than 1 year. Use sparingly for compliance/retention requirements.';

