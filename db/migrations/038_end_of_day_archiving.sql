-- Migration: End of Day Archiving Function
-- Description: Function to set archived_at to 23:59:59 for bids that expired today

CREATE OR REPLACE FUNCTION set_end_of_day_archived_timestamps()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
    today_date DATE;
BEGIN
    today_date := CURRENT_DATE;
    
    -- Set archived_at to 23:59:59 for bids that were received today and don't have archived_at set
    UPDATE archived_bids
    SET archived_at = today_date + INTERVAL '23 hours 59 minutes 59 seconds'
    WHERE DATE(received_at) = today_date
    AND archived_at IS NULL;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION set_end_of_day_archived_timestamps() IS 'Sets archived_at to end of day for bids that expired today';

