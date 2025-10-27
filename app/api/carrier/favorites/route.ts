import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/carrier/favorites - Get all favorited bids for the carrier
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get favorited bids with real-time auction data
    const favorites = await sql`
      SELECT 
        cf.id as favorite_id,
        cf.bid_number,
        cf.created_at as favorited_at,
        -- Real-time auction data
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
        COALESCE(bid_counts.bids_count, 0) as "bidCount",
        -- Check if user has bid on this
        CASE 
          WHEN cb.id IS NOT NULL THEN cb.amount_cents / 100.0
          ELSE NULL
        END as "myBid"
      FROM carrier_favorites cf
      LEFT JOIN telegram_bids tb ON cf.bid_number = tb.bid_number
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
      ) lowest_bid ON cf.bid_number = lowest_bid.bid_number
      LEFT JOIN (
        SELECT 
          bid_number,
          COUNT(*) as bids_count
        FROM carrier_bids
        GROUP BY bid_number
      ) bid_counts ON cf.bid_number = bid_counts.bid_number
      LEFT JOIN carrier_bids cb ON cf.bid_number = cb.bid_number AND cb.clerk_user_id = ${userId}
      WHERE cf.carrier_user_id = ${userId}
      ORDER BY cf.created_at DESC
    `;

    return NextResponse.json({ 
      ok: true, 
      data: favorites 
    });

  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json(
      { error: "Failed to fetch favorites" },
      { status: 500 }
    );
  }
}

// POST /api/carrier/favorites - Add a bid to favorites
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { bid_number } = await request.json();

    if (!bid_number) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    // Check if bid exists
    const bidExists = await sql`
      SELECT 1 FROM telegram_bids WHERE bid_number = ${bid_number}
    `;

    if (bidExists.length === 0) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }

    // Add to favorites (ignore if already exists)
    await sql`
      INSERT INTO carrier_favorites (carrier_user_id, bid_number)
      VALUES (${userId}, ${bid_number})
      ON CONFLICT (carrier_user_id, bid_number) DO NOTHING
    `;

    return NextResponse.json({ 
      ok: true, 
      message: "Bid added to favorites" 
    });

  } catch (error) {
    console.error('Error adding to favorites:', error);
    return NextResponse.json(
      { error: "Failed to add to favorites" },
      { status: 500 }
    );
  }
}

// DELETE /api/carrier/favorites - Remove a bid from favorites
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bid_number = searchParams.get('bid_number');

    if (!bid_number) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    // Remove from favorites
    await sql`
      DELETE FROM carrier_favorites 
      WHERE carrier_user_id = ${userId} AND bid_number = ${bid_number}
    `;

    // Always return success - it doesn't matter if the favorite wasn't found
    // The DELETE operation just does nothing in that case
    return NextResponse.json({ 
      ok: true, 
      message: "Bid removed from favorites" 
    });

  } catch (error) {
    console.error('Error removing from favorites:', error);
    return NextResponse.json(
      { error: "Failed to remove from favorites" },
      { status: 500 }
    );
  }
}
