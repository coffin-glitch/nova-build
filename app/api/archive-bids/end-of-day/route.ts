import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const targetDate = body?.targetDate;

    let result;
    let updatedCount = 0;

    if (targetDate) {
      // Archive bids for a specific date using current UTC time
      // Best practice: Always store and compare in UTC
      // 
      // For archiving bids on Oct 26, 2025:
      // 1. Store archived_at as current UTC time (NOW())
      // 2. This ensures the archive timestamp reflects when the archiving happened
      // 3. When displayed in CDT timezone, it will show the correct date
      //
      // Example: If archiving Oct 26 bids at 2025-10-27 08:00:00 UTC
      //   Stored in DB: archived_at = 2025-10-27 08:00:00 UTC
      //   When displayed in CDT: shows as Oct 27 03:00:00 CDT
      //   When filtered by Oct 26 CDT: (archived_at AT TIME ZONE 'America/Chicago')::date = Oct 27
      //
      // To make bids appear on Oct 26 in CDT, we need archived_at to be Oct 27 in CDT
      // This means we need to store Oct 27 00:00:00 CDT = Oct 27 05:00:00 UTC
      // 
      // Actually simpler: Store the end of the target day in UTC
      // For targetDate = '2025-10-26', store archived_at = '2025-10-27T04:59:59Z'
      // This equals Oct 26 23:59:59 CDT
      const dateObj = new Date(targetDate);
      dateObj.setDate(dateObj.getDate() + 1); // Next day
      const targetTimestamp = new Date(`${dateObj.toISOString().split('T')[0]}T04:59:59Z`);
      
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

