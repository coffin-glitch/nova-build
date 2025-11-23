import { addSecurityHeaders, logSecurityEvent, validateInput } from "@/lib/api-security";
import { cacheManager } from "@/lib/cache-manager";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// Cache for frequently accessed data
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds for loads (less dynamic than bids)

// Register cache with cache manager
cacheManager.registerCache("loads", cache);

// Clear cache function
function clearCache() {
  cache.clear();
  console.log("🧹 Cache cleared");
}

export async function GET(request: NextRequest) {
  try {
    // Check rate limit for public route (IP-based)
    const rateLimit = await checkApiRateLimit(request, {
      routeType: 'public'
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

    // Input validation for query parameters
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const equipment = searchParams.get("equipment");
    const limitParam = searchParams.get("limit") || "50";
    const offsetParam = searchParams.get("offset") || "0";

    // Validate input
    const validation = validateInput(
      { origin, destination, equipment, limit: limitParam, offset: offsetParam },
      {
        origin: { type: 'string', maxLength: 100, required: false },
        destination: { type: 'string', maxLength: 100, required: false },
        equipment: { type: 'string', maxLength: 50, required: false },
        limit: { type: 'string', pattern: /^\d+$/, required: false },
        offset: { type: 'string', pattern: /^\d+$/, required: false }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_input_loads', undefined, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    const limit = Math.min(parseInt(limitParam), 100); // Max 100
    const offset = Math.max(0, parseInt(offsetParam)); // Ensure non-negative

    // Create cache key
    const cacheKey = `loads-${origin}-${destination}-${equipment}-${limit}-${offset}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ 
        ...cached.data,
        cached: true 
      });
    }

    // Build optimized query with proper indexing hints - Carrier visible fields only
    const loads = await sql`
      SELECT 
        rr_number,
        COALESCE(tm_number, '') as tm_number,
        COALESCE(status_code, 'active') as status_code,
        pickup_date,
        pickup_time,
        delivery_date,
        delivery_time,
        COALESCE(target_buy, 0) as target_buy,
        equipment,
        COALESCE(weight, 0) as weight,
        COALESCE(miles, 0) as miles,
        COALESCE(nbr_of_stops, 0) as stops,
        COALESCE(customer_name, '') as customer_name,
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        updated_at,
        published
      FROM loads
      WHERE published = true
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Note: For now, we're using a simplified query without filters
    // TODO: Add proper filtering logic

    // Get total count for pagination (simplified)
    const countResult = await sql`SELECT COUNT(*) as total FROM loads WHERE published = true`;
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

    // Cache the result
    cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Clean old cache entries periodically
    if (cache.size > 50) {
      const now = Date.now();
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }
    }

    const response = NextResponse.json(result);
    return addRateLimitHeaders(addSecurityHeaders(response), rateLimit);

  } catch (error) {
    console.error("Error fetching loads:", error);
    logSecurityEvent('loads_fetch_error', undefined, { 
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
    // Require admin authentication for bulk operations
    const { requireApiAdmin } = await import('@/lib/auth-api-helper');
    const auth = await requireApiAdmin(request);
    const userId = auth.userId;

    const body = await request.json();
    const { action, rrNumbers } = body;

    // Input validation
    const validation = validateInput(
      { action, rrNumbers },
      {
        action: { 
          required: true, 
          type: 'string', 
          enum: ['archive', 'delete', 'publish', 'unpublish'] 
        },
        rrNumbers: { 
          required: true, 
          type: 'array',
          minLength: 1,
          maxLength: 100 // Limit bulk operations
        }
      }
    );

    if (!validation.valid) {
      logSecurityEvent('invalid_bulk_operation', userId, { errors: validation.errors });
      const response = NextResponse.json(
        { error: `Invalid input: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    if (!Array.isArray(rrNumbers) || rrNumbers.length === 0) {
      const response = NextResponse.json(
        { error: "At least one load must be selected" },
        { status: 400 }
      );
      return addSecurityHeaders(response);
    }

    let result;
    let message;

    // Validate and sanitize rrNumbers to prevent SQL injection
    const validRrNumbers = rrNumbers.filter((rr: any) => 
      typeof rr === 'string' && /^[A-Z0-9\-]+$/.test(rr) && rr.length <= 50
    );
    
    if (validRrNumbers.length === 0) {
      return NextResponse.json(
        { error: "Invalid RR numbers provided" },
        { status: 400 }
      );
    }

    switch (action) {
              case "archive":
                result = await sql`
                  UPDATE loads 
                  SET 
                    status_code = 'archived',
                    updated_at = CURRENT_TIMESTAMP
                  WHERE rr_number = ANY(${validRrNumbers})
                `;
                message = `Archived ${validRrNumbers.length} load(s)`;
                break;

              case "delete":
                result = await sql`
                  DELETE FROM loads 
                  WHERE rr_number = ANY(${validRrNumbers})
                `;
                message = `Deleted ${validRrNumbers.length} load(s)`;
                break;

              case "publish":
                result = await sql`
                  UPDATE loads 
                  SET 
                    status_code = 'published',
                    published = true,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE rr_number = ANY(${validRrNumbers})
                `;
                message = `Published ${validRrNumbers.length} load(s)`;
                break;

              case "unpublish":
                result = await sql`
                  UPDATE loads 
                  SET 
                    published = false,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE rr_number = ANY(${validRrNumbers})
                `;
                message = `Unpublished ${validRrNumbers.length} load(s)`;
                break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Must be one of: archive, delete, publish, unpublish" },
          { status: 400 }
        );
    }

    // Clear cache after bulk operations
    clearCache();

    logSecurityEvent('bulk_load_operation', userId, { 
      action, 
      count: validRrNumbers.length 
    });

    const response = NextResponse.json({
      success: true,
      message,
      affectedCount: validRrNumbers.length,
      affectedLoads: validRrNumbers
    });
    
    return addSecurityHeaders(response);

  } catch (error: any) {
    console.error("Error performing bulk operation:", error);
    
    // Handle auth errors
    if (error.message === "Unauthorized" || error.message === "Admin access required") {
      const response = NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
      return addSecurityHeaders(response);
    }
    
    logSecurityEvent('bulk_load_operation_error', undefined, { 
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