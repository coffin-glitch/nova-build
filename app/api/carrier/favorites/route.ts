import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

// GET /api/carrier/favorites - Get all favorited bids for the carrier
export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error('[favorites GET] Auth error:', authError);
      return NextResponse.json(
        { error: "Authentication failed", details: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = auth.userId;
    
    if (!userId) {
      console.error('[favorites GET] No userId from auth:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }
    
    console.log('[favorites GET] Fetching favorites for userId:', userId);

    // Get favorited bids with real-time auction data
    let favorites;
    try {
      favorites = await sql`
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
          cb1.supabase_user_id
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
      LEFT JOIN carrier_bids cb ON cf.bid_number = cb.bid_number AND cb.supabase_user_id = ${userId}
      WHERE cf.supabase_carrier_user_id = ${userId}
      ORDER BY cf.created_at DESC
      `;
    } catch (queryError: any) {
      console.error('[favorites GET] SQL query error:', queryError);
      console.error('[favorites GET] Query error details:', {
        message: queryError?.message,
        code: queryError?.code,
        position: queryError?.position,
        stack: queryError?.stack
      });
      throw queryError;
    }

    console.log('[favorites GET] Found', favorites.length, 'favorites');
    
    // Add time_left_seconds calculation to match bid-board countdown logic
    const favoritesWithCountdown = favorites.map(fav => {
      // Calculate time left from receivedAt + 25 minutes (same as telegram-bids API)
      if (fav.receivedAt) {
        const receivedAt = new Date(fav.receivedAt);
        const expiresAt = new Date(receivedAt.getTime() + (25 * 60 * 1000)); // Add 25 minutes
        const now = new Date();
        const timeLeftMs = Math.max(0, expiresAt.getTime() - now.getTime());
        const timeLeftSeconds = Math.floor(timeLeftMs / 1000);
        
        return {
          ...fav,
          expiresAt: expiresAt.toISOString(), // Ensure consistent format
          timeLeftSeconds: timeLeftSeconds
        };
      }
      return fav;
    });
    
    return NextResponse.json({ 
      ok: true, 
      data: favoritesWithCountdown 
    });

  } catch (error: any) {
    console.error('[favorites GET] Error fetching favorites:', error);
    console.error('[favorites GET] Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    return NextResponse.json(
      { error: "Failed to fetch favorites", details: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/carrier/favorites - Add a bid to favorites
export async function POST(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error('[favorites POST] Auth error:', authError);
      return NextResponse.json(
        { error: "Authentication failed", details: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = auth.userId;

    if (!userId) {
      console.error('[favorites POST] No userId from auth:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }

    const { bid_number } = await request.json();

    if (!bid_number) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    console.log('[favorites POST] Adding favorite - userId:', userId, 'bid_number:', bid_number);

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

    // Check if favorite already exists first
    const existingFavorite = await sql`
      SELECT id FROM carrier_favorites 
      WHERE supabase_carrier_user_id = ${userId} AND bid_number = ${bid_number}
    `;
    
    if (existingFavorite.length > 0) {
      console.log('[favorites POST] Favorite already exists');
      return NextResponse.json({ 
        ok: true, 
        message: "Bid already in favorites",
        alreadyExists: true
      });
    }

    // Add to favorites
    // Note: carrier_user_id was removed in migration 078
    // Try with explicit constraint first, then fallback
    try {
      const result = await sql`
        INSERT INTO carrier_favorites (supabase_carrier_user_id, bid_number)
        VALUES (${userId}, ${bid_number})
        ON CONFLICT (supabase_carrier_user_id, bid_number) DO NOTHING
        RETURNING id
      `;
      
      if (result.length > 0) {
        console.log('[favorites POST] Successfully added favorite, id:', result[0].id);
        return NextResponse.json({ 
          ok: true, 
          message: "Bid added to favorites" 
        });
      } else {
        // This shouldn't happen since we checked above, but handle it
        console.log('[favorites POST] Favorite already exists (ON CONFLICT DO NOTHING)');
        return NextResponse.json({ 
          ok: true, 
          message: "Bid already in favorites",
          alreadyExists: true
        });
      }
    } catch (error: any) {
      // If the constraint doesn't exist, try without specifying it
      if (error?.code === '42703' || error?.message?.includes('constraint') || error?.message?.includes('does not exist')) {
        console.log('[favorites POST] Constraint issue, trying without explicit constraint name');
        try {
          const result = await sql`
            INSERT INTO carrier_favorites (supabase_carrier_user_id, bid_number)
            VALUES (${userId}, ${bid_number})
            ON CONFLICT DO NOTHING
            RETURNING id
          `;
          
          if (result.length > 0) {
            console.log('[favorites POST] Successfully added favorite (fallback), id:', result[0].id);
            return NextResponse.json({ 
              ok: true, 
              message: "Bid added to favorites" 
            });
          } else {
            console.log('[favorites POST] Favorite already exists (fallback)');
            return NextResponse.json({ 
              ok: true, 
              message: "Bid already in favorites",
              alreadyExists: true
            });
          }
        } catch (retryError: any) {
          console.error('[favorites POST] Fallback insert error:', retryError);
          // Unique constraint violation - already exists
          if (retryError?.code === '23505') {
            console.log('[favorites POST] Unique constraint violation - already exists');
            return NextResponse.json({ 
              ok: true, 
              message: "Bid already in favorites",
              alreadyExists: true
            });
          }
          throw retryError;
        }
      } else if (error?.code === '23505') {
        // Unique constraint violation - already exists
        console.log('[favorites POST] Unique constraint violation - already exists');
        return NextResponse.json({ 
          ok: true, 
          message: "Bid already in favorites",
          alreadyExists: true
        });
      } else {
        console.error('[favorites POST] Insert error:', error);
        throw error;
      }
    }

  } catch (error: any) {
    console.error('Error adding to favorites:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    return NextResponse.json(
      { error: "Failed to add to favorites", details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/carrier/favorites - Remove a bid from favorites
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const bid_number = searchParams.get('bid_number');

    if (!bid_number) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    // Remove from favorites
    // Note: carrier_user_id was removed in migration 078, only supabase_carrier_user_id exists now
    await sql`
      DELETE FROM carrier_favorites 
      WHERE supabase_carrier_user_id = ${userId}
      AND bid_number = ${bid_number}
    `;

    // Always return success - it doesn't matter if the favorite wasn't found
    // The DELETE operation just does nothing in that case
    return NextResponse.json({ 
      ok: true, 
      message: "Bid removed from favorites" 
    });

  } catch (error: any) {
    console.error('Error removing from favorites:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    return NextResponse.json(
      { error: "Failed to remove from favorites", details: error?.message },
      { status: 500 }
    );
  }
}
