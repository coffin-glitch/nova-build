import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiCarrier, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiCarrier(request);
    const userId = auth.userId;

    // Check rate limit for authenticated read operation
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'readOnly'
    });

    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    // Fetch profile history for the current user
    const history = await sql`
      SELECT 
        id,
        carrier_user_id,
        profile_data,
        profile_status,
        submitted_at,
        reviewed_at,
        reviewed_by,
        review_notes,
        decline_reason,
        version_number,
        created_at
      FROM carrier_profile_history
      WHERE carrier_user_id = ${userId}
      ORDER BY version_number DESC
    `;

    // Parse the JSONB profile_data for each history record
    const parsedHistory = history.map((record: any) => ({
      ...record,
      profile_data: typeof record.profile_data === 'string' 
        ? JSON.parse(record.profile_data) 
        : record.profile_data
    }));

    logSecurityEvent('carrier_profile_history_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      data: parsedHistory || [] 
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error fetching profile history:", error);
    
    if (error.message === "Unauthorized" || error.message === "Carrier access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_profile_history_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch profile history",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
