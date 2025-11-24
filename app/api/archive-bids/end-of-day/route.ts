import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

/**
 * ARCHIVE END OF DAY BUTTON - SCHEME & LOGIC (SIMPLE UTC-BASED)
 * 
 * HOW IT WORKS:
 * 
 * 1. STORAGE (Database - UTC):
 *    - All timestamps stored in UTC (best practice)
 *    - archived_at = target_date + 1 day + 04:59:59 UTC (always)
 *    - Example: Nov 3, 2025 received_at → archived_at = Nov 4 04:59:59 UTC
 * 
 * 2. ARCHIVING LOGIC (Simple UTC boundaries):
 *    - Part 1: Archive bids with received_at::date = targetDate
 *              Sets archived_at = targetDate + 1 day + 04:59:59 UTC
 *    
 *    - Part 2: ALSO archive bids with received_at::date = (targetDate + 1) 
 *              AND received_at::time < 05:00:00 UTC
 *              These are bids from next UTC day that are still from targetDate
 *              Example: received_at = 2025-11-04 04:59:59 UTC → archive with 2025-11-03
 *              Example: received_at = 2025-11-04 05:00:20 UTC → archive with 2025-11-04
 * 
 * 3. EXAMPLES:
 *    - Archiving Nov 3, 2025:
 *      ✅ received_at = 2025-11-03 12:00:00 UTC → archived_at = 2025-11-04 04:59:59 UTC
 *      ✅ received_at = 2025-11-04 04:59:59 UTC → archived_at = 2025-11-04 04:59:59 UTC (paired with Nov 3)
 *      ✅ received_at = 2025-11-04 05:00:20 UTC → archived_at = 2025-11-05 04:59:59 UTC (paired with Nov 4)
 * 
 * 4. RULES:
 *    - UTC never has DST, so this is simple and consistent
 *    - Cutoff is always 05:00:00 UTC
 *    - archived_at always uses 04:59:59 UTC
 * 
 * BEST PRACTICES APPLIED:
 * ✅ Store timestamps in UTC (database)
 * ✅ Use simple UTC boundaries (no DST complexity)
 * ✅ Convert to Chicago only for display (frontend)
 * ✅ Convert to Chicago only for filtering (backend queries)
 */

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for archive operations
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (critical - bulk data modification)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'critical'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    const body = await request.json().catch(() => ({}));
    const targetDate = body?.targetDate;

    // Input validation (targetDate is optional)
    if (targetDate) {
      const validation = validateInput(
        { targetDate },
        {
          targetDate: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10, required: false }
        }
      );

      if (!validation.valid) {
        logSecurityEvent('invalid_end_of_day_archive_input', userId, { errors: validation.errors });
        const response = NextResponse.json(
          { error: `Invalid input: ${validation.errors.join(', ')}` },
          { status: 400 }
        );
        return addSecurityHeaders(response);
      }
    }

    let result;
    let updatedCount = 0;

    if (targetDate) {
      // Archive bids for a specific date using simple UTC boundaries
      // - Bids received on targetDate (UTC) → archive with targetDate
      // - Bids received on (targetDate + 1) before 05:00:00 UTC → also archive with targetDate
      // - Always use 04:59:59 UTC as archived_at timestamp
      
      const targetDateObj = new Date(targetDate);
      const nextDate = new Date(targetDateObj);
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      
      // Part 1: Archive bids received on the target date (UTC)
      // archived_at = targetDate + 1 day + 04:59:59 UTC
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
      
      // Part 2: ALSO archive bids received on the next day (UTC) before 05:00:00 UTC
      // These are still from targetDate (before the 05:00:00 UTC cutoff)
      // archived_at = targetDate + 1 day + 04:59:59 UTC
      const result2 = await sql`
        UPDATE telegram_bids
        SET 
          archived_at = (${targetDate}::date + INTERVAL '1 day' + INTERVAL '4 hours 59 minutes 59 seconds'),
          is_archived = true
        WHERE received_at::date = ${nextDateStr}::date
          AND archived_at IS NULL
          AND is_archived = false
          AND received_at::time < '05:00:00'::time
        RETURNING id
      `;
      updatedCount += result2.length;
    } else {
      // Default behavior: call the end of day archiving function
      result = await sql`SELECT set_end_of_day_archived_timestamps() as updated_count`;
      updatedCount = result[0]?.updated_count || 0;
    }
    
    logSecurityEvent('end_of_day_archive_executed', userId, { 
      targetDate: targetDate || 'default',
      updatedCount
    });
    
    const response = NextResponse.json({
      ok: true,
      updated: updatedCount,
      message: targetDate 
        ? `Successfully archived ${updatedCount} bids for ${targetDate}`
        : `Successfully set archived_at for ${updatedCount} bids`
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("End of day archiving error:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('end_of_day_archive_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to run end of day archiving",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

