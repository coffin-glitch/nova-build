import sql from "@/lib/db";
import { requireApiCarrier } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/carrier/bids/cancel/[id] - Cancel/delete a bid
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    const { id } = await params;

    // First check if the bid exists and belongs to the user
    const bidCheck = await sql`
      SELECT cb.*, tb.received_at, tb.expires_at
      FROM carrier_bids cb
      LEFT JOIN telegram_bids tb ON cb.bid_number = tb.bid_number
      WHERE cb.id = ${id} AND cb.supabase_user_id = ${userId}
    `;

    if (bidCheck.length === 0) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }

    const bid = bidCheck[0];

    // Check if the auction is still active (within 25 minutes of posting)
    if (bid.received_at) {
      const receivedAt = new Date(bid.received_at);
      const expiresAt = new Date(receivedAt.getTime() + 25 * 60 * 1000); // 25 minutes
      const now = new Date();

      if (now > expiresAt) {
        return NextResponse.json(
          { error: "Cannot cancel bid - auction has expired" },
          { status: 400 }
        );
      }
    }

      // Delete the bid
      const result = await sql`
        DELETE FROM carrier_bids 
        WHERE id = ${id} AND supabase_user_id = ${userId}
        RETURNING id
      `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Failed to cancel bid" },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Bid cancelled successfully" 
    });

  } catch (error) {
    console.error('Error cancelling bid:', error);
    return NextResponse.json(
      { error: "Failed to cancel bid" },
      { status: 500 }
    );
  }
}

