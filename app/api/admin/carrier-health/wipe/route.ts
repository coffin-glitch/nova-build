import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * DELETE /api/admin/carrier-health/wipe
 * Wipes all health data for a given MC number
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    // Check rate limit for admin write operation (delete is critical)
    const rateLimit = await checkApiRateLimit(request, {
      userId,
      routeType: 'critical'
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
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
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
      logSecurityEvent('invalid_carrier_health_wipe_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
    if (!mcNumber) {
      const response = NextResponse.json(
        { ok: false, error: "MC number is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response, request);
    }
    
    // Delete all health data for this MC number
    const result = await sql`
      DELETE FROM carrier_health_data
      WHERE mc_number = ${mcNumber}
      RETURNING id, mc_number
    `;
    
    if (result.length === 0) {
      logSecurityEvent('carrier_health_wipe_not_found', userId, { mcNumber });
      const response = NextResponse.json({
        ok: false,
        error: "No health data found for this MC number",
      });
      return addSecurityHeaders(response, request);
    }
    
    logSecurityEvent('carrier_health_wiped', userId, { mcNumber, deletedCount: result.length });
    
    const response = NextResponse.json({
      ok: true,
      message: `Successfully wiped all health data for MC ${mcNumber}`,
      deletedCount: result.length,
    });
    
    return addSecurityHeaders(response, request);
    
  } catch (error: any) {
    console.error("Error wiping carrier health data:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('carrier_health_wipe_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        ok: false,
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Failed to wipe health data")
          : "Failed to wipe health data",
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}

