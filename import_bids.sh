#!/bin/bash

# Script to import bids from Supabase CSV to local PostgreSQL

echo "Importing bids from Supabase to local database..."

# Read the CSV file and insert each bid
while IFS='|' read -r bid_number distance_miles pickup_timestamp delivery_timestamp stops tag source_channel forwarded_to received_at expires_at; do
    if [ -n "$bid_number" ]; then
        echo "Inserting bid: $bid_number"
        
        psql postgresql://dukeisaac@localhost:5432/nova_build -c "
        INSERT INTO telegram_bids (
            bid_number,
            distance_miles,
            pickup_timestamp,
            delivery_timestamp,
            stops,
            tag,
            source_channel,
            forwarded_to,
            received_at,
            expires_at
        ) VALUES (
            '$bid_number',
            $distance_miles,
            '$pickup_timestamp',
            '$delivery_timestamp',
            '$stops',
            '$tag',
            '$source_channel',
            '$forwarded_to',
            '$received_at',
            '$expires_at'
        ) ON CONFLICT (bid_number) DO UPDATE SET
            distance_miles = EXCLUDED.distance_miles,
            pickup_timestamp = EXCLUDED.pickup_timestamp,
            delivery_timestamp = EXCLUDED.delivery_timestamp,
            stops = EXCLUDED.stops,
            tag = EXCLUDED.tag,
            source_channel = EXCLUDED.source_channel,
            forwarded_to = EXCLUDED.forwarded_to,
            received_at = EXCLUDED.received_at,
            expires_at = EXCLUDED.expires_at;
        " > /dev/null 2>&1
    fi
done < supabase_bids.csv

echo "Import completed!"
echo "Checking final count..."
psql postgresql://dukeisaac@localhost:5432/nova_build -c "SELECT COUNT(*) as total_bids FROM telegram_bids;"
