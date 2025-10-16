import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get carrier's bids with real-time auction data from telegram_bids
    // Use the EXACT same calculation logic as telegram-bids API
    const rows = await sql`
      SELECT 
        cb.id,
        cb.bid_number as "bidNumber",
        cb.amount_cents / 100.0 as "myBid", -- Convert cents to dollars
        cb.notes,
        cb.created_at as "createdAt",
        cb.updated_at as "updatedAt",
        -- Real-time auction data (same as telegram-bids API)
        tb.distance_miles as distance,
        tb.pickup_timestamp as "pickupDate",
        tb.delivery_timestamp as "deliveryDate",
        tb.stops,
        tb.tag,
        tb.source_channel as "sourceChannel",
        tb.received_at as "receivedAt",
        (tb.received_at::timestamp + INTERVAL '25 minutes')::text as "expiresAt",
        NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes') as "isExpired",
        -- Get current bid info
        COALESCE(lowest_bid.amount_cents / 100.0, 0) as "currentBid",
        COALESCE(bid_counts.bids_count, 0) as "bidCount"
      FROM carrier_bids cb
      LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      LEFT JOIN (
        SELECT 
          cb1.bid_number,
          cb1.amount_cents,
          cb1.clerk_user_id
        FROM carrier_bids cb1
        WHERE cb1.id = (
          SELECT cb2.id 
          FROM carrier_bids cb2 
          WHERE cb2.bid_number = cb1.bid_number 
          ORDER BY cb2.amount_cents ASC
          LIMIT 1
        )
      ) lowest_bid ON cb.bid_number = lowest_bid.bid_number
      LEFT JOIN (
        SELECT 
          bid_number,
          COUNT(*) as bids_count
        FROM carrier_bids
        GROUP BY bid_number
      ) bid_counts ON cb.bid_number = bid_counts.bid_number
      WHERE cb.clerk_user_id = ${userId}
      ORDER BY cb.created_at DESC
    `;

    // Get awards for all bids - simplified approach
    let awards = [];
    if (rows.length > 0) {
      try {
        // Query each bid individually to avoid SQL complexity
        for (const row of rows) {
          const bidAwards = await sql`
            SELECT 
              aa.bid_number,
              aa.winner_user_id,
              CAST(aa.winner_amount_cents / 100.0 AS DECIMAL(10,2)) as winner_amount,
              aa.awarded_at
            FROM auction_awards aa
            WHERE aa.bid_number = ${row.bidNumber}
            LIMIT 1
          `;
          if (bidAwards.length > 0) {
            awards.push(bidAwards[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching awards:', error);
        awards = [];
      }
    }
    
    // Create award map
    const awardMap = new Map();
    awards.forEach(award => {
      awardMap.set(award.bid_number, award);
    });

    // Add time_left_seconds using the EXACT same calculation as telegram-bids API
    const bids = rows.map(row => {
      // Calculate time left from received_at + 25 minutes (same logic as telegram-bids)
      const receivedAt = new Date(row.receivedAt);
      const expiresAt = new Date(receivedAt.getTime() + (25 * 60 * 1000)); // Add 25 minutes
      const now = new Date();
      const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
      const timeLeftSeconds = Math.floor(timeLeftMs / 1000);
      
      // Determine bid status
      const award = awardMap.get(row.bidNumber);
      let bidStatus = 'active';
      
      if (award) {
        if (award.winner_user_id === userId) {
          bidStatus = 'won';
        } else {
          bidStatus = 'lost';
        }
      } else if (row.isExpired) {
        bidStatus = 'pending'; // Expired but waiting for admin award
      }
      
      return {
        ...row,
        timeLeftSeconds: timeLeftSeconds,
        expiresAt: expiresAt.toISOString(), // Override with correct calculation
        bidStatus: bidStatus,
        award: award ? {
          ...award,
          winner_amount: Number(award.winner_amount)
        } : null
      };
    });

    return NextResponse.json({ 
      ok: true, 
      data: bids 
    });

  } catch (error) {
    console.error("Error fetching carrier bids:", error);
    return NextResponse.json({ 
      error: "Failed to fetch bids" 
    }, { status: 500 });
  }
}
