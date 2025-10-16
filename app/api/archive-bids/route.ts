import sql from '@/lib/db';
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Create archive_bids table for storing historical bids
    await sql`
      CREATE TABLE IF NOT EXISTS archive_bids (
        id SERIAL PRIMARY KEY,
        bid_number TEXT NOT NULL,
        distance_miles INTEGER,
        pickup_timestamp TEXT,
        delivery_timestamp TEXT,
        stops TEXT, -- JSON string
        tag TEXT,
        source_channel TEXT,
        forwarded_to TEXT,
        received_at TEXT NOT NULL,
        expires_at TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        archived_date DATE NOT NULL DEFAULT CURRENT_DATE,
        -- Index for efficient querying
        UNIQUE(bid_number, archived_date)
      )
    `;

    // Create index for efficient date-based queries
    await sql`
      CREATE INDEX IF NOT EXISTS idx_archive_bids_date ON archive_bids(archived_date)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_archive_bids_bid_number ON archive_bids(bid_number)
    `;

    // Check if we need to archive today's expired bids
    const today = new Date().toISOString().split('T')[0];
    
    // Get all expired bids from today that haven't been archived yet
    const expiredBids = await sql`
      SELECT tb.*
      FROM telegram_bids tb
      WHERE NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes')
      AND DATE(tb.received_at::timestamp) = ${today}
      AND NOT EXISTS (
        SELECT 1 FROM archive_bids ab 
        WHERE ab.bid_number = tb.bid_number 
        AND ab.archived_date = ${today}
      )
    `;

    // Archive the expired bids
    if (expiredBids.length > 0) {
      console.log(`📦 Archiving ${expiredBids.length} expired bids from today`);
      
      for (const bid of expiredBids) {
        await sql`
          INSERT INTO archive_bids (
            bid_number, distance_miles, pickup_timestamp, delivery_timestamp,
            stops, tag, source_channel, forwarded_to, received_at, expires_at,
            created_at, archived_date
          ) VALUES (
            ${bid.bid_number}, ${bid.distance_miles}, ${bid.pickup_timestamp},
            ${bid.delivery_timestamp}, ${bid.stops}, ${bid.tag},
            ${bid.source_channel}, ${bid.forwarded_to}, ${bid.received_at},
            ${bid.expires_at}, ${bid.created_at}, ${today}
          )
          ON CONFLICT (bid_number, archived_date) DO NOTHING
        `;
      }
    }

    // Get archive statistics
    const archiveStats = await sql`
      SELECT 
        archived_date,
        COUNT(*) as bid_count
      FROM archive_bids
      GROUP BY archived_date
      ORDER BY archived_date DESC
      LIMIT 7
    `;

    return NextResponse.json({
      success: true,
      message: 'Archive system initialized',
      archived_today: expiredBids.length,
      archive_stats: archiveStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Archive system error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
