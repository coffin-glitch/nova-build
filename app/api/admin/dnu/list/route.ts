import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { checkApiRateLimit, addRateLimitHeaders } from "@/lib/api-rate-limiting";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * DNU List API
 * GET: Get all DNU entries with carrier information
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
    const searchQuery = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status'); // 'active' or 'removed' or null for all

    // Input validation
    const validation = validateInput(
      { searchQuery, statusFilter },
      {
        searchQuery: { type: 'string', maxLength: 200, required: false },
        statusFilter: { type: 'string', enum: ['active', 'removed'], required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_dnu_list_input', auth.userId, { errors: validation.errors });
      const response = NextResponse.json(
        { ok: false, error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // Build query with search and status filter
    let query = sql`
      SELECT 
        d.id,
        d.mc_number,
        d.dot_number,
        d.carrier_name,
        d.status,
        d.added_to_dnu_at,
        d.removed_from_dnu_at,
        d.last_upload_date,
        d.created_at,
        d.updated_at,
        (
          SELECT COUNT(*)::int
          FROM carrier_profiles cp
          WHERE (cp.mc_number = d.mc_number OR cp.dot_number = d.dot_number)
        ) as carrier_count,
        (
          SELECT json_agg(
            json_build_object(
              'user_id', cp.supabase_user_id,
              'company_name', cp.company_name,
              'mc_number', cp.mc_number,
              'dot_number', cp.dot_number,
              'profile_status', cp.profile_status
            )
          )
          FROM carrier_profiles cp
          WHERE (cp.mc_number = d.mc_number OR cp.dot_number = d.dot_number)
          LIMIT 10
        ) as matching_carriers
      FROM dnu_tracking d
      WHERE 1=1
    `;

    // Add status filter
    if (statusFilter === 'active' || statusFilter === 'removed') {
      query = sql`${query} AND d.status = ${statusFilter}`;
    }

    // Add search filter
    if (searchQuery) {
      const searchPattern = `%${searchQuery}%`;
      query = sql`
        ${query}
        AND (
          d.mc_number ILIKE ${searchPattern}
          OR d.dot_number ILIKE ${searchPattern}
          OR d.carrier_name ILIKE ${searchPattern}
        )
      `;
    }

    // Order by most recently added to oldest
    query = sql`${query} ORDER BY d.added_to_dnu_at DESC NULLS LAST, d.created_at DESC`;

    const result = await query;

    logSecurityEvent('dnu_list_accessed', auth.userId, { 
      searchQuery: searchQuery || null,
      statusFilter: statusFilter || null,
      resultCount: result.length
    });

    const response = NextResponse.json({
      ok: true,
      data: result
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error getting DNU list:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('dnu_list_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        ok: false, 
        error: error.message || "Failed to get DNU list",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

