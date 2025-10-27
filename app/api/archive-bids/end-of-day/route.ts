import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetDate = body?.targetDate;

    let result;
    let updatedCount = 0;

    if (targetDate) {
      // Archive bids for a specific date
      // The issue: we want bids archived on Oct 26 CDT to show as Oct 26
      // If we set archived_at = 2025-10-26 23:59:59 CDT = 2025-10-27 04:59:59 UTC
      // Then when we query with CDT timezone: (archived_at AT TIME ZONE 'America/Chicago')::date
      // It becomes 2025-10-26T23:59:59 CDT = Oct 26 ✓
      
      // So for a bid on Oct 26, we store it as Oct 27 04:59:59 UTC
      // This way (archived_at AT TIME ZONE 'America/Chicago')::date = Oct 26
      // Add 1 day to the target date, then set to 04:59:59 UTC
      const dateObj = new Date(targetDate);
      dateObj.setDate(dateObj.getDate() + 1); // Add 1 day
      const targetTimestamp = new Date(`${dateObj.toISOString().split('T')[0]}T04:59:59Z`);
      
      // But wait - we need to verify this works with the timezone conversion
      // Let's test: 2025-10-27T04:59:59Z in America/Chicago timezone
      // Should be: Oct 26 23:59:59 CDT
      
      result = await sql`
        UPDATE telegram_bids
        SET 
          archived_at = ${targetTimestamp.toISOString()},
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

