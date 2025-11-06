-- Migration: Simple DST Fix for Archive Timestamps
-- Description: Fix archived_at to use correct UTC offset based on DST period
--              Nov 2, 2025 - Mar 8, 2026: Use 05:59:59 UTC (CST period)
--              Mar 9, 2026 - Nov 1, 2026: Use 04:59:59 UTC (CDT period)
--
-- Date: 2025-11-05
-- Issue: archived_at showing 17:59:59 instead of 05:59:59 UTC during CST period
--
-- ALSO: Fix existing bids that were archived with wrong timestamp (17:59:59 UTC)
-- These should be 05:59:59 UTC during CST period

-- ============================================================================
-- FUNCTION: set_end_of_day_archived_timestamps()
-- ============================================================================
-- Simple version: Use 05:59:59 UTC during CST (Nov 2 - Mar 8), 04:59:59 UTC during CDT (Mar 9 - Nov 1)
CREATE OR REPLACE FUNCTION set_end_of_day_archived_timestamps()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
    updated_count2 INTEGER;
    yesterday_date DATE;
    today_date DATE;
    utc_offset_hours INTEGER;
    utc_offset_interval INTERVAL;
BEGIN
    -- Get yesterday's date in Chicago timezone
    yesterday_date := (CURRENT_DATE AT TIME ZONE 'America/Chicago' - INTERVAL '1 day')::date;
    today_date := CURRENT_DATE;
    
    -- Determine UTC offset based on date (DST period)
    -- Nov 2 - Mar 8: CST (UTC-6) → use 5 hours 59 minutes 59 seconds
    -- Mar 9 - Nov 1: CDT (UTC-5) → use 4 hours 59 minutes 59 seconds
    IF (EXTRACT(MONTH FROM yesterday_date) = 11 AND EXTRACT(DAY FROM yesterday_date) >= 2) OR
       (EXTRACT(MONTH FROM yesterday_date) = 12) OR
       (EXTRACT(MONTH FROM yesterday_date) = 1) OR
       (EXTRACT(MONTH FROM yesterday_date) = 2) OR
       (EXTRACT(MONTH FROM yesterday_date) = 3 AND EXTRACT(DAY FROM yesterday_date) < 9) THEN
        -- CST period (Nov 2 - Mar 8)
        utc_offset_interval := INTERVAL '5 hours 59 minutes 59 seconds';
    ELSE
        -- CDT period (Mar 9 - Nov 1)
        utc_offset_interval := INTERVAL '4 hours 59 minutes 59 seconds';
    END IF;
    
    -- Part 1: Archive bids received yesterday in Chicago timezone
    UPDATE telegram_bids
    SET 
      archived_at = received_at::date + INTERVAL '1 day' + utc_offset_interval,
      is_archived = true
    WHERE archived_at IS NULL
      AND is_archived = false
      AND DATE(received_at AT TIME ZONE 'America/Chicago') = yesterday_date;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Part 2: ALSO archive bids received today (UTC) that are still from yesterday in Chicago timezone
    -- Determine cutoff time based on DST period
    DECLARE
        cutoff_time TIME;
    BEGIN
        IF (EXTRACT(MONTH FROM today_date) = 11 AND EXTRACT(DAY FROM today_date) >= 2) OR
           (EXTRACT(MONTH FROM today_date) = 12) OR
           (EXTRACT(MONTH FROM today_date) = 1) OR
           (EXTRACT(MONTH FROM today_date) = 2) OR
           (EXTRACT(MONTH FROM today_date) = 3 AND EXTRACT(DAY FROM today_date) < 9) THEN
            -- CST period: cutoff is 06:00:00 UTC
            cutoff_time := '06:00:00'::time;
        ELSE
            -- CDT period: cutoff is 05:00:00 UTC
            cutoff_time := '05:00:00'::time;
        END IF;
        
        -- Archive bids received today (UTC date) but before cutoff time
        UPDATE telegram_bids
        SET 
          archived_at = received_at::date + utc_offset_interval,
          is_archived = true
        WHERE archived_at IS NULL
          AND is_archived = false
          AND received_at::date = today_date
          AND received_at::time < cutoff_time;
        
        GET DIAGNOSTICS updated_count2 = ROW_COUNT;
        updated_count := updated_count + updated_count2;
    END;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_end_of_day_archived_timestamps() IS 
'Archives bids from yesterday (America/Chicago timezone) by setting archived_at to end of day UTC equivalent. Uses 05:59:59 UTC during CST (Nov 2 - Mar 8) and 04:59:59 UTC during CDT (Mar 9 - Nov 1).';

-- ============================================================================
-- FIX EXISTING DATA: Correct bids archived with wrong timestamp (17:59:59 UTC)
-- ============================================================================
-- Fix bids that were archived with 17:59:59 UTC instead of 05:59:59 UTC during CST period
UPDATE telegram_bids
SET archived_at = received_at::date + INTERVAL '1 day' + INTERVAL '5 hours 59 minutes 59 seconds'
WHERE archived_at IS NOT NULL
  AND archived_at::date >= '2025-11-02'::date
  AND archived_at::date < '2026-03-09'::date
  AND archived_at::time = '17:59:59'::time;

