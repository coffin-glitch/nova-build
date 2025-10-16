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
        COALESCE(stops, 0) as stops,
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
                message = `Archived ${(result as any).count || 0} load(s)`;
                break;

              case "delete":
                result = await sql`
                  DELETE FROM loads 
                  WHERE rr_number IN (${rrNumbers.join("','")})
                `;
                message = `Deleted ${(result as any).count || 0} load(s)`;
                break;

              case "publish":
                result = await sql`
                  UPDATE loads 
                  SET 
                    status_code = 'published',
                    published = true,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE rr_number IN (${rrNumbers.join("','")})
                `;
                message = `Published ${(result as any).count || 0} load(s)`;
                break;

              case "unpublish":
                result = await sql`
                  UPDATE loads 
                  SET 
                    published = false,
                    updated_at = CURRENT_TIMESTAMP
                  WHERE rr_number IN (${rrNumbers.join("','")})
                `;
                message = `Unpublished ${(result as any).count || 0} load(s)`;
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
              affectedCount: (result as any).count || 0,
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