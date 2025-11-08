import { awardAuction } from '@/lib/auctions';
import { requireApiAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth-api-helper';
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    // Use unified auth (supports Supabase and Clerk)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { bidNumber } = await params;
    const body = await request.json();
    const { winnerUserId, adminNotes, marginCents } = body;

    if (!bidNumber) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    if (!winnerUserId) {
      return NextResponse.json(
        { error: "Winner user ID is required" },
        { status: 400 }
      );
    }

    // Award the auction using the existing function
    const award = await awardAuction({
      bid_number: bidNumber,
      winner_user_id: winnerUserId,
      awarded_by: userId,
      admin_notes: adminNotes, // Pass notes directly to awardAuction function
      margin_cents: marginCents ? parseInt(marginCents) : undefined // Convert to integer if provided
    });

    // Admin notes are now handled in awardAuction function

        // Get comprehensive award details for response
        // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
        const awardDetails = await sql`
          SELECT 
            aa.*,
            cp.legal_name as winner_legal_name,
            cp.company_name as winner_company_name,
            cp.mc_number as winner_mc_number,
            cp.phone as winner_phone,
            cp.contact_name as winner_contact_name,
            tb.distance_miles,
            tb.stops,
            tb.tag,
            tb.pickup_timestamp,
            tb.delivery_timestamp
          FROM auction_awards aa
          LEFT JOIN carrier_profiles cp ON (
            aa.supabase_winner_user_id = cp.supabase_user_id
          )
          LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
          WHERE aa.id = ${award.id}
        `;

        // Get admin user details from Supabase or Clerk
        let adminName = 'System';
        try {
          if (auth.authProvider === 'supabase') {
            // Get from Supabase
            const { getSupabaseService } = await import("@/lib/supabase");
            const supabase = getSupabaseService();
            const { data: adminUser, error: userError } = await supabase.auth.admin.getUserById(userId);
            if (!userError && adminUser?.user) {
              adminName = adminUser.user.email || adminUser.user.user_metadata?.full_name || 'System';
            }
          } else {
            // Get admin name from user_roles_cache (Supabase-only)
            const adminUserResult = await sql`
              SELECT email FROM user_roles_cache WHERE supabase_user_id = ${userId}
            `;
            if (adminUserResult[0]?.email) {
              adminName = adminUserResult[0].email;
            }
          }
        } catch (error) {
          console.error('Error fetching admin user details:', error);
        }

        // Add admin name to the response
        const responseData = {
          ...awardDetails[0],
          awarded_by_name: adminName
        };

    // Format winner amount for display
    const winnerAmountDollars = (awardDetails[0]?.winner_amount_cents / 100).toFixed(2);
    const winnerName = awardDetails[0]?.winner_legal_name || 'Unknown Carrier';

    return NextResponse.json({
      success: true,
      data: responseData,
      winnerName: winnerName,
      winnerAmount: winnerAmountDollars,
      message: `Auction ${bidNumber} awarded successfully to ${winnerName}`
    });

  } catch (error) {
    console.error("Award bid error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to award bid",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);
    
    const { bidNumber } = await params;

    if (!bidNumber) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    // Get all bids for this auction with carrier details
    const bids = await sql`
      SELECT 
        cb.*,
        cp.legal_name as carrier_legal_name,
        cp.mc_number as carrier_mc_number,
        cp.dot_number as carrier_dot_number,
        cp.phone as carrier_phone,
        cp.company_name as carrier_company_name,
        cp.contact_name as carrier_contact_name,
        cp.created_at as carrier_created_at
      FROM carrier_bids cb
      LEFT JOIN carrier_profiles cp ON cb.supabase_user_id = cp.supabase_user_id
      WHERE cb.bid_number = ${bidNumber}
      ORDER BY cb.amount_cents ASC
    `;

    // Get auction details
    const auctionDetails = await sql`
      SELECT 
        tb.*,
        (tb.received_at::timestamp + INTERVAL '25 minutes')::text as expires_at_25,
        NOW() > (tb.received_at::timestamp + INTERVAL '25 minutes') as is_expired
      FROM telegram_bids tb
      WHERE tb.bid_number = ${bidNumber}
    `;

    // Get award details if exists
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    const awardDetails = await sql`
      SELECT 
        aa.*,
        cp.legal_name as winner_legal_name,
        cp.mc_number as winner_mc_number
      FROM auction_awards aa
      LEFT JOIN carrier_profiles cp ON (
        aa.supabase_winner_user_id = cp.supabase_user_id
      )
      WHERE aa.bid_number = ${bidNumber}
    `;

    // Get admin name for existing awards (Supabase-only)
    let awardWithAdminName = awardDetails[0] || null;
    if (awardWithAdminName?.supabase_awarded_by || awardWithAdminName?.awarded_by) {
      try {
        const adminUserId = awardWithAdminName.supabase_awarded_by || awardWithAdminName.awarded_by;
        // Get admin name from user_roles_cache (Supabase-only)
        const adminUserResult = await sql`
          SELECT email FROM user_roles_cache WHERE supabase_user_id = ${adminUserId}
        `;
        const adminName = adminUserResult[0]?.email || 'System';
        awardWithAdminName = {
          ...awardWithAdminName,
          awarded_by_name: adminName
        };
      } catch (error) {
        console.error('Error fetching admin user details for existing award:', error);
        awardWithAdminName = {
          ...awardWithAdminName,
          awarded_by_name: 'System'
        };
      }
    }

    // Calculate time left
    let timeLeftSeconds = 0;
    if (auctionDetails[0]) {
      const receivedAt = new Date(auctionDetails[0].received_at);
      const expiresAt = new Date(receivedAt.getTime() + (25 * 60 * 1000));
      const now = new Date();
      timeLeftSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    }

    console.log(`[Admin Bids Award GET] Bid ${bidNumber}: Found ${bids.length} carrier bids`);
    if (bids.length > 0) {
      console.log(`[Admin Bids Award GET] Sample bid:`, {
        id: bids[0].id,
        bid_number: bids[0].bid_number,
        supabase_user_id: bids[0].supabase_user_id,
        amount_cents: bids[0].amount_cents,
        carrier_legal_name: bids[0].carrier_legal_name,
        carrier_mc_number: bids[0].carrier_mc_number
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        auction: auctionDetails[0] || null,
        bids: bids,
        award: awardWithAdminName,
        timeLeftSeconds,
        totalBids: bids.length,
        lowestBid: bids.length > 0 ? bids[0] : null,
        highestBid: bids.length > 0 ? bids[bids.length - 1] : null
      }
    });

  } catch (error) {
    console.error("Get bid details error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to get bid details",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
