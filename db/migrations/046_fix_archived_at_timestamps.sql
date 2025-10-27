-- Migration: Fix archived_at timestamps to follow UTC best practices
-- Description: Update all archived_at values to be (received_at + 1 day) at end of day (04:59:59 UTC)

-- Step 1: For bids that are already archived, fix their archived_at timestamp
-- Logic: archived_at should be received_at + 1 day at 04:59:59 UTC
-- This represents the end of the day when the bid was received (in CDT timezone)
UPDATE telegram_bids
SET archived_at = (received_at::date + INTERVAL '1 day')::timestamp + INTERVAL '4 hours 59 minutes 59 seconds'
WHERE archived_at IS NOT NULL
  AND is_archived = true;

-- Step 2: Update the set_end_of_day_archived_timestamps function to use correct logic
-- The function should set archived_at for bids received yesterday (in CDT) to today at 04:59:59 UTC
CREATE OR REPLACE FUNCTION set_end_of_day_archived_timestamps()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
    target_utc_timestamp TIMESTAMP;
BEGIN
    -- For bids received on the previous day in CDT, set archived_at to end of day
    -- Example: Bids received on Oct 26 (CDT) should get archived_at = Oct 27 04:59:59 UTC
    -- This equals Oct 26 23:59:59 CDT (end of day)
    
    -- Get bids that were received yesterday in CDT timezone
    UPDATE telegram_bids
    SET 
      archived_at = received_at::date + INTERVAL '1 day 4 hours 59 minutes 59 seconds',
      is_archived = true
    WHERE archived_at IS NULL
      AND is_archived = false
      AND DATE(received_at AT TIME ZONE 'America/Chicago') = CURRENT_DATE - INTERVAL '1 day';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_end_of_day_archived_timestamps() IS 'Archives bids from yesterday (CDT) by setting archived_at to end of day UTC equivalent (received_at + 1 day + 04:59:59 UTC). Represents end of day in CDT timezone.';

