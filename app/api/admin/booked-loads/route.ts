import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
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
          success: false,
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);
    }

    // Get today's date range
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get loads that have accepted offers today
    // For now, return 0 since we don't have a proper offers system yet
    const bookedLoads: any[] = [];

    // Get summary stats
    const totalBooked = bookedLoads.length;
    const totalRevenue = bookedLoads.reduce((sum, load) => sum + (load.rate || 0), 0);

    logSecurityEvent('booked_loads_accessed', userId);
    
    const response = NextResponse.json({
      success: true,
      data: {
        bookedLoads,
        summary: {
          totalBooked,
          totalRevenue
        }
      }
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error: any) {
    console.error("Error fetching booked loads:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('booked_loads_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch booked loads",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}
