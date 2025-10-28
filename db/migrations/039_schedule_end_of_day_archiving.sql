-- Migration: Schedule End of Day Archiving
-- Description: Create a scheduled job to automatically set archived_at at end of day
-- Note: This requires pg_cron extension which may not be available on all Supabase plans

-- First, try to enable pg_cron (this will fail gracefully if not available)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job to run daily at 23:59:59
-- This will set archived_at for all bids that expired today
SELECT cron.schedule(
    'end-of-day-archive',
    '59 59 23 * * *',  -- Run at 23:59:59 every day (second, minute, hour, day of month, month, day of week)
    $$
    SELECT set_end_of_day_archived_timestamps();
    $$
);

-- Verify the schedule was created
SELECT * FROM cron.job WHERE jobname = 'end-of-day-archive';

COMMENT ON FUNCTION set_end_of_day_archived_timestamps() IS 'Sets archived_at to end of day for bids that expired today. Scheduled to run at 23:59:59 daily via pg_cron';

