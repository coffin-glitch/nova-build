import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET /api/carrier/favorites/check - Check if specific bids are favorited
export async function GET(request: NextRequest) {
  try {
    let auth;
    try {
      auth = await requireApiCarrier(request);
    } catch (authError: any) {
      console.error('Auth error in favorites check:', authError);
      return NextResponse.json(
        { error: "Authentication failed", details: authError?.message || "Unauthorized" },
        { status: 401 }
      );
    }
    
    const userId = auth.userId;
    
    if (!userId) {
      console.error('No userId from auth:', auth);
      return NextResponse.json(
        { error: "Authentication failed: no user ID" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const bid_numbers = searchParams.get('bid_numbers');

    // Input validation
    const validation = validateInput(
      { bid_numbers },
      {
        bid_numbers: { required: true, type: 'string', maxLength: 2000 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_favorites_check_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!bid_numbers) {
      const response = NextResponse.json(
        { error: "Bid numbers are required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Parse comma-separated bid numbers and validate each
    const bidNumbersArray = bid_numbers.split(',')
      .map(bn => bn.trim())
      .filter(bn => bn.length > 0 && /^[A-Z0-9\-_]+$/.test(bn) && bn.length <= 100)
      .slice(0, 100); // Limit to 100 bid numbers

    if (bidNumbersArray.length === 0) {
      const response = NextResponse.json(
        { error: "No valid bid numbers provided" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Get favorites for the specified bid numbers
    // Note: carrier_user_id was removed in migration 078, only supabase_carrier_user_id exists now
    // Use sql template literal - query all favorites for the user, then filter in JavaScript
    // This is simpler and more reliable than trying to use IN with sql.unsafe
    console.log('[favorites/check] Querying favorites for userId:', userId);
    console.log('[favorites/check] Bid numbers to check:', bidNumbersArray.length);
    
    let allFavorites;
    try {
      allFavorites = await sql`
        SELECT bid_number 
        FROM carrier_favorites 
        WHERE supabase_carrier_user_id = ${userId}
      `;
      console.log('[favorites/check] Found', allFavorites.length, 'total favorites for user');
    } catch (queryError: any) {
      console.error('[favorites/check] SQL query error:', queryError);
      console.error('[favorites/check] Error details:', {
        message: queryError?.message,
        code: queryError?.code,
        stack: queryError?.stack
      });
      throw queryError;
    }
    
    // Filter to only the requested bid numbers
    const favorites = allFavorites.filter(f => bidNumbersArray.includes(f.bid_number));
    console.log('[favorites/check] Filtered to', favorites.length, 'matching favorites');

    // Create a map of favorited bid numbers
    const favoritedBids = new Set(favorites.map(f => f.bid_number));

    // Return object with bid_number as key and boolean as value
    const result = bidNumbersArray.reduce((acc, bidNumber) => {
      acc[bidNumber] = favoritedBids.has(bidNumber);
      return acc;
    }, {} as Record<string, boolean>);

    logSecurityEvent('favorites_check_performed', userId, { 
      bidCount: bidNumbersArray.length 
    });
    
    const response = NextResponse.json({ 
      ok: true, 
      data: result 
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error('Error checking favorites:', error);
    console.error('Error details:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('favorites_check_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to check favorites",
        details: process.env.NODE_ENV === 'development' 
          ? error?.message
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
