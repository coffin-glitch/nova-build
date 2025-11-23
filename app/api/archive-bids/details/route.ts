import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for archive details
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { searchParams } = new URL(request.url);
    const bidNumber = searchParams.get("bidNumber");
    
    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_archive_details_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    if (!bidNumber) {
      const response = NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get archived bid details
    const archivedBid = await sql`
      SELECT 
        ab.*,
        EXTRACT(EPOCH FROM (ab.archived_at - ab.received_at)) / 3600 as hours_active,
        CASE 
          WHEN ab.tag IS NOT NULL THEN ab.tag
          ELSE 'UNKNOWN'
        END as state_tag
      FROM archived_bids ab
      WHERE ab.bid_number = ${bidNumber}
      LIMIT 1
    `;

    if (archivedBid.length === 0) {
      logSecurityEvent('archive_bid_details_not_found', userId, { bidNumber });
      const response = NextResponse.json(
        { error: "Archived bid not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    // Get all carrier bids for this bid number
    const carrierBids = await sql`
      SELECT 
        cb.*,
        cp.legal_name as carrier_name,
        cp.mc_number,
        cp.phone as carrier_phone
      FROM carrier_bids cb
      LEFT JOIN carrier_profiles cp ON cb.supabase_user_id = cp.supabase_user_id
      WHERE cb.bid_number = ${bidNumber}
      ORDER BY cb.amount_cents ASC, cb.created_at ASC
    `;

    // Get auction award if exists
    const auctionAward = await sql`
      SELECT 
        aa.*,
        cp.legal_name as winner_name,
        cp.mc_number as winner_mc_number
      FROM auction_awards aa
      LEFT JOIN carrier_profiles cp ON COALESCE(aa.supabase_winner_user_id, aa.winner_user_id) = cp.supabase_user_id
      WHERE aa.bid_number = ${bidNumber}
      LIMIT 1
    `;

    // Get bid statistics
    const bidStats = await sql`
      SELECT 
        COUNT(*) as total_bids,
        MIN(amount_cents) as lowest_bid_cents,
        MAX(amount_cents) as highest_bid_cents,
        AVG(amount_cents) as avg_bid_cents,
        COUNT(DISTINCT supabase_user_id) as unique_carriers
      FROM carrier_bids
      WHERE bid_number = ${bidNumber}
    `;

    // Get bid timeline events (if available)
    const timelineEvents = await sql`
      SELECT 
        'received' as event_type,
        received_at as event_time,
        'Bid received from Telegram' as description,
        source_channel as source
      FROM archived_bids
      WHERE bid_number = ${bidNumber}
      
      UNION ALL
      
      SELECT 
        'archived' as event_type,
        archived_at as event_time,
        'Bid archived after expiration' as description,
        'system' as source
      FROM archived_bids
      WHERE bid_number = ${bidNumber}
      
      ORDER BY event_time ASC
    `;

    logSecurityEvent('archive_bid_details_accessed', userId, { bidNumber });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        archivedBid: archivedBid[0],
        carrierBids: carrierBids || [],
        auctionAward: auctionAward[0] || null,
        bidStats: bidStats[0] || {},
        timelineEvents: timelineEvents || []
      }
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching bid history:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('archive_bid_details_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch bid history",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

