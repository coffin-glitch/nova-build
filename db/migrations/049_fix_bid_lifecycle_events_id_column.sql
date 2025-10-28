-- Migration 049: Fix bid_lifecycle_events id column
-- Description: Changes id from INTEGER with sequence to UUID with gen_random_uuid()
-- This matches the expected schema from migration 035

-- Step 1: Drop the existing primary key constraint and sequence
ALTER TABLE bid_lifecycle_events DROP CONSTRAINT IF EXISTS bid_lifecycle_events_pkey CASCADE;
DROP SEQUENCE IF EXISTS bid_lifecycle_events_id_seq CASCADE;

-- Step 2: Add new UUID column
ALTER TABLE bid_lifecycle_events ADD COLUMN id_new UUID;

-- Step 3: Generate UUIDs for existing records
UPDATE bid_lifecycle_events SET id_new = gen_random_uuid();

-- Step 4: Drop old integer id column
ALTER TABLE bid_lifecycle_events DROP COLUMN id;

-- Step 5: Rename new id column
ALTER TABLE bid_lifecycle_events RENAME COLUMN id_new TO id;

-- Step 6: Add primary key constraint
ALTER TABLE bid_lifecycle_events ADD PRIMARY KEY (id);

-- Step 7: Add NOT NULL constraint with default
ALTER TABLE bid_lifecycle_events ALTER COLUMN id SET NOT NULL;
ALTER TABLE bid_lifecycle_events ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Step 8: Update timestamp to TIMESTAMP WITH TIME ZONE
-- The current column is 'timestamp without time zone' but should be WITH time zone
ALTER TABLE bid_lifecycle_events ALTER COLUMN timestamp TYPE TIMESTAMP WITH TIME ZONE;

-- Add comment
COMMENT ON COLUMN bid_lifecycle_events.id IS 'UUID primary key generated with gen_random_uuid()';
COMMENT ON COLUMN bid_lifecycle_events.timestamp IS 'When the lifecycle event occurred (with timezone)';

