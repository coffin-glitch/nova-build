import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { calculateHealthScore } from "@/lib/carrier-health-scorer";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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
          ok: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }
    
    const { searchParams } = new URL(request.url);
    const mcNumber = searchParams.get("mc");

    // Input validation
    const validation = validateInput(
      { mcNumber },
      {
        mcNumber: { required: true, type: 'string', pattern: /^\d+$/, maxLength: 20 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_carrier_health_get_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    if (!mcNumber) {
      const response = NextResponse.json(
        { ok: false, error: "MC number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }
    
    const result = await sql`
      SELECT 
        id,
        mc_number,
        carrier_name,
        carrier_url,
        overview_data,
        directory_data,
        bluewire_score,
        connection_status,
        assessment_status,
        dot_status,
        operating_status,
        safety_rating,
        eld_status,
        eld_provider,
        health_score,
        health_status,
        last_updated_at,
        updated_by
      FROM carrier_health_data
      WHERE mc_number = ${mcNumber}
      LIMIT 1
    `;
    
    if (result.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "No health data found for this MC number",
        data: null,
      });
    }
    
    // Calculate health score breakdown if overview_data exists
    let breakdown = null;
    if (result[0].overview_data) {
      try {
        const healthScoreResult = await calculateHealthScore(result[0].overview_data);
        breakdown = healthScoreResult.breakdown;
      } catch (error) {
        console.error('Error calculating health score breakdown:', error);
      }
    }
    
    logSecurityEvent('carrier_health_retrieved', userId, { mcNumber });
    
    const response = NextResponse.json({
      ok: true,
      data: {
        ...result[0],
        breakdown,
      },
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    
  } catch (error: any) {
    console.error("Error retrieving carrier health data:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_health_get_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to retrieve health data")
          : "Failed to retrieve health data",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

