-- Migration: Fix DST-Aware Archiving
-- Description: Update archiving functions to dynamically calculate UTC time based on America/Chicago timezone
--              This fixes the 1-hour offset issue that occurred when DST ended on Nov 2, 2025
--              The system was hardcoding 04:59:59 UTC (correct for CDT) but should use 05:59:59 UTC during CST
--
-- Date: 2025-11-05
-- Issue: After DST ended, bids were being archived 1 hour early (22:59:59 CST instead of 23:59:59 CST)

-- ============================================================================
-- FUNCTION: set_end_of_day_archived_timestamps()
-- ============================================================================
-- Updated to dynamically calculate UTC time that equals 23:59:59 in America/Chicago
-- This automatically handles DST transitions (CDT vs CST)
CREATE OR REPLACE FUNCTION set_end_of_day_archived_timestamps()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
    updated_count2 INTEGER;
    yesterday_date DATE;
    today_date DATE;
    end_of_day_utc TIMESTAMP;
    today_start_utc TIMESTAMP;
BEGIN
    -- Get yesterday's date in Chicago timezone
    yesterday_date := (CURRENT_DATE AT TIME ZONE 'America/Chicago' - INTERVAL '1 day')::date;
    today_date := CURRENT_DATE;
    
    -- Dynamically calculate UTC time that equals 23:59:59 in Chicago for yesterday
    -- This automatically handles DST: 04:59:59 UTC during CDT, 05:59:59 UTC during CST
    end_of_day_utc := (
        (yesterday_date AT TIME ZONE 'America/Chicago' + INTERVAL '23 hours 59 minutes 59 seconds') 
        AT TIME ZONE 'UTC'
    );
    
    -- Calculate what UTC time equals 00:00:00 of today in Chicago timezone
    -- This is the cutoff - bids before this are still from yesterday
    today_start_utc := (
        (today_date AT TIME ZONE 'America/Chicago') 
        AT TIME ZONE 'UTC'
    );
    
    -- Part 1: Archive bids received yesterday in Chicago timezone
    UPDATE telegram_bids
    SET 
      archived_at = end_of_day_utc,
      is_archived = true
    WHERE archived_at IS NULL
      AND is_archived = false
      AND DATE(received_at AT TIME ZONE 'America/Chicago') = yesterday_date;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Part 2: ALSO archive bids received today (UTC) that are still from yesterday in Chicago timezone
    -- Archive bids received today (UTC date) but before today starts in Chicago
    -- These are still from yesterday in Chicago timezone
    UPDATE telegram_bids
    SET 
      archived_at = end_of_day_utc,
      is_archived = true
    WHERE archived_at IS NULL
      AND is_archived = false
      AND received_at::date = today_date
      AND received_at < today_start_utc;
    
    GET DIAGNOSTICS updated_count2 = ROW_COUNT;
    updated_count := updated_count + updated_count2;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_end_of_day_archived_timestamps() IS 
'Archives bids from yesterday (America/Chicago timezone) by setting archived_at to end of day UTC equivalent. Dynamically calculates UTC time based on DST status (04:59:59 UTC during CDT, 05:59:59 UTC during CST). Handles DST transitions automatically.';

-- ============================================================================
-- HELPER FUNCTION: get_end_of_day_utc(target_date DATE)
-- ============================================================================
-- Helper function to calculate UTC time that equals 23:59:59 in Chicago for any date
-- This can be used by API endpoints and other functions
CREATE OR REPLACE FUNCTION get_end_of_day_utc(target_date DATE)
RETURNS TIMESTAMP AS $$
BEGIN
    RETURN (
        (target_date AT TIME ZONE 'America/Chicago' + INTERVAL '23 hours 59 minutes 59 seconds') 
        AT TIME ZONE 'UTC'
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_end_of_day_utc(DATE) IS 
'Returns UTC timestamp that equals 23:59:59 in America/Chicago for the given date. Automatically handles DST transitions.';

-- ============================================================================
-- HELPER FUNCTION: get_utc_cutoff_time(target_date DATE)
-- ============================================================================
-- Returns the UTC time that marks the boundary between target_date and (target_date + 1) in Chicago timezone
-- Example: For Nov 2, 2025 (CST), returns 05:00:00 UTC (Nov 3, 2025 05:00:00 UTC = Nov 2, 2025 23:00:00 CST)
CREATE OR REPLACE FUNCTION get_utc_cutoff_time(target_date DATE)
RETURNS TIME AS $$
DECLARE
    cutoff_utc TIMESTAMP;
BEGIN
    -- Calculate when (target_date + 1 day) starts in Chicago, convert to UTC, get time
    cutoff_utc := (
        ((target_date + INTERVAL '1 day') AT TIME ZONE 'America/Chicago') 
        AT TIME ZONE 'UTC'
    );
    RETURN cutoff_utc::time;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_utc_cutoff_time(DATE) IS 
'Returns UTC time that marks the start of (target_date + 1) in America/Chicago timezone. Used to identify bids that belong to target_date even if received on next UTC date.';

-- ============================================================================
-- FIX EXISTING DATA: Correct bids archived between Nov 2-5, 2025 (1 hour early)
-- ============================================================================
-- This will recalculate archived_at for bids that were archived during the DST transition period
-- These bids have archived_at showing 22:59:59 CST instead of 23:59:59 CST
DO $$
DECLARE
    fixed_count INTEGER;
BEGIN
    -- Find bids that were archived with incorrect timestamp (using 04:59:59 UTC during CST)
    -- These would have archived_at showing 22:59:59 CST instead of 23:59:59 CST
    UPDATE telegram_bids
    SET archived_at = get_end_of_day_utc(DATE(archived_at AT TIME ZONE 'America/Chicago'))
    WHERE archived_at IS NOT NULL
      AND archived_at >= '2025-11-03 04:59:59 UTC'::timestamp
      AND archived_at < '2025-11-06 06:00:00 UTC'::timestamp
      AND (archived_at AT TIME ZONE 'America/Chicago')::time != '23:59:59'::time;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    
    RAISE NOTICE 'Fixed % bids archived with incorrect DST timestamp', fixed_count;
END $$;

