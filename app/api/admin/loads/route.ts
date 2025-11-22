import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { requireApiAdmin, unauthorizedResponse } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const equipment = searchParams.get("equipment");
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const limitParam = searchParams.get("limit") || "25";
    const offsetParam = searchParams.get("offset") || "0";

    // Input validation
    const validation = validateInput(
      { search, status, equipment, origin, destination, limit: limitParam, offset: offsetParam },
      {
        search: { type: 'string', maxLength: 200, required: false },
        status: { type: 'string', maxLength: 50, required: false },
        equipment: { type: 'string', maxLength: 50, required: false },
        origin: { type: 'string', maxLength: 200, required: false },
        destination: { type: 'string', maxLength: 200, required: false },
        limit: { type: 'string', pattern: /^\d+$/, required: false },
        offset: { type: 'string', pattern: /^\d+$/, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_admin_loads_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const limit = Math.min(parseInt(limitParam), 100);
    const offset = Math.max(0, parseInt(offsetParam));

    // Build query with admin-specific fields and no published filter
    let query = sql`
      SELECT 
        rr_number,
        COALESCE(tm_number, '') as tm_number,
        COALESCE(load_number, '') as load_number,
        COALESCE(status_code, 'active') as status_code,
        pickup_date,
        pickup_time,
        delivery_date,
        delivery_time,
        COALESCE(target_buy, 0) as target_buy,
        COALESCE(max_buy, 0) as max_buy,
        COALESCE(spot_bid, '') as spot_bid,
        equipment,
        COALESCE(weight, 0) as weight,
        COALESCE(miles, 0) as miles,
        COALESCE(stops, 0) as stops,
        COALESCE(customer_name, '') as customer_name,
        COALESCE(customer_ref, '') as customer_ref,
        COALESCE(driver_name, '') as driver_name,
        COALESCE(dispatcher_name, '') as dispatcher_name,
        COALESCE(vendor_name, '') as vendor_name,
        COALESCE(vendor_dispatch, '') as vendor_dispatch,
        COALESCE(revenue, 0) as revenue,
        COALESCE(fuel_surcharge, 0) as fuel_surcharge,
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        published,
        archived,
        created_at,
        updated_at
      FROM loads
      WHERE 1=1
    `;

    // Add filters with parameterized queries to prevent SQL injection
    if (search) {
      const searchPattern = `%${search}%`;
      query = sql`
        ${query}
        AND (
          rr_number ILIKE ${searchPattern} OR
          origin_city ILIKE ${searchPattern} OR
          destination_city ILIKE ${searchPattern} OR
          customer_name ILIKE ${searchPattern}
        )
      `;
    }

    if (status && status !== "all") {
      query = sql`
        ${query}
        AND status_code = ${status}
      `;
    }

    if (equipment && equipment !== "all") {
      query = sql`
        ${query}
        AND equipment = ${equipment}
      `;
    }

    if (origin) {
      const originPattern = `%${origin}%`;
      query = sql`
        ${query}
        AND (origin_city ILIKE ${originPattern} OR origin_state ILIKE ${originPattern})
      `;
    }

    if (destination) {
      const destPattern = `%${destination}%`;
      query = sql`
        ${query}
        AND (destination_city ILIKE ${destPattern} OR destination_state ILIKE ${destPattern})
      `;
    }

    // Add ordering and pagination
    query = sql`
      ${query}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const loads = await query;

    // Get total count for pagination
    let countQuery = sql`
      SELECT COUNT(*) as total FROM loads WHERE 1=1
    `;

    if (search) {
      const searchPattern = `%${search}%`;
      countQuery = sql`
        ${countQuery}
        AND (
          rr_number ILIKE ${searchPattern} OR
          origin_city ILIKE ${searchPattern} OR
          destination_city ILIKE ${searchPattern} OR
          customer_name ILIKE ${searchPattern}
        )
      `;
    }

    if (status && status !== "all") {
      countQuery = sql`
        ${countQuery}
        AND status_code = ${status}
      `;
    }

    if (equipment && equipment !== "all") {
      countQuery = sql`
        ${countQuery}
        AND equipment = ${equipment}
      `;
    }

    if (origin) {
      const originPattern = `%${origin}%`;
      countQuery = sql`
        ${countQuery}
        AND (origin_city ILIKE ${originPattern} OR origin_state ILIKE ${originPattern})
      `;
    }

    if (destination) {
      const destPattern = `%${destination}%`;
      countQuery = sql`
        ${countQuery}
        AND (destination_city ILIKE ${destPattern} OR destination_state ILIKE ${destPattern})
      `;
    }

    const countResult = await countQuery;
    const total = parseInt((countResult as any[])[0]?.total || "0");

    const result = {
      loads,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };

    logSecurityEvent('admin_loads_accessed', userId, { 
      search: search || null,
      status: status || null,
      limit,
      offset
    });
    
    const response = NextResponse.json(result);
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error fetching admin loads:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_loads_fetch_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to fetch loads",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const body = await request.json();
    const { action, rrNumbers } = body;

    // Input validation
    const validation = validateInput(
      { action, rrNumbers },
      {
        action: { required: true, type: 'string', enum: ['archive', 'delete', 'publish', 'unpublish', 'unpublish_all'] },
        rrNumbers: { type: 'array', maxLength: 1000, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_admin_loads_post_input', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!action) {
      const response = NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    // For unpublish_all, we don't need rrNumbers
    if (action !== 'unpublish_all') {
      if (!rrNumbers || !Array.isArray(rrNumbers)) {
        const response = NextResponse.json(
          { error: "rrNumbers array is required for this action" },
          { status: 400 }
        );
        return addSecurityHeaders(response);
      }

      if (rrNumbers.length === 0) {
        const response = NextResponse.json(
          { error: "At least one load must be selected" },
          { status: 400 }
        );
        return addSecurityHeaders(response);
      }

      // Validate and sanitize rrNumbers
      const validRrNumbers = rrNumbers.filter((rr: any) => 
        typeof rr === 'string' && /^[A-Z0-9\-_]+$/.test(rr) && rr.length <= 100
      );

      if (validRrNumbers.length === 0) {
        const response = NextResponse.json(
          { error: "No valid RR numbers provided" },
          { status: 400 }
        );
        return addSecurityHeaders(response);
      }
    }

    let result;
    let message;

    switch (action) {
      case "archive":
        // Use parameterized query with ANY() to prevent SQL injection
        result = await sql`
          UPDATE loads 
          SET 
            status_code = 'archived',
            archived = true,
            updated_at = CURRENT_TIMESTAMP
          WHERE rr_number = ANY(${validRrNumbers})
        `;
        message = `Archived ${(result as any).count || 0} load(s)`;
        break;

      case "delete":
        // Use parameterized query with ANY() to prevent SQL injection
        result = await sql`
          DELETE FROM loads 
          WHERE rr_number = ANY(${validRrNumbers})
        `;
        message = `Deleted ${(result as any).count || 0} load(s)`;
        break;

      case "publish":
        // Use parameterized query with ANY() to prevent SQL injection
        result = await sql`
          UPDATE loads 
          SET 
            status_code = 'published',
            published = true,
            updated_at = CURRENT_TIMESTAMP
          WHERE rr_number = ANY(${validRrNumbers})
        `;
        message = `Published ${(result as any).count || 0} load(s)`;
        break;

      case "unpublish":
        // Use parameterized query with ANY() to prevent SQL injection
        result = await sql`
          UPDATE loads 
          SET 
            published = false,
            updated_at = CURRENT_TIMESTAMP
          WHERE rr_number = ANY(${validRrNumbers})
        `;
        message = `Unpublished ${(result as any).count || 0} load(s)`;
        break;

      case "unpublish_all":
        result = await sql`
          UPDATE loads 
          SET 
            published = false,
            updated_at = CURRENT_TIMESTAMP
        `;
        message = `Unpublished all loads - removed from find-loads page`;
        break;

      default:
        const defaultResponse = NextResponse.json(
          { error: "Invalid action. Must be one of: archive, delete, publish, unpublish, unpublish_all" },
          { status: 400 }
        );
        return addSecurityHeaders(defaultResponse);
    }

    logSecurityEvent('admin_loads_bulk_action', userId, { 
      action,
      affectedCount: (result as any).count || 0,
      isUnpublishAll: action === 'unpublish_all'
    });
    
    const response = NextResponse.json({
      success: true,
      message,
      affectedCount: (result as any).count || 0,
      affectedLoads: action === 'unpublish_all' ? 'all' : validRrNumbers
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error performing admin bulk operation:", error);
    
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      return unauthorizedResponse();
    }
    
    logSecurityEvent('admin_loads_bulk_action_error', undefined, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    const response = NextResponse.json(
      { 
        error: "Failed to perform bulk operation",
        details: process.env.NODE_ENV === 'development' 
          ? (error instanceof Error ? error.message : 'Unknown error')
          : undefined
      },
      { status: 500 }
    );
    
    return addSecurityHeaders(response);
  }
}