import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for read-only carrier operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const bidNumber = searchParams.get("bidNumber");

    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { 
          required: true, 
          type: 'string', 
          pattern: /^[A-Z0-9\-_]+$/,
          maxLength: 100
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_history_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }

    // Verify the user owns this bid (Supabase-only)
    // Note: winner_user_id was removed in migration 078, only supabase_winner_user_id exists
    const ownership = await sql`
      SELECT 1 FROM auction_awards 
      WHERE bid_number = ${bidNumber} AND supabase_winner_user_id = ${userId}
      LIMIT 1
    `;
    
    if (ownership.length === 0) {
      return NextResponse.json(
        { error: "You don't have access to this bid" },
        { status: 403 }
      );
    }

    // Get bid lifecycle events/history
    // Note: bid_lifecycle_events stores events in JSONB event_data, we'll extract what we need
    const history = await sql`
      SELECT 
        id,
        bid_id as bid_number,
        event_type as action,
        (event_data->>'previous_status')::text as old_status,
        event_type as new_status,
        notes as carrier_notes,
        (event_data->>'admin_notes')::text as admin_notes,
        timestamp as performed_at,
        -- Try to get performer email from event_data or use current user
        COALESCE(
          (SELECT email FROM user_roles_cache WHERE supabase_user_id = (event_data->>'performed_by')::text LIMIT 1),
          (SELECT email FROM user_roles_cache WHERE supabase_user_id = (event_data->>'user_id')::text LIMIT 1),
          (SELECT email FROM user_roles_cache WHERE supabase_user_id = ${userId} LIMIT 1),
          'System'
        ) as performed_by
      FROM bid_lifecycle_events
      WHERE bid_id = ${bidNumber}
      ORDER BY timestamp ASC
    `;

    // If no lifecycle events, try to get basic history from carrier_bids
    if (history.length === 0) {
      const basicHistory = await sql`
        SELECT 
          id,
          bid_number,
          'bid_placed' as action,
          NULL::text as old_status,
          COALESCE(status, 'awarded') as new_status,
          lifecycle_notes as carrier_notes,
          NULL::text as admin_notes,
          created_at as performed_at,
          (SELECT email FROM user_roles_cache WHERE supabase_user_id = ${userId} LIMIT 1) as performed_by
        FROM carrier_bids
        WHERE bid_number = ${bidNumber} AND supabase_user_id = ${userId}
        ORDER BY created_at ASC
      `;
      
      return NextResponse.json({
        ok: true,
        history: basicHistory || []
      });
    }

    logSecurityEvent('bid_history_accessed', userId, { bidNumber });
    
    const response = NextResponse.json({
      ok: true,
      history: history || []
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);

  } catch (error: any) {
    console.error("Error fetching bid history:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_history_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false,
        error: "Failed to fetch bid history",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

