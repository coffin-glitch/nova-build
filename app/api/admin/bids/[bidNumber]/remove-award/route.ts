import { removeAward } from '@/lib/auctions';
import { requireApiAdmin } from '@/lib/auth-api-helper';
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
    const { bidNumber } = await params;

    if (!bidNumber) {
      return NextResponse.json(
        { error: "Bid number is required" },
        { status: 400 }
      );
    }

    // Remove the award
    await removeAward({
      bid_number: bidNumber,
      removed_by: userId
    });

    return NextResponse.json({
      success: true,
      message: `Award for Bid #${bidNumber} has been removed successfully. The bid is now available for re-award.`
    });

  } catch (error) {
    console.error("Remove award error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to remove award",
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

