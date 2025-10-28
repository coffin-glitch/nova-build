-- Migration: Fix Archive Function
-- Description: Fix the archive_expired_bids function to work correctly

CREATE OR REPLACE FUNCTION archive_expired_bids()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
    archived_rows INTEGER;
BEGIN
    -- Archive bids that are expired and not already archived
    -- Set archived_at to NULL so they show in expired bids view
    WITH expired_bids AS (
        SELECT 
            id,
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at
        FROM telegram_bids
        WHERE is_archived = false 
        AND NOW() > (received_at::timestamp + INTERVAL '25 minutes')
    ),
    archived AS (
        INSERT INTO archived_bids (
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at, archived_at, original_id
        )
        SELECT 
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at, NULL, id
        FROM expired_bids
        ON CONFLICT (bid_number) DO NOTHING
        RETURNING original_id
    )
    UPDATE telegram_bids 
    SET is_archived = true, archived_at = NULL
    WHERE id IN (SELECT original_id FROM archived);
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION archive_expired_bids() IS 'Archives expired bids with NULL archived_at for expired bids view';

