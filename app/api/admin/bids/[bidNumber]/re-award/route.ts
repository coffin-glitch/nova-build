import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { reAwardAuction } from '@/lib/auctions';
import { requireApiAdmin, unauthorizedResponse } from '@/lib/auth-api-helper';
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

    // Check rate limit for admin write operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'admin'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    const { bidNumber } = await params;
    const body = await request.json();
    const { winnerUserId, adminNotes, marginCents } = body;

    // Input validation
    const validation = validateInput(
      { bidNumber, winnerUserId, adminNotes, marginCents },
      {
        bidNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 },
        winnerUserId: { required: true, type: 'string', minLength: 1, maxLength: 200 },
        adminNotes: { type: 'string', maxLength: 2000, required: false },
        marginCents: { type: 'number', min: 0, max: 100000000, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_re_award_input', userId, { errors: validation.errors, bidNumber });
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

    if (!winnerUserId) {
      const response = NextResponse.json(
        { error: "Winner user ID is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Re-award the auction using the reAwardAuction function
    const award = await reAwardAuction({
      bid_number: bidNumber,
      winner_user_id: winnerUserId,
      awarded_by: userId,
      admin_notes: adminNotes || null,
      margin_cents: marginCents ? parseInt(marginCents) : undefined
    });

    // Get comprehensive award details for response
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

    logSecurityEvent('bid_re_awarded', userId, { 
      bidNumber, 
      winnerUserId,
      winnerAmount: winnerAmountDollars
    });
    
    const response = NextResponse.json({
      success: true,
      data: responseData,
      winnerName: winnerName,
      winnerAmount: winnerAmountDollars,
      message: `Auction ${bidNumber} re-awarded successfully to ${winnerName}`
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Re-award bid error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('re_award_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        success: false,
        error: "Failed to re-award bid",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}


