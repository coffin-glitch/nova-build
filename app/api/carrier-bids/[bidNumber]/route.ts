import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { bidNumber: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { bidNumber } = params;

    if (!bidNumber) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    // Check if the carrier has a bid for this auction
    const existingBid = await sql`
      SELECT id, bid_number, clerk_user_id, amount_cents, notes, created_at
      FROM carrier_bids 
      WHERE bid_number = ${bidNumber} AND clerk_user_id = ${userId}
    `;

    if (existingBid.length === 0) {
      return NextResponse.json(
        { error: "Bid not found or already cancelled" },
        { status: 404 }
      );
    }

    // Delete the carrier's bid
    const result = await sql`
      DELETE FROM carrier_bids 
      WHERE bid_number = ${bidNumber} AND clerk_user_id = ${userId}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Bid not found or already cancelled" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Bid ${bidNumber} cancelled successfully`
    });

  } catch (error) {
    console.error("Cancel bid error:", error);
    return NextResponse.json(
      {
        error: "Failed to cancel bid",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
