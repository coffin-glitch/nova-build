-- Migration: Fix Archived Bids System
-- Description: Organizes archived_bids properly with correct archived_at timestamps
--              and wires expired bids to flow into archived_bids properly

-- Step 1: Set all existing archived_at values to 23:59:59 of the same day they were received
UPDATE archived_bids
SET archived_at = DATE_TRUNC('day', received_at) + INTERVAL '23 hours 59 minutes 59 seconds'
WHERE archived_at IS NOT NULL;

-- Step 2: Ensure archived_at has a proper default value (end of day)
ALTER TABLE archived_bids 
ALTER COLUMN archived_at DROP DEFAULT;

-- Step 3: Update the archive_expired_bids function to:
--   - Leave archived_at NULL when bids expire (so they show in expired bids)
--   - Only set archived_at at end of day (via scheduled job)
CREATE OR REPLACE FUNCTION archive_expired_bids()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Archive bids that are expired and not already archived
    -- Set archived_at to NULL so they show in expired bids view
    WITH archived AS (
        INSERT INTO archived_bids (
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at, archived_at, original_id
        )
        SELECT 
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at, NULL, id
        FROM telegram_bids
        WHERE is_archived = false 
        AND NOW() > (received_at::timestamp + INTERVAL '25 minutes')
        RETURNING id
    )
    UPDATE telegram_bids 
    SET is_archived = true, archived_at = NULL
    WHERE id IN (SELECT original_id FROM archived);
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create function to set archived_at to end of day for all bids without archived_at
-- This should run at 23:59:59 daily
CREATE OR REPLACE FUNCTION set_end_of_day_archived_timestamps()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE archived_bids
    SET archived_at = DATE_TRUNC('day', received_at) + INTERVAL '23 hours 59 minutes 59 seconds'
    WHERE archived_at IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Drop the archived_bids_with_metadata view if it exists
DROP VIEW IF EXISTS archived_bids_with_metadata CASCADE;

-- Step 6: Update active_telegram_bids view to ensure it uses expires_at if available
CREATE OR REPLACE VIEW active_telegram_bids AS
SELECT * FROM telegram_bids 
WHERE is_archived = false 
AND (
    (expires_at IS NOT NULL AND NOW() <= expires_at)
    OR (expires_at IS NULL AND NOW() <= (received_at::timestamp + INTERVAL '25 minutes'))
);

-- Step 7: Create a view for expired bids (in archived_bids but archived_at is NULL)
CREATE OR REPLACE VIEW expired_bids AS
SELECT * FROM archived_bids
WHERE archived_at IS NULL
ORDER BY received_at DESC;

-- Step 8: Ensure proper indexes
CREATE INDEX IF NOT EXISTS idx_archived_bids_archived_at_null ON archived_bids(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_telegram_bids_expires_at ON telegram_bids(expires_at);

-- Add comment
COMMENT ON FUNCTION archive_expired_bids() IS 'Archives expired bids with NULL archived_at for expired bids view';
COMMENT ON FUNCTION set_end_of_day_archived_timestamps() IS 'Sets archived_at to end of day for bids still showing as expired';

