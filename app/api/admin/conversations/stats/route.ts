import { addSecurityHeaders, logSecurityEvent } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Supabase auth only
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

    // Calculate average response time for admin messages
    // This calculates the time between a carrier message and the next admin response
    // Simplified query to avoid prepared statement issues
    const responseTimeStats = await sql`
      SELECT 
        AVG(response_minutes) as avg_response_minutes
      FROM (
        SELECT 
          cm1.conversation_id,
          cm1.created_at as carrier_time,
          (
            SELECT cm2.created_at
            FROM conversation_messages cm2
            WHERE cm2.conversation_id = cm1.conversation_id
              AND cm2.sender_type = 'admin'
              AND cm2.created_at > cm1.created_at
            ORDER BY cm2.created_at ASC
            LIMIT 1
          ) as admin_time,
          EXTRACT(EPOCH FROM (
            (
              SELECT cm2.created_at
              FROM conversation_messages cm2
              WHERE cm2.conversation_id = cm1.conversation_id
                AND cm2.sender_type = 'admin'
                AND cm2.created_at > cm1.created_at
              ORDER BY cm2.created_at ASC
              LIMIT 1
            ) - cm1.created_at
          )) / 60 as response_minutes
        FROM conversation_messages cm1
        JOIN conversations c ON c.id = cm1.conversation_id
        WHERE c.supabase_admin_user_id = ${userId}
          AND cm1.sender_type = 'carrier'
      ) subquery
      WHERE admin_time IS NOT NULL
    `;

    const avgResponseMinutes = responseTimeStats[0]?.avg_response_minutes || 0;

    logSecurityEvent('admin_conversation_stats_accessed', userId);
    
    const response = NextResponse.json({ 
      ok: true, 
      avg_response_minutes: avgResponseMinutes
    });
    
    return addSecurityHeaders(response, request);

  } catch (error: any) {
    console.error("Error calculating response time stats:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_conversation_stats_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json({ 
      ok: true,
      avg_response_minutes: 0,
      error: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : undefined
    });
    
    return addSecurityHeaders(response, request);
  }
}

