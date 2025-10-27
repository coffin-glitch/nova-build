import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

/**
 * ARCHIVE END OF DAY BUTTON - SCHEME & LOGIC
 * 
 * HOW IT WORKS:
 * 
 * 1. STORAGE (Database - UTC):
 *    - All timestamps stored in UTC (best practice)
 *    - archived_at = received_at + 1 day + 04:59:59 UTC
 *    - Example: Oct 25, 2025 received_at → archived_at = Oct 26 04:59:59 UTC
 * 
 * 2. TIMEZONE CONVERSION (CDT Display):
 *    - CDTT = UTC-5 (Central Daylight Time)
 *    - Oct 26 04:59:59 UTC = Oct 25 23:59:59 CDT (previous day)
 *    - archived_at represents END OF DAY in CDT timezone
 * 
 * 3. ARCHIVING LOGIC (Two-part process):
 *    - Part 1: Archive bids with received_at::date = targetDate
 *              Sets archived_at = (targetDate + 1 day + 04:59:59 UTC)
 *    
 *    - Part 2: ALSO archive bids with received_at::date = (targetDate + 1) 
 *              AND received_at::time < '05:00:00 UTC'
 *              These are bids from 00:00-04:59 UTC next day, still same day in CDT
 * 
 * 4. EXAMPLE - Archiving Oct 25, 2025:
 *    ✅ Archive: received_at = 2025-10-25 12:00:00 UTC → archived_at = 2025-10-26 04:59:59 UTC
 *    ✅ Archive: received_at = 2025-10-26 01:17:50 UTC → archived_at = 2025-10-26 04:59:59 UTC
 *       (This is Oct 25 20:17:50 CDT - still Oct 25)
 *    
 *    ✗ Skip: received_at = 2025-10-26 05:00:00 UTC → NOT archived
 *       (This is already Oct 26 in CDT)
 * 
 * 5. DISPLAY (Frontend):
 *    - When displaying archived_at in CDT: Shows as Oct 25, 2025 at 11:59:59 PM
 *    - When filtering by Oct 25: Uses (archived_at AT TIME ZONE 'America/Chicago')::date
 * 
 * 6. RESET LOGIC:
 *    - Same two-part process as archiving
 *    - Resets ALL bids that would be archived together
 * 
 * BEST PRACTICES APPLIED:
 * ✅ Store timestamps in UTC (database)
 * ✅ Convert to CDT only for display (frontend)
 * ✅ Convert to CDT only for filtering (backend queries)
 * ✅ Handle timezone boundary edge cases (00:00-04:59 UTC)
 */

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

