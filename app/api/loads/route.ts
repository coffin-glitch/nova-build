import { cacheManager } from "@/lib/cache-manager";
import sql from "@/lib/db.server";
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
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const equipment = searchParams.get("equipment");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

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

    // Build optimized query with proper indexing hints
    const loads = await sql`
      SELECT 
        rr_number,
        COALESCE(tm_number, '') as tm_number,
        COALESCE(status_code, 'active') as status_code,
        pickup_date,
        COALESCE(pickup_time, '') as pickup_window,
        delivery_date,
        COALESCE(delivery_time, '') as delivery_window,
        COALESCE(revenue, 0) as revenue,
        COALESCE(purchase, 0) as purchase,
        COALESCE(net, 0) as net,
        COALESCE(margin, 0) as margin,
        equipment,
        COALESCE(customer_name, '') as customer_name,
        COALESCE(driver_name, '') as driver_name,
        COALESCE(miles, 0) as total_miles,
        origin_city,
        origin_state,
        destination_city,
        destination_state,
        COALESCE(vendor_name, '') as vendor_name,
        COALESCE(dispatcher_name, '') as dispatcher_name,
        updated_at,
        published
      FROM loads
      WHERE published = 1
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Note: For now, we're using a simplified query without filters
    // TODO: Add proper filtering logic

    // Get total count for pagination (simplified)
    const countResult = await sql`SELECT COUNT(*) as total FROM loads WHERE published = 1`;
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

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error fetching loads:", error);
    return NextResponse.json(
      { error: "Failed to fetch loads", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, rrNumbers } = body;

    if (!action || !rrNumbers || !Array.isArray(rrNumbers)) {
      return NextResponse.json(
        { error: "Action and rrNumbers array are required" },
        { status: 400 }
      );
    }

    if (rrNumbers.length === 0) {
      return NextResponse.json(
        { error: "At least one load must be selected" },
        { status: 400 }
      );
    }

    let result;
    let message;

    switch (action) {
              case "archive":
                result = await sql`
                  UPDATE loads 
                  SET 
                    status_code = 'archived',
                    updated_at = CURRENT_TIMESTAMP
                  WHERE rr_number IN (${rrNumbers.join("','")})
                `;
                message = `Archived ${(result as any).changes} load(s)`;
                break;

              case "delete":
                result = await sql`
                  DELETE FROM loads 
                  WHERE rr_number IN (${rrNumbers.join("','")})
                `;
                message = `Deleted ${(result as any).changes} load(s)`;
                break;

              case "publish":
                result = await sql`
                  UPDATE loads 
                  SET 
                    status_code = 'published',
                    published = 1,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE rr_number IN (${rrNumbers.join("','")})
                `;
                message = `Published ${(result as any).changes} load(s)`;
                break;

              case "unpublish":
                result = await sql`
                  UPDATE loads 
                  SET 
                    published = 0,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE rr_number IN (${rrNumbers.join("','")})
                `;
                message = `Unpublished ${(result as any).changes} load(s)`;
                break;

      default:
        return NextResponse.json(
          { error: "Invalid action. Must be one of: archive, delete, publish, unpublish" },
          { status: 400 }
        );
    }

    // Clear cache after bulk operations
    clearCache();

            return NextResponse.json({
              success: true,
              message,
              affectedCount: (result as any).changes || 0,
              affectedLoads: rrNumbers
            });

  } catch (error) {
    console.error("Error performing bulk operation:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk operation", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}