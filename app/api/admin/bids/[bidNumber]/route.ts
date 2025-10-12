import sqlTemplate from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { bidNumber: string } }
) {
  try {
    const { bidNumber } = params;

    if (!bidNumber) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    // First delete carrier bids for this bid number
    await sqlTemplate`
      DELETE FROM carrier_bids 
      WHERE bid_number = ${bidNumber}
    `;

    // Then delete the telegram bid
    const result = await sqlTemplate`
      DELETE FROM telegram_bids 
      WHERE bid_number = ${bidNumber}
    `;

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Bid not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Bid ${bidNumber} deleted successfully`
    });

  } catch (error) {
    console.error("Delete bid error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete bid",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
