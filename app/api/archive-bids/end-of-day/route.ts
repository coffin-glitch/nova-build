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
      // Logic: 
      // 1. For bids received on targetDate (in any timezone), set archived_at to (targetDate + 1 day + 04:59:59 UTC)
      // 2. ALSO archive bids received on (targetDate + 1 day) with time between 00:00:00 and 04:59:59 UTC
      //    These are bids from the same day in CDT (since CDT is UTC-5, 04:59:59 UTC = 23:59:59 CDT previous day)
      // 
      // Example for archiving Oct 25, 2025:
      //   - Archive bids with received_at::date = '2025-10-25' → archived_at = 2025-10-26 04:59:59 UTC
      //   - Archive bids with received_at::date = '2025-10-26' AND received_at::time < 05:00:00 → archived_at = 2025-10-26 04:59:59 UTC
      //   These are bids received between Oct 25 00:00:00 CDT and Oct 26 04:59:59 UTC (which is still Oct 25 in CDT)
      
      const targetDateTime = new Date(targetDate);
      const nextDate = new Date(targetDateTime);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      
      // Part 1: Archive bids received on the target date
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
      
      // Part 2: ALSO archive bids received on the next day (targetDate + 1) if they were received 
      // between 00:00:00 and 04:59:59 UTC (i.e., before 04:59:59)
      // These bids are from the same day in CDT timezone
      const result2 = await sql`
        UPDATE telegram_bids
        SET 
          archived_at = ${targetDate}::date + INTERVAL '1 day' + INTERVAL '4 hours 59 minutes 59 seconds',
          is_archived = true
        WHERE received_at::date = ${nextDateStr}::date
          AND archived_at IS NULL
          AND is_archived = false
          AND received_at::time < '05:00:00'
        RETURNING id
      `;
      updatedCount += result2.length;
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

