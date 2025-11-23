import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/notification-queue';

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for queue stats
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;
    
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

