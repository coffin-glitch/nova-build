import { addRateLimitHeaders, checkApiRateLimit } from "@/lib/api-rate-limiting";
import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { getAuthConfig } from "@/lib/auth-config";
import { getAuthMetricsForAPI } from "@/lib/auth-monitoring";
import { NextRequest, NextResponse } from "next/server";

/**
 * Admin Auth Metrics Endpoint
 * 
 * Provides auth metrics and monitoring data for the migration.
 * Requires admin access.
 */
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
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter
        },
        { status: 429 }
      );
      return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    }
    
    const metrics = getAuthMetricsForAPI();
    const config = getAuthConfig();
    
    logSecurityEvent('auth_metrics_accessed', userId);
    
    const response = NextResponse.json({
      config: {
        provider: config.provider,
        allowDualAuth: config.allowDualAuth,
        enableMonitoring: config.enableMonitoring,
        enableRollback: config.enableRollback,
      },
      metrics,
      timestamp: new Date().toISOString(),
    });
    
    return addRateLimitHeaders(addSecurityHeaders(response, request), rateLimit);
    
  } catch (error: any) {
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('auth_metrics_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: process.env.NODE_ENV === 'development' 
          ? (error.message || "Unauthorized")
          : "Unauthorized"
      },
      { status: error.message === "Unauthorized" || error.message === "Admin access required" ? 401 : 500 }
    );
    
    return addSecurityHeaders(response, request);
  }
}



