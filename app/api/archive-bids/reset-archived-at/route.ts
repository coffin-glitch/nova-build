import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for archive operations
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (critical - data modification)
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
    const targetDate = body?.targetDate || '2025-10-26';

    // Input validation
    const validation = validateInput(
      { targetDate },
      {
        targetDate: { required: true, type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/, maxLength: 10 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_reset_archived_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Reset archived_at to NULL and set is_archived = false for bids from the specified date
    // Simple UTC-based logic:
    // 1. Bids with received_at::date = targetDate
    // 2. Bids with received_at::date = (targetDate + 1) before 05:00:00 UTC
    //    (Cutoff is always 05:00:00 UTC - no DST complexity)
    
    const dateObj = new Date(targetDate);
    const nextDate = new Date(dateObj);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    
    // Part 1: Reset bids with received_at date = targetDate
    const result = await sql`
      UPDATE telegram_bids
      SET 
        archived_at = NULL,
        is_archived = false
      WHERE received_at::date = ${targetDate}::date
      RETURNING id
    `;
    let updatedCount = result.length;
    
    // Part 2: ALSO reset bids from next day (UTC) before 05:00:00 UTC
    const result2 = await sql`
      UPDATE telegram_bids
      SET 
        archived_at = NULL,
        is_archived = false
      WHERE received_at::date = ${nextDateStr}::date
        AND received_at::time < '05:00:00'::time
        AND archived_at IS NOT NULL
      RETURNING id
    `;
    updatedCount += result2.length;

    logSecurityEvent('archived_at_reset', userId, { targetDate, updatedCount });
    
    const response = NextResponse.json({
      ok: true,
      updated: updatedCount,
      message: `Reset archived_at and is_archived for ${updatedCount} bids from ${targetDate}`
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error resetting archived_at:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('archived_at_reset_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to reset archived_at",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

