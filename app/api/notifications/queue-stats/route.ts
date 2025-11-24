import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/notification-queue';

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for queue stats
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
    
    const stats = await getQueueStats();
    
    logSecurityEvent('notification_queue_stats_accessed', userId);
    
    const response = NextResponse.json({
      success: true,
      ...stats,
      timestamp: new Date().toISOString(),
    });
    
    return addSecurityHeaders(response);
    
  } catch (error: any) {
    console.error("Error fetching queue stats:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('notification_queue_stats_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === 'development' 
          ? error.message
          : 'Failed to get queue stats. Check REDIS_URL is configured.',
        message: 'Failed to get queue stats. Check REDIS_URL is configured.',
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

