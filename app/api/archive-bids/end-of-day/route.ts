import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetDate = body?.targetDate;

    let result;
    let updatedCount = 0;

    if (targetDate) {
      // Archive bids for a specific date using UTC best practices
      // Logic: For bids received on targetDate, set archived_at to targetDate + 1 day at 04:59:59 UTC
      // This represents the end of the day when the bid was received (in CDT timezone)
      // Example: For Oct 26, 2025 bids, store archived_at = 2025-10-27T04:59:59Z
      // This equals Oct 26 23:59:59 CDT (end of day)
      
      result = await sql`
        UPDATE telegram_bids
        SET 
          archived_at = (received_at::date + INTERVAL '1 day' + INTERVAL '4 hours 59 minutes 59 seconds'),
          is_archived = true
        WHERE received_at::date = ${targetDate}::date
          AND archived_at IS NULL
        RETURNING id
      `;
      updatedCount = result.length;
    } else {
      // Default behavior: call the end of day archiving function
      result = await sql`SELECT set_end_of_day_archived_timestamps() as updated_count`;
      updatedCount = result[0]?.updated_count || 0;
    }
    
    return NextResponse.json({
      ok: true,
      updated: updatedCount,
      message: targetDate 
        ? `Successfully archived ${updatedCount} bids for ${targetDate}`
        : `Successfully set archived_at for ${updatedCount} bids`
    });
  } catch (error) {
    console.error("End of day archiving error:", error);
    return NextResponse.json(
      { error: "Failed to run end of day archiving", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

