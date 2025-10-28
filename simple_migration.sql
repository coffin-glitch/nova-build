-- Simple data migration for critical tables
-- This script migrates the most important data to Supabase

-- Migrate telegram_bids data
INSERT INTO telegram_bids (id, bid_number, distance_miles, pickup_timestamp, delivery_timestamp, stops, tag, source_channel, forwarded_to, received_at, expires_at, published)
SELECT 
    id,
    bid_number,
    distance_miles,
    pickup_timestamp,
    delivery_timestamp,
    stops,
    tag,
    source_channel,
    forwarded_to,
    received_at,
    expires_at,
    published
FROM dblink('host=localhost port=5432 dbname=nova_build user=dukeisaac', 
    'SELECT id, bid_number, distance_miles, pickup_timestamp, delivery_timestamp, stops, tag, source_channel, forwarded_to, received_at, expires_at, published FROM telegram_bids')
AS remote_data(id uuid, bid_number text, distance_miles numeric, pickup_timestamp timestamp with time zone, delivery_timestamp timestamp with time zone, stops text, tag text, source_channel text, forwarded_to text, received_at timestamp with time zone, expires_at timestamp with time zone, published boolean)
ON CONFLICT (id) DO NOTHING;

