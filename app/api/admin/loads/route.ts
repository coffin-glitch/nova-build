import { requireApiAdmin } from "@/lib/auth-api-helper";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const equipment = searchParams.get("equipment");
    const origin = searchParams.get("origin");
    const destination = searchParams.get("destination");
    const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

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

    // Add filters
    if (search) {
      query = sql`
        ${query}
        AND (
          rr_number ILIKE ${`%${search}%`} OR
          origin_city ILIKE ${`%${search}%`} OR
          destination_city ILIKE ${`%${search}%`} OR
          customer_name ILIKE ${`%${search}%`}
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
      query = sql`
        ${query}
        AND (origin_city ILIKE ${`%${origin}%`} OR origin_state ILIKE ${`%${origin}%`})
      `;
    }

    if (destination) {
      query = sql`
        ${query}
        AND (destination_city ILIKE ${`%${destination}%`} OR destination_state ILIKE ${`%${destination}%`})
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
      countQuery = sql`
        ${countQuery}
        AND (
          rr_number ILIKE ${`%${search}%`} OR
          origin_city ILIKE ${`%${search}%`} OR
          destination_city ILIKE ${`%${search}%`} OR
          customer_name ILIKE ${`%${search}%`}
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
      countQuery = sql`
        ${countQuery}
        AND (origin_city ILIKE ${`%${origin}%`} OR origin_state ILIKE ${`%${origin}%`})
      `;
    }

    if (destination) {
      countQuery = sql`
        ${countQuery}
        AND (destination_city ILIKE ${`%${destination}%`} OR destination_state ILIKE ${`%${destination}%`})
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

    return NextResponse.json(result);

  } catch (error) {
    console.error("Error fetching admin loads:", error);
    return NextResponse.json(
      { error: "Failed to fetch loads", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure user is admin (Supabase-only)
    await requireApiAdmin(request);

    const body = await request.json();
    const { action, rrNumbers } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // For unpublish_all, we don't need rrNumbers
    if (action !== 'unpublish_all') {
      if (!rrNumbers || !Array.isArray(rrNumbers)) {
        return NextResponse.json(
          { error: "rrNumbers array is required for this action" },
          { status: 400 }
        );
      }

      if (rrNumbers.length === 0) {
        return NextResponse.json(
          { error: "At least one load must be selected" },
          { status: 400 }
        );
      }
    }

    let result;
    let message;

    switch (action) {
      case "archive":
        result = await sql`
          UPDATE loads 
          SET 
            status_code = 'archived',
            archived = true,
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
        return NextResponse.json(
          { error: "Invalid action. Must be one of: archive, delete, publish, unpublish, unpublish_all" },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      message,
      affectedCount: (result as any).count || 0,
      affectedLoads: action === 'unpublish_all' ? 'all' : rrNumbers
    });

  } catch (error) {
    console.error("Error performing admin bulk operation:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk operation", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}