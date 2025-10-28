import { requireAdmin } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const { bidNumber } = await params;
    
    // This will redirect if user is not admin
    await requireAdmin();

    // Get load information from telegram_bids table
    const loadInfo = await sql`
      SELECT 
        pickup_timestamp,
        delivery_timestamp,
        distance_miles,
        stops,
        tag
      FROM telegram_bids
      WHERE bid_number = ${bidNumber}
      LIMIT 1
    `;

    if (loadInfo.length === 0) {
      return NextResponse.json(
        { error: "Load information not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(loadInfo[0]);
  } catch (error) {
    console.error("Error fetching load info:", error);
    return NextResponse.json(
      { error: "Failed to fetch load information" },
      { status: 500 }
    );
  }
}
