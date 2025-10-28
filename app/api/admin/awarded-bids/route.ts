import { requireAdmin } from "@/lib/clerk-server";
import sql from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Starting awarded bids API call");
    
    // This will redirect if user is not admin
    await requireAdmin();
    console.log("✅ Admin authentication passed");

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    console.log("📋 Query params:", { page, limit, search, status, sortBy, sortOrder });

    // Validate parameters
    const validSortFields = ['bid_number', 'created_at', 'carrier_name'];
    const validSortOrders = ['asc', 'desc'];
    
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json({ error: "Invalid sort field" }, { status: 400 });
    }
    
    if (!validSortOrders.includes(sortOrder)) {
      return NextResponse.json({ error: "Invalid sort order" }, { status: 400 });
    }

    // Build WHERE clause - ensure we only get awarded bids
    let whereConditions = [];
    let queryParams = [];
    
    // Always filter for awarded bids only
    whereConditions.push(`aa.bid_number IS NOT NULL`);
    
    if (search) {
      whereConditions.push(`(
        aa.bid_number ILIKE $${queryParams.length + 1} OR 
        cp.contact_name ILIKE $${queryParams.length + 1}
      )`);
      queryParams.push(`%${search}%`);
    }
    
    if (status !== 'all') {
      whereConditions.push(`cb.status = $${queryParams.length + 1}`);
      queryParams.push(status);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Build ORDER BY clause - use column names from outer SELECT
    let orderByField;
    switch (sortBy) {
      case 'bid_number':
        orderByField = 'bid_number';
        break;
      case 'created_at':
        orderByField = 'created_at';
        break;
      case 'carrier_name':
        orderByField = 'carrier_name';
        break;
      case 'bid_amount':
        orderByField = 'bid_amount';
        break;
      case 'status':
        orderByField = 'status';
        break;
      default:
        orderByField = 'created_at';
    }
    
    const orderByClause = `ORDER BY ${orderByField} ${sortOrder.toUpperCase()}`;
    
    // Get total count for pagination using ROW_NUMBER() approach
    // Use LEFT JOIN on carrier_bids to include awarded bids even if not accepted yet
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT 
          aa.bid_number,
          ROW_NUMBER() OVER (PARTITION BY aa.bid_number ORDER BY aa.awarded_at DESC, aa.id DESC) as rn
        FROM auction_awards aa
        LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number AND aa.winner_user_id = cb.clerk_user_id
        LEFT JOIN carrier_profiles cp ON aa.winner_user_id = cp.clerk_user_id
        LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
        ${whereClause}
      ) ranked_bids
      WHERE rn = 1
    `;
    
    console.log("🔍 Executing count query...");
    const countResult = await sql.unsafe(countQuery, queryParams);
    const totalCount = parseInt(countResult[0]?.total || '0');
    
    // Calculate pagination
    const offset = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);
    
    console.log("📊 Pagination info:", { totalCount, totalPages, offset, limit });

    // Get paginated results using ROW_NUMBER() to ensure uniqueness
    // Use LEFT JOIN on carrier_bids to include awarded bids even if not accepted yet
    // COALESCE to handle null values from LEFT JOIN
    const dataQuery = `
      SELECT 
        bid_number,
        id,
        carrier_id,
        carrier_name,
        carrier_phone,
        bid_amount,
        status,
        lifecycle_notes,
        driver_name,
        driver_phone,
        truck_number,
        trailer_number,
        driver_info_submitted_at,
        created_at,
        updated_at,
        miles,
        equipment_type,
        stops,
        pickup_timestamp,
        delivery_timestamp
      FROM (
        SELECT 
          aa.bid_number,
          aa.id,
          aa.winner_user_id as carrier_id,
          COALESCE(cp.contact_name, 'Carrier (' || aa.winner_user_id || ')') as carrier_name,
          COALESCE(cp.phone, 'No phone available') as carrier_phone,
          aa.winner_amount_cents as bid_amount,
          COALESCE(cb.status, 'awarded') as status,
          cb.lifecycle_notes,
          cb.driver_name,
          cb.driver_phone,
          cb.truck_number,
          cb.trailer_number,
          cb.driver_info_submitted_at,
          aa.awarded_at as created_at,
          aa.awarded_at as updated_at,
          COALESCE(tb.distance_miles, 0) as miles,
          COALESCE(tb.tag, '') as equipment_type,
          COALESCE(tb.stops, '[]'::jsonb) as stops,
          tb.pickup_timestamp,
          tb.delivery_timestamp,
          ROW_NUMBER() OVER (PARTITION BY aa.bid_number ORDER BY aa.awarded_at DESC, aa.id DESC) as rn
        FROM auction_awards aa
        LEFT JOIN carrier_bids cb ON aa.bid_number = cb.bid_number AND aa.winner_user_id = cb.clerk_user_id
        LEFT JOIN carrier_profiles cp ON aa.winner_user_id = cp.clerk_user_id
        LEFT JOIN telegram_bids tb ON aa.bid_number = tb.bid_number
        ${whereClause}
      ) ranked_bids
      WHERE rn = 1
      ORDER BY ${orderByField} ${sortOrder.toUpperCase()}
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;
    
    console.log("🔍 Executing data query...");
    console.log("📝 Query:", dataQuery);
    console.log("📊 Query params:", [...queryParams, limit, offset]);
    
    let bids;
    try {
      bids = await sql.unsafe(dataQuery, [...queryParams, limit, offset]);
      console.log("✅ SQL query executed successfully, found", bids.length, "bids");
    } catch (error) {
      console.error("❌ SQL query failed:", error);
      throw error;
    }

    return NextResponse.json({
      bids,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("Error fetching awarded bids:", error);
    return NextResponse.json(
      { error: "Failed to fetch awarded bids", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
