import { awardAuction } from '@/lib/auctions';
import { getClerkUserRole } from '@/lib/clerk-server';
import sql from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { bidNumber: string } }
) {
  try {
    // Ensure user is authenticated and is admin
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const { bidNumber } = params;
    const body = await request.json();
    const { winnerUserId, adminNotes } = body;

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
      awarded_by: userId
    });

    // Add admin notes if provided
    if (adminNotes) {
      await sql`
        UPDATE auction_awards 
        SET admin_notes = ${adminNotes}
        WHERE id = ${award.id}
      `;
    }

        // Get comprehensive award details for response
        const awardDetails = await sql`
          SELECT 
            aa.*,
            cp.legal_name as winner_legal_name,
            cp.mc_number as winner_mc_number,
            cp.phone as winner_phone,
            cp.email as winner_email,
            tb.distance_miles,
            tb.stops,
            tb.tag,
            tb.pickup_timestamp,
            tb.delivery_timestamp
          FROM auction_awards aa
          LEFT JOIN carrier_profiles cp ON aa.winner_user_id = cp.clerk_user_id
          LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
          WHERE aa.id = ${award.id}
        `;

        // Get admin user details from Clerk
        let adminName = 'System';
        try {
          const { users } = await import("@clerk/clerk-sdk-node");
          const adminUser = await users.getUser(userId);
          if (adminUser.firstName || adminUser.lastName) {
            adminName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim();
          } else if (adminUser.emailAddresses?.[0]?.emailAddress) {
            adminName = adminUser.emailAddresses[0].emailAddress;
          }
        } catch (error) {
          console.error('Error fetching admin user details:', error);
        }

        // Add admin name to the response
        const responseData = {
          ...awardDetails[0],
          awarded_by_name: adminName
        };

    return NextResponse.json({
      success: true,
      data: responseData,
      message: `Auction ${bidNumber} awarded successfully to ${awardDetails[0]?.winner_legal_name || 'Unknown Carrier'}`
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
  { params }: { params: { bidNumber: string } }
) {
  try {
    // Ensure user is authenticated and is admin
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const userRole = await getClerkUserRole(userId);
    if (userRole !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const { bidNumber } = params;

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
      LEFT JOIN carrier_profiles cp ON cb.clerk_user_id = cp.clerk_user_id
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
    const awardDetails = await sql`
      SELECT 
        aa.*,
        cp.legal_name as winner_legal_name,
        cp.mc_number as winner_mc_number
      FROM auction_awards aa
      LEFT JOIN carrier_profiles cp ON aa.winner_user_id = cp.clerk_user_id
      WHERE aa.bid_number = ${bidNumber}
    `;

    // Get admin name for existing awards
    let awardWithAdminName = awardDetails[0] || null;
    if (awardWithAdminName?.awarded_by) {
      try {
        const { users } = await import("@clerk/clerk-sdk-node");
        const adminUser = await users.getUser(awardWithAdminName.awarded_by);
        let adminName = 'System';
        if (adminUser.firstName || adminUser.lastName) {
          adminName = `${adminUser.firstName || ''} ${adminUser.lastName || ''}`.trim();
        } else if (adminUser.emailAddresses?.[0]?.emailAddress) {
          adminName = adminUser.emailAddresses[0].emailAddress;
        }
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
