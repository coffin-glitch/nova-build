-- Migration: Add trigger_config validation at database level
-- Description: Ensures trigger_config JSONB follows required schema structure
-- Date: 2025-01-14

-- Function to validate trigger_config structure
CREATE OR REPLACE FUNCTION validate_trigger_config(config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if config is valid JSONB
    IF config IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- For exact_match and state_match triggers, check for required fields
    IF config->>'matchType' IN ('exact', 'state') THEN
        -- Should have either favoriteDistanceRange or favoriteBidNumbers
        IF config->'favoriteDistanceRange' IS NULL AND 
           (config->'favoriteBidNumbers' IS NULL OR jsonb_array_length(config->'favoriteBidNumbers') = 0) THEN
            RETURN FALSE;
        END IF;
        
        -- If favoriteDistanceRange exists, validate it has minDistance and maxDistance
        IF config->'favoriteDistanceRange' IS NOT NULL THEN
            IF config->'favoriteDistanceRange'->>'minDistance' IS NULL OR
               config->'favoriteDistanceRange'->>'maxDistance' IS NULL THEN
                RETURN FALSE;
            END IF;
            
            -- Validate minDistance <= maxDistance
            IF (config->'favoriteDistanceRange'->>'minDistance')::INTEGER > 
               (config->'favoriteDistanceRange'->>'maxDistance')::INTEGER THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;
    
    -- Validate backhaulEnabled is boolean if present
    IF config->'backhaulEnabled' IS NOT NULL THEN
        IF config->>'backhaulEnabled' NOT IN ('true', 'false') THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add check constraint to notification_triggers table
ALTER TABLE notification_triggers 
DROP CONSTRAINT IF EXISTS check_trigger_config_valid;

ALTER TABLE notification_triggers 
ADD CONSTRAINT check_trigger_config_valid 
CHECK (validate_trigger_config(trigger_config));

-- Comments
COMMENT ON FUNCTION validate_trigger_config(JSONB) IS 
  'Validates trigger_config JSONB structure. Ensures required fields exist and have correct types.';

COMMENT ON CONSTRAINT check_trigger_config_valid ON notification_triggers IS 
  'Ensures trigger_config follows required schema structure. Validates matchType, distance ranges, and other required fields.';

