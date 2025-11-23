import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit (search operation if status param present, otherwise read-only)
    const { searchParams } = new URL(request.url);
    const hasStatus = searchParams.get("status");
    
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: hasStatus ? 'search' : 'readOnly'
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
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'won', 'lost', 'pending', 'cancelled'
    const limitParam = searchParams.get("limit") || "50";
    const offsetParam = searchParams.get("offset") || "0";

    // Input validation
    const validation = validateInput(
      { status, limit: limitParam, offset: offsetParam },
      {
        status: { type: 'string', enum: ['won', 'lost', 'pending', 'cancelled'], required: false },
        limit: { type: 'string', pattern: /^\d+$/, required: false },
        offset: { type: 'string', pattern: /^\d+$/, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_history_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const limit = Math.min(parseInt(limitParam), 100); // Max 100
    const offset = Math.max(0, parseInt(offsetParam)); // Ensure non-negative

    // Get carrier bid history with detailed information
    // Note: Using telegram_bids for both active and archived bids (archived_at IS NOT NULL means archived)
    const rows = await sql`
      SELECT 
        cb.id,
        cb.bid_number,
        cb.amount_cents / 100.0 as bid_amount,
        COALESCE(cb.bid_outcome, 'pending') as bid_status,
        cb.notes as bid_notes,
        cb.created_at,
        cb.updated_at,
        -- Load details from telegram_bids (works for both active and archived)
        COALESCE(tb.distance_miles, 0) as distance_miles,
        COALESCE(tb.pickup_timestamp, cb.created_at) as pickup_timestamp,
        COALESCE(tb.delivery_timestamp, cb.created_at + INTERVAL '1 day') as delivery_timestamp,
        COALESCE(tb.stops, '[]'::JSONB) as stops,
        COALESCE(tb.tag, 'UNKNOWN') as tag,
        COALESCE(tb.source_channel, 'unknown') as source_channel,
        -- Additional metadata
        CASE 
          WHEN tb.archived_at IS NOT NULL THEN 'archived'
          WHEN tb.id IS NOT NULL THEN 'active'
          ELSE 'unknown'
        END as load_status,
        tb.archived_at
      FROM carrier_bids cb
      LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      WHERE cb.supabase_user_id = ${userId}
      ${status ? sql`AND COALESCE(cb.bid_outcome, 'pending') = ${status}` : sql``}
      ORDER BY cb.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM carrier_bids cb
      WHERE cb.supabase_user_id = ${userId}
      ${status ? sql`AND COALESCE(cb.bid_outcome, 'pending') = ${status}` : sql``}
    `;

    const total = countResult[0]?.total || 0;

    // Get statistics
    const stats = await sql`
      SELECT 
        COUNT(*) as total_bids,
        COUNT(CASE WHEN COALESCE(bid_outcome, 'pending') = 'won' THEN 1 END) as won_bids,
        COUNT(CASE WHEN COALESCE(bid_outcome, 'pending') = 'lost' THEN 1 END) as lost_bids,
        COUNT(CASE WHEN COALESCE(bid_outcome, 'pending') = 'pending' THEN 1 END) as pending_bids,
        COUNT(CASE WHEN COALESCE(bid_outcome, 'pending') = 'cancelled' THEN 1 END) as cancelled_bids,
        AVG(amount_cents / 100.0) as average_bid_amount,
        SUM(amount_cents / 100.0) as total_bid_value
      FROM carrier_bids cb
      WHERE cb.supabase_user_id = ${userId}
    `;

    logSecurityEvent('carrier_bid_history_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      stats: stats[0] || {
        total_bids: 0,
        won_bids: 0,
        lost_bids: 0,
        pending_bids: 0,
        cancelled_bids: 0,
        average_bid_amount: 0,
        total_bid_value: 0
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching carrier bid history:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_bid_history_error', undefined, { 
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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { bidNumber, bidStatus, bidNotes } = body;

    // Input validation
    const validation = validateInput(
      { bidNumber, bidStatus, bidNotes },
      {
        bidNumber: { 
          required: true, 
          type: 'string', 
          pattern: /^[A-Z0-9\-_]+$/,
          maxLength: 100
        },
        bidStatus: { 
          required: true, 
          type: 'string', 
          enum: ['won', 'lost', 'pending', 'cancelled']
        },
        bidNotes: { 
          type: 'string', 
          maxLength: 1000,
          required: false
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_status_update_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

           // Update carrier bid outcome
           const result = await sql`
             UPDATE carrier_bids 
             SET 
               bid_outcome = ${bidStatus},
               notes = COALESCE(${bidNotes}, notes),
               updated_at = NOW()
             WHERE supabase_user_id = ${userId}
             AND bid_number = ${bidNumber}
             RETURNING id
           `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }

           // Also insert into bid history for tracking
           await sql`
             INSERT INTO carrier_bid_history (
               carrier_user_id, 
               bid_number, 
               bid_amount_cents, 
               bid_status, 
               bid_notes
             )
             SELECT 
               cb.supabase_user_id,
               cb.bid_number,
               cb.amount_cents,
               ${bidStatus},
               COALESCE(${bidNotes}, cb.notes)
             FROM carrier_bids cb
             WHERE cb.supabase_user_id = ${userId}
             AND cb.bid_number = ${bidNumber}
             ON CONFLICT (carrier_user_id, bid_number, created_at) DO NOTHING
           `;

    logSecurityEvent('bid_status_updated', userId, { bidNumber, bidStatus });
    
    const response = NextResponse.json({
      ok: true,
      message: "Bid status updated successfully"
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error updating bid status:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_status_update_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to update bid status",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
