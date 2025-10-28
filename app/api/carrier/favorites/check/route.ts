import sql from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

// GET /api/carrier/favorites/check - Check if specific bids are favorited
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const bid_numbers = searchParams.get('bid_numbers');

    if (!bid_numbers) {
      return NextResponse.json(
        { error: "Bid numbers are required" },
        { status: 400 }
      );
    }

    // Parse comma-separated bid numbers
    const bidNumbersArray = bid_numbers.split(',').map(bn => bn.trim());

    // Get favorites for the specified bid numbers
    const favorites = await sql`
      SELECT bid_number 
      FROM carrier_favorites 
      WHERE carrier_user_id = ${userId} 
      AND bid_number = ANY(${bidNumbersArray})
    `;

    // Create a map of favorited bid numbers
    const favoritedBids = new Set(favorites.map(f => f.bid_number));

    // Return object with bid_number as key and boolean as value
    const result = bidNumbersArray.reduce((acc, bidNumber) => {
      acc[bidNumber] = favoritedBids.has(bidNumber);
      return acc;
    }, {} as Record<string, boolean>);

    return NextResponse.json({ 
      ok: true, 
      data: result 
    });

  } catch (error) {
    console.error('Error checking favorites:', error);
    return NextResponse.json(
      { error: "Failed to check favorites" },
      { status: 500 }
    );
  }
}
