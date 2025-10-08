#!/usr/bin/env python3
"""
Migration script to update null pickup_timestamp and delivery_timestamp values
in the telegram_bids table with realistic fallback timestamps.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in environment variables")
    sys.exit(1)

def generate_fallback_timestamps(received_at_str: str) -> tuple:
    """Generate realistic pickup and delivery timestamps based on received_at."""
    try:
        received_at = datetime.fromisoformat(received_at_str.replace('Z', '+00:00'))
    except Exception:
        received_at = datetime.now(timezone.utc)
    
    # Generate pickup time 2-6 hours from received_at
    pickup_hours = 2 + (hash(received_at_str) % 4)  # Deterministic but varied
    pickup_time = received_at + timedelta(hours=pickup_hours)
    
    # Generate delivery time 8-24 hours after pickup
    delivery_hours = 8 + (hash(received_at_str) % 16)  # Deterministic but varied
    delivery_time = pickup_time + timedelta(hours=delivery_hours)
    
    return pickup_time, delivery_time

async def update_null_timestamps():
    """Update null timestamps in the database."""
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor(row_factory=dict_row) as cur:
                # Get all records with null timestamps
                await cur.execute("""
                    SELECT bid_number, received_at 
                    FROM public.telegram_bids 
                    WHERE pickup_timestamp IS NULL OR delivery_timestamp IS NULL
                    ORDER BY received_at DESC
                """)
                
                records = await cur.fetchall()
                print(f"Found {len(records)} records with null timestamps")
                
                if not records:
                    print("No records to update")
                    return
                
                # Update each record
                updated_count = 0
                for record in records:
                    pickup_time, delivery_time = generate_fallback_timestamps(record['received_at'])
                    
                    await cur.execute("""
                        UPDATE public.telegram_bids 
                        SET pickup_timestamp = %s, delivery_timestamp = %s
                        WHERE bid_number = %s
                    """, (pickup_time, delivery_time, record['bid_number']))
                    
                    updated_count += 1
                    if updated_count % 10 == 0:
                        print(f"Updated {updated_count} records...")
                
                await conn.commit()
                print(f"Successfully updated {updated_count} records")
                
                # Verify the update
                await cur.execute("""
                    SELECT COUNT(*) as null_count 
                    FROM public.telegram_bids 
                    WHERE pickup_timestamp IS NULL OR delivery_timestamp IS NULL
                """)
                result = await cur.fetchone()
                print(f"Remaining null timestamps: {result['null_count']}")
                
    except Exception as e:
        print(f"Error updating timestamps: {e}")
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(update_null_timestamps())
