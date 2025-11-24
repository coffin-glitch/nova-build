import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from '@/lib/db';
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication for archive access
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
    
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000);
    const offset = parseInt(searchParams.get("offset") || "0");

    // Input validation
    const validation = validateInput(
      { limit, offset },
      {
        limit: { type: 'number', min: 1, max: 1000 },
        offset: { type: 'number', min: 0 }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_archive_simple_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Simple query without complex WHERE clauses
    const rows = await sql`
      SELECT 
        ab.*,
        EXTRACT(EPOCH FROM (ab.archived_at - ab.received_at)) / 3600 as hours_active,
        CASE 
          WHEN ab.tag IS NOT NULL THEN ab.tag
          ELSE 'UNKNOWN'
        END as state_tag,
        CASE 
          WHEN EXTRACT(EPOCH FROM (ab.archived_at - ab.received_at)) / 3600 < 1 THEN '< 1 hour'
          WHEN EXTRACT(EPOCH FROM (ab.archived_at - ab.received_at)) / 3600 < 24 THEN ROUND((EXTRACT(EPOCH FROM (ab.archived_at - ab.received_at)) / 3600)::numeric, 1)::text || ' hours'
          ELSE ROUND(((EXTRACT(EPOCH FROM (ab.archived_at - ab.received_at)) / 3600) / 24)::numeric, 1)::text || ' days'
        END as duration_display,
        EXTRACT(EPOCH FROM (ab.archived_at - ab.received_at)) / 3600 as calculated_hours_active
      FROM archived_bids ab
      ORDER BY ab.archived_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const countResult = await sql`SELECT COUNT(*) as total FROM archived_bids`;
    const total = countResult[0]?.total || 0;

    // Get statistics
    const stats = await sql`
      SELECT 
        COUNT(*) as total_bids,
        COUNT(DISTINCT archived_at::date) as archive_days,
        MIN(archived_at::date) as earliest_date,
        MAX(archived_at::date) as latest_date,
        AVG(distance_miles) as avg_distance,
        MIN(distance_miles) as min_distance,
        MAX(distance_miles) as max_distance,
        COUNT(DISTINCT CASE WHEN tag IS NOT NULL THEN tag ELSE 'UNKNOWN' END) as unique_states,
        COUNT(DISTINCT tag) as unique_tags,
        AVG(EXTRACT(EPOCH FROM (archived_at - received_at)) / 3600) as avg_hours_active
      FROM archived_bids
    `;

    logSecurityEvent('archive_bids_simple_accessed', userId);
    
    const response = NextResponse.json({
      ok: true,
      data: rows,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
        totalPages: Math.ceil(total / limit)
      },
      statistics: stats[0] || {}
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching archive bids:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('archive_bids_simple_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch archive bids",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

