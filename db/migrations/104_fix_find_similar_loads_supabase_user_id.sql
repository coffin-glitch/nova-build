-- Migration: Fix find_similar_loads function to use supabase_carrier_user_id
-- Description: Updates the function to use supabase_carrier_user_id instead of carrier_user_id
--              to match the current database schema

CREATE OR REPLACE FUNCTION find_similar_loads(
    p_carrier_user_id VARCHAR(255),
    p_distance_threshold INTEGER DEFAULT 50,
    p_state_preferences TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    bid_number VARCHAR(50),
    similarity_score INTEGER,
    distance_miles INTEGER,
    pickup_timestamp TIMESTAMPTZ,
    delivery_timestamp TIMESTAMPTZ,
    stops JSONB,
    tag VARCHAR(20),
    source_channel VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    WITH carrier_preferences AS (
        SELECT 
            COALESCE(distance_threshold_miles, 50) as dist_threshold,
            COALESCE(state_preferences, ARRAY[]::TEXT[]) as states
        FROM carrier_notification_preferences 
        WHERE supabase_carrier_user_id = p_carrier_user_id
        LIMIT 1
    ),
    favorite_routes AS (
        SELECT DISTINCT
            tb.distance_miles,
            tb.stops,
            tb.tag,
            tb.pickup_timestamp,
            tb.delivery_timestamp
        FROM carrier_favorites cf
        JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
        WHERE cf.supabase_carrier_user_id = p_carrier_user_id
    )
    SELECT 
        tb.bid_number,
        CASE 
            WHEN ABS(tb.distance_miles - fr.distance_miles) <= cp.dist_threshold THEN 100 - ABS(tb.distance_miles - fr.distance_miles)
            ELSE 0
        END::INTEGER as similarity_score,
        tb.distance_miles,
        tb.pickup_timestamp,
        tb.delivery_timestamp,
        tb.stops,
        tb.tag,
        tb.source_channel
    FROM telegram_bids tb
    CROSS JOIN carrier_preferences cp
    CROSS JOIN favorite_routes fr
    WHERE tb.is_archived = false
    AND NOW() <= (tb.received_at::timestamp + INTERVAL '25 minutes')
    AND (
        -- If state preferences are provided (either from table or parameter), check if stops match
        (cp.states = ARRAY[]::TEXT[] AND (p_state_preferences IS NULL OR array_length(p_state_preferences, 1) = 0)) OR
        -- Check if any stop contains any of the preferred states
        EXISTS (
            SELECT 1 
            FROM jsonb_array_elements_text(tb.stops) AS stop_text
            WHERE (
                -- Check against carrier preferences
                (array_length(cp.states, 1) > 0 AND EXISTS (
                    SELECT 1 FROM unnest(cp.states) AS pref_state
                    WHERE stop_text ILIKE '%' || pref_state || '%'
                )) OR
                -- Check against parameter preferences
                (p_state_preferences IS NOT NULL AND array_length(p_state_preferences, 1) > 0 AND EXISTS (
                    SELECT 1 FROM unnest(p_state_preferences) AS param_state
                    WHERE stop_text ILIKE '%' || param_state || '%'
                ))
            )
        )
    )
    AND ABS(tb.distance_miles - fr.distance_miles) <= cp.dist_threshold
    ORDER BY similarity_score DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION find_similar_loads(VARCHAR, INTEGER, TEXT[]) IS 'Finds similar loads for notification triggers using supabase_carrier_user_id';

