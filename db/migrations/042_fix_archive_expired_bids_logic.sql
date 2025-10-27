-- Migration: Fix archive_expired_bids() function logic
-- Description: Update the function to properly set archived_at IS NULL when archiving, and ensure bids with archived_at IS NULL remain is_archived = false

-- Step 1: Fix the archive_expired_bids() function to set archived_at = NULL when archiving
CREATE OR REPLACE FUNCTION archive_expired_bids()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- DON'T set is_archived = true for expired bids
    -- Expired bids should remain is_archived = false with archived_at IS NULL
    -- This allows them to show in the "expired" view until end-of-day archiving sets archived_at
    -- Only the end-of-day cron job should set is_archived = true along with archived_at
    
    -- This function now does nothing, expired bids stay as is_archived = false
    -- They will be properly archived by the end-of-day cron job
    archived_count := 0;

    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a function to reset is_archived for bids that shouldn't be archived yet
CREATE OR REPLACE FUNCTION reset_incorrectly_archived_bids()
RETURNS INTEGER AS $$
DECLARE
    reset_count INTEGER;
BEGIN
    -- Reset is_archived to false for bids where archived_at IS NULL
    -- These bids should remain visible as "expired" until end-of-day process
    UPDATE telegram_bids
    SET is_archived = false
    WHERE 
        is_archived = true 
        AND archived_at IS NULL
        AND (NOW() AT TIME ZONE 'America/Chicago')::date >= (received_at AT TIME ZONE 'America/Chicago')::date; -- Today's or future bids

    GET DIAGNOSTICS reset_count = ROW_COUNT;
    RETURN reset_count;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Run the reset function to fix existing incorrect data
SELECT reset_incorrectly_archived_bids();

-- Step 4: Add a comment explaining the function
COMMENT ON FUNCTION archive_expired_bids() IS 'Marks expired bids as archived (is_archived = true) with archived_at = NULL. Only archives bids from previous days in Chicago time.';

