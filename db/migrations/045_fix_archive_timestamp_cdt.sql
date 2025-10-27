-- Migration: Fix Archive Timestamp to Use 23:59:59 CDT (04:59:59 UTC)
-- Description: Reset archived_at for test date and update archiving to set UTC time correctly

-- Step 1: Reset archived_at for Oct 26, 2025 bids for testing
UPDATE telegram_bids
SET archived_at = NULL
WHERE received_at::date = '2025-10-26';

-- Step 2: Update the set_end_of_day_archived_timestamps function
-- This function should set archived_at to 23:59:59 CDT (which is 04:59:59 UTC the next day)
CREATE OR REPLACE FUNCTION set_end_of_day_archived_timestamps()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
    target_utc_timestamp TIMESTAMP;
BEGIN
    -- Calculate target UTC timestamp (23:59:59 CDT = 04:59:59 UTC next day)
    -- For bids received yesterday in CDT, set archived_at to 04:59:59 UTC today
    target_utc_timestamp := (CURRENT_DATE + INTERVAL '4 hours 59 minutes 59 seconds');
    
    UPDATE telegram_bids
    SET 
      archived_at = target_utc_timestamp,
      is_archived = true
    WHERE archived_at IS NULL
      AND is_archived = false
      AND (received_at AT TIME ZONE 'America/Chicago')::date = (CURRENT_DATE - INTERVAL '1 day');
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_end_of_day_archived_timestamps() IS 'Sets archived_at to 04:59:59 UTC (23:59:59 CDT) for bids received yesterday, also sets is_archived = true';

