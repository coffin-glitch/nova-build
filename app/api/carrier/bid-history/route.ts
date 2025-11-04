import sql from '@/lib/db';
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'won', 'lost', 'pending', 'cancelled'
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Get carrier bid history with detailed information
    const rows = await sql`
      SELECT 
        cb.id,
        cb.bid_number,
        cb.amount_cents / 100.0 as bid_amount,
        COALESCE(cb.bid_outcome, 'pending') as bid_status,
        cb.notes as bid_notes,
        cb.created_at,
        cb.updated_at,
        -- Load details from archived bids or telegram bids
        COALESCE(ab.distance_miles, tb.distance_miles, 0) as distance_miles,
        COALESCE(ab.pickup_timestamp, tb.pickup_timestamp, cb.created_at) as pickup_timestamp,
        COALESCE(ab.delivery_timestamp, tb.delivery_timestamp, cb.created_at + INTERVAL '1 day') as delivery_timestamp,
        COALESCE(ab.stops, tb.stops, '[]'::JSONB) as stops,
        COALESCE(ab.tag, tb.tag, 'UNKNOWN') as tag,
        COALESCE(ab.source_channel, tb.source_channel, 'unknown') as source_channel,
        -- Additional metadata
        CASE 
          WHEN ab.id IS NOT NULL THEN 'archived'
          WHEN tb.id IS NOT NULL THEN 'active'
          ELSE 'unknown'
        END as load_status,
        COALESCE(ab.archived_at, NULL) as archived_at
      FROM carrier_bids cb
      LEFT JOIN archived_bids ab ON cb.bid_number = ab.bid_number
      LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number AND tb.is_archived = false
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

    return NextResponse.json({
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

  } catch (error) {
    console.error("Error fetching carrier bid history:", error);
    return NextResponse.json(
      { error: "Failed to fetch bid history" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const body = await request.json();
    const { bidNumber, bidStatus, bidNotes } = body;

    if (!bidNumber || !bidStatus) {
      return NextResponse.json(
        { error: "Bid number and status are required" },
        { status: 400 }
      );
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

    return NextResponse.json({
      ok: true,
      message: "Bid status updated successfully"
    });

  } catch (error) {
    console.error("Error updating bid status:", error);
    return NextResponse.json(
      { error: "Failed to update bid status" },
      { status: 500 }
    );
  }
}
