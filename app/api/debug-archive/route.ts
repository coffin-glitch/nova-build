import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Simple test to see what's in the database
    const totalCount = await sql`SELECT COUNT(*) as total FROM archived_bids`;
    const sampleData = await sql`SELECT archived_at, COUNT(*) as count FROM archived_bids GROUP BY archived_at ORDER BY archived_at DESC LIMIT 5`;
    const dateRange = await sql`SELECT MIN(archived_at) as min_date, MAX(archived_at) as max_date FROM archived_bids`;
    
    return NextResponse.json({
      ok: true,
      totalCount: totalCount[0]?.total,
      sampleData: sampleData,
      dateRange: dateRange[0]
    });

  } catch (error) {
    console.error("Debug API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch debug data" },
      { status: 500 }
    );
  }
}

