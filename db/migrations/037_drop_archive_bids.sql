-- Migration: Drop archive_bids table
-- Description: archive_bids (without 'd') is redundant and not needed
--              All archive functionality uses archived_bids (with 'd')

-- Drop the archive_bids table if it exists
DROP TABLE IF EXISTS archive_bids CASCADE;

-- Drop related sequences if they exist
DROP SEQUENCE IF EXISTS archive_bids_id_seq CASCADE;

COMMENT ON TABLE archive_bids IS 'DROPPED - Use archived_bids instead';

