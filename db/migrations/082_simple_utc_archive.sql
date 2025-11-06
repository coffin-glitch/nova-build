-- Migration: Simple UTC-Based Archive Function
-- Description: Simplified archiving that uses UTC time boundaries only
--              - Bids received up to 04:59:59 UTC of next day → archive with previous day
--              - Bids received at/after 05:00:00 UTC → archive with that day
--              - Always use 04:59:59 UTC as archived_at (end of day in Chicago during CDT)
--              - UTC never has DST, so this is simple and consistent
--
-- Date: 2025-11-05

-- ============================================================================
-- FUNCTION: set_end_of_day_archived_timestamps()
-- ============================================================================
-- Simple UTC-based logic:
-- 1. Archive bids received yesterday (UTC date) → archived_at = (yesterday + 1 day) at 04:59:59 UTC
-- 2. ALSO archive bids received today (UTC date) before 05:00:00 UTC → archive with yesterday
CREATE OR REPLACE FUNCTION set_end_of_day_archived_timestamps()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
    updated_count2 INTEGER;
    yesterday_date DATE;
    today_date DATE;
BEGIN
    -- Get yesterday's date (UTC)
    yesterday_date := CURRENT_DATE - INTERVAL '1 day';
    today_date := CURRENT_DATE;
    
    -- Part 1: Archive bids received yesterday (UTC date)
    -- archived_at = yesterday + 1 day + 04:59:59 UTC
    UPDATE telegram_bids
    SET 
      archived_at = yesterday_date + INTERVAL '1 day' + INTERVAL '4 hours 59 minutes 59 seconds',
      is_archived = true
    WHERE archived_at IS NULL
      AND is_archived = false
      AND received_at::date = yesterday_date;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Part 2: ALSO archive bids received today (UTC date) before 05:00:00 UTC
    -- These are still from yesterday in Chicago timezone
    -- archived_at = yesterday + 1 day + 04:59:59 UTC
    UPDATE telegram_bids
    SET 
      archived_at = yesterday_date + INTERVAL '1 day' + INTERVAL '4 hours 59 minutes 59 seconds',
      is_archived = true
    WHERE archived_at IS NULL
      AND is_archived = false
      AND received_at::date = today_date
      AND received_at::time < '05:00:00'::time;
    
    GET DIAGNOSTICS updated_count2 = ROW_COUNT;
    updated_count := updated_count + updated_count2;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_end_of_day_archived_timestamps() IS 
'Archives bids using simple UTC boundaries. Bids received up to 04:59:59 UTC of next day are archived with previous day. Always uses 04:59:59 UTC as archived_at timestamp.';

