import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bidNumber: string }> }
) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
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
    
    const { bidNumber } = await params;

    // Input validation
    const validation = validateInput(
      { bidNumber },
      {
        bidNumber: { required: true, type: 'string', pattern: /^[A-Z0-9\-_]+$/, maxLength: 100 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bid_load_info_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

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
      logSecurityEvent('bid_load_info_not_found', userId, { bidNumber });
      const response = NextResponse.json(
        { error: "Load information not found" },
        { status: 404 }
      );
      return addSecurityHeaders(response);
    }

    logSecurityEvent('bid_load_info_accessed', userId, { bidNumber });
    
    const response = NextResponse.json(loadInfo[0]);
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("Error fetching load info:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('bid_load_info_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch load information",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
